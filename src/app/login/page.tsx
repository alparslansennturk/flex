"use client";

import React, { useState } from "react";
import { Eye, EyeOff, ChevronRight, Loader2 } from "lucide-react";

// Hata tipimiz (Genişletilebilir)
interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // State yönetimi artık alan bazlı
  const [errors, setErrors] = useState<FormErrors>({});

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); // Önce temizle
    setIsLoading(true);
    
    setTimeout(() => {
        // Hatayı direkt ilgili alana basıyoruz
        setErrors({
          email: "Giriş bilgileri hatalı", 
        });
        setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-space-16 bg-linear-to-br from-base-primary-300 to-base-secondary-300">
      
      <div className="w-full max-w-120 bg-surface-white p-space-32 md:p-space-40 rounded-radius-16 shadow-2xl flex flex-col relative overflow-hidden">
        
        <div className="flex justify-between items-center mb-space-32">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Kullanıcı Girişi</h1>
          <div className="text-lg font-bold text-transparent bg-clip-text bg-linear-to-r from-designstudio-primary-500 to-accent-purple-500">
            tasarımatölyesi
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-space-24">
          
          {/* E-POSTA ALANI */}
          <div className="flex flex-col gap-2">
            
            {/* 🎯 KESİN ÇÖZÜM: h-5 ile sabit yükseklik */}
            <div className="w-full flex items-center justify-between h-5">
              <label className="text-sm font-bold text-text-primary">
                E-Posta
              </label>

              {/* Hata varsa render olur ama h-5 sayesinde layout zıplamaz */}
              {errors.email && (
                <span className="text-xs font-bold text-status-danger-600 whitespace-nowrap animate-in fade-in slide-in-from-right-2">
                  {errors.email}
                </span>
              )}
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Posta Giriniz"
              // Input border ve bg rengi hataya göre değişir
              className={`w-full h-12 px-4 bg-surface-50 border rounded-radius-8 text-sm outline-none focus:ring-2 focus:ring-base-primary-500 transition-all
                ${errors.email 
                  ? 'border-status-danger-500 bg-status-danger-50/10 text-status-danger-900 placeholder:text-status-danger-300' 
                  : 'border-surface-200'}`}
            />
          </div>

          {/* PAROLA ALANI */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-text-primary">Parola</label>
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

          <div className="flex justify-between items-center mt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-surface-200 focus:ring-designstudio-primary-500 accent-designstudio-primary-500" 
              />
              <span className="text-xs text-text-secondary font-medium">Beni Hatırla</span>
            </label>
            <button type="button" className="text-xs font-medium text-text-secondary hover:text-text-primary cursor-pointer">
              Şifremi Unuttum
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 bg-linear-to-r from-designstudio-primary-400 to-designstudio-primary-600 text-text-inverse rounded-radius-8 font-bold flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all shadow-md cursor-pointer disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <span>Giriş Yap</span>
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-space-32 text-center text-[10px] text-text-placeholder font-bold uppercase tracking-widest opacity-40">
          FlexOS Management V2.0
        </div>
      </div>
    </div>
  );
}