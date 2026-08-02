"use client";

/**
 * FlexOS · Satışlar — "Satış Yap" formu.
 * Tasarım: _design "Satış Yap.dc.html" (Claude Design) React'e portlandı.
 * Eğitim Ekle / Katalog ile aynı desen: inline S/IC, Inter, authStateReady korumalı,
 * paylaşımlı FlexSidebar.
 *
 * DURUM: 3 sekme (Genel Bilgiler · Eğitim · Ödeme).
 * Eğitim sekmesi GERÇEK KATALOĞA BAĞLI: branş/eğitim/bölüm/track GET'ten gelir
 *   (GET /api/flexos/{branches, educations?branchId, sections?educationId, tracks?educationId}).
 *   structure==="sectioned" → "Track Bazlı" satış modeli açık; "single" → Full Paket kilitli.
 * Ödeme sekmesi: brüt katalog listPrice'ından türetilir → kampanya + ek indirim → NET.
 *   Çok satırlı ödeme girişi (Nakit/KK/Havale/Senet + taksit); senet satırı varken
 *   aylık vade farkı % inputu açılır (canlı önizleme: toplam vade farkı + taksit başı tutar).
 *   Kaydet → soldPrice + payment (upfront + senet plan) backend'e gider → flexos_payments'a persist.
 * KALAN EKSİK: kampanya katalog entity'si yok (statik); tahsilat okuma ucu Finans modülünde.
 */

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../../_components/FlexSpinner";
import { useCapabilities } from "../../_components/useCapabilities";
import { authHeaders } from "@/app/lib/client/auth-headers";
import {
  BranchDoc, EducationDoc, SectionDoc, TrackDoc, BundleDoc, CampaignDoc,
  Step, Uyruk, OdemeSatir, ageFrom,
} from "./_shared/types";
import { S, IC, globalCss, tabStyle, tabNum } from "./_shared/constants";
import { calcBundleDiscount, calcBrutBase, calcSalePricing } from "./_shared/pricing";
import { buildSaleRequestBody } from "./_shared/buildSaleRequestBody";
import { GenelBilgilerTab } from "./_shared/GenelBilgilerTab";
import { EgitimTab } from "./_shared/EgitimTab";
import { OdemeTab } from "./_shared/OdemeTab";

