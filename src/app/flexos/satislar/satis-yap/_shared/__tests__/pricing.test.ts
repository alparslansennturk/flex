import { describe, it, expect } from "vitest";
import { calcBundleDiscount, calcBrutBase, calcSalePricing } from "../pricing";
import type { OdemeSatir } from "../types";

const noOdeme: OdemeSatir[] = [{ tip: "Nakit", tutar: "", taksit: "1" }];

describe("calcBundleDiscount", () => {
  it("paket fiyatı liste toplamından düşükse indirim yüzdesini hesaplar", () => {
    const r = calcBundleDiscount(
      [{ educationId: "e1", name: "A", brans: "Design", listPrice: 10000 }, { educationId: "e2", name: "B", brans: "Design", listPrice: 5000 }],
      12000,
    );
    expect(r.bundleIndTotal).toBe(15000);
    expect(r.bundleDisc).toBe(3000);
    expect(r.bundleDiscPct).toBe(20);
  });

  it("items boşsa sıfır döner (bölme hatası yok)", () => {
    const r = calcBundleDiscount(undefined, undefined);
    expect(r).toEqual({ bundleIndTotal: 0, bundleDisc: 0, bundleDiscPct: 0 });
  });
});

describe("calcBrutBase", () => {
  const base = {
    satisModu: "bireysel" as const,
    bundlePrice: 0,
    showTrackTree: false,
    selectedTracksPrice: 0,
    trackBased: false,
    eduFullPrice: undefined as number | undefined,
    sectionsPrice: 0,
  };

  it("paket modunda bundlePrice'ı kullanır (diğer alanları yoksayar)", () => {
    expect(calcBrutBase({ ...base, satisModu: "paket", bundlePrice: 9000, eduFullPrice: 99999 })).toBe(9000);
  });

  it("track bazlı satışta seçili track'lerin toplamını kullanır", () => {
    expect(calcBrutBase({ ...base, showTrackTree: true, selectedTracksPrice: 4500, eduFullPrice: 20000 })).toBe(4500);
  });

  it("bölümlü eğitimde Full Paket seçiliyken eduFullPrice varsa onu kullanır", () => {
    expect(calcBrutBase({ ...base, trackBased: true, eduFullPrice: 18000, sectionsPrice: 5000 })).toBe(18000);
  });

  it("bölümlü eğitimde eduFullPrice yoksa bölümlerin toplamına düşer", () => {
    expect(calcBrutBase({ ...base, trackBased: true, eduFullPrice: undefined, sectionsPrice: 5000 })).toBe(5000);
  });

  it("tekli (sectioned olmayan) eğitimde eduFullPrice'ı kullanır, yoksa 0", () => {
    expect(calcBrutBase({ ...base, eduFullPrice: 7000 })).toBe(7000);
    expect(calcBrutBase({ ...base, eduFullPrice: undefined })).toBe(0);
  });
});

