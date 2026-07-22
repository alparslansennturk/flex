"use client";

/**
 * FlexOS · Aktivite Merkezi
 * Tasarım: _design "Aktivite Merkezi.dc.html" (Claude Design) React'e portlandı.
 * Aynı desen: inline S/IC, Inter, authStateReady korumalı, FlexSidebar.
 *
 * KARARLAR (2026-06-30):
 *  - Talepler dış kanallardan (web/IG/WhatsApp) otomatik düşer.
 *  - Manuel giriş için "Aktivite Ekle" butonu var — hafif modal (Ad/Soyad/Tel/Kanal/Not).
 *  - TC, e-posta, eğitim dropdown'ı yok.
 *  - Expand panelde: aksiyon notu + sonraki adım + Tarih + Saat (eklendi) + Sorumlu devralma.
 *  - Randevu ekleme ayrı sayfa — ileride yapılacak.
 *  - "Aktivite Ekle" + tüm satır düzenlemeleri → /api/flexos/cases & /activities
 *    (persons + flexos_cases + flexos_activities) — TEK veri kaynağı.
 *
 * 2026-07-22: eski `flexos_prospects` sahte/demo veri seti (14 satır, DEMO sabiti)
 * ve onu besleyen seed/onSnapshot/save yolu TAMAMEN kaldırıldı — gerçek backend
 * satırlarıyla aynı listede görünüp aksiyon alınabildiği için ("Randevu
 * Oluşturulacak" dahil) kullanıcı sahte bir satırda işlem yapınca hiçbir şey
 * gerçek sisteme yansımıyordu (ayrı, ölü bir koleksiyona yazıyordu).
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState, CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../_components/FlexSpinner";
import { formatTrPhone } from "@/app/lib/phone";
import { FLEX_MESSAGES } from "@/app/lib/messages";
import { useRealtimeSync } from "../_shared/useRealtimeSync";

// ─── Sözlükler ────────────────────────────────────────────────────────────────

type KanalKey = "telefon" | "websitesi" | "instagram" | "whatsapp" | "email" | "tavsiye" | "walkin";
type TipKey   = "arama" | "mesaj" | "randevu" | "not" | "satis";
type DurumKey = "aksiyon_alinacak" | "yeni" | "iletisimde" | "arandi" | "yanit" | "mesaj_gonderildi" | "teklif_gonderildi" | "randevu_planli" | "randevu" | "kazanildi" | "vazgecti";
type TipCat   = "satis_oncesi" | "satis_sonrasi" | "destek";

const KANALS: Record<KanalKey, { label: string; bg: string; color: string }> = {
  telefon:   { label: "Telefon",    bg: "#E6F5ED", color: "#007A30" },
  websitesi: { label: "Web Sitesi", bg: "#DDE8F8", color: "#205297" },
  instagram: { label: "Instagram",  bg: "#FED7E9", color: "#B80E57" },
  whatsapp:  { label: "WhatsApp",   bg: "#E6F5ED", color: "#1a7a40" },
  email:     { label: "Email",      bg: "#FFECEC", color: "#B42318" },
  tavsiye:   { label: "Tavsiye",    bg: "#EDE9FE", color: "#5B21B6" },
  walkin:    { label: "Walk-in",    bg: "#FFF3DC", color: "#8A5A00" },
};

const TIPLER: Record<TipKey, { label: string; color: string; bg: string }> = {
  arama:   { label: "Arama",            color: "#205297", bg: "#DDE8F8" },
  mesaj:   { label: "Mesaj",            color: "#0E5D59", bg: "#AFF3F0" },
  randevu: { label: "Randevu",          color: "#4D52A6", bg: "#DDE0FA" },
  not:     { label: "Not",              color: "#6F7B87", bg: "#EEF0F3" },
  satis:   { label: "Satışa Dönüştür", color: "#007A30", bg: "#E6F5ED" },
};

const DURUMLAR: Record<DurumKey, { label: string; color: string; bg: string; dot: string }> = {
  aksiyon_alinacak: { label: "Aksiyon Alınacak", color: "#6F7B87", bg: "#EEF0F3", dot: "#AEB4C0" },
  yeni:             { label: "Yeni",              color: "#6F7B87", bg: "#EEF0F3", dot: "#AEB4C0" },
  iletisimde: { label: "Aranacak",   color: "#8A5A00", bg: "#FFF3DC", dot: "#FFB020" },
  arandi:     { label: "Arandı",     color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  yanit:           { label: "Yanıt Bekliyor",    color: "#8A5A00", bg: "#FFF3DC", dot: "#FFE2A8" },
  mesaj_gonderildi:{ label: "Mesaj Gönderildi", color: "#0E5D59", bg: "#AFF3F0", dot: "#14B8A6" },
  teklif_gonderildi:{ label: "Teklif Gönderildi", color: "#5B21B6", bg: "#EDE9FE", dot: "#8B5CF6" },
  randevu_planli: { label: "Randevu Oluşturulacak", color: "#4D52A6", bg: "#EDE9FE", dot: "#8B91E6" },
  randevu:        { label: "Randevu Oluşturuldu",   color: "#205297", bg: "#DDE8F8", dot: "#3A7BD5" },
  kazanildi:  { label: "Kayıt Oldu",           color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" },
  vazgecti:   { label: "Vazgeçti",            color: "#B42318", bg: "#FFECEC", dot: "#E5484D" },
};

const TIP_CATS: [string, string][] = [
  ["Tümü",        "Tüm Tipler"],
  ["satis_oncesi","Satış Öncesi"],
  ["satis_sonrasi","Satış Sonrası"],
  ["destek",      "Destek"],
];

const SONRAKI = [
  "Tekrar Aranacak", "Mesaj Gönderilecek", "Randevu Oluşturulacak",
  "Teklif Gönderilecek", "Kayıt Oldu", "Vazgeçti",
];

// Checkbox İŞARETSİZ kaydedilince durum
const SONRAKI_DURUM: Partial<Record<string, DurumKey>> = {
  "Tekrar Aranacak":       "iletisimde",
  "Randevu Oluşturulacak": "randevu_planli",
  "Kayıt Oldu":            "kazanildi",
  "Vazgeçti":              "vazgecti",
};

// Checkbox İŞARETLİ kaydedilince → tamamlandı versiyonu
const GONDERILECEK: Record<string, { tip: string; durum: DurumKey }> = {
  "Randevu Oluşturulacak": { tip: "Randevu Oluşturuldu",  durum: "randevu" },
  "Mesaj Gönderilecek":    { tip: "Mesaj Gönderildi",     durum: "mesaj_gonderildi" },
  "Teklif Gönderilecek":   { tip: "Teklif Gönderildi",    durum: "teklif_gonderildi" },
};

// Tamamlandı versiyonu → orijinal SONRAKI değeri (expand'da geri dönüşüm için)
const COMPLETED_TO_SONRAKI: Record<string, string> = Object.fromEntries(
  Object.entries(GONDERILECEK).map(([k, v]) => [v.tip, k]),
);

// Checkbox işaretsiz etiket — bağlama göre
const GONDERILECEK_LABEL: Record<string, string> = {
  "Randevu Oluşturulacak": "Randevu oluşturuldu mu?",
  "Mesaj Gönderilecek":    "Mesaj gönderildi mi?",
  "Teklif Gönderilecek":   "Teklif gönderildi mi?",
};

const SORUMLU_LIST = ["Alparslan Şentürk", "Merve Kaya"]; // TODO: API'den kullanıcılar

// ─── Backend (Case/Activity) ↔ UI eşlemeleri ───────────────────────────────────
// Yeni eklenen talepler /api/flexos/cases'e (persons+flexos_cases+flexos_activities)
// yazılır; eski dummy kayıtlar flexos_prospects'te kalır. Liste ikisini birleştirir.

const KANAL_TO_CHANNEL: Record<KanalKey, string> = {
  telefon: "telefon", websitesi: "web", instagram: "instagram",
  whatsapp: "whatsapp", email: "email", tavsiye: "tavsiye", walkin: "yuzeyuz",
};
const CHANNEL_TO_KANAL: Record<string, KanalKey> = {
  telefon: "telefon", web: "websitesi", instagram: "instagram",
  whatsapp: "whatsapp", email: "email", tavsiye: "tavsiye", yuzeyuz: "walkin",
};
const ACTTYPE_TO_TIP: Record<string, TipKey> = {
  arama: "arama", mesaj: "mesaj", randevu: "randevu", not: "not", satis_donusumu: "satis",
};
const CASESTATUS_TO_DURUM: Record<string, DurumKey> = {
  yeni: "yeni", iletisimde: "iletisimde", yanit_bekleniyor: "yanit",
  randevu_olusturuldu: "randevu", kazanildi: "kazanildi", tamamlandi: "kazanildi", vazgecti: "vazgecti",
};
// UI "Sonraki" etiketi → backend activity nextActionType
const SONRAKI_TO_ACTTYPE: Record<string, string> = {
  "Tekrar Aranacak": "arama", "Mesaj Gönderilecek": "mesaj",
  "Randevu Oluşturulacak": "randevu", "Teklif Gönderilecek": "not",
};
// Zengin UI durumu (DurumKey) → canonical backend CaseStatus (açık/kapalı mantığı için).
// Rozetin kendisi uiDurum'dan gelir; bu sadece domain status'unu korur.
const DURUM_TO_CASESTATUS: Record<DurumKey, string> = {
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
const CLOSED_DURUMS: DurumKey[] = ["kazanildi", "vazgecti"];

interface CaseApiItem {
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
  firstActivityNote: string | null;
  lastActivityNote: string | null;
  lastActivityType: string | null;
  nextActionType: string | null;
  nextActionDate: string | null;
  activityLog?: { note: string | null; type: string; createdAt: string; nextActionType: string | null }[];
}

interface ActLog { note: string; tarih: string; saat: string; }

/** Backend Case → UI satırı. */
function caseToRow(c: CaseApiItem): AktiviteRow {
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
  };
}

