"use client";

/**
 * FlexOS · Sistem Ayarları — Kullanıcılar sayfasından taşındı (2026-07-10 kullanıcı kararı:
 * "Sistem Modu, Grup Taşıma Kuralı ve Kişisel Görünüm PIN'i sistem ayarlarının içine
 * taşıyalım"). Sidebar'daki "Sistem Ayarları" linki önceden sadece "yakında" toast'ı
 * gösteriyordu (bkz. FlexSidebar.tsx) — artık gerçek sayfaya gidiyor.
 *
 * Tek sayfa, TABSIZ (bilinçli tercih) — şu an sadece 3 kart var, ayrı sekmelere bölmek
 * bu ölçekte gereksiz karmaşıklık; ileride madde sayısı artarsa (bkz. proje hafızası
 * "Sistem Ayarları + Süper Admin" planı) akordiyon/sekmeye bölünebilir.
 *
 * Sistem Modu + Grup Taşıma Kuralı `role.manage` gerektirir (sistemdeki HERKESİ
 * etkiliyorlar) — sayfa girişinde kontrol edilip yetkisizse Kullanıcılar'a geri
 * yönlendirilir. Kişisel Görünüm PIN'i kendi içinde ayrıca gated (`view.toggle`,
 * sadece owner) — `/api/flexos/view-access`'in `canPin` cevabı zaten owner dışında hep false.
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

export default function SistemAyarlariPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"genel" | "loglar">("genel");

  // ── Sistem Modu (Eğitmen Tek Başına switch) ──
  const [standaloneMode, setStandaloneMode] = useState<boolean | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  const [modeConfirm, setModeConfirm] = useState<boolean | null>(null);

  // ── Grup Taşıma Kuralı (transferRequiresManualSale switch) ──
  const [transferManual, setTransferManual] = useState<boolean | null>(null);
  const [transferManualBusy, setTransferManualBusy] = useState(false);

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
      setAllowed(caps.has("role.manage"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAllowed(false);
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

  useEffect(() => {
    if (allowed === false) {
      toast.error("Bu sayfaya erişim yetkiniz yok.");
      router.push("/flexos/kullanicilar");
    }
  }, [allowed, router]);

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
    } catch {
      setStandaloneMode(!next); // rollback
      toast.error("Sistem modu güncellenemedi.");
    } finally {
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

  if (authed === null || allowed !== true) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="sistem-ayarlari" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>}
          title="Sistem Ayarları"
          subtitle="Sisteminizin genel çalışma modunu ve kişisel erişim ayarlarınızı yönetin."
          roleLabel="Yönetici"
          maxWidth={1200}
        />

        <FlexPageContent style={{ padding: "28px 36px 56px" }}>
          <div style={{ display: "flex", gap: 0, marginBottom: 22 }}>
            <SettingsTabBtn label="Genel Ayarlar" active={tab === "genel"} onClick={() => setTab("genel")} />
            <SettingsTabBtn label="Loglar" active={tab === "loglar"} onClick={() => setTab("loglar")} />
          </div>

          {tab === "loglar" && (
            <div style={{ ...S.card, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "50px 20px", textAlign: "center" as const }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#414B59" }}>Loglar yakında burada</div>
              <div style={{ fontSize: 13, color: "#8E95A3", maxWidth: 340 }}>Sistem genelindeki kritik işlemlerin (satış, silme, yetki değişikliği) denetim kaydı buraya gelecek.</div>
            </div>
          )}

          {tab === "genel" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

            {canPin && (
              <div style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EDE9FE", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <IconLock />
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>{"Kişisel Görünüm PIN'i"}</div>
                    <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2 }}>
                      {"Ctrl/Cmd+Alt+M ile Eğitmen görünümünden admin ekranına geçerken sorulan 4 haneli PIN. "}{hasPin ? "Kurulu." : "Henüz kurulmadı."}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>Yeni PIN</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={S.pinInput} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>Yeni PIN (Tekrar)</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={newPin2} onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, "").slice(0, 4))} style={S.pinInput} />
                  </div>
                  <button onClick={savePin} disabled={pinBusy} style={{ ...S.addBtn, background: "#7C3AED", boxShadow: "none" }}>
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

function SettingsTabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: "12px 20px", border: "none", borderBottom: active ? "2.5px solid #7C3AED" : "2.5px solid transparent", background: "transparent", color: active ? "#7C3AED" : "#6F7B87", fontSize: 14, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", transition: "all .15s" }}>
    {label}
  </button>;
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
          <button
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

const S: Record<string, CSSProperties> = {
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, padding: "18px 22px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },
  pinInput: { width: 90, padding: "9px 12px", borderRadius: 10, border: "1px solid #E2E5EA", fontSize: 15, letterSpacing: "4px", textAlign: "center" as const, fontFamily: "inherit", outline: "none", color: "#1E222B" },
};
