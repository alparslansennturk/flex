"use client";
import React, { useState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc, serverTimestamp, collection, onSnapshot, query, deleteDoc } from "firebase/firestore";
import { GlobalConfirmationModal } from "./management-components/Modals";
import { UserTable } from "./management-components/UserTable";
import { UserForm } from "./management-components/UserForm";
import { MASTER_ID } from "../../lib/constants";
const ROLE_DEFAULTS: Record<string, string[]> = {
    admin: ["VIEW_ALL_CLASSES", "ASSIGNMENT_MANAGE", "STUDENT_DELETE", "ROLE_MANAGE", "LEAGUE_MANAGE", "BRANCH_STATS"],
    instructor: ["VIEW_ALL_CLASSES", "ASSIGNMENT_MANAGE"],
};
const permissionsList = [
    { id: "VIEW_ALL_CLASSES", label: "Tüm sınıfları gör" },
    { id: "ASSIGNMENT_MANAGE", label: "Ödev yönetimi" },
    { id: "STUDENT_DELETE", label: "Öğrenci silme" },
    { id: "ROLE_MANAGE", label: "Yetki matrisi" },
    { id: "LEAGUE_MANAGE", label: "Lig yönetimi" },
    { id: "BRANCH_STATS", label: "Şube istatistikleri" },
];
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

