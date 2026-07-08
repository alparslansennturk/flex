"use client";

/**
 * FlexOS · Aktivasyon — canlının 2 ayrı sayfasının (`login/page.tsx`'teki `ActivationForm`
 * + `login/activation/page.tsx`'teki `ActivationContent`) TEK sayfada birleşimi (kullanıcı
 * kararı: FlexOS'ta 3 ayrı ekran — Giriş/Aktivasyon/Şifremi Unuttum). İki mod:
 * - `?oobCode=...` → Firebase native şifre sıfırlama (Şifremi Unuttum linkinden gelinir).
 * - `?email=&code=` → kod-bazlı ilk hesap aktivasyonu (Kullanıcı Ekle mailinden gelinir).
 */

import FlexLogo from "@/app/components/ui/FlexLogo";
import React, { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, Check, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import { confirmPasswordReset, signInWithEmailAndPassword } from "firebase/auth";
import { getFlexMessage } from "@/app/lib/messages";

// 3 dashboard var (Eğitmen / Eğitim Operasyon / Genel) — `/api/flexos/me` role'e göre
// doğru olanı döner. O uca hiç ulaşılamazsa (ağ hatası vb.) bu genel-amaçlı sayfaya düşülür.
const FALLBACK_LANDING = "/flexos/anasayfa";

async function resolveLanding(idToken: string): Promise<string> {
  try {
    const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) return FALLBACK_LANDING;
    const data = await res.json();
    return typeof data.landing === "string" ? data.landing : FALLBACK_LANDING;
  } catch {
    return FALLBACK_LANDING;
  }
}

// ─── oobCode modu: Şifremi Unuttum linkinden gelindi ──────────────────────────
function ResetPasswordForm({ oobCode }: { oobCode: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleReset = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    setError("");
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Parola en az 8 karakter, bir büyük harf ve bir rakam içermelidir.");
      setShake(true);
      return;
    }
    if (password !== confirmPassword) {
      setError("Parolalar eşleşmiyor.");
      setShake(true);
      return;
    }
    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setIsSuccess(true);
      setTimeout(() => router.push("/flexos/giris"), 3000);
    } catch {
      setIsLoading(false);
      setShake(true);
      setError("Bağlantı geçersiz veya süresi dolmuş.");
    }
  };

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(t);
  }, [shake]);

  return (
    <div className={`w-full max-w-[614px] bg-surface-white p-[56px] radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center min-[1440px]:scale-105 2xl:scale-110 ${shake ? "error-shake" : ""}`}>
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-2">
          <ShieldCheck size={24} style={{ color: "var(--color-neutral-900)" }} />
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Yeni Parola Belirle</h2>
        </div>
        <FlexLogo />
      </div>

      <form onSubmit={handleReset} noValidate className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-end h-5">
            <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Yeni Parola</label>
            {error && <span className="ui-helper-sm animate-in fade-in duration-200 font-semibold text-nowrap" style={{ color: "var(--color-status-danger-500)" }}>{error}</span>}
          </div>
          <div className="relative w-full">
            <input
              autoFocus
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleReset(e); }}
              placeholder="••••••••••••"
              className="w-full h-12 pl-4 pr-12 border radius-8 text-[14px] outline-none transition-all duration-200"
              style={{ borderColor: error ? "var(--color-status-danger-500)" : "var(--color-surface-200)", backgroundColor: error ? "rgba(239, 68, 68, 0.05)" : "var(--color-surface-50)", color: "var(--color-text-primary)" }}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-colors" style={{ color: "var(--color-text-placeholder)" }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-[12.5px] leading-normal text-right italic font-medium" style={{ color: "var(--color-text-muted)" }}>Parola en az 8 karakter olmalı, en az 1 büyük harf ve 1 rakam içermelidir.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Yeni Parola (Tekrar)</label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleReset(e); }}
            placeholder="••••••••••••"
            className="w-full h-12 px-4 border radius-8 text-[14px] outline-none transition-all duration-200"
            style={{ borderColor: error ? "var(--color-status-danger-500)" : "var(--color-surface-200)", backgroundColor: error ? "rgba(239, 68, 68, 0.05)" : "var(--color-surface-50)", color: "var(--color-text-primary)" }}
          />
        </div>

        <div className="relative flex flex-col items-start pt-1">
          <button type="submit" disabled={isLoading || isSuccess}
            className="w-full h-12 radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-100 shadow-lg"
            style={{ backgroundColor: isSuccess ? "var(--color-status-success-500)" : "var(--color-designstudio-primary-500)", color: "var(--color-text-inverse)", boxShadow: "0 10px 15px -3px var(--color-designstudio-primary-500-20)" }}>
            {isLoading ? (
              <div className="flex items-center gap-2"><Loader2 className="animate-spin" size={20} /><span className="ui-helper-sm tracking-wide">Kontrol Ediliyor...</span></div>
            ) : isSuccess ? (
              <div className="flex items-center gap-2 animate-in zoom-in duration-300"><Check size={20} strokeWidth={3} /><span className="ui-helper-sm tracking-wide">Giriş Sayfasına Gidiliyor...</span></div>
            ) : (
              <><span>Parolayı Güncelle</span><ChevronRight size={18} /></>
            )}
          </button>
        </div>
      </form>

      <div className="absolute right-[56px] bottom-[16px] text-[11px] font-bold opacity-40 uppercase tracking-widest italic" style={{ color: "var(--color-text-placeholder)" }}>FlexOS</div>
    </div>
  );
}

