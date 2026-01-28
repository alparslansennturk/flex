"use client";

import React, { useState } from "react";
import { Layers, Settings, Plus } from "lucide-react";

export default function ManagementContent() {
  const [activeSubTab, setActiveSubTab] = useState("groups");

  const tabs = [
    { id: "profile", label: "Profil Ayarları" },
    { id: "users", label: "Kullanıcılar" },
    { id: "groups", label: "Gruplar & Sınıflar" },
    { id: "header-footer", label: "Header & Footer" },
    { id: "sidebar", label: "Sidebar Ayarları" },
  ];

  return (
    <div className="w-full">
      
      {/* --- 1. ÜST NAVİGASYON BAR --- */}
      <div className="flex items-center border-b border-surface-200 h-20">
        <div className="flex items-center gap-3 cursor-default">
          <Settings size={20} className="text-[#404040]" strokeWidth={2.5} />
          <h2 className="text-[clamp(20px,1.2vw,24px)] font-bold text-base-primary-900 whitespace-nowrap leading-none tracking-tight">
            Yönetim Paneli
          </h2>
        </div>

        <nav className="flex items-center ml-[80px] h-full">
          {tabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              <button
                onClick={() => setActiveSubTab(tab.id)}
                className="relative h-full flex items-center outline-none transition-all duration-300 group cursor-pointer"
              >
                <span className={`text-[clamp(14px,0.8vw,16px)] font-semibold tracking-tight whitespace-nowrap transition-all duration-300
                  ${activeSubTab === tab.id ? "text-base-primary-500" : "text-text-tertiary hover:text-text-secondary"}`}>
                  {tab.label}
                </span>
                {activeSubTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-[2.5px] bg-base-primary-500 rounded-t-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
                )}
              </button>
              {index < tabs.length - 1 && (
                <div className="mx-[11.5px] h-3.5 w-[1px] bg-surface-200 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* --- 2. GRUPLAR SEKMESİ AKSİYON BARI --- */}
      {activeSubTab === 'groups' && (
        <div className="mt-[48px] animate-in fade-in duration-500">
          
          {/* Başlık ve Butonun Yan Yana Geldiği O Jilet Satır */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-300">
            
            <div className="flex items-center">
              {/* Başlık Kısmı: 16px SemiBold & Daha Zarif */}
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-neutral-700" strokeWidth={2} />
                <h3 className="text-[16px] font-semibold text-neutral-700 leading-none">
                  Gruplar & Sınıflar
                </h3>
              </div>

              {/* Dikey Ayıraç: Başlığın hemen sağında */}
              <div className="mx-6 w-[1px] h-6 bg-neutral-300" />

              {/* Turuncu Buton: Başlığın hemen devamında */}
              <button className="w-[144px] h-[40px] bg-[#FF8D28] hover:bg-[#E67A12] text-white rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-500/10 cursor-pointer">
                <Plus size={16} strokeWidth={3} />
                <span>Grup Ekle</span>
              </button>
            </div>

            {/* Sağ tarafa belki minik bir rakam (opsiyonel) */}
            <div className="text-[12px] font-medium text-neutral-400 italic">
              12 Aktif Kayıt
            </div>

          </div>

          {/* İçerik Placeholder */}
          <div className="mt-10">
            <div className="p-16 border border-dashed border-neutral-200 rounded-[24px] text-center">
              <p className="text-neutral-400 italic text-sm">Grup listesi veya form buraya gelecek...</p>
            </div>
          </div>
          
        </div>
      )}

    </div>
  );
}