export default function UserManagement() {
    const [isFormOpen, setIsUserFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [errors, setErrors] = useState<Record<string, boolean>>({});
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalConfig, setModalConfig] = useState<any>({ isOpen: false, type: null, userId: "" });
    const [avatarId, setAvatarId] = useState<number>(1);
    const [shake, setShake] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "users"));
        return onSnapshot(q, (snapshot) => {
            const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(allUsers.filter((u: any) => u.id !== MASTER_ID));
        }, (error) => console.error("Firebase Hatası:", error));
    }, []);

  const handleEditClick = (user: UserData) => { // 👈 any gitti, UserData geldi
    setEditingUser(user);
    setSelectedRoles(user.roles || []);
    setPermissionOverrides(user.permissionOverrides || {});
    
    // Veritabanındaki avatarId'yi sayıya zorlayarak alıyoruz
    const savedAvatarId = typeof user.avatarId === 'number' ? user.avatarId : Number(user.avatarId || 1);
    setAvatarId(savedAvatarId); 
    
    setIsUserFormOpen(true);
};

    const formatPhoneNumber = (value: string) => {
        let digits = value.replace(/\D/g, "");
        if (digits.length > 0 && !digits.startsWith("0")) digits = "0" + digits;
        digits = digits.substring(0, 11);
        const len = digits.length;
        if (len <= 1) return digits;
        if (len <= 4) return `${digits[0]} (${digits.slice(1, 4)}`;
        if (len <= 7) return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}`;
        if (len <= 9) return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)}`;
        return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
    };

    const getPermissionStatus = (permId: string) => {
        const roleDefault = selectedRoles.some(role => ROLE_DEFAULTS[role]?.includes(permId));
        const isOverridden = permissionOverrides[permId] !== undefined;
        return { isEnabled: isOverridden ? permissionOverrides[permId] : roleDefault, roleDefault };
    };

    const handlePermissionChange = (permId: string, checked: boolean) => {
        const { roleDefault } = getPermissionStatus(permId);
        setPermissionOverrides(prev => {
            const copy = { ...prev };
            if (checked === roleDefault) delete copy[permId];
            else copy[permId] = checked;
            return copy;
        });
    };

    const handleRoleToggle = (roleId: string) => {
        const newRoles = selectedRoles.includes(roleId) ? selectedRoles.filter(r => r !== roleId) : [...selectedRoles, roleId];
        setSelectedRoles(newRoles);
        if (newRoles.includes('admin')) {
            setPermissionOverrides(permissionsList.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}));
        } else {
            setPermissionOverrides({});
        }
    };

    const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErrors({});
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());

    let newErrors: Record<string, boolean> = {};
    if (!data.name) newErrors.name = true; if (!data.surname) newErrors.surname = true;
    if (!data.email) newErrors.email = true; if (!data.phone) newErrors.phone = true;
    if (!data.branch) newErrors.branch = true; if (!data.gender) newErrors.gender = true;
    if (!data.title) newErrors.title = true; if (!data.birthDate) newErrors.birthDate = true;
    if (selectedRoles.length === 0) newErrors.roles = true;

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); setShake(true); setTimeout(() => setShake(false), 500); return; }
    setLoading(true);

    try {
        const finalUserData = { 
            ...data, 
            avatarId: Number(avatarId), // 👈 İşte burası! Kesin rakam olarak gitsin.
            roles: selectedRoles, 
            permissionOverrides: permissionOverrides, 
            updatedAt: serverTimestamp() 
        };

        if (editingUser) {
            await setDoc(doc(db, "users", editingUser.id), { ...finalUserData, isActivated: editingUser.isActivated || false }, { merge: true });
        } else {
            const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
            const { initializeApp, deleteApp } = await import("firebase/app");
            const { getAuth, createUserWithEmailAndPassword: createSecondaryUser } = await import("firebase/auth");
            const secondaryApp = initializeApp(auth.app.options, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createSecondaryUser(secondaryAuth, data.email, tempPass);
            await setDoc(doc(db, "users", userCredential.user.uid), { ...finalUserData, uid: userCredential.user.uid, tempPassword: tempPass, isActivated: false, createdAt: serverTimestamp() });
            await deleteApp(secondaryApp);
        }

        setIsSuccess(true);
        setTimeout(() => { setIsUserFormOpen(false); setEditingUser(null); setErrors({}); setPermissionOverrides({}); setSelectedRoles([]); setIsSuccess(false); }, 1000);
    } catch (err: any) { console.error("Hata:", err); setErrors({ firebaseError: true }); } finally { setLoading(false); }
};

    const roleDropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handle = (e: any) => { if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) setIsRoleDropdownOpen(false); };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    return (
        <div className="max-w-[1920px] mx-auto px-8 mt-[48px] animate-in fade-in duration-700">
            <div className="flex items-center justify-between pb-8 border-b border-neutral-100">
                <div>
                    <h2 className="text-[24px] font-bold text-[#10294C]">Kullanıcı Yönetimi</h2>
                    <p className="text-neutral-400 text-[14px] mt-1 font-medium italic">Sistem erişimlerini ve yetki matrisini yönetin.</p>
                </div>
               <button onClick={() => { setEditingUser(null); setSelectedRoles([]); setPermissionOverrides({}); setErrors({}); setAvatarId(Math.floor(Math.random() * 70) + 1); setIsUserFormOpen(true); }} className="bg-[#FF8D28] text-white px-8 h-[46px] rounded-[12px] font-bold text-[14px] flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"><UserPlus size={18} /><span>Kullanıcı Oluştur</span></button>
            </div>

            <UserTable users={users} onEdit={handleEditClick} onDelete={(id: string) => setModalConfig({ isOpen: true, type: "delete", userId: id })} />

            <UserForm
                key={editingUser ? editingUser.id : "new-user-form"} // 👈 SİHİRLİ SATIR: Hafızayı bu temizler
                isFormOpen={isFormOpen}
                setIsUserFormOpen={setIsUserFormOpen}
                editingUser={editingUser}
                setEditingUser={setEditingUser}
                handleSaveUser={handleSaveUser}
                errors={errors}
                shake={shake}
                selectedRoles={selectedRoles}
                isRoleDropdownOpen={isRoleDropdownOpen}
                setIsRoleDropdownOpen={setIsRoleDropdownOpen}
                handleRoleToggle={handleRoleToggle}
                roleDropdownRef={roleDropdownRef}
                formatPhoneNumber={formatPhoneNumber}
                permissionsList={permissionsList}
                getPermissionStatus={getPermissionStatus}
                handlePermissionChange={handlePermissionChange}
                loading={loading}
                isSuccess={isSuccess}
                avatarId={avatarId}      
                setAvatarId={setAvatarId} 
            />

            <GlobalConfirmationModal
                isOpen={modalConfig.isOpen} type={modalConfig.type}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={async () => {
                    setLoading(true);
                    try {
                        await fetch('/api/delete-user', { method: 'POST', body: JSON.stringify({ uid: modalConfig.userId }), headers: { 'Content-Type': 'application/json' } });
                        await deleteDoc(doc(db, "users", modalConfig.userId));
                        setUsers(prev => prev.filter(u => u.id !== modalConfig.userId));
                        setModalConfig({ isOpen: false, type: null, userId: "" });
                    } catch (err) { console.error(err); } finally { setLoading(false); }
                }}
            />
        </div>
    );
}