import { useState, useEffect, useRef } from "react";
import { db, auth } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { MASTER_ID } from "@/app/lib/constants";
import { getFlexMessage } from "@/app/lib/messages";
import { calcScore, computeStudentStats } from "@/app/lib/scoring";
import { logActivity } from "@/app/lib/activityLog";
import {
  batchAddGroupHistory, batchUpsertSnapshot,
  toDateKey, toMonthKey,
  type GroupHistoryEntry, type StudentSnapshot,
} from "@/app/lib/studentHistory";
import {
  collection, onSnapshot, addDoc, doc, getDoc,
  updateDoc, deleteDoc, increment, serverTimestamp, writeBatch,
  getDocs, query, where, deleteField, orderBy,
} from "firebase/firestore";

// --- INTERFACES ---

interface GradedTaskEntry {
  xp:           number;
  penalty:      number;
  classId?:     string;
  endDate?:     string;
  completedAt?: string;
}

interface Instructor {
  id:           string;
  displayName:  string;
  name?:        string;
  surname?:     string;
  email?:       string;
  uid?:         string;
  branches?:    string[];
  branch?:      string;
  role?:        string;
  roles?:       string[];
  isInstructor?: boolean;
}

interface UserDoc {
  id:           string;
  email?:       string;
  name?:        string;
  surname?:     string;
  role?:        string;
  roles?:       string[];
  isInstructor?: boolean;
  isActivated?:  boolean;
}

interface BranchModule {
  id:           string;
  name:         string;
  totalHours:   number;
  sessionHours?: number;
  isActive?:    boolean;
  order?:       number;
}

interface Group {
  id: string;
  code: string;
  branch: string;
  instructor: string;
  instructorId?: string;
  session: string;
  students: number;
  status: string;
  createdAt?: { seconds: number; nanoseconds?: number };
  module?: "GRAFIK_1" | "GRAFIK_2";
  discipline?: string;
  startDate?: string;
  type?: "standart" | "özel_ders" | "kurumsal";
  moduleId?: string;
  customHours?: number;
  companyName?: string;
  sessionHours?: number;
}

interface Student {
  id: string;
  name: string;
  lastName: string;
  email: string;
  gender?: string;
  note: string;
  groupId: string;
  branch: string;
  groupCode: string;
  points: number;
  status?: 'active' | 'passive';
  accountStatus?: 'pending' | 'active' | 'disabled';
  authUid?: string;
  lastGroupCode?: string;
  lastGroupId?: string;
  hiddenFromInstructors?: string[];
  updatedAt?: unknown;
  isCarryOverApplied?: boolean;
  gradedTasks?: Record<string, GradedTaskEntry>;
}

interface AddStudentData {
  name?: string;
  lastName?: string;
  email?: string;
  note?: string;
  groupId?: string;
  branch?: string;
  gender?: string;
  isOnlineStudent?: boolean;
  avatarId?: number | null;
}

