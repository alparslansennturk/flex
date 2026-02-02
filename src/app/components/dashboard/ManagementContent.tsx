"use client";
import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Info, Code2, ChevronDown, ChevronRight, X, AlertCircle, 
  MoreVertical, RotateCcw, Trash2, Edit2, Archive, Clock, 
  User, MapPin, CheckCircle2, Users, PlusCircle, Search, 
  Mail, FileText, PencilLine 
} from "lucide-react";

const INITIAL_GROUPS = [
  { id: 1, code: "Grup 001", branch: "Kadıköy", instructor: "Alparslan Hoca", session: "Pts - Çar | 19.00 - 21.30", students: 12, status: "active" },
  { id: 2, code: "Grup 002", branch: "Beşiktaş", instructor: "Ali Bey", session: "Sal - Per | 19.00 - 21.30", students: 16, status: "active" },
  { id: 3, code: "Grup 003", branch: "Kadıköy", instructor: "Ayşe Hanım", session: "Cts - Paz | 09.00 - 12.00", students: 14, status: "active" },
  { id: 4, code: "Grup 004", branch: "Online", instructor: "Mehmet Hoca", session: "Cts - Paz | 12.00 - 15.00", students: 10, status: "active" },
];

export default function ManagementContent({ setHeaderTitle }: { setHeaderTitle: (t: string) => void }) {
  const isAdmin = true; 

  const [activeSubTab, setActiveSubTab] = useState("groups");
  const [currentView, setCurrentView] = useState("Aktif Sınıflar");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(1);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(1);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupCode, setGroupCode] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("Grup seansı seçiniz...");
  const [customSchedule, setCustomSchedule] = useState("");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; schedule?: string }>({});
  const [isShaking, setIsShaking] = useState(false);

