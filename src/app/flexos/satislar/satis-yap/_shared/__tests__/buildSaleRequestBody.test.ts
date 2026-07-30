import { describe, it, expect } from "vitest";
import { buildSaleRequestBody, type BuildSaleRequestBodyInput } from "../buildSaleRequestBody";

const base: BuildSaleRequestBodyInput = {
  ad: "Ayşe", soyad: "Yılmaz", dogumTarihi: "2000-01-01", cinsiyet: "Kadın",
  uyruk: "TC", tcNo: "12345678901", pasaportNo: "", telefon: "5551112233", eposta: "a@b.com", adres: "",
  isMinor: false, veliAd: "", veliTc: "",
  satisNedeni: "Yeni Satış", satisTipi: "Bireysel",
  satisModu: "bireysel", egitim: "edu-1", paketId: "", kampanya: "",
  selectedTrackIds: undefined,
  net: 10000,
  odemeSatirlari: [{ tip: "Nakit", tutar: "10000", taksit: "1" }],
  senetVadeFarki: "",
};

describe("buildSaleRequestBody", () => {
  it("temel alanları doğru eşler", () => {
    const body = buildSaleRequestBody(base);
    expect(body.firstName).toBe("Ayşe");
    expect(body.lastName).toBe("Yılmaz");
    expect(body.gender).toBe("female");
    expect(body.type).toBe("new_sale");
    expect(body.customerType).toBe("individual");
    expect(body.educationId).toBe("edu-1");
    expect(body.bundleId).toBeUndefined();
    expect(body.soldPrice).toBe(10000);
  });

  it("PII sadece dolu alanları içerir, hiçbiri doluysa boşsa pii tamamen undefined olur", () => {
    const empty = buildSaleRequestBody({ ...base, tcNo: "", telefon: "", eposta: "", adres: "" });
    expect(empty.pii).toBeUndefined();

    const withPii = buildSaleRequestBody(base);
    expect(withPii.pii).toEqual({ idType: "tc", idNo: "12345678901", phone: "5551112233", email: "a@b.com" });
  });

  it("Yabancı uyrukta idType passport ve pasaportNo kullanılır", () => {
    const body = buildSaleRequestBody({ ...base, uyruk: "Yabanci", tcNo: "12345678901", pasaportNo: "P1234567" });
    expect(body.pii).toEqual(expect.objectContaining({ idType: "passport", idNo: "P1234567" }));
  });

  it("18 yaş altı VE veli adı girilmişse guardian eklenir, aksi halde eklenmez", () => {
    const withGuardian = buildSaleRequestBody({ ...base, isMinor: true, veliAd: "Veli Bey", veliTc: "11122233344" });
    expect(withGuardian.guardian).toEqual({ name: "Veli Bey", idNo: "11122233344" });

    // reşit değil ama veli adı boş → guardian yok (sistem varsayamaz)
    const noVeliAd = buildSaleRequestBody({ ...base, isMinor: true, veliAd: "" });
    expect(noVeliAd.guardian).toBeUndefined();

    // reşit → veli adı girilse bile guardian yok
    const notMinor = buildSaleRequestBody({ ...base, isMinor: false, veliAd: "Veli Bey" });
    expect(notMinor.guardian).toBeUndefined();
  });

  it("paket modunda bundleId dolar, educationId/campaignId boş kalır", () => {
    const body = buildSaleRequestBody({ ...base, satisModu: "paket", paketId: "bundle-1", egitim: "", kampanya: "camp-1" });
    expect(body.bundleId).toBe("bundle-1");
    expect(body.educationId).toBeUndefined();
    expect(body.campaignId).toBeUndefined(); // kampanya sadece bireysel satışta geçerli
  });

  it("bireysel modda kampanya seçiliyse campaignId dolar", () => {
    const body = buildSaleRequestBody({ ...base, kampanya: "camp-1" });
    expect(body.campaignId).toBe("camp-1");
  });

  it("satış nedeni Tekrar/Sınıf Değişimi doğru type'a eşlenir", () => {
    expect(buildSaleRequestBody({ ...base, satisNedeni: "Tekrar Öğrencisi" }).type).toBe("repeat");
    expect(buildSaleRequestBody({ ...base, satisNedeni: "Sınıf Değişimi" }).type).toBe("transfer");
  });

  it("ödeme satırlarını upfront + senet plana ayırır, Senet upfront'a dahil edilmez", () => {
    const body = buildSaleRequestBody({
      ...base,
      odemeSatirlari: [
        { tip: "Nakit", tutar: "3000", taksit: "1" },
        { tip: "Senet", tutar: "0", taksit: "6" },
        { tip: "Kredi Kartı", tutar: "0", taksit: "3" }, // 0 tutar → upfront'a girmez
      ],
      senetVadeFarki: "2.5",
    });
    expect(body.payment).toEqual({
      upfront: [{ method: "cash", amount: 3000 }],
      senet: { count: 6, monthlyRatePct: 2.5 },
    });
  });

  it("hiç ödeme satırında tutar/senet yoksa payment tamamen undefined olur", () => {
    const body = buildSaleRequestBody({ ...base, odemeSatirlari: [{ tip: "Nakit", tutar: "", taksit: "1" }] });
    expect(body.payment).toBeUndefined();
  });

  it("track bazlı satışta selectedTrackIds aynen geçer", () => {
    const body = buildSaleRequestBody({ ...base, selectedTrackIds: ["t1", "t2"] });
    expect(body.trackIds).toEqual(["t1", "t2"]);
  });
});
