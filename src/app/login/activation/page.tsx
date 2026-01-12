"use client";

import React, { useState, Suspense, useEffect } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, Check, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../lib/firebase"; 
import { updatePassword, signOut, confirmPasswordReset } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { getFlexMessage } from "../../lib/messages";

function ActivationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); 
  const [error, setError] = useState("");
  const [shouldShake, setShouldShake] = useState(false);

  // Mac Autofill'i durdurmak için dinamik state'ler
  const [passType, setPassType] = useState("text");
  const [confirmType, setConfirmType] = useState("text");
  const [randomName, setRandomName] = useState("");

  useEffect(() => {
    setRandomName(Math.random().toString(36).substring(7));
  }, []);

  const handleActivate = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    setError("");
    setShouldShake(false);

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Parola kriterleri karşılanmıyor");
      setShouldShake(true);
      return;
    }

    if (password !== confirmPassword) {
      setError("Parolalar eşleşmiyor");
      setShouldShake(true);
      return;
    }

    setIsLoading(true);

    try {
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, password);
      } else {
        const user = auth.currentUser;
        if (!user) throw new Error("auth/no-user");
        await updatePassword(user, password);
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { isActivated: true });
      }

      setIsSuccess(true);
      setTimeout(async () => {
        await signOut(auth);
        router.push("/login");
      }, 3500);

    } catch (err: any) {
      setIsLoading(false);
      setShouldShake(true);
      setError("Bağlantı geçersiz veya süresi dolmuş.");
    }
  };

  return (
    <div className={`w-full max-w-[614px] bg-surface-white pt-[56px] px-[56px] pb-[64px] rounded-radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center 2xl:scale-110 ${shouldShake ? "animate-fast-shake" : ""}`}>
      
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-2">
          <ShieldCheck size={24} style={{ color: 'var(--color-neutral-900)' }} />
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            {oobCode ? "Yeni Parola Belirle" : "Hesabı Aktifleştir"}
          </h2>
        </div>
        <div className="text-[24px] font-bold flex items-center font-inter text-nowrap">
          <span style={{ color: 'var(--color-designstudio-primary-500)' }}>tasarım</span>
          <span style={{ color: 'var(--color-accent-purple-500)' }}>atölyesi</span>
        </div>
      </div>

      <form onSubmit={handleActivate} noValidate className="w-full flex flex-col font-inter">
        
        {/* TUZAK KATI - Mac buraya odaklansın */}
        <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} aria-hidden="true">
          <input type="text" name={`field1_${randomName}`} tabIndex={-1} />
          <input type="password" name={`field2_${randomName}`} tabIndex={-1} />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end h-5">
              <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Yeni Parola</label>
              {error && (
                <span className="ui-helper-sm animate-in fade-in duration-200 font-semibold text-nowrap" style={{ color: 'var(--color-status-danger-500)' }}>
                  {error}
                </span>
              )}
            </div>
            <div className="relative w-full">
              <input
                autoFocus
                autoComplete="off"
                name={`p_${randomName}`}
                type={showPassword ? "text" : passType}
                onFocus={() => setPassType("password")}
                value={password}
                onChange={(e) => {
                    setPassword(e.target.value);
                    if (passType === "text") setPassType("password");
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleActivate(); }}
                placeholder="••••••••••••"
                className="w-full h-12 pl-4 pr-12 border rounded-radius-8 text-sm outline-none transition-all duration-200"
                style={{ 
                  borderColor: error ? 'var(--color-status-danger-500)' : 'var(--color-surface-200)',
                  backgroundColor: error ? 'rgba(239, 68, 68, 0.05)' : 'var(--color-surface-50)',
                  color: 'var(--color-text-primary)'
                }}
                required
              />
              <button 
                type="button" 
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-colors" 
                style={{ color: error ? 'var(--color-status-danger-500)' : 'var(--color-text-placeholder)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[12.5px] leading-normal text-right italic font-medium opacity-100 tracking-tight" style={{ color: 'var(--color-text-muted)' }}>
              Parola en az 8 karakter olmalı, en az 1 büyük harf ve 1 rakam içermelidir.
            </p>
          </div>

          {/* MAC'İ ŞAŞIRTAN GÖRÜNMEZ AYRAÇ */}
          <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
            <input type="text" name={`ignore_${randomName}`} tabIndex={-1} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Yeni Parola (Tekrar)</label>
            <input
              autoComplete="off"
              name={`pc_${randomName}`}
              type={showPassword ? "text" : confirmType}
              onFocus={() => {
                  // Sadece odaklanınca değil, bir şeyler yazınca password olmalı
                  // Ama Mac'i kandırmak için focus anında hala text tutabiliriz
              }}
              value={confirmPassword}
              onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  // Kullanıcı yazmaya başladığı an şifre maskelemesi devreye girer
                  if (confirmType === "text" && e.target.value.length > 0) {
                      setConfirmType("password");
                  }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleActivate(); }}
              placeholder="••••••••••••"
              className="w-full h-12 px-4 border rounded-radius-8 text-sm outline-none transition-all duration-200"
              style={{ 
                borderColor: error ? 'var(--color-status-danger-500)' : 'var(--color-surface-200)',
                backgroundColor: error ? 'rgba(239, 68, 68, 0.05)' : 'var(--color-surface-50)',
                color: 'var(--color-text-primary)'
              }}
              required
            />
          </div>

          <div className="relative flex flex-col items-start pt-2">
            <button 
              type="submit" 
              disabled={isLoading || isSuccess} 
              className="w-full h-12 rounded-radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-100 shadow-lg"
              style={{ 
                backgroundColor: isSuccess ? 'var(--color-status-success-500)' : 'var(--color-designstudio-primary-500)', 
                color: 'var(--color-text-inverse)',
                boxShadow: '0 10px 15px -3px var(--color-designstudio-primary-500-20)' 
              }}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="ui-helper-sm tracking-wide">Kontrol Ediliyor...</span>
                </div>
              ) : isSuccess ? (
                <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                  <Check size={20} strokeWidth={3} />
                  <span className="ui-helper-sm tracking-wide">Giriş Sayfasına Gidiliyor...</span>
                </div>
              ) : (
                <>
                  <span>{oobCode ? "Parolayı Güncelle" : "Parolayı Oluştur"}</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>

            {isSuccess && (
              <div className="absolute top-[80px] left-0 w-full animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5" style={{ color: 'var(--color-status-success-500)' }}>
                  <Check size={18} strokeWidth={3} className="shrink-0" />
                  <span className="text-[14px] font-semibold tracking-tight leading-none text-nowrap">
                    {getFlexMessage('auth/activation-success').text}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      <div className="absolute right-[56px] bottom-[16px] text-[11px] font-bold opacity-40 uppercase tracking-widest italic" style={{ color: 'var(--color-text-placeholder)' }}>v2.0</div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 font-inter antialiased" style={{ background: 'linear-gradient(160deg, var(--color-base-primary-300) 0%, var(--color-base-secondary-300) 75%)' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fast-shake { 0% { transform: translateX(0); } 20% { transform: translateX(-12px); } 40% { transform: translateX(12px); } 60% { transform: translateX(-12px); } 80% { transform: translateX(12px); } 100% { transform: translateX(0); } } .animate-fast-shake { animation: fast-shake 0.15s ease-in-out; }` }} />
      <Suspense fallback={null}>
        <ActivationContent />
      </Suspense>
    </div>
  );
}