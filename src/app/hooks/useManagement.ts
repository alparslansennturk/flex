import { useState, useEffect, useRef } from "react";
import { db, auth } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { MASTER_ID } from "@/app/lib/constants";
import {
  collection, onSnapshot, addDoc, doc,
  updateDoc, deleteDoc, increment, serverTimestamp, writeBatch
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
  updatedAt?: any;
}
export const useManagement = (setHeaderTitle: (t: string) => void) => {
  // --- TEMEL TANIMLAR ---
  const { user } = useUser();
  const currentUser = auth.currentUser;
  const isAdmin = user?.roles?.includes('admin') || false;

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
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, studentId: "" });
  const [showPassive, setShowPassive] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("Grup seansı seçiniz...");
  const [customSchedule, setCustomSchedule] = useState("");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; schedule?: string; name?: boolean; surname?: boolean; groupId?: boolean; }>({});

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
    type: 'archive' | 'delete' | 'restore' | 'student-delete' | null;
    groupId: string | null;
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

  const schedules = [
    "Pts - Çar | 19.00 - 21.30", "Sal - Per | 19.00 - 21.30", "Cts - Paz | 09.00 - 12.00",
    "Cts - Paz | 12.00 - 15.00", "Cts - Paz | 15.00 - 18.00", "Özel Grup Tanımla",
  ];

  const filteredGroups = groups
    .filter(g => currentView === "Arşiv" ? g.status === "archived" : g.status === "active")
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  /// 2. KESİN FİLTRELEME MOTORU
  const filteredStudents = students.filter((s) => {
  const searchMatch = (s.name + " " + (s.lastName || "")).toLowerCase().includes(searchQuery.toLowerCase().trim());
  const statusMatch = showPassive ? s.status === 'passive' : s.status !== 'passive';
  if (!searchMatch || !statusMatch) return false;
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

  const myGroupCards = groups.filter(g => {
    const isMine = g.instructorId === currentUser?.uid;
    const isActiveOnly = g.status === 'active';
    return isMine && isActiveOnly;
  });

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

      let insList = safeUsers
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

      if (!isAdminRef.current && userRef.current) {
        insList = insList.filter(u => u.id === userRef.current!.uid);
      }
      setInstructors(insList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isFormOpen || isStudentFormOpen) return;
    let targetList: Group[] = [];
    if (currentView === "Aktif Sınıflar") {
      targetList = myGroupCards;
    } else {
      targetList = filteredGroups;
    }
    if (!targetList || targetList.length === 0) {
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

  const showNotification = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const handleOpenForm = () => {
    if (currentView !== "Aktif Sınıflar") return;
    if (!isFormOpen) {
      setSelectedGroupId(null);
      setLastSelectedId(null);
      if (!isAdmin && user) {
        setSelectedInstructorId(user.uid);
      } else {
        setSelectedInstructorId("");
      }
      setIsFormOpen(true);
    } else {
      handleCancel();
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingGroupId(null);
    setGroupCode("");
    setSelectedInstructorId("");
    setSelectedSchedule("Grup seansı seçiniz...");
    setCustomSchedule("");
    setErrors({});
    if (lastSelectedId) setSelectedGroupId(lastSelectedId);
  };

  const handleSave = async () => {
    const newErrors: { code?: string; schedule?: string } = {};
    if (!groupCode.trim()) newErrors.code = "Grup kodu zorunludur.";
    if (selectedSchedule === "Grup seansı seçiniz...") newErrors.schedule = "Seans seçimi zorunludur.";
    if (selectedSchedule === "Özel Grup Tanımla" && !customSchedule.trim()) {
      newErrors.schedule = "Özel seans detayı zorunludur.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const formattedCode = groupCode.trim().toLowerCase().startsWith("grup") ? groupCode.trim() : `Grup ${groupCode.trim()}`;
    const finalSession = selectedSchedule === "Özel Grup Tanımla" ? customSchedule : selectedSchedule;

    const instructorObj = instructors.find(i => i.id === selectedInstructorId);
    const instructorName = instructorObj ? (instructorObj.displayName || "İsimsiz") : "Atanmadı";

    try {
      if (editingGroupId) {
        await updateDoc(doc(db, "groups", editingGroupId), {
          code: formattedCode,
          session: finalSession,
          branch: groupBranch,
          instructorId: selectedInstructorId,
          instructor: instructorName
        });
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
          createdAt: serverTimestamp()
        });
        setSelectedGroupId(docRef.id);
        setLastSelectedId(docRef.id);
        showNotification("Yeni grup başarıyla oluşturuldu.");
      }
      setIsFormOpen(false);
      setEditingGroupId(null);
      setGroupCode("");
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

  const confirmModalAction = async () => {
    if (!modalConfig.groupId || !modalConfig.type) return;
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
        affectedStudents.forEach(student => {
          batch.update(doc(db, "students", student.id), { status: 'passive', updatedAt: new Date() });
        });
        batch.update(groupRef, { status: 'archived' });
        await batch.commit();
        if (selectedGroupId === modalConfig.groupId) setSelectedGroupId(null);
        showNotification("Grup arşivlendi.");
      } else if (modalConfig.type === 'restore') {
        batch.update(groupRef, { status: 'active' });
        affectedStudents.forEach(student => {
          batch.update(doc(db, "students", student.id), { status: 'active', updatedAt: new Date() });
        });
        await batch.commit();
        showNotification("Grup geri yüklendi.");
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
if(oldStudent&&oldStudent.groupId!==groupId){
if(oldStudent.groupId&&oldStudent.groupId!=="unassigned"){
await updateDoc(doc(db,"groups",oldStudent.groupId),{students:increment(-1)});
}
await updateDoc(doc(db,"groups",groupId),{students:increment(1)});
}
await updateDoc(doc(db,"students",editingStudentId),studentData);
setStudents((prev)=>prev.map((s)=>(s.id===editingStudentId?{...s,...studentData}:s)));
}else{
const docRef=await addDoc(collection(db,"students"),{...studentData,points:0,createdAt:new Date(),});
await updateDoc(doc(db,"groups",groupId),{students:increment(1)});
setStudents(prev=>[{id:docRef.id,...studentData,points:0,createdAt:new Date()},...prev]);
}
}catch(error){
console.error("HATA:",error);
throw error;
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
    handleOpenForm, handleCancel, handleSave, handleEdit, requestModal, confirmModalAction,
    handleAddStudent, handleDeleteStudent, handleBulkDeleteStudents, handleEditStudent, resetStudentForm, 
    filteredGroups, filteredStudents, myGroupCards, showPassive, setShowPassive, selectedStudentIds, setSelectedStudentIds,
    toggleStudentSelection, handleSelectAll, deleteModal, setDeleteModal, studentGender, setStudentGender,editingStudent: students.find(s => s.id === editingStudentId) || null,
     editingStudentId, setEditingStudentId, avatarId, setAvatarId
};
};