"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, ChevronRight, Loader2, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getFlexMessage } from "../lib/messages";

// ─── Normal Login ─────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [errors, setErrors]         = useState<{ general?: string; isEmailError?: boolean }>({});
  const [shake, setShake]           = useState(false);

  const [eType, setEType]     = useState("text");
  const [pType, setPType]     = useState("text");
  const [formKey, setFormKey] = useState("");

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
      setErrors({ general: getFlexMessage('auth/invalid-email').text, isEmailError: true });
      setShake(true);
      return;
    }

    setIsLoading(true);

    try {
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);

      // Token + Firestore paralel — cookie race condition önlenir, hız korunur.
      const [idToken, userDoc] = await Promise.all([user.getIdToken(), getDoc(userDocRef)]);
      document.cookie = `flex-token=${idToken}; path=/; max-age=2592000; SameSite=Lax`;

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.isActivated === false) {
          router.push("/login/activation");
          return;
        }
        // Öğrenci → kendi portalına yönlendir
        const role = userData.role || userData.roles?.[0];
        if (role === "student") {
          // studentDocId, welcome API tarafından users doc'a kaydedilir
          let studentDocId: string = userData.studentDocId;
          if (!studentDocId) {
            // Eski kayıtlar için fallback: students koleksiyonunda authUid ile ara
            const snap = await getDocs(
              query(collection(db, "students"), where("authUid", "==", user.uid))
            );
            studentDocId = snap.empty ? user.uid : snap.docs[0].id;
          }
          router.push(`/student/${studentDocId}`);
          return;
        }
      }

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Giriş Hatası:", error.code);
      setErrors({ general: getFlexMessage('auth/invalid-credential').text });
      setShake(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-[614px] bg-surface-white p-[56px] radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center min-[1440px]:scale-105 2xl:scale-110 ${shake ? 'error-shake' : ''}`}>
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Kullanıcı Girişi</h2>
        <div className="text-[24px] font-bold flex items-center font-inter text-nowrap">
          <span style={{ color: 'var(--color-designstudio-primary-500)' }}>tasarım</span>
          <span style={{ color: 'var(--color-accent-purple-500)' }}>atölyesi</span>
        </div>
      </div>

      <form onSubmit={handleLogin} noValidate className="w-full flex flex-col gap-6">
        <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} aria-hidden="true">
          <input type="text"     name={`field_email_${formKey}`} tabIndex={-1} />
          <input type="password" name={`field_pass_${formKey}`}  tabIndex={-1} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center h-5">
            <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>E-Posta</label>
            {errors.general && (
              <span className="ui-helper-sm animate-in fade-in duration-200 font-semibold" style={{ color: 'var(--color-status-danger-500)' }}>
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
              borderColor:     errors.general ? 'var(--color-status-danger-500)' : 'var(--color-surface-200)',
              backgroundColor: errors.general ? 'rgba(239, 68, 68, 0.05)' : 'var(--color-surface-50)',
              color:           'var(--color-text-primary)'
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Parola</label>
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
                borderColor:     errors.general && !errors.isEmailError ? 'var(--color-status-danger-500)' : 'var(--color-surface-200)',
                backgroundColor: errors.general && !errors.isEmailError ? 'rgba(239, 68, 68, 0.05)' : 'var(--color-surface-50)',
                color:           'var(--color-text-primary)'
              }}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
              style={{ color: 'var(--color-text-placeholder)' }}>
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
            <span className="ui-helper-sm transition-colors" style={{ color: 'var(--color-text-secondary)' }}>Beni Hatırla</span>
          </label>
          <Link href="/login/forgot-password" className="ui-helper-sm forgot-password-link font-semibold cursor-pointer transition-colors">
            Şifremi Unuttum
          </Link>
        </div>

        <button type="submit" disabled={isLoading}
          className="w-full h-12 radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 shadow-lg"
          style={{
            backgroundColor: 'var(--color-designstudio-primary-500)',
            color:           'var(--color-text-inverse)',
            boxShadow:       '0 10px 15px -3px var(--color-designstudio-primary-500-20)'
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

      <div className="absolute right-[56px] bottom-[16px] text-[11px] font-bold opacity-40 uppercase tracking-widest italic" style={{ color: 'var(--color-text-placeholder)' }}>v2.0</div>
    </div>
  );
}

// ─── Aktivasyon Formu ─────────────────────────────────────────────────────────

function ActivationForm({ prefillEmail, prefillCode }: { prefillEmail: string; prefillCode: string }) {
  const router = useRouter();
  const [code, setCode]                   = useState(prefillCode);
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState("");
  const [shake, setShake]                 = useState(false);

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!code.trim())
      return setError("Aktivasyon kodu zorunludur.");
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword))
      return setError("Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir.");
    if (newPassword !== confirmPassword)
      return setError("Şifreler eşleşmiyor.");

    setIsLoading(true);
    try {
      const res = await fetch("/api/activation/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: prefillEmail, code: code.trim(), password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Bir hata oluştu.");
        setShake(true);
        return;
      }

      // Aktivasyon başarılı → otomatik giriş yap
      await signInWithEmailAndPassword(auth, prefillEmail, newPassword);
      router.push(`/student/${data.studentDocId ?? data.userId}`);

    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setShake(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-[614px] bg-surface-white p-[56px] radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center min-[1440px]:scale-105 2xl:scale-110 ${shake ? 'error-shake' : ''}`}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Hesabını Aktive Et</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>{prefillEmail}</p>
        </div>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-designstudio-primary-50)' }}>
          <ShieldCheck size={22} style={{ color: 'var(--color-designstudio-primary-500)' }} />
        </div>
      </div>

      <div className="h-px my-6" style={{ background: 'var(--color-surface-100)' }} />

      <form onSubmit={handleActivate} className="w-full flex flex-col gap-5">

        {/* Aktivasyon Kodu */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center h-5">
            <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Aktivasyon Kodu</label>
            {error && (
              <span className="ui-helper-sm animate-in fade-in duration-200 font-semibold" style={{ color: 'var(--color-status-danger-500)' }}>
                {error}
              </span>
            )}
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            className="w-full h-12 px-4 border radius-8 text-[15px] font-mono font-bold tracking-[0.2em] outline-none transition-all duration-200 uppercase"
            style={{
              borderColor:     error ? 'var(--color-status-danger-500)' : 'var(--color-surface-200)',
              backgroundColor: error ? 'rgba(239, 68, 68, 0.05)' : 'var(--color-surface-50)',
              color:           'var(--color-text-primary)'
            }}
          />
        </div>

        {/* Yeni Şifre */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Şifre Belirle</label>
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 karakter, büyük harf, rakam"
              className="w-full h-12 pl-4 pr-12 border radius-8 text-[14px] outline-none transition-all duration-200"
              style={{
                borderColor:     'var(--color-surface-200)',
                backgroundColor: 'var(--color-surface-50)',
                color:           'var(--color-text-primary)'
              }}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
              style={{ color: 'var(--color-text-placeholder)' }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Şifre Tekrar */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Şifre Tekrar</label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleActivate(); }}
            placeholder="••••••••••••"
            className="w-full h-12 px-4 border radius-8 text-[14px] outline-none transition-all duration-200"
            style={{
              borderColor:     'var(--color-surface-200)',
              backgroundColor: 'var(--color-surface-50)',
              color:           'var(--color-text-primary)'
            }}
          />
        </div>

        <button type="submit" disabled={isLoading}
          className="w-full h-12 radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 shadow-lg mt-1"
          style={{
            backgroundColor: 'var(--color-designstudio-primary-500)',
            color:           'var(--color-text-inverse)',
            boxShadow:       '0 10px 15px -3px var(--color-designstudio-primary-500-20)'
          }}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span className="ui-helper-sm tracking-wide">Aktive Ediliyor...</span>
            </div>
          ) : (
            <><ShieldCheck size={18} /><span>Hesabımı Aktive Et</span></>
          )}
        </button>
      </form>

      <div className="absolute right-[56px] bottom-[16px] text-[11px] font-bold opacity-40 uppercase tracking-widest italic" style={{ color: 'var(--color-text-placeholder)' }}>v2.0</div>
    </div>
  );
}

// ─── Router: URL'e göre doğru formu seç ──────────────────────────────────────

function LoginRouter() {
  const searchParams  = useSearchParams();
  const emailParam    = searchParams.get("email") ?? "";
  const codeParam     = searchParams.get("code")  ?? "";

  if (emailParam && codeParam) {
    return <ActivationForm prefillEmail={emailParam} prefillCode={codeParam} />;
  }
  return <LoginForm />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 font-inter antialiased"
      style={{ background: 'linear-gradient(160deg, var(--color-base-primary-300) 0%, var(--color-base-secondary-300) 75%)' }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .forgot-password-link { color: var(--color-text-muted); text-decoration: none; }
        .forgot-password-link:hover { color: var(--color-text-primary); text-decoration: underline; }
      ` }} />
      <Suspense fallback={null}>
        <LoginRouter />
      </Suspense>
    </div>
  );
}
