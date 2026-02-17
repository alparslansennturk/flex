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

    return (
        <div className="max-w-[1920px] mx-auto px-8 mt-[48px] animate-in fade-in duration-700">

            {/* --- SECTION 1: HEADER --- */}
            <div className="flex items-center justify-between pb-8 border-b border-neutral-100">
                <div>
                    <h2 className="text-[24px] font-bold text-[#10294C] tracking-tight">Kullanıcı Yönetimi</h2>
                    <p className="text-neutral-400 text-[14px] mt-1 font-medium italic">Sistem erişimlerini ve yetki matrisini yönetin.</p>
                </div>
                {/* İŞTE DEĞİŞEN BUTON BURASI */}
                <button
                    onClick={handleOpenNewUserForm}
                    className="bg-[#FF8D28] hover:bg-[#e67e22] text-white px-8 h-[46px] rounded-[12px] font-bold text-[14px] flex items-center gap-2 transition-all shadow-lg shadow-orange-500/10 active:scale-95 cursor-pointer"
                >
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
                                {/* Kullanıcı Bilgisi */}
                                <td className="p-5 2xl:p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border border-orange-100 overflow-hidden bg-neutral-100 shrink-0">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="Avatar" />
                                        </div>
                                        <p className="font-bold text-[#10294C] text-[14px] 2xl:text-[16px]">{user.name} {user.surname}</p>
                                    </div>
                                </td>

                                {/* Çoklu Roller */}
                                <td className="p-5 2xl:p-6">
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles?.map((r: string) => (
                                            <span key={r} className={`px-2 py-1 rounded-md text-[11px] font-bold border ${r === 'admin' ? 'bg-purple-50 text-[#8B5CF6] border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                {r === 'admin' ? 'Yön' : 'Eğt'}
                                            </span>
                                        )) || <span className="text-neutral-300 text-[11px]">Tanımsız</span>}
                                    </div>
                                </td>

                                {/* Manuel Ünvan */}
                                <td className="p-5 2xl:p-6 text-[#10294C] font-medium text-[13px]">
                                    {user.title || "-"}
                                </td>

                                {/* E-Posta (Ayrıldı) */}
                                <td className="p-5 2xl:p-6">
                                    <p className="text-[13px] text-neutral-600 truncate max-w-[180px]">{user.email}</p>
                                </td>

                                {/* Telefon (Ayrıldı) */}
                                <td className="p-5 2xl:p-6">
                                    <p className="text-[13px] text-[#10294C] font-bold">{user.phone ? formatPhoneNumber(user.phone) : "Tel Yok"}</p>
                                </td>

                                {/* Durum */}
                                <td className="p-5 2xl:p-6 text-center">
                                    <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${user.isActivated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {user.isActivated ? "Aktif" : "Pasif"}
                                    </span>
                                </td>

                                {/* İşlemler */}
                                <td className="p-5 2xl:p-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleEditClick(user)} className="p-2 text-neutral-400 hover:text-[#8B5CF6] hover:bg-purple-50 rounded-xl transition-all cursor-pointer">
                                            <Settings size={18} />
                                        </button>
                                        <button onClick={() => setModalConfig({ isOpen: true, type: 'delete', userId: user.id })} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- SECTION 3: HORIZONTAL FORM MODAL --- */}


           {/* --- KULLANICI FORMU: E-POSTA KİLİDİ AÇILMIŞ VE SABİTLENMİŞ YAPI --- */}
{isFormOpen && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="absolute inset-0 bg-[#10294C]/60 backdrop-blur-md" 
             onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} />

        <form onSubmit={handleSaveUser} className="relative w-full max-w-6xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col h-[850px] text-[#10294C]">
            
            {/* 1. HEADER */}
            <div className="bg-[#10294C] p-6 text-white flex items-center justify-between shrink-0 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg"><UserPlus size={20} /></div>
                    <h3 className="text-[18px] font-bold">{editingUser ? "Hesap Güncelleme" : "Yeni Hesap Tanımlama"}</h3>
                </div>
                <button type="button" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors"><X size={20} /></button>
            </div>

            {/* 2. BODY */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 flex flex-col gap-10">
                
                {/* ÜST BÖLÜM: h-[370px] BETON SABİTLİK */}
                <div className="flex gap-12 border-b border-neutral-100 pb-12 shrink-0 h-[370px]">
                    <div className="w-48 h-48 rounded-[32px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden relative shrink-0 shadow-inner">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${editingUser?.name || 'flex'}`} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[12px] font-bold text-neutral-400 ml-1">Ad</label>
                                <input name="name" defaultValue={editingUser?.name} className={`h-12 w-full bg-neutral-50 border rounded-xl px-4 outline-none focus:border-orange-500 transition-all ${errors.name ? 'border-red-500 animate-shake' : 'border-neutral-200'}`} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[12px] font-bold text-neutral-400 ml-1">Soyad</label>
                                <input name="surname" defaultValue={editingUser?.surname} className={`h-12 w-full bg-neutral-50 border rounded-xl px-4 outline-none focus:border-orange-500 transition-all ${errors.surname ? 'border-red-500 animate-shake' : 'border-neutral-200'}`} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[12px] font-bold text-neutral-400 ml-1">E-Posta</label>
                                {/* DÜZENLENEBİLİR E-POSTA */}
                                <input name="email" type="email" defaultValue={editingUser?.email} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 text-[15px] outline-none focus:border-orange-500 transition-all" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[12px] font-bold text-neutral-400 ml-1">Telefon</label>
                                {/* TELEFON FORMATI GERİ GELDİ */}
                                <input name="phone" defaultValue={editingUser?.phone} onChange={(e) => { e.target.value = formatPhoneNumber(e.target.value); }} placeholder="0 (5xx) xxx xx xx" className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 font-bold outline-none focus:border-orange-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-1 relative" ref={roleDropdownRef}>
                                <label className="text-[12px] font-bold text-neutral-400 ml-1">Sistem Rolleri</label>
                                <div onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)} className={`h-12 w-full bg-neutral-50 border rounded-xl px-4 flex items-center justify-between cursor-pointer ${isRoleDropdownOpen ? 'border-orange-500 ring-2 ring-orange-50' : 'border-neutral-200'}`}>
                                    <span className="text-[14px] font-bold truncate">{selectedRoles.length > 0 ? selectedRoles.map(r => r === 'admin' ? 'Admin' : 'Eğitmen').join(', ') : 'Seçiniz'}</span>
                                    <ChevronDown size={18} />
                                </div>
                                {isRoleDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-neutral-100 shadow-2xl rounded-xl z-[500] overflow-hidden">
                                        {['admin', 'instructor'].map((r) => (
                                            <label key={r} className="flex items-center gap-3 p-4 hover:bg-neutral-50 cursor-pointer border-b last:border-0 transition-colors">
                                                <input type="checkbox" checked={selectedRoles.includes(r)} onChange={() => handleRoleToggle(r)} className="w-5 h-5 accent-orange-500" />
                                                <span className="text-[14px] font-bold">{r === 'admin' ? 'Admin' : 'Eğitmen'}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[12px] font-bold text-neutral-400 ml-1">Ünvan</label>
                                <input name="title" defaultValue={editingUser?.title} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[12px] font-bold text-neutral-400 ml-1">Cinsiyet</label>
                                <select name="gender" defaultValue={editingUser?.gender} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 outline-none cursor-pointer">
                                    <option value="male">Erkek</option><option value="female">Kadın</option>
                                </select>
                            </div>
                        </div>

                        <div className="w-1/3 space-y-1">
                            <label className="text-[12px] font-bold text-neutral-400 ml-1">Doğum Tarihi</label>
                            <input type="date" name="birthDate" defaultValue={editingUser?.birthDate} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500" />
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
                                <label key={perm.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${isEnabled ? 'bg-purple-50/50 border-purple-200' : 'bg-white border-neutral-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={isEnabled} onChange={(e) => handlePermissionChange(perm.id, e.target.checked)} className="w-5 h-5 rounded accent-purple-600" />
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
                <button type="button" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} className="px-8 font-bold text-neutral-400 hover:text-neutral-600 cursor-pointer transition-all">Vazgeç</button>
                <button type="submit" disabled={loading} className="bg-orange-500 text-white px-12 h-12 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-orange-500/10">
                    {loading ? "Mühürleniyor..." : "Kaydet"}
                </button>
            </div>
        </form>
    </div>
)}
            {/* --- MODALLAR --- */}
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
        </div>
    );
} 