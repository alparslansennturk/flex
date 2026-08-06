import { OdemeSatir, Uyruk } from "./types";

const GENDER_MAP: Record<string, string> = { "Kadın": "female", "Erkek": "male", "Belirtmek istemiyorum": "other" };
const SALE_TYPE_MAP: Record<string, string> = { "Yeni Satış": "new_sale", "Tekrar Öğrencisi": "repeat", "Sınıf Değişimi": "transfer" };
const PAYMENT_METHOD_MAP: Record<string, string> = { "Nakit": "cash", "Kredi Kartı": "card", "Havale/EFT": "transfer" };

export interface BuildSaleRequestBodyInput {
  ad: string; soyad: string; dogumTarihi: string; cinsiyet: string;
  uyruk: Uyruk; tcNo: string; pasaportNo: string; telefon: string; eposta: string; adres: string;
  isMinor: boolean; veliAd: string; veliTc: string;
  satisNedeni: string; satisTipi: "Bireysel" | "Kurumsal";
  satisModu: "bireysel" | "paket"; egitim: string; paketId: string; kampanya: string;
  selectedTrackIds: string[] | undefined;
  net: number;
  odemeSatirlari: OdemeSatir[];
  senetVadeFarki: string;
}

/** Form state → POST /api/flexos/sales gövdesi. PII, veli ve ödeme planı eşleme kuralları burada tek yerde. */
export function buildSaleRequestBody(input: BuildSaleRequestBodyInput) {
  const {
    ad, soyad, dogumTarihi, cinsiyet, uyruk, tcNo, pasaportNo, telefon, eposta, adres,
    isMinor, veliAd, veliTc, satisNedeni, satisTipi, satisModu, egitim, paketId, kampanya,
    selectedTrackIds, net, odemeSatirlari, senetVadeFarki,
  } = input;

  const gender = cinsiyet ? GENDER_MAP[cinsiyet] || undefined : undefined;

  const isTc = uyruk === "TC";
  const idType = isTc ? "tc" as const : "passport" as const;
  const idNo = isTc ? tcNo.trim() : pasaportNo.trim();
  const pii: Record<string, string> = {};
  if (idNo) { pii.idType = idType; pii.idNo = idNo; }
  if (telefon.trim()) pii.phone = telefon.trim();
  if (eposta.trim()) pii.email = eposta.trim();
  if (adres.trim()) pii.address = adres.trim();

  const guardian = isMinor && veliAd.trim()
    ? { name: veliAd.trim(), idNo: veliTc.trim() || undefined }
    : undefined;

  const upfrontRows = odemeSatirlari
    .filter((o) => o.tip !== "Senet" && (Number.parseFloat(o.tutar) || 0) > 0)
    .map((o) => ({ method: PAYMENT_METHOD_MAP[o.tip] || "cash", amount: Number.parseFloat(o.tutar) }));
  const senetRow = odemeSatirlari.find((o) => o.tip === "Senet");
  const senetCount = senetRow ? (Number.parseInt(senetRow.taksit) || 0) : 0;

  const payment = (upfrontRows.length > 0 || senetCount > 0) ? {
    upfront: upfrontRows.length > 0 ? upfrontRows : undefined,
    senet: senetCount > 0 ? {
      count: senetCount,
      monthlyRatePct: Number.parseFloat(senetVadeFarki) || 0,
    } : undefined,
  } : undefined;

  return {
    firstName: ad.trim(),
    lastName: soyad.trim(),
    birthDate: dogumTarihi || undefined,
    gender,
    pii: Object.keys(pii).length > 0 ? pii : undefined,
    type: SALE_TYPE_MAP[satisNedeni] || "new_sale",
    customerType: satisTipi === "Kurumsal" ? "corporate" : "individual",
    educationId: satisModu === "bireysel" ? egitim : undefined,
    bundleId:    satisModu === "paket"    ? paketId : undefined,
    campaignId:  satisModu === "bireysel" && kampanya ? kampanya : undefined,
    trackIds: selectedTrackIds,
    soldPrice: net,
    guardian,
    payment,
  };
}
