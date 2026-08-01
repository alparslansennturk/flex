export type KanalKey = "telefon" | "websitesi" | "instagram" | "whatsapp" | "email" | "tavsiye" | "walkin";
export type TipKey   = "arama" | "mesaj" | "randevu" | "not" | "satis";
export type DurumKey = "aksiyon_alinacak" | "yeni" | "iletisimde" | "arandi" | "yanit" | "mesaj_gonderildi" | "teklif_gonderildi" | "randevu_planli" | "randevu" | "kazanildi" | "vazgecti";
export type TipCat   = "satis_oncesi" | "satis_sonrasi" | "destek";

export const KANALS: Record<KanalKey, { label: string; bg: string; color: string }> = {
  telefon:   { label: "Telefon",    bg: "#E6F5ED", color: "#007A30" },
  websitesi: { label: "Web Sitesi", bg: "#DDE8F8", color: "#205297" },
  instagram: { label: "Instagram",  bg: "#FED7E9", color: "#B80E57" },
  whatsapp:  { label: "WhatsApp",   bg: "#E6F5ED", color: "#1a7a40" },
  email:     { label: "Email",      bg: "#FFECEC", color: "#B42318" },
  tavsiye:   { label: "Tavsiye",    bg: "#EDE9FE", color: "#5B21B6" },
  walkin:    { label: "Walk-in",    bg: "#FFF3DC", color: "#8A5A00" },
};

export const TIPLER: Record<TipKey, { label: string; color: string; bg: string }> = {
  arama:   { label: "Arama",            color: "#205297", bg: "#DDE8F8" },
  mesaj:   { label: "Mesaj",            color: "#0E5D59", bg: "#AFF3F0" },
  randevu: { label: "Randevu",          color: "#4D52A6", bg: "#DDE0FA" },
  not:     { label: "Not",              color: "#6F7B87", bg: "#EEF0F3" },
  satis:   { label: "Satışa Dönüştür", color: "#007A30", bg: "#E6F5ED" },
};

export const DURUMLAR: Record<DurumKey, { label: string; color: string; bg: string; dot: string }> = {
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

export const TIP_CATS: [string, string][] = [
  ["Tümü",        "Tüm Tipler"],
  ["satis_oncesi","Satış Öncesi"],
  ["satis_sonrasi","Satış Sonrası"],
  ["destek",      "Destek"],
];

export const SONRAKI = [
  "Tekrar Aranacak", "Mesaj Gönderilecek", "Randevu Oluşturulacak",
  "Teklif Gönderilecek", "Kayıt Oldu", "Vazgeçti",
];

// Checkbox İŞARETSİZ kaydedilince durum
export const SONRAKI_DURUM: Partial<Record<string, DurumKey>> = {
  "Tekrar Aranacak":       "iletisimde",
  "Randevu Oluşturulacak": "randevu_planli",
  "Kayıt Oldu":            "kazanildi",
  "Vazgeçti":              "vazgecti",
};

// Checkbox İŞARETLİ kaydedilince → tamamlandı versiyonu
export const GONDERILECEK: Record<string, { tip: string; durum: DurumKey }> = {
  "Randevu Oluşturulacak": { tip: "Randevu Oluşturuldu",  durum: "randevu" },
  "Mesaj Gönderilecek":    { tip: "Mesaj Gönderildi",     durum: "mesaj_gonderildi" },
  "Teklif Gönderilecek":   { tip: "Teklif Gönderildi",    durum: "teklif_gonderildi" },
};

// Tamamlandı versiyonu → orijinal SONRAKI değeri (expand'da geri dönüşüm için)
export const COMPLETED_TO_SONRAKI: Record<string, string> = Object.fromEntries(
  Object.entries(GONDERILECEK).map(([k, v]) => [v.tip, k]),
);

// Checkbox işaretsiz etiket — bağlama göre
export const GONDERILECEK_LABEL: Record<string, string> = {
  "Randevu Oluşturulacak": "Randevu oluşturuldu mu?",
  "Mesaj Gönderilecek":    "Mesaj gönderildi mi?",
  "Teklif Gönderilecek":   "Teklif gönderildi mi?",
};

export const SORUMLU_LIST = ["Alparslan Şentürk", "Merve Kaya"]; // TODO: API'den kullanıcılar

export const AV_PAL: [string, string][] = [
  ["#689adf","#2867bd"], ["#FFA352","#FF7800"], ["#67B5B6","#1CB5AE"],
  ["#8B91E6","#4D52A6"], ["#F76FA3","#F91079"],
];

export const PAGE_SIZE = 10;

export const getInitials = (name: string) => {
  const words = name.trim().split(" ");
  return words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : words[0].slice(0, 2).toUpperCase();
};

export interface ActLog { note: string; tarih: string; saat: string; }

export interface AktiviteRow {
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
  /** Sorumlunun (`assignedToUid`) kendi şubesi — atanmamış talepte null (bkz. caseAdapter). */
  officeName: string | null;
}

export interface EkleForm {
  ad: string; soyad: string; telefon: string; email: string;
  kanal: KanalKey; not: string;
}
export const EMPTY_EKLE: EkleForm = { ad: "", soyad: "", telefon: "", email: "", kanal: "telefon", not: "" };

/**
 * Genişletilmiş satırın taslak (draft) alanları — tek nesnede toplanır ki genişletilMEMİŞ
 * satırlara HER ZAMAN aynı `EMPTY_DRAFT` referansı geçilebilsin. Aksiyon notuna her tuş
 * vuruşunda `draftNote` değişir; bu tek nesneye toplanmadan ayrı prop olarak TÜM satırlara
 * geçilseydi, `React.memo` her tuş vuruşunda TÜM satırları (görünürdeki 10 tanesini) yeniden
 * render ederdi — sadece genişletilmiş satırın prop'u gerçekten değişir, diğerlerininki
 * (aynı `EMPTY_DRAFT` nesnesi) referans olarak sabit kalır.
 */
export interface DraftBundle {
  note: string;
  sonrakiTip: string;
  gonderildi: boolean;
  tarih: string;
  saat: string;
  sorumlu: string;
  savingAct: boolean;
  savedAct: boolean;
  durumError: boolean;
  shakeDropdown: boolean;
  showDatetime: boolean;
}
export const EMPTY_DRAFT: DraftBundle = {
  note: "", sonrakiTip: "", gonderildi: false, tarih: "", saat: "", sorumlu: "",
  savingAct: false, savedAct: false, durumError: false, shakeDropdown: false, showDatetime: false,
};
