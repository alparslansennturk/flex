"use client";

/**
 * FlexOS · Satışlar — "Satış Yap" formu.
 * Tasarım: _design "Satış Yap.dc.html" (Claude Design) React'e portlandı.
 * Eğitim Ekle / Katalog ile aynı desen: inline S/IC, Inter, authStateReady korumalı,
 * paylaşımlı FlexSidebar.
 *
 * DURUM: 2 sekme (Genel Bilgiler · Eğitim; "Ödeme" kilitli).
 * Eğitim sekmesi GERÇEK KATALOĞA BAĞLI: branş/eğitim/bölüm/track GET'ten gelir
 *   (GET /api/flexos/{branches, educations?branchId, sections?educationId, tracks?educationId}).
 *   structure==="sectioned" → "Track Bazlı" satış modeli açık; "single" → Full Paket kilitli.
 * EKSİK (sonraki etap): Sale yazma yolu (createSale + POST) + ödeme + sözleşme havuzu.
 *   "Paket" (bundle eğitim) ve kampanya henüz statik/devre dışı — katalogda paket entity yok.
 */

import React, { useEffect, useState, useCallback, useMemo, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import { formatTrPhone } from "@/app/lib/phone";
import FlexSidebar from "../../_components/FlexSidebar";

// ── Katalog API tipleri (GET /api/flexos/{branches,educations,sections,tracks}) ──
interface BranchDoc { id: string; name: string; order?: number }
interface EducationDoc {
  id: string; name: string; branchId: string;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned"; // sectioned → Track Bazlı satışa müsait
  outline?: string[];
  listPrice?: number; onSale?: boolean;
}
interface SectionDoc { id: string; educationId: string; name: string; order: number; hours?: number; listPrice?: number; sellable?: boolean }
interface TrackDoc { id: string; educationId: string; sectionId?: string; name: string; order: number; hours?: number; listPrice?: number; sellable?: boolean }

const TODAY = new Date(2026, 5, 19); // 19 Haziran 2026 — tasarım referans tarihi
function ageFrom(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  let age = TODAY.getFullYear() - d.getFullYear();
  const m = TODAY.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && TODAY.getDate() < d.getDate())) age--;
  return age;
}

type Step = "genel" | "egitim";
type Uyruk = "TC" | "Yabanci";

