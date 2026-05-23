"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, UserPlus, Check, ChevronDown, ClipboardList, Users, LayoutDashboard, Lock } from "lucide-react";

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
    permissionsList: { id: string; icon: string; label: string; description: string }[];
    getPermissionStatus: (id: string) => { isEnabled: boolean; roleDefault: boolean };
    handlePermissionChange: (id: string, checked: boolean) => void;
    loading: boolean;
    isSuccess: boolean;
    availableBranches: { id: string; name: string; slug: string }[];
    selectedBranches: string[];
    setSelectedBranches: React.Dispatch<React.SetStateAction<string[]>>;
}

export const UserForm: React.FC<UserFormProps> = ({
    isFormOpen, setIsUserFormOpen, editingUser, setEditingUser, handleSaveUser,
    errors, shake, selectedRoles, isRoleDropdownOpen, setIsRoleDropdownOpen,
    handleRoleToggle, roleDropdownRef, formatPhoneNumber, permissionsList,
    getPermissionStatus, handlePermissionChange, loading, isSuccess, avatarId, setAvatarId,
    availableBranches, selectedBranches, setSelectedBranches,
}) => {
    const [localGender, setLocalGender] = useState<string>(editingUser?.gender || "");
    const [localLocation, setLocalLocation] = useState<string>(editingUser?.branch || "");
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    const branchDropdownRef = useRef<HTMLDivElement>(null);
    const [roleDropPos, setRoleDropPos]         = useState({ top: 0, left: 0, width: 0 });
    const [branchDropPos, setBranchDropPos]     = useState({ top: 0, left: 0, width: 0 });
    const [genderDropPos, setGenderDropPos]     = useState({ top: 0, left: 0, width: 0 });
    const [locationDropPos, setLocationDropPos] = useState({ top: 0, left: 0, width: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!isFormOpen) { setIsBranchDropdownOpen(false); setIsGenderDropdownOpen(false); setIsLocationDropdownOpen(false); }
    }, [isFormOpen]);

    useEffect(() => {
        setLocalGender(editingUser?.gender || "");
        setLocalLocation(editingUser?.branch || "");
    }, [editingUser, isFormOpen]);

    return (
        <>
        <AnimatePresence>
        {isFormOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
            <motion.div
                className="absolute inset-0 bg-[#10294C]/40 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }}
            />
            <motion.div
                className="relative w-full max-w-6xl"
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
            >
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
  className="flex-1 overflow-y-scroll p-8 flex flex-col gap-5 custom-scrollbar"
  style={{
    scrollbarWidth: 'thin',
    scrollbarColor: '#10294C #F4F7FB',
  }}
>
    
        
        {/* Profil ve Temel Bilgiler */}
        <div className="flex gap-8 items-end border-b border-neutral-100 pb-5 shrink-0">
            <div className="w-36 h-36 rounded-[24px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden relative shrink-0 shadow-inner group flex items-center justify-center">
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
                        <label className="text-[12px] font-bold text-neutral-500 ml-1">Ad</label>
                        <input name="name" defaultValue={editingUser?.name} placeholder="Örn: Alparslan" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal ${errors.name ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-neutral-500 ml-1">Soyad</label>
                        <input name="surname" defaultValue={editingUser?.surname} placeholder="Örn: Akdağ" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal ${errors.surname ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-neutral-500 ml-1">E-Posta</label>
                        <input name="email" type="email" defaultValue={editingUser?.email} placeholder="ornek@email.com" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal ${errors.email ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-neutral-500 ml-1">Telefon</label>
                        <input name="phone" defaultValue={editingUser?.phone} onChange={(e) => { e.target.value = formatPhoneNumber(e.target.value); }} placeholder="0 (5xx) xxx xx xx" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal ${errors.phone ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
                    </div>
                </div>
            </div>
        </div>

        {/* Rol + Branş + Ünvan + Şube + Cinsiyet + Doğum */}
        <div className="grid grid-cols-4 gap-4 shrink-0">

            {/* Rol */}
            <div className="space-y-1 relative" ref={roleDropdownRef}>
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Rol</label>
                <div onClick={(e) => { if (!isRoleDropdownOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRoleDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsRoleDropdownOpen(!isRoleDropdownOpen); }} className={`h-12 w-full border-2 rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${errors.roles ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : isRoleDropdownOpen ? 'border-orange-500 bg-white' : 'border-neutral-200 bg-neutral-50'}`}>
                    <span className={`text-[13px] truncate ${selectedRoles.length > 0 ? 'font-bold text-[#10294C]' : 'font-semibold text-neutral-400'}`}>{selectedRoles.length > 0 ? selectedRoles.map((r) => r === 'admin' ? 'Admin' : 'Eğitmen').join(', ') : 'Rol Seçiniz...'}</span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isRoleDropdownOpen ? "rotate-180 text-orange-500" : "text-neutral-400"}`} />
                </div>
            </div>

            {/* Branş — Rol'ün yanında, sadece eğitmen seçilince aktif */}
            <div className="space-y-1 relative" ref={branchDropdownRef}>
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Branş</label>
                <div
                    onClick={(e) => { if (selectedRoles.includes('instructor') && availableBranches.length > 0) { if (!isBranchDropdownOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setBranchDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsBranchDropdownOpen(!isBranchDropdownOpen); } }}
                    className={`h-12 w-full border-2 rounded-xl px-4 flex items-center justify-between transition-all duration-200 ${
                        !selectedRoles.includes('instructor')
                            ? 'border-neutral-100 bg-neutral-50 opacity-40 cursor-not-allowed'
                            : isBranchDropdownOpen
                                ? 'border-orange-500 bg-white cursor-pointer'
                                : 'border-neutral-200 bg-neutral-50 cursor-pointer'
                    }`}
                >
                    <span className={`text-[13px] truncate ${selectedBranches.length > 0 ? 'font-bold text-[#10294C]' : 'font-semibold text-neutral-400'}`}>
                        {!selectedRoles.includes('instructor')
                            ? 'Eğitmen rolü gerekli'
                            : selectedBranches.length === 0
                                ? 'Branş Seçiniz...'
                                : availableBranches.filter(b => selectedBranches.includes(b.id)).map(b => b.name).join(', ')}
                    </span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isBranchDropdownOpen ? "rotate-180 text-orange-500" : "text-neutral-400"}`} />
                </div>
            </div>

            {/* Ünvan */}
            <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Ünvan</label>
                <input name="title" defaultValue={editingUser?.title} placeholder="Örn: Grafik Tasarım Eğitmeni" className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal ${errors.title ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
            </div>

            {/* Şube (coğrafi) */}
            <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Şube</label>
                <input type="hidden" name="branch" value={localLocation} />
                <div onClick={(e) => { if (!isLocationDropdownOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setLocationDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsLocationDropdownOpen(!isLocationDropdownOpen); }} className={`h-12 w-full border-2 rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${errors.branch ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : isLocationDropdownOpen ? 'border-orange-500 bg-white' : 'border-neutral-200 bg-neutral-50'}`}>
                    <span className={`text-[13px] ${localLocation ? 'font-bold text-[#10294C]' : 'font-semibold text-neutral-400'}`}>{localLocation || 'Şube Seçiniz...'}</span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isLocationDropdownOpen ? "rotate-180 text-orange-500" : "text-neutral-400"}`} />
                </div>
            </div>

            {/* Cinsiyet */}
            <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Cinsiyet</label>
                <input type="hidden" name="gender" value={localGender} />
                <div onClick={(e) => { if (!isGenderDropdownOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setGenderDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsGenderDropdownOpen(!isGenderDropdownOpen); }} className={`h-12 w-full border-2 rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${errors.gender ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : isGenderDropdownOpen ? 'border-orange-500 bg-white' : 'border-neutral-200 bg-neutral-50'}`}>
                    <span className={`text-[13px] ${localGender ? 'font-bold text-[#10294C]' : 'font-semibold text-neutral-400'}`}>{localGender === 'male' ? 'Erkek' : localGender === 'female' ? 'Kadın' : 'Cinsiyet Seçiniz...'}</span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isGenderDropdownOpen ? "rotate-180 text-orange-500" : "text-neutral-400"}`} />
                </div>
            </div>

            {/* Doğum Tarihi */}
            <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Doğum Tarihi</label>
                <input name="birthDate" defaultValue={editingUser?.birthDate} placeholder="gg.aa.yyyy" type="text" maxLength={10} onInput={(e: React.FormEvent<HTMLInputElement>) => { const t = e.target as HTMLInputElement; let v = t.value.replace(/\D/g, ''); if (v.length > 2) v = v.slice(0, 2) + '.' + v.slice(2); if (v.length > 5) v = v.slice(0, 5) + '.' + v.slice(5, 9); t.value = v; }} className={`h-12 w-full border rounded-xl px-4 font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal outline-none transition-all ${errors.birthDate ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`} />
            </div>

        </div>

        {/* EK YETKİLER */}
        <div className="space-y-4 pb-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[15px] font-bold text-[#10294C]">Ek Yetkiler</p>
                    <p className="text-[12px] text-neutral-400 mt-0.5">Rol dışında tanımlanan özel erişim izinleri</p>
                </div>
                {selectedRoles.includes('admin') && (
                    <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-full">
                        <Lock size={11} className="text-purple-500" />
                        <span className="text-[11px] font-bold text-purple-600">Admin — tüm yetkiler aktif</span>
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-3">
                {permissionsList.map((perm) => {
                    const { isEnabled, roleDefault } = getPermissionStatus(perm.id);
                    const isLocked = selectedRoles.includes('admin');
                    const IconComponent = perm.icon === 'assignment' ? ClipboardList : perm.icon === 'class' ? Users : LayoutDashboard;
                    return (
                        <div
                            key={perm.id}
                            onClick={() => !isLocked && handlePermissionChange(perm.id, !isEnabled)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border-l-[3px] transition-all duration-200 select-none ${
                                isLocked
                                    ? 'bg-purple-50/60 border-l-purple-400 cursor-default'
                                    : isEnabled
                                    ? 'bg-indigo-50/50 border-l-indigo-500 cursor-pointer hover:bg-indigo-50'
                                    : 'bg-neutral-50 border-l-transparent shadow-[inset_0_0_0_1px_theme(colors.neutral.100)] cursor-pointer hover:bg-neutral-100/70'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                isLocked ? 'bg-purple-100 text-purple-500' : isEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-neutral-100 text-neutral-400'
                            }`}>
                                <IconComponent size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-[14px] font-bold leading-tight ${isLocked ? 'text-purple-800' : isEnabled ? 'text-indigo-900' : 'text-neutral-600'}`}>
                                    {perm.label}
                                </p>
                                <p className={`text-[12px] mt-0.5 ${isLocked ? 'text-purple-500' : isEnabled ? 'text-indigo-500' : 'text-neutral-400'}`}>
                                    {perm.description}
                                </p>
                            </div>
                            {/* Toggle */}
                            <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                                isLocked ? 'bg-purple-400' : isEnabled ? 'bg-indigo-500' : 'bg-neutral-200'
                            }`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                    isEnabled || isLocked ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                            </div>
                        </div>
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
            </motion.div>
        </div>
        )}
        </AnimatePresence>

        {/* Rol dropdown portal — document.body'ye render edilir, form transform'undan etkilenmez */}
        {mounted && createPortal(
            <>
                {isRoleDropdownOpen && (
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsRoleDropdownOpen(false)} />
                )}
                <AnimatePresence>
                    {isRoleDropdownOpen && (
                        <motion.div
                            className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden"
                            initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                            exit={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            transition={{ duration: 0.15 }}
                            style={{ transformOrigin: 'top', top: roleDropPos.top, left: roleDropPos.left, width: roleDropPos.width }}
                        >
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </>,
            document.body
        )}

        {/* Cinsiyet dropdown portal — tek seçim, seçince kapanır */}
        {mounted && createPortal(
            <>
                {isGenderDropdownOpen && (
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsGenderDropdownOpen(false)} />
                )}
                <AnimatePresence>
                    {isGenderDropdownOpen && (
                        <motion.div
                            className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden"
                            initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                            exit={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            transition={{ duration: 0.15 }}
                            style={{ transformOrigin: 'top', top: genderDropPos.top, left: genderDropPos.left, width: genderDropPos.width }}
                        >
                            {[{ value: 'male', label: 'Erkek' }, { value: 'female', label: 'Kadın' }].map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        const val = opt.value as 'male' | 'female';
                                        setLocalGender(val);
                                        if (editingUser) setEditingUser({ ...editingUser, gender: val });
                                        if (!avatarId) setAvatarId(1);
                                        setIsGenderDropdownOpen(false);
                                    }}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100"
                                >
                                    <span className="text-[14px] font-medium text-neutral-700">{opt.label}</span>
                                    {localGender === opt.value && <Check size={16} className="text-orange-500" strokeWidth={3} />}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </>,
            document.body
        )}

        {/* Şube (coğrafi) dropdown portal */}
        {mounted && createPortal(
            <>
                {isLocationDropdownOpen && (
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsLocationDropdownOpen(false)} />
                )}
                <AnimatePresence>
                    {isLocationDropdownOpen && (
                        <motion.div
                            className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden"
                            initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                            exit={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            transition={{ duration: 0.15 }}
                            style={{ transformOrigin: 'top', top: locationDropPos.top, left: locationDropPos.left, width: locationDropPos.width }}
                        >
                            {['Kadıköy Şb', 'Şirinevler Şb', 'Pendik Şb'].map(loc => (
                                <div
                                    key={loc}
                                    onClick={() => { setLocalLocation(loc); setIsLocationDropdownOpen(false); }}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100"
                                >
                                    <span className="text-[14px] font-medium text-neutral-700">{loc}</span>
                                    {localLocation === loc && <Check size={16} className="text-orange-500" strokeWidth={3} />}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </>,
            document.body
        )}

        {/* Branş dropdown portal */}
        {mounted && createPortal(
            <>
                {isBranchDropdownOpen && selectedRoles.includes('instructor') && (
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsBranchDropdownOpen(false)} />
                )}
                <AnimatePresence>
                    {isBranchDropdownOpen && selectedRoles.includes('instructor') && (
                        <motion.div
                            className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden"
                            initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                            exit={{ opacity: 0, y: -6, scaleY: 0.92 }}
                            transition={{ duration: 0.15 }}
                            style={{ transformOrigin: 'top', top: branchDropPos.top, left: branchDropPos.left, width: branchDropPos.width }}
                        >
                            {availableBranches.map(b => (
                                <label key={b.id} className="flex items-center gap-3 p-4 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                                    <div className="relative flex items-center justify-center w-[18px] h-[18px] shrink-0">
                                        <input type="checkbox" checked={selectedBranches.includes(b.id)} onChange={() => setSelectedBranches(prev => prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id])} className="peer absolute w-full h-full opacity-0 cursor-pointer z-10" />
                                        <div className="w-full h-full border-2 border-neutral-300 rounded-[4px] peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all" />
                                        <Check size={14} className="absolute text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none" strokeWidth={4} />
                                    </div>
                                    <span className="text-[14px] font-medium text-neutral-700">{b.name}</span>
                                </label>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </>,
            document.body
        )}
        </>
    );
};