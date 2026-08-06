import { BundleItem, CampaignDoc, OdemeSatir } from "./types";

/** Paket içindeki eğitimlerin toplam liste fiyatı vs paket fiyatı — indirim tutarı/yüzdesi. */
export function calcBundleDiscount(items: BundleItem[] | undefined, bundlePrice: number | undefined) {
  const bundleIndTotal = (items ?? []).reduce((s, i) => s + (i.listPrice ?? 0), 0);
  const bundleDisc = bundleIndTotal - (bundlePrice ?? 0);
  const bundleDiscPct = bundleIndTotal > 0 ? Math.round((bundleDisc / bundleIndTotal) * 100) : 0;
  return { bundleIndTotal, bundleDisc, bundleDiscPct };
}

export interface BrutBaseInput {
  satisModu: "bireysel" | "paket";
  bundlePrice: number;
  /** Track Bazlı satış modeli açık ve kullanıcı bu modu seçtiyse true. */
  showTrackTree: boolean;
  /** showTrackTree=true iken seçili track'lerin toplam liste fiyatı. */
  selectedTracksPrice: number;
  /** Eğitim bölümlere ayrılmış mı (sectioned). */
  trackBased: boolean;
  /** Full Paket fiyatı — hibrit eğitimde teslim şekline göre, değilse eğitimin kendi listPrice'ı. */
  eduFullPrice: number | undefined;
  /** trackBased Full Paket'te eduFullPrice yoksa bölümlerin toplamına düşülür. */
  sectionsPrice: number;
}

/** Hangi fiyat kaynağının kullanılacağını belirler: paket / track bazlı / bölümlü full / tekli full. */
export function calcBrutBase(input: BrutBaseInput): number {
  const { satisModu, bundlePrice, showTrackTree, selectedTracksPrice, trackBased, eduFullPrice, sectionsPrice } = input;
  if (satisModu === "paket") return bundlePrice;
  if (showTrackTree) return selectedTracksPrice;
  if (trackBased) return eduFullPrice ?? sectionsPrice;
  return eduFullPrice ?? 0;
}

export interface SalePricingInput {
  brutBase: number;
  /** Tekrar Öğrencisi / Sınıf Değişimi → tüm tutarlar 0 TL kilitlenir. */
  sifirKilit: boolean;
  kdvOrani: number;
  /** Bireysel satışa özel — paket modunda çağıran taraf null geçmeli. */
  campaign: Pick<CampaignDoc, "discountType" | "discountValue"> | null;
  elIndirim: string; // ham input
  elIndirimMod: "yuzde" | "tutar";
  odemeSatirlari: OdemeSatir[];
  senetVadeFarki: string; // ham input, aylık %
}

export interface SalePricingResult {
  brut: number;
  kampanyaIndTutar: number;
  hasKampanyaInd: boolean;
  afterKampanya: number;
  elIndirimTutar: number;
  elIndirimVar: boolean;
  indirimliMatrah: number;
  kdvTutar: number;
  net: number;
  alinan: number;
  kalan: number;
  hasSenet: boolean;
  senetTaksitN: number;
  vadeFarkiTutar: number;
  toplamBeklenen: number;
  kalanSifir: boolean;
}

/**
 * Satış Yap · Ödeme sekmesinin TÜM finansal hesabı — brüt matrahtan kalan tutara kadar.
 * Sıra önemli: kampanya → yönetici indirimi → KDV → alınan/kalan → senet vade farkı.
 */
export function calcSalePricing(input: SalePricingInput): SalePricingResult {
  const { sifirKilit, kdvOrani, campaign, elIndirim, elIndirimMod, odemeSatirlari, senetVadeFarki } = input;

  const brut = sifirKilit ? 0 : input.brutBase;

  const kampanyaIndTutar = (!sifirKilit && campaign)
    ? campaign.discountType === "percent" ? Math.round((brut * campaign.discountValue) / 100)
    : campaign.discountType === "fixed"   ? Math.min(campaign.discountValue, brut)
    : 0
    : 0;
  const hasKampanyaInd = kampanyaIndTutar > 0;
  const afterKampanya = brut - kampanyaIndTutar;

  const elRaw = Number.parseFloat(elIndirim) || 0;
  let elIndirimTutar = 0;
  if (!sifirKilit && elRaw > 0) {
    elIndirimTutar = elIndirimMod === "yuzde"
      ? Math.round((afterKampanya * Math.min(elRaw, 100)) / 100)
      : Math.min(elRaw, afterKampanya);
  }
  const elIndirimVar = elIndirimTutar > 0;
  const indirimliMatrah = Math.max(0, afterKampanya - elIndirimTutar); // KDV hariç, indirimli
  const kdvTutar = Math.round(indirimliMatrah * kdvOrani / 100);
  const net = indirimliMatrah + kdvTutar; // KDV DAHİL toplam = öğrencinin ödeyeceği

  const alinan = sifirKilit ? 0 : odemeSatirlari.reduce((a, o) => a + (Number.parseFloat(o.tutar) || 0), 0);
  const kalan = Math.max(0, net - alinan);

  // senet vade farkı hesabı (FLAT: kalan × aylık% × taksit sayısı)
  const hasSenet = odemeSatirlari.some((o) => o.tip === "Senet");
  const senetSatir = odemeSatirlari.find((o) => o.tip === "Senet");
  const senetTaksitN = senetSatir ? (Number.parseInt(senetSatir.taksit) || 1) : 0;
  const vadeFarkiPct = Number.parseFloat(senetVadeFarki) || 0;
  const vadeFarkiTutar = hasSenet && kalan > 0 && vadeFarkiPct > 0
    ? Math.round(kalan * (vadeFarkiPct / 100) * senetTaksitN)
    : 0;
  const toplamBeklenen = net + vadeFarkiTutar; // net + vade farkı (tahsil edilecek tam tutar)

  const kalanSifir = kalan <= 0;

  return {
    brut, kampanyaIndTutar, hasKampanyaInd, afterKampanya, elIndirimTutar, elIndirimVar,
    indirimliMatrah, kdvTutar, net, alinan, kalan, hasSenet, senetTaksitN, vadeFarkiTutar,
    toplamBeklenen, kalanSifir,
  };
}
