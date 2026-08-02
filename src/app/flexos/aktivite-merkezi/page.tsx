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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../_components/FlexSpinner";
import { FLEX_MESSAGES } from "@/app/lib/messages";
import { useRealtimeSync } from "../_shared/useRealtimeSync";
import { useOfficeFilterDefault } from "../_shared/useOfficeFilterDefault";
import { authHeadersJson, authHeaders } from "@/app/lib/client/auth-headers";
import {
  AktiviteRow, COMPLETED_TO_SONRAKI, DraftBundle, DurumKey, EMPTY_DRAFT, EMPTY_EKLE, EkleForm, GONDERILECEK, PAGE_SIZE, SONRAKI, SONRAKI_DURUM, SORUMLU_LIST,
} from "./_shared/types";
import {
  CLOSED_DURUMS, CaseApiItem, DURUM_TO_CASESTATUS, KANAL_TO_CHANNEL, SONRAKI_TO_ACTTYPE, caseToRow,
} from "./_shared/caseAdapter";
import { CSS, FONT } from "./_shared/ui";
import { FilterBar } from "./_shared/FilterBar";
import { ActivityRow } from "./_shared/ActivityRow";
import { Pagination } from "./_shared/Pagination";
import { EkleModal } from "./_shared/EkleModal";

export default function AktiviteMerkeziPage() {
  const [ready, setReady]           = useState(false);
  const [backendActs, setBackendActs] = useState<AktiviteRow[]>([]);   // flexos_cases — TEK veri kaynağı
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [meName, setMeName] = useState("Ben");                          // giriş yapan kullanıcı adı

  const loadBackend = useCallback(async () => {
    try {
      const u = auth.currentUser;
      const meUid = u?.uid;
      const me = u?.displayName || u?.email || "Ben";
      const res = await fetch("/api/flexos/cases", { headers: await authHeadersJson() });
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
  }, []);

  // Sahte demo veri (flexos_prospects) kaldırıldı (2026-07-22) — TEK kaynak backend.
  // `expand`/`saveAct` id ile satır aradığı için `allActs` bu ikisinden ÖNCE tanımlı olmalı.
  const allActs = useMemo(
    () => [...backendActs].sort((a, b) => b.id - a.id),
    [backendActs],
  );

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

  // useCallback: ActivityRow'lara sabit referansla geçiyor (React.memo'nun işe yaraması için).
  const onSonrakiTipChange = useCallback((v: string) => {
    setDraftSonrakiTip(v); setDraftGonderildi(false); setDurumError(false); setShakeDropdown(false);
  }, []);
  const onCancel = useCallback(() => setExpandedId(null), []);

  // filters
  const [fKanal,   setFKanal]   = useState("Tümü");
  const [fTip,     setFTip]     = useState("Tümü");
  const [fDurum,   setFDurum]   = useState("Tümü");
  const [fSorumlu, setFSorumlu] = useState("Tümü");
  // Şube filtresi (2026-08-01 kullanıcı isteği — Satış Listesi/Öğrenci Havuzu/Sınıflar'daki
  // AYNI desen, bkz. `useOfficeFilterDefault`): açılışta sorumlunun kendi şubesi ön-seçili
  // gelir (rolü `defaultAllBranches` ise "Tümü"), serbestçe değiştirilebilir.
  const { subeFilter: fSube, setSubeFilter: setFSube } = useOfficeFilterDefault({ allValue: "Tümü" });
  const [subeList, setSubeList] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/flexos/branch-offices", { headers: await authHeaders() });
        const json = res.ok ? await res.json() : { items: [] };
        setSubeList((json.items ?? []).map((o: { name: string }) => o.name));
      } catch { /* sessiz */ }
    })();
  }, []);
  const [openDd,   setOpenDd]   = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);

  // "Diğer Aktiviteler" accordion (expand panel içinde)
  const [digerOpenId,  setDigerOpenId]  = useState<number | null>(null);
  // "Geçmiş Aksiyonlar" accordion — varsayılan kapalı
  const [gecmisOpenId, setGecmisOpenId] = useState<number | null>(null);
  const onToggleDiger = useCallback((id: number) => setDigerOpenId(cur => cur === id ? null : id), []);
  const onToggleGecmis = useCallback((id: number) => setGecmisOpenId(cur => cur === id ? null : id), []);

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

  // id ile çalışır (obje değil) — ActivityRow'a sabit referansla geçebilmek için
  // (bkz. DraftBundle notu). Aksi halde her satırın .map içinde `() => expand(a)` gibi
  // sarmalanması gerekirdi, bu da React.memo'yu her render'da geçersiz kılardı.
  const expand = useCallback((id: number) => {
    const a = allActs.find((x) => x.id === id);
    if (!a) return;
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
  }, [allActs, expandedId, meName]);

  const onBadgeClick = useCallback((id: number) => {
    if (expandedId !== id) expand(id);
    setDigerOpenId(cur => cur === id ? null : id);
  }, [expandedId, expand]);

  const saveAct = useCallback(async (id: number) => {
    const a = allActs.find((x) => x.id === id);
    if (!a) return;
    if (!draftSonrakiTip) { setDurumError(true); setShakeDropdown(true); return; }
    const dtEnabled = draftSonrakiTip === "Randevu Oluşturulacak";
    const nextDate  = (dtEnabled && draftTarih)
      ? new Date(`${draftTarih}T${draftSaat || "00:00"}`).toISOString()
      : undefined;
    // Randevu Takvimi'ndeki AYNI kural (mesai saati 09:00-19:00 + geçmiş tarih engeli) —
    // buradan oluşan randevu da AYNI `flexos_appointments` koleksiyonuna yazılıyor.
    if (dtEnabled && nextDate) {
      const d = new Date(nextDate);
      if (d.getTime() < Date.now()) {
        toast.error("Geçmiş bir tarih/saate randevu oluşturulamaz.");
        return;
      }
      if (d.getHours() < 9 || d.getHours() >= 19) {
        toast.error("Randevu saati mesai saatleri (09:00–19:00) dışında olamaz.");
        return;
      }
    }
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
      const patchCase = async (payload: Record<string, unknown>) =>
        fetch(`/api/flexos/cases/${caseId}`, {
          method: "PATCH", headers: await authHeadersJson(), body: JSON.stringify(payload),
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
          headers: await authHeadersJson(),
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
  }, [allActs, draftNote, draftSonrakiTip, draftTarih, draftSaat, draftSorumlu, draftGonderildi, meName, loadBackend]);

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
        headers: await authHeadersJson(),
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
    // Atanmamış talebin (officeName null) şubesi belirlenemez — her şube filtresinde
    // görünmeye devam eder (biri claim edene kadar hiçbir şubeye kilitlenmemeli).
    if (fSube    !== "Tümü") r = r.filter(a => !a.officeName || a.officeName === fSube);
    return r;
  }, [allActs, fKanal, fTip, fDurum, fSorumlu, fSube]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  // useMemo: ActivityRow'lara stabil `a` referansları geçmek için (React.memo'nun işe
  // yaraması, filtre/sayfa değişmediği sürece dizi referansının da sabit kalmasına bağlı).
  const pageActs = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );
  const anyFilter  = fKanal !== "Tümü" || fTip !== "Tümü" || fDurum !== "Tümü" || fSorumlu !== "Tümü" || fSube !== "Tümü";
  const showDatetime = draftSonrakiTip === "Randevu Oluşturulacak";

  // Genişletilmiş satırın taslak alanları TEK nesnede — bkz. DraftBundle/EMPTY_DRAFT notu
  // (types.ts). Sadece bu nesne genişletilmiş satıra geçer, diğerleri EMPTY_DRAFT alır.
  const draftBundle: DraftBundle = useMemo(() => ({
    note: draftNote, sonrakiTip: draftSonrakiTip, gonderildi: draftGonderildi,
    tarih: draftTarih, saat: draftSaat, sorumlu: draftSorumlu,
    savingAct, savedAct, durumError, shakeDropdown, showDatetime,
  }), [draftNote, draftSonrakiTip, draftGonderildi, draftTarih, draftSaat, draftSorumlu, savingAct, savedAct, durumError, shakeDropdown, showDatetime]);

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

          <FilterBar
            fKanal={fKanal} setFKanal={setFKanal}
            fTip={fTip} setFTip={setFTip}
            fDurum={fDurum} setFDurum={setFDurum}
            fSorumlu={fSorumlu} setFSorumlu={setFSorumlu}
            sorumluList={sorumluList}
            fSube={fSube} setFSube={setFSube}
            subeList={subeList}
            openDd={openDd} setOpenDd={setOpenDd}
            anyFilter={anyFilter}
            onClear={() => { setFKanal("Tümü"); setFTip("Tümü"); setFDurum("Tümü"); setFSorumlu("Tümü"); setFSube("Tümü"); setPage(1); setOpenDd(null); }}
            onPageReset={() => setPage(1)}
            onAddClick={() => { setExpandedId(null); setEkleOpen(true); }}
          />

          {/* ── TABLE ── */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                    <th style={{ padding: "13px 14px", paddingLeft: 22, textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap", width: 40 }}>#</th>
                    <th style={{ padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" }}>Kanal</th>
                    <th style={{ padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" }}>Aktivite Tipi</th>
                    <th style={{ padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" }}>Müşteri</th>
                    <th style={{ padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" }}>Durum</th>
                    <th style={{ padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" }}>Tarih / Saat</th>
                    <th style={{ padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" }}>Sorumlu</th>
                    <th style={{ padding: "13px 14px", textAlign: "right", paddingRight: 22, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap", width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pageActs.map((a, idx) => (
                    <ActivityRow
                      key={a.id}
                      a={a}
                      rowNumber={(safePage - 1) * PAGE_SIZE + idx + 1}
                      expanded={expandedId === a.id}
                      onRowClick={expand}
                      personCount={personCounts[a.iletisim] ?? 1}
                      onBadgeClick={onBadgeClick}
                      allActs={allActs}
                      digerOpen={digerOpenId === a.id}
                      onToggleDiger={onToggleDiger}
                      gecmisOpen={gecmisOpenId === a.id}
                      onToggleGecmis={onToggleGecmis}
                      draft={expandedId === a.id ? draftBundle : EMPTY_DRAFT}
                      setDraftNote={setDraftNote}
                      onSonrakiTipChange={onSonrakiTipChange}
                      setDraftGonderildi={setDraftGonderildi}
                      setDraftTarih={setDraftTarih}
                      setDraftSaat={setDraftSaat}
                      setDraftSorumlu={setDraftSorumlu}
                      dateInputRef={dateInputRef} sorumluList={sorumluList}
                      onCancel={onCancel}
                      onSave={saveAct}
                    />
                  ))}
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
              <Pagination total={filtered.length} safePage={safePage} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        </div>
        <Footer mini containerClassName="w-full max-w-[1560px] mx-auto px-9" />
      </main>

      {/* Dropdown click-away */}
      {openDd && <div onClick={() => setOpenDd(null)} style={{ position: "fixed", inset: 0, zIndex: 15 }} />}

      <EkleModal open={ekleOpen} onClose={() => setEkleOpen(false)} form={ekleForm} setForm={setEkleForm} saving={ekleSaving} onSave={handleEkle} />
    </div>
  );
}
