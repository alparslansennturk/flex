"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, Settings, ShieldAlert, Check, X, Mail, UserPlus, Camera, Trash2, Edit2, Info, Send, ChevronDown } from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { setDoc, doc, serverTimestamp, collection, onSnapshot, query, deleteDoc } from "firebase/firestore";
import { GlobalConfirmationModal } from "./management-components/Modals";
import { getFlexMessage } from "../../lib/messages"; // Dosya yolun hangisiyse

// Yetki Tipi Tanımı
interface PermissionItem {
    id: string;
    label: string;
}

// Rol Varsayılanları
const ROLE_DEFAULTS: Record<string, string[]> = {
    admin: ["VIEW_ALL_CLASSES", "ASSIGNMENT_MANAGE", "STUDENT_DELETE", "ROLE_MANAGE", "LEAGUE_MANAGE", "BRANCH_STATS"],
    instructor: ["VIEW_ALL_CLASSES", "ASSIGNMENT_MANAGE"],
};

// Yetki Listesi
const permissionsList: PermissionItem[] = [
    { id: "VIEW_ALL_CLASSES", label: "Tüm sınıfları gör" },
    { id: "ASSIGNMENT_MANAGE", label: "Ödev yönetimi" },
    { id: "STUDENT_DELETE", label: "Öğrenci silme" },
    { id: "ROLE_MANAGE", label: "Yetki matrisi" },
    { id: "LEAGUE_MANAGE", label: "Lig yönetimi" },
    { id: "BRANCH_STATS", label: "Şube istatistikleri" },
];

