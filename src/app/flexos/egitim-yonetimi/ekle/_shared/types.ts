// ── model tipleri (yerel; backend'e bağlanınca DTO'ya map'lenecek) ────────────
export interface Track {
  id: number;
  name: string;
  sellable: boolean;
  hours: number;
}
export interface Bolum {
  id: number;
  name: string;
  hours: number;
  tracks: Track[];
}
export interface DayData {
  ad: string;
  konular: string[];
  draft: string;
}
export interface PriceRow {
  id: number;
  key: string;
  name: string;
  kind: string;
  liste: string;
  deliveryMode?: "in_person" | "online"; // hibrit eğitimlerde ayrı satır
}
export type TabKey = "genel" | "icerikler" | "fiyat" | "sertifikasyon";

export interface PoolOpt {
  value: string;
  label: string;
  kind: string;
  hours?: number;
  deliveryMode?: "in_person" | "online";
}

export interface EditingTrack {
  bId: number;
  tId: number;
  name: string;
  hours: string;
  sellable: boolean;
}

export interface DragTrack {
  bId: number;
  tId: number;
}

export interface FormState {
  activeTab: TabKey;
  published: boolean;
  saved: boolean;
  bransId: string;
  egitimAdi: string;
  egitimYapisi: "Standart Paket" | "Track Bazlı";
  egitimTipi: "Bireysel" | "Kurumsal";
  satisModeli: string;
  mebAdi: string;
  egitimOrtami: string;
  egitimSuresi: string; // toplam saat
  sozlesmeTipi: string;
  kdvOrani: string;
  aciklama: string;
  icerikMetni: string; // Standart Paket: web sitesinden yapıştırılan düz içerik metni
  gunSayisi: string;
  bolumler: Bolum[];
  dBolumAd: string;
  dBolumSaat: string;
  dTrackAd: string;
  dTrackSell: boolean;
  dTrackSaat: string;
  dTrackTarget: string;
  days: Record<number, DayData>;
  priceRows: PriceRow[];
  poolSel: string;
  sertTipi: string;
  paraBirimi: "TL" | "USD" | "EUR";
  seq: number;
}

export const INITIAL: FormState = {
  activeTab: "genel",
  published: false,
  saved: false,
  bransId: "",
  egitimAdi: "",
  egitimYapisi: "Standart Paket",
  egitimTipi: "Bireysel",
  satisModeli: "Grup Eğitimi",
  mebAdi: "",
  egitimOrtami: "Yüz Yüze",
  egitimSuresi: "",
  sozlesmeTipi: "Mesafeli Satış Sözleşmesi",
  kdvOrani: "10",
  aciklama: "",
  icerikMetni: "",
  gunSayisi: "3",
  bolumler: [],
  dBolumAd: "",
  dBolumSaat: "",
  dTrackAd: "",
  dTrackSell: false,
  dTrackSaat: "",
  dTrackTarget: "",
  days: {},
  priceRows: [],
  poolSel: "__main",
  sertTipi: "Sınav Bazlı",
  paraBirimi: "TL",
  seq: 1,
};
