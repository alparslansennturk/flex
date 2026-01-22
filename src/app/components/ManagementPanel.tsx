"use client";
import React, { useState } from "react";
import { PlusCircle, Search, MoreVertical } from "lucide-react";

export default function ManagementPanel() {
  const [activeSubTab, setActiveSubTab] = useState<'gruplar' | 'öğrenciler' | 'ayarlar'>('gruplar');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SEKMELER - Mavi Alt Çizgili Modern Menü */}
      <div className="flex gap-10 border-b border-surface-200">
        {['gruplar', 'öğrenciler', 'ayarlar'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab as any)}
            className={`pb-5 text-[15px] font-semibold transition-all relative whitespace-nowrap ${
              activeSubTab === tab ? 'text-[#3A7BD5]' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {tab === 'gruplar' ? 'Grup Yönetimi' : tab === 'öğrenciler' ? 'Öğrenci Listesi' : 'Atölye Ayarları'}
            {activeSubTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#3A7BD5] rounded-t-full shadow-[0_-2px_10px_rgba(58,123,213,0.3)]" />
            )}
          </button>
        ))}
      </div>

      {/* İÇERİK ALANI - Beyaz Kart */}
      <div className="bg-white rounded-[32px] p-10 border border-surface-200 shadow-sm min-h-[600px]">
        {activeSubTab === 'gruplar' && (
          <div className="space-y-8">
            {/* Üst Bar: Başlık ve İşlemler */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h3 className="text-[clamp(20px,1.5vw,24px)] font-bold text-[#10294C] tracking-tight">Aktif Gruplar</h3>
                <p className="text-[14px] text-text-tertiary font-medium mt-1">HTML versiyonundaki tüm verileri buradan yönetebilirsin.</p>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-placeholder" size={18} />
                  <input 
                    type="text" 
                    placeholder="Grup veya eğitmen ara..." 
                    className="w-full pl-12 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-2xl text-[14px] outline-none focus:border-[#3A7BD5] transition-all font-medium"
                  />
                </div>
                <button className="flex items-center gap-2 bg-[#FF8D28] text-white px-8 py-3 rounded-2xl font-bold text-[14px] hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[#FF8D28]/20 shrink-0">
                  <PlusCircle size={20} /> Yeni Grup Ekle
                </button>
              </div>
            </div>

            {/* Grup Listesi Grid Yapısı */}
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 pt-4">
              {/* ÖRNEK GRUP KARTI */}
              <div className="border border-surface-200 rounded-[28px] p-8 hover:border-[#3A7BD5]/50 hover:shadow-xl hover:shadow-[#3A7BD5]/5 transition-all group cursor-pointer bg-white relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-[#F4F7FB] rounded-2xl flex items-center justify-center text-[#3A7BD5] text-[18px] font-bold">
                    A1
                  </div>
                  <button className="text-text-placeholder hover:text-[#10294C] p-2 hover:bg-surface-50 rounded-lg transition-colors">
                    <MoreVertical size={22} />
                  </button>
                </div>
                
                <h4 className="font-bold text-[#10294C] text-[18px] mb-2">Pazartesi - Perşembe</h4>
                <p className="text-[14px] text-text-tertiary font-medium mb-6">19:00 - 22:00 | Akşam Grubu</p>
                
                <div className="flex items-center justify-between pt-6 border-t border-surface-50">
                  <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-surface-100 flex items-center justify-center overflow-hidden">
                         <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="student" />
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-[#10294C] text-white flex items-center justify-center text-[11px] font-bold">+12</div>
                  </div>
                  <span className="text-[14px] font-bold text-[#3A7BD5] group-hover:underline">Detayları Gör</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSubTab === 'öğrenciler' && <div className="py-24 text-center text-text-tertiary font-medium">Öğrenci listesi tablosu hazırlanıyor...</div>}
        {activeSubTab === 'ayarlar' && <div className="py-24 text-center text-text-tertiary font-medium">Atölye genel ayarları çok yakında...</div>}
      </div>
    </div>
  );
}