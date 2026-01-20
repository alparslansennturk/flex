"use client";
import React, { useState } from "react";
import { PlusCircle, Search, Filter, MoreVertical, LayoutGrid, List } from "lucide-react";

export default function ManagementPanel() {
  const [activeSubTab, setActiveSubTab] = useState<'gruplar' | 'öğrenciler' | 'ayarlar'>('gruplar');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SEKMELER - Üst Menü */}
      <div className="flex gap-8 border-b border-surface-200">
        {['gruplar', 'öğrenciler', 'ayarlar'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab as any)}
            className={`pb-4 text-[15px] font-bold capitalize transition-all relative ${
              activeSubTab === tab ? 'text-[#3A7BD5]' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {tab === 'gruplar' ? 'Grup Yönetimi' : tab === 'öğrenciler' ? 'Öğrenci Listesi' : 'Atölye Ayarları'}
            {activeSubTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#3A7BD5] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* İÇERİK ALANI */}
      <div className="bg-white rounded-[32px] p-8 border border-surface-200 shadow-sm min-h-[500px]">
        {activeSubTab === 'gruplar' && (
          <div className="space-y-6">
            {/* Üst Bar: Ara ve Ekle */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-[20px] font-bold text-[#10294C]">Aktif Gruplar</h3>
                <p className="text-[13px] text-text-tertiary">HTML versiyonundaki tüm verileri buradan yönetebilirsin.</p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" size={16} />
                  <input 
                    type="text" 
                    placeholder="Grup ara..." 
                    className="w-full pl-10 pr-4 py-2 bg-surface-50 border border-surface-200 rounded-xl text-[13px] outline-none focus:border-[#3A7BD5] transition-all"
                  />
                </div>
                <button className="flex items-center gap-2 bg-[#FF8D28] text-white px-6 py-2.5 rounded-xl font-bold text-[13px] hover:opacity-90 active:scale-95 transition-all shadow-md shrink-0">
                  <PlusCircle size={18} /> Yeni Grup Ekle
                </button>
              </div>
            </div>

            {/* Grup Listesi Başlangıcı */}
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 pt-4">
              {/* ÖRNEK BİR GRUP KARTI (Veri gelince burası dönecek) */}
              <div className="border border-surface-200 rounded-[24px] p-6 hover:border-[#3A7BD5] transition-all group cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-[#F4F7FB] rounded-xl flex items-center justify-center text-[#10294C] font-bold">
                    A1
                  </div>
                  <button className="text-text-placeholder hover:text-text-primary">
                    <MoreVertical size={20} />
                  </button>
                </div>
                <h4 className="font-bold text-[#10294C] text-[16px] mb-1">Pazartesi - Perşembe</h4>
                <p className="text-[13px] text-text-tertiary mb-4">19:00 - 22:00 | Akşam Grubu</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-surface-50">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-surface-100 flex items-center justify-center text-[10px] font-bold">
                        {i}
                      </div>
                    ))}
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-[#3A7BD5] text-white flex items-center justify-center text-[10px] font-bold">+12</div>
                  </div>
                  <span className="text-[12px] font-bold text-[#3A7BD5]">Detayları Gör</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSubTab === 'öğrenciler' && <div className="py-20 text-center text-text-tertiary">Öğrenci listesi çok yakında...</div>}
        {activeSubTab === 'ayarlar' && <div className="py-20 text-center text-text-tertiary">Atölye ayarları çok yakında...</div>}
      </div>
    </div>
  );
}