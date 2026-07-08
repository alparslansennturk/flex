"use client";

/**
 * FlexOS · Giriş — canlı `src/app/login/page.tsx`'in `LoginForm`'u UI birebir portu.
 * Aktivasyon (kod ile) burada değil `/flexos/giris/aktivasyon`'da — `?email=&code=`
 * ile gelinirse oraya yönlendirilir (canlıda tek sayfada birleşikti, FlexOS'ta 3 ayrı
 * ekran istendi: Giriş / Aktivasyon / Şifremi Unuttum).
 */

import FlexLogo from "@/app/components/ui/FlexLogo";
import React, { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, ChevronRight, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ general?: string; isEmailError?: boolean }>({});
  const [shake, setShake] = useState(false);

  const [eType, setEType] = useState("text");
  const [pType, setPType] = useState("text");
  const [formKey, setFormKey] = useState("");

  useEffect(() => {
    // Aktivasyon linkinden geldiyse (?email=&code=) doğru ekrana yönlendir.
    const emailParam = searchParams.get("email");
    const codeParam = searchParams.get("code");
    if (emailParam && codeParam) {
      router.replace(`/flexos/giris/aktivasyon?email=${encodeURIComponent(emailParam)}&code=${encodeURIComponent(codeParam)}`);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  useEffect(() => {
    setFormKey(Math.random().toString(36).substring(7));
  }, []);

  const handleLogin = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    setErrors({});

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors({ general: getFlexMessage("auth/invalid-email").text, isEmailError: true });
      setShake(true);
      return;
    }

    setIsLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      document.cookie = `flex-token=${token}; path=/; max-age=2592000; SameSite=Lax`;
      router.push(await resolveLanding(token));
    } catch (error: unknown) {
      const e = error as { code?: string };
      console.error("Giriş Hatası:", e.code);
      const msg = e.code === "auth/user-disabled"
        ? getFlexMessage("auth/user-disabled").text
        : getFlexMessage("auth/invalid-credential").text;
      setErrors({ general: msg });
      setShake(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-[614px] bg-surface-white p-[56px] radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center min-[1440px]:scale-105 2xl:scale-110 ${shake ? "error-shake" : ""}`}>
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>FlexOS Girişi</h2>
        <FlexLogo variant="dark" />
      </div>

      <form onSubmit={handleLogin} noValidate className="w-full flex flex-col gap-6">
        <div style={{ position: "absolute", opacity: 0, height: 0, width: 0, zIndex: -1, overflow: "hidden" }} aria-hidden="true">
          <input type="text" name={`field_email_${formKey}`} tabIndex={-1} />
          <input type="password" name={`field_pass_${formKey}`} tabIndex={-1} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center h-5">
            <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>E-Posta</label>
            {errors.general && (
              <span className="ui-helper-sm animate-in fade-in duration-200 font-semibold" style={{ color: "var(--color-status-danger-500)" }}>
                {errors.general}
              </span>
            )}
          </div>
          <input
            autoComplete="new-password"
            name={`user_id_${formKey}`}
            id={`user_id_${formKey}`}
            data-lpignore="true"
            spellCheck="false"
            autoFocus
            type={eType}
            value={email}
            onFocus={() => setEType("email")}
            onChange={(e) => {
              setEmail(e.target.value);
              if (eType === "text" && e.target.value.length > 0) setEType("email");
            }}
            placeholder="E-Posta Giriniz"
            className="w-full h-12 px-4 border radius-8 text-[14px] outline-none transition-all duration-200"
            style={{
              borderColor: errors.general ? "var(--color-status-danger-500)" : "var(--color-surface-200)",
              backgroundColor: errors.general ? "rgba(239, 68, 68, 0.05)" : "var(--color-surface-50)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Parola</label>
          <div className="relative w-full">
            <input
              autoComplete="new-password"
              name={`key_id_${formKey}`}
              id={`key_id_${formKey}`}
              type={showPassword ? "text" : pType}
              onFocus={() => setPType("password")}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (pType === "text" && e.target.value.length > 0) setPType("password");
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              placeholder="••••••••••••"
              className="w-full h-12 pl-4 pr-12 border radius-8 text-[14px] outline-none transition-all duration-200"
              style={{
                borderColor: errors.general && !errors.isEmailError ? "var(--color-status-danger-500)" : "var(--color-surface-200)",
                backgroundColor: errors.general && !errors.isEmailError ? "rgba(239, 68, 68, 0.05)" : "var(--color-surface-50)",
                color: "var(--color-text-primary)",
              }}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
              style={{ color: "var(--color-text-placeholder)" }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          <label className="flex items-center gap-2.5 cursor-pointer group select-none">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="peer appearance-none w-4.5 h-4.5 rounded-[4px] border border-surface-300 checked:bg-base-primary-500 checked:border-base-primary-500 transition-all cursor-pointer"
              />
              <Check size={12} strokeWidth={4} className="absolute text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-200" />
            </div>
            <span className="ui-helper-sm transition-colors" style={{ color: "var(--color-text-secondary)" }}>Beni Hatırla</span>
          </label>
          <Link href="/flexos/giris/sifremi-unuttum" className="ui-helper-sm forgot-password-link font-semibold cursor-pointer transition-colors">
            Şifremi Unuttum
          </Link>
        </div>

        <button type="submit" disabled={isLoading}
          className="w-full h-12 radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 shadow-lg"
          style={{
            backgroundColor: "var(--color-designstudio-primary-500)",
            color: "var(--color-text-inverse)",
            boxShadow: "0 10px 15px -3px var(--color-designstudio-primary-500-20)",
          }}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span className="ui-helper-sm tracking-wide">Kontrol Ediliyor...</span>
            </div>
          ) : (
            <><span>Giriş Yap</span><ChevronRight size={18} /></>
          )}
        </button>
      </form>

      <div className="absolute right-[56px] bottom-[16px] text-[11px] font-bold opacity-40 uppercase tracking-widest italic" style={{ color: "var(--color-text-placeholder)" }}>FlexOS</div>
    </div>
  );
}

export default function FlexosGirisPage() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 font-inter antialiased"
      style={{ background: "linear-gradient(160deg, var(--color-base-primary-300) 0%, var(--color-base-secondary-300) 75%)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .forgot-password-link { color: var(--color-text-muted); text-decoration: none; }
        .forgot-password-link:hover { color: var(--color-text-primary); text-decoration: underline; }
      ` }} />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
