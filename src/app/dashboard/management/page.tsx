"use client";
import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { Search, PlusCircle, Trash2, Mail, Users } from "lucide-react";

export default function ManagementPage() {
  // Hangi grubun listesini gördüğümüzü tutan state
  const [selectedGroup, setSelectedGroup] = useState<string>("A1");

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-inter antialiased text-[#1E222B]">
      
      <aside className="hidden lg:block h-screen sticky top-0 shrink-0 z-50 w-[280px] 2xl:w-[340px] bg-[#10294C]">
        <Sidebar />
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header />
        
        <main className="flex-1 w-full overflow-x-hidden">
          <div className="w-[94%] mx-auto py-8 transition-all duration-500 max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[2000px]">
            
            {/* GRUP SEÇİCİ KARTLAR */}
            <div className="flex flex-wrap gap-4 mb-10">
              <GroupSelectorCard id="A1" name="Pazartesi" active={selectedGroup === 'A1'} onClick={() => setSelectedGroup('A1')} />
              <GroupSelectorCard id="B2" name="Salı Sabah" active={selectedGroup === 'B2'} onClick={() => setSelectedGroup('B2')} />
              <GroupSelectorCard id="C1" name="Hafta Sonu" active={selectedGroup === 'C1'} onClick={() => setSelectedGroup('C1')} />
            </div>

            {/* ÖĞRENCİ LİSTESİ PANELİ */}
            <div className="bg-white rounded-[32px] border border-[#E2E5EA] shadow-sm overflow-hidden">
              
              <div className="p-8 border-b border-[#F1F5F9] flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[#10294C]">{selectedGroup} Grubu Öğrencileri</h2>
                  <p className="text-[14px] text-[#64748B] font-medium mt-1">Ödev konularını buradan mail atabilirsin.</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
                    <input 
                      type="text" 
                      placeholder="Listede ara..." 
                      className="pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E5EA] rounded-xl text-[13px] font-medium outline-none focus:border-[#3A7BD5] w-48 transition-all"
                    />
                  </div>
                  <button className="flex items-center gap-2 bg-[#3A7BD5] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-[#2e62ab] transition-all">
                    <PlusCircle size={18} /> Öğrenci Ekle
                  </button>
                </div>
              </div>

              {/* TABLO: AD-SOYAD, EMAIL, ÖDEV */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      <th className="px-8 py-4 text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Ad Soyad</th>
                      <th className="px-8 py-4 text-[12px] font-bold text-[#64748B] uppercase tracking-wider">E-Posta Adresi</th>
                      <th className="px-8 py-4 text-[12px] font-bold text-[#64748B] uppercase tracking-wider text-center">Ödev</th>
                      <th className="px-8 py-4 text-[12px] font-bold text-[#64748B] uppercase tracking-wider text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    <StudentRow name="Ela Yılmaz" email="ela@tasarimatolyesi.com" homeworkCount={5} />
                    <StudentRow name="Can Demir" email="can@mail.com" homeworkCount={2} />
                    <StudentRow name="Alparslan Kaya" email="alparslan@atolyen.com" homeworkCount={8} />
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

// Kompakt Grup Seçici
function GroupSelectorCard({ id, name, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 p-5 rounded-[24px] border transition-all duration-300 min-w-[200px] 
        ${active ? 'bg-[#10294C] border-[#10294C] text-white shadow-lg' : 'bg-white border-[#E2E5EA] text-[#10294C] hover:border-[#3A7BD5]'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[14px] 
        ${active ? 'bg-white/10 text-white' : 'bg-[#F4F7FB] text-[#3A7BD5]'}`}>
        {id}
      </div>
      <div className="text-left">
        <h4 className="font-bold text-[15px] leading-tight">{name}</h4>
        <span className={`text-[12px] font-medium ${active ? 'text-white/60' : 'text-[#64748B]'}`}>Grubu Gör</span>
      </div>
    </button>
  );
}

// Öğrenci Satırı
function StudentRow({ name, email, homeworkCount }: any) {
  return (
    <tr className="hover:bg-[#F8FAFC] transition-colors group">
      <td className="px-8 py-5">
        <span className="font-semibold text-[#10294C] text-[14px]">{name}</span>
      </td>
      <td className="px-8 py-5">
        <a href={`mailto:${email}`} className="text-[#3A7BD5] font-medium text-[14px] hover:underline flex items-center gap-2">
          <Mail size={14} /> {email}
        </a>
      </td>
      <td className="px-8 py-5 text-center">
        <span className="bg-[#F4F7FB] text-[#10294C] px-3 py-1 rounded-lg text-[13px] font-bold border border-[#E2E5EA]">
          {homeworkCount}
        </span>
      </td>
      <td className="px-8 py-5 text-right">
        <button title="Öğrenciyi Sil" className="p-2 text-[#94A3B8] hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
}