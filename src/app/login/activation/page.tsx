"use client";

import React, { useState, Suspense } from "react"; // Suspense eklendi
import { Eye, EyeOff, Loader2, ShieldCheck, Check, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../lib/firebase"; 
import { updatePassword, signOut, confirmPasswordReset } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { getFlexMessage } from "../../lib/messages";

// Asıl içeriği yeni bir fonksiyonel bileşene alıyoruz
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

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShouldShake(false);

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Parola en az 8 karakter, 1 büyük harf ve 1 rakam içermeli");
      setShouldShake(true);
      return;
    }

    if (password !== confirmPassword) {
      setError("Parolalar birbiriyle eşleşmiyor");
      setShouldShake(true);
      return;
    }

    setIsLoading(true);

    try {
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, password);
      } else {
        const user = auth.currentUser;
        if (!user) throw new Error("Oturum bulunamadı");
        await updatePassword(user, password);
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { isActivated: true });
      }

      setIsSuccess(true);
      setTimeout(async () => {
        await signOut(auth);
        router.push("/login");
      }, 2500);

    } catch (err: any) {
      setError("İşlem başarısız. Bağlantı geçersiz veya süresi dolmuş olabilir.");
      setShouldShake(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-[614px] bg-surface-white p-[56px] rounded-radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center 2xl:scale-110 ${shouldShake ? "animate-fast-shake" : ""}`}>
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} style={{ color: 'var(--color-neutral-900)' }} />
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              {oobCode ? "Yeni Parola Belirle" : "Hesabı Aktifleştir"}
            </h2>
          </div>
          <div className="text-[24px] font-bold flex items-center">
            <span style={{ color: 'var(--color-designstudio-primary-500)' }}>tasarım</span>
            <span style={{ color: 'var(--color-accent-purple-500)' }}>atölyesi</span>
          </div>
        </div>

        <form onSubmit={handleActivate} className="w-full flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end h-5">
              <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Yeni Parola</label>
              {error && <span className="text-xs font-semibold" style={{ color: 'var(--color-status-danger-500)' }}>{error}</span>}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-12 pl-4 pr-12 border rounded-radius-8 text-sm outline-none"
                style={{ borderColor: error ? 'var(--color-status-danger-500)' : 'var(--color-surface-200)', backgroundColor: 'var(--color-surface-50)' }}
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Yeni Parola (Tekrar)</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-12 px-4 border rounded-radius-8 text-sm outline-none"
              style={{ borderColor: 'var(--color-surface-200)', backgroundColor: 'var(--color-surface-50)' }}
              required
            />
          </div>

          <button type="submit" disabled={isLoading || isSuccess} className="w-full h-12 mt-4 rounded-radius-8 font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]" style={{ backgroundColor: 'var(--color-designstudio-primary-500)', color: 'var(--color-text-inverse)' }}>
            {isLoading ? <Loader2 className="animate-spin" /> : isSuccess ? <Check /> : <><span>{oobCode ? "Parolayı Güncelle" : "Hesabı Aktifleştir"}</span><ChevronRight size={18} /></>}
          </button>

          {isSuccess && (
            <div className="mt-4 flex items-center gap-2 text-status-success-500 animate-in fade-in">
              <Check size={18} />
              <span className="text-sm font-bold">İşlem başarılı! Giriş sayfasına yönlendiriliyorsunuz...</span>
            </div>
          )}
        </form>
    </div>
  );
}

// ANA SAYFA: Burası Next.js'in istediği Suspense sarmalını yapıyor
export default function ActivatePage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 font-inter antialiased" style={{ background: 'linear-gradient(160deg, var(--color-base-primary-300) 0%, var(--color-base-secondary-300) 75%)' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fast-shake { 0% { transform: translateX(0); } 20% { transform: translateX(-12px); } 40% { transform: translateX(12px); } 60% { transform: translateX(-12px); } 80% { transform: translateX(12px); } 100% { transform: translateX(0); } } .animate-fast-shake { animation: fast-shake 0.15s ease-in-out; }` }} />
      
      <Suspense fallback={<div className="text-white font-bold">Yükleniyor...</div>}>
        <ActivationContent />
      </Suspense>
    </div>
  );
}