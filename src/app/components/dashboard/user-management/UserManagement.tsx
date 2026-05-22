"use client";
import React, { useState, useEffect, useRef } from "react";
import { UserPlus, Users, GraduationCap } from "lucide-react";
import { auth, db } from "@/app/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc, serverTimestamp, collection, onSnapshot, query, deleteDoc } from "firebase/firestore";
import { GlobalConfirmationModal } from "../management-components/Modals";
import { UserTable } from "./UserTable";
import { UserForm } from "./UserForm";
import { StudentUserTable } from "./StudentUserTable";
import { StudentQuickEditModal } from "./StudentQuickEditModal";
import { MASTER_ID } from "@/app/lib/constants";
const ROLE_DEFAULTS: Record<string, string[]> = {
    admin: ["ASSIGNMENT_MANAGE", "CLASS_MANAGE", "MANAGEMENT_PANEL"],
    instructor: [],
};
const permissionsList = [
    {
        id: "ASSIGNMENT_MANAGE",
        label: "Ödev Yönetimi",
        description: "Ödev oluşturma, düzenleme ve yayınlama",
        icon: "assignment",
    },
    {
        id: "CLASS_MANAGE",
        label: "Sınıf Yönetimi",
        description: "Tüm şubelerdeki sınıfları ve öğrencileri yönetme",
        icon: "class",
    },
    {
        id: "MANAGEMENT_PANEL",
        label: "Yönetim Paneli",
        description: "Yönetim paneline erişim ve düzenleme",
        icon: "panel",
    },
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
    const [activeTab, setActiveTab] = useState<'users' | 'students'>(() =>
        (sessionStorage.getItem("usermgmt_active_tab") as 'users' | 'students') ?? 'users'
    );
    const [isFormOpen, setIsUserFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [editingStudent, setEditingStudent] = useState<any | null>(null);
    const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [errors, setErrors] = useState<Record<string, boolean>>({});
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalConfig, setModalConfig] = useState<any>({ isOpen: false, type: null, userId: "", isStudent: false });
    const [avatarId, setAvatarId] = useState<number>(1);
    const [shake, setShake] = useState(false);
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        const q = query(collection(db, "users"));
        return onSnapshot(q, (snapshot) => {
            const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(allUsers.filter((u: any) => u.id !== MASTER_ID));
        }, (error) => console.error("Firebase Hatası:", error));
    }, []);

    useEffect(() => {
        const q = query(collection(db, "branches"));
        return onSnapshot(q, (snapshot) => {
            setBranches(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => console.error("Firebase Hatası:", error));
    }, []);

    useEffect(() => {
        const q = query(collection(db, "students"));
        return onSnapshot(q, (snapshot) => {
            const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudents(all.filter((s: any) =>
                s.status !== 'passive' &&
                !s.graduatedBy &&
                !(typeof s.groupCode === 'string' && s.groupCode.startsWith('Mezun'))
            ));
        }, (error) => console.error("Firebase Hatası:", error));
    }, []);

    const handleStudentToggle = async (student: any) => {
        if (!student.authUid) return;
        const action = student.accountStatus === "disabled" ? "enable" : "disable";
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch("/api/student/set-account-status", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ studentDocId: student.id, action }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        } catch (err) { console.error(err); }
    };

    const handleStudentEditClick = (student: any) => {
        setEditingStudent(student);
        setIsStudentFormOpen(true);
    };

    const handleResendActivation = async (student: any) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch("/api/resend-activation", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ studentDocId: student.id }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        } catch (err) { console.error(err); throw err; }
    };

  const handleEditClick = (user: UserData) => {
    setEditingUser(user);
    setSelectedRoles(user.roles || []);
    setPermissionOverrides(user.permissionOverrides || {});
    setSelectedBranches((user as any).branches || []);
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
        setPermissionOverrides(prev => ({ ...prev, [permId]: checked }));
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
            avatarId: Number(avatarId),
            roles: selectedRoles,
            permissionOverrides: permissionOverrides,
            branches: selectedBranches,
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
            await setDoc(doc(db, "users", userCredential.user.uid), { ...finalUserData, uid: userCredential.user.uid, isActivated: false, createdAt: serverTimestamp() });
            await deleteApp(secondaryApp);

            // Hoş geldiniz maili — geçici şifre sadece mail ile iletilir, DB'ye yazılmaz
            auth.currentUser?.getIdToken().then(token =>
              fetch("/api/welcome", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ email: data.email, name: data.name, tempPass }),
              })
            ).catch((err) => console.error("[UserManagement] Mail gönderilemedi:", err));
        }

        setIsSuccess(true);
        setTimeout(() => { setIsUserFormOpen(false); setEditingUser(null); setErrors({}); setPermissionOverrides({}); setSelectedRoles([]); setSelectedBranches([]); setIsSuccess(false); }, 1000);
    } catch (err: any) { console.error("Hata:", err); setErrors({ firebaseError: true }); } finally { setLoading(false); }
};

    const roleDropdownRef = useRef<HTMLDivElement>(null);

    const staffUsers = users.filter((u: any) => !u.roles?.includes('student'));

    return (
        <div className="max-w-[1920px] mx-auto px-8 mt-[48px] animate-in fade-in duration-700">
            <div className="flex items-center justify-between pb-8 border-b border-neutral-100">
                <div>
                    <h2 className="text-[24px] font-bold text-[#10294C]">Kullanıcı Yönetimi</h2>
                    <p className="text-neutral-400 text-[14px] mt-1 font-medium italic">Sistem erişimlerini ve yetki matrisini yönetin.</p>
                </div>
                {activeTab === 'users' && (
                    <button onClick={() => { setEditingUser(null); setSelectedRoles([]); setPermissionOverrides({}); setSelectedBranches([]); setErrors({}); setAvatarId(Math.floor(Math.random() * 70) + 1); setFormKey(k => k + 1); setIsUserFormOpen(true); }} className="bg-[#FF8D28] text-white px-8 h-[46px] rounded-[12px] font-bold text-[14px] flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer">
                        <UserPlus size={18} /><span>Kullanıcı Oluştur</span>
                    </button>
                )}
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 mt-6 bg-neutral-100 p-1 rounded-2xl w-fit">
                <button
                    onClick={() => { setActiveTab('users'); sessionStorage.setItem("usermgmt_active_tab", 'users'); }}
                    className={`flex items-center gap-2 px-5 h-10 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${activeTab === 'users' ? 'bg-white text-[#10294C] shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                    <Users size={15} />
                    <span>Kullanıcılar</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${activeTab === 'users' ? 'bg-[#10294C]/10 text-[#10294C]' : 'bg-neutral-200 text-neutral-400'}`}>
                        {staffUsers.length}
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab('students'); sessionStorage.setItem("usermgmt_active_tab", 'students'); }}
                    className={`flex items-center gap-2 px-5 h-10 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${activeTab === 'students' ? 'bg-white text-[#10294C] shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                    <GraduationCap size={15} />
                    <span>Öğrenciler</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${activeTab === 'students' ? 'bg-[#10294C]/10 text-[#10294C]' : 'bg-neutral-200 text-neutral-400'}`}>
                        {students.length}
                    </span>
                </button>
            </div>

            {activeTab === 'users' ? (
                <UserTable users={staffUsers} branches={branches} onEdit={handleEditClick} onDelete={(id: string) => setModalConfig({ isOpen: true, type: "delete", userId: id, isStudent: false })} />
            ) : (
                <StudentUserTable
                    onResend={handleResendActivation}
                    students={students.map(s => {
                        if (!s.authUid) return s;
                        if (s.accountStatus) return s; // zaten set edilmişse dokunma
                        const userDoc = users.find((u: any) => u.id === s.authUid);
                        if (!userDoc) return s;
                        return { ...s, accountStatus: userDoc.isActivated ? "active" : "pending" };
                    })}
                    onEdit={handleStudentEditClick}
                    onToggle={handleStudentToggle}
                    onDelete={(id: string) => setModalConfig({ isOpen: true, type: "delete", userId: id, isStudent: true })}
                />
            )}

            <UserForm
                key={editingUser ? editingUser.id : `new-user-form-${formKey}`}
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
                availableBranches={branches}
                selectedBranches={selectedBranches}
                setSelectedBranches={setSelectedBranches}
            />

            <GlobalConfirmationModal
                isOpen={modalConfig.isOpen} type={modalConfig.type}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={async () => {
                    setLoading(true);
                    try {
                        if (modalConfig.isStudent) {
                            // authUid'yi al — Firebase Auth + users doc temizliği için
                            const studentSnap = await import("firebase/firestore").then(m =>
                              m.getDoc(doc(db, "students", modalConfig.userId))
                            );
                            const authUid = studentSnap.data()?.authUid as string | undefined;
                            await deleteDoc(doc(db, "students", modalConfig.userId));
                            if (authUid) {
                              const delToken = await auth.currentUser?.getIdToken();
                              await fetch("/api/delete-user", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${delToken ?? ""}` },
                                body: JSON.stringify({ uid: authUid }),
                              }).catch(() => {}); // Auth kaydı yoksa sessizce geç
                              await deleteDoc(doc(db, "users", authUid)).catch(() => {});
                            }
                            setStudents(prev => prev.filter(s => s.id !== modalConfig.userId));
                        } else {
                            const delToken = await auth.currentUser?.getIdToken();
                            await fetch('/api/delete-user', { method: 'POST', body: JSON.stringify({ uid: modalConfig.userId }), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${delToken ?? ""}` } });
                            await deleteDoc(doc(db, "users", modalConfig.userId));
                            setUsers(prev => prev.filter(u => u.id !== modalConfig.userId));
                        }
                        setModalConfig({ isOpen: false, type: null, userId: "", isStudent: false });
                    } catch (err) { console.error(err); } finally { setLoading(false); }
                }}
            />

            <StudentQuickEditModal
                isOpen={isStudentFormOpen}
                student={editingStudent}
                onClose={() => { setIsStudentFormOpen(false); setEditingStudent(null); }}
                onSaved={() => { setIsStudentFormOpen(false); setEditingStudent(null); }}
            />
        </div>
    );
}