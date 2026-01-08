"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, ChevronRight, Loader2, Check } from "lucide-react";
import { getFlexMessage } from "@/app/lib/messages";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ general?: string }>({});
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 150);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    setTimeout(() => {
      // lib/messages.ts içindeki samimi mesajı çekiyoruz
      const messageObj = getFlexMessage("auth/wrong-password");
      setErrors({ general: messageObj.text });
      setIsLoading(false);
      setShake(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-linear-to-br from-base-primary-300 to-base-secondary-300">
      <div className={`w-full max-w-[614px] bg-surface-white p-[56px] rounded-radius-16 shadow-2xl flex flex-col relative transition-all duration-300 origin-center 2xl:scale-110 ${shake ? 'animate-fast-shake' : ''}`}>
        
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Kullanıcı Girişi</h2>
          <div className="text-xl font-bold flex items-center gap-2">
            <span className="text-text-primary opacity-10 font-light">|</span>
            <span className="text-designstudio-primary-500">tasarımatölyesi</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center h-5">
              <label className="text-sm font-bold text-text-primary">E-Posta</label>
              {errors.general && (
                <span className="text-[13px] font-bold text-status-danger-500 animate-in fade-in">
                  {errors.general}
                </span>
              )}
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Posta Giriniz"
              className={`w-full h-12 px-4 bg-surface-50 border rounded-radius-8 text-sm outline-none transition-all ${errors.general ? 'border-status-danger-500' : 'border-surface-200 focus:ring-2 focus:ring-base-primary-500/20'}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-text-primary">Parola</label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full h-12 pl-4 pr-12 bg-surface-50 border rounded-radius-8 text-sm outline-none transition-all ${errors.general ? 'border-status-danger-500' : 'border-surface-200 focus:ring-2 focus:ring-base-primary-500/20'}`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-placeholder hover:text-text-secondary cursor-pointer">
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
                <Check size={12} strokeWidth={4} className={`absolute text-white pointer-events-none transition-opacity duration-200 ${rememberMe ? 'opacity-100' : 'opacity-0'}`} />
              </div>
              <span className="text-xs text-text-secondary font-semibold group-hover:text-text-primary transition-colors">Beni Hatırla</span>
            </label>
            <button type="button" className="text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer transition-colors">Şifremi Unuttum</button>
          </div>

          <button type="submit" disabled={isLoading} className="w-full h-12 bg-designstudio-primary-500 hover:bg-designstudio-primary-600 text-text-inverse rounded-radius-8 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 shadow-lg shadow-designstudio-primary-500/10">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <span>Giriş Yap</span>
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="absolute right-[56px] bottom-[16px] text-[11px] text-text-placeholder font-bold opacity-40">V2.0</div>
      </div>

      <style jsx global>{`
        @keyframes fast-shake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(12px); }
          60% { transform: translateX(-12px); }
          80% { transform: translateX(12px); }
          100% { transform: translateX(0); }
        }
        .animate-fast-shake { animation: fast-shake 0.15s ease-in-out; }
      `}</style>
    </div>
  );
}