const FALLBACK_SCHEDULES = [
  "Pts - Çar | 19.00 - 21.30", "Sal - Per | 19.00 - 21.30", "Cts - Paz | 09.00 - 12.00",
  "Cts - Paz | 12.00 - 15.00", "Cts - Paz | 15.00 - 18.00", "Özel Grup Tanımla",
];

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

  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [groupBranch, setGroupBranch] = useState("Kadıköy");
  const [groupDiscipline, setGroupDiscipline] = useState("");
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
  const [studentUsersMap, setStudentUsersMap] = useState<Map<string, boolean>>(new Map());

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState("");
  const [groupModule, setGroupModule] = useState<"GRAFIK_1" | "GRAFIK_2" | "">("");
  const [groupType, setGroupType] = useState<"standart" | "özel_ders" | "kurumsal">("standart");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [customHours, setCustomHours] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [branchModules, setBranchModules] = useState<BranchModule[]>([]);
  const [firestoreSessions, setFirestoreSessions] = useState<string[]>([]);
  const [moduleBlockModal, setModuleBlockModal] = useState<{ isOpen: boolean; currentModule: string } | null>(null);
  const [lessonHours, setLessonHours]   = useState("");
  const [groupStartDate, setGroupStartDate] = useState("");
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

  const schedules = firestoreSessions.length > 0 ? firestoreSessions : FALLBACK_SCHEDULES;

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
        if (!myGroupIds.includes(s.lastGroupId ?? s.groupId)) return false;
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
    const unsubSessions = onSnapshot(
      query(collection(db, "sessions"), where("isActive", "==", true), orderBy("order", "asc")),
      snap => setFirestoreSessions(snap.docs.map(d => (d.data() as { label: string }).label)),
      () => {}
    );
    return () => { unsubGroups(); unsubStudents(); unsubSessions(); };
  }, []);

  useEffect(() => {
    if (!groupDiscipline) { setBranchModules([]); return; }
    const unsub = onSnapshot(
      query(collection(db, "branches", groupDiscipline, "modules"), orderBy("order", "asc")),
      snap => {
        const mods = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as BranchModule))
          .filter(m => m.isActive !== false);
        setBranchModules(mods);
        setCustomHours(prev => prev === "" && mods.length > 0 ? mods[0].totalHours.toString() : prev);
      },
      (err) => console.error("[branchModules]", err)
    );
    return () => unsub();
  }, [groupDiscipline]);

  useEffect(() => {
    // Eğitmen users koleksiyonunu okuyamaz (Firestore kuralı: sadece admin veya kendi dokümanı)
    if (!isAdmin) {
      if (user) {
        setInstructors([{
          ...user,
          id: user.uid,
          displayName: user.name ? `${user.name} ${user.surname || ""}` : (user.email || user.uid)
        }]);
      }
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserDoc));

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
          displayName: u.name ? `${u.name} ${u.surname || ""}` : (u.email || u.id)
        }));

      setInstructors(insList);

      // authUid → isActivated map (öğrenci hesap durumu için)
      const map = new Map<string, boolean>();
      allDocs.filter(u => u.role === "student" || u.roles?.includes("student")).forEach(u => {
        map.set(u.id, u.isActivated === true);
      });
      setStudentUsersMap(map);
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
    setGroupDiscipline("");
    setSelectedInstructorId("");
    setSelectedSchedule("Grup seansı seçiniz...");
    setCustomSchedule("");
    setLessonHours("");
    setGroupStartDate("");
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
            const data = d.data() as { module?: string; isFinalized?: boolean };
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
          discipline: groupDiscipline || null,
          instructorId: selectedInstructorId,
          instructor: instructorName,
          module: groupModule || null,
          type: groupType,
          moduleId: null,
          customHours: customHours ? parseInt(customHours, 10) : null,
          companyName: groupType === "kurumsal" && companyName ? companyName : null,
          startDate: groupStartDate || null,
          sessionHours: lessonHours ? parseInt(lessonHours, 10) : null,
          totalHours: customHours ? parseInt(customHours, 10) : null,
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
              const sData = d.data() as { isCarryOverApplied?: boolean; gradedTasks?: Record<string, GradedTaskEntry> };
              const updates: Record<string, unknown> = {};

              if (isCodeChange) updates.groupCode = formattedCode;

              // G1→G2 geçişi: carry-over henüz uygulanmamışsa hesapla
              if (isModuleUpgrade && !sData.isCarryOverApplied) {
                const allGradedTasks = sData.gradedTasks ?? {};
                const classGradedTasks = Object.fromEntries(
                  Object.entries(allGradedTasks).filter(([, e]) =>
                    e?.classId === (oldCode || editingGroup?.code)
                  )
                ) as Record<string, GradedTaskEntry>;
                const { totalXP: xp, completedTasks: tasks } = computeStudentStats(classGradedTasks);
                updates.g2StartXP          = Math.round(calcScore(xp, tasks) * 0.10);
                updates.isCarryOverApplied = true;
                updates.grafik1Code        = oldCode || editingGroup?.code || "";
              }

              if (Object.keys(updates).length > 0) batch.update(d.ref, updates);

              // ── Geçmiş: modül yükseltme kaydı ──────────────────────────
              if (isModuleUpgrade) {
                const upgradeHist: GroupHistoryEntry = {
                  groupId:      editingGroupId ?? "",
                  groupCode:    oldCode ?? editingGroup?.code ?? "",
                  module:       "GRAFIK_1",
                  branch:       editingGroup?.discipline ?? "",
                  instructorId: editingGroup?.instructorId ?? null,
                  startDate:    editingGroup?.startDate ?? null,
                  endDate:      toDateKey(),
                  reason:       "module_upgrade",
                  paymentStatus: "unknown",
                };
                const upgradeSnap: StudentSnapshot = {
                  studentId:    d.id,
                  month:        toMonthKey(),
                  groupId:      editingGroupId ?? "",
                  groupCode:    formattedCode,
                  module:       "GRAFIK_2",
                  branch:       editingGroup?.discipline ?? "",
                  isActive:     true,
                  paymentStatus: "unknown",
                  reason:       "module_upgrade",
                };
                batchAddGroupHistory(batch, d.id, upgradeHist);
                batchUpsertSnapshot(batch, upgradeSnap);
              }
            });
            await batch.commit();
          }
        }

        showNotification("Grup başarıyla güncellendi.");
      } else {
        const docRef = await addDoc(collection(db, "groups"), {
          code: formattedCode,
          branch: groupBranch,
          discipline: groupDiscipline || null,
          instructor: instructorName,
          instructorId: selectedInstructorId,
          session: finalSession,
          students: 0,
          status: "active",
          module: groupModule || null,
          type: groupType,
          moduleId: null,
          customHours: customHours ? parseInt(customHours, 10) : null,
          companyName: groupType === "kurumsal" && companyName ? companyName : null,
          startDate: groupStartDate || null,
          sessionHours: lessonHours ? parseInt(lessonHours, 10) : null,
          totalHours: customHours ? parseInt(customHours, 10) : null,
          createdAt: serverTimestamp()
        });
        pendingSelectIdRef.current = docRef.id;
        await logActivity("grup_olusturuldu", "Yeni Grup Eklendi", `Grup ${formattedCode} sisteme eklendi`);
        showNotification("Yeni grup başarıyla oluşturuldu.");
      }
      setIsFormOpen(false);
      setEditingGroupId(null);
      setGroupCode("");
      setGroupModule("");
      setGroupType("standart");
      setSelectedModuleId("");
      setCustomHours("");
      setCompanyName("");
      setSelectedInstructorId("");
      setSelectedSchedule("Grup seansı seçiniz...");
      setCustomSchedule("");
      setLessonHours("");
      setGroupStartDate("");
      setErrors({});
    } catch (error) {
      showNotification("Grup kaydedilirken bir hata oluştu.");
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroupId(group.id);
    setGroupCode(group.code.replace("Grup ", ""));
    setGroupBranch(group.branch);
    setGroupDiscipline(group.discipline || "");
    setGroupModule(group.module ?? "");
    setGroupType(group.type ?? "standart");
    setSelectedModuleId(group.moduleId ?? "");
    setCustomHours(group.customHours?.toString() ?? "");
    setCompanyName(group.companyName ?? "");
    setSelectedInstructorId(group.instructorId || "");
    setLessonHours(group.sessionHours?.toString() ?? "");
    setGroupStartDate(group.startDate ?? "");
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
          const allGradedTasks = student.gradedTasks ?? {};
          const classGradedTasks = Object.fromEntries(
            Object.entries(allGradedTasks).filter(([, e]) =>
              groupCode ? e?.classId === groupCode : true
            )
          ) as Record<string, GradedTaskEntry>;
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
          // ── Geçmiş: mezuniyet kaydı ───────────────────────────────────
          const archiveGroup = groups.find(g => g.id === modalConfig.groupId);
          const histEntry: GroupHistoryEntry = {
            groupId:      modalConfig.groupId ?? "",
            groupCode,
            module:       archiveGroup?.module ?? "",
            branch:       archiveGroup?.discipline ?? "",
            instructorId: archiveGroup?.instructorId ?? null,
            startDate:    archiveGroup?.startDate ?? null,
            endDate:      toDateKey(),
            reason:       "graduation",
            paymentStatus: "unknown",
          };
          const snapEntry: StudentSnapshot = {
            studentId:    student.id,
            month:        toMonthKey(),
            groupId:      modalConfig.groupId ?? "",
            groupCode,
            module:       archiveGroup?.module ?? "",
            branch:       archiveGroup?.discipline ?? "",
            isActive:     false,
            paymentStatus: "unknown",
            reason:       "graduation",
          };
          batchAddGroupHistory(batch, student.id, histEntry);
          batchUpsertSnapshot(batch, snapEntry);
        });
        batch.update(groupRef, { status: 'archived' });
        await batch.commit();
        if (selectedGroupId === modalConfig.groupId) setSelectedGroupId(null);
        showNotification("Grup bitirildi, öğrenciler mezun listesine alındı.");
        // Drive: Gruplar → Arşiv (fire-and-forget)
        auth.currentUser?.getIdToken().then(token =>
          fetch("/api/groups/drive-folder", {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ groupName: groupCode, action: "archive" }),
          }).catch(() => {})
        ).catch(() => {});
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
        // Drive: Arşiv → Gruplar (fire-and-forget)
        auth.currentUser?.getIdToken().then(token =>
          fetch("/api/groups/drive-folder", {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ groupName: targetGroup?.code ?? "", action: "restore" }),
          }).catch(() => {})
        ).catch(() => {});
      }
    } catch (error) { showNotification("Hata oluştu."); }
    setIsProcessing(false);
    setModalConfig({ isOpen: false, type: null, groupId: null });
  };