export default function SatisYapPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

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
  // track bazlı seçim: trackId → seçili mi (varsayılan true = hepsi dahil)
  const [trackSel, setTrackSel] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // ── katalog verisi (GET'ten) ──
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [educations, setEducations] = useState<EducationDoc[]>([]);
  const [sections, setSections] = useState<SectionDoc[]>([]);
  const [tracks, setTracks] = useState<TrackDoc[]>([]);
  const [loadingEdu, setLoadingEdu] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  // auth + branşları yükle
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      try {
        const res = await fetch("/api/flexos/branches", { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setBranches(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Branşlar yüklenemedi.");
      }
    })();
    return () => ac.abort();
  }, [router, authHeaders]);

  // branş seçilince → o branşın eğitimleri
  useEffect(() => {
    if (!authed || !brans) { setEducations([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingEdu(true);
      try {
        const res = await fetch(`/api/flexos/educations?branchId=${encodeURIComponent(brans)}`, { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setEducations(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Eğitimler yüklenemedi.");
      } finally {
        if (!ac.signal.aborted) setLoadingEdu(false);
      }
    })();
    return () => ac.abort();
  }, [authed, brans, authHeaders]);

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
  }, [egitim, authHeaders]);

  // branş değişince eğitim + seçimleri sıfırla
  const onBransChange = (id: string) => { setBrans(id); setEgitim(""); setSections([]); setTracks([]); setTrackSel({}); setSatisModeli("full"); };
  const onEgitimChange = (id: string) => { setEgitim(id); setTrackSel({}); setSatisModeli("full"); };

  // ── türetilmiş değerler ──
  const isTc = uyruk === "TC";
  const isYabanci = uyruk === "Yabanci";
  const age = ageFrom(dogumTarihi);
  const isMinor = age !== null && age >= 0 && age < 18;

  const isGenel = step === "genel";
  const isEgitim = step === "egitim";

  const hicSecimYok = !egitim;
  const showIcerik = !!egitim;

  const selEdu = educations.find((e) => e.id === egitim);
  const trackBased = selEdu?.structure === "sectioned";
  // Satış Modeli yalnızca bölümlü (sectioned) eğitimde seçilebilir; aksi halde Full Paket'e kilitli
  const modelLocked = !egitim || !trackBased;
  const effModel: "full" | "track" = modelLocked ? "full" : satisModeli;
  const showTrackTree = trackBased && effModel === "track";

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

  const onNext = () => {
    if (step === "genel") { setStep("egitim"); return; }
    // egitim sekmesinde → kaydet
    onSave();
  };

  const onSave = async () => {
    // ── validasyon ──
    if (!ad.trim() || !soyad.trim()) { toast.error("Ad ve soyad zorunludur."); setStep("genel"); return; }
    if (!egitim) { toast.error("Lütfen eğitim seçin."); setStep("egitim"); return; }

    // track bazlı → seçili track id'leri
    const selectedTrackIds = showTrackTree
      ? treeTracks.filter((t) => trackOn(t.id)).map((t) => t.id)
      : undefined;

    if (showTrackTree && (!selectedTrackIds || selectedTrackIds.length === 0)) {
      toast.error("En az bir track seçmelisiniz."); return;
    }

    // cinsiyet → domain Gender
    const genderMap: Record<string, string> = { "Kadın": "female", "Erkek": "male", "Belirtmek istemiyorum": "other" };
    const gender = cinsiyet ? genderMap[cinsiyet] || undefined : undefined;

    // PII bloğu
    const idType = isTc ? "tc" as const : "passport" as const;
    const idNo = isTc ? tcNo.trim() : pasaportNo.trim();
    const pii: Record<string, string> = {};
    if (idNo) { pii.idType = idType; pii.idNo = idNo; }
    if (telefon.trim()) pii.phone = telefon.trim();
    if (eposta.trim()) pii.email = eposta.trim();
    if (adres.trim()) pii.address = adres.trim();

    // guardian (18 altı)
    const guardian = isMinor && veliAd.trim()
      ? { name: veliAd.trim(), idNo: veliTc.trim() || undefined }
      : undefined;

    // satış tipi map
    const saleTypeMap: Record<string, string> = { "Yeni Satış": "new_sale", "Tekrar Öğrencisi": "repeat", "Sınıf Değişimi": "transfer" };

    const body = {
      firstName: ad.trim(),
      lastName: soyad.trim(),
      birthDate: dogumTarihi || undefined,
      gender,
      pii: Object.keys(pii).length > 0 ? pii : undefined,
      type: saleTypeMap[satisNedeni] || "new_sale",
      customerType: satisTipi === "Kurumsal" ? "corporate" : "individual",
      educationId: egitim,
      trackIds: selectedTrackIds,
      guardian,
    };

    setSaving(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/flexos/sales", { method: "POST", headers, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Satış kaydedilemedi."); return; }
      toast.success("Satış başarıyla kaydedildi!");
      router.push("/flexos/ogrenciler/havuz");
    } catch {
      toast.error("Sunucu hatası — satış kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="sy-spin" />
        <style>{spinCss}</style>
      </div>
    );
  }

  const segOn = S.segOn, segOff = S.segOff;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="satis-yap" />

      <main className="sy-main" style={S.main}>
        {/* header */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <div style={S.headerIcon} dangerouslySetInnerHTML={{ __html: IC.shoppingBag }} />
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#0f1f3d" }}>Satış Yap</h1>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Yeni öğrenci kaydı oluşturun.</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <button className="sy-iconbtn" style={S.bellBtn} onClick={() => toast.info("Bu özellik yakında.")}>
                <span dangerouslySetInnerHTML={{ __html: IC.bell }} />
                <span style={S.bellDot} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #e2e8f1" }}>
                <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f1f3d" }}>Alparslan Şentürk</div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>Yönetici · Eğitmen</div>
                </div>
                <div style={S.avatar}>AŞ</div>
              </div>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 1920, margin: "0 auto", padding: "26px 36px 64px" }}>

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
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "13px 16px", fontSize: 14.5, fontWeight: 600, color: "#b3bdcc", borderBottom: "2.5px solid transparent", marginBottom: -1, whiteSpace: "nowrap", cursor: "not-allowed" }}>
              <span style={{ ...tabNum(false), color: "#a9b4c4" }}>3</span>
              Ödeme
              <span style={{ marginLeft: 2 }} dangerouslySetInnerHTML={{ __html: IC.lockSm }} />
            </div>
          </div>

          {/* CARD */}
          <div style={S.card}>
            <div style={{ padding: "30px 32px 40px" }}>

              {/* ===== TAB 1: GENEL BİLGİLER ===== */}
              {isGenel && (
                <>
                  <SectionTitle>Kişisel Bilgiler</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 26 }}>
                    <div>
                      <Label>Adı</Label>
                      <input type="text" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Örn: Ayşe" style={S.input} />
                    </div>
                    <div>
                      <Label>Soyadı</Label>
                      <input type="text" value={soyad} onChange={(e) => setSoyad(e.target.value)} placeholder="Örn: Yılmaz" style={S.input} />
                    </div>
                    <div>
                      <Label>Doğum Tarihi</Label>
                      <input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)} style={S.input} />
                    </div>
                    <div>
                      <Label>Cinsiyet</Label>
                      <SelectWrap>
                        <select value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value)} style={S.select}>
                          <option value="">Seçiniz</option>
                          <option value="Kadın">Kadın</option>
                          <option value="Erkek">Erkek</option>
                          <option value="Belirtmek istemiyorum">Belirtmek istemiyorum</option>
                        </select>
                      </SelectWrap>
                    </div>
                  </div>

                  <SectionTitle>Uyruk &amp; Kimlik</SectionTitle>
                  <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                    <div onClick={() => setUyruk("TC")} style={uyrukCard(isTc)}>
                      <span style={uyrukRadio(isTc)}>{isTc && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4f46e5" }} />}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>T.C. Vatandaşı</span>
                    </div>
                    <div onClick={() => setUyruk("Yabanci")} style={uyrukCard(isYabanci)}>
                      <span style={uyrukRadio(isYabanci)}>{isYabanci && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4f46e5" }} />}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Yabancı Uyruklu</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 26 }}>
                    <div style={{ opacity: isTc ? 1 : 0.5 }}>
                      <Label withLock={isYabanci}>T.C. Kimlik No</Label>
                      <input type="text" maxLength={11} value={tcNo} onChange={(e) => setTcNo(e.target.value)} disabled={isYabanci} placeholder="11 haneli kimlik no"
                        style={{ ...S.input, background: isTc ? "#f8fafc" : "#f1f5f9", cursor: isTc ? "text" : "not-allowed" }} />
                    </div>
                    <div style={{ opacity: isYabanci ? 1 : 0.5 }}>
                      <Label withLock={isTc}>Pasaport No</Label>
                      <input type="text" value={pasaportNo} onChange={(e) => setPasaportNo(e.target.value)} disabled={isTc} placeholder="Pasaport numarası"
                        style={{ ...S.input, background: isYabanci ? "#f8fafc" : "#f1f5f9", cursor: isYabanci ? "text" : "not-allowed" }} />
                    </div>
                  </div>

                  {/* 18 yaş altı — öğrenci adı listeye gider; sözleşme veli adına (framer-motion açılır/kapanır) */}
                  <AnimatePresence initial={false}>
                    {isMinor && (
                      <motion.div
                        key="minor-card"
                        initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                        animate={{ height: "auto", opacity: 1, marginBottom: 26 }}
                        exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={S.minorCard}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
                            <span style={S.minorIcon} dangerouslySetInnerHTML={{ __html: IC.alert }} />
                            <div style={{ fontSize: 14.5, fontWeight: 800, color: "#9a3412" }}>18 Yaş Altı — Veli Sözleşmesi</div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
                            <div>
                              <Label>Veli Adı Soyadı</Label>
                              <input type="text" value={veliAd} onChange={(e) => setVeliAd(e.target.value)} placeholder="Sözleşmeyi imzalayan veli" style={S.inputWarn} />
                            </div>
                            <div>
                              <Label>Veli T.C. Kimlik No</Label>
                              <input type="text" maxLength={11} value={veliTc} onChange={(e) => setVeliTc(e.target.value)} placeholder="11 haneli kimlik no" style={S.inputWarn} />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <SectionTitle>İletişim &amp; Durum</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 26 }}>
                    <div>
                      <Label>Telefon No</Label>
                      <input type="tel" inputMode="tel" value={telefon} onChange={(e) => setTelefon(formatTrPhone(e.target.value))} placeholder="0 (5__) ___ __ __" style={S.input} />
                    </div>
                    <div>
                      <Label>E-Posta Adresi</Label>
                      <input type="email" value={eposta} onChange={(e) => setEposta(e.target.value)} placeholder="ornek@eposta.com" style={S.input} />
                    </div>
                    <div>
                      <Label>Çalışma Durumu</Label>
                      <SelectWrap>
                        <select value={calismaDurumu} onChange={(e) => setCalismaDurumu(e.target.value)} style={S.select}>
                          <option value="">Seçiniz</option>
                          <option value="Öğrenci">Öğrenci</option>
                          <option value="Çalışıyor">Çalışıyor</option>
                          <option value="Çalışmıyor">Çalışmıyor</option>
                          <option value="Serbest Meslek">Serbest Meslek</option>
                        </select>
                      </SelectWrap>
                    </div>
                  </div>

                  <SectionTitle>Adres</SectionTitle>
                  <div>
                    <Label>Açık Adres</Label>
                    <textarea value={adres} onChange={(e) => setAdres(e.target.value)} rows={3} placeholder="Mahalle, cadde, sokak, no, ilçe / il…" style={S.textarea} />
                  </div>
                </>
              )}

              {/* ===== TAB 2: EĞİTİM ===== */}
              {isEgitim && (
                <>
                  <SectionTitle>Eğitim &amp; Kampanya</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
                    <div>
                      <Label>Branş</Label>
                      <SelectWrap small>
                        <select value={brans} onChange={(e) => onBransChange(e.target.value)} style={S.selectSm}>
                          <option value="">Branş Seçin</option>
                          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </SelectWrap>
                    </div>
                    <div style={{ opacity: !brans ? 0.5 : 1 }}>
                      <Label withLock={!brans}>Eğitim</Label>
                      <SelectWrap small>
                        <select value={egitim} onChange={(e) => onEgitimChange(e.target.value)} disabled={!brans || loadingEdu}
                          style={{ ...S.selectSm, fontSize: 13, background: !brans ? "#f1f5f9" : "#f8fafc", cursor: !brans ? "not-allowed" : "pointer" }}>
                          <option value="">{loadingEdu ? "Yükleniyor…" : educations.length ? "Eğitim Seçin" : "Bu branşta eğitim yok"}</option>
                          {educations.map((ed) => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                        </select>
                      </SelectWrap>
                    </div>
                    <div>
                      <Label>Kampanya</Label>
                      <SelectWrap small>
                        <select value={kampanya} onChange={(e) => setKampanya(e.target.value)} style={S.selectSm}>
                          <option value="">Kampanya Seçin</option>
                          <option value="ind20">2. Eğitime %20 İndirim</option>
                          <option value="yok">Kampanya Yok</option>
                          <option value="erken">Erken Kayıt — %15 İndirim</option>
                          <option value="referans">Referans İndirimi — %10</option>
                        </select>
                      </SelectWrap>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, maxWidth: 580 }}>
                    <div>
                      <Label>Satış Tipi</Label>
                      <SelectWrap small>
                        <select value={satisNedeni} onChange={(e) => setSatisNedeni(e.target.value)} style={S.selectSm}>
                          <option value="Yeni Satış">Yeni Satış</option>
                          <option value="Tekrar Öğrencisi">Tekrar Öğrencisi</option>
                          <option value="Sınıf Değişimi">Sınıf Değişimi</option>
                        </select>
                      </SelectWrap>
                    </div>
                    <div style={{ opacity: modelLocked ? 0.6 : 1 }}>
                      <Label withLock={modelLocked}>Satış Modeli</Label>
                      <SelectWrap small>
                        <select value={effModel} onChange={(e) => setSatisModeli(e.target.value as "full" | "track")} disabled={modelLocked}
                          style={{ ...S.selectSm, background: modelLocked ? "#f1f5f9" : "#f8fafc", cursor: modelLocked ? "not-allowed" : "pointer" }}>
                          <option value="full">Full Paket</option>
                          <option value="track">Track Bazlı</option>
                        </select>
                      </SelectWrap>
                    </div>
                  </div>

                  {/* Empty state */}
                  {hicSecimYok && (
                    <div style={S.emptyBox}>
                      <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.boxBig }} />
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155" }}>Henüz eğitim seçilmedi</div>
                      <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 320 }}>Önce branş, ardından eğitim seçtiğinizde içerik ve kapsam burada görüntülenir.</div>
                    </div>
                  )}

                  {/* Track ağacı yükleniyor */}
                  {showTrackTree && loadingTree && (
                    <div style={{ ...S.emptyBox, padding: "36px 20px" }}>
                      <div className="sy-spin" />
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>İçerik yükleniyor…</div>
                    </div>
                  )}

                  {/* Track Bazlı seçim ağacı — bölümler + trackler tek tek (lacivert checkbox) */}
                  {showTrackTree && !loadingTree && tree.length > 0 && (
                    <div style={{ border: "1px solid #e9edf4", borderRadius: 16, overflow: "hidden", marginBottom: 16, animation: "sy-slide .25s ease" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 20px", background: "linear-gradient(135deg,#f4f7ff,#eef2ff)", borderBottom: "1px solid #e4e9f7" }}>
                        <span style={{ ...S.boxIcon, background: "#dbe3ff", color: "#1e3a8a" }} dangerouslySetInnerHTML={{ __html: IC.layers }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f1f3d" }}>Bölüm &amp; Track Seçimi</div>
                          <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>Kursiyere satılacak bölümleri ve track&apos;leri tek tek seçin.</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a", background: "#dbe3ff", padding: "4px 11px", borderRadius: 999 }}>{selTrackCount} track · {selTrackSaat} saat</span>
                      </div>
                      <div style={{ padding: "12px 20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                        {tree.map((node) => {
                          const ids = node.tracks.map((t) => t.id);
                          const allOn = allOnOf(ids);
                          const someOn = someOnOf(ids);
                          return (
                            <div key={node.sec.id}>
                              {/* Bölüm satırı */}
                              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 11, background: someOn ? "#f5f7ff" : "#f8fafc", border: "1px solid #e9edf4" }}>
                                <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", border: "1px solid #e6eaf1", color: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }} dangerouslySetInnerHTML={{ __html: IC.folderSm }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>{node.sec.name}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{node.tracks.length} track{node.sec.hours ? ` · ${node.sec.hours} saat` : ""}</div>
                                </div>
                                {ids.length > 0 && (
                                  <span onClick={() => setManyTracks(ids, !allOn)} style={navyBox(allOn, someOn && !allOn)}>
                                    {allOn ? <span dangerouslySetInnerHTML={{ __html: IC.check }} /> : someOn ? <span style={{ width: 10, height: 2.5, borderRadius: 2, background: "#fff" }} /> : null}
                                  </span>
                                )}
                              </div>
                              {/* Track satırları */}
                              {node.tracks.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "4px 0 0 14px", paddingLeft: 14, borderLeft: "1px solid #e9edf4" }}>
                                  {node.tracks.map((t) => {
                                    const on = trackOn(t.id);
                                    return (
                                      <div key={t.id} onClick={() => toggleTrack(t.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, cursor: "pointer", userSelect: "none", background: on ? "#f8faff" : "transparent", transition: "background .14s" }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>{t.name}</div>
                                        </div>
                                        {t.hours ? <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "3px 9px", borderRadius: 8, flex: "0 0 auto" }}>{t.hours} saat</span> : null}
                                        <span style={navyBox(on, false)}>{on && <span dangerouslySetInnerHTML={{ __html: IC.check }} />}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Eğitim İçeriği */}
                  {showIcerik && !showTrackTree && (
                    <div style={{ border: "1px solid #e9edf4", borderRadius: 16, overflow: "hidden", marginBottom: 2, animation: "sy-slide .25s ease" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 20px", background: "linear-gradient(135deg,#fffaf4,#fff5ec)", borderBottom: "1px solid #f3e8da" }}>
                        <span style={{ ...S.boxIcon, background: "#ffedd5", color: "#c2410c" }} dangerouslySetInnerHTML={{ __html: IC.bookSm }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f1f3d" }}>Eğitim İçeriği</div>
                          <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>{icerikBaslik}</div>
                        </div>
                      </div>
                      <div style={{ padding: "18px 20px 20px" }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                          {fullHours > 0 && <span style={S.chip}><span dangerouslySetInnerHTML={{ __html: IC.clock }} />{fullHours} saat</span>}
                          <span style={S.chip}><span dangerouslySetInnerHTML={{ __html: IC.signal }} />{trackBased ? "Bölümlü Eğitim" : "Tek Eğitim"}</span>
                          <span style={{ ...S.chip, color: "#15803d", background: "#dcfce7" }}><span dangerouslySetInnerHTML={{ __html: IC.awardGreen }} />Sertifikalı</span>
                        </div>
                        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#475569", lineHeight: 1.65 }}>{icerikOzet}</p>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>{trackBased ? "BÖLÜMLER" : "PROGRAM İÇERİĞİ"}</div>
                        {programItems.length === 0 ? (
                          <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, padding: "4px 2px" }}>Bu eğitim için içerik bilgisi henüz girilmemiş.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {programItems.map((m) => (
                              <div key={m.no} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 12 }}>
                                <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", border: "1px solid #e6eaf1", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, flex: "0 0 auto" }}>{m.no}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>{m.name}</div>
                                  {m.topics && <div style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>{m.topics}</div>}
                                </div>
                                {m.sure && <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "4px 10px", borderRadius: 8, flex: "0 0 auto" }}>{m.sure}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "32px", borderTop: "1px solid #eef1f6", background: "#fafbfd" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {isEgitim && (
                  <button className="sy-back" style={S.backLink} onClick={() => setStep("genel")}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
                    Geri
                  </button>
                )}
                <span style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500 }}>
                  {isEgitim ? "Satış kapsamını onaylayıp kaydı tamamlayın." : "Kişisel bilgileri tamamlayıp sonraki adıma geçin."}
                </span>
              </div>
              <button className="sy-next" style={{ ...S.nextBtn, opacity: saving ? 0.7 : 1, pointerEvents: saving ? "none" : "auto" }} onClick={onNext} disabled={saving}>
                {saving ? "Kaydediliyor…" : isEgitim ? "Satışı Kaydet" : "Devam Et — Eğitim"}
                {!saving && <span dangerouslySetInnerHTML={{ __html: isEgitim ? IC.checkWhite : IC.arrowRight }} />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── küçük yardımcı bileşenler ──────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
      <span style={{ width: 5, height: 18, borderRadius: 3, background: "#f97316" }} />
      <span style={{ fontSize: 15, fontWeight: 800, color: "#0f1f3d" }}>{children}</span>
    </div>
  );
}
function Label({ children, withLock }: { children: React.ReactNode; withLock?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
      {children}
      {withLock && <span dangerouslySetInnerHTML={{ __html: IC.lockTiny }} />}
    </label>
  );
}
function SelectWrap({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div style={{ position: "relative" }}>
      {children}
      <span style={{ position: "absolute", right: small ? 13 : 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.chevDownGray }} />
    </div>
  );
}

const tabStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer",
  fontFamily: "inherit", fontSize: 14.5, fontWeight: active ? 700 : 600, color: active ? "#0f1f3d" : "#64748b",
  borderBottom: active ? "2.5px solid #f97316" : "2.5px solid transparent", marginBottom: -1, whiteSpace: "nowrap", transition: "color .14s",
});
const tabNum = (active: boolean): CSSProperties => ({
  width: 22, height: 22, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, fontWeight: 700, color: active ? "#fff" : "#94a3b8", background: active ? "#f97316" : "#eef2f8",
});
const uyrukCard = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 11, padding: "12px 18px", borderRadius: 12, cursor: "pointer", userSelect: "none",
  border: active ? "1.5px solid #4f46e5" : "1.5px solid #e3e8f0", background: active ? "#f5f6ff" : "#f8fafc", transition: "all .14s",
});
const uyrukRadio = (active: boolean): CSSProperties => ({
  width: 19, height: 19, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
  border: active ? "1.5px solid #4f46e5" : "1.5px solid #cbd5e1", background: "#fff",
});
// lacivert (navy) checkbox — on=tam dolu, indet=yarım (bazı trackler seçili)
const navyBox = (on: boolean, indet: boolean): CSSProperties => ({
  width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", cursor: "pointer",
  border: on || indet ? "1.5px solid #1e3a8a" : "1.5px solid #cbd5e1",
  background: on || indet ? "#1e3a8a" : "#fff", transition: "all .14s",
});

// ── stiller ────────────────────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif", background: "#eef2f8" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #e2e8f1", boxShadow: "0 2px 6px rgba(15,31,61,.04)" },
  headerInner: { maxWidth: 1920, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  segWrap: { display: "inline-flex", background: "#fff", border: "1px solid #e3e8f0", borderRadius: 13, padding: 5, gap: 5, boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  segOn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#0f1f3d", color: "#fff", boxShadow: "0 4px 10px -5px rgba(15,31,61,.6)" },
  segOff: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "transparent", color: "#64748b" },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", overflow: "hidden" },
  input: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  inputWarn: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px solid #fcd9b6", background: "#fff", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  select: { width: "100%", padding: "12px 42px 12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selectSm: { width: "100%", padding: "12px 34px 12px 13px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  textarea: { width: "100%", padding: "13px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", resize: "vertical", lineHeight: 1.6 },
  minorCard: { border: "1px solid #fcd9b6", background: "linear-gradient(135deg,#fffbf5,#fff7ed)", borderRadius: 16, padding: "20px 22px" },
  minorIcon: { width: 34, height: 34, borderRadius: 10, background: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  emptyBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 11, padding: "46px 20px", textAlign: "center", border: "1.5px dashed #d8e0ec", borderRadius: 16 },
  emptyIcon: { width: 50, height: 50, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  boxIcon: { width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  chip: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "7px 13px", borderRadius: 10 },
  backLink: { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 6px", border: "none", background: "transparent", color: "#64748b", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  nextBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#fb923c,#ea580c)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -7px rgba(234,88,12,.7)" },
};

// ── ikonlar (lucide, design'dan) ────────────────────────────────────────────────
const sv = (inner: string, attrs = 'width="19" height="19" stroke="currentColor"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  shoppingBag: sv('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>', 'width="23" height="23" stroke="#fff" stroke-width="2"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20" stroke="currentColor"'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>', 'width="17" height="17" stroke="currentColor"'),
  building: sv('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/>', 'width="17" height="17" stroke="currentColor"'),
  lockSm: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="13" height="13" stroke="currentColor" stroke-width="2.2"'),
  lockTiny: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="12" height="12" stroke="#94a3b8" stroke-width="2.3"'),
  chevDownGray: sv('<path d="m6 9 6 6 6-6"/>', 'width="17" height="17" stroke="#94a3b8" stroke-width="2.3"'),
  alert: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 'width="18" height="18" stroke="currentColor"'),
  box: sv('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>', 'width="18" height="18" stroke="currentColor"'),
  boxBig: sv('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>', 'width="24" height="24" stroke="currentColor" stroke-width="1.8"'),
  bookSm: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>', 'width="18" height="18" stroke="currentColor"'),
  layers: sv('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>', 'width="18" height="18" stroke="currentColor"'),
  folderSm: sv('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>', 'width="16" height="16" stroke="currentColor"'),
  check: sv('<path d="M20 6 9 17l-5-5"/>', 'width="13" height="13" stroke="#fff" stroke-width="3.2"'),
  clock: sv('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 'width="14" height="14" stroke="#64748b" stroke-width="2.2"'),
  signal: sv('<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>', 'width="14" height="14" stroke="#64748b" stroke-width="2.2"'),
  awardGreen: sv('<path d="M15.477 12.89 17 21l-5-3-5 3 1.523-8.11"/><circle cx="12" cy="8" r="6"/>', 'width="14" height="14" stroke="#16a34a" stroke-width="2.2"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="15" height="15" stroke="currentColor" stroke-width="2.3"'),
  arrowRight: sv('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.3"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.5"'),
};

const spinCss = `.sy-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:sy-spin 1s linear infinite}@keyframes sy-spin{to{transform:rotate(360deg)}}`;
const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes sy-slide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.sy-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:sy-spin 1s linear infinite}@keyframes sy-spin{to{transform:rotate(360deg)}}
.sy-main{scrollbar-gutter:stable}
.sy-tabs{scrollbar-width:none;-ms-overflow-style:none}
.sy-tabs::-webkit-scrollbar{display:none}
.sy-iconbtn:hover{background:#f8fafc;color:#0f172a}
.sy-back:hover{color:#0f1f3d}
.sy-next:hover{filter:brightness(1.04)}
input:focus,select:focus,textarea:focus{border-color:#a5b4fc!important;background:#fff!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
`;
