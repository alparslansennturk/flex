"use client";
import React from "react";
import { PenLine, Trash2 } from "lucide-react";
import { auth } from "@/app/lib/firebase";

interface UserData {
  id: string;
  uid?: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  branch: string;
  gender: 'male' | 'female' | '';
  title: string;
  avatarId: number;
  roles: string[];
  isActivated: boolean;
}
export const UserTable = ({ users, onEdit, onDelete }: any) => {
  return (
    <div className="bg-white rounded-[24px] border border-neutral-100 overflow-hidden shadow-sm mt-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50">
              <th className="p-5 text-[13px] font-bold text-neutral-500 w-84">Kullanıcı</th>
              <th className="p-5 text-[13px] font-bold text-neutral-500 w-64 text-left">Roller</th>
              <th className="p-5 text-[13px] font-bold text-neutral-500 w-52 text-left">Ünvan</th>
              <th className="p-5 text-[13px] font-bold text-neutral-500 w-68 text-left">E-Posta</th>
              <th className="p-5 text-[13px] font-bold text-neutral-500 w-56 text-left">Telefon</th>
              <th className="p-5 text-[13px] font-bold text-neutral-500 w-56 text-left">Şube</th>
              <th className="p-5 text-[13px] font-bold text-neutral-500 w-52 text-left">Durum</th>
              <th className="p-5 text-[13px] font-bold text-neutral-500 text-right">İşlem</th>
            </tr>
          </thead>
         <tbody className="divide-y divide-neutral-50">
  {users.map((user: UserData) => {
    // 🛡️ KENDİNİ KİLİTLEME: Giriş yapan kişi ile tablodaki kişi aynı mı?
    const isMe = user.email === auth.currentUser?.email;

    return (
      <tr key={user.id} className={`hover:bg-neutral-50/50 transition-colors group ${!user.isActivated ? 'bg-amber-50/30' : ''}`}>
        <td className="p-5 w-84">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 shadow-sm">
              <img 
                src={`/avatars/${user.gender === 'female' ? 'female' : 'male'}/${user.avatarId || 1}.svg`} 
                className="w-full h-full object-cover" 
                alt="" 
                onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/male/1.svg'; }} 
              />
            </div>
            <div className="font-bold text-[#10294C] text-[14px]">
              {user.name} {user.surname} {isMe && <span className="ml-1 text-[10px] text-blue-500 font-normal">(Siz)</span>}
            </div>
          </div>
        </td>

        {/* Roller, Ünvan, E-Posta, Telefon, Şube kısımları aynı kalıyor... */}
        <td className="p-5 w-64 text-left">
          <div className="flex flex-wrap gap-2">
            {user.roles?.map((role: string) => (
              <span key={role} className={`px-2 py-1 rounded-md text-[13px] font-bold border shadow-sm ${role === 'admin' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                {role === 'admin' ? 'Admin' : 'Eğitmen'}
              </span>
            ))}
          </div>
        </td>
        <td className="p-5 w-52 text-[13px] text-[#10294C] font-medium text-left">{user.roles?.includes('admin') ? "Yönetici | Eğitmen" : "Eğitmen"}</td>
        <td className="p-5 w-68 text-[13px] text-neutral-400 text-left truncate">{user.email}</td>
        <td className="p-5 w-56 text-[13px] font-bold text-[#10294C] text-left">{user.phone || "—"}</td>
        <td className="p-5 w-56 text-left">
          <span className="text-[13px] font-semibold text-[#10294C] bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-200">{user.branch || "Kadıköy Şb"}</span>
        </td>

        {/* ⚡️ DURUM VE TOGGLE (GÜVENLİ) */}
        <td className="p-5 w-52 text-left">
          <div className="flex items-center gap-[24px]">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${user.isActivated ? 'bg-green-50 text-green-600' : 'bg-amber-100 text-amber-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.isActivated ? 'bg-green-500' : 'bg-amber-500'}`}></span>
              {user.isActivated ? 'Aktif' : 'Beklemede'}
            </span>

            <button
              type="button"
              disabled={isMe} // 🛡️ Kendi durumunu değiştiremezsin
              onClick={() => {
                const action = user.isActivated ? "PASİFE" : "AKTİFE";
                if (window.confirm(`${user.name} ${user.surname} kullanıcısını ${action} almak istediğinize emin misiniz?`)) {
                  onEdit({ ...user, isActivated: !user.isActivated });
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isMe ? 'opacity-30 cursor-not-allowed bg-neutral-200' : (user.isActivated ? 'bg-green-500 cursor-pointer' : 'bg-neutral-300 cursor-pointer')}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.isActivated ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </td>

        <td className="p-5 text-right">
          <div className="flex justify-end gap-2">
            <button onClick={() => onEdit(user)} className="p-2 text-neutral-400 hover:text-orange-500 transition-colors cursor-pointer">
              <PenLine size={18} />
            </button>
            <button 
              disabled={isMe}
              onClick={() => onDelete(user.id)}
              className={`p-2 transition-colors ${isMe ? "text-neutral-200 cursor-not-allowed opacity-50" : "text-neutral-400 hover:text-red-500 cursor-pointer"}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </td>
      </tr>
    );
  })}
</tbody>
        </table>
      </div>
    </div>
  );
};