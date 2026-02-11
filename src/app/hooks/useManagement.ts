import { useState, useEffect, useRef } from "react";
import { db } from "@/app/lib/firebase";
import {
  collection, onSnapshot, addDoc, query, where, doc,
  updateDoc, deleteDoc, increment, serverTimestamp
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
  const isAdmin = true;

  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [groupBranch, setGroupBranch] = useState("Kadıköy");

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
  const [errors, setErrors] = useState<{ code?: string; schedule?: string }>({});
  const [isShaking, setIsShaking] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [studentBranch, setStudentBranch] = useState("Kadıköy");
  const [studentError, setStudentError] = useState("");
  const [viewMode, setViewMode] = useState<'group-list' | 'all-groups' | 'all-branches'>('group-list');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [selectedGroupIdForStudent, setSelectedGroupIdForStudent] = useState<string>("");

  // --- SENİN PAYLAŞTIĞIN BLOĞUN HEMEN ALTINA GELECEK ---

  useEffect(() => {
    if (isAdmin) {
      console.log("Firebase sorgusu atılıyor: role == instructor");
      const q = query(collection(db, "users"), where("role", "==", "instructor"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("Firebase Yanıt Verdi. Gelen Kayıt Sayısı:", snapshot.size);
        const insList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            displayName: data.name ? `${data.name} ${data.surname || ""}` : (data.email || "İsimsiz")
          };
        });
        setInstructors(insList);
      }, (err) => console.error("Firebase Hatası:", err));
      
      return () => unsubscribe();
    }
  }, [isAdmin]);

  

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

  const filteredStudents = students.filter((student) => {
    if (viewMode === 'group-list') return student.status !== 'passive' && student.groupId === selectedGroupId;
    if (showPassive) { if (student.status !== 'passive') return false; } 
    else { if (student.status === 'passive') return false; }
    const search = searchQuery.toLowerCase().trim();
    if (!`${student.name} ${student.lastName}`.toLowerCase().includes(search)) return false;
    if (viewMode === 'all-branches') return studentBranch === "Tümü" || student.branch === studentBranch;
    if (viewMode === 'all-groups') return student.branch === "Kadıköy";
    return true;
  });

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
      const gList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Group[];
      setGroups(gList);
    });
    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const sList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
      setStudents(sList);
    });
    return () => { unsubGroups(); unsubStudents(); };
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const q = query(collection(db, "users"), where("role", "==", "instructor"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const insList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            displayName: data.name ? `${data.name} ${data.surname || ""}` : data.email
          };
        });
        setInstructors(insList);
      });
      return () => unsubscribe();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedGroupId && !isFormOpen && filteredGroups.length > 0) {
      const firstId = filteredGroups[0].id;
      setSelectedGroupId(firstId);
      setLastSelectedId(firstId);
    }

    if (selectedGroupId) {
      const currentGroup = groups.find(g => g.id === selectedGroupId);
      if (currentGroup) {
        setStudentBranch(currentGroup.branch);
        setSelectedGroupIdForStudent(selectedGroupId);
      }
    }
  }, [filteredGroups, isFormOpen, selectedGroupId, groups]);

  useEffect(() => {
    const labels: Record<string, string> = {
      groups: "Eğitim Yönetimi", profile: "Profil Ayarları", users: "Kullanıcılar"
    };
    setHeaderTitle(labels[activeSubTab] || "Eğitim Yönetimi");
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
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 300);
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

  useEffect(() => {
    if (!isAdmin && isFormOpen && !editingGroupId) {
      // Logic for instructors
    }
  }, [isFormOpen, isAdmin, editingGroupId]);

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

      if (modalConfig.type === 'delete') {
        const batchPromises = affectedStudents.map(student =>
          updateDoc(doc(db, "students", student.id), {
            status: 'passive',
            lastGroupCode: targetGroup?.code || "",
            groupCode: `Mezun (${targetGroup?.code || "Bilinmiyor"})`,
            groupId: "unassigned",
            updatedAt: new Date()
          })
        );
        await Promise.all(batchPromises);
        await deleteDoc(groupRef);
        if (selectedGroupId === modalConfig.groupId) setSelectedGroupId(null);
        showNotification("Grup silindi.");
      } else if (modalConfig.type === 'archive') {
        const batchPromises = affectedStudents.map(student =>
          updateDoc(doc(db, "students", student.id), { status: 'passive', updatedAt: new Date() })
        );
        await Promise.all(batchPromises);
        await updateDoc(groupRef, { status: 'archived' });
        if (selectedGroupId === modalConfig.groupId) setSelectedGroupId(null);
        showNotification("Grup arşivlendi.");
      } else if (modalConfig.type === 'restore') {
        await updateDoc(groupRef, { status: 'active' });
        const batchPromises = affectedStudents.map(student =>
          updateDoc(doc(db, "students", student.id), { status: 'active', updatedAt: new Date() })
        );
        await Promise.all(batchPromises);
        showNotification("Grup geri yüklendi.");
      }
    } catch (error) { showNotification("Hata oluştu."); }
    setIsProcessing(false);
    setModalConfig({ isOpen: false, type: null, groupId: null });
  };

  const handleAddStudent = async () => {
    if (!studentName.trim() || !studentLastName.trim() || !selectedGroupIdForStudent) {
      setStudentError("Lütfen eksik alanları doldurun.");
      return;
    }
    const targetGroup = groups.find(g => g.id === selectedGroupIdForStudent);
    const studentData: any = {
      name: studentName.trim(),
      lastName: studentLastName.trim(),
      email: studentEmail.trim(),
      note: studentNote.trim(),
      groupId: selectedGroupIdForStudent,
      groupCode: targetGroup?.code || "Tanımsız",
      branch: targetGroup?.branch || "Kadıköy",
      status: 'active',
      updatedAt: new Date()
    };

    try {
      if (editingStudentId) {
        const oldStudent = students.find(s => s.id === editingStudentId);
        if (oldStudent && oldStudent.groupId !== selectedGroupIdForStudent) {
          if (oldStudent.groupId && oldStudent.groupId !== "unassigned") {
            await updateDoc(doc(db, "groups", oldStudent.groupId), { students: increment(-1) });
          }
          await updateDoc(doc(db, "groups", selectedGroupIdForStudent), { students: increment(1) });
        }
        await updateDoc(doc(db, "students", editingStudentId), studentData);
        showNotification("Öğrenci güncellendi.");
      } else {
        await addDoc(collection(db, "students"), { ...studentData, points: 0, createdAt: new Date() });
        await updateDoc(doc(db, "groups", selectedGroupIdForStudent), { students: increment(1) });
        showNotification("Öğrenci eklendi.");
      }
      setIsStudentFormOpen(false);
      resetStudentForm();
    } catch (error) { showNotification("Öğrenci kaydedilemedi."); }
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
  };

  const handleEditStudent = (student: any) => {
    setEditingStudentId(student.id);
    setSelectedGroupIdForStudent(student.groupId);
    setStudentName(student.name);
    setStudentLastName(student.lastName || "");
    setStudentEmail(student.email || "");
    setStudentNote(student.note || "");
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
    isScheduleOpen, setIsScheduleOpen, errors, setErrors, isShaking, setIsShaking,
    searchQuery, setSearchQuery, isStudentFormOpen, setIsStudentFormOpen,
    studentName, setStudentName, studentLastName, setStudentLastName,
    studentEmail, setStudentEmail, studentNote, setStudentNote,
    studentBranch, setStudentBranch, studentError, setStudentError,
    viewMode, setViewMode, toast, setToast, selectedGroupIdForStudent, setSelectedGroupIdForStudent,
    modalConfig, setModalConfig, isProcessing, scheduleRef, menuRef, schedules,
    handleOpenForm, handleCancel, handleSave, handleEdit, requestModal, confirmModalAction,
    handleAddStudent, handleDeleteStudent, handleBulkDeleteStudents, handleEditStudent, resetStudentForm,
    filteredGroups, filteredStudents, showPassive, setShowPassive, selectedStudentIds, setSelectedStudentIds,
    toggleStudentSelection, handleSelectAll, deleteModal,setDeleteModal 
    // -------------------------
  };
};