"use client";
import React, { useState, useEffect } from "react";
import { X, UserPlus, Check, ChevronDown, ShieldAlert, MoreVertical } from "lucide-react";

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
    permissionOverrides: Record<string, boolean>;
    isActivated: boolean;
    birthDate?: string;
}

interface UserFormProps {
    isFormOpen: boolean;
    setIsUserFormOpen: (val: boolean) => void;
    editingUser: UserData | null;
    setEditingUser: React.Dispatch<React.SetStateAction<UserData | null>>;
    avatarId: number;
    setAvatarId: React.Dispatch<React.SetStateAction<number>>;
    handleSaveUser: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
    errors: Record<string, boolean>;
    shake: boolean;
    selectedRoles: string[];
    setIsRoleDropdownOpen: (val: boolean) => void;
    isRoleDropdownOpen: boolean;
    handleRoleToggle: (roleId: string) => void;
    roleDropdownRef: React.RefObject<HTMLDivElement | null>;
    formatPhoneNumber: (val: string) => string;
    permissionsList: any[];
    getPermissionStatus: (id: string) => { isEnabled: boolean; roleDefault: boolean };
    handlePermissionChange: (id: string, checked: boolean) => void;
    loading: boolean;
    isSuccess: boolean;
}

export const UserForm: React.FC<UserFormProps> = ({
    isFormOpen, setIsUserFormOpen, editingUser, setEditingUser, handleSaveUser,
    errors, shake, selectedRoles, isRoleDropdownOpen, setIsRoleDropdownOpen,
    handleRoleToggle, roleDropdownRef, formatPhoneNumber, permissionsList,
    getPermissionStatus, handlePermissionChange, loading, isSuccess, avatarId, setAvatarId
}) => {
    const [localGender, setLocalGender] = useState<string>(editingUser?.gender || "");

    useEffect(() => {
        setLocalGender(editingUser?.gender || "");
    }, [editingUser, isFormOpen]);

    if (!isFormOpen) return null;

    return (
        <div className={`fixed inset-0 z-[600] flex items-center justify-center p-6 ${isFormOpen ? "visible" : "invisible delay-100 pointer-events-none"}`}>
            <div className={`absolute inset-0 bg-[#10294C]/40 backdrop-blur-md transition-opacity duration-500 ${isFormOpen ? "opacity-100" : "opacity-0"}`}
                onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} />
            <div className={`relative w-full max-w-6xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] transform ${isFormOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}>
                <form 
    key={editingUser?.id || "yeni-kullanici"} 
    onSubmit={handleSaveUser} 
    className="relative w-full max-w-6xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col h-fit max-h-[92vh] xl:max-h-[85vh] 2xl:max-h-[80vh] text-[#10294C] transform-gpu will-change-transform"
>
    {/* HEADER - Sabit */}
    <div className="bg-[#10294C] p-6 text-white flex items-center justify-between shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                <UserPlus size={20} />
            </div>
            <h3 className="text-[18px] font-bold">{editingUser ? "Hesap Güncelleme" : "Yeni Hesap Tanımlama"}</h3>
        </div>
        <button 
            type="button" 
            onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} 
            className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors"
        >
            <X size={20} />
        </button>
    </div>

    {/* SCROLLABLE GÖVDE - Kaydırılabilir Alan */}
  <div 
  className="flex-1 overflow-y-auto p-10 flex flex-col gap-10 custom-scrollbar"
  style={{
    scrollbarWidth: 'auto', // Firefox için
    scrollbarColor: '#10294C #F4F7FB', // Firefox için
    msOverflowStyle: 'auto', // Edge/IE için
  }}
>
    
        
        {/* Profil ve Temel Bilgiler */}
        <div className="flex gap-12 border-b border-neutral-100 pb-12 shrink-0">
            <div className="w-48 h-48 rounded-[32px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden relative shrink-0 shadow-inner group flex items-center justify-center">
                {localGender ? (
                    <img
                        key={`${localGender}-${avatarId}`}
                        src={`/avatars/${localGender}/${avatarId}.svg`}
                        className="w-full h-full object-cover"
                        alt="Avatar"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-neutral-400 px-4 text-center">
                        <span className="text-[10px] font-bold tracking-widest uppercase italic">Cinsiyet Seçiniz</span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => { if (localGender) setAvatarId(Math.floor(Math.random() * 70) + 1); else alert("Önce cinsiyet seç!"); }}
                    className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-xl shadow-lg border border-neutral-100 flex items-center justify-center hover:bg-neutral-50 transition-all cursor-pointer active:scale-90 z-10 text-[18px]"
                >🔄</button>
            </div>

            <div className="flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-neutral-400 ml-1">Ad</label>
                        <input name="name" defaultValue={editingUser?.name} placeholder="Örn: Alparslan" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-400 placeholder:font-normal ${errors.name ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-neutral-400 ml-1">Soyad</label>
                        <input name="surname" defaultValue={editingUser?.surname} placeholder="Örn: Akdağ" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-400 placeholder:font-normal ${errors.surname ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-neutral-400 ml-1">E-Posta</label>
                        <input name="email" type="email" defaultValue={editingUser?.email} placeholder="ornek@email.com" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-400 placeholder:font-normal ${errors.email ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-neutral-400 ml-1">Telefon</label>
                        <input name="phone" defaultValue={editingUser?.phone} onChange={(e) => { e.target.value = formatPhoneNumber(e.target.value); }} placeholder="0 (5xx) xxx xx xx" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-400 placeholder:font-normal ${errors.phone ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                </div>
            </div>
        </div>

        {/* Roller ve Ek Bilgiler */}
        <div className="grid grid-cols-3 gap-6 shrink-0">
            <div className="space-y-1 relative h-[72px]" ref={roleDropdownRef}>
                <label className="text-[12px] font-bold text-neutral-400 ml-1">Rol</label>
                <div onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)} className={`h-12 w-full border-2 rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${errors.roles ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : isRoleDropdownOpen ? 'border-orange-500 bg-white' : 'border-neutral-200 bg-neutral-50'}`}>
                    <span className={`text-[14px] truncate ${selectedRoles.length > 0 ? 'font-bold text-[#10294C]' : 'font-semibold text-neutral-600'}`}>{selectedRoles.length > 0 ? selectedRoles.map((r: any) => r === 'admin' ? 'Admin' : 'Eğitmen').join(', ') : 'Rol Seçiniz...'}</span>
                    <ChevronDown size={18} className={`transition-transform duration-300 ${isRoleDropdownOpen ? "rotate-180 text-orange-500" : "text-neutral-400"}`} />
                </div>
                {isRoleDropdownOpen && (
                    <div className="absolute top-[76px] left-0 w-full bg-white border border-neutral-200 shadow-lg rounded-xl z-[999] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {['admin', 'instructor'].map((r: string) => (
                            <label key={r} className="flex items-center gap-3 p-4 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                                <div className="relative flex items-center justify-center w-[18px] h-[18px] shrink-0">
                                    <input type="checkbox" checked={selectedRoles.includes(r)} onChange={() => handleRoleToggle(r)} className="peer absolute w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="w-full h-full border-2 border-neutral-300 rounded-[4px] peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all" />
                                    <Check size={14} className="absolute text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none" strokeWidth={4} />
                                </div>
                                <span className="text-[14px] font-medium text-neutral-700">{r === 'admin' ? 'Admin' : 'Eğitmen'}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-400 ml-1">Ünvan</label>
                <input name="title" defaultValue={editingUser?.title} placeholder="Örn: Eğitmen | Arı Bilgi" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-400 placeholder:font-normal ${errors.title ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
            </div>
            <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-400 ml-1">Şube</label>
                <div className="relative">
                    <select name="branch" defaultValue={editingUser?.branch || ""} className={`h-12 w-full border rounded-xl px-4 pr-10 outline-none cursor-pointer appearance-none font-semibold text-neutral-800 transition-all ${errors.branch ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`}>
                        <option value="" disabled hidden>Şube Seçiniz...</option>
                        <option value="Kadıköy Şb">Kadıköy Şb</option>
                        <option value="Şirinevler Şb">Şirinevler Şb</option>
                        <option value="Pendik Şb">Pendik Şb</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"><ChevronDown size={18} /></div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6 shrink-0">
            <div className="space-y-1 relative">
                <label className="text-[12px] font-bold text-neutral-400 ml-1">Cinsiyet</label>
                <div className="relative">
                    <select
                        name="gender"
                        value={localGender}
                        onChange={(e) => {
                            const val = e.target.value as 'male' | 'female';
                            setLocalGender(val);
                            if (editingUser) setEditingUser({ ...editingUser, gender: val });
                            if (!avatarId) setAvatarId(1);
                        }}
                        className={`h-12 w-full border rounded-xl px-4 pr-10 outline-none cursor-pointer appearance-none font-semibold transition-all ${!localGender ? 'text-neutral-600' : 'text-[#10294C] font-bold'} ${errors.gender ? 'border-red-500 bg-red-50' : 'border-neutral-200 bg-neutral-50'}`}
                    >
                        <option value="" disabled hidden>Cinsiyet Seçiniz...</option>
                        <option value="male">Erkek</option>
                        <option value="female">Kadın</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"><ChevronDown size={18} /></div>
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-400 ml-1">Doğum Tarihi</label>
                <input name="birthDate" defaultValue={editingUser?.birthDate} placeholder="gg.aa.yyyy" type="text" maxLength={10} onInput={(e: any) => { let v = e.target.value.replace(/\D/g, ''); if (v.length > 2) v = v.slice(0, 2) + '.' + v.slice(2); if (v.length > 5) v = v.slice(0, 5) + '.' + v.slice(5, 9); e.target.value = v; }} className={`h-12 w-full border rounded-xl px-4 font-bold text-[#10294C] placeholder:text-neutral-400 placeholder:font-normal outline-none transition-all ${errors.birthDate ? `border-red-500 bg-red-50 ${shake ? 'animate-fast-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
            </div>
        </div>

        {/* YETKİ MATRİSİ */}
        <div className="space-y-7 pb-10">
            <div className="flex items-center gap-3 text-[#8B5CF6] font-bold text-[13px] border-l-4 border-[#8B5CF6] pl-4">
                <ShieldAlert size={20} />
                <span>Sistem Erişim Yetki Matrisi</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
                {permissionsList.map((perm: any) => {
                    const { isEnabled } = getPermissionStatus(perm.id); 
                    return (
                        <label key={perm.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${isEnabled ? 'bg-purple-50/50 border-purple-200' : 'bg-white border-neutral-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center justify-center w-[18px] h-[18px] shrink-0">
                                    <input type="checkbox" checked={isEnabled} onChange={(e) => handlePermissionChange(perm.id, e.target.checked)} className="peer absolute w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="w-full h-full border-2 border-neutral-300 rounded-[4px] peer-checked:bg-purple-600 peer-checked:border-purple-600 transition-all" />
                                    <Check size={14} className="absolute text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none" strokeWidth={4} />
                                </div>
                                <span className={`text-[14px] font-bold ${isEnabled ? 'text-purple-900' : 'text-neutral-500'}`}>{perm.label}</span>
                            </div>
                        </label>
                    );
                })}
            </div>
        </div>
    </div>

    {/* FOOTER - Sabit */}
    <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-4 shrink-0">
        {!isSuccess && Object.keys(errors).length > 0 && (
            <span className="text-[13px] font-bold text-red-500 mr-auto">Lütfen eksik alanları doldurun.</span>
        )}
        <button 
            type="button" 
            onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} 
            className="px-8 font-bold text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors"
        >
            Vazgeç
        </button>
        <button 
            type="submit" 
            disabled={loading || isSuccess} 
            className={`h-14 px-14 rounded-xl font-bold transition-all flex items-center gap-3 shadow-xl ${isSuccess ? 'bg-green-500 text-white' : 'bg-orange-500 text-white active:scale-95 cursor-pointer hover:bg-orange-600'}`}
        >
            {isSuccess ? <><Check size={24} strokeWidth={3} /><span>Hesap Kaydedildi</span></> : loading ? "Kaydediliyor..." : "Hesabı Kaydet"}
        </button>
    </div>
</form>
            </div>
        </div>
    );
};