"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, Settings, ShieldAlert, Check, X, Mail, UserPlus, Camera, Trash2, Edit2, Info, Send, ChevronDown, PenLine } from "lucide-react";
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

    const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const surname = formData.get("surname") as string;
        const phone = formData.get("phone") as string;
        const email = formData.get("email") as string;
        const title = formData.get("title") as string;
        const birthDate = formData.get("birthDate") as string;
        const gender = formData.get("gender") as string;
        // --- KRİTİK EKSİK BURASIYDI ---
        const branch = formData.get("branch") as string;
        const isInstructor = formData.get("isInstructor") === "on";

        // --- 1. VALIDATION KONTROLÜ (ALERT SİZ) ---
        let newErrors: Record<string, boolean> = {};
        if (!name) newErrors.name = true;
        if (!surname) newErrors.surname = true;
        if (!email) newErrors.email = true;
        if (!branch) newErrors.branch = true; // Şube boş olamaz
        if (selectedRoles.length === 0) newErrors.roles = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Artık alert vermiyoruz, inputların altındaki kırmızı yazılar devreye girecek
            return;
        }

        setLoading(true);

        try {
            const userData = {
                name,
                surname,
                phone,
                email,
                title,
                branch, // --- FİREBASE'E GİDEN PAKETE EKLENDİ ---
                birthDate,
                gender,
                isInstructor,
                roles: selectedRoles,
                overrides: permissionOverrides,
                updatedAt: serverTimestamp(),
            };

            if (editingUser) {
                const userRef = doc(db, "users", editingUser.id);
                await setDoc(userRef, {
                    ...userData,
                    isActivated: editingUser.isActivated || false
                }, { merge: true });

                // Buraya şık bir Toast Notification gelebilir, şimdilik konsol kalsın
                console.log("Mühürlendi");
            } else {
                const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
                const userCredential = await createUserWithEmailAndPassword(auth, email, tempPass);

                await setDoc(doc(db, "users", userCredential.user.uid), {
                    ...userData,
                    uid: userCredential.user.uid,
                    tempPassword: tempPass,
                    isActivated: false,
                    createdAt: serverTimestamp(),
                });
            }

            // Temizlik ve Kapatma
            setIsUserFormOpen(false);
            setEditingUser(null);
            setErrors({});
            setSelectedRoles([]);
        } catch (err: any) {
            console.error("Hata:", err);
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

    // Arama filtresi ve kullanıcı listesi 
    const [searchTerm, setSearchTerm] = useState("");
    const filteredUsers = users.filter((user: any) =>
        `${user.name} ${user.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                            {filteredUsers.map((user: any) => (
                                <tr key={user.id} className="hover:bg-neutral-50/50 transition-colors group">
                                    {/* 1. KULLANICI */}
                                    <td className="p-5 w-84">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 shadow-sm">
                                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="" />
                                            </div>
                                            <div className="font-bold text-[#10294C] text-[14px]">{user.name} {user.surname}</div>
                                        </div>
                                    </td>

                                    {/* 2. ROLLER */}
                                    <td className="p-5 w-64 text-left">
                                        <div className="flex flex-wrap gap-2">
                                            {user.roles?.map((role: string) => (
                                                <span key={role} className="px-2 py-1 bg-orange-50 text-orange-600 rounded-md text-[13px] font-bold border border-orange-100 shadow-sm">
                                                    {role === 'admin' ? 'Admin' : 'Eğitmen'}
                                                </span>
                                            ))}
                                        </div>
                                    </td>

                                    {/* 3. ÜNVAN */}
                                    <td className="p-5 w-52 text-[13px] text-[#10294C] font-medium text-left">
                                        {user.roles?.includes('admin') ? "Yönetici | Eğitmen" : "Eğitmen"}
                                    </td>

                                    {/* 4. E-POSTA */}
                                    <td className="p-5 w-68 text-[13px] text-neutral-400 text-left truncate">
                                        {user.email}
                                    </td>

                                    {/* 5. TELEFON */}
                                    <td className="p-5 w-56 text-[13px] font-bold text-[#10294C] text-left">
                                        {user.phone || "—"}
                                    </td>

                                    {/* 6. ŞUBE */}
                                    <td className="p-5 w-56 text-left">
                                        <span className="text-[13px] font-semibold text-[#10294C] bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-200">
                                            {user.branch || "Kadıköy Şb"}
                                        </span>
                                    </td>

                                    {/* 7. DURUM */}
                                    <td className="p-5 w-52 text-left">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${user.isActivated ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.isActivated ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                            {user.isActivated ? 'Aktif' : 'Beklemede'}
                                        </span>
                                    </td>

                                    {/* 8. İŞLEM */}
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleEditClick(user)}
                                                className="p-2 text-neutral-400 hover:text-orange-500 transition-colors cursor-pointer"
                                            >
                                                <PenLine size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteClick(user.id)}
                                                className="p-2 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- SECTION 3: HORIZONTAL FORM MODAL --- */}


            {/* --- KULLANICI FORMU: ROL-ÜNVAN-ŞUBE VE ÖZEL CHECKBOX DÜZENİ --- */}
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

                            {/* ÜST BÖLÜM: h-[370px] */}
                            <div className="flex gap-12 border-b border-neutral-100 pb-12 shrink-0 h-[370px]">
                                <div className="w-48 h-48 rounded-[32px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden relative shrink-0 shadow-inner">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${editingUser?.name || 'flex'}`} className="w-full h-full object-cover" />
                                </div>

                                <div className="flex-1 space-y-6">
                                    {/* SATIR 1: AD & SOYAD */}
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

                                    {/* SATIR 2: E-POSTA & TELEFON */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[12px] font-bold text-neutral-400 ml-1">E-Posta</label>
                                            <input name="email" type="email" defaultValue={editingUser?.email} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 text-[15px] outline-none focus:border-orange-500 transition-all" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[12px] font-bold text-neutral-400 ml-1">Telefon</label>
                                            <input name="phone" defaultValue={editingUser?.phone} onChange={(e) => { e.target.value = formatPhoneNumber(e.target.value); }} placeholder="0 (5xx) xxx xx xx" className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 font-bold outline-none focus:border-orange-500" />
                                        </div>
                                    </div>

                                    {/* SATIR 3: ROL | ÜNVAN | ŞUBE (3'LÜ YAPI) */}
                                    <div className="grid grid-cols-3 gap-6">
                                        {/* --- ROL SEÇİM ALANI: KAYMA VE GÖLGE FİX --- */}
                                        <div className="space-y-1 relative h-[72px]" ref={roleDropdownRef}>
                                            <label className="text-[12px] font-bold text-neutral-400 ml-1">Rol</label>
                                            <div
                                                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                                                className={`h-12 w-full bg-neutral-50 border-2 rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${isRoleDropdownOpen ? 'border-orange-500 bg-white' : 'border-neutral-200'
                                                    }`}
                                            >
                                                <span className="text-[14px] font-bold truncate text-[#10294C]">
                                                    {selectedRoles.length > 0
                                                        ? selectedRoles.map(r => r === 'admin' ? 'Admin' : 'Eğitmen').join(', ')
                                                        : 'Seçiniz'}
                                                </span>
                                                <ChevronDown
                                                    size={18}
                                                    className={`transition-transform duration-300 ${isRoleDropdownOpen ? "rotate-180 text-orange-500" : "text-neutral-400"}`}
                                                />
                                            </div>

                                            {/* AÇILIR LİSTE (DROPDOWN) */}
                                            {isRoleDropdownOpen && (
                                                <div className="absolute top-[76px] left-0 w-full bg-white border border-neutral-200 shadow-lg rounded-xl z-[999] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                    {['admin', 'instructor'].map((r: string) => (
                                                        <label key={r} className="flex items-center gap-3 p-4 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                                                            {/* ÖZEL 18x18 CHECKBOX */}
                                                            <div className="relative flex items-center justify-center w-[18px] h-[18px] shrink-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRoles.includes(r)}
                                                                    onChange={() => handleRoleToggle(r)}
                                                                    className="peer absolute w-full h-full opacity-0 cursor-pointer z-10"
                                                                />
                                                                <div className="w-full h-full border-2 border-neutral-300 rounded-[4px] peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all" />
                                                                <Check size={14} className="absolute text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none" strokeWidth={4} />
                                                            </div>
                                                            <span className="text-[14px] font-bold text-[#10294C]">
                                                                {r === 'admin' ? 'Admin' : 'Eğitmen'}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[12px] font-bold text-neutral-400 ml-1">Ünvan</label>
                                            <input name="title" defaultValue={editingUser?.title} placeholder="Örn: Eğitmen | Arı Bilgi" className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[12px] font-bold text-neutral-400 ml-1">Şube</label>
                                            <select name="branch" defaultValue={editingUser?.branch} className={`h-12 w-full bg-neutral-50 border rounded-xl px-3 outline-none cursor-pointer appearance-none font-bold text-[#10294C] ${errors.branch ? 'border-red-500 bg-red-50/30' : 'border-neutral-200 focus:border-orange-500'}`}>
                                                <option value="">Şube Seçiniz</option>
                                                <option value="Kadıköy Şb">Kadıköy Şb</option>
                                                <option value="Şirinevler Şb">Şirinevler Şb</option>
                                                <option value="Pendik Şb">Pendik Şb</option>
                                            </select>
                                            {errors.branch && <span className="text-[11px] font-bold text-red-500 ml-1 animate-in fade-in">{getFlexMessage('validation/required-fields').text}</span>}
                                        </div>
                                    </div>

                                    {/* SATIR 4: CİNSİYET & TARİH (YANYANA) */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[12px] font-bold text-neutral-400 ml-1">Cinsiyet</label>
                                            <select name="gender" defaultValue={editingUser?.gender} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 outline-none cursor-pointer appearance-none bg-white font-medium">
                                                <option value="male">Erkek</option><option value="female">Kadın</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[12px] font-bold text-neutral-400 ml-1">Doğum Tarihi</label>
                                            <input type="date" name="birthDate" defaultValue={editingUser?.birthDate} className="h-12 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 outline-none focus:border-orange-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. YETKİ MATRİSİ (18x18 CHECKBOX UYGULANDI) */}
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
                                                    <div className="relative flex items-center justify-center w-[18px] h-[18px] shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={isEnabled}
                                                            onChange={(e) => handlePermissionChange(perm.id, e.target.checked)}
                                                            className="peer absolute w-full h-full opacity-0 cursor-pointer z-10"
                                                        />
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