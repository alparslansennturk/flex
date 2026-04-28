import { useState, useEffect, useRef } from "react";
import { db, auth } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { MASTER_ID } from "@/app/lib/constants";
import { getFlexMessage } from "@/app/lib/messages";
import { calcScore, computeStudentStats } from "@/app/lib/scoring";
import {
  collection, onSnapshot, addDoc, doc,
  updateDoc, deleteDoc, increment, serverTimestamp, writeBatch,
  getDocs, query, where, deleteField,
} from "firebase/firestore";

// --- INTERFACES ---
interface Group {
  id: string;
  code: string;
  branch: string;
  instructor: string;
  instructorId?: string;
  session: string;
  students: number;
  status: string;
  createdAt?: any;
  module?: "GRAFIK_1" | "GRAFIK_2";
}

interface Student {
  id: string;
  name: string;
  lastName: string;
  email: string;
  gender?: string; // İŞTE BURAYA EKLEDİK
  note: string;
  groupId: string;
  branch: string;
  groupCode: string;
  points: number;
  status?: 'active' | 'passive';
  lastGroupCode?: string;
  lastGroupId?: string;
  hiddenFromInstructors?: string[];
  updatedAt?: any;
}
export const useManagement = (setHeaderTitle: (t: string) => void) => {
  // --- TEMEL TANIMLAR ---
  const { user, hasPermission } = useUser();
  const currentUser = auth.currentUser;
  const isAdmin = user?.roles?.includes('admin') || hasPermission('CLASS_MANAGE') || false;

  const isAdminRef = useRef(isAdmin);
  const userRef = useRef(user);
  isAdminRef.current = isAdmin;
  userRef.current = user;
  const [avatarId, setAvatarId] = useState<number | null>(null);

  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [groupBranch, setGroupBranch] = useState("Kadıköy");
  const [tempStudentBranch, setTempStudentBranch] = useState(""); 

  const [activeSubTab, setActiveSubTab] = useState("groups");
  const [currentView, setCurrentView] = useState("Aktif Sınıflar");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, studentId: "", deleteType: 'active' as 'active' | 'graduated' | 'graduate' });
  const [studentPanel, setStudentPanel] = useState<'active' | 'passive'>('active');
  const [activePage, setActivePage] = useState(1);
  const [passivePage, setPassivePage] = useState(1);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState("");
  const [groupModule, setGroupModule] = useState<"GRAFIK_1" | "GRAFIK_2" | "">("");
  const [moduleBlockModal, setModuleBlockModal] = useState<{ isOpen: boolean; currentModule: string } | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState("Grup seansı seçiniz...");
  const [customSchedule, setCustomSchedule] = useState("");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; schedule?: string; instructor?: string; duplicate?: string; name?: boolean; surname?: boolean; groupId?: boolean; }>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [studentBranch, setStudentBranch] = useState("");
  const [studentGender, setStudentGender] = useState("");
  const [studentError, setStudentError] = useState("");
  const [viewMode, setViewMode] = useState<'group-list' | 'all-groups' | 'all-branches'>('group-list');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [selectedGroupIdForStudent, setSelectedGroupIdForStudent] = useState<string>("");


  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'archive' | 'delete' | 'restore' | 'student-delete' | 'bulk-delete' | null;
    groupId: string | null;
    groupIds?: string[];
    studentId?: string | null;
  }>({
    isOpen: false,
    type: null,
    groupId: null,
    studentId: null
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const pendingSelectIdRef = useRef<string | null>(null);

  const schedules = [
    "Pts - Çar | 19.00 - 21.30", "Sal - Per | 19.00 - 21.30", "Cts - Paz | 09.00 - 12.00",
    "Cts - Paz | 12.00 - 15.00", "Cts - Paz | 15.00 - 18.00", "Özel Grup Tanımla",
  ];

  const filteredGroups = groups
    .filter(g => currentView === "Arşiv" ? g.status === "archived" : g.status === "active")
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const ITEMS_PER_PAGE = 20;

  /// 2. FİLTRELEME MOTORU
  const filteredStudents = students.filter((s) => {
    // Panel filtresi
    if (studentPanel === 'active' && s.status === 'passive') return false;
    if (studentPanel === 'passive') {
      if (s.status !== 'passive') return false;
      // Eğitmen: sadece kendi gruplarından mezun öğrenciler, gizlenenleri hariç
      if (!isAdminRef.current) {
        const uid = auth.currentUser?.uid;
        const myGroupIds = groups.filter(g => g.instructorId === uid).map(g => g.id);
        if (!myGroupIds.includes(s.groupId)) return false;
        if (uid && s.hiddenFromInstructors?.includes(uid)) return false;
      }
    }
    // Arama (aktif panelde)
    if (studentPanel === 'active') {
      const searchMatch = (s.name + " " + (s.lastName || "")).toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!searchMatch) return false;
    }
    // Görünüm modu filtresi
    if (viewMode === 'group-list') return s.groupId === selectedGroupId;
    if (viewMode === 'all-groups') {
      return groups.some(g => g.id === s.groupId && (g.instructorId === auth.currentUser?.uid || g.instructor?.toLowerCase().includes("alparslan")));
    }
    if (viewMode === 'all-branches') {
      if (!studentBranch || studentBranch === "Tümü") return true;
      return s.branch === studentBranch;
    }
    return true;
  });

  const currentPage = studentPanel === 'active' ? activePage : passivePage;
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const pagedStudents = viewMode === 'group-list'
    ? filteredStudents
    : filteredStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const filteredArchiveGroups = isAdminRef.current
    ? filteredGroups
    : filteredGroups.filter(g => g.instructorId === auth.currentUser?.uid);

  const now = Date.now() / 1000;
  const myGroupCards = groups
    .filter(g => g.instructorId === currentUser?.uid && g.status === 'active')
    .sort((a, b) => (b.createdAt?.seconds ?? now) - (a.createdAt?.seconds ?? now));

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
      const gList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Group[];
      setGroups(gList);
    }, () => {});
    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const sList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
      setStudents(sList);
    }, () => {});
    return () => { unsubGroups(); unsubStudents(); };
  }, []);

  useEffect(() => {
    // Eğitmen users koleksiyonunu okuyamaz (Firestore kuralı: sadece admin veya kendi dokümanı)
    if (!isAdmin) {
      if (user) {
        setInstructors([{
          ...user,
          id: user.uid,
          displayName: user.name ? `${user.name} ${(user as any).surname || ""}` : ((user as any).email || user.uid)
        }]);
      }
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // ── DEBUG: Bozuk kayıtları logla ──────────────────────────────────────
      const broken = allDocs.filter(u =>
        !u ||
        typeof u.email !== 'string' ||
        !Array.isArray(u.roles) ||
        u.roles.length === 0 ||
        u.roles.some((r: unknown) => typeof r !== 'string')
      );
      if (broken.length > 0) {
        console.warn('[DEBUG] Bozuk user kayıtları:', broken.map(u => ({ id: u.id, email: u.email, role: u.role, roles: u.roles })));
      }

      // ── SAFE FILTER: Bozuk kayıtları ele ─────────────────────────────────
      const safeUsers = allDocs.filter(u =>
        u &&
        typeof u.email === 'string' &&
        Array.isArray(u.roles) &&
        u.roles.length > 0
      );
      // ─────────────────────────────────────────────────────────────────────

      const insList = safeUsers
        .filter(u =>
          (u.role === "instructor" ||
          u.roles?.includes("instructor") ||
          u.isInstructor === true) &&
          u.id !== MASTER_ID
        )
        .map(u => ({
          ...u,
          displayName: u.name ? `${u.name} ${u.surname || ""}` : (u.email || u.uid)
        }));

      setInstructors(insList);
    }, () => {});
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (isFormOpen || isStudentFormOpen) return;
    const targetList = currentView === "Aktif Sınıflar" ? myGroupCards : filteredGroups;
    if (!targetList || targetList.length === 0) return;

    if (pendingSelectIdRef.current) {
      const isInList = targetList.some(g => g.id === pendingSelectIdRef.current);
      if (isInList) {
        setSelectedGroupId(pendingSelectIdRef.current);
        setLastSelectedId(pendingSelectIdRef.current);
        pendingSelectIdRef.current = null;
      }
      return;
    }

    const isStillInList = targetList.some(g => g.id === selectedGroupId);
    if (!selectedGroupId || !isStillInList) {
      setSelectedGroupId(targetList[0].id);
      setLastSelectedId(targetList[0].id);
    }
  }, [currentView, myGroupCards, filteredGroups, isFormOpen, isStudentFormOpen]);

  useEffect(() => {
    if (selectedGroupId) {
      const currentGroup = groups.find(g => g.id === selectedGroupId);
      if (currentGroup) {
        if (viewMode !== 'all-branches') {
          setStudentBranch(currentGroup.branch);
        }
        setSelectedGroupIdForStudent(selectedGroupId);
      }
    }
  }, [selectedGroupId, groups, viewMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  useEffect(() => {
    const labels: Record<string, string> = {
      groups: "Sınıf Yönetimi",
      profile: "Profil Ayarları",
      users: "Kullanıcı Yönetimi"
    };
    setHeaderTitle(labels[activeSubTab] || "Sınıf Yönetimi");
  }, [activeSubTab, setHeaderTitle]);

  useEffect(() => {
    setActivePage(1);
    setPassivePage(1);
  }, [searchQuery, viewMode, selectedGroupId, studentPanel]);

  const showNotification = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const handleOpenForm = () => {
    if (currentView !== "Aktif Sınıflar" || isFormOpen || editingGroupId) return;
    setSelectedGroupId(null);
    setLastSelectedId(null);
    if (!isAdmin && user) {
      setSelectedInstructorId(user.uid);
    } else {
      setSelectedInstructorId("");
    }
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingGroupId(null);
    setGroupCode("");
    setGroupModule("");
    setSelectedInstructorId("");
    setSelectedSchedule("Grup seansı seçiniz...");
    setCustomSchedule("");
    setErrors({});
    if (lastSelectedId) setSelectedGroupId(lastSelectedId);
  };

  const handleSave = async () => {
    const newErrors: { code?: string; schedule?: string; instructor?: string } = {};
    if (!groupCode.trim()) newErrors.code = "Grup kodu zorunludur.";
    if (selectedSchedule === "Grup seansı seçiniz...") newErrors.schedule = "Seans seçimi zorunludur.";
    if (isAdmin && !selectedInstructorId) newErrors.instructor = "Eğitmen seçimi zorunludur.";
    if (selectedSchedule === "Özel Grup Tanımla" && !customSchedule.trim()) {
      newErrors.schedule = "Özel seans detayı zorunludur.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const formattedCode = groupCode.trim().toLowerCase().startsWith("grup") ? groupCode.trim() : `Grup ${groupCode.trim()}`;

    const isDuplicate = groups.some(g =>
      g.code?.toLowerCase() === formattedCode.toLowerCase() &&
      g.branch === groupBranch &&
      g.status === 'active' &&
      g.id !== editingGroupId
    );
    if (isDuplicate) {
      setErrors({ duplicate: `"${formattedCode}" ${getFlexMessage('group/duplicate-code').text}` });
      return;
    }

    const finalSession = selectedSchedule === "Özel Grup Tanımla" ? customSchedule : selectedSchedule;

    const instructorObj = instructors.find(i => i.id === selectedInstructorId);
    const instructorName = instructorObj ? (instructorObj.displayName || "İsimsiz") : "Atanmadı";

    try {
      if (editingGroupId) {
        // Modül değişiyorsa, mevcut modül sertifikasyon'da bitirilmiş mi kontrol et
        const editingGroup = groups.find(g => g.id === editingGroupId);
        const currentModule = editingGroup?.module;
        if (currentModule && groupModule !== currentModule) {
          const gradesSnap = await getDocs(query(
            collection(db, "projectGrades"),
            where("groupId", "==", editingGroupId),
          ));
          const isFinalized = gradesSnap.docs.some(d => {
            const data = d.data() as any;
            return data.module === currentModule && data.isFinalized === true;
          });
          if (!isFinalized) {
            setModuleBlockModal({ isOpen: true, currentModule });
            return;
          }
        }

        await updateDoc(doc(db, "groups", editingGroupId), {
          code: formattedCode,
          session: finalSession,
          branch: groupBranch,
          instructorId: selectedInstructorId,
          instructor: instructorName,
          module: groupModule || null,
        });

        // Grup kodu değiştiyse VEYA modül GRAFIK_1→GRAFIK_2 geçişi varsa öğrencileri güncelle
        const oldCode   = editingGroup?.code;
        const oldModule = editingGroup?.module;
        const isModuleUpgrade = oldModule === "GRAFIK_1" && groupModule === "GRAFIK_2";
        const isCodeChange    = oldCode && oldCode !== formattedCode;

        if (isCodeChange || isModuleUpgrade) {
          const studentsSnap = await getDocs(query(
            collection(db, "students"),
            where("groupId", "==", editingGroupId),
          ));
          if (!studentsSnap.empty) {
            const batch = writeBatch(db);
            studentsSnap.docs.forEach(d => {
              const sData = d.data() as any;
              const updates: Record<string, unknown> = {};

              if (isCodeChange) updates.groupCode = formattedCode;

              // G1→G2 geçişi: carry-over henüz uygulanmamışsa hesapla
              if (isModuleUpgrade && !sData.isCarryOverApplied) {
                const allGradedTasks = sData.gradedTasks ?? {};
                const classGradedTasks = Object.fromEntries(
                  Object.entries(allGradedTasks).filter(([, e]: any) =>
                    e?.classId === (oldCode || editingGroup?.code)
                  )
                ) as Record<string, any>;
                const { totalXP: xp, completedTasks: tasks } = computeStudentStats(classGradedTasks);
                updates.g2StartXP          = Math.round(calcScore(xp, tasks) * 0.10);
                updates.isCarryOverApplied = true;
                updates.grafik1Code        = oldCode || editingGroup?.code || "";
              }

              if (Object.keys(updates).length > 0) batch.update(d.ref, updates);
            });
            await batch.commit();
          }
        }

        showNotification("Grup başarıyla güncellendi.");
      } else {
        const docRef = await addDoc(collection(db, "groups"), {
          code: formattedCode,
          branch: groupBranch,
          instructor: instructorName,
          instructorId: selectedInstructorId,
          session: finalSession,
          students: 0,
          status: "active",
          module: groupModule || null,
          createdAt: serverTimestamp()
        });
        pendingSelectIdRef.current = docRef.id;
        showNotification("Yeni grup başarıyla oluşturuldu.");
      }
      setIsFormOpen(false);
      setEditingGroupId(null);
      setGroupCode("");
      setGroupModule("");
      setSelectedInstructorId("");
      setSelectedSchedule("Grup seansı seçiniz...");
      setCustomSchedule("");
      setErrors({});
    } catch (error) {
      showNotification("Grup kaydedilirken bir hata oluştu.");
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroupId(group.id);
    setGroupCode(group.code.replace("Grup ", ""));
    setGroupBranch(group.branch);
    setGroupModule(group.module ?? "");
    setSelectedInstructorId(group.instructorId || "");
    if (schedules.includes(group.session)) {
      setSelectedSchedule(group.session);
      setCustomSchedule("");
    } else {
      setSelectedSchedule("Özel Grup Tanımla");
      setCustomSchedule(group.session);
    }
    setLastSelectedId(selectedGroupId);
    setSelectedGroupId(null);
    setIsFormOpen(true);
    setOpenMenuId(null);
  };

  const requestModal = (id: string, type: 'archive' | 'delete' | 'restore') => {
    setModalConfig({ isOpen: true, type, groupId: id });
    setOpenMenuId(null);
  };

  const requestBulkDeleteArchive = (ids: string[]) => {
    setModalConfig({ isOpen: true, type: 'bulk-delete', groupId: null, groupIds: ids });
  };

  const confirmModalAction = async () => {
    if (!modalConfig.type) return;

    // Toplu arşiv silme
    if (modalConfig.type === 'bulk-delete' && modalConfig.groupIds?.length) {
      setIsProcessing(true);
      try {
        const batch = writeBatch(db);
        for (const gid of modalConfig.groupIds) {
          // Öğrencilere dokunma — arşive alınırken zaten mezun listesine geçtiler
          batch.delete(doc(db, "groups", gid));
        }
        await batch.commit();
        if (modalConfig.groupIds.includes(selectedGroupId ?? '')) setSelectedGroupId(null);
        showNotification(`${modalConfig.groupIds.length} grup silindi.`);
      } catch { showNotification("Hata oluştu."); }
      finally { setIsProcessing(false); setModalConfig({ isOpen: false, type: null, groupId: null }); }
      return;
    }

    if (!modalConfig.groupId) return;
    setIsProcessing(true);
    try {
      const groupRef = doc(db, "groups", modalConfig.groupId);
      const targetGroup = groups.find(g => g.id === modalConfig.groupId);
      const affectedStudents = students.filter(s => s.groupId === modalConfig.groupId);
      const batch = writeBatch(db);

      if (modalConfig.type === 'delete') {
        affectedStudents.forEach(student => {
          batch.update(doc(db, "students", student.id), {
            status: 'passive',
            lastGroupCode: targetGroup?.code || "",
            groupCode: `Mezun (${targetGroup?.code || "Bilinmiyor"})`,
            groupId: "unassigned",
            updatedAt: new Date()
          });
        });
        batch.delete(groupRef);
        await batch.commit();
        if (selectedGroupId === modalConfig.groupId) setSelectedGroupId(null);
        showNotification("Grup silindi.");
      } else if (modalConfig.type === 'archive') {
        const groupCode = targetGroup?.code || "";
        affectedStudents.forEach(student => {
          // Carry-over: öğrencinin bu sınıftaki puanının %30'u sonraki dönem başlangıç puanı olur
          const allGradedTasks = (student as any).gradedTasks ?? {};
          const classGradedTasks = Object.fromEntries(
            Object.entries(allGradedTasks).filter(([, e]: any) =>
              groupCode ? e?.classId === groupCode : true
            )
          ) as Record<string, any>;
          const { totalXP: xp, completedTasks: tasks } = computeStudentStats(classGradedTasks);
          const carryOverScore = Math.round(calcScore(xp, tasks) * 0.10);

          batch.update(doc(db, "students", student.id), {
            status: 'passive',
            lastGroupId: modalConfig.groupId,
            lastGroupCode: groupCode,
            groupCode: `Mezun (${groupCode || "Bilinmiyor"})`,
            groupId: "unassigned",
            g2StartXP: carryOverScore,
            isCarryOverApplied: true,
            updatedAt: new Date(),
          });
        });
        batch.update(groupRef, { status: 'archived' });
        await batch.commit();
        if (selectedGroupId === modalConfig.groupId) setSelectedGroupId(null);
        showNotification("Grup bitirildi, öğrenciler mezun listesine alındı.");
      } else if (modalConfig.type === 'restore') {
        // lastGroupId ile mezun listesindeki öğrencileri bul
        const studentsToRestore = students.filter(s => s.lastGroupId === modalConfig.groupId);
        batch.update(groupRef, { status: 'active' });
        studentsToRestore.forEach(student => {
          batch.update(doc(db, "students", student.id), {
            status: 'active',
            groupId: modalConfig.groupId,
            groupCode: targetGroup?.code || student.lastGroupCode || "",
            lastGroupId: deleteField(),
            updatedAt: new Date(),
          });
        });
        await batch.commit();
        showNotification("Grup ve öğrencileri geri yüklendi.");
      }
    } catch (error) { showNotification("Hata oluştu."); }
    setIsProcessing(false);
    setModalConfig({ isOpen: false, type: null, groupId: null });
  };

const handleAddStudent=async(passedData?:any)=>{
const name=passedData?.name||studentName;
const lastName=passedData?.lastName||studentLastName;
const email=passedData?.email||studentEmail;
const note=passedData?.note||studentNote;
const groupId=passedData?.groupId||selectedGroupIdForStudent;
const branch=passedData?.branch||studentBranch;
const gender=passedData?.gender||studentGender||"";
const avatarIdValue = passedData?.avatarId !== undefined ? passedData.avatarId : (avatarId || null);
if(!name?.trim()||!lastName?.trim()||!groupId){
return;
}
const targetGroup=groups.find((g)=>g.id===groupId);
const studentData:any={
name:name.trim(),
lastName:lastName.trim(),
email:email.trim(),
note:note.trim(),
groupId:groupId,
groupCode:targetGroup?.code||"Tanımsız",
branch:branch,
gender:gender,
avatarId: avatarIdValue,
status:'active',
updatedAt:new Date(),
};
try{
if(editingStudentId){
const oldStudent=students.find((s)=>s.id===editingStudentId);
const isGroupChange = oldStudent && oldStudent.groupId !== groupId;
if(isGroupChange){
if(oldStudent.groupId&&oldStudent.groupId!=="unassigned"){
await updateDoc(doc(db,"groups",oldStudent.groupId),{students:increment(-1)});
}
await updateDoc(doc(db,"groups",groupId),{students:increment(1)});
// gradedTasks silinmez — geçmiş veriler korunur; lig zaten classId'ye göre filtreler
const oldGroup = groups.find((g) => g.id === oldStudent.groupId);
if (oldGroup?.module === "GRAFIK_1") {
  studentData.grafik1Code = oldGroup.code;
} else if (oldGroup?.module === "GRAFIK_2") {
  studentData.grafik2Code = oldGroup.code;
}
// G1 → G2 geçişi: carry-over henüz uygulanmamışsa hesapla
// (archive üzerinden geçilmişse isCarryOverApplied=true — double-application engellenir)
const isCarryOverApplied = (oldStudent as any).isCarryOverApplied === true;
if (!isCarryOverApplied && oldGroup?.module === "GRAFIK_1" && targetGroup?.module === "GRAFIK_2") {
  const allGradedTasks = (oldStudent as any).gradedTasks ?? {};
  const classGradedTasks = Object.fromEntries(
    Object.entries(allGradedTasks).filter(([, e]: any) => e?.classId === oldGroup.code)
  ) as Record<string, any>;
  const { totalXP: xp, completedTasks: tasks } = computeStudentStats(classGradedTasks);
  studentData.g2StartXP = Math.round(calcScore(xp, tasks) * 0.10);
  studentData.isCarryOverApplied = true;
}
studentData.rankChange = 0;
studentData.isScoreHidden = false;
}
await updateDoc(doc(db,"students",editingStudentId),studentData);
setStudents((prev)=>prev.map((s)=>(s.id===editingStudentId?{...s,...studentData}:s)));
}else{
const newStudentRef = await addDoc(collection(db,"students"),{...studentData,points:0,createdAt:new Date(),});
await updateDoc(doc(db,"groups",groupId),{students:increment(1)});
if(email?.trim()){
  fetch("/api/welcome",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),name:`${name.trim()} ${lastName.trim()}`,groupCode:studentData.groupCode??"",groupId,studentDocId:newStudentRef.id})}).catch((e)=>console.error("[welcome mail]",e));
}
}
}catch(error){
console.error("HATA:",error);
throw error;
}
};
  const handleGraduateStudent = async (studentId: string) => {
    try {
      await updateDoc(doc(db, "students", studentId), { status: 'passive', graduatedAt: new Date(), updatedAt: new Date() });
      showNotification("Öğrenci mezun edildi.");
    } catch { showNotification("Hata oluştu."); }
  };

  const handleBulkGraduateStudents = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.update(doc(db, "students", id), { status: 'passive', graduatedAt: new Date(), updatedAt: new Date() }));
      await batch.commit();
      setSelectedStudentIds([]);
      showNotification(`${ids.length} öğrenci mezun edildi.`);
    } catch { showNotification("Hata oluştu."); }
  };

  const handleRestoreStudent = async (studentId: string) => {
    try {
      await updateDoc(doc(db, "students", studentId), { status: 'active', updatedAt: new Date() });
      showNotification("Öğrenci aktif listeye alındı.");
    } catch { showNotification("Hata oluştu."); }
  };

  const handleDeleteGraduatedStudent = async (studentId: string) => {
    if (isAdminRef.current) {
      const student = students.find(s => s.id === studentId);
      try {
        await deleteDoc(doc(db, "students", studentId));
        if (student?.groupId && student.groupId !== 'unassigned') {
          await updateDoc(doc(db, "groups", student.groupId), { students: increment(-1) });
        }
        showNotification("Öğrenci silindi.");
      } catch { showNotification("Hata oluştu."); }
    } else {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const student = students.find(s => s.id === studentId);
      const hidden: string[] = student?.hiddenFromInstructors || [];
      if (!hidden.includes(uid)) {
        try {
          await updateDoc(doc(db, "students", studentId), { hiddenFromInstructors: [...hidden, uid] });
          showNotification("Öğrenci listenizden kaldırıldı.");
        } catch { showNotification("Hata oluştu."); }
      }
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    try {
      await deleteDoc(doc(db, "students", studentId));
      if (student.groupId) await updateDoc(doc(db, "groups", student.groupId), { students: increment(-1) });
      showNotification("Öğrenci silindi.");
    } catch (error) { showNotification("Hata oluştu."); }
  };

  const handleBulkDeleteStudents = async () => {
    try {
      const promises = selectedStudentIds.map(async (id) => {
        const s = students.find(x => x.id === id);
        await deleteDoc(doc(db, "students", id));
        if (s?.groupId) await updateDoc(doc(db, "groups", s.groupId), { students: increment(-1) });
      });
      await Promise.all(promises);
      setSelectedStudentIds([]);
      showNotification("Seçili öğrenciler silindi.");
    } catch (error) { showNotification("Toplu silme hatası."); }
  };

  const resetStudentForm = () => {
    setEditingStudentId(null);
    setStudentName("");
    setStudentLastName("");
    setStudentEmail("");
    setStudentNote("");
    setStudentError("");
    setErrors({});
  };

  const handleEditStudent = (student: any) => {
    setEditingStudentId(student.id);
    setSelectedGroupIdForStudent(student.groupId);
    setStudentName(student.name);
    setStudentLastName(student.lastName || "");
    setStudentEmail(student.email || "");
    setStudentGender(student.gender || "");
    setStudentNote(student.note || "");
    setTempStudentBranch(student.branch || "");
    setTempStudentBranch(student.branch || "");
    //setStudentBranch(student.branch || "");
    setIsStudentFormOpen(true);
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) setSelectedStudentIds([]);
    else setSelectedStudentIds(filteredStudents.map(s => s.id));
  };

  return {
    isAdmin, activeSubTab, setActiveSubTab, currentView, setCurrentView,
    isFormOpen, setIsFormOpen, students, groups,
    selectedGroupId, setSelectedGroupId, openMenuId, setOpenMenuId,
    editingGroupId, setEditingGroupId, groupCode, setGroupCode, groupBranch, setGroupBranch,
    groupModule, setGroupModule, moduleBlockModal, setModuleBlockModal,
    instructors, selectedInstructorId, setSelectedInstructorId,
    selectedSchedule, setSelectedSchedule, customSchedule, setCustomSchedule,
    isScheduleOpen, setIsScheduleOpen, errors, setErrors,
    searchQuery, setSearchQuery, isStudentFormOpen, setIsStudentFormOpen,
    studentName, setStudentName, studentLastName, setStudentLastName,
    studentEmail, setStudentEmail, studentNote, setStudentNote,
    studentBranch, setStudentBranch, studentError, setStudentError,
    tempStudentBranch, setTempStudentBranch, 
    viewMode, setViewMode, toast, setToast, selectedGroupIdForStudent, setSelectedGroupIdForStudent,
    modalConfig, setModalConfig, isProcessing, scheduleRef, menuRef, schedules,
    handleOpenForm, handleCancel, handleSave, handleEdit, requestModal, requestBulkDeleteArchive, confirmModalAction,
    handleAddStudent, handleDeleteStudent, handleBulkDeleteStudents, handleEditStudent, resetStudentForm,
    handleGraduateStudent, handleBulkGraduateStudents, handleRestoreStudent, handleDeleteGraduatedStudent,
    filteredGroups, filteredArchiveGroups, filteredStudents, pagedStudents, myGroupCards,
    totalPages, activePage, setActivePage, passivePage, setPassivePage,
    studentPanel, setStudentPanel,
    selectedStudentIds, setSelectedStudentIds,
    toggleStudentSelection, handleSelectAll, deleteModal, setDeleteModal, studentGender, setStudentGender,
    editingStudent: students.find(s => s.id === editingStudentId) || null,
    editingStudentId, setEditingStudentId, avatarId, setAvatarId, formRef
};
};