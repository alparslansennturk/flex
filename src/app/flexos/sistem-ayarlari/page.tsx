"use client";

/**
 * FlexOS · Ayarlar — Kullanıcılar sayfasından taşındı (2026-07-10 kullanıcı kararı:
 * "Sistem Modu, Grup Taşıma Kuralı ve Kişisel Görünüm PIN'i sistem ayarlarının içine
 * taşıyalım"). Sidebar'daki link önceden sadece "yakında" toast'ı gösteriyordu (bkz.
 * FlexSidebar.tsx) — artık gerçek sayfaya gidiyor.
 *
 * 2026-07-24 restructure (kullanıcı isteği — Flex Connect'te sesi kapatmasına rağmen
 * derste genel bildirim zili sesi çalması bug'ından çıktı): sayfa artık 2 ÜST SEVİYE
 * sekmeye ayrıldı — "Sistem Ayarları" (bugünkü TÜM içerik, admin/owner-only) ve
 * "Bildirim Ayarları" (yeni, ses aç/kapa + ton, HERKES görür). Giriş kapısı da buna göre
 * gevşetildi: sayfa artık redirect ATMIYOR, herhangi bir giriş yapmış kullanıcı girebilir
 * — "Sistem Ayarları" sekmesi `canSeeSistemTab` false ise sekme listesinde hiç görünmez.
 *
 * Sistem Modu + Grup Taşıma Kuralı `role.manage` gerektirir (sistemdeki HERKESİ
 * etkiliyorlar). Kişisel Görünüm PIN'i kendi içinde ayrıca gated (`view.toggle`,
 * sadece owner) — `/api/flexos/view-access`'in `canPin` cevabı zaten owner dışında hep
 * false.
 *
 * DÜZELTME (2026-07-25, "çok ciddi hata" — kullanıcı bulgusu): `canSeeSistemTab`
 * ESKİDEN `isAdmin || canPin` idi (2026-07-11'deki "Core moddaki owner PIN ayarına
 * yine erişebilmeli" kararını korumak için) — ama `canPin` owner için MOD FARK
 * ETMEKSİZİN hep true olduğundan (view.toggle her zaman verilir), owner Cmd+Alt+T
 * ile Core/eğitmen moduna geçse bile "Sistem Ayarları"/"Loglar" sekmeleri hâlâ
 * görünüyordu — kullanıcının AÇIK isteği: "eğitmen modda sistem ayarları/loglar
 * olmamalı". Artık SADECE `isAdmin` (gerçek Full-mod role.manage) — Core modda bu
 * iki sekme (PIN kartı dahil) hiç görünmez. "Geliştirici Notları" AYRI ve BİLEREK
 * hâlâ `canPin` ile gated — o owner'a mod FARK ETMEKSİZİN her zaman özel kalmalı
 * (kullanıcının AYNI mesajdaki ikinci isteği).
 */