// ─── email+code modu: ilk hesap aktivasyonu ──────────────────────────────────
function ActivationCodeForm({ prefillEmail, prefillCode }: { prefillEmail: string; prefillCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(prefillCode);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(t);
  }, [shake]);

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!code.trim()) return setError("Aktivasyon kodu zorunludur.");
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword))
      return setError("Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir.");
    if (newPassword !== confirmPassword) return setError("Şifreler eşleşmiyor.");

    setIsLoading(true);
    try {
      const res = await fetch("/api/flexos/activation/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: prefillEmail, code: code.trim(), password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bir hata oluştu.");
        setShake(true);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, prefillEmail, newPassword);
      const token = await cred.user.getIdToken();
      document.cookie = `flex-token=${token}; path=/; max-age=2592000; SameSite=Lax`;
      router.push(await resolveLanding(token));
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setShake(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-[614px] bg-surface-white p-[56px] radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center min-[1440px]:scale-105 2xl:scale-110 ${shake ? "error-shake" : ""}`}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Hesabını Aktive Et</h2>
          <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>{prefillEmail}</p>
        </div>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "var(--color-designstudio-primary-50)" }}>
          <ShieldCheck size={22} style={{ color: "var(--color-designstudio-primary-500)" }} />
        </div>
      </div>

      <div className="h-px my-6" style={{ background: "var(--color-surface-100)" }} />

      <form onSubmit={handleActivate} className="w-full flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center h-5">
            <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Aktivasyon Kodu</label>
            {error && <span className="ui-helper-sm animate-in fade-in duration-200 font-semibold" style={{ color: "var(--color-status-danger-500)" }}>{error}</span>}
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            className="w-full h-12 px-4 border radius-8 text-[15px] font-mono font-bold tracking-[0.2em] outline-none transition-all duration-200 uppercase"
            style={{ borderColor: error ? "var(--color-status-danger-500)" : "var(--color-surface-200)", backgroundColor: error ? "rgba(239, 68, 68, 0.05)" : "var(--color-surface-50)", color: "var(--color-text-primary)" }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Şifre Belirle</label>
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 karakter, büyük harf, rakam"
              className="w-full h-12 pl-4 pr-12 border radius-8 text-[14px] outline-none transition-all duration-200"
              style={{ borderColor: "var(--color-surface-200)", backgroundColor: "var(--color-surface-50)", color: "var(--color-text-primary)" }}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-colors" style={{ color: "var(--color-text-placeholder)" }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Şifre Tekrar</label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleActivate(); }}
            placeholder="••••••••••••"
            className="w-full h-12 px-4 border radius-8 text-[14px] outline-none transition-all duration-200"
            style={{ borderColor: "var(--color-surface-200)", backgroundColor: "var(--color-surface-50)", color: "var(--color-text-primary)" }}
          />
        </div>

        <button type="submit" disabled={isLoading}
          className="w-full h-12 radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 shadow-lg mt-1"
          style={{ backgroundColor: "var(--color-designstudio-primary-500)", color: "var(--color-text-inverse)", boxShadow: "0 10px 15px -3px var(--color-designstudio-primary-500-20)" }}>
          {isLoading ? (
            <div className="flex items-center gap-2"><Loader2 className="animate-spin" size={20} /><span className="ui-helper-sm tracking-wide">Aktive Ediliyor...</span></div>
          ) : (
            <><ShieldCheck size={18} /><span>Hesabımı Aktive Et</span></>
          )}
        </button>
      </form>

      <div className="absolute right-[56px] bottom-[16px] text-[11px] font-bold opacity-40 uppercase tracking-widest italic" style={{ color: "var(--color-text-placeholder)" }}>FlexOS</div>
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="w-full max-w-[614px] bg-surface-white p-[56px] radius-16 shadow-2xl flex flex-col items-center text-center gap-4">
      <ShieldCheck size={40} style={{ color: "var(--color-status-danger-500)" }} />
      <h2 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Geçersiz Bağlantı</h2>
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Bu aktivasyon/şifre sıfırlama bağlantısı eksik veya süresi dolmuş görünüyor.
      </p>
    </div>
  );
}

function AktivasyonRouter() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const email = searchParams.get("email");
  const code = searchParams.get("code");

  if (oobCode) return <ResetPasswordForm oobCode={oobCode} />;
  if (email && code) return <ActivationCodeForm prefillEmail={email} prefillCode={code} />;
  return <InvalidLink />;
}

export default function FlexosAktivasyonPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 font-inter antialiased" style={{ background: "linear-gradient(160deg, var(--color-base-primary-300) 0%, var(--color-base-secondary-300) 75%)" }}>
      <Suspense fallback={null}>
        <AktivasyonRouter />
      </Suspense>
    </div>
  );
}