export default function UserManagement() {
    const [isFormOpen, setIsUserFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});
    const [editingUser, setEditingUser] = useState<any>(null);
    const [errors, setErrors] = useState<Record<string, boolean>>({});
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'archive' | 'delete' | 'restore' | 'student-delete' | null;
        userId: string;
    }>({ isOpen: false, type: null, userId: "" });


    // --- KULLANICI DÜZENLEME MOTORU ---
    const handleEditClick = (user: any) => {
        setEditingUser(user);
        // Mevcut rolleri state'e aktar (Form açıldığında checkboxlar dolu gelir)
        setSelectedRoles(user.roles || []);
        // Kullanıcıya özel tanımlanmış yetkileri aktar
        setPermissionOverrides(user.permissionOverrides || {});
        // Formu aç
        setIsUserFormOpen(true);
    };

    // --- KULLANICI SİLME ONAY MEKANİZMASI ---
    const handleDeleteClick = (userId: string) => {
        setModalConfig({
            isOpen: true,
            type: "delete", // TypeScript'in beklediği literal tip
            userId: userId
        });
    };

    useEffect(() => {
        const q = query(collection(db, "users"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Firebase Hatası:", error));
        return () => unsubscribe();
    }, []);
    //Telefon Formatlama Fonksiyonu
    const formatPhoneNumber = (value: string) => {
        let digits = value.replace(/\D/g, "");

        if (digits.length > 0 && !digits.startsWith("0")) {
            digits = "0" + digits;
        }

        digits = digits.substring(0, 11);
        const len = digits.length;

        if (len === 0) return "";
        if (len === 1) return digits;
        if (len <= 4) return `${digits[0]} (${digits.slice(1, 4)}`;
        if (len <= 7) return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}`;
        if (len <= 9) return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)}`;
        return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
    };

    // Yetki Durum Hesaplama
    const getPermissionStatus = (permId: string) => {
        // 1. Seçili rollerden (admin, instructor) gelen varsayılan yetki var mı?
        const roleDefault = selectedRoles.some(role => ROLE_DEFAULTS[role]?.includes(permId)) || false;

        // 2. Eğer manuel müdahale (override) varsa onu al, yoksa rolün varsayılanını göster
        const isOverridden = permissionOverrides[permId] !== undefined;
        const isEnabled = isOverridden ? permissionOverrides[permId] : roleDefault;

        return { isEnabled, roleDefault };
    };

    // Yetki Değiştirme (Clean Override)
    const handlePermissionChange = (permId: string, checked: boolean) => {
        const { roleDefault } = getPermissionStatus(permId);
        setPermissionOverrides(prev => {
            const copy = { ...prev };
            if (checked === roleDefault) { delete copy[permId]; }
            else { copy[permId] = checked; }
            return copy;
        });
    };

    // --- Adım 3: Kullanıcıyı Veritabanına Yazma (Güncelleme ve Yeni Kayıt) ---
    const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Form verilerini al
        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const surname = formData.get("surname") as string;
        const phone = formData.get("phone") as string;
        const email = formData.get("email") as string;
        const title = formData.get("title") as string;
        const birthDate = formData.get("birthDate") as string;
        const gender = formData.get("gender") as string;
        // Checkbox "on" gelirse true, gelmezse false döner
        const isInstructor = formData.get("isInstructor") === "on";

        // --- 1. VALIDATION VE SHAKE KONTROLÜ ---
        let newErrors: Record<string, boolean> = {};
        if (!name) newErrors.name = true;
        if (!surname) newErrors.surname = true;
        if (!title) newErrors.title = true;
        if (!birthDate) newErrors.birthDate = true;
        if (!gender) newErrors.gender = true;
        // Çoklu rol seçilmediyse hata ver
        if (selectedRoles.length === 0) newErrors.roles = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Merkezi sözlükten hata mesajını al
            const errorMsg = getFlexMessage('validation/required-fields');
            alert(errorMsg.text);

            // 500ms sonra shake efektini temizle (tekrar sallanabilmesi için)
            setTimeout(() => setErrors({}), 500);
            return;
        }

        // --- 2. VERİTABANI İŞLEMLERİ ---
        setLoading(true);

        try {
            const userData = {
                name,
                surname,
                phone,
                email,
                title,
                birthDate,
                gender,
                isInstructor,
                roles: selectedRoles, // Artık dizi (Multiple Roles)
                overrides: permissionOverrides,
                updatedAt: serverTimestamp(),
            };

            if (editingUser) {
                // --- DURUM 1: GÜNCELLEME ---
                const userRef = doc(db, "users", editingUser.id);
                await setDoc(userRef, {
                    ...userData,
                    isActivated: editingUser.isActivated || false
                }, { merge: true });

                alert(`${name} ${surname} mühürlendi.`);
            } else {
                // --- DURUM 2: YENİ KAYIT ---
                const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
                const userCredential = await createUserWithEmailAndPassword(auth, email, tempPass);

                await setDoc(doc(db, "users", userCredential.user.uid), {
                    ...userData,
                    uid: userCredential.user.uid,
                    tempPassword: tempPass,
                    isActivated: false,
                    createdAt: serverTimestamp(),
                });

                alert(`Yeni kullanıcı mühürlendi! Geçici şifre: ${tempPass}`);
            }

            // Başarılı işlem sonrası temizlik
            setIsUserFormOpen(false);
            setEditingUser(null);
            setErrors({});
            setPermissionOverrides({});
            setSelectedRoles([]); // Rolleri sıfırla

        } catch (err: any) {
            console.error("İşlem hatası:", err);
            // Firebase'den gelen hata kodunu (örn: auth/email-already-in-use) sözlüğe gönder
            const sysMsg = getFlexMessage(err.code);
            alert(sysMsg.text);
        } finally {
            setLoading(false);
        }
    };

    // --- Kullanıcıyı Sistemden Silme Motoru ---
    const handleDeleteUser = async (user: any) => {
        const confirmDelete = confirm(`${user.name} ${user.surname} kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`);

        if (confirmDelete) {
            try {
                await deleteDoc(doc(db, "users", user.id));
                alert("Kullanıcı sistemden başarıyla kaldırıldı.");
            } catch (err: any) {
                alert("Silme işlemi başarısız: " + err.message);
            }
        }
    };

    const handleRoleToggle = (roleId: string) => {
        const newRoles = selectedRoles.includes(roleId)
            ? selectedRoles.filter(r => r !== roleId)
            : [...selectedRoles, roleId];

        setSelectedRoles(newRoles);

        // MÜHÜR: Admin seçilirse hepsini aç, Admin listeden çıkarsa hepsini temizle
        if (newRoles.includes('admin')) {
            const allFull = permissionsList.reduce((acc, p) => ({ ...acc, [p.id]: true }), {});
            setPermissionOverrides(allFull);
        } else {
            // Admin artık listede yoksa yetkileri sıfırla (Eğitmen varsayılanına döner)
            setPermissionOverrides({});
        }
    };

    const roleDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
                setIsRoleDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- YENİ KULLANICI İÇİN FORMU SIFIRLAYARAK AÇ ---
    const handleOpenNewUserForm = () => {
        setEditingUser(null);
        setSelectedRoles([]);
        setPermissionOverrides({});
        setErrors({});
        setIsUserFormOpen(true);
    };

    const birthDateValue = editingUser?.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(editingUser.birthDate)
        ? editingUser.birthDate
        : "";

    return (
        <div className="max-w-[1920px] mx-auto px-8 mt-[48px] animate-in fade-in duration-700">
            {/* --- SECTION 1: HEADER --- */}
            <div className="flex items-center justify-between pb-8 border-b border-neutral-100">
                <div>
                    <h2 className="text-[24px] font-bold text-[#10294C] tracking-tight">Kullanıcı Yönetimi</h2>
                    <p className="text-neutral-400 text-[14px] mt-1 font-medium italic">Sistem erişimlerini ve yetki matrisini yönetin.</p>
                </div>
                <button onClick={handleOpenNewUserForm} className="bg-[#FF8D28] hover:bg-[#e67e22] text-white px-8 h-[46px] rounded-[12px] font-bold text-[14px] flex items-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer">
                    <UserPlus size={18} strokeWidth={2.5} />
                    <span>Kullanıcı Oluştur</span>
                </button>
            </div>

            {/* --- SECTION 2: USER TABLE --- */}
            <div className="mt-8 bg-white border border-neutral-100 rounded-[20px] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#10294C]/[0.02] border-b border-neutral-100 text-neutral-500 text-[13px] 2xl:text-[15px] font-semibold">
                        <tr>
                            <th className="p-5 2xl:p-6">Kullanıcı</th>
                            <th className="p-5 2xl:p-6">Roller</th>
                            <th className="p-5 2xl:p-6">Ünvan</th>
                            <th className="p-5 2xl:p-6">E-Posta</th>
                            <th className="p-5 2xl:p-6">Telefon</th>
                            <th className="p-5 2xl:p-6 text-center">Durum</th>
                            <th className="p-5 2xl:p-6 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50 text-[14px] 2xl:text-[16px]">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-neutral-50/40 transition-colors group">
                                <td className="p-5 2xl:p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border border-orange-100 overflow-hidden bg-neutral-100 shrink-0">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="Avatar" />
                                        </div>
                                        <p className="font-bold text-[#10294C]">{user.name} {user.surname}</p>
                                    </div>
                                </td>
                                <td className="p-5 2xl:p-6">
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles?.map((r: string) => (
                                            <span key={r} className={`px-2 py-1 rounded-md text-[11px] font-bold border ${r === 'admin' ? 'bg-purple-50 text-[#8B5CF6] border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                {r === 'admin' ? 'Yön' : 'Eğt'}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-5 2xl:p-6 text-[#10294C] font-medium text-[13px]">{user.title || "-"}</td>
                                <td className="p-5 2xl:p-6 text-[13px] text-neutral-600">{user.email}</td>
                                <td className="p-5 2xl:p-6 text-[13px] font-bold text-[#10294C]">{user.phone ? formatPhoneNumber(user.phone) : "-"}</td>
                                <td className="p-5 2xl:p-6 text-center">
                                    <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${user.isActivated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {user.isActivated ? "Aktif" : "Pasif"}
                                    </span>
                                </td>
                                <td className="p-5 2xl:p-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleEditClick(user)} className="p-2 text-neutral-400 hover:text-[#8B5CF6] hover:bg-purple-50 rounded-xl transition-all cursor-pointer"><Settings size={18} /></button>
                                        <button onClick={() => handleDeleteClick(user.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

          {/* --- SECTION 3: FORM MODAL (PLACEHOLDER COLOR & STYLE FIX) --- */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-[#10294C]/60 backdrop-blur-md" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} />
                    
                    {(() => {
                        const isSafari = typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

                        const displayDate = (dateStr: string) => {
                            if (!dateStr || !isSafari) return dateStr || "";
                            const parts = dateStr.split("-");
                            if (parts.length !== 3) return dateStr;
                            return `${parts[2]}.${parts[1]}.${parts[0]}`;
                        };

                        const handleSafariDateChange = (val: string) => {
                            if (!isSafari) return val;
                            const parts = val.split(".");
                            if (parts.length !== 3) return val;
                            return `${parts[2]}-${parts[1]}-${parts[0]}`;
                        };

                        return (
                            <form onSubmit={handleSaveUser} className="relative w-full max-w-6xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col h-[850px] text-[#10294C]">
                                {/* 1. HEADER */}
                                <div className="bg-[#10294C] p-6 text-white flex items-center justify-between shrink-0 border-b border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg"><UserPlus size={20} /></div>
                                        <h3 className="text-[18px] font-bold">{editingUser ? "Hesap Güncelleme" : "Yeni Hesap Tanımlama"}</h3>
                                    </div>
                                    <button type="button" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X size={20} /></button>
                                </div>

                                {/* 2. BODY */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 flex flex-col gap-10">
                                    <div className="flex gap-12 border-b border-neutral-100 pb-12 shrink-0 h-[370px]">
                                        <div className="w-48 h-48 rounded-[32px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden relative shrink-0">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${editingUser?.name || 'flex'}`} className="w-full h-full object-cover" alt="" />
                                        </div>

                                        <div className="flex-1 space-y-6">
                                            {/* SATIR 1: AD & SOYAD */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-1 h-[72px]">
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">Ad</label>
                                                    <input name="name" defaultValue={editingUser?.name} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500 transition-all" />
                                                </div>
                                                <div className="space-y-1 h-[72px]">
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">Soyad</label>
                                                    <input name="surname" defaultValue={editingUser?.surname} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500 transition-all" />
                                                </div>
                                            </div>

                                            {/* SATIR 2: E-POSTA & TELEFON */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-1 h-[72px]">
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">E-Posta</label>
                                                    <input name="email" type="email" defaultValue={editingUser?.email} placeholder="ornek@alanadi.com" className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500 transition-all placeholder:text-neutral-400 placeholder:font-normal" />
                                                </div>
                                                <div className="space-y-1 h-[72px]">
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">Telefon</label>
                                                    <input 
                                                        name="phone" 
                                                        defaultValue={editingUser?.phone} 
                                                        onChange={(e) => { e.target.value = formatPhoneNumber(e.target.value); }} 
                                                        placeholder="0 (5xx) xxx xx xx"
                                                        className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 font-bold outline-none focus:border-orange-500 transition-all placeholder:text-neutral-400 placeholder:font-normal" 
                                                    />
                                                </div>
                                            </div>

                                            {/* SATIR 3: ROL & ÜNVAN */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-1 relative h-[72px]" ref={roleDropdownRef}>
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">Sistem Rolleri</label>
                                                    <div 
                                                        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)} 
                                                        className={`h-12 w-full bg-neutral-50 border rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all ${
                                                            isRoleDropdownOpen ? "border-orange-500 shadow-[0_0_0_2px_rgba(255,141,40,0.1)]" : "border-neutral-200"
                                                        }`}
                                                    >
                                                        <span className="text-[14px] font-bold truncate text-[#10294C]">
                                                            {selectedRoles.length > 0 ? selectedRoles.map(r => r === 'admin' ? 'Admin' : 'Eğitmen').join(', ') : 'Rol Seçiniz...'}
                                                        </span>
                                                        <ChevronDown size={18} className={`transition-transform duration-300 ${isRoleDropdownOpen ? "rotate-180 text-orange-500" : "text-neutral-400"}`} />
                                                    </div>
                                                    {isRoleDropdownOpen && (
                                                        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-neutral-200 shadow-2xl rounded-xl z-[600] overflow-hidden divide-y divide-neutral-100">
                                                            {['admin', 'instructor'].map((r) => (
                                                                <label key={r} className="flex items-center gap-3 p-4 hover:bg-neutral-50 cursor-pointer transition-colors group">
                                                                    <input type="checkbox" checked={selectedRoles.includes(r)} onChange={() => handleRoleToggle(r)} className="w-5 h-5 accent-orange-500 border-neutral-300 rounded cursor-pointer" />
                                                                    <span className="text-[14px] font-bold text-[#10294C]">{r === 'admin' ? 'Admin' : 'Eğitmen'}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1 h-[72px]">
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">Ünvan</label>
                                                    <input name="title" defaultValue={editingUser?.title} placeholder="Örn: Eğitmen | Arı Bilgi" className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500 transition-all placeholder:text-neutral-400 placeholder:font-normal" />
                                                </div>
                                            </div>

                                            {/* SATIR 4: CİNSİYET & DOĞUM TARİHİ */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-1 h-[72px]">
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">Cinsiyet</label>
                                                    <select name="gender" defaultValue={editingUser?.gender} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 outline-none cursor-pointer appearance-none bg-white font-medium text-[#10294C]">
                                                        <option value="" disabled>Seçiniz...</option>
                                                        <option value="male">Erkek</option>
                                                        <option value="female">Kadın</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1 h-[72px]">
                                                    <label className="text-[12px] font-bold text-neutral-400 ml-1">Doğum Tarihi</label>
                                                    <input
                                                        type={isSafari ? "text" : "date"}
                                                        name="birthDate"
                                                        placeholder={isSafari ? "GG.AA.YYYY" : undefined}
                                                        value={displayDate(editingUser?.birthDate)}
                                                        onChange={(e) => {
                                                            const newVal = handleSafariDateChange(e.target.value);
                                                            setEditingUser((prev: any) => ({ ...(prev || {}), birthDate: newVal }));
                                                        }}
                                                        className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500 transition-all placeholder:text-neutral-400 placeholder:font-normal"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. YETKİ MATRİSİ */}
                                    <div className="space-y-7 pb-10">
                                        <div className="flex items-center gap-3 text-[#8B5CF6] font-bold text-[13px] border-l-4 border-[#8B5CF6] pl-4">
                                            <ShieldAlert size={20} /><span>Sistem Erişim Yetki Matrisi</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            {permissionsList.map((perm) => {
                                                const { isEnabled } = getPermissionStatus(perm.id);
                                                return (
                                                    <label key={perm.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${isEnabled ? 'bg-purple-50/50 border-purple-200' : 'bg-white border-neutral-100 hover:border-purple-200'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <input type="checkbox" checked={isEnabled} onChange={(e) => handlePermissionChange(perm.id, e.target.checked)} className="w-5 h-5 rounded border-neutral-300 accent-purple-600 appearance-none checked:appearance-auto" />
                                                            <span className={`text-[14px] font-bold ${isEnabled ? 'text-purple-900' : 'text-neutral-500'}`}>{perm.label}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* 4. FOOTER */}
                                <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-4 shrink-0">
                                    <button type="button" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} className="px-8 font-bold text-neutral-400 hover:text-neutral-600 transition-all cursor-pointer">Vazgeç</button>
                                    <button type="submit" disabled={loading} className="bg-orange-500 text-white px-12 h-12 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-orange-500/10">
                                        {loading ? "İşleniyor..." : "Kaydet"}
                                    </button>
                                </div>
                            </form>
                        );
                    })()}
                </div>
            )}

            {/* --- SECTION 4: MODALLAR --- */}
            <GlobalConfirmationModal
                isOpen={modalConfig.isOpen}
                type={modalConfig.type}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={async () => {
                    if (modalConfig.userId) {
                        setLoading(true);
                        try {
                            await deleteDoc(doc(db, "users", modalConfig.userId));
                            setModalConfig({ isOpen: false, type: null, userId: "" });
                        } catch (err: any) {
                            alert("Hata: " + err.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }}
            />
        </div> // Final Div Kapanışı
    ); // Final Return Kapanışı
} // Final Component Kapanışı