import { ActLog, AktiviteRow, DurumKey, KanalKey, TipCat, TipKey } from "./types";

// ─── Backend (Case/Activity) ↔ UI eşlemeleri ───────────────────────────────────
// Yeni eklenen talepler /api/flexos/cases'e (persons+flexos_cases+flexos_activities)
// yazılır; eski dummy kayıtlar flexos_prospects'te kalır. Liste ikisini birleştirir.

export const KANAL_TO_CHANNEL: Record<KanalKey, string> = {
  telefon: "telefon", websitesi: "web", instagram: "instagram",
  whatsapp: "whatsapp", email: "email", tavsiye: "tavsiye", walkin: "yuzeyuz",
};
export const CHANNEL_TO_KANAL: Record<string, KanalKey> = {
  telefon: "telefon", web: "websitesi", instagram: "instagram",
  whatsapp: "whatsapp", email: "email", tavsiye: "tavsiye", yuzeyuz: "walkin",
};
export const ACTTYPE_TO_TIP: Record<string, TipKey> = {
  arama: "arama", mesaj: "mesaj", randevu: "randevu", not: "not", satis_donusumu: "satis",
};
export const CASESTATUS_TO_DURUM: Record<string, DurumKey> = {
  yeni: "yeni", iletisimde: "iletisimde", yanit_bekleniyor: "yanit",
  randevu_olusturuldu: "randevu", kazanildi: "kazanildi", tamamlandi: "kazanildi", vazgecti: "vazgecti",
};
// UI "Sonraki" etiketi → backend activity nextActionType
export const SONRAKI_TO_ACTTYPE: Record<string, string> = {
  "Tekrar Aranacak": "arama", "Mesaj Gönderilecek": "mesaj",
  "Randevu Oluşturulacak": "randevu", "Teklif Gönderilecek": "not",
};
// Zengin UI durumu (DurumKey) → canonical backend CaseStatus (açık/kapalı mantığı için).
// Rozetin kendisi uiDurum'dan gelir; bu sadece domain status'unu korur.
export const DURUM_TO_CASESTATUS: Record<DurumKey, string> = {
  aksiyon_alinacak: "yeni",
  yeni:             "yeni",
  iletisimde:       "iletisimde",
  arandi:           "iletisimde",
  yanit:            "yanit_bekleniyor",
  mesaj_gonderildi: "iletisimde",
  teklif_gonderildi:"iletisimde",
  randevu_planli:   "iletisimde",
  randevu:          "randevu_olusturuldu",
  kazanildi:        "kazanildi",
  vazgecti:         "vazgecti",
};
export const CLOSED_DURUMS: DurumKey[] = ["kazanildi", "vazgecti"];

export interface CaseApiItem {
  id: string;
  personName: string;
  personPhone: string | null;
  personEmail: string | null;
  channel: string;
  type: TipCat;
  status: string;
  activityCount: number;
  lastActivityAt?: string;
  createdAt: string;
  assignedToUid?: string;
  assignedToName?: string;
  uiDurum?: string;
  uiSonrakiTip?: string;
  /** Sorumlunun (`assignedToUid`) kendi şubesi — atanmamış talepte null. */
  officeName: string | null;
  firstActivityNote: string | null;
  lastActivityNote: string | null;
  lastActivityType: string | null;
  nextActionType: string | null;
  nextActionDate: string | null;
  activityLog?: { note: string | null; type: string; createdAt: string; nextActionType: string | null }[];
}

/** Backend Case → UI satırı. */
export function caseToRow(c: CaseApiItem): AktiviteRow {
  const when = c.lastActivityAt || c.createdAt;
  const d = new Date(when);
  // Geçmiş aksiyonlar = ilk aktivite (müşteri mesajı) HARİÇ, notu olanlar.
  const log: ActLog[] = (c.activityLog ?? []).slice(1).filter(x => x.note).map(x => {
    const dt = new Date(x.createdAt);
    return {
      note: x.note as string,
      tarih: dt.toLocaleDateString("tr-TR"),
      saat: dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    };
  });
  // Rozet = zengin uiDurum (varsa); yoksa canonical status'tan türet.
  const durum: DurumKey = (c.uiDurum as DurumKey) || CASESTATUS_TO_DURUM[c.status] || "yeni";
  // 2026-07-22 kullanıcı bulgusu: detayda sol alttaki "Gelecek Randevu" kutusu
  // gerçek (backend) verilerde HER ZAMAN boştu — `nextActionDate` (randevu
  // oluşturulunca tam ISO tarih+saat olarak zaten set ediliyor, bkz. yukarıdaki
  // "appointment" POST body'si) hiç okunmuyordu. Demo/sahte veri (DEMO_ACTS,
  // yukarıda) bunu elle dolduruyordu, gerçek Case→Row eşlemesi (`caseToRow`)
  // unutulmuştu. Sadece durum GERÇEKTEN "randevu" (Randevu Oluşturuldu) ise
  // gösterilir — sırf "sonraki aksiyon tarihi" girilmiş olması yetmez (demo
  // veride de aynı ayrım var, ör. "Masael Baran" sonrakiTarih dolu ama durum
  // "yanit" olduğu için gelecekRandevu boş).
  const nextDt = c.nextActionDate ? new Date(c.nextActionDate) : null;
  const nextSaat = nextDt ? nextDt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
  const gelecekRandevu = durum === "randevu" && nextDt ? `${nextDt.toLocaleDateString("tr-TR")} ${nextSaat}` : "";
  return {
    _backend: true,
    _caseId: c.id,
    _log: log,
    id: Date.parse(c.createdAt) || Date.now(),
    kanal: CHANNEL_TO_KANAL[c.channel] ?? "telefon",
    tip: c.lastActivityType ? (ACTTYPE_TO_TIP[c.lastActivityType] ?? "not") : "not",
    tipCat: c.type,
    ozet: c.firstActivityNote || c.lastActivityNote || "Yeni talep",
    ad: c.personName,
    iletisim: c.personPhone || c.personEmail || "—",
    durum,
    tarih: d.toLocaleDateString("tr-TR"),
    saat: d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    sorumlu: c.assignedToName || (c.assignedToUid ? "Atanmış" : "—"),
    // Müşteri mesajı = ilk temas (üstte). Aksiyon kutusu = yeni giriş (BOŞ). Geçmiş = _log.
    musteriMesaji: c.firstActivityNote || "",
    aksiyonNotu: "",
    sonrakiTip: c.uiSonrakiTip || "",
    sonrakiTarih: c.nextActionDate ? c.nextActionDate.slice(0, 10) : "",
    sonrakiSaat: nextSaat,
    gelecekRandevu,
    aktiviteSayisi: c.activityCount,
    officeName: c.officeName,
  };
}