import React, { useEffect, useState, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader, { FlexPageContent } from "../_components/FlexHeader";
import FlexModal from "../_components/FlexModal";
import Footer from "@/app/components/layout/Footer";
import { ToggleSwitch } from "../kullanicilar/_shared/toggles";
import NotificationSoundSettings from "../_components/NotificationSoundSettings";
import InstallBannerSettings from "../_components/InstallBannerSettings";
import DevNotesPanel from "./_shared/DevNotesPanel";

export default function SistemAyarlariPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [viewAccessLoaded, setViewAccessLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // role.manage — org-geneli kartları gösterir
  const [topTab, setTopTab] = useState<"sistem" | "finansal" | "loglar" | "bildirim" | "gelistirici" | null>(null);

  // ── Sistem Modu (Eğitmen Tek Başına switch) ──
  const [standaloneMode, setStandaloneMode] = useState<boolean | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  const [modeConfirm, setModeConfirm] = useState<boolean | null>(null);

  // ── Grup Taşıma Kuralı (transferRequiresManualSale switch) ──
  const [transferManual, setTransferManual] = useState<boolean | null>(null);
  const [transferManualBusy, setTransferManualBusy] = useState(false);

  // ── Finansal Ayarlar: Günlük Yemek Ücreti (Eğitmen Hakediş, 2026-07-25 kararı) ──
  // Sabit kod DEĞİL — her sene arttığı için burada admin tarafından güncellenebilir.
  const [mealAllowance, setMealAllowance] = useState<number | null>(null);
  const [mealAllowanceInput, setMealAllowanceInput] = useState("");
  const [mealAllowanceBusy, setMealAllowanceBusy] = useState(false);

  // ── Finansal Ayarlar: Core görünümündeki owner'ın KENDİ ders saati ücreti ──
  // (2026-07-25 kararı: Full modda ücret Eğitmenler CRUD'undan admin girer, bu kart
  // sadece Core görünümünde çıkar — ikisi AYNI ANDA hiç görünmez, karşılıklı dışlar.)
  const [canSelfRate, setCanSelfRate] = useState(false);
  const [myRate, setMyRate] = useState<number | null>(null);
  const [myRateInput, setMyRateInput] = useState("");
  const [myRateBusy, setMyRateBusy] = useState(false);

  // ── Kişisel Görünüm PIN'i (Core/Full anahtarı, sadece owner görür) ──
  const [canPin, setCanPin] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const fetchMe = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (signal?.aborted) return;
      const caps = new Set<string>(json.capabilities ?? []);
      // view.toggle sahibi (SADECE VIEW_TOGGLE_OWNER_EMAIL, tek hesap) Core moddayken
      // role.manage'i kaybeder ama sayfayı yine görebilmeli — kendi PIN'ini buradan
      // yönetsin diye (2026-07-11). Görünüm modu değişimi kısayolla (Ctrl/Cmd+Alt+T)
      // yapılıyor, burada AYRICA bir switch YOK (kullanıcı: "gerek yok, kısayol zaten
      // çalışıyor"). Org-geneli kartlar (Sistem Modu, Grup Taşıma) sayfa İÇİNDE ayrıca
      // `role.manage`'e göre ayrı gated (aşağıda).
      setIsAdmin(caps.has("role.manage"));
      setCanSelfRate(caps.has("trainer.rate.write.self"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") { setIsAdmin(false); setCanSelfRate(false); }
    } finally {
      if (!signal?.aborted) setMeLoaded(true);
    }
  }, []);

  // Kendi ders saati ücretini oku — `trainers/me/earnings`'in `hourlyRate` alanını
  // reuse eder (ayrı bir GET ucu açmaya gerek yok, aynı Trainer dokümanını okuyor).
  const fetchMyRate = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/trainers/me/earnings", { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!res.ok) return;
      const json = await res.json();
      if (signal?.aborted) return;
      const rate = typeof json.hourlyRate === "number" ? json.hourlyRate : 0;
      setMyRate(rate);
      setMyRateInput(String(rate));
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("[sistem-ayarlari] kendi ücret yüklenemedi:", e);
    }
  }, []);

  const fetchSettings = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/settings", { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (!signal?.aborted) {
        setStandaloneMode(!!json.standaloneMode);
        setTransferManual(!!json.transferRequiresManualSale);
        const meal = typeof json.dailyMealAllowance === "number" ? json.dailyMealAllowance : 300;
        setMealAllowance(meal);
        setMealAllowanceInput(String(meal));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("[sistem-ayarlari] ayarlar yüklenemedi:", e);
    }
  }, []);

  const fetchViewAccess = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/view-access", { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!res.ok) { if (!signal?.aborted) setCanPin(false); return; }
      const json = await res.json();
      if (signal?.aborted) return;
      setCanPin(true);
      setHasPin(!!json.hasPin);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setCanPin(false);
    } finally {
      if (!signal?.aborted) setViewAccessLoaded(true);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      fetchMe(ac.signal);
      fetchSettings(ac.signal);
      fetchViewAccess(ac.signal);
    })();
    return () => { ac.abort(); };
  }, [router, fetchMe, fetchSettings, fetchViewAccess]);

  useEffect(() => { if (canSelfRate) void fetchMyRate(); }, [canSelfRate, fetchMyRate]);

  const canSeeSistemTab = isAdmin; // Sistem Modu + Grup Taşıma + Loglar (değişmedi)
  // Finansal Ayarlar SEKME olarak iki farklı kitleye açık ama İÇERİĞİ karşılıklı dışlar:
  // Full+admin → sadece Günlük Yemek Ücreti kartı; Core görünümündeki owner → sadece
  // kendi ders saati ücreti kartı. İkisi AYNI ANDA asla görünmez (isAdmin ⇔ !canSelfRate,
  // bkz. auth-actor.ts'teki grant mantığı).
  const canSeeFinansalTab = isAdmin || canSelfRate;
  const activeTopTab = topTab ?? (canSeeSistemTab ? "sistem" : "bildirim");

  const applyStandaloneMode = async (next: boolean) => {
    if (modeBusy) return;
    setModeBusy(true);
    setStandaloneMode(next); // optimistic
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/settings", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ standaloneMode: next }),
      });
      if (!res.ok) throw new Error("patch failed");
      toast.success(next ? "Eğitmen tek başına çalışma modu açıldı." : "Tam sistem moduna dönüldü.");
      // 2026-07-25 kullanıcı bulgusu: sidebar (FlexSidebar.tsx) capability/mod fetch'i
      // SADECE mount'ta çalışıyor — bu switch değişince kendiliğinden yenilenmiyordu,
      // menüler eski kalıyordu. Tam sayfa yenileme EN GARANTİLİ çözüm (FlexSidebar dahil
      // her şey sıfırdan fetch eder) — AYNI URL'e (Sistem Ayarları'nda kalır, Ana Sayfa'ya
      // GİTMEZ). Toast'ın görünmesi için kısa bir gecikme.
      setTimeout(() => window.location.reload(), 400);
    } catch {
      setStandaloneMode(!next); // rollback
      toast.error("Sistem modu güncellenemedi.");
      setModeBusy(false);
    }
  };

  const confirmModeChange = () => {
    if (modeConfirm === null) return;
    const next = modeConfirm;
    setModeConfirm(null);
    applyStandaloneMode(next);
  };

  const applyTransferManual = async (next: boolean) => {
    if (transferManualBusy) return;
    setTransferManualBusy(true);
    setTransferManual(next); // optimistic
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/settings", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transferRequiresManualSale: next }),
      });
      if (!res.ok) throw new Error("patch failed");
      toast.success(next ? "Grup taşıma artık manuel ek satış gerektiriyor." : "Grup taşımada otomatik ek satış moduna dönüldü.");
    } catch {
      setTransferManual(!next); // rollback
      toast.error("Grup taşıma kuralı güncellenemedi.");
    } finally {
      setTransferManualBusy(false);
    }
  };

  const applyMealAllowance = async () => {
    const next = Number(mealAllowanceInput.replace(",", "."));
    if (!Number.isFinite(next) || next < 0) { toast.error("Geçerli bir tutar girin (0 veya üzeri)."); return; }
    if (mealAllowanceBusy) return;
    setMealAllowanceBusy(true);
    const prev = mealAllowance;
    setMealAllowance(next); // optimistic
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/settings", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dailyMealAllowance: next }),
      });
      if (!res.ok) throw new Error("patch failed");
      toast.success("Günlük yemek ücreti güncellendi.");
    } catch {
      setMealAllowance(prev); // rollback
      setMealAllowanceInput(String(prev ?? 300));
      toast.error("Yemek ücreti güncellenemedi.");
    } finally {
      setMealAllowanceBusy(false);
    }
  };

  const applyMyRate = async () => {
    const next = Number(myRateInput.replace(",", "."));
    if (!Number.isFinite(next) || next < 0) { toast.error("Geçerli bir tutar girin (0 veya üzeri)."); return; }
    if (myRateBusy) return;
    setMyRateBusy(true);
    const prev = myRate;
    setMyRate(next); // optimistic
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/trainers/me/rate", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { throw new Error(json.error || "patch failed"); }
      toast.success("Ders saati ücretin güncellendi.");
    } catch (e) {
      setMyRate(prev); // rollback
      setMyRateInput(String(prev ?? 0));
      toast.error(e instanceof Error && e.message !== "patch failed" ? e.message : "Ücret güncellenemedi.");
    } finally {
      setMyRateBusy(false);
    }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(newPin)) { toast.error("Yeni PIN 4 haneli rakam olmalı."); return; }
    if (newPin !== newPin2) { toast.error("Yeni PIN'ler eşleşmiyor."); return; }
    setPinBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/view-access/pin", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "PIN güncellenemedi."); return; }
      toast.success(hasPin ? "PIN değiştirildi." : "PIN oluşturuldu.");
      setNewPin(""); setNewPin2("");
      setHasPin(true);
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setPinBusy(false);
    }
  };

  if (authed === null || !meLoaded || !viewAccessLoaded) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="sistem-ayarlari" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>}
          title="Ayarlar"
          subtitle="Bildirim tercihlerinizi ve — yetkiniz varsa — sistem ayarlarını yönetin."
          maxWidth={1200}
        />

        <FlexPageContent style={{ padding: "28px 36px 56px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
            {canSeeSistemTab && (
              <>
                <TopTabBtn label="Sistem Ayarları" active={activeTopTab === "sistem"} onClick={() => setTopTab("sistem")} />
                <TopTabBtn label="Loglar" active={activeTopTab === "loglar"} onClick={() => setTopTab("loglar")} />
              </>
            )}
            {/* Finansal Ayarlar — canSeeSistemTab'dan BAĞIMSIZ gated: Full+admin VE Core
                görünümündeki owner (canSelfRate) ayrı ayrı erişir, içerik birbirini dışlar. */}
            {canSeeFinansalTab && (
              <TopTabBtn label="Finansal Ayarlar" active={activeTopTab === "finansal"} onClick={() => setTopTab("finansal")} />
            )}
            <TopTabBtn label="Bildirim Ayarları" active={activeTopTab === "bildirim"} onClick={() => setTopTab("bildirim")} />
            {/* Geliştirici Notları (2026-07-25) — SADECE owner (canPin = view.toggle,
                SADECE VIEW_TOGGLE_OWNER_EMAIL) görür, isAdmin'de bile görünmez —
                "normal kullanıcılar kesinlikle görmemeli" kullanıcı isteği. */}
            {canPin && (
              <TopTabBtn label="Geliştirici Notları" active={activeTopTab === "gelistirici"} onClick={() => setTopTab("gelistirici")} />
            )}
          </div>

          {activeTopTab === "bildirim" && (
            <div className="space-y-4">
              <NotificationSoundSettings />
              <InstallBannerSettings />
            </div>
          )}
          {canPin && activeTopTab === "gelistirici" && <DevNotesPanel />}

          {canSeeFinansalTab && activeTopTab === "finansal" && (
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {/* Yan yana 2 ayar, önce Ders Saati Ücreti sonra Yemek Ücreti (2026-07-25
                kullanıcı isteği). Ders Saati Ücreti kartı MOD'DAN BAĞIMSIZ (owner hem
                Full'da hem Core'da görür, `trainer.rate.write.self` kimliğe bağlı).
                Yemek Ücreti kartı SADECE admin'de (`isAdmin`) — kullanıcı bunu Core-mod
                self-manage denemesinden sonra AÇIKÇA geri istedi ("yemek ücreti adminde
                görünecek sadece"), Core modda hiç görünmez/yönetilemez. */}
            {canSelfRate && (
              <div style={{ ...S.card, flex: "1 1 320px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <IconWallet />
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>Eğitmen Hakediş — Ders Saati Ücretin</div>
                    <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2, maxWidth: 460 }}>
                      Yoklama Detay ve Yoklama Raporu&apos;ndaki hak ediş hesabında kullanılır. Sadece sen görürsün.
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="myRateInput" style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>{"Ders Saati Ücreti (TL)"}</label>
                    <input id="myRateInput"
                      type="text" inputMode="decimal" value={myRateInput}
                      onChange={(e) => setMyRateInput(e.target.value.replaceAll(/[^0-9.,]/g, ""))}
                      style={{ ...S.pinInput, width: 130, letterSpacing: "normal", textAlign: "left" as const }}
                    />
                  </div>
                  <button type="button"
                    onClick={applyMyRate}
                    disabled={myRateBusy || myRate === null || myRateInput === String(myRate)}
                    style={{ ...S.addBtn, background: "#B45309", boxShadow: "none", opacity: myRateBusy || myRate === null || myRateInput === String(myRate) ? 0.55 : 1 }}
                  >
                    {myRateBusy ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                </div>
              </div>
            )}
            {isAdmin && (
              <div style={{ ...S.card, flex: "1 1 320px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <IconWallet />
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>Eğitmen Hakediş — Yemek Ücreti</div>
                    <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2, maxWidth: 460 }}>
                      Eğitmen Hakediş hesabında kullanılan günlük yemek ücreti — bir eğitmenin aynı gün 2 farklı grubu olduğunda o güne eklenir. Sabit değildir, her sene güncellenebilir.
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="mealAllowanceInput" style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>{"Günlük Yemek Ücreti (TL)"}</label>
                    <input id="mealAllowanceInput"
                      type="text" inputMode="decimal" value={mealAllowanceInput}
                      onChange={(e) => setMealAllowanceInput(e.target.value.replaceAll(/[^0-9.,]/g, ""))}
                      style={{ ...S.pinInput, width: 130, letterSpacing: "normal", textAlign: "left" as const }}
                    />
                  </div>
                  <button type="button"
                    onClick={applyMealAllowance}
                    disabled={mealAllowanceBusy || mealAllowance === null || mealAllowanceInput === String(mealAllowance)}
                    style={{ ...S.addBtn, background: "#B45309", boxShadow: "none", opacity: mealAllowanceBusy || mealAllowance === null || mealAllowanceInput === String(mealAllowance) ? 0.55 : 1 }}
                  >
                    {mealAllowanceBusy ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {canSeeSistemTab && activeTopTab === "loglar" && (
            <div style={{ ...S.card, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "50px 20px", textAlign: "center" as const }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#414B59" }}>Loglar yakında burada</div>
              <div style={{ fontSize: 13, color: "#8E95A3", maxWidth: 340 }}>Sistem genelindeki kritik işlemlerin (satış, silme, yetki değişikliği) denetim kaydı buraya gelecek.</div>
            </div>
          )}

          {canSeeSistemTab && activeTopTab === "sistem" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {isAdmin && (
            <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: standaloneMode ? "#DCFCE7" : "#EDE9FE", color: standaloneMode ? "#15803D" : "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <IconGraduation />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>Sistem Modu</div>
                  <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2, maxWidth: 460 }}>
                    {standaloneMode === null
                      ? "Yükleniyor…"
                      : standaloneMode
                        ? "Eğitmen Tek Başına — eğitmen kendi grubunu/öğrencisini kendi ekler, Satış/Operasyon devre dışı."
                        : "Tam Sistem — öğrenci ve grup Satış + Operasyon üzerinden beslenir, eğitmen sadece yoklama/not girer."}
                  </div>
                </div>
              </div>
              <SystemModeSegment value={standaloneMode} busy={modeBusy} onChange={(next) => { if (standaloneMode !== null && next !== standaloneMode) setModeConfirm(next); }} />
            </div>
            )}

            {isAdmin && (
            <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: transferManual ? "#FEF3C7" : "#DDE8F8", color: transferManual ? "#B45309" : "#205297", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <IconTransfer />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>Grup Taşıma Kuralı</div>
                  <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2, maxWidth: 460 }}>
                    {transferManual === null
                      ? "Yükleniyor…"
                      : transferManual
                        ? "Manuel Ek Satış — grup taşıma yalnız Satış tarafından ek satışla yapılır."
                        : "Otomatik Ek Satış — Eğitim Op. öğrenciyi doğrudan taşır, sistem arkada 0 TL ek satış açar."}
                  </div>
                </div>
              </div>
              <ToggleSwitch active={!!transferManual} onClick={() => transferManual !== null && applyTransferManual(!transferManual)} />
            </div>
            )}

            {canPin && (
              <div style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EDE9FE", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <IconLock />
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>{"Kişisel Görünüm PIN'i"}</div>
                    <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2 }}>
                      {"Ctrl/Cmd+Alt+T kısayoluyla Eğitmen'den Full'a geçerken sorulan 4 haneli PIN. "}{hasPin ? "Kurulu." : "Henüz kurulmadı."}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="newPin" style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>Yeni PIN</label>
                    <input id="newPin" type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replaceAll(/\D/g, "").slice(0, 4))} style={S.pinInput} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="newPin2" style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>Yeni PIN (Tekrar)</label>
                    <input id="newPin2" type="password" inputMode="numeric" maxLength={4} value={newPin2} onChange={(e) => setNewPin2(e.target.value.replaceAll(/\D/g, "").slice(0, 4))} style={S.pinInput} />
                  </div>
                  <button type="button" onClick={savePin} disabled={pinBusy} style={{ ...S.addBtn, background: "#7C3AED", boxShadow: "none" }}>
                    {pinBusy ? "Kaydediliyor…" : hasPin ? "PIN'i Değiştir" : "PIN Oluştur"}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </FlexPageContent>
        <Footer mini containerClassName="w-full max-w-[1200px] mx-auto px-9" />
      </main>

      <FlexModal
        open={modeConfirm !== null}
        title="Sistem Modunu Değiştir"
        message={
          modeConfirm
            ? <>Eğitmenler <strong>kendi grubunu/öğrencisini kendi ekleyecek</strong>, Satış ve Operasyon devre dışı kalacak. Bu değişiklik sistemdeki HERKESİ etkiler.</>
            : <>Öğrenci ve grup ekleme yeniden <strong>Satış/Operasyon</strong> üzerinden yapılacak, eğitmenler sadece yoklama/not girecek. Bu değişiklik sistemdeki HERKESİ etkiler.</>
        }
        confirmLabel={modeConfirm ? "Evet, Eğitmen Moduna Geç" : "Evet, Tam Sisteme Dön"}
        cancelLabel="Vazgeç"
        tone="primary"
        busy={modeBusy}
        onConfirm={confirmModeChange}
        onCancel={() => !modeBusy && setModeConfirm(null)}
      />
    </div>
  );
}

function TopTabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button"
      onClick={onClick}
      style={{
        padding: "10px 18px",
        borderRadius: 11,
        border: active ? "1px solid #7C3AED" : "1px solid #E2E5EA",
        background: active ? "#F5F3FF" : "#fff",
        color: active ? "#7C3AED" : "#6F7B87",
        fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
        cursor: "pointer", transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

function SystemModeSegment({ value, busy, onChange }: { value: boolean | null; busy: boolean; onChange: (standaloneMode: boolean) => void }) {
  const items: Array<{ key: boolean; label: string }> = [
    { key: false, label: "Tam Sistem" },
    { key: true, label: "Eğitmen Tek Başına" },
  ];
  return (
    <div style={{ display: "inline-flex", padding: 3, borderRadius: 11, background: "#F2F4F7", border: "1px solid #E2E5EA", opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
      {items.map((it) => {
        const selected = value === it.key;
        return (
          <button type="button"
            key={String(it.key)}
            onClick={() => onChange(it.key)}
            disabled={value === null}
            style={{
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: selected ? "#fff" : "transparent",
              color: selected ? (it.key ? "#15803D" : "#7C3AED") : "#8E95A3",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              cursor: value === null ? "default" : "pointer",
              boxShadow: selected ? "0 1px 3px rgba(15,31,61,.12)" : "none",
              transition: "all .15s",
              whiteSpace: "nowrap",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function IconGraduation() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>; }
function IconLock() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function IconTransfer() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>; }
function IconWallet() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>; }

const S: Record<string, CSSProperties> = {
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, padding: "18px 22px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },
  pinInput: { width: 90, padding: "9px 12px", borderRadius: 10, border: "1px solid #E2E5EA", fontSize: 15, letterSpacing: "4px", textAlign: "center" as const, fontFamily: "inherit", outline: "none", color: "#1E222B" },
};