const handleAddStudent=async(passedData?:AddStudentData)=>{
const name=passedData?.name||studentName;
const lastName=passedData?.lastName||studentLastName;
const email=passedData?.email||studentEmail;
const note=passedData?.note||studentNote;
const groupId=passedData?.groupId||selectedGroupIdForStudent;
const branch=passedData?.branch||studentBranch;
const gender=passedData?.gender||studentGender||"";
const isOnlineStudent=passedData?.isOnlineStudent ?? false;
const avatarIdValue = passedData?.avatarId !== undefined ? passedData.avatarId : (avatarId || null);
if(!name?.trim()||!lastName?.trim()||!groupId){
return;
}
const targetGroup=groups.find((g)=>g.id===groupId);
const studentData: Record<string, unknown> = {
name:name.trim(),
lastName:lastName.trim(),
email:email.trim(),
note:note.trim(),
groupId:groupId,
groupCode:targetGroup?.code||"Tanımsız",
discipline:targetGroup?.discipline||null,
branch:branch,
gender:gender,
isOnlineStudent:isOnlineStudent,
avatarId: avatarIdValue,
status:'active',
updatedAt:new Date(),
};
try{
// Email benzersizlik kontrolü — tüm gruplarda Firestore'a sorgula
if(email?.trim()){
  const normalizedEmail=email.trim().toLowerCase();
  const emailSnap=await getDocs(query(collection(db,"students"),where("email","==",normalizedEmail)));
  const conflict=emailSnap.docs.find(d=>d.id!==editingStudentId);
  if(conflict){
    const cd=conflict.data();
    const conflictGroupId=cd.groupId as string|undefined;
    let groupStillExists=true;
    if(conflictGroupId){
      const groupSnap=await getDoc(doc(db,"groups",conflictGroupId));
      groupStillExists=groupSnap.exists();
    }
    if(groupStillExists){
      throw Object.assign(new Error(`Bu e-posta "${cd.name} ${cd.lastName}" adlı öğrenciye tanımlı (${cd.groupCode||"farklı grup"}).`),{code:"DUPLICATE_EMAIL"});
    }
  }
}
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
const isCarryOverApplied = oldStudent.isCarryOverApplied === true;
if (!isCarryOverApplied && oldGroup?.module === "GRAFIK_1" && targetGroup?.module === "GRAFIK_2") {
  const allGradedTasks = oldStudent.gradedTasks ?? {};
  const classGradedTasks = Object.fromEntries(
    Object.entries(allGradedTasks).filter(([, e]) => e?.classId === oldGroup.code)
  ) as Record<string, GradedTaskEntry>;
  const { totalXP: xp, completedTasks: tasks } = computeStudentStats(classGradedTasks);
  studentData.g2StartXP = Math.round(calcScore(xp, tasks) * 0.10);
  studentData.isCarryOverApplied = true;
}
studentData.rankChange = 0;
studentData.isScoreHidden = false;
}
await updateDoc(doc(db,"students",editingStudentId),studentData);
// ── Geçmiş: transfer kaydı (group_history + snapshot atomik) ──────────
if (isGroupChange && oldStudent) {
  const oldGroup   = groups.find(g => g.id === oldStudent.groupId);
  const newGroup   = groups.find(g => g.id === groupId);
  const histBatch  = writeBatch(db);
  const transferEntry: GroupHistoryEntry = {
    groupId:      oldStudent.groupId,
    groupCode:    oldStudent.groupCode,
    module:       oldGroup?.module ?? "",
    branch:       oldGroup?.discipline ?? "",
    instructorId: oldGroup?.instructorId ?? null,
    startDate:    oldGroup?.startDate ?? null,
    endDate:      toDateKey(),
    reason:       "transfer",
    paymentStatus: "unknown",
  };
  const transferSnap: StudentSnapshot = {
    studentId:    editingStudentId,
    month:        toMonthKey(),
    groupId:      groupId as string,
    groupCode:    (studentData.groupCode ?? "") as string,
    module:       newGroup?.module ?? "",
    branch:       newGroup?.discipline ?? "",
    isActive:     true,
    paymentStatus: "unknown",
    reason:       "transfer",
  };
  batchAddGroupHistory(histBatch, editingStudentId, transferEntry);
  batchUpsertSnapshot(histBatch, transferSnap);
  await histBatch.commit();
}
setStudents((prev)=>prev.map((s)=>(s.id===editingStudentId?{...s,...studentData}:s)));
}else{
const newStudentRef = await addDoc(collection(db,"students"),{...studentData,points:0,createdAt:new Date(),});
await updateDoc(doc(db,"groups",groupId),{students:increment(1)});
// ── Geçmiş: ilk kayıt (enrollment) ───────────────────────────────────
{
  const enrollGroup  = groups.find(g => g.id === groupId);
  const enrollBatch  = writeBatch(db);
  const enrollHist: GroupHistoryEntry = {
    groupId:      groupId as string,
    groupCode:    (studentData.groupCode ?? "") as string,
    module:       enrollGroup?.module ?? "",
    branch:       enrollGroup?.discipline ?? "",
    instructorId: enrollGroup?.instructorId ?? null,
    startDate:    toDateKey(),
    endDate:      "9999-12-31",
    reason:       "enrollment",
    paymentStatus: "unknown",
  };
  const enrollSnap: StudentSnapshot = {
    studentId:    newStudentRef.id,
    month:        toMonthKey(),
    groupId:      groupId as string,
    groupCode:    (studentData.groupCode ?? "") as string,
    module:       enrollGroup?.module ?? "",
    branch:       enrollGroup?.discipline ?? "",
    isActive:     true,
    paymentStatus: "unknown",
    reason:       "enrollment",
  };
  batchAddGroupHistory(enrollBatch, newStudentRef.id, enrollHist);
  batchUpsertSnapshot(enrollBatch, enrollSnap);
  await enrollBatch.commit();
}
if(email?.trim()){
  try {
    const welcomeToken = await auth.currentUser?.getIdToken();
    const mailRes = await fetch("/api/welcome",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${welcomeToken??""}`},body:JSON.stringify({email:email.trim(),name:`${name.trim()} ${lastName.trim()}`,groupCode:studentData.groupCode??"",groupId,studentDocId:newStudentRef.id})});
    if(!mailRes.ok){
      const mailErr = await mailRes.json().catch(()=>({}));
      showNotification(`Öğrenci eklendi fakat mail gönderilemedi: ${mailErr.error ?? mailRes.status}`);
    }
  } catch(e){ console.error("[welcome mail]",e); }
}
}
}catch(error: unknown){
if((error as {code?: string})?.code !== "DUPLICATE_EMAIL") console.error("HATA:",error);
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

  const handleToggleAccountStatus = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student?.authUid) return;

    const currentStatus = student.accountStatus;
    const action = currentStatus === 'disabled' ? 'enable' : 'disable';

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/student/set-account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ studentDocId: studentId, action }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showNotification(action === 'disable' ? 'Hesap devre dışı bırakıldı.' : 'Hesap tekrar aktifleştirildi.');
    } catch (e: unknown) {
      showNotification((e instanceof Error ? e.message : null) ?? 'Hata oluştu.');
    }
  };

  const handleDeleteGraduatedStudent = async (studentId: string) => {
    if (isAdminRef.current) {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/admin/delete-student", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ studentDocId: studentId }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        showNotification("Öğrenci silindi.");
      } catch (e: unknown) {
        showNotification((e instanceof Error ? e.message : null) ?? "Hata oluştu.");
      }
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
    setStudentGender("");
    setAvatarId(null);
  };

  const handleEditStudent = (student: Student) => {
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
    groupDiscipline, setGroupDiscipline,
    groupModule, setGroupModule, moduleBlockModal, setModuleBlockModal,
    groupType, setGroupType, selectedModuleId, setSelectedModuleId,
    customHours, setCustomHours, companyName, setCompanyName, branchModules,
    instructors, selectedInstructorId, setSelectedInstructorId,
    lessonHours, setLessonHours,
    groupStartDate, setGroupStartDate,
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
    handleGraduateStudent, handleBulkGraduateStudents, handleRestoreStudent, handleDeleteGraduatedStudent, handleToggleAccountStatus, studentUsersMap,
    filteredGroups, filteredArchiveGroups, filteredStudents, pagedStudents, myGroupCards,
    totalPages, activePage, setActivePage, passivePage, setPassivePage,
    studentPanel, setStudentPanel,
    selectedStudentIds, setSelectedStudentIds,
    toggleStudentSelection, handleSelectAll, deleteModal, setDeleteModal, studentGender, setStudentGender,
    editingStudent: students.find(s => s.id === editingStudentId) || null,
    editingStudentId, setEditingStudentId, avatarId, setAvatarId, formRef
};
};