export default function SatisYapPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { caps, loaded: capsLoaded } = useCapabilities();

  // ── form state ──
  const [step, setStep] = useState<Step>("genel");
  const [satisTipi, setSatisTipi] = useState<"Bireysel" | "Kurumsal">("Bireysel");
  // genel bilgiler
  const [ad, setAd] = useState("");       // öğrencinin kendisi (sınıf listesine giden isim)
  const [soyad, setSoyad] = useState("");
  const [veliAd, setVeliAd] = useState(""); // 18 altı: sözleşme/ödeme tarafı (Sale'e gider, listede görünmez)
  const [veliTc, setVeliTc] = useState("");
  const [dogumTarihi, setDogumTarihi] = useState("");
  const [cinsiyet, setCinsiyet] = useState("");
  const [uyruk, setUyruk] = useState<Uyruk>("TC");
  const [tcNo, setTcNo] = useState("");
  const [pasaportNo, setPasaportNo] = useState("");
  const [telefon, setTelefon] = useState("");
  const [eposta, setEposta] = useState("");
  const [calismaDurumu, setCalismaDurumu] = useState("");
  const [adres, setAdres] = useState("");
  // eğitim — gerçek katalog (branchId / educationId)
  const [brans, setBrans] = useState("");
  const [egitim, setEgitim] = useState("");
  const [kampanya, setKampanya] = useState("");
  const [satisNedeni, setSatisNedeni] = useState("Yeni Satış");
  const [satisModeli, setSatisModeli] = useState<"full" | "track">("full"); // varsayılan Full Paket
  const [teslimSekli, setTeslimSekli] = useState<"in_person" | "online">("in_person"); // hibrit eğitimde Full Paket fiyatı için
  // track bazlı seçim: trackId → seçili mi (varsayılan true = hepsi dahil)
  const [trackSel, setTrackSel] = useState<Record<string, boolean>>({});
  // ödeme: ek indirim + çok satırlı ödeme girişi + senet vade farkı
  const [elIndirim, setElIndirim] = useState("");
  const [elIndirimMod, setElIndirimMod] = useState<"yuzde" | "tutar">("yuzde");
  const [odemeSatirlari, setOdemeSatirlari] = useState<OdemeSatir[]>([{ tip: "Nakit", tutar: "", taksit: "1" }]);
  const [senetVadeFarki, setSenetVadeFarki] = useState(""); // aylık vade farkı %
  const [saving, setSaving] = useState(false);

  // ── satış modu: bireysel vs paket ──
  const [satisModu, setSatisModu] = useState<"bireysel" | "paket">("bireysel");
  const [paketId, setPaketId] = useState("");
  const [bundles, setBundles] = useState<BundleDoc[]>([]);
  const [loadingBundles] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([]);
  const [nthApplied, setNthApplied] = useState(false); // ek kayıt indirimi otomatik uygulandı mı
  // TC no eşleşen mevcut kişi — satıcıya "zaten kayıtlı" bilgisini göstermek için (2026-07-23)
  const [existingPerson, setExistingPerson] = useState<{ name: string; enrollments: { educationName: string; statusLabel: string }[] } | null>(null);

  // ── katalog verisi (GET'ten) ──
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [educations, setEducations] = useState<EducationDoc[]>([]);
  const [sections, setSections] = useState<SectionDoc[]>([]);
  const [tracks, setTracks] = useState<TrackDoc[]>([]);
  const [loadingEdu, setLoadingEdu] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);

  // auth + branşlar + paketler
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      try {
        const headers = await authHeaders();
        const [brRes, bndRes, campRes] = await Promise.all([
          fetch("/api/flexos/branches",   { headers, signal: ac.signal }),
          fetch("/api/flexos/bundles",    { headers, signal: ac.signal }),
          fetch("/api/flexos/campaigns",  { headers, signal: ac.signal }),
        ]);
        const brJson   = brRes.ok   ? await brRes.json()   : { items: [] };
        const bndJson  = bndRes.ok  ? await bndRes.json()  : { items: [] };
        const campJson = campRes.ok ? await campRes.json() : { items: [] };
        if (!ac.signal.aborted) {
          setBranches(brJson.items ?? []);
          setBundles((bndJson.items ?? []).filter((b: BundleDoc) => b.status === "aktif"));
          setCampaigns((campJson.items ?? []).filter((c: CampaignDoc) => c.status === "aktif"));
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Veriler yüklenemedi.");
      }
    })();
    return () => ac.abort();
  }, [router]);

  // branş seçilince → o branşın eğitimleri
  useEffect(() => {
    if (!authed || !brans) { setEducations([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingEdu(true);
      try {
        const res = await fetch(`/api/flexos/educations?branchId=${encodeURIComponent(brans)}&onSale=true`, { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setEducations(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Eğitimler yüklenemedi.");
      } finally {
        if (!ac.signal.aborted) setLoadingEdu(false);
      }
    })();
    return () => ac.abort();
  }, [authed, brans]);

  // TC 11 hane tamamlanınca → kişi var mı? Ek Kayıt İndirimi kampanyası otomatik uygula
  // + satıcıya "bu kişi zaten kayıtlı, hangi eğitim(ler)de" bilgisini göster (2026-07-23)
  useEffect(() => {
    const digits = tcNo.replace(/\D/g, "");
    if (!authed || digits.length !== 11) { setExistingPerson(null); return; }
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/flexos/persons/lookup?idNo=${digits}`, { headers: await authHeaders(), signal: ac.signal });
        if (!res.ok || ac.signal.aborted) return;
        const data: { found: boolean; name?: string; saleDates?: string[]; enrollments?: { educationName: string; statusLabel: string }[] } = await res.json();
        if (!data.found) { setExistingPerson(null); return; }
        setExistingPerson({ name: data.name ?? "", enrollments: data.enrollments ?? [] });

        if (!data.saleDates || !campaigns.length) return;
        const today = new Date().toISOString().slice(0, 10);
        // kampanya tarih aralığında yapılmış önceki satışları say
        const nthCamp = campaigns.find((c) => {
          if (c.discountType !== "nth") return false;
          const inPeriod = data.saleDates!.filter((d) => d >= c.startDate && d <= c.endDate).length;
          return inPeriod + 1 === c.nthN && today >= c.startDate && today <= c.endDate;
        });
        if (nthCamp && !kampanya) {
          setKampanya(nthCamp.id);
          setNthApplied(true);
          toast.info(`Bu kişinin ${nthCamp.nthN}. eğitimi — "${nthCamp.name}" otomatik uygulandı.`);
        }
      } catch { /* AbortError vb. yoksay */ }
    })();
    return () => ac.abort();
  }, [tcNo, authed, campaigns, kampanya]);

  // eğitim seçilince → bölüm + track ağacı (sectioned ise)
  useEffect(() => {
    if (!egitim) { setSections([]); setTracks([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingTree(true);
      try {
        const headers = await authHeaders();
        const [secRes, trRes] = await Promise.all([
          fetch(`/api/flexos/sections?educationId=${encodeURIComponent(egitim)}`, { headers, signal: ac.signal }),
          fetch(`/api/flexos/tracks?educationId=${encodeURIComponent(egitim)}`, { headers, signal: ac.signal }),
        ]);
        const secJson = secRes.ok ? await secRes.json() : { items: [] };
        const trJson = trRes.ok ? await trRes.json() : { items: [] };
        if (!ac.signal.aborted) { setSections(secJson.items ?? []); setTracks(trJson.items ?? []); }
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Eğitim içeriği yüklenemedi.");
      } finally {
        if (!ac.signal.aborted) setLoadingTree(false);
      }
    })();
    return () => ac.abort();
  }, [egitim]);

  // branş değişince eğitim + seçimleri sıfırla
  const onBransChange = (id: string) => { setBrans(id); setEgitim(""); setSections([]); setTracks([]); setTrackSel({}); setSatisModeli("full"); setTeslimSekli("in_person"); };
  const onEgitimChange = (id: string) => { setEgitim(id); setTrackSel({}); setSatisModeli("full"); setTeslimSekli("in_person"); };
  const onSelectBireysel = () => setSatisModu("bireysel");
  const onSelectPaket = () => {
    setSatisModu("paket"); setEgitim(""); setBrans(""); setSections([]); setTracks([]); setTrackSel({}); setKampanya("");
  };

  // ── türetilmiş değerler ──
  const age = ageFrom(dogumTarihi);
  const isMinor = age !== null && age >= 0 && age < 18;

  const isGenel = step === "genel";
  const isEgitim = step === "egitim";
  const isOdeme = step === "odeme";

  const selBundle = bundles.find((b) => b.id === paketId);
  const hicSecimYok = satisModu === "paket" ? !paketId : !egitim;
  const showIcerik  = satisModu === "bireysel" && !!egitim;

  const selEdu = educations.find((e) => e.id === egitim);
  const trackBased = selEdu?.structure === "sectioned";
  // Satış Modeli yalnızca bölümlü (sectioned) eğitimde seçilebilir; aksi halde Full Paket'e kilitli
  const modelLocked = !egitim || !trackBased;
  const effModel: "full" | "track" = modelLocked ? "full" : satisModeli;
  const showTrackTree = trackBased && effModel === "track";

  // Hibrit eğitim: Full Paket alınırken teslim şekline (Yüz Yüze/Online) göre ayrı fiyat.
  // Track Bazlı satışta her track'in kendi teslim fiyatı yok (kapsam dışı) — sadece Full Paket'i etkiler.
  const hybridOptions = selEdu?.deliveryMode === "hybrid" ? (selEdu.deliveryOptions ?? []) : [];
  // Diğer eğitimlerde de aynı seçici görünür kalır (disabled) — "Satış Modeli" ile aynı desen, sığmaz kaygısı yok.
  const teslimLocked = !egitim || hybridOptions.length === 0 || effModel !== "full";
  const selDeliveryOption = hybridOptions.find((o) => o.mode === teslimSekli);
  const eduFullPrice = selDeliveryOption ? selDeliveryOption.listPrice : selEdu?.listPrice;

  // Seçili teslim şekli bu eğitimde yoksa (ör. sadece "online" tanımlı), mevcut olana düş.
  useEffect(() => {
    if (hybridOptions.length === 0) return;
    if (!hybridOptions.some((o) => o.mode === teslimSekli)) {
      setTeslimSekli(hybridOptions[0].mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egitim, hybridOptions.length]);

  // bölüm → track ağacı (order'a göre, gerçek GET verisinden)
  const tree = useMemo(
    () =>
      [...sections]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((sec) => ({
          sec,
          tracks: tracks.filter((t) => t.sectionId === sec.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        })),
    [sections, tracks],
  );

  const trackOn = (id: string) => trackSel[id] ?? true; // varsayılan dahil
  const toggleTrack = (id: string) => setTrackSel((s) => ({ ...s, [id]: !(s[id] ?? true) }));
  const setManyTracks = (ids: string[], val: boolean) =>
    setTrackSel((s) => { const n = { ...s }; ids.forEach((id) => { n[id] = val; }); return n; });
  const allOnOf = (ids: string[]) => ids.length > 0 && ids.every((id) => trackOn(id));
  const someOnOf = (ids: string[]) => ids.some((id) => trackOn(id));

  const treeTracks = tree.flatMap((n) => n.tracks); // ağaçta görünen (bölüme bağlı) track'ler
  const selTrackCount = treeTracks.filter((t) => trackOn(t.id)).length;
  const selTrackSaat = treeTracks.reduce((sum, t) => sum + (trackOn(t.id) ? (t.hours ?? 0) : 0), 0);

  // Full Paket içerik — program listesi + toplam saat
  const fullHours = trackBased
    ? sections.reduce((sum, s) => sum + (s.hours ?? 0), 0)
    : tracks.reduce((sum, t) => sum + (t.hours ?? 0), 0);
  const programItems = trackBased
    ? tree.map((n, i) => ({ no: String(i + 1), name: n.sec.name, topics: `${n.tracks.length} track`, sure: n.sec.hours ? `${n.sec.hours} saat` : "" }))
    : (selEdu?.outline ?? []).map((o, i) => ({ no: String(i + 1), name: o, topics: "", sure: "" }));
  const icerikBaslik = selEdu?.name ?? "";
  const icerikOzet = trackBased
    ? "Bu eğitim bölümlere ayrılmıştır; her bölüm kendi grubu, yoklaması ve sertifikasıyla işlenir. Full Paket'te tüm bölümler dahildir."
    : "Bu program; alanında uzman eğitmenler eşliğinde uygulamalı projeler ve gerçek sektör örnekleriyle yürütülür.";

  // ── ÖDEME hesapları — kritik finansal mantık _shared/pricing.ts'te (test edilebilir, saf) ──
  // Tekrar / Sınıf Değişimi → ücretsiz işlem (0 TL kilit).
  const sifirKilit = satisNedeni === "Tekrar Öğrencisi" || satisNedeni === "Sınıf Değişimi";
  const { bundleDisc, bundleDiscPct } = calcBundleDiscount(selBundle?.items, selBundle?.bundlePrice);

  const brutBase = calcBrutBase({
    satisModu,
    bundlePrice: selBundle?.bundlePrice ?? 0,
    showTrackTree,
    selectedTracksPrice: treeTracks.filter((t) => trackOn(t.id)).reduce((s, t) => s + (t.listPrice ?? 0), 0),
    trackBased,
    eduFullPrice,
    sectionsPrice: sections.reduce((s, x) => s + (x.listPrice ?? 0), 0),
  });
  const kdvOrani = satisModu === "paket"
    ? (selBundle?.vatRate ?? selBundle?.items[0]?.vatRate ?? 10)
    : (selEdu?.vatRate ?? 0);

  // Kampanya bireysel satışa özeldir — paket modunda devre dışı
  const selCampaign = satisModu === "bireysel" ? (campaigns.find((c) => c.id === kampanya) ?? null) : null;
  const kampanyaEtiket = selCampaign?.discountType === "percent" ? `%${selCampaign.discountValue}` : selCampaign?.discountType === "fixed" ? `${selCampaign.discountValue} TL sabit` : "";

  const pricing = calcSalePricing({
    brutBase, sifirKilit, kdvOrani, campaign: selCampaign,
    elIndirim, elIndirimMod, odemeSatirlari, senetVadeFarki,
  });
  const {
    brut, kampanyaIndTutar, hasKampanyaInd, elIndirimTutar, elIndirimVar, indirimliMatrah,
    kdvTutar, net, alinan, kalan, hasSenet, senetTaksitN, vadeFarkiTutar, kalanSifir,
  } = pricing;

  // ödeme satır handler'ları
  const updateOdeme = (i: number, key: keyof OdemeSatir, val: string) =>
    setOdemeSatirlari((rows) => rows.map((o, idx) => {
      if (idx !== i) return o;
      const next = { ...o, [key]: val };
      if (key === "tip" && val !== "Kredi Kartı" && val !== "Senet") next.taksit = "1";
      return next;
    }));
  const addOdeme = () => setOdemeSatirlari((rows) => [...rows, { tip: "Nakit", tutar: "", taksit: "1" }]);
  const removeOdeme = (i: number) => setOdemeSatirlari((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));

  const onNext = () => {
    if (step === "genel") { setStep("egitim"); return; }
    if (step === "egitim") {
      if (satisModu === "paket" && !paketId) { toast.error("Lütfen bir paket seçin."); return; }
      if (satisModu === "bireysel" && !egitim) { toast.error("Lütfen eğitim seçin."); return; }
      setStep("odeme");
      return;
    }
    // ödeme sekmesinde → satışı tamamla
    onSave();
  };

  const onSave = async () => {
    // ── validasyon ──
    if (!ad.trim() || !soyad.trim()) { toast.error("Ad ve soyad zorunludur."); setStep("genel"); return; }
    if (satisModu === "bireysel" && !egitim) { toast.error("Lütfen eğitim seçin."); setStep("egitim"); return; }
    if (satisModu === "paket" && !paketId) { toast.error("Lütfen paket seçin."); setStep("egitim"); return; }

    // track bazlı → seçili track id'leri
    const selectedTrackIds = showTrackTree
      ? treeTracks.filter((t) => trackOn(t.id)).map((t) => t.id)
      : undefined;

    if (showTrackTree && (!selectedTrackIds || selectedTrackIds.length === 0)) {
      toast.error("En az bir track seçmelisiniz."); return;
    }

    const body = buildSaleRequestBody({
      ad, soyad, dogumTarihi, cinsiyet, uyruk, tcNo, pasaportNo, telefon, eposta, adres,
      isMinor, veliAd, veliTc, satisNedeni, satisTipi, satisModu, egitim, paketId, kampanya,
      selectedTrackIds, net, odemeSatirlari, senetVadeFarki,
    });

    setSaving(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/flexos/sales", { method: "POST", headers, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Satış kaydedilemedi."); return; }
      const payMsg = json.paymentCount > 0
        ? ` (${json.paymentCount} ödeme kaydı${json.financingFee > 0 ? `, vade farkı ${json.financingFee} TL` : ""})`
        : "";
      toast.success(`Satış başarıyla kaydedildi!${payMsg}`);
      router.push("/flexos/ogrenciler/havuz");
    } catch {
      toast.error("Sunucu hatası — satış kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (authed === null || !capsLoaded) return <FlexPageLoader />;

  if (!caps.has("sale.create")) {
    return (
      <div style={S.root}>
        <style>{globalCss}</style>
        <FlexSidebar active="satis-yap" />
        <main className="sy-main" style={S.main}>
          <FlexHeader
            icon={<span dangerouslySetInnerHTML={{ __html: IC.shoppingBag }} />}
            title="Satış Yap"
            subtitle="Yeni öğrenci kaydı oluşturun."
          />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E222B", marginBottom: 6 }}>Bu sayfaya erişim yetkiniz yok</div>
              <div style={{ fontSize: 13, color: "#8E95A3", lineHeight: 1.5 }}>Satış oluşturma yetkiniz bulunmuyor. Erişim gerekiyorsa yöneticinizle iletişime geçin.</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const segOn = S.segOn, segOff = S.segOff;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="satis-yap" />

      <main className="sy-main" style={S.main}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.shoppingBag }} />}
          title="Satış Yap"
          subtitle="Yeni öğrenci kaydı oluşturun."
        />

        <div style={{ maxWidth: 1920, margin: "0 auto", padding: "26px 36px 64px", width: "100%", boxSizing: "border-box", flex: 1 }}>

          {/* 1) Satış Tipi toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={S.segWrap}>
              <button style={satisTipi === "Bireysel" ? segOn : segOff} onClick={() => setSatisTipi("Bireysel")}>
                <span dangerouslySetInnerHTML={{ __html: IC.user }} />
                Bireysel Satış
              </button>
              <button style={satisTipi === "Kurumsal" ? segOn : segOff} onClick={() => setSatisTipi("Kurumsal")}>
                <span dangerouslySetInnerHTML={{ __html: IC.building }} />
                Kurumsal Satış
              </button>
            </div>
          </div>

          {/* 2) Dinamik başlık */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.4px", color: "#0f1f3d" }}>
              {satisTipi === "Bireysel" ? "Bireysel Satış Formu" : "Kurumsal Satış Formu"}
            </h2>
            <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "#64748b", fontWeight: 500 }}>
              {satisTipi === "Bireysel"
                ? "Bireysel kursiyer kaydı oluşturun ve satışı başlatın."
                : "Kurum adına toplu kayıt ve satış işlemi oluşturun."}
            </p>
          </div>

          {/* 3) Tabs */}
          <div className="sy-tabs" style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid #e2e8f1", marginBottom: 24, overflowX: "auto" }}>
            <button style={tabStyle(isGenel)} onClick={() => setStep("genel")}>
              <span style={tabNum(isGenel)}>1</span>
              Genel Bilgiler
            </button>
            <button style={tabStyle(isEgitim)} onClick={() => setStep("egitim")}>
              <span style={tabNum(isEgitim)}>2</span>
              Eğitim
            </button>
            <button style={tabStyle(isOdeme)} onClick={() => { if (!egitim) { toast.error("Önce eğitim seçin."); setStep("egitim"); return; } setStep("odeme"); }}>
              <span style={tabNum(isOdeme)}>3</span>
              Ödeme
            </button>
          </div>

          {/* CARD */}
          <div style={S.card}>
            <div style={{ padding: "30px 32px 40px" }}>

              {isGenel && (
                <GenelBilgilerTab
                  ad={ad} setAd={setAd} soyad={soyad} setSoyad={setSoyad}
                  dogumTarihi={dogumTarihi} setDogumTarihi={setDogumTarihi}
                  cinsiyet={cinsiyet} setCinsiyet={setCinsiyet}
                  uyruk={uyruk} setUyruk={setUyruk} tcNo={tcNo} setTcNo={setTcNo}
                  pasaportNo={pasaportNo} setPasaportNo={setPasaportNo}
                  existingPerson={existingPerson}
                  isMinor={isMinor} veliAd={veliAd} setVeliAd={setVeliAd} veliTc={veliTc} setVeliTc={setVeliTc}
                  telefon={telefon} setTelefon={setTelefon} eposta={eposta} setEposta={setEposta}
                  calismaDurumu={calismaDurumu} setCalismaDurumu={setCalismaDurumu}
                  adres={adres} setAdres={setAdres}
                />
              )}

              {isEgitim && (
                <EgitimTab
                  satisModu={satisModu} onSelectBireysel={onSelectBireysel} onSelectPaket={onSelectPaket}
                  branches={branches} brans={brans} onBransChange={onBransChange}
                  educations={educations} egitim={egitim} onEgitimChange={onEgitimChange} loadingEdu={loadingEdu}
                  kampanya={kampanya} setKampanya={setKampanya} campaigns={campaigns}
                  paketId={paketId} setPaketId={setPaketId} bundles={bundles} loadingBundles={loadingBundles} selBundle={selBundle}
                  satisNedeni={satisNedeni} setSatisNedeni={setSatisNedeni}
                  effModel={effModel} setSatisModeli={setSatisModeli} modelLocked={modelLocked}
                  teslimSekli={teslimSekli} setTeslimSekli={setTeslimSekli} teslimLocked={teslimLocked} hybridOptions={hybridOptions}
                  hicSecimYok={hicSecimYok}
                  showTrackTree={showTrackTree} loadingTree={loadingTree} tree={tree}
                  selTrackCount={selTrackCount} selTrackSaat={selTrackSaat}
                  trackOn={trackOn} toggleTrack={toggleTrack} allOnOf={allOnOf} someOnOf={someOnOf} setManyTracks={setManyTracks}
                  showIcerik={showIcerik} icerikBaslik={icerikBaslik} icerikOzet={icerikOzet}
                  fullHours={fullHours} trackBased={trackBased} programItems={programItems} selEdu={selEdu}
                />
              )}

              {isOdeme && (
                <OdemeTab
                  sifirKilit={sifirKilit} satisNedeni={satisNedeni} satisModu={satisModu} selBundle={selBundle}
                  bundleDiscPct={bundleDiscPct} bundleDisc={bundleDisc} brut={brut}
                  teslimLocked={teslimLocked} teslimSekli={teslimSekli}
                  hasKampanyaInd={hasKampanyaInd} kampanyaEtiket={kampanyaEtiket} kampanyaIndTutar={kampanyaIndTutar}
                  elIndirimMod={elIndirimMod} setElIndirimMod={setElIndirimMod} elIndirim={elIndirim} setElIndirim={setElIndirim}
                  elIndirimVar={elIndirimVar} elIndirimTutar={elIndirimTutar}
                  indirimliMatrah={indirimliMatrah} kdvOrani={kdvOrani} kdvTutar={kdvTutar} net={net}
                  odemeSatirlari={odemeSatirlari} updateOdeme={updateOdeme} addOdeme={addOdeme} removeOdeme={removeOdeme}
                  hasSenet={hasSenet} kalan={kalan} senetVadeFarki={senetVadeFarki} setSenetVadeFarki={setSenetVadeFarki}
                  vadeFarkiTutar={vadeFarkiTutar} senetTaksitN={senetTaksitN} kalanSifir={kalanSifir} alinan={alinan}
                />
              )}
            </div>

            {/* footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "32px", borderTop: "1px solid #eef1f6", background: "#fafbfd" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {(isEgitim || isOdeme) && (
                  <button className="sy-back" style={S.backLink} onClick={() => setStep(isOdeme ? "egitim" : "genel")}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
                    Geri
                  </button>
                )}
                <span style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500 }}>
                  {isOdeme ? "Ödeme bilgilerini girip satışı tamamlayın." : isEgitim ? "Satış kapsamını onaylayıp ödemeye geçin." : "Kişisel bilgileri tamamlayıp sonraki adıma geçin."}
                </span>
              </div>
              <button className="sy-next" style={{ ...S.nextBtn, opacity: saving ? 0.7 : 1, pointerEvents: saving ? "none" : "auto" }} onClick={onNext} disabled={saving}>
                {saving ? "Kaydediliyor…" : isOdeme ? "Satışı Tamamla" : isEgitim ? "Devam Et — Ödeme" : "Devam Et — Eğitim"}
                {!saving && <span dangerouslySetInnerHTML={{ __html: isOdeme ? IC.checkWhite : IC.arrowRight }} />}
              </button>
            </div>
          </div>
        </div>
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}