/* --- STUDENT MANAGEMENT STATES --- */
  const [studentTab, setStudentTab] = useState("group-list");
  const [searchQuery, setSearchQuery] = useState("");
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);

  
  // Individual states for form handling
  const [studentName, setStudentName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);

  // Student list data
  const [students, setStudents] = useState([
    { id: 1, name: "Floyd Miles", email: "tanya.hill@example.com", note: "Proje ödevlerinde çok başarılı." },
    { id: 2, name: "Olivia Garcia", email: "olivia.garcia@example.com", note: "Very creative in projects" },
  ]);

  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [modalConfig, setModalConfig] = useState<{ 
    isOpen: boolean; 
    type: 'archive' | 'delete' | 'restore' | null; 
    groupId: number | null 
  }>({
    isOpen: false,
    type: null,
    groupId: null
  });

  const scheduleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const schedules = [
    "Pts - Çar | 19.00 - 21.30", "Sal - Per | 19.00 - 21.30", "Cts - Paz | 09.00 - 12.00",
    "Cts - Paz | 12.00 - 15.00", "Cts - Paz | 15.00 - 18.00", "Özel Grup Tanımla",
  ];

  const showNotification = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const requestModal = (id: number, type: 'archive' | 'delete' | 'restore') => {
    setModalConfig({ isOpen: true, type, groupId: id });
    setOpenMenuId(null);
  };

  const handleOpenForm = () => {
    if (currentView !== "Aktif Sınıflar") return;
    if (!isFormOpen) {
      setLastSelectedId(selectedGroupId);
      setSelectedGroupId(null);
      setIsFormOpen(true);
    } else {
      handleCancel();
    }
  };

  const handleCancel = () => {
    setSelectedGroupId(lastSelectedId);
    setIsFormOpen(false);
    setEditingGroupId(null);
    setErrors({});
    setGroupCode("");
    setCustomSchedule("");
    setSelectedSchedule("Grup seansı seçiniz...");
  };

  const handleEdit = (group: any) => {
    setEditingGroupId(group.id);
    setGroupCode(group.code);
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

  const handleSave = () => {
    const newErrors: { code?: string; schedule?: string } = {};
    if (!groupCode.trim()) newErrors.code = "Lütfen bir grup kodu giriniz.";
    if (selectedSchedule === "Grup seansı seçiniz...") newErrors.schedule = "Lütfen bir seans seçiniz.";

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
    
    if (editingGroupId) {
      setGroups(groups.map(g => g.id === editingGroupId ? { ...g, code: formattedCode, session: finalSession } : g));
      setSelectedGroupId(editingGroupId);
      showNotification("Grup başarıyla güncellendi.");
    } else {
      const newGroupId = Date.now();
      const newGroup = { id: newGroupId, code: formattedCode, branch: "Kadıköy", instructor: "Alparslan Hoca", session: finalSession, students: 0, status: "active" };
      setGroups([newGroup, ...groups]);
      setSelectedGroupId(newGroupId);
      showNotification("Yeni grup başarıyla oluşturuldu.");
    }
    setIsFormOpen(false);
    setEditingGroupId(null);
    setGroupCode("");
    setCustomSchedule("");
    setSelectedSchedule("Grup seansı seçiniz...");
    setErrors({});
  };

  const confirmModalAction = () => {
    if (!modalConfig.groupId) return;

    // SİLME İŞLEMİ (Hem gruplar hem öğrenciler için ortak)
    if (modalConfig.type === 'delete') {
      // 1. Öğrenci listesinden uçur
      setStudents(prev => prev.filter(s => s.id !== modalConfig.groupId));
      
      // 2. Grup listesinden uçur (Eğer silinen bir grupsa)
      setGroups(prev => prev.filter(g => g.id !== modalConfig.groupId));
      
      showNotification("Kayıt kalıcı olarak silindi.");
    } 
    
    // ARŞİVLEME İŞLEMİ
    else if (modalConfig.type === 'archive') {
      setGroups(groups.map(g => g.id === modalConfig.groupId ? { ...g, status: 'archived' } : g));
      showNotification("Kayıt arşive taşındı.");
    } 
    
    // GERİ YÜKLEME İŞLEMİ
    else if (modalConfig.type === 'restore') {
      setGroups(groups.map(g => g.id === modalConfig.groupId ? { ...g, status: 'active' } : g));
      showNotification("Kayıt aktif listeye taşındı.");
    }

    // Modalı kapat ve temizle
    setModalConfig({ isOpen: false, type: null, groupId: null });
  };

  /**
   * SECTION: Student List Handlers
   * Logic for adding and removing students from the state
   */
  const handleAddStudent = () => {
    // Basic validation: Fields should not be empty
    if (!studentName.trim() || !studentLastName.trim() || !studentEmail.trim()) return;

    const newStudent = {
      id: Date.now(),
      name: `${studentName.trim()} ${studentLastName.trim()}`,
      email: studentEmail.trim(),
      note: studentNote.trim()
    };

    setStudents(prev => [newStudent, ...prev]);

    // Reset all form-related states
    setStudentName("");
    setStudentLastName("");
    setStudentEmail("");
    setStudentNote("");
    setIsStudentFormOpen(false);
    
    showNotification("Öğrenci başarıyla eklendi.");
  };

  const handleDeleteStudent = (id: number) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    showNotification("Öğrenci silindi.");
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (scheduleRef.current && !scheduleRef.current.contains(event.target as Node)) setIsScheduleOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const labels: Record<string, string> = { profile: "Profil Ayarları", users: "Kullanıcılar", groups: "Eğitim Yönetimi", "header-footer": "Header & Footer", sidebar: "Sidebar" };
    setHeaderTitle(labels[activeSubTab] || "Eğitim Yönetimi");
  }, [activeSubTab, setHeaderTitle]);

  const filteredGroups = groups.filter(group => {
    if (currentView === "Aktif Sınıflar") return group.status === "active";
    if (currentView === "Arşiv") return group.status === "archived";
    if (currentView === "Tüm Sınıflar" && isAdmin) return group.status === "active";
    return group.status === "active";
  });

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
          <div className="border-b border-surface-200 flex items-center justify-between h-20 pl-[56px]">
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
          <div className="flex items-center justify-between pb-4 border-b border-neutral-300 pl-[56px]">
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
            <div className="min-h-0 overflow-visible pl-[56px]">
              <div className={`bg-white border border-surface-200 rounded-[16px] p-[36px] shadow-sm relative z-20 mb-8 ${isShaking ? 'animate-shake-fast' : ''}`}>
                <div className="grid grid-cols-2 gap-[40px]">
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">Grup kodu</label>
                    <div className="relative">
                      <input type="text" value={groupCode} onChange={(e) => {setGroupCode(e.target.value); setErrors({...errors, code: undefined});}} placeholder="Örn: 121" className={`w-full h-12 bg-neutral-50 border rounded-lg px-4 text-sm focus:outline-none transition-all ${errors.code ? 'border-status-danger-500' : 'border-surface-300 focus:border-base-primary-500'}`} />
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
                        {schedules.map((s) => (<button key={s} onClick={() => { setSelectedSchedule(s); setIsScheduleOpen(false); setErrors({...errors, schedule: undefined}); }} className="w-full text-left px-4 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-surface-50 border-b border-surface-50 last:border-0 transition-colors cursor-pointer">{s}</button>))}
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
            <div className="flex items-center bg-surface-50 w-fit p-1 rounded-[14px] mb-8 ml-[56px]">
              {["Aktif Sınıflar", isAdmin && "Tüm Sınıflar", "Arşiv"].filter(Boolean).map((t) => (
                <button key={t as string} onClick={() => setCurrentView(t as string)} className={`px-6 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${currentView === t ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>{t as string}</button>
              ))}
            </div>

            {currentView === "Aktif Sınıflar" ? (
              <div className="pl-[56px] flex flex-wrap gap-6 animate-in fade-in duration-500">
                {filteredGroups.map((group) => {
                  const isActive = selectedGroupId === group.id;
                  return (
                    <div key={group.id} onClick={() => setSelectedGroupId(group.id)} className={`relative w-[256px] h-[116px] rounded-[16px] p-6 transition-all cursor-pointer group ${isActive ? "bg-base-primary-700 text-white shadow-xl scale-[1.02]" : "bg-white border border-neutral-300 text-text-primary hover:bg-base-primary-700 hover:text-white hover:border-transparent"}`}>
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === group.id ? null : group.id); }} className={`absolute top-4 right-4 p-1 rounded-lg transition-colors cursor-pointer ${isActive ? "text-white/60 hover:bg-white/10" : "text-neutral-400 group-hover:text-white/60"}`}><MoreVertical size={20} /></button>
                      {openMenuId === group.id && (
                        <div ref={menuRef} className="absolute top-12 right-4 w-44 bg-white rounded-lg shadow-2xl border border-surface-200 z-[60] overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200 cursor-default">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(group); }} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-surface-50 flex items-center gap-2 cursor-pointer transition-colors"><Edit2 size={16}/> Düzenle</button>
                          <button onClick={(e) => { e.stopPropagation(); requestModal(group.id, 'archive'); }} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-surface-50 flex items-center gap-2 cursor-pointer transition-colors"><Archive size={16}/> Arşive ekle</button>
                        </div>
                      )}
                      <div className="flex flex-col h-full justify-between pointer-events-none"><div><p className={`text-[14px] font-semibold leading-none mb-2 ${isActive ? "text-white/60" : "text-text-primary group-hover:text-white/60"}`}>{group.code}</p><p className={`text-[16px] font-bold leading-none ${isActive ? "text-white" : "text-base-primary-700 group-hover:text-white"}`}>{group.session}</p></div><p className={`text-[14px] font-semibold leading-none ${isActive ? "text-white/60" : "text-text-primary group-hover:text-white/60"}`}>Öğrenci Sayısı: {group.students}</p></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pl-[56px] w-full animate-in fade-in duration-500">
                <div className="bg-white border border-neutral-300 rounded-[16px] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-surface-50 border-b border-neutral-200">
                      <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Grup kodu</th>
                      <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Şube</th>
                      <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Eğitmen</th>
                      <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight text-center">Öğrenci</th>
                      <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight text-right pr-8">İşlem</th>
                    </tr></thead>
                    <tbody>{filteredGroups.map((group) => (
                      <tr key={group.id} className="border-b border-neutral-100 last:border-0 hover:bg-surface-50/50 transition-colors">
                        <td className="px-6 py-3 font-bold text-base-primary-700">{group.code}</td>
                        <td className="px-6 py-3 text-[14px] text-neutral-600 font-medium"><div className="flex items-center gap-2"><MapPin size={14} className="text-neutral-400" />{group.branch}</div></td>
                        <td className="px-6 py-3 text-[14px] text-neutral-600 font-medium"><div className="flex items-center gap-2"><User size={14} className="text-neutral-400" />{group.instructor}</div></td>
                        <td className="px-6 py-3 text-center font-bold text-neutral-700">{group.students}</td>
                        <td className="px-6 py-3 text-right pr-8">
                          {currentView === "Arşiv" ? (
                            <div className="flex justify-end gap-2"><button onClick={() => requestModal(group.id, 'restore')} className="p-1.5 text-base-primary-500 hover:bg-base-primary-50 rounded-lg cursor-pointer transition-all"><RotateCcw size={16}/></button><button onClick={() => requestModal(group.id, 'delete')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all"><Trash2 size={16}/></button></div>
                          ) : (
                            <button onClick={() => handleEdit(group)} className="p-1.5 text-neutral-400 hover:text-base-primary-600 cursor-pointer transition-colors"><Edit2 size={16} /></button>
                          )}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

       {/* --- BÖLÜM 5: ÖĞRENCİ LİSTESİ ÜST BAR (Milimetrik Spacing & rounded-lg) --- */}
          {currentView === "Aktif Sınıflar" && (
            <div className="mt-[64px] pl-[56px] animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center pb-4 border-b border-neutral-200 mb-4">
                {/* Başlık ve Sayı */}
                <div className="flex items-center gap-2 min-w-fit">
                  <Users size={18} className="text-base-primary-900" />
                  <h2 className="text-[18px] font-semibold text-base-primary-900 leading-none">Öğrenciler</h2>
                  <span className="text-[13px] font-medium text-text-tertiary ml-2">(34 Öğrenci)</span>
                </div>

                {/* 56px Boşluk ve Menu (rounded-lg) */}
                <div className="flex items-center ml-14 bg-surface-50 p-1 rounded-lg">
                  <button onClick={() => setStudentTab("group-list")} className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${studentTab === "group-list" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>Grup Listesi</button>
                  <button onClick={() => setStudentTab("all-students")} className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${studentTab === "all-students" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>Tüm Öğrenciler</button>
                </div>

                {/* 32px Boşluk ve Öğrenci Ekle */}
                <button 
                  onClick={() => setIsStudentFormOpen(!isStudentFormOpen)}
                  className="flex items-center gap-2 ml-8 text-base-primary-500 hover:text-base-primary-600 transition-colors cursor-pointer group outline-none"
                >
                  {isStudentFormOpen ? <X size={20} /> : <PlusCircle size={20} className="transition-transform group-hover:scale-110" />}
                  <span className="text-[14px] font-semibold">{isStudentFormOpen ? "Vazgeç" : "Öğrenci Ekle"}</span>
                </button>

                {/* En Sağda Uzun Search (rounded-lg) */}
                <div className="relative ml-auto w-[420px]">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="İsim ile Ara" className="w-full h-[40px] bg-white border border-neutral-200 rounded-lg px-4 pr-10 text-[13px] font-medium placeholder:text-text-tertiary focus:outline-none focus:border-base-primary-500 transition-all shadow-sm" />
                  <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                </div>
              </div>

    {/* --- SECTION 6: STUDENT ENROLLMENT FORM (4 Inputs Top / Buttons Bottom) --- */}
          <div className={`grid transition-all duration-500 ease-in-out ${isStudentFormOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
            <div className="min-h-0 overflow-hidden">
              <div className="bg-white border border-neutral-200 rounded-lg p-[36px] shadow-sm mb-8">
                
                {/* Header Row: 4-Column Grid for Student Information */}
                <div className="grid grid-cols-4 gap-[16px]">
                  
                  {/* First Name Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">Ad</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Örn: Ela" 
                        className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 pr-10 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 placeholder:text-neutral-400" 
                      />
                      <User size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    </div>
                  </div>

                  {/* Last Name Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">Soyad</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={studentLastName}
                        onChange={(e) => setStudentLastName(e.target.value)}
                        placeholder="Örn: Yılmaz" 
                        className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 pr-10 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 placeholder:text-neutral-400" 
                      />
                      <User size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">E-Posta</label>
                    <div className="relative">
                      <input 
                        type="email" 
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="ornek@mail.com" 
                        className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 pr-10 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 placeholder:text-neutral-400" 
                      />
                      <Mail size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    </div>
                  </div>

                  {/* Instructor Note Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-base-primary-900 leading-none">Eğitmen Notu</label>
                    <div className="relative">
                      <textarea 
                        rows={1} 
                        value={studentNote}
                        onChange={(e) => setStudentNote(e.target.value)}
                        placeholder="Not ekle..." 
                        className="w-full h-10 min-h-[40px] max-h-[100px] bg-neutral-50 border border-neutral-200 rounded-lg px-4 pr-10 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 placeholder:text-neutral-400 resize-none py-[9px] leading-[20px] scrollbar-hide block" 
                      />
                      <FileText size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Footer Row: Action Buttons Pinned Right */}
                <div className="mt-8 flex justify-end gap-[16px]">
                  <button 
                    onClick={handleAddStudent}
                    className="h-10 px-6 bg-[var(--color-designstudio-secondary-500)] text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10 active:scale-95 transition-all whitespace-nowrap outline-none"
                  >
                    Kaydet <ChevronRight size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setIsStudentFormOpen(false);
                      setEditingStudentId(null);
                      setStudentName(""); setStudentLastName(""); setStudentEmail(""); setStudentNote("");
                    }} 
                    className="h-10 px-6 bg-neutral-500 text-white rounded-lg font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-neutral-600 transition-colors whitespace-nowrap outline-none"
                  >
                    Vazgeç
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* --- SECTION 7: STUDENT LIST TABLE --- */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-12 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/30 h-10">
                  <th className="px-8 text-[14px] font-bold text-base-primary-900">Öğrenci İsmi</th>
                  <th className="px-8 text-[14px] font-bold text-base-primary-900">E-Posta Adresi</th>
                  <th className="px-8 text-[14px] font-bold text-base-primary-900">Eğitmen Notları</th>
                  <th className="px-8 text-[14px] font-bold text-base-primary-900 text-right">Aksiyonlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-neutral-50/50 transition-colors h-10">
                    <td className="px-8 text-[14px] font-semibold text-base-primary-900 leading-none">{student.name}</td>
                    <td className="px-8 text-[14px] font-medium text-neutral-400 leading-none">{student.email}</td>
                    <td className="px-8 text-[14px] font-medium text-neutral-400 max-w-[400px] truncate leading-none">{student.note}</td>
                    <td className="px-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Action: PencilLine Icon 18x18 */}
                        <button 
                          onClick={() => {
                            const [fName, ...lName] = student.name.split(" ");
                            setStudentName(fName);
                            setStudentLastName(lName.join(" "));
                            setStudentEmail(student.email);
                            setStudentNote(student.note);
                            setEditingStudentId(student.id);
                            setIsStudentFormOpen(true);
                          }}
                          className="p-1.5 text-[var(--color-designstudio-secondary-500)] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <PencilLine size={18} />
                        </button>
                        {/* Delete Action: Triggers Modal */}
                        <button 
                          onClick={() => setModalConfig({ isOpen: true, type: 'delete', groupId: student.id })}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
</div> // Component End
);
}