describe("calcSalePricing", () => {
  it("sıfırKilit=true iken TÜM tutarları 0'a kilitler (Tekrar/Sınıf Değişimi)", () => {
    const r = calcSalePricing({
      brutBase: 20000, sifirKilit: true, kdvOrani: 10,
      campaign: { discountType: "percent", discountValue: 15 },
      elIndirim: "50", elIndirimMod: "yuzde",
      odemeSatirlari: [{ tip: "Nakit", tutar: "1000", taksit: "1" }],
      senetVadeFarki: "",
    });
    expect(r.brut).toBe(0);
    expect(r.kampanyaIndTutar).toBe(0);
    expect(r.elIndirimTutar).toBe(0);
    expect(r.net).toBe(0);
    expect(r.alinan).toBe(0); // ödeme satırına tutar girilmiş olsa bile sıfırKilit onu da yoksayar
    expect(r.kalan).toBe(0);
  });

  it("yüzdelik kampanya indirimini brüt üzerinden hesaplar", () => {
    const r = calcSalePricing({
      brutBase: 10000, sifirKilit: false, kdvOrani: 0,
      campaign: { discountType: "percent", discountValue: 20 },
      elIndirim: "", elIndirimMod: "yuzde",
      odemeSatirlari: noOdeme, senetVadeFarki: "",
    });
    expect(r.kampanyaIndTutar).toBe(2000);
    expect(r.afterKampanya).toBe(8000);
    expect(r.net).toBe(8000);
  });

  it("sabit tutarlı kampanya indirimi brütü aşamaz (Math.min guard)", () => {
    const r = calcSalePricing({
      brutBase: 1000, sifirKilit: false, kdvOrani: 0,
      campaign: { discountType: "fixed", discountValue: 5000 },
      elIndirim: "", elIndirimMod: "yuzde",
      odemeSatirlari: noOdeme, senetVadeFarki: "",
    });
    expect(r.kampanyaIndTutar).toBe(1000); // brütle sınırlı, net negatife düşmüyor
    expect(r.afterKampanya).toBe(0);
  });

  it("yüzdelik ek (yönetici) indirim 100'ü aşarsa kırpılır, matrah negatife düşmez", () => {
    const r = calcSalePricing({
      brutBase: 5000, sifirKilit: false, kdvOrani: 0,
      campaign: null,
      elIndirim: "150", elIndirimMod: "yuzde",
      odemeSatirlari: noOdeme, senetVadeFarki: "",
    });
    expect(r.elIndirimTutar).toBe(5000); // %150 → %100'e kırpıldı
    expect(r.indirimliMatrah).toBe(0);
  });

  it("tutar bazlı ek indirim afterKampanya'yı aşamaz", () => {
    const r = calcSalePricing({
      brutBase: 5000, sifirKilit: false, kdvOrani: 0,
      campaign: null,
      elIndirim: "9999", elIndirimMod: "tutar",
      odemeSatirlari: noOdeme, senetVadeFarki: "",
    });
    expect(r.elIndirimTutar).toBe(5000);
    expect(r.indirimliMatrah).toBe(0);
  });

  it("KDV'yi indirimli matrah üzerinden hesaplar ve net'e ekler", () => {
    const r = calcSalePricing({
      brutBase: 10000, sifirKilit: false, kdvOrani: 10,
      campaign: null, elIndirim: "", elIndirimMod: "yuzde",
      odemeSatirlari: noOdeme, senetVadeFarki: "",
    });
    expect(r.indirimliMatrah).toBe(10000);
    expect(r.kdvTutar).toBe(1000);
    expect(r.net).toBe(11000);
  });

  it("alınan tutar net'i geçerse kalan negatife düşmez (0'da durur)", () => {
    const r = calcSalePricing({
      brutBase: 1000, sifirKilit: false, kdvOrani: 0,
      campaign: null, elIndirim: "", elIndirimMod: "yuzde",
      odemeSatirlari: [{ tip: "Nakit", tutar: "5000", taksit: "1" }],
      senetVadeFarki: "",
    });
    expect(r.kalan).toBe(0);
    expect(r.kalanSifir).toBe(true);
  });

  it("senet vade farkını FLAT (kalan × aylık% × taksit sayısı) hesaplar", () => {
    const r = calcSalePricing({
      brutBase: 12000, sifirKilit: false, kdvOrani: 0,
      campaign: null, elIndirim: "", elIndirimMod: "yuzde",
      odemeSatirlari: [{ tip: "Senet", tutar: "0", taksit: "3" }],
      senetVadeFarki: "2",
    });
    // kalan = 12000, aylık %2 × 3 taksit = %6 → 720
    expect(r.hasSenet).toBe(true);
    expect(r.senetTaksitN).toBe(3);
    expect(r.vadeFarkiTutar).toBe(720);
    expect(r.toplamBeklenen).toBe(12720);
  });

  it("senet satırı yoksa veya kalan sıfırsa vade farkı hesaplanmaz", () => {
    const noSenet = calcSalePricing({
      brutBase: 5000, sifirKilit: false, kdvOrani: 0,
      campaign: null, elIndirim: "", elIndirimMod: "yuzde",
      odemeSatirlari: noOdeme, senetVadeFarki: "5",
    });
    expect(noSenet.vadeFarkiTutar).toBe(0);

    const kalanSifir = calcSalePricing({
      brutBase: 5000, sifirKilit: false, kdvOrani: 0,
      campaign: null, elIndirim: "", elIndirimMod: "yuzde",
      odemeSatirlari: [{ tip: "Senet", tutar: "5000", taksit: "3" }],
      senetVadeFarki: "5",
    });
    expect(kalanSifir.kalan).toBe(0);
    expect(kalanSifir.vadeFarkiTutar).toBe(0);
  });
});
