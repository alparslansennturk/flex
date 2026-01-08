"use client";

import React, { useState } from "react";
import { Eye, EyeOff, ChevronRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);
    
    setTimeout(() => {
        setErrors({ email: "Giriş bilgileri hatalı" });
        setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-linear-to-br from-base-primary-300 to-base-secondary-300">
      
      <div className="w-full max-w-120 bg-surface-white p-10 rounded-radius-16 shadow-2xl flex flex-col relative overflow-hidden">
        
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Kullanıcı Girişi</h1>
          <div className="text-lg font-bold text-transparent bg-clip-text bg-linear-to-r from-designstudio-primary-500 to-accent-purple-500">
            tasarımatölyesi
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-6">
          
          {/* E-POSTA ALANI */}
          <div className="flex flex-col gap-2">
            
            <div className="flex justify-between items-center h-5">
              <label className="text-sm font-bold text-text-primary uppercase tracking-wider opacity-80">
                E-Posta
              </label>
              
              {/* STATUS-DANGER-500: Saf kırmızı yazı */}
              <span className={`text-[12px] font-bold text-status-danger-500 transition-opacity duration-200 ${errors.email ? 'opacity-100' : 'opacity-0'}`}>
                {errors.email || ""}
              </span>
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Posta Giriniz"
              className={`w-full h-12 px-4 bg-surface-50 border rounded-radius-8 text-sm outline-none focus:ring-2 focus:ring-base-primary-500 transition-all 
                ${errors.email ? 'border-status-danger-500' : 'border-surface-200'}`}
            />
          </div>

          {/* PAROLA ALANI */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-text-primary uppercase tracking-wider opacity-80">
              Parola
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-4 pr-12 bg-surface-50 border border-surface-200 rounded-radius-8 text-sm outline-none focus:ring-2 focus:ring-base-primary-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-placeholder hover:text-text-secondary cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded accent-designstudio-primary-500" />
              <span className="text-xs text-text-secondary font-medium group-hover:text-text-primary transition-colors">Beni Hatırla</span>
            </label>
            <button type="button" className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
              Şifremi Unuttum
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 bg-linear-to-r from-designstudio-primary-400 to-designstudio-primary-600 text-text-inverse rounded-radius-8 font-bold flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all shadow-lg cursor-pointer disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <span>Sisteme Giriş Yap</span>
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 text-center text-[10px] text-text-placeholder font-bold uppercase tracking-widest opacity-40">
          FlexOS Management System V2.0
        </div>
      </div>
    </div>
  );
}