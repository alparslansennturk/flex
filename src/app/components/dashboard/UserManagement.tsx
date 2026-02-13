"use client";
import React, { useState, useEffect } from "react";
import { Search, Settings, ShieldAlert, Check, X, Mail, UserPlus, Camera, Trash2, Edit2, Info, Send } from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { setDoc, doc, serverTimestamp, collection, onSnapshot, query, deleteDoc } from "firebase/firestore";
import { GlobalConfirmationModal } from "./management-components/Modals";

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
    const [selectedRole, setSelectedRole] = useState("instructor");
    const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});
    const [editingUser, setEditingUser] = useState<any>(null);
    const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'archive' | 'delete' | 'restore' | 'student-delete' | null;
    userId: string;
  }>({ isOpen: false, type: null, userId: "" });


    // --- Kullanıcı Düzenleme ve Veri Yükleme Motoru ---
    const handleEditClick = (user: any) => {
        setEditingUser(user); // Seçilen kullanıcının tüm bilgilerini hafızaya alır
        setSelectedRole(user.role || "instructor"); // Mevcut rolünü seçili getirir
        setPermissionOverrides(user.overrides || {}); // Varsa daha önceden atanmış özel yetkilerini yükler
        setIsUserFormOpen(true); // Form modalını otomatik açar
    };

    // Veri Çekme (Real-time) - Koleksiyon ismini senin belirttiğin gibi "users" (küçük u) yaptık.
    // Not: Eğer kayıtlarında createdAt yoksa orderBy hata verebilir, o yüzden şimdilik sade çekiyoruz.
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
        const roleDefault = ROLE_DEFAULTS[selectedRole]?.includes(permId) || false;
        const isOverridden = permissionOverrides[permId] !== undefined;
        const isEnabled = isOverridden ? permissionOverrides[permId] : roleDefault;
        const source = isOverridden ? 'Özel' : (roleDefault ? 'Rol' : null);
        return { isEnabled, source, roleDefault };
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
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const surname = formData.get("surname") as string;
        const phone = formData.get("phone") as string;
        const email = formData.get("email") as string;

        try {
            if (editingUser) {
                // --- DURUM 1: MEVCUT KULLANICIYI MODERNİZE ET (GÜNCELLE) ---
                const userRef = doc(db, "users", editingUser.id);

                await setDoc(userRef, {
                    name: name,
                    surname: surname,
                    phone: phone,
                    role: selectedRole,
                    overrides: permissionOverrides,
                    isInstructor: selectedRole === "instructor",
                    updatedAt: serverTimestamp(),
                    // Eski veride isActivated yoksa bile artık mühürlüyoruz:
                    isActivated: editingUser.isActivated || false
                }, { merge: true }); // merge: true sayesinde Auth şifresine veya UID'ye dokunmaz

                alert(`${name} ${surname} bilgileri başarıyla güncellendi.`);
            }
            else {
                // --- DURUM 2: SIFIRDAN YENİ KULLANICI OLUŞTUR ---
                const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
                const userCredential = await createUserWithEmailAndPassword(auth, email, tempPass);

                await setDoc(doc(db, "users", userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    name: name,
                    surname: surname,
                    email: email,
                    phone: phone,
                    role: selectedRole,
                    overrides: permissionOverrides,
                    isInstructor: selectedRole === "instructor",
                    tempPassword: tempPass,
                    isActivated: false,
                    createdAt: serverTimestamp(),
                });

                alert(`Yeni kullanıcı mühürlendi! Geçici şifre: ${tempPass}`);
            }

            // İşlem bitince her şeyi temizle ve kapat
            setIsUserFormOpen(false);
            setEditingUser(null);
            setPermissionOverrides({});

        } catch (err: any) {
            console.error("İşlem hatası:", err);
            alert("Bir hata oluştu: " + err.message);
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

    return (
        <div className="max-w-[1920px] mx-auto px-8 mt-[48px] animate-in fade-in duration-700">

            {/* --- SECTION 1: HEADER --- */}
            <div className="flex items-center justify-between pb-8 border-b border-neutral-100">
                <div>
                    <h2 className="text-[24px] font-bold text-[#10294C] tracking-tight">Kullanıcı Yönetimi</h2>
                    <p className="text-neutral-400 text-[14px] mt-1 font-medium italic">Sistem erişimlerini ve yetki matrisini yönetin.</p>
                </div>
                <button onClick={() => setIsUserFormOpen(true)} className="bg-[#FF8D28] hover:bg-[#e67e22] text-white px-8 h-[46px] rounded-[12px] font-bold text-[14px] flex items-center gap-2 transition-all shadow-lg shadow-orange-500/10 active:scale-95 cursor-pointer">
                    <UserPlus size={18} strokeWidth={2.5} />
                    <span>Kullanıcı Oluştur</span>
                </button>
            </div>

            {/* --- SECTION 2: USER TABLE --- */}
            <div className="mt-8 bg-white border border-neutral-100 rounded-[20px] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#10294C]/[0.02] border-b border-neutral-100 text-neutral-500 text-[14px] 2xl:text-[16px] font-semibold">
                        <tr>
                            <th className="p-6 2xl:p-8">Kullanıcı bilgisi</th>
                            <th className="p-6 2xl:p-8">Rol</th>
                            <th className="p-6 2xl:p-8">E-Posta</th>
                            <th className="p-6 2xl:p-8">Telefon</th>
                            <th className="p-6 2xl:p-8 text-center">Durum</th>
                            <th className="p-6 2xl:p-8 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50 text-[14px] 2xl:text-[16px]">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-neutral-50/40 transition-colors group">
                                {/* Kullanıcı Bilgisi */}
                                <td className="p-6 2xl:p-8 flex items-center gap-4">
                                    <div className="w-11 h-11 2xl:w-14 2xl:h-14 rounded-full border border-orange-100 overflow-hidden bg-neutral-100 shrink-0 shadow-sm">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="Avatar" />
                                    </div>
                                    <p className="font-bold text-[#10294C] text-[15px] 2xl:text-[18px]">{user.name} {user.surname}</p>
                                </td>

                                {/* Rol */}
                                <td className="p-6 2xl:p-8">
                                    <span className={`px-3 py-1.5 rounded-lg text-[13px] 2xl:text-[15px] font-semibold border ${user.role === 'admin' ? 'bg-purple-50 text-[#8B5CF6] border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                        {user.role === 'admin' ? 'Yönetici' : 'Eğitmen'}
                                    </span>
                                </td>

                                {/* E-Posta */}
                                <td className="p-6 2xl:p-8 text-neutral-600 font-medium lowercase first-letter:uppercase">
                                    {user.email}
                                </td>

                                {/* Telefon */}
                                <td className="p-6 2xl:p-8 text-[#10294C] font-semibold">
                                    {user.phone ? formatPhoneNumber(user.phone) : "Belirtilmedi"}
                                </td>

                                {/* Durum */}
                                <td className="p-6 2xl:p-8 text-center">
                                    <span className={`px-3 py-1.5 rounded-lg text-[12px] 2xl:text-[14px] font-semibold ${user.isActivated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {user.isActivated ? "Aktif" : "Pasif"}
                                    </span>
                                </td>

                                {/* İşlemler */}
                                <td className="p-6 2xl:p-8 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => handleEditClick(user)}
                                            className="p-2.5 text-neutral-400 hover:text-[#8B5CF6] transition-colors cursor-pointer bg-neutral-50 hover:bg-purple-50 rounded-xl"
                                        >
                                            <Settings size={22} />
                                        </button>
                                        <button
                                            onClick={() => setModalConfig({ isOpen: true, type: 'delete', userId: user.id })}
                                            className="p-2.5 text-neutral-400 hover:text-red-500 bg-neutral-50 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                        >
                                            <Trash2 size={22} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- SECTION 3: HORIZONTAL FORM MODAL --- */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-[#10294C]/60 backdrop-blur-md"
                        onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} />

                    <form onSubmit={handleSaveUser} className="relative w-full max-w-5xl bg-white rounded-[12px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 flex flex-col text-[#10294C]">

                        <div className="bg-[#10294C] p-6 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#FF8D28] rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                                    {editingUser ? <Settings size={20} /> : <UserPlus size={20} />}
                                </div>
                                <div>
                                    {/* Başlık Dinamik Oldu: Düzenleme mi Yeni Kayıt mı? */}
                                    <h3 className="text-[18px] font-bold">
                                        {editingUser ? "Hesap Güncelleme" : "Hesap Tanımlama"}
                                    </h3>
                                    <p className="text-white/50 text-[12px]">
                                        {editingUser ? `${editingUser.name} kullanıcısının bilgilerini modernize edin.` : "Hoca yetkilerini bu ekrandan finalize edin."}
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X size={20} /></button>
                        </div>

                        <div className="p-10 flex gap-12 max-h-[75vh] overflow-y-auto custom-scrollbar bg-white">
                            {/* AVATAR UPLOAD */}
                            <div className="flex flex-col items-center gap-4 shrink-0">
                                <div className="relative group">
                                    <div className="w-40 h-40 rounded-[24px] bg-neutral-50 border-2 border-dashed border-neutral-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-[#FF8D28]/50">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${editingUser?.name || 'newuser'}`}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <button type="button" className="absolute -bottom-2 -right-2 bg-[#FF8D28] text-white p-2.5 rounded-xl shadow-lg hover:scale-110 transition-all cursor-pointer border-2 border-white"><Edit2 size={16} /></button>
                                </div>
                                <p className="text-[11px] font-bold text-neutral-400 text-center tracking-wide">Profil Fotoğrafı</p>
                            </div>

                            {/* FORM FIELDS */}
                            <div className="flex-1 space-y-8">
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Her inputa defaultValue ekledik hocam */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-semibold text-[#10294C]">Ad</label>
                                        <input name="name" required type="text" defaultValue={editingUser?.name || ""} className="h-11 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-[14px] focus:border-[#FF8D28] outline-none transition-all shadow-sm" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-semibold text-[#10294C]">Soyad</label>
                                        <input name="surname" required type="text" defaultValue={editingUser?.surname || ""} className="h-11 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-[14px] focus:border-[#FF8D28] outline-none transition-all shadow-sm" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-semibold text-[#10294C]">E-Posta</label>
                                        <input
                                            name="email"
                                            required
                                            type="email"
                                            defaultValue={editingUser?.email || ""}
                                            disabled={!!editingUser} // Düzenleme yaparken e-posta kilitli (Güvenlik)
                                            className="h-11 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-[14px] focus:border-[#FF8D28] outline-none transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-semibold text-[#10294C]">Telefon</label>
                                        <input
                                            name="phone"
                                            required
                                            type="tel"
                                            placeholder="0 (5XX) XXX XX XX"
                                            maxLength={17}
                                            defaultValue={editingUser?.phone || ""}
                                            onChange={(e) => {
                                                e.target.value = formatPhoneNumber(e.target.value);
                                            }}
                                            className="h-11 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-[14px] focus:border-[#FF8D28] outline-none transition-all shadow-sm font-semibold text-[#10294C]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5 col-span-2">
                                        <label className="text-[11px] font-semibold text-[#10294C]">Sistem Rolü</label>
                                        <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="h-11 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-[14px] focus:border-[#FF8D28] font-bold cursor-pointer outline-none shadow-sm">
                                            <option value="instructor">Eğitmen (Trainer)</option>
                                            <option value="admin">Yönetici (Admin)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3 text-[12px] text-blue-700">
                                    <Info size={18} className="text-blue-500 shrink-0" />
                                    <p>Rol değiştiğinde varsayılan yetkiler güncellenir. <span className="font-bold underline">Özel</span> seçimler korunur.</p>
                                </div>

                                {/* PERMISSION MATRIX */}
                                <div className="pt-8 border-t border-neutral-100">
                                    <div className="flex items-center gap-2 mb-6 text-[#8B5CF6] font-semibold tracking-wide">
                                        <ShieldAlert size={18} />
                                        <span>Yetki Matrisi</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                                        {permissionsList.map((perm) => {
                                            const { isEnabled, source } = getPermissionStatus(perm.id);
                                            return (
                                                <label key={perm.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-100 hover:border-[#8B5CF6]/30 cursor-pointer transition-all group shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isEnabled}
                                                                onChange={(e) => handlePermissionChange(perm.id, e.target.checked)}
                                                                className="peer appearance-none w-5 h-5 border-2 border-neutral-300 rounded-md checked:bg-[#8B5CF6] checked:border-[#8B5CF6] transition-all"
                                                            />
                                                            <Check size={14} className="absolute text-white scale-0 peer-checked:scale-100 transition-transform stroke-[4px]" />
                                                        </div>
                                                        <span className="text-[13px] font-semibold text-neutral-600 group-hover:text-[#10294C] transition-colors">{perm.label}</span>
                                                    </div>
                                                    {source && (
                                                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold shadow-sm ${source === 'Özel' ? 'bg-[#FF8D28] text-white' : 'bg-purple-100 text-[#8B5CF6]'}`}>
                                                            {source}
                                                        </span>
                                                    )}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }}
                                className="px-8 h-12 rounded-lg font-bold text-neutral-400 hover:text-neutral-600 transition-all cursor-pointer"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-[#FF8D28] hover:bg-[#e67e22] text-white px-12 h-12 rounded-lg font-bold text-[14px] transition-all shadow-lg shadow-orange-500/10 active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {loading ? "İşleniyor..." : (editingUser ? "Değişiklikleri Kaydet" : "Kullanıcıyı Kaydet")}
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