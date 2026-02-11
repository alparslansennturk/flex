"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Info, Code2, ChevronDown, ChevronRight, X, AlertCircle,
  MoreVertical, RotateCcw, Trash2, Edit2, Archive, Clock,
  User, MapPin, CheckCircle2, Users, PlusCircle, Search, Layout,
  Mail, FileText, PencilLine
} from "lucide-react";

// Firebase importları (Hatasız ve serverTimestamp eklenmiş hali)
import { db } from "@/app/lib/firebase";
import {
  collection, onSnapshot, addDoc, query, where, doc,
  updateDoc, deleteDoc, increment, serverTimestamp
} from "firebase/firestore";

/**
 * Interface Tanımlamaları: Veri yapılarını TypeScript'e tanıtarak "any" hatalarını önlüyoruz.
 */
interface Group {
  id: string;
  code: string;
  branch: string;
  instructor: string;
  session: string;
  students: number;
  status: string;
  createdAt?: any; // Bu satırı ekledik, '?' işareti "opsiyonel" demek
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
  status?: 'active' | 'passive'; // Öğrencinin aktiflik durumu
  lastGroupCode?: string;        // Mezun olduğunda eski grubunu saklamak için
  updatedAt?: any;               // Takip için zaman damgası
}

export default function ManagementContent({ setHeaderTitle }: { setHeaderTitle: (t: string) => void }) {
  const isAdmin = true;

  // --- STATE TANIMLAMALARI ---
  const [activeSubTab, setActiveSubTab] = useState("groups");
  const [currentView, setCurrentView] = useState("Aktif Sınıflar");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, studentId: "" });
  const [showPassive, setShowPassive] = useState(false); //Aktif Pasif öğrenci tanımlaması
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Veritabanı State'leri
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

  /* --- ÖĞRENCİ YÖNETİMİ STATE'LERİ --- */
  const [searchQuery, setSearchQuery] = useState("");
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [studentBranch, setStudentBranch] = useState("Kadıköy");
  const [studentGroupCode, setStudentGroupCode] = useState("");
  const [studentError, setStudentError] = useState("");
  const [viewMode, setViewMode] = useState<'group-list' | 'all-groups' | 'all-branches'>('group-list');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null); // BU SATIRI EKLE
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [selectedGroupIdForStudent, setSelectedGroupIdForStudent] = useState<string>("");

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'archive' | 'delete' | 'restore' | 'student-delete' | null; // student-delete ekledik
    groupId: string | null;
    studentId?: string | null; // studentId ekledik
  }>({
    isOpen: false,
    type: null,
    groupId: null,
    studentId: null
  });

  const scheduleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const schedules = [
    "Pts - Çar | 19.00 - 21.30", "Sal - Per | 19.00 - 21.30", "Cts - Paz | 09.00 - 12.00",
    "Cts - Paz | 12.00 - 15.00", "Cts - Paz | 15.00 - 18.00", "Özel Grup Tanımla",
  ];

  // --- FIREBASE CANLI VERİ MOTORU ---
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
}, []); // <--- BURAYI BOŞ BIRAKTIK (ÖNEMLİ)

  const showNotification = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };



  // --- FORM VE İPTAL KONTROLLERİ ---
  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingGroupId(null);
    setGroupCode("");
    setSelectedSchedule("Grup seansı seçiniz...");
    setCustomSchedule("");
    setErrors({});
    if (lastSelectedId) setSelectedGroupId(lastSelectedId);
  };

  const handleOpenForm = () => {
  if (currentView !== "Aktif Sınıflar") return;
  if (!isFormOpen) {
    // Eski seçimi yedeklemeyi bırakıyoruz, direkt sıfırlıyoruz
    setSelectedGroupId(null);
    setLastSelectedId(null); 
    setIsFormOpen(true);
  } else {
    handleCancel();
  }
};

  // --- GRUP İŞLEMLERİ (KAYDET / DÜZENLE) ---
  const handleEdit = (group: Group) => {
    setEditingGroupId(group.id);
    setGroupCode(group.code.replace("Grup ", ""));
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

  const handleSave = async () => {
  const newErrors: { code?: string; schedule?: string } = {};
  if (!groupCode.trim()) newErrors.code = "Grup kodu zorunludur.";
  if (selectedSchedule === "Grup seansı seçiniz...") newErrors.schedule = "Seans seçimi zorunludur.";

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);
    return;
  }

  const formattedCode = groupCode.trim().toLowerCase().startsWith("grup")
    ? groupCode.trim()
    : `Grup ${groupCode.trim()}`;

  const finalSession = selectedSchedule === "Özel Grup Tanımla" ? customSchedule : selectedSchedule;

  try {
    if (editingGroupId) {
      await updateDoc(doc(db, "groups", editingGroupId), {
        code: formattedCode,
        session: finalSession,
        branch: "Kadıköy"
      });
      showNotification("Grup başarıyla güncellendi.");
    } else {
      const docRef = await addDoc(collection(db, "groups"), {
        code: formattedCode,
        branch: "Kadıköy",
        instructor: "Alparslan Hoca",
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
    setSelectedSchedule("Grup seansı seçiniz...");
    setCustomSchedule("");
    setErrors({});

  } catch (error) {
    console.error("Grup Kayıt Hatası:", error);
    showNotification("Grup kaydedilirken bir hata oluştu.");
  }
};

  // --- MODAL YÖNETİMİ ---
  const requestModal = (id: string, type: 'archive' | 'delete' | 'restore') => {
    setModalConfig({ isOpen: true, type, groupId: id });
    setOpenMenuId(null);
  };

  /**
  * @function confirmModalAction
  * @description Grup silme, arşivleme ve geri alma sırasında öğrenci geçmişini yönetir.
  */
  const confirmModalAction = async () => {
    // Guard Clause: Grup ID yoksa veya tip belirtilmemişse işlem yapma
    if (!modalConfig.groupId || !modalConfig.type) return;

    try {
      const groupRef = doc(db, "groups", modalConfig.groupId);
      const targetGroup = groups.find(g => g.id === modalConfig.groupId);
      const affectedStudents = students.filter(s => s.groupId === modalConfig.groupId);

      // --- 1. SİLME İŞLEMİ (Delete) ---
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
        showNotification("Grup silindi; öğrenciler mezun statüsüyle arşivlendi.");
      }

      // --- 2. ARŞİVLEME İŞLEMİ (Archive) ---
      else if (modalConfig.type === 'archive') {
        const batchPromises = affectedStudents.map(student =>
          updateDoc(doc(db, "students", student.id), {
            status: 'passive',
            updatedAt: new Date()
          })
        );

        await Promise.all(batchPromises);
        await updateDoc(groupRef, { status: 'archived' });

        if (selectedGroupId === modalConfig.groupId) setSelectedGroupId(null);
        showNotification("Grup ve öğrenciler arşivlendi.");
      }

      // --- 3. GERİ ALMA İŞLEMİ (Restore) ---
      else if (modalConfig.type === 'restore') {
        // Önce grubu tekrar aktife çekiyoruz
        await updateDoc(groupRef, { status: 'active' });

        // O gruba ait olan (affected) öğrencileri de tekrar aktife çekiyoruz
        const batchPromises = affectedStudents.map(student =>
          updateDoc(doc(db, "students", student.id), {
            status: 'active',
            updatedAt: new Date()
          })
        );

        await Promise.all(batchPromises);
        showNotification("Grup ve öğrenciler tekrar aktif listeye taşındı.");
      }

    } catch (error) {
      console.error("İşlem hatası:", error);
      showNotification("Teknik bir hata oluştu.");
    }

    // Modalı kapat ve temizle
    setModalConfig({ isOpen: false, type: null, groupId: null });
  };

  // --- ÖĞRENCİ YÖNETİMİ ---

  const handleNewStudent = () => {
    resetStudentForm(); // Önceki düzenlemeden kalan verileri temizler

    if (selectedGroupId) {
      // Sol panelde hangi grup seçiliyse modal direkt o grupla açılır
      setSelectedGroupIdForStudent(selectedGroupId);
    } else if (groups.length > 0) {
      // Eğer hiçbir grup seçili değilse listenin en başındaki grubu seçer
      setSelectedGroupIdForStudent(groups[0].id);
    }

    setIsStudentFormOpen(true); // Modalı açar
  };

  const handleAddStudent = async () => {
    if (!studentName.trim() || !studentLastName.trim() || !selectedGroupIdForStudent) {
      setStudentError("Lütfen ad, soyad ve grup seçimini eksiksiz yapın.");
      return;
    }

    const targetGroup = groups.find(g => g.id === selectedGroupIdForStudent);

    // ÖNEMLİ: Öğrenci bir gruba atanıyorsa artık AKTİF'tir. 
    // 'Mezun' etiketinden ve statüsünden kurtarıyoruz.
    const studentData: any = {
      name: studentName.trim(),
      lastName: studentLastName.trim(),
      email: studentEmail.trim(),
      note: studentNote.trim(),
      groupId: selectedGroupIdForStudent,
      groupCode: targetGroup?.code || "Tanımsız",
      branch: targetGroup?.branch || "Kadıköy",
      status: 'active', // Pasiften aktife çekme garantisi
      updatedAt: new Date()
    };

    try {
      if (editingStudentId) {
        const oldStudent = students.find(s => s.id === editingStudentId);

        // Grup değişikliği varsa sayaçları yönet
        if (oldStudent && oldStudent.groupId !== selectedGroupIdForStudent) {
          // Eski gruptan (eğer unassigned değilse) düş
          if (oldStudent.groupId && oldStudent.groupId !== "unassigned") {
            await updateDoc(doc(db, "groups", oldStudent.groupId), { students: increment(-1) });
          }
          // Yeni gruba ekle
          await updateDoc(doc(db, "groups", selectedGroupIdForStudent), { students: increment(1) });
        }

        await updateDoc(doc(db, "students", editingStudentId), studentData);
        showNotification("Öğrenci bilgileri ve durumu güncellendi.");
      } else {
        // YENİ KAYIT
        await addDoc(collection(db, "students"), {
          ...studentData,
          points: 0,
          createdAt: new Date()
        });

        await updateDoc(doc(db, "groups", selectedGroupIdForStudent), {
          students: increment(1)
        });

        showNotification("Öğrenci başarıyla eklendi.");
      }

      setIsStudentFormOpen(false);
      resetStudentForm();
    } catch (error) {
      console.error("Firebase Hatası:", error);
      showNotification("Bir hata oluştu, lütfen tekrar deneyin.");
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    // 1. Önce silinecek öğrenciyi bulalım ki hangi grupta olduğunu bilelim
    const studentToDelete = students.find(s => s.id === studentId);

    if (!studentToDelete) return;

    try {
      // 2. Öğrenciyi veritabanından sil
      await deleteDoc(doc(db, "students", studentId));

      // 3. Eğer öğrencinin bir grubu varsa, o grubun sayacını -1 yap
      if (studentToDelete.groupId) {
        await updateDoc(doc(db, "groups", studentToDelete.groupId), {
          students: increment(-1)
        });
      }

      showNotification("Öğrenci silindi ve grup mevcudu düşürüldü.");
    } catch (error) {
      console.error("Silme Hatası:", error);
      showNotification("Silme işlemi sırasında hata oluştu.");
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (selectedStudentIds.length === 0) return;

    try {
      const deletePromises = selectedStudentIds.map(async (sId) => {
        const student = students.find(s => s.id === sId);
        if (student) {
          // 1. Öğrenciyi Firebase'den sil
          await deleteDoc(doc(db, "students", sId));
          // 2. Eğer bir gruba bağlıysa o grubun mevcudunu 1 düşür
          if (student.groupId && student.groupId !== "unassigned") {
            await updateDoc(doc(db, "groups", student.groupId), {
              students: increment(-1)
            });
          }
        }
      });

      await Promise.all(deletePromises);
      setSelectedStudentIds([]); // Silme bitince seçili listesini sıfırla
      showNotification(`${selectedStudentIds.length} öğrenci kalıcı olarak silindi.`);
    } catch (error) {
      console.error("Toplu silme hatası:", error);
      showNotification("Bazı kayıtlar silinemedi.");
    }
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

  const resetStudentForm = () => {
    setEditingStudentId(null);
    setStudentName("");
    setStudentLastName("");
    setStudentEmail("");
    setStudentNote("");
    setStudentError("");
  };

  // --- EFFECTLER VE FİLTRELEME ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (scheduleRef.current && !scheduleRef.current.contains(event.target as Node)) setIsScheduleOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const labels: Record<string, string> = {
      groups: "Eğitim Yönetimi", profile: "Profil Ayarları", users: "Kullanıcılar"
    };
    setHeaderTitle(labels[activeSubTab] || "Eğitim Yönetimi");
  }, [activeSubTab, setHeaderTitle]);
  

const filteredGroups = groups
  .filter(g => currentView === "Arşiv" ? g.status === "archived" : g.status === "active")
  .sort((a: any, b: any) => {
    // Sadece tarihe göre diz, karmaşık kontrolleri boşver
    const tA = a.createdAt?.seconds || 0;
    const tB = b.createdAt?.seconds || 0;
    return tB - tA;
  });

  useEffect(() => {
  if (!selectedGroupId && !isFormOpen && filteredGroups.length > 0) {
    const firstId = filteredGroups[0].id;
    setSelectedGroupId(firstId);
    setLastSelectedId(firstId);
  }
}, [filteredGroups, isFormOpen, selectedGroupId]);
    
    
  // ============================================================
  // ADIM 2: ÖĞRENCİ FİLTRELEME VE SEÇİM MOTORU (BİRLEŞTİRİLMİŞ)
  // ============================================================

  /**
   * @description Öğrenci listesini görünüm moduna, aktiflik durumuna, 
   * şubeye ve arama kriterlerine göre süzen ana motor.
   */
  const filteredStudents = students.filter((student) => {
    // 1. Grup Listesi Modu: Sadece seçili grubun aktiflerini göster
    if (viewMode === 'group-list') {
      return student.status !== 'passive' && student.groupId === selectedGroupId;
    }

    // 2. Global Modlar (Tüm Gruplar/Şubeler): Sekmeye göre tam ayrım
    if (showPassive) {
      // Sadece Mezunlar Sekmesi
      if (student.status !== 'passive') return false;
    } else {
      // Sadece Aktif Öğrenciler Sekmesi
      if (student.status === 'passive') return false;

      // Grubu arşivlenmiş aktifleri gizle (Opsiyonel Güvenlik)
      const parentGroup = groups.find((g) => g.id === student.groupId);
      if (!parentGroup || parentGroup.status === 'archived') return false;
    }

    // 3. Arama Filtresi
    const searchNormalized = searchQuery.toLowerCase().trim();
    const fullName = `${student.name || ""} ${student.lastName || ""}`.toLowerCase();
    if (!fullName.includes(searchNormalized)) return false;

    // 4. Şube Filtresi
    if (viewMode === 'all-branches') {
      return studentBranch === "Tümü" || student.branch === studentBranch;
    }
    if (viewMode === 'all-groups') {
      return student.branch === "Kadıköy";
    }

    return true;
  });

  /**
   * @description Tek bir öğrencinin seçim durumunu değiştirir.
   */
  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id)
        ? prev.filter((sId) => sId !== id)
        : [...prev, id]
    );
  };

  /**
   * @description O an ekranda filtrelenmiş olan tüm öğrencileri seçer/bırakır.
   */
  const handleSelectAll = () => {
    // Eğer seçili olanların sayısı, motorun süzdüğü (filteredStudents) sayısına eşitse; temizle.
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      // Değilse; motorun süzgecinden geçen herkesin ID'sini listeye ekle.
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  // --- TASARIM BAŞLIYOR ---

  return (
    <div className="w-full font-inter select-none pb-20 relative">
      <style jsx global>{`
        @keyframes fast-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
        .animate-shake-fast { animation: fast-shake 0.25s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>

      {/* --- BİLDİRİM TOAST --- */}
      {toast.show && (
        <div className="fixed top-12 right-12 z-[200] animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[20px] p-5 flex items-center gap-4 min-w-[320px]">
            <div className="w-10 h-10 rounded-full bg-status-success-50 flex items-center justify-center text-status-success-500"><CheckCircle2 size={24} /></div>
            <div><p className="text-[14px] font-bold text-base-primary-900 leading-none mb-1">İşlem başarılı</p><p className="text-[13px] font-medium text-neutral-500 leading-none">{toast.message}</p></div>
            <button onClick={() => setToast({ show: false, message: "" })} className="ml-auto p-1.5 text-neutral-300 hover:text-neutral-500 transition-colors cursor-pointer"><X size={16} /></button>
          </div>
        </div>
      )}



      {/* --- BÖLÜM 1: NAVİGASYON --- */}
      <div className="w-full mt-6">
        <div className="max-w-[1920px] mx-auto px-8">
          <div className="border-b border-surface-200 flex items-center justify-between h-20 ppx-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
            <nav className="flex items-center h-full">
              {["Profil Ayarları", "Kullanıcılar", "Eğitim Yönetimi", "Header & Footer", "Sidebar"].map((label) => {
                const currentId = label === "Eğitim Yönetimi" ? "groups" : label.toLowerCase().replace(" ", "-");
                return (
                  <button key={label} onClick={() => setActiveSubTab(currentId)} className="relative h-full flex items-center px-8 first:pl-0 cursor-pointer outline-none group transition-colors">
                    <span className={`text-[15px] font-semibold tracking-tight whitespace-nowrap ${activeSubTab === currentId ? "text-base-primary-500" : "text-text-tertiary hover:text-text-secondary"}`}>{label}</span>
                    {activeSubTab === currentId && <div className="absolute bottom-0 left-0 w-full h-[3.2px] bg-base-primary-500 rounded-t-full" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {activeSubTab === 'groups' && (
        <div className="max-w-[1920px] mx-auto px-8 mt-[48px]">
          {/* --- BÖLÜM 2: AKSİYON SATIRI --- */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-300 px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
            <div className="flex items-center gap-6">
              <button onClick={handleOpenForm} disabled={currentView !== "Aktif Sınıflar" && !editingGroupId} className={`w-[144px] h-[40px] text-white rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer ${currentView === "Aktif Sınıflar" || editingGroupId ? "bg-[#FF8D28] shadow-orange-500/10" : "bg-neutral-300 shadow-none opacity-50 cursor-not-allowed pointer-events-none"}`}><span>{isFormOpen ? "Vazgeç" : (editingGroupId ? "Düzenle" : "Grup ekle")}</span>{isFormOpen ? <X size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}</button>
              <p className="text-[14px] text-neutral-400 font-medium border-l border-neutral-200 pl-6 h-6 flex items-center leading-none">{currentView !== "Aktif Sınıflar" && !editingGroupId ? "Yeni grup eklemek için aktif sınıflar sekmesine geçin." : (editingGroupId ? "Mevcut grup bilgilerini güncelleyin." : "Yeni bir eğitim grubu veya sınıf oluşturun.")}</p>
            </div>
            <div className="flex items-center gap-6 pr-4">
              <div className="text-right hidden md:block"><p className="text-[11px] font-bold text-neutral-400 leading-none mb-1.5 tracking-wider">Sistem durumu</p><p className="text-[14px] font-bold text-neutral-700 leading-none">{groups.filter(g => g.status === 'active').length} Grup / {groups.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.students, 0)} Öğrenci</p></div>
              <button className="w-10 h-10 rounded-lg bg-surface-50 border border-surface-100 flex items-center justify-center text-neutral-400 hover:text-base-primary-500 transition-colors cursor-pointer outline-none"><Info size={18} /></button>
            </div>
          </div>

          {/* --- BÖLÜM 3: FORM ALANI --- */}
          <div className={`grid transition-all duration-500 ease-in-out ${isFormOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
            <div className="min-h-0 overflow-visible px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
              <div className={`bg-white border border-surface-200 rounded-[16px] p-[36px] shadow-sm relative z-20 mb-8 ${isShaking ? 'animate-shake-fast' : ''}`}>
                <div className="grid grid-cols-2 gap-[40px]">
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">Grup kodu</label>
                    <div className="relative">
                      <input type="text" value={groupCode} onChange={(e) => { setGroupCode(e.target.value); setErrors({ ...errors, code: undefined }); }} placeholder="Örn: 121" className={`w-full h-12 bg-neutral-50 border rounded-lg px-4 text-sm focus:outline-none transition-all ${errors.code ? 'border-status-danger-500' : 'border-surface-300 focus:border-base-primary-500'}`} />
                      <Code2 size={20} className={`absolute right-4 top-1/2 -translate-y-1/2 ${errors.code ? 'text-status-danger-500' : 'text-neutral-400'}`} />
                    </div>
                    {errors.code && <span className="text-[13px] font-medium text-status-danger-500 flex items-center gap-1.5 pt-1 animate-in fade-in slide-in-from-top-1"><AlertCircle size={14} /> {errors.code}</span>}
                  </div>
                  <div className="flex flex-col gap-2 relative" ref={scheduleRef}>
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">Gün ve saat seçimi</label>
                    <button onClick={() => setIsScheduleOpen(!isScheduleOpen)} className={`w-full h-12 bg-neutral-50 border rounded-lg px-4 flex items-center justify-between text-sm transition-all cursor-pointer ${errors.schedule ? 'border-status-danger-500' : 'border-surface-300'}`}>
                      <span className={selectedSchedule.includes("seçiniz") ? "text-neutral-400" : "text-base-primary-900"}>{selectedSchedule}</span>
                      <ChevronDown size={18} className={`text-neutral-400 transition-transform ${isScheduleOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isScheduleOpen && (
                      <div className="absolute top-[52px] left-0 w-full bg-white border border-surface-200 rounded-lg shadow-sm z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {schedules.map((s) => (<button key={s} onClick={() => { setSelectedSchedule(s); setIsScheduleOpen(false); setErrors({ ...errors, schedule: undefined }); }} className="w-full text-left px-4 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-surface-50 border-b border-surface-50 last:border-0 transition-colors cursor-pointer">{s}</button>))}
                      </div>
                    )}
                    {errors.schedule && <span className="text-[13px] font-medium text-status-danger-500 flex items-center gap-1.5 pt-1 animate-in fade-in slide-in-from-top-1"><AlertCircle size={14} /> {errors.schedule}</span>}
                  </div>
                </div>
                {/* --- ÖZEL GRUP TANIMLA INPUTU (Direkt Görünüm) --- */}
                {selectedSchedule === "Özel Grup Tanımla" && (
                  <div className="mt-6 flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">Özel seans detaylarını girin</label>
                    <div className="relative">
                      <input type="text" value={customSchedule} onChange={(e) => setCustomSchedule(e.target.value)} placeholder="Örn: Salı - Perşembe | 10:00 - 13:00" className="w-full h-12 bg-neutral-50 border border-surface-300 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium" />
                      <Clock size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    </div>
                  </div>
                )}
                <div className="mt-8 flex justify-end gap-3">
                  <button onClick={handleCancel} className="px-6 h-10 bg-neutral-500 text-white rounded-lg font-bold text-sm cursor-pointer hover:bg-neutral-200 transition-colors">Vazgeç</button>
                  <button onClick={handleSave} className="h-10 px-6 bg-[var(--color-designstudio-secondary-500)] text-white rounded-lg font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 transition-all">Kaydet <ChevronRight size={16} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* --- BÖLÜM 4: İÇERİK --- */}
          <div className="mt-6">
            <div className="flex items-center bg-surface-50 w-fit p-1 rounded-[14px] mb-8 px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
              {["Aktif Sınıflar", isAdmin && "Tüm Sınıflar", "Arşiv"].filter(Boolean).map((t) => (
                <button key={t as string} onClick={() => setCurrentView(t as string)} className={`px-6 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${currentView === t ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>{t as string}</button>
              ))}
            </div>
            {/* --- GRUP VE ÖĞRENCİ LİSTESİ BAŞLANGICI --- */}
            {currentView === "Aktif Sınıflar" ? (
              filteredGroups.length > 0 ? (
                // DURUM A: GRUP VARSA KARTLAR
                <div className="px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 flex flex-wrap gap-6 animate-in fade-in duration-500">
                  {filteredGroups.map((group) => {
                    const isActive = selectedGroupId === group.id;
                    return (
                      <div key={group.id} onClick={() => setSelectedGroupId(group.id)} className={`relative w-[256px] h-[116px] rounded-[16px] p-6 transition-all cursor-pointer group ${isActive ? "bg-base-primary-700 text-white shadow-xl scale-[1.02]" : "bg-white border border-neutral-300 text-text-primary hover:bg-base-primary-700 hover:text-white hover:border-transparent"}`}>
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === group.id ? null : group.id); }} className={`absolute top-4 right-4 p-1 rounded-lg transition-colors cursor-pointer ${isActive ? "text-white/60 hover:bg-white/10" : "text-neutral-400 group-hover:text-white/60"}`}><MoreVertical size={20} /></button>
                        {openMenuId === group.id && (
                          <div ref={menuRef} className="absolute top-12 right-4 w-44 bg-white rounded-lg shadow-2xl border border-surface-200 z-[60] overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200 cursor-default">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(group); }} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-surface-50 flex items-center gap-2 cursor-pointer transition-colors"><Edit2 size={16} /> Düzenle</button>
                            <button onClick={(e) => { e.stopPropagation(); requestModal(group.id, 'archive'); }} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-surface-50 flex items-center gap-2 cursor-pointer transition-colors"><Archive size={16} /> Arşive ekle</button>
                          </div>
                        )}
                        <div className="flex flex-col h-full justify-between pointer-events-none">
                          <div>
                            <p className={`text-[14px] font-semibold leading-none mb-2 ${isActive ? "text-white/60" : "text-text-primary group-hover:text-white/60"}`}>{group.code}</p>
                            <p className={`text-[16px] font-bold leading-none ${isActive ? "text-white" : "text-base-primary-700 group-hover:text-white"}`}>{group.session}</p>
                          </div>
                          <p className={`text-[14px] font-semibold leading-none ${isActive ? "text-white/60" : "text-text-primary group-hover:text-white/60"}`}>Öğrenci Sayısı: {group.students}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // DURUM B: GRUP YOKSA GENİŞ EMPTY STATE
                <div className="px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 pr-8 w-full animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-full py-12 bg-white border border-dashed border-neutral-300 rounded-[20px] flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-300 mb-4 border border-neutral-100">
                      <Layout size={28} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-[16px] font-bold text-neutral-700 mb-1">Aktif Grup Tanımı Bulunmuyor</h3>
                    <p className="text-[13px] font-medium text-neutral-400 max-w-[320px] leading-relaxed">
                      Sistemi kullanmaya başlamak için önce bir eğitim grubu oluşturmalısınız.
                    </p>
                    <button
                      onClick={handleOpenForm}
                      className="mt-6 px-6 py-2.5 bg-base-primary-700 text-white rounded-xl text-[13px] font-bold hover:bg-base-primary-800 transition-all cursor-pointer shadow-lg shadow-base-primary-700/20 active:scale-95 flex items-center gap-2 outline-none"
                    >
                      <Plus size={18} />
                      Yeni Grup Oluştur
                    </button>
                  </div>
                </div>
              )
            ) : (
              // DURUM C: ARŞİV VEYA TÜM SINIFLAR (TABLO MODU)
              <div className="px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 w-full animate-in fade-in duration-500">
                <div className="bg-white border border-neutral-300 rounded-[16px] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-50 border-b border-neutral-200">
                        <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Grup kodu</th>
                        <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Şube</th>
                        <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Eğitmen</th>
                        <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight text-center">Öğrenci</th>
                        <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight text-right pr-8">İşlem</th>
                      </tr>
                    </thead>

                    <tbody>{filteredGroups.map((group) => (
                      <tr key={group.id} className="border-b border-neutral-100 last:border-0 hover:bg-surface-50/50 transition-colors">
                        <td className="px-6 py-3 font-bold text-base-primary-700">{group.code}</td>
                        <td className="px-6 py-3 text-[14px] text-neutral-600 font-medium"><div className="flex items-center gap-2"><MapPin size={14} className="text-neutral-400" />{group.branch}</div></td>
                        <td className="px-6 py-3 text-[14px] text-neutral-600 font-medium"><div className="flex items-center gap-2"><User size={14} className="text-neutral-400" />{group.instructor}</div></td>
                        <td className="px-6 py-3 text-center font-bold text-neutral-700">{group.students}</td>
                        <td className="px-6 py-3 text-right pr-8">
                          {currentView === "Arşiv" ? (
                            <div className="flex justify-end gap-2"><button onClick={() => requestModal(group.id, 'restore')} className="p-1.5 text-base-primary-500 hover:bg-base-primary-50 rounded-lg cursor-pointer transition-all"><RotateCcw size={16} /></button><button onClick={() => requestModal(group.id, 'delete')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all"><Trash2 size={16} /></button></div>
                          ) : (
                            <button
                              onClick={() => handleEdit(group)}
                              className="p-1.5 cursor-pointer transition-all hover:opacity-70 outline-none"
                              style={{ color: 'var(--color-designstudio-secondary-500)' }}
                            >
                              <PencilLine size={18} strokeWidth={2} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* --- BÖLÜM 5: ÖĞRENCİ LİSTESİ KOMUTA MERKEZİ --- */}
          {currentView === "Aktif Sınıflar" && (
            <div className="mt-[64px] px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center pb-4 border-b border-neutral-200 mb-4">

                {/* 1. Başlık ve Sayı (Filtrelenmiş Listeyi Kullanır) */}
                <div className="flex items-center gap-2 min-w-fit">
                  <Users size={18} className="text-base-primary-900" />
                  <h2 className="text-[18px] font-bold text-base-primary-900 leading-none tracking-tight">Öğrenciler</h2>
                  <span className="text-[13px] font-medium text-neutral-400 ml-2">
                    ({filteredStudents.length} Kayıt)
                  </span>
                </div>

                {/* 2. Görünüm Filtreleri */}
                <div className="flex items-center ml-14 bg-surface-50 p-1 rounded-lg border border-neutral-100 shadow-sm">
                  <button
                    onClick={() => setViewMode("group-list")}
                    className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${viewMode === "group-list" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                  >
                    Grup Listesi
                  </button>
                  <button
                    onClick={() => setViewMode("all-groups")}
                    className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${viewMode === "all-groups" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                  >
                    Tüm Gruplarım
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setViewMode("all-branches")}
                      className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${viewMode === "all-branches" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                    >
                      Tüm Şubeler
                    </button>
                  )}
                </div>

                {/* 3. Şube Seçimi (Admin'e Özel) */}
                {isAdmin && viewMode === "all-branches" && (
                  <div className="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-4">
                    <div className="h-6 w-px bg-neutral-200 mx-2" />
                    <select
                      value={studentBranch}
                      onChange={(e) => setStudentBranch(e.target.value)}
                      className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-[13px] font-bold text-base-primary-900 outline-none cursor-pointer shadow-sm"
                    >
                      <option value="Tümü">Tümü</option>
                      <option value="Kadıköy">Kadıköy</option>
                      <option value="Şirinevler">Şirinevler</option>
                      <option value="Pendik">Pendik</option>
                    </select>
                  </div>
                )}

                {/* 4. Öğrenci Ekle Butonu */}
                <button
                  onClick={() => {
                    if (!isStudentFormOpen) {
                      resetStudentForm();
                      const targetId = selectedGroupId || (groups.length > 0 ? groups[0].id : "");
                      setSelectedGroupIdForStudent(targetId);
                    }
                    setIsStudentFormOpen(!isStudentFormOpen);
                  }}
                  className="flex items-center gap-2 ml-8 text-base-primary-500 hover:text-base-primary-600 transition-colors group outline-none"
                >
                  {isStudentFormOpen ? <X size={20} /> : <PlusCircle size={20} className="transition-transform group-hover:scale-110" />}
                  <span className="text-[14px] font-bold">{isStudentFormOpen ? "Vazgeç" : "Öğrenci Ekle"}</span>
                </button>

                {/* 5. Arama Barı */}
                <div className="relative ml-auto w-[320px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="İsim veya soyisim ile ara..."
                    className="w-full h-[40px] bg-white border border-neutral-200 rounded-lg px-4 pr-10 text-[13px] font-medium focus:border-base-primary-500 transition-all shadow-sm outline-none"
                  />
                  <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                </div>
              </div>

              {/* --- SECTION 6: STUDENT ENROLLMENT FORM --- */}
              <div className={`grid transition-all duration-500 ease-in-out ${isStudentFormOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="bg-white border border-neutral-200 rounded-lg p-[36px] shadow-sm mb-8">

                    {/* 6'lı Grid Dağılımı */}
                    <div className="grid grid-cols-[140px_140px_1fr_1fr_1fr_2fr] gap-[16px]">

                      {/* 1. Şube (Seçili olan listede görünmez) */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-base-primary-900 leading-none">Şube</label>
                        <div className="relative">
                          <select
                            value={studentBranch}
                            onChange={(e) => setStudentBranch(e.target.value)}
                            className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-3 text-[13px] focus:outline-none focus:border-base-primary-500 transition-all font-semibold text-base-primary-900 appearance-none cursor-pointer outline-none"
                          >
                            {/* Seçili olanı en üstte tut ama listede tekrar seçilemesin (disabled) */}
                            <option value={studentBranch} disabled className="text-neutral-300">{studentBranch}</option>

                            {/* Sadece seçili OLMAYANLARI seçenek olarak sun */}
                            {["Kadıköy Şb.", "Şirinevler Şb.", "Pendik Şb."]
                              .filter(branch => branch !== studentBranch)
                              .map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                              ))
                            }
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* 2. Grup Seçimi (List Menü) */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-base-primary-900 leading-none">Grup Seçimi</label>
                        <div className="relative">
                          <select
                            value={selectedGroupIdForStudent}
                            onChange={(e) => {
                              setSelectedGroupIdForStudent(e.target.value);
                              setStudentError("");
                            }}
                            className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 pr-10 text-[13px] focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 appearance-none cursor-pointer outline-none"
                          >
                            <option value="">Grup seç...</option>
                            {groups.filter(g => g.status === 'active').map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.code} {/* Sadece grup kodu kalsın dedin, seansı sildim */}
                              </option>
                            ))}
                          </select>
                          {/* Açılır menü oku */}
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* 3. Ad Field */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-base-primary-900 leading-none">Ad</label>
                        <input
                          type="text"
                          value={studentName}
                          onChange={(e) => { setStudentName(e.target.value); setStudentError(""); }}
                          placeholder="Örn: Ela"
                          className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 outline-none"
                        />
                      </div>

                      {/* 4. Soyad Field */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-base-primary-900 leading-none">Soyad</label>
                        <input
                          type="text"
                          value={studentLastName}
                          onChange={(e) => { setStudentLastName(e.target.value); setStudentError(""); }}
                          placeholder="Örn: Karaca"
                          className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 outline-none"
                        />
                      </div>

                      {/* 5. E-Posta Field */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-base-primary-900 leading-none">E-Posta</label>
                        <input
                          type="email"
                          value={studentEmail}
                          onChange={(e) => { setStudentEmail(e.target.value); setStudentError(""); }}
                          placeholder="mail@ornek.com"
                          className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 outline-none"
                        />
                      </div>

                      {/* 6. Eğitmen Notu Field */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-base-primary-900 leading-none">Eğitmen Notu</label>
                        <textarea
                          rows={1}
                          value={studentNote}
                          onChange={(e) => setStudentNote(e.target.value)}
                          className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 resize-none py-[9px] outline-none"
                        />
                      </div>
                    </div>

                    {/* Footer Row: Error Message & Action Buttons */}
                    <div className="mt-8 flex items-center justify-end gap-[16px]">
                      {studentError && (
                        <p className="text-red-500 text-[13px] font-bold animate-shake-fast">
                          {studentError}
                        </p>
                      )}
                      <button
                        onClick={handleAddStudent}
                        className="h-10 px-8 bg-[var(--color-designstudio-secondary-500)] text-white rounded-lg font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10 active:scale-95 transition-all outline-none"
                      >
                        Kaydet <ChevronRight size={18} />
                      </button>
                      <button
                        onClick={() => { setIsStudentFormOpen(false); setStudentError(""); }}
                        className="h-10 px-6 bg-neutral-100 text-neutral-500 rounded-lg font-bold text-sm hover:bg-neutral-200 transition-colors outline-none cursor-pointer"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* --- 2.3: MEZUN/AKTİF SEKMELERİ (Sadece Global Modlarda Görünür) --- */}
              {(viewMode === "all-groups" || viewMode === "all-branches") && (
                <div className="flex items-center gap-8 mb-6 border-b border-neutral-100 px-4 animate-in fade-in">

                  {/* AKTİF ÖĞRENCİLER SEKMESİ */}
                  <button
                    onClick={() => setShowPassive(false)}
                    className={`pb-3 text-[14px] font-semibold transition-all relative cursor-pointer ${!showPassive ? 'text-base-primary-600' : 'text-neutral-400 hover:text-neutral-500'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>Aktif Öğrenciler</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${!showPassive ? 'bg-base-primary-50 text-base-primary-600' : 'bg-neutral-50 text-neutral-400'
                        }`}>
                        {/* Sayacı viewMode'a göre dinamik yapıyoruz ki doğru rakamı versin */}
                        {students.filter(s => s.status !== 'passive' && (
                          viewMode === 'all-branches' ? (studentBranch === "Tümü" || s.branch === studentBranch) :
                            viewMode === 'all-groups' ? s.branch === "Kadıköy" : true
                        )).length}
                      </span>
                    </div>
                    {!showPassive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-base-primary-600 animate-in fade-in" />}
                  </button>

                  {/* MEZUNLAR SEKMESİ */}
                  <button
                    onClick={() => setShowPassive(true)}
                    className={`pb-3 text-[14px] font-semibold transition-all relative cursor-pointer ${showPassive ? 'text-base-primary-600' : 'text-neutral-400 hover:text-neutral-500'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>Mezunlar / Pasif</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${showPassive ? 'bg-base-primary-50 text-base-primary-600' : 'bg-neutral-50 text-neutral-400'
                        }`}>
                        {students.filter(s => s.status === 'passive' && (
                          viewMode === 'all-branches' ? (studentBranch === "Tümü" || s.branch === studentBranch) :
                            viewMode === 'all-groups' ? s.branch === "Kadıköy" : true
                        )).length}
                      </span>
                    </div>
                    {showPassive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-base-primary-600 animate-in fade-in" />}
                  </button>

                </div>
              )}


              {/* --- SECTION 7: STUDENT LIST TABLE --- */}
              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-12 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="relative">
                    <tr className={`border-b border-neutral-200 transition-all duration-300 ${selectedStudentIds.length > 0 ? "bg-base-primary-900 text-white h-14" : "bg-neutral-50/30 h-10"
                      }`}>
                      <th className="px-6 w-10 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-neutral-300 text-base-primary-600 focus:ring-base-primary-500 cursor-pointer accent-base-primary-600"
                          onChange={handleSelectAll}
                          checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                        />
                      </th>

                      {selectedStudentIds.length > 0 ? (
                        /* --- SEÇİM YAPILDIĞINDA GÖRÜNECEK ALAN (colSpan'ı 7 yaptık çünkü 2 yeni kolon geldi) --- */
                        <th colSpan={viewMode === 'all-branches' ? 7 : 6} className="px-8">
                          <div className="flex items-center justify-between w-full animate-in fade-in duration-300">
                            <div className="flex items-center gap-4">
                              <span className="text-[13px] font-bold uppercase tracking-widest">{selectedStudentIds.length} Seçildi</span>
                              <div className="w-px h-4 bg-white/20" />
                              <button
                                onClick={() => setDeleteModal({ isOpen: true, studentId: "bulk" })}
                                className="flex items-center gap-2 text-[13px] font-bold text-red-300 hover:text-red-100 transition-colors cursor-pointer outline-none"
                              >
                                <Trash2 size={16} /> Seçilenleri Sil
                              </button>
                            </div>
                            <button
                              onClick={() => setSelectedStudentIds([])}
                              className="text-[12px] font-bold text-white/50 hover:text-white transition-colors cursor-pointer underline underline-offset-4"
                            >
                              Temizle
                            </button>
                          </div>
                        </th>
                      ) : (
                        /* --- BAŞLIKLAR (E-posta ve Not Eklendi) --- */
                        <>
                          <th className="px-8 text-[14px] font-bold text-base-primary-900">Öğrenci İsmi</th>
                          <th className="px-8 text-[14px] font-bold text-base-primary-900">Şube</th>
                          <th className="px-8 text-[14px] font-bold text-base-primary-900">Grup Kodu</th>
                          <th className="px-8 text-[14px] font-bold text-base-primary-900">E-Posta Adresi</th>
                          <th className="px-8 text-[14px] font-bold text-base-primary-900">Eğitmen Notu</th>

                          {viewMode === 'all-branches' && (
                            <th className="px-8 text-[14px] font-bold text-base-primary-900">Eğitmen</th>
                          )}

                          <th className="px-8 text-[14px] font-bold text-base-primary-900 text-right pr-8">Aksiyonlar</th>
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-neutral-200">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <tr
                          key={student.id}
                          className={`h-14 transition-colors group cursor-pointer ${student.status === 'passive' ? 'bg-neutral-50/30 opacity-70' : 'hover:bg-neutral-50/50'
                            }`}
                        >
                          <td className="px-6 w-10 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-neutral-300 text-base-primary-600 focus:ring-base-primary-500 cursor-pointer accent-base-primary-600"
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>

                          <td className="px-8 text-[14px] font-semibold text-base-primary-900 leading-none">
                            {student.name} {student.lastName}
                            {student.status === 'passive' && (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Mezun</span>
                            )}
                          </td>

                          <td className="px-8 text-[13px] font-medium text-neutral-600 leading-none">{student.branch}</td>
                          <td className="px-8 text-[13px] font-medium text-neutral-600 leading-none">{student.groupCode}</td>

                          {/* YENİ: E-posta Kolonu */}
                          <td className="px-8 text-[13px] font-medium text-neutral-500 leading-none">{student.email || "-"}</td>

                          {/* YENİ: Eğitmen Notu (İtalic değil, düz) */}
                          <td className="px-8 text-[13px] font-medium text-neutral-500 leading-none max-w-[180px] truncate">{student.note || "-"}</td>

                          {viewMode === 'all-branches' && (
                            <td className="px-8 text-[13px] font-medium text-neutral-600 leading-none">
                              {groups.find(g => g.id === student.groupId)?.instructor || "-"}
                            </td>
                          )}

                          <td className="px-8 text-right pr-8">
                            <div className="flex items-center justify-end gap-4">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditStudent(student); }}
                                className="text-base-primary-400 hover:text-base-primary-600 transition-colors"
                              >
                                <PencilLine size={18} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, studentId: student.id }); }}
                                className="text-red-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={viewMode === 'all-branches' ? 8 : 7}
                          className="py-20 text-center text-neutral-400 font-medium text-[14px]"
                        >
                          Gösterilecek kayıt bulunamadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div> // Content Wrapper End
          )}
        </div> // ActiveSubTab End
      )}

      {/* --- GLOBAL CONFIRMATION MODAL --- */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-base-primary-900/20 backdrop-blur-sm" onClick={() => setModalConfig({ isOpen: false, type: null, groupId: null })} />
          <div className="bg-white rounded-lg p-8 max-w-[400px] w-full shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className={`w-14 h-14 rounded-lg flex items-center justify-center mb-6 ${modalConfig.type === 'delete' ? 'bg-red-50 text-red-500' : (modalConfig.type === 'restore' ? 'bg-blue-50 text-base-primary-500' : 'bg-orange-50 text-orange-500')}`}>
              {modalConfig.type === 'delete' ? <Trash2 size={28} /> : (modalConfig.type === 'restore' ? <RotateCcw size={28} /> : <Archive size={28} />)}
            </div>
            <h3 className="text-[20px] font-bold text-base-primary-900 mb-2">{modalConfig.type === 'restore' ? 'Geri Al' : 'Emin misiniz?'}</h3>
            <p className="text-[15px] text-neutral-500 leading-relaxed mb-8">{modalConfig.type === 'delete' ? "Bu işlem kalıcı olarak silinecek. Bu işlem geri alınamaz." : (modalConfig.type === 'restore' ? "Bu kayıt aktif listeye taşınacak." : "Bu kayıt arşive taşınacak.")}</p>
            <div className="flex gap-3">
              <button onClick={() => setModalConfig({ isOpen: false, type: null, groupId: null })} className="flex-1 h-12 bg-neutral-100 text-neutral-600 rounded-lg font-bold text-[14px] hover:bg-neutral-200 transition-colors">Vazgeç</button>
              <button onClick={confirmModalAction} className={`flex-1 h-12 text-white rounded-lg font-bold text-[14px] transition-all active:scale-95 cursor-pointer ${modalConfig.type === 'delete' ? 'bg-red-500' : (modalConfig.type === 'restore' ? 'bg-base-primary-500' : 'bg-[#FF8D28]')}`}>{modalConfig.type === 'delete' ? "Sil" : (modalConfig.type === 'restore' ? "Geri Al" : "Arşive Taşı")}</button>
            </div>
          </div>
        </div>
      )}
      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Arka Plan Karartma */}
          <div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, studentId: "" })}
          />

          {/* Modal Kutusu */}
          <div className="bg-white rounded-2xl p-8 max-w-[400px] w-full shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">

            {/* İkon - Senin Danger Kırmızın */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto"
              style={{ backgroundColor: 'var(--color-status-danger-50)', color: 'var(--color-status-danger-500)' }}
            >
              <Trash2 size={32} />
            </div>

            <h3 className="text-[20px] font-bold text-neutral-800 mb-2">Emin misiniz?</h3>
            <p className="text-[14px] text-neutral-500 mb-8 leading-relaxed">
              Bu öğrenci kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>

            {/* Butonlar */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, studentId: "" })}
                className="flex-1 h-12 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all"
              >
                Vazgeç
              </button>

              <button
                onClick={async () => {
                  // Eğer studentId "bulk" ise toplu silme motorunu, değilse tekli silme fonksiyonunu çalıştırır
                  if (deleteModal.studentId === "bulk") {
                    await handleBulkDeleteStudents();
                  } else {
                    await handleDeleteStudent(deleteModal.studentId);
                  }
                  // İşlem bitince modalı her halükarda kapatır
                  setDeleteModal({ isOpen: false, studentId: "" });
                }}
                className="flex-1 h-12 text-white font-bold rounded-xl transition-all hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: 'var(--color-status-danger-500)' }}
              >
                SİL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 