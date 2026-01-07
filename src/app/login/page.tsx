"use client";

import React, { useState } from "react";
import { Eye, EyeOff, ChevronRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsLoading(true);
    // Simülasyon
    setTimeout(() => {
        setFormError("Giriş bilgileri hatalı. Lütfen tekrar deneyin.");
        setIsLoading(false);
    }, 1500);
  };

  return (
    // Gradient Arka Plan
    <div className="min-h-screen w-full flex items-center justify-center p-space-16 bg-gradient-to-br from-base-primary-300 to-base-secondary-300">
      
      {/* Beyaz Kutu */}
      <div className="w-full max-w-[480px] bg-surface-white p-space-32 md:p-space-48 rounded-radius-16 shadow-2xl flex flex-col relative">
        
        {/* Üst Kısım: Başlık ve Logo */}
        <div className="flex justify-between items-start mb-space-24">
          <h1 className="text-2xl font-bold text-text-primary">Kullanıcı Girişi</h1>
          <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-designstudio-primary-500 to-accent-purple-500">
            tasarımatölyesi
          </div>
        </div>

        {/* Hata Mesajı (Varsa Görünür) */}
        {formError && (
          <div className="mb-4 text-sm font-medium text-status-danger-500 text-right w-full bg-status-danger-50 p-2 rounded-radius-8 border border-status-danger-500/20">
            {formError}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-space-24">
          
          {/* E-Posta */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-primary">E-Posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Posta Giriniz"
              className={`w-full h-12 px-4 bg-surface-50 border rounded-radius-8 text-sm outline-none focus:ring-2 focus:ring-base-primary-500 transition-all
                ${formError ? 'border-status-danger-500' : 'border-surface-200'}`}
            />
          </div>

          {/* Parola */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-primary">Parola</label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full h-12 pl-4 pr-12 bg-surface-50 border rounded-radius-8 text-sm outline-none focus:ring-2 focus:ring-base-primary-500 transition-all
                  ${formError ? 'border-status-danger-500' : 'border-surface-200'}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-placeholder hover:text-text-secondary"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Alt Linkler */}
          <div className="flex justify-between items-center mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 text-designstudio-primary-500 rounded border-gray-300 focus:ring-designstudio-primary-500" />
              <span className="text-xs text-text-secondary font-medium">Beni Hatırla</span>
            </label>
            <button type="button" className="text-xs font-medium text-text-secondary hover:text-text-primary">
              Şifremi Unuttum
            </button>
          </div>

          {/* Buton */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-4 bg-gradient-to-r from-designstudio-primary-400 to-designstudio-primary-600 text-text-inverse rounded-radius-8 font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <span>Giriş Yap</span>
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Versiyon */}
        <div className="absolute bottom-4 right-6 text-xs text-text-placeholder font-medium">
          V2.0
        </div>
      </div>
    </div>
  );
}