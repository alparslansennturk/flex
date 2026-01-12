"use client";

import React, { useState } from "react";
import { KeyRound, ChevronRight, Loader2, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { getFlexMessage } from "../../lib/messages";
import { auth } from "../../lib/firebase"; 
import { sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false); 
  const [error, setError] = useState(""); 
  const [shouldShake, setShouldShake] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSent(false);
    setShouldShake(false);
    setIsLoading(true);

    const actionCodeSettings = {
      url: 'https://flex-five-delta.vercel.app/login/activation/', 
      handleCodeInApp: true,
    };

    try {
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setIsLoading(false);
      setIsSent(true);
      setError("");
    } catch (err: any) {
      setIsLoading(false);
      setShouldShake(true);
      setError(getFlexMessage('auth/user-not-found').text);
      setTimeout(() => setShouldShake(false), 500);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-6 font-inter antialiased"
      style={{ 
        background: 'linear-gradient(160deg, var(--color-base-primary-300) 0%, var(--color-base-secondary-300) 75%)'
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fast-shake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(12px); }
          60% { transform: translateX(-12px); }
          80% { transform: translateX(12px); }
          100% { transform: translateX(0); }
        }
        .animate-fast-shake { animation: fast-shake 0.15s ease-in-out; }
      ` }} />

      <div className={`w-full max-w-[614px] bg-surface-white p-[56px] rounded-radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center 2xl:scale-110 ${shouldShake ? "animate-fast-shake" : ""}`}>
        
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-2">
            <KeyRound size={24} style={{ color: 'var(--color-neutral-900)' }} />
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              Şifremi Unuttum
            </h2>
          </div>
          <div className="text-[24px] font-bold flex items-center font-inter text-nowrap">
            <span style={{ color: 'var(--color-designstudio-primary-500)' }}>tasarım</span>
            <span style={{ color: 'var(--color-accent-purple-500)' }}>atölyesi</span>
          </div>
        </div>

        <form onSubmit={handleResetRequest} noValidate className="w-full flex flex-col font-inter">
          
          {/* MAC AUTOFILL TUZAĞI */}
          <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} aria-hidden="true">
            <input type="text" name="mac-autofill-trap-email" tabIndex={-1} />
            <input type="password" name="mac-autofill-trap-password" tabIndex={-1} />
          </div>

          <div className="flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end h-5">
                <label className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>E-Posta</label>
                {error && (
                  <span className="ui-helper-sm animate-in fade-in duration-200 font-semibold" style={{ color: 'var(--color-status-danger-500)' }}>
                    {error}
                  </span>
                )}
              </div>
              <input
                autoComplete="new-password"
                data-lpignore="true"
                spellCheck="false"
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Posta Giriniz"
                className="w-full h-12 px-4 border rounded-radius-8 text-sm outline-none transition-all duration-200"
                style={{ 
                  borderColor: error ? 'var(--color-status-danger-500)' : 'var(--color-surface-200)',
                  backgroundColor: error ? 'var(--color-status-danger-50)' : 'var(--color-surface-50)',
                  color: 'var(--color-text-primary)'
                }}
                required
              />
            </div>

            <div className="flex flex-col pt-2">
              <button 
                type="submit" 
                disabled={isLoading || isSent} 
                className="w-full h-12 rounded-radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-80 shadow-lg"
                style={{ 
                  backgroundColor: 'var(--color-designstudio-primary-500)', 
                  color: 'var(--color-text-inverse)',
                  boxShadow: '0 10px 15px -3px var(--color-designstudio-primary-500-20)' 
                }}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="ui-helper-sm tracking-wide font-semibold">Kontrol Ediliyor...</span>
                  </div>
                ) : isSent ? (
                  <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                    <Check size={20} strokeWidth={3} />
                    <span className="ui-helper-sm tracking-wide">E-Posta Gönderildi</span>
                  </div>
                ) : (
                  <>
                    <span>Devam Et</span>
                    <ChevronRight size={18} />
                  </>
                )}
              </button>

              <div className="mt-6 flex justify-between items-center w-full">
                <Link 
                  href="/login" 
                  className="flex items-center gap-2 text-[13px] font-semibold transition-colors hover:opacity-80"
                  style={{ color: '#3A7BD5' }} 
                >
                  <ArrowLeft size={16} />
                  <span>Giriş Ekranına Geri Dön</span>
                </Link>

                {isSent && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300 text-nowrap">
                    <Check size={16} strokeWidth={3} style={{ color: 'var(--color-status-success-500)' }} />
                    <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--color-status-success-500)' }}>
                      {getFlexMessage('auth/reset-email-sent').text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="absolute right-[56px] bottom-[16px] text-[11px] font-bold opacity-40 uppercase tracking-widest italic" style={{ color: 'var(--color-text-placeholder)' }}>v2.0</div>
      </div>
    </div>
  );
}