const getInitials = (name: string) => {
  const words = name.trim().split(" ");
  return words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : words[0].slice(0, 2).toUpperCase();
};

const AV_PAL: [string, string][] = [
  ["#689adf","#2867bd"], ["#FFA352","#FF7800"], ["#67B5B6","#1CB5AE"],
  ["#8B91E6","#4D52A6"], ["#F76FA3","#F91079"],
];

const PAGE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AktiviteRow {
  _backend?: boolean;
  _caseId?: string;
  _log?: ActLog[];       // backend: geçmiş aksiyonlar (ilk=müşteri mesajı hariç)
  id: number;
  kanal: KanalKey;
  tip: TipKey;
  tipCat: TipCat;
  ozet: string;
  ad: string;
  iletisim: string;
  durum: DurumKey;
  tarih: string;
  saat: string;
  sorumlu: string;
  musteriMesaji: string;
  aksiyonNotu: string;
  sonrakiTip: string;
  sonrakiTarih: string;
  sonrakiSaat: string;
  gelecekRandevu: string;
  aktiviteSayisi: number;
}

interface EkleForm {
  ad: string; soyad: string; telefon: string; email: string;
  kanal: KanalKey; not: string;
}
const EMPTY_EKLE: EkleForm = { ad: "", soyad: "", telefon: "", email: "", kanal: "telefon", not: "" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AktiviteMerkeziPage() {
  const [ready, setReady]           = useState(false);
  const [backendActs, setBackendActs] = useState<AktiviteRow[]>([]);   // flexos_cases — TEK veri kaynağı
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [meName, setMeName] = useState("Ben");                          // giriş yapan kullanıcı adı

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, []);

  const loadBackend = useCallback(async () => {
    try {
      const u = auth.currentUser;
      const meUid = u?.uid;
      const me = u?.displayName || u?.email || "Ben";
      const res = await fetch("/api/flexos/cases", { headers: await authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const items: CaseApiItem[] = json.items ?? [];
      setBackendActs(items.map((c) => {
        const row = caseToRow(c);
        // Sorumlu = kayıtlı isim > (uid bizsek adımız) > "Atanmış" > "—"
        row.sorumlu = c.assignedToName
          ? c.assignedToName
          : c.assignedToUid
            ? (c.assignedToUid === meUid ? me : "Atanmış")
            : "—";
        return row;
      }));
    } catch { /* sessiz — dummy liste yine de görünür */ }
  }, [authHeaders]);

  // expand panel draft
  const [draftNote,       setDraftNote]       = useState("");
  const [draftSonrakiTip, setDraftSonrakiTip] = useState("Tekrar Aranacak");
  const [draftTarih,      setDraftTarih]      = useState("");
  const [draftSaat,       setDraftSaat]       = useState("");
  const [draftSorumlu,    setDraftSorumlu]    = useState("");
  const [draftGonderildi, setDraftGonderildi] = useState(false);
  const [savingAct,      setSavingAct]      = useState(false);
  const [savedAct,       setSavedAct]       = useState(false);
  const [durumError,     setDurumError]     = useState(false);
  const [shakeDropdown,  setShakeDropdown]  = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shakeDropdown) return;
    const t = setTimeout(() => setShakeDropdown(false), 500);
    return () => clearTimeout(t);
  }, [shakeDropdown]);

  useEffect(() => {
    if (draftSonrakiTip === "Randevu Oluşturulacak") {
      setTimeout(() => {
        try { dateInputRef.current?.showPicker(); } catch {}
      }, 260);
    }
  }, [draftSonrakiTip]);

  // filters
  const [fKanal,   setFKanal]   = useState("Tümü");
  const [fTip,     setFTip]     = useState("Tümü");
  const [fDurum,   setFDurum]   = useState("Tümü");
  const [fSorumlu, setFSorumlu] = useState("Tümü");
  const [openDd,   setOpenDd]   = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);

  // "Diğer Aktiviteler" accordion (expand panel içinde)
  const [digerOpenId,  setDigerOpenId]  = useState<number | null>(null);
  // "Geçmiş Aksiyonlar" accordion — varsayılan kapalı
  const [gecmisOpenId, setGecmisOpenId] = useState<number | null>(null);

  // "Aktivite Ekle" modal
  const [ekleOpen,   setEkleOpen]   = useState(false);
  const [ekleForm,   setEkleForm]   = useState<EkleForm>(EMPTY_EKLE);
  const [ekleSaving, setEkleSaving] = useState(false);

  // 2026-07-22 kullanıcı bulgusu: bu efekt eskiden boşsa `flexos_prospects`
  // koleksiyonuna 14 satırlık sahte DEMO veri yazıp gerçek backend listesiyle
  // (`allActs`) birleştiriyordu — bu eski/sahte satırlardan birinde aksiyon
  // alınınca (Randevu Oluşturulacak dahil) TAMAMEN AYRI bir "eski dummy" kod
  // yolu çalışıyor, gerçek `flexos_cases`/`flexos_appointments`'a hiç
  // yazmıyordu (sessizce "oluşmadı" hissi veriyordu). Sahte veri + besleyen
  // seed/onSnapshot/save yolu TAMAMEN kaldırıldı — TEK doğruluk kaynağı artık
  // backend (`loadBackend`).
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) { setReady(true); return; }

      // Firebase Auth displayName genellikle boş; trainer kaydından ada bak.
      let resolvedName = user.displayName || "";
      if (!resolvedName && user.email) {
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/flexos/trainers", {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          if (res.ok) {
            const data = await res.json() as { items?: { name: string; email: string }[] };
            const match = data.items?.find(
              (t) => t.email?.toLowerCase() === user.email!.toLowerCase(),
            );
            if (match) resolvedName = match.name;
          }
        } catch {}
      }
      setMeName(resolvedName || user.email || "Ben");

      await loadBackend().catch(() => {}); // hata olsa da engelleme
      setReady(true);
    });

    return () => { unsubAuth(); };
  }, [loadBackend]);

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı talep/aktivite/randevu
  // ekleyip/güncellediğinde SSE üzerinden haber alınır, backend listesi tekrar çekilir.
  useRealtimeSync(["activities.changed"], loadBackend);

  const expand = useCallback((a: AktiviteRow) => {
    if (expandedId === a.id) { setExpandedId(null); return; }
    setExpandedId(a.id);
    // Aksiyon = personelin alanı → her zaman BOŞ başlar (müşteri mesajı üstte ayrı gösterilir).
    setDraftNote(a._backend ? "" : a.aksiyonNotu);
    // Kaydedilen tip doğrudan SONRAKI'daysa kullan; tamamlandı versiyonuysa
    // (örn. "Randevu Oluşturuldu") kaynak değere geri dön ve checkbox'ı işaretle.
    const validSonraki = new Set(SONRAKI);
    const mappedBack   = COMPLETED_TO_SONRAKI[a.sonrakiTip];
    setDraftSonrakiTip(validSonraki.has(a.sonrakiTip) ? a.sonrakiTip : (mappedBack ?? ""));
    setDraftGonderildi(!!mappedBack);
    setDraftTarih(a.sonrakiTarih || "");
    setDraftSaat(a.sonrakiSaat || "");
    // Sorumlu atanmamışsa giriş yapan kullanıcı varsayılan.
    setDraftSorumlu(a.sorumlu && a.sorumlu !== "—" ? a.sorumlu : meName);
    setSavingAct(false);
    setSavedAct(false);
    setDurumError(false);
    setGecmisOpenId(null);
  }, [expandedId, meName]);

  const saveAct = useCallback(async (a: AktiviteRow) => {
    if (!draftSonrakiTip) { setDurumError(true); setShakeDropdown(true); return; }
    setDurumError(false);
    setSavingAct(true);
    const gonderildiMap = GONDERILECEK[draftSonrakiTip];
    const effectiveTip  = draftGonderildi && gonderildiMap ? gonderildiMap.tip : draftSonrakiTip;
    const newDurum      = draftGonderildi && gonderildiMap ? gonderildiMap.durum : SONRAKI_DURUM[draftSonrakiTip];

    // 2026-07-22: sahte demo veri (flexos_prospects) kaldırıldı — her satır artık
    // gerçek backend talebi (flexos_cases), bu dal koşulsuz çalışır.
    {
      const caseId = a._caseId!;
      const wasClosed = CLOSED_DURUMS.includes(a.durum);
      const finalDurum: DurumKey = (newDurum as DurumKey) || a.durum;   // değişiklik yoksa mevcudu koru
      const closing   = CLOSED_DURUMS.includes(finalDurum);
      const canonical = DURUM_TO_CASESTATUS[finalDurum] || "iletisimde";
      const dtEnabled = draftSonrakiTip === "Randevu Oluşturulacak";
      const nextDate  = (dtEnabled && draftTarih)
        ? new Date(`${draftTarih}T${draftSaat || "00:00"}`).toISOString()
        : undefined;
      const patchCase = async (payload: Record<string, unknown>) =>
        fetch(`/api/flexos/cases/${caseId}`, {
          method: "PATCH", headers: await authHeaders(), body: JSON.stringify(payload),
        });
      try {
        // Kapalı talebe aktivite EKLENEMEZ → önce yeniden aç.
        if (wasClosed) {
          const r0 = await patchCase({ status: "iletisimde" });
          if (!r0.ok) {
            const j = await r0.json().catch(() => ({}));
            throw new Error(j.error || FLEX_MESSAGES['flexos/talep-reopen-failed'].text);
          }
        }
        // Aksiyon notunu + planlanan sonraki adımı kaydet (timeline + sayaç).
        // "Randevu Oluşturulacak" + tarih/saat girildiyse GERÇEK bir Appointment
        // kaydı da oluşur (2026-07-21 düzeltmesi — önceden SADECE nextActionDate
        // set ediliyordu, Randevu Takvimi'nde hiç görünmüyordu çünkü appointment
        // alanı hiç gönderilmiyordu).
        const res = await fetch("/api/flexos/activities", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            caseId,
            type: "not",
            note: draftNote.trim() || undefined,
            nextActionType: SONRAKI_TO_ACTTYPE[draftSonrakiTip] || "not",
            nextActionDate: nextDate,
            ...(dtEnabled && nextDate ? {
              appointment: {
                scheduledAt: nextDate,
                assignedToUid: auth.currentUser?.uid,
                assignedToName: draftSorumlu || meName,
                meetingType: "telefon",
              },
            } : {}),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Kayıt başarısız.");
        }
        // Talebi son hale getir: canonical status + ZENGİN uiDurum/uiSonrakiTip + sorumlu (+ kapanış).
        await patchCase({
          status: canonical,
          uiDurum: finalDurum,
          uiSonrakiTip: effectiveTip,
          assignedToUid: auth.currentUser?.uid,
          assignedToName: draftSorumlu || meName,
          ...(closing ? { outcome: { kind: finalDurum === "kazanildi" ? "sale" : "lost" } } : {}),
        });
        await loadBackend();
        setSavingAct(false);
        setSavedAct(true);
        setTimeout(() => { setExpandedId(null); setSavedAct(false); }, 800);
        toast.success(FLEX_MESSAGES['flexos/aksiyon-saved'].text);
      } catch (e) {
        setSavingAct(false);
        toast.error(e instanceof Error ? e.message : FLEX_MESSAGES['system/save-failed'].text);
      }
    }
  }, [draftNote, draftSonrakiTip, draftTarih, draftSaat, draftSorumlu, draftGonderildi, meName, authHeaders, loadBackend]);

  const handleEkle = async () => {
    if (!ekleForm.ad.trim() || !ekleForm.soyad.trim()) {
      toast.error(FLEX_MESSAGES['validation/ad-soyad-required'].text);
      return;
    }
    if (!ekleForm.telefon.trim() && !ekleForm.email.trim()) {
      toast.error(FLEX_MESSAGES['validation/iletisim-required'].text);
      return;
    }
    setEkleSaving(true);
    try {
      // Yeni talep → backend (persons + flexos_cases + flexos_activities)
      const res = await fetch("/api/flexos/cases", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          personData: {
            firstName: ekleForm.ad.trim(),
            lastName:  ekleForm.soyad.trim(),
            phone:     ekleForm.telefon.trim() || undefined,
            email:     ekleForm.email.trim() || undefined,
          },
          channel: KANAL_TO_CHANNEL[ekleForm.kanal],
          type:    "satis_oncesi",
          note:    ekleForm.not.trim() || undefined,
          assignedToUid: auth.currentUser?.uid,
          assignedToName: meName,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Kayıt başarısız.");
      }
      await loadBackend();
      setEkleForm(EMPTY_EKLE);
      setEkleOpen(false);
      toast.success(FLEX_MESSAGES['flexos/talep-created'].text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : FLEX_MESSAGES['system/save-failed'].text);
    } finally {
      setEkleSaving(false);
    }
  };

  // Sahte demo veri (flexos_prospects) kaldırıldı (2026-07-22) — TEK kaynak backend.
  const allActs = useMemo(
    () => [...backendActs].sort((a, b) => b.id - a.id),
    [backendActs],
  );

  // Badge = aynı kişinin (iletişim) kaç FARKLI yerde/talepte geçtiği (aktivite sayısı DEĞİL).
  const personCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of allActs) if (a.iletisim && a.iletisim !== "—") m[a.iletisim] = (m[a.iletisim] || 0) + 1;
    return m;
  }, [allActs]);

  // Sorumlu listesi = giriş yapan kullanıcı + sabitler (tekilleştirilmiş)
  const sorumluList = useMemo(
    () => Array.from(new Set([meName, ...SORUMLU_LIST])),
    [meName],
  );

  const filtered = useMemo(() => {
    let r = allActs;
    if (fKanal   !== "Tümü") r = r.filter(a => a.kanal   === fKanal);
    if (fTip     !== "Tümü") r = r.filter(a => a.tipCat  === fTip);
    if (fDurum   !== "Tümü") r = r.filter(a => a.durum   === fDurum);
    if (fSorumlu !== "Tümü") r = r.filter(a => a.sorumlu === fSorumlu);
    return r;
  }, [allActs, fKanal, fTip, fDurum, fSorumlu]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageActs   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const anyFilter  = fKanal !== "Tümü" || fTip !== "Tümü" || fDurum !== "Tümü" || fSorumlu !== "Tümü";
  const showDatetime = draftSonrakiTip === "Randevu Oluşturulacak";

  if (!ready) return <FlexPageLoader />;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: FONT }}>
      <style>{CSS}</style>
      <FlexSidebar active="aktivite-merkezi" />

      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
          title="Aktivite Merkezi"
          subtitle="Tüm talepler ve aktiviteler tek ekranda."
          maxWidth={1560}
        />

        <div style={{ padding: "28px 36px 56px", maxWidth: 1560, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

          {/* ── FILTER BAR ── */}
          <div style={{ position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

              {/* Kanal */}
              <Dd
                label={fKanal === "Tümü" ? "Tüm Kanallar" : KANALS[fKanal as KanalKey]?.label}
                open={openDd === "kanal"}
                onToggle={() => setOpenDd(d => d === "kanal" ? null : "kanal")}
              >
                {(["Tümü", ...Object.keys(KANALS)] as string[]).map(k => (
                  <DdItem key={k}
                    label={k === "Tümü" ? "Tüm Kanallar" : KANALS[k as KanalKey].label}
                    active={fKanal === k}
                    onClick={() => { setFKanal(k); setOpenDd(null); setPage(1); }}
                  />
                ))}
              </Dd>

              {/* Tip kategorisi */}
              <Dd
                label={TIP_CATS.find(x => x[0] === fTip)?.[1] ?? "Tüm Tipler"}
                open={openDd === "tip"}
                onToggle={() => setOpenDd(d => d === "tip" ? null : "tip")}
              >
                {TIP_CATS.map(([k, l]) => (
                  <DdItem key={k} label={l} active={fTip === k} onClick={() => { setFTip(k); setOpenDd(null); setPage(1); }} />
                ))}
              </Dd>

              {/* Durum */}
              <Dd
                label={fDurum === "Tümü" ? "Tüm Durumlar" : DURUMLAR[fDurum as DurumKey]?.label}
                open={openDd === "durum"}
                onToggle={() => setOpenDd(d => d === "durum" ? null : "durum")}
              >
                {(["Tümü", ...Object.keys(DURUMLAR)] as string[]).map(k => {
                  const d = DURUMLAR[k as DurumKey];
                  return (
                    <DdItem key={k} active={fDurum === k} onClick={() => { setFDurum(k); setOpenDd(null); setPage(1); }}
                      label={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {d && <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.dot, flex: "0 0 auto" }} />}
                        {k === "Tümü" ? "Tüm Durumlar" : d?.label}
                      </span>}
                    />
                  );
                })}
              </Dd>

              {/* Sorumlu */}
              <Dd
                label={fSorumlu === "Tümü" ? "Tüm Sorumlular" : fSorumlu}
                open={openDd === "sorumlu"}
                onToggle={() => setOpenDd(d => d === "sorumlu" ? null : "sorumlu")}
              >
                {["Tümü", ...sorumluList].map(v => (
                  <DdItem key={v} label={v === "Tümü" ? "Tüm Sorumlular" : v} active={fSorumlu === v}
                    onClick={() => { setFSorumlu(v); setOpenDd(null); setPage(1); }} />
                ))}
              </Dd>

              {anyFilter && (
                <button className="am-clear-btn" onClick={() => { setFKanal("Tümü"); setFTip("Tümü"); setFDurum("Tümü"); setFSorumlu("Tümü"); setPage(1); setOpenDd(null); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  Temizle
                </button>
              )}
            </div>

            {/* Aktivite Ekle */}
            <button className="am-orange-btn" onClick={() => { setExpandedId(null); setEkleOpen(true); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              Aktivite Ekle
            </button>
          </div>

          {/* ── TABLE ── */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                    <th style={{ ...S.th, paddingLeft: 22, width: 40 }}>#</th>
                    <th style={S.th}>Kanal</th>
                    <th style={S.th}>Aktivite Tipi</th>
                    <th style={S.th}>Müşteri</th>
                    <th style={S.th}>Durum</th>
                    <th style={S.th}>Tarih / Saat</th>
                    <th style={S.th}>Sorumlu</th>
                    <th style={{ ...S.th, textAlign: "right", paddingRight: 22, width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pageActs.map((a, idx) => {
                    const k = KANALS[a.kanal];
                    const t = TIPLER[a.tip];
                    const d = DURUMLAR[a.durum];
                    const expanded = expandedId === a.id;
                    const pal = AV_PAL[(a.id - 1) % AV_PAL.length];
                    return (
                      <React.Fragment key={a.id}>
                        {/* ── main row ── */}
                        <tr className="am-tr" style={{ cursor: "pointer", borderBottom: "1px solid #EEF0F3", background: expanded ? "#EFF3FA" : "transparent" }} onClick={() => expand(a)}>
                          <td style={{ padding: "15px 14px 15px 22px", verticalAlign: "middle", width: 40 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#AEB4C0" }}>{(safePage - 1) * PAGE_SIZE + idx + 1}</span>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <span style={{ width: 34, height: 34, borderRadius: 9, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", fontSize: 13, fontWeight: 800 }}>
                                {k.label.charAt(0)}
                              </span>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1E222B", whiteSpace: "nowrap" }}>{k.label}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 280 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, color: t.color, background: t.bg, whiteSpace: "nowrap", width: "fit-content" }}>
                                {t.label}
                              </span>
                              <span style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.ozet}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{a.ad}</span>
                                {(personCounts[a.iletisim] ?? 1) > 1 && (
                                  <span
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (expandedId !== a.id) expand(a);
                                      setDigerOpenId(id => id === a.id ? null : a.id);
                                    }}
                                    className="am-badge-btn"
                                    title="Bu kişinin diğer kayıtları"
                                    style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#64748b", minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "0 5px", cursor: "pointer", flexShrink: 0 }}>
                                    {personCounts[a.iletisim]}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{a.iletisim}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px 5px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: d.color, background: d.bg, whiteSpace: "nowrap" }}>
                              {a.durum === "kazanildi" ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="M20 6 9 17l-5-5"/></svg>
                              ) : a.durum === "vazgecti" ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="M18 6 6 18M6 6l12 12"/></svg>
                              ) : (
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.dot, flex: "0 0 auto" }} />
                              )}
                              {d.label}
                            </span>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>{a.tarih}</span>
                              <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 600 }}>{a.saat}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${pal[0]},${pal[1]})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flex: "0 0 auto" }}>
                                {getInitials(a.sorumlu)}
                              </span>
                              <span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 600 }}>{a.sorumlu}</span>
                            </div>
                          </td>
                          <td style={{ padding: "15px 22px 15px 14px", textAlign: "right", width: 48, verticalAlign: "middle" }}>
                            <button className="am-chev-btn" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: expanded ? "#DDE8F8" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: expanded ? "#205297" : "#8E95A3" }}>
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                {expanded ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
                              </svg>
                            </button>
                          </td>
                        </tr>

                        {/* ── expand panel ── */}
                        <tr style={{ background: "#F5F8FF", borderBottom: expanded ? "2px solid #c0d5ef" : "none" }}>
                          <td colSpan={8} style={{ padding: 0 }}>
                            <AnimatePresence initial={false}>
                              {expanded && (
                                <motion.div
                                  key="panel"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                                  style={{ overflow: "hidden" }}
                                >
                              <div style={{ padding: "20px 28px 22px" }}>

                                {/* Müşteri mesajı + gelecek randevu */}
                                {(a.musteriMesaji || a.gelecekRandevu) && (
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
                                    {a.musteriMesaji && (
                                      <div style={{ flex: 1, minWidth: 240 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 5 }}>Müşteri Mesajı:</div>
                                        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, fontWeight: 500 }}>{a.musteriMesaji}</div>
                                      </div>
                                    )}
                                    {a.gelecekRandevu && (
                                      <div style={{ flex: "0 0 auto" }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 5 }}>Gelecek Randevu:</div>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 10, background: "#DDE8F8", color: "#205297", fontSize: 13, fontWeight: 700, border: "1px solid #c0d5ef" }}>
                                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                                          {a.gelecekRandevu}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Geçmiş aksiyonlar (salt-okunur) — accordion, varsayılan kapalı */}
                                {a._backend && a._log && a._log.length > 0 && (() => {
                                  const gecmisOpen = gecmisOpenId === a.id;
                                  return (
                                    <div style={{ marginBottom: 16 }}>
                                      <button
                                        onClick={e => { e.stopPropagation(); setGecmisOpenId(id => id === a.id ? null : a.id); }}
                                        style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: "0 0 6px", fontFamily: FONT }}
                                      >
                                        <motion.span
                                          animate={{ rotate: gecmisOpen ? 90 : 0 }}
                                          transition={{ duration: 0.18 }}
                                          style={{ display: "inline-flex", color: "#8E95A3" }}
                                        >
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                        </motion.span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#8E95A3" }}>
                                          Geçmiş Aksiyonlar
                                        </span>
                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#AEB4C0", borderRadius: 999, padding: "1px 7px" }}>
                                          {a._log.length}
                                        </span>
                                      </button>
                                      <AnimatePresence initial={false}>
                                        {gecmisOpen && (
                                          <motion.div
                                            key="gecmis"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                            style={{ overflow: "hidden" }}
                                          >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingBottom: 4 }}>
                                              {[...a._log].reverse().map((l, i) => (
                                                <div key={i} style={{ padding: "9px 13px", borderRadius: 11, background: "#EEF3FB", border: "1px solid #D8E3F0" }}>
                                                  <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.5, fontWeight: 500 }}>{l.note}</div>
                                                  <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600, marginTop: 3 }}>{l.tarih} · {l.saat}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })()}

                                {/* Aksiyon notu (yeni giriş) */}
                                <div style={{ marginBottom: 18 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 7 }}>Yeni Aksiyon:</div>
                                  <textarea
                                    value={draftNote}
                                    onChange={e => setDraftNote(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    placeholder="Aksiyon notunu buraya yazın…"
                                    style={{ width: "100%", minHeight: 78, resize: "vertical", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, outline: "none", fontFamily: FONT }}
                                  />
                                </div>

                                {/* Controls row */}
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>

                                  {/* Durum dropdown */}
                                  <LabeledField label="Durum">
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{ position: "relative" }}>
                                        <select value={draftSonrakiTip} onChange={e => { setDraftSonrakiTip(e.target.value); setDraftGonderildi(false); setDurumError(false); setShakeDropdown(false); }} onClick={e => e.stopPropagation()}
                                          className={shakeDropdown ? "error-shake" : ""}
                                          style={{ ...S.sel, minWidth: 200, color: draftSonrakiTip ? "#1E222B" : "#6F7B87", borderColor: durumError ? "#E5484D" : undefined, background: durumError ? "#FFF5F5" : "#fff" }}>
                                          <option value="" disabled style={{ color: "#9AA1AD" }}>— Durum seçin —</option>
                                          {SONRAKI.map(s => {
                                            const completed = GONDERILECEK[s];
                                            const label = (draftSonrakiTip === s && draftGonderildi && completed) ? completed.tip : s;
                                            return <option key={s} value={s} style={{ color: "#1E222B" }}>{label}</option>;
                                          })}
                                        </select>
                                        <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                      </div>
                                      <AnimatePresence initial={false}>
                                        {GONDERILECEK[draftSonrakiTip] && (
                                          <motion.label
                                            key="gonderildi-cb"
                                            initial={{ opacity: 0, x: -6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -6 }}
                                            transition={{ duration: 0.18 }}
                                            onClick={e => e.stopPropagation()}
                                            style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={draftGonderildi}
                                              onChange={e => setDraftGonderildi(e.target.checked)}
                                              style={{ width: 15, height: 15, accentColor: "#2867bd", cursor: "pointer" }}
                                            />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: draftGonderildi ? "#2867bd" : "#6B7280" }}>
                                              {draftGonderildi ? GONDERILECEK[draftSonrakiTip]?.tip : (GONDERILECEK_LABEL[draftSonrakiTip] ?? "Gönderildi mi?")}
                                            </span>
                                          </motion.label>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </LabeledField>

                                  {/* Tarih + Saat — her zaman görünür, ilgisizse disabled */}
                                  <LabeledField label="Tarih">
                                    <input ref={dateInputRef} type="date" value={draftTarih} onChange={e => setDraftTarih(e.target.value)} onClick={e => e.stopPropagation()}
                                      disabled={!showDatetime}
                                      style={{ ...S.sel, minWidth: 160, padding: "10px 14px", opacity: showDatetime ? 1 : 0.38, cursor: showDatetime ? "auto" : "not-allowed" }} />
                                  </LabeledField>
                                  <LabeledField label="Saat">
                                    <input type="time" value={draftSaat} onChange={e => setDraftSaat(e.target.value)} onClick={e => e.stopPropagation()}
                                      disabled={!showDatetime}
                                      style={{ ...S.sel, minWidth: 120, padding: "10px 14px", opacity: showDatetime ? 1 : 0.38, cursor: showDatetime ? "auto" : "not-allowed" }} />
                                  </LabeledField>

                                  {/* Sorumlu devralma */}
                                  <LabeledField label="Sorumlu">
                                    <div style={{ position: "relative" }}>
                                      <select value={draftSorumlu || a.sorumlu} onChange={e => setDraftSorumlu(e.target.value)} onClick={e => e.stopPropagation()} style={{ ...S.sel, minWidth: 150 }}>
                                        {sorumluList.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                      <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                    </div>
                                  </LabeledField>

                                  {/* İptal + Kaydet */}
                                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                                    {durumError && (
                                      <span className={shakeDropdown ? "error-shake" : ""} style={{ fontSize: 13, fontWeight: 600, color: "#B42318", whiteSpace: "nowrap", marginRight: 22 }}>
                                        {FLEX_MESSAGES['flexos/durum-required'].text}
                                      </span>
                                    )}
                                    <button onClick={e => { e.stopPropagation(); setExpandedId(null); }} className="am-cancel-btn"
                                      style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                                      İptal
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); saveAct(a); }} disabled={savingAct || savedAct} className="am-save-btn"
                                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 11, border: "none", background: savedAct ? "linear-gradient(135deg,#009F3E,#007A30)" : "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: (savingAct || savedAct) ? "default" : "pointer", boxShadow: savedAct ? "0 6px 14px -6px rgba(0,122,48,.55)" : "0 6px 14px -6px rgba(32,82,151,.55)", transition: "background .25s, box-shadow .25s", minWidth: 110 }}>
                                      {savingAct ? (
                                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin .7s linear infinite", flexShrink: 0 }}><path d="M12 2a10 10 0 1 0 10 10"/></svg>Kaydediliyor…</>
                                      ) : savedAct ? (
                                        <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5"/></svg>Kaydedildi</>
                                      ) : (
                                        <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5"/></svg>Kaydet</>
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* ── Diğer Aktiviteler ── */}
                                {(() => {
                                  const diger = allActs.filter(x => x.iletisim === a.iletisim && x.id !== a.id);
                                  if (diger.length === 0) return null;
                                  const digerOpen = digerOpenId === a.id;
                                  return (
                                    <div style={{ marginTop: 18, borderTop: "1px solid #D8E3F0" }}>
                                      <button
                                        onClick={e => { e.stopPropagation(); setDigerOpenId(id => id === a.id ? null : a.id); }}
                                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                                      >
                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#4D52A6" }}>
                                          Diğer Aktiviteler
                                        </span>
                                        <motion.span
                                          animate={{ rotate: digerOpen ? 180 : 0 }}
                                          transition={{ duration: 0.2 }}
                                          style={{ display: "inline-flex", color: "#4D52A6" }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                        </motion.span>
                                      </button>
                                      <AnimatePresence initial={false}>
                                        {digerOpen && (
                                          <motion.div
                                            key="diger"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                            style={{ overflow: "hidden" }}
                                          >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4, paddingTop: 6 }}>
                                              {diger.sort((x, y) => y.id - x.id).map(d => {
                                                const dk = KANALS[d.kanal];
                                                const dd = DURUMLAR[d.durum];
                                                return (
                                                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "#EDF2FB", border: "1px solid #D0DCEE" }}>
                                                    {/* Kanal chip */}
                                                    <span style={{ width: 28, height: 28, borderRadius: 7, background: dk.bg, color: dk.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "0 0 auto" }}>
                                                      {dk.label.charAt(0)}
                                                    </span>
                                                    {/* Özet */}
                                                    <span style={{ flex: 1, fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.ozet}</span>
                                                    {/* Tarih */}
                                                    <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 600, whiteSpace: "nowrap" }}>{d.tarih} · {d.saat}</span>
                                                    {/* Durum */}
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: dd.color, background: dd.bg, whiteSpace: "nowrap", flex: "0 0 auto" }}>
                                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dd.dot }} />
                                                      {dd.label}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })()}

                              </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {pageActs.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#414B59" }}>Aktivite bulunamadı</div>
                <div style={{ fontSize: 13, color: "#8E95A3" }}>Filtreleri değiştirip tekrar deneyin.</div>
              </div>
            )}

            {/* Pagination */}
            {pageActs.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "15px 22px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
                <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
                  Toplam <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filtered.length}</strong> aktivite
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <button className="am-pag-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                    style={{ ...S.pagBtn, cursor: safePage <= 1 ? "not-allowed" : "pointer", opacity: safePage <= 1 ? 0.4 : 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className="am-pag-btn" onClick={() => setPage(p)}
                      style={{ ...S.pagBtn, border: p === safePage ? "1px solid #2867bd" : "1px solid #E2E5EA", background: p === safePage ? "#2867bd" : "#fff", color: p === safePage ? "#fff" : "#414B59", fontWeight: p === safePage ? 700 : 600 }}>
                      {p}
                    </button>
                  ))}
                  <button className="am-pag-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                    style={{ ...S.pagBtn, cursor: safePage >= totalPages ? "not-allowed" : "pointer", opacity: safePage >= totalPages ? 0.4 : 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Footer mini containerClassName="w-full max-w-[1560px] mx-auto px-9" />
      </main>

      {/* Dropdown click-away */}
      {openDd && <div onClick={() => setOpenDd(null)} style={{ position: "fixed", inset: 0, zIndex: 15 }} />}

      {/* ── AKTİVİTE EKLE MODAL ── */}
      <AnimatePresence>
        {ekleOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            onClick={() => setEkleOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px -12px rgba(15,31,61,.3)", width: "100%", maxWidth: 460, padding: "28px 28px 24px" }}
            >
              {/* Modal header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E222B" }}>Yeni Talep</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Manuel olarak talep kaydı oluştur.</p>
                </div>
                <button onClick={() => setEkleOpen(false)} className="am-icon-btn"
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8E95A3" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Ad + Soyad */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={S.label}>Ad <Req /></label>
                    <input value={ekleForm.ad} onChange={e => setEkleForm(f => ({ ...f, ad: e.target.value }))} placeholder="Ad" style={S.inp} />
                  </div>
                  <div>
                    <label style={S.label}>Soyad <Req /></label>
                    <input value={ekleForm.soyad} onChange={e => setEkleForm(f => ({ ...f, soyad: e.target.value }))} placeholder="Soyad" style={S.inp} />
                  </div>
                </div>
                {/* Telefon + E-posta — en az biri */}
                <div>
                  <label style={S.label}>İletişim <span style={{ color: "#AEB4C0", fontWeight: 400 }}>(telefon veya e-posta — en az biri)</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <input value={ekleForm.telefon}
                      onChange={e => setEkleForm(f => ({ ...f, telefon: formatTrPhone(e.target.value) }))}
                      placeholder="0 (5xx) xxx xx xx" style={S.inp} type="tel" inputMode="tel" />
                    <input value={ekleForm.email}
                      onChange={e => setEkleForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="ornek@eposta.com" style={S.inp} type="email" inputMode="email" />
                  </div>
                </div>
                {/* Kanal */}
                <div>
                  <label style={S.label}>Kaynak Kanal</label>
                  <div style={{ position: "relative" }}>
                    <select value={ekleForm.kanal} onChange={e => setEkleForm(f => ({ ...f, kanal: e.target.value as KanalKey }))} style={{ ...S.inp, paddingRight: 36, appearance: "none" }}>
                      {(Object.entries(KANALS) as [KanalKey, typeof KANALS[KanalKey]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                </div>
                {/* Not */}
                <div>
                  <label style={S.label}>Not <span style={{ color: "#AEB4C0", fontWeight: 400 }}>(opsiyonel)</span></label>
                  <textarea value={ekleForm.not} onChange={e => setEkleForm(f => ({ ...f, not: e.target.value }))} placeholder="İlgilendiği eğitim, ek bilgi…"
                    style={{ ...S.inp, minHeight: 72, resize: "vertical" }} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, paddingTop: 18, borderTop: "1px solid #EEF0F3" }}>
                <button onClick={() => setEkleOpen(false)} className="am-cancel-btn"
                  style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  İptal
                </button>
                <button onClick={handleEkle} disabled={ekleSaving} className="am-orange-btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: ekleSaving ? "not-allowed" : "pointer", opacity: ekleSaving ? 0.7 : 1, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" }}>
                  {ekleSaving ? "Kaydediliyor…" : "Talep Oluştur"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Dd({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <button className="am-dd-btn" onClick={onToggle}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" }}>
        {label}
        <ChevIcon />
      </button>
      {open && <div style={S.ddPanel}>{children}</div>}
    </div>
  );
}

function DdItem({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? "#205297" : "#414B59", background: active ? "#E2EAF3" : "transparent" }}>
      <span>{label}</span>
      {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#205297" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>{label}</span>
      {children}
    </div>
  );
}

function ChevIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

function Req() {
  return <span style={{ color: "#E5484D" }}>*</span>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FONT = "'Inter', system-ui, sans-serif";

const S: Record<string, CSSProperties> = {
  th:     { padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  td:     { padding: "15px 14px", verticalAlign: "middle" },
  ddPanel:{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 190, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "ddIn .15s cubic-bezier(.2,.8,.3,1)", maxHeight: 280, overflowY: "auto" },
  sel:    { padding: "10px 36px 10px 13px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, color: "#1E222B", outline: "none", cursor: "pointer", appearance: "none" as const },
  pagBtn: { minWidth: 36, height: 36, padding: "0 10px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 13.5, transition: "all .14s" },
  label:  { display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 },
  inp:    { width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontFamily: FONT, outline: "none" },
};

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: #CDD2DA; border-radius: 10px; border: 2px solid #EEF0F3; }
  ::-webkit-scrollbar-thumb:hover { background: #AEB4C0; }
  @keyframes ddIn { from { opacity: 0; transform: translateY(-8px) scale(.985); } to { opacity: 1; transform: none; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes am-sel-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
  .am-sel-shake { animation: am-sel-shake 0.18s ease-in-out; }
  textarea, select, input { font-family: 'Inter', system-ui, sans-serif; }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: .5; }
  .am-tr:hover { background: #FAFBFC !important; }
  .am-dd-btn:hover { border-color: #CDD2DA !important; background: #F7F8FA !important; }
  .am-chev-btn:hover { background: #F0F4FA !important; }
  .am-pag-btn:hover { background: #F7F8FA !important; }
  .am-icon-btn:hover { background: #F7F8FA !important; color: #1E222B !important; }
  .am-cancel-btn:hover { background: #F7F8FA !important; }
  .am-save-btn:hover { filter: brightness(1.07); }
  .am-orange-btn:hover { filter: brightness(1.06); }
  .am-clear-btn:hover { background: #FFECEC !important; }
  .am-badge-btn:hover { background: #C8CFF5 !important; }
`;
