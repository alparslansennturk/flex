"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { 
  PlusCircle, Search, MoreVertical, Trash2, Edit3, 
  Users, AppWindow, Archive, RefreshCw, AlertCircle, ChevronDown
} from "lucide-react";

interface Group {
  id: string;
  code: string;
  time: string;
}

interface Student {
  id: number;
  groupId: string;
  name: string;
  email: string;
  note: string;
  isArchived: boolean;
}

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<'aktif' | 'arsiv'>('aktif');
  const [selectedGroupId, setSelectedGroupId] = useState<string>("191");
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'student' | 'group'; id: string | number | null }>({ isOpen: false, type: 'student', id: null });

  const menuRef = useRef<HTMLDivElement>(null);

  const [groups, setGroups] = useState<Group[]>([
    { id: "191", code: "191", time: "Pts – Çar | 19.00 – 21.30" },
    { id: "192", code: "192", time: "Sal – Per | 19.00 – 21.30" },
  ]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([
    { id: 1, groupId: "191", name: "Alparslan Şentürk", email: "alparslan@atolyen.com", note: "Design system mimarisi üzerine çalışıyor.", isArchived: false },
    { id: 2, groupId: "192", name: "Ela Şentürk", email: "ela@tasarimatolyesi.com", note: "İllüstrasyon ödevleri devam ediyor.", isArchived: false },
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setActiveMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const currentList = activeTab === 'aktif' ? groups : archivedGroups;
    if (currentList.length > 0) {
      const exists = currentList.find(g => g.id === selectedGroupId);
      if (!exists) setSelectedGroupId(currentList[0].id);
    } else {
      setSelectedGroupId("");
    }
  }, [activeTab, groups.length, archivedGroups.length]);

  const activeStudentCount = useMemo(() => students.filter(s => !s.isArchived).length, [students]);

  const handleSaveGroup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const gCode = (formData.get("gCode") as string) || "";
    const gTime = isCustomTime ? (formData.get("gTimeCustom") as string) : (formData.get("gTimeSelect") as string);

    if (editingGroup) {
      setGroups(groups.map(g => g.id === editingGroup.id ? { ...g, code: gCode, time: gTime } : g));
    } else {
      const newId = Math.random().toString(36).substring(7);
      setGroups(prev => [{ id: newId, code: gCode, time: gTime }, ...prev]);
      setSelectedGroupId(newId);
    }
    setIsGroupFormOpen(false); 
    setEditingGroup(null); 
    setIsCustomTime(false);
    e.currentTarget.reset();
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setIsGroupFormOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const sData = {
      name: formData.get("sName") as string,
      email: formData.get("sEmail") as string,
      note: formData.get("sNote") as string,
    };
    if (editingStudent) {
      setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...sData } : s));
    } else {
      setStudents([{ id: Date.now(), groupId: selectedGroupId, ...sData, isArchived: activeTab === 'arsiv' }, ...students]);
    }
    setIsStudentFormOpen(false); 
    setEditingStudent(null);
    e.currentTarget.reset();
  };

  const executeDelete = () => {
    if (deleteModal.type === 'student') {
      setStudents(students.filter(s => s.id !== deleteModal.id));
    } else {
      setArchivedGroups(archivedGroups.filter(g => g.id !== deleteModal.id));
      setGroups(groups.filter(g => g.id !== deleteModal.id));
    }
    setDeleteModal({ isOpen: false, type: 'student', id: null });
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchTab = activeTab === 'aktif' ? !s.isArchived : s.isArchived;
      const matchGroup = showAllStudents || s.groupId === selectedGroupId;
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchTab && matchGroup && matchSearch;
    });
  }, [searchTerm, students, selectedGroupId, showAllStudents, activeTab]);

  const currentTabGroups = activeTab === 'aktif' ? groups : archivedGroups;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-inter antialiased text-[#10294C] w-full">
      <aside className="hidden lg:block w-[280px] 2xl:w-[320px] bg-[#10294C] shrink-0 h-full overflow-y-auto">
        <Sidebar />
      </aside>
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto w-full px-[3%] py-10 scroll-smooth">
          <div className="max-w-[2400px] mx-auto">
            <div className="flex flex-col gap-8 mb-12">
              <div className="flex items-center">
                <AppWindow className="text-[#10294C] mr-3" size={24} strokeWidth={2.2} />
                <h1 className="text-[24px] font-bold tracking-tight">Gruplar ve Öğrenciler</h1>
                <span className="ml-8 text-[16px] font-medium text-[#64748B] opacity-70">(Toplam Öğrenci: {activeStudentCount})</span>
              </div>
              
              <button 
                onClick={() => { 
                  setIsGroupFormOpen(!isGroupFormOpen); 
                  setEditingGroup(null); 
                  setSelectedGroupId(""); 
                }}
                disabled={activeTab === 'arsiv'}
                className="w-fit flex items-center gap-2 bg-[#FF8D28] text-white px-8 py-3 rounded-2xl font-semibold text-[14px] transition-all active:scale-95 cursor-pointer hover:bg-[#D66500] disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <PlusCircle size={18} className={isGroupFormOpen ? 'rotate-45' : ''} /> {isGroupFormOpen ? 'Vazgeç' : 'Grup Ekle'}
              </button>

              <div className={`grid transition-all duration-300 ${isGroupFormOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                <div className="overflow-hidden">
                  <form onSubmit={handleSaveGroup} className="bg-white border border-[#E2E5EA] rounded-[28px] p-8 mt-4 max-w-[1000px] shadow-sm">
                    <div className="grid grid-cols-2 gap-8 mb-6">
                      <FormInputField name="gCode" label="Grup Kodu" defaultValue={editingGroup?.code} />
                      <div className="space-y-2">
                        <label className="text-[14px] font-semibold text-[#64748B] capitalize ml-1 tracking-wider">Gün ve Saat Seçimi</label>
                        <div className="relative">
                          <select 
                            name="gTimeSelect" 
                            defaultValue={editingGroup?.time}
                            onChange={(e) => setIsCustomTime(e.target.value === "custom")}
                            className="w-full px-5 py-2 bg-[#F8FAFC] border border-[#E2E5EA] rounded-xl text-[14px] font-medium outline-none appearance-none cursor-pointer focus:border-[#FF8D28] transition-all h-[46px]"
                          >
                            <option value="Pts – Çar | 19.00 – 21.30">Pts – Çar | 19.00 – 21.30</option>
                            <option value="Sal – Per | 19.00 – 21.30">Sal – Per | 19.00 – 21.30</option>
                            <option value="Cts – Paz | 09.00 – 12.00">Cts – Paz | 09.00 – 12.00</option>
                            <option value="Cts – Paz | 12.00 – 15.00">Cts – Paz | 12.00 – 15.00</option>
                            <option value="Cts – Paz | 15.00 – 18.00">Cts – Paz | 15.00 – 18.00</option>
                            <option value="custom">+ Özel Grup Tanımla...</option>
                          </select>
                          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" size={18} />
                        </div>
                      </div>
                    </div>
                    {isCustomTime && <div className="mb-6"><FormInputField name="gTimeCustom" label="Özel Grup Tanımı" placeholder="Örn: Cuma | 14:00 - 17:00" /></div>}
                    <div className="flex gap-4 border-t border-[#F1F5F9] pt-6">
                      <button type="submit" className="bg-[#4D52A6] text-white px-10 py-2 rounded-[12px] font-semibold cursor-pointer h-[46px] hover:bg-[#3730A3] transition-colors">Kaydet</button>
                      <button type="button" onClick={() => { setIsGroupFormOpen(false); setEditingGroup(null); }} className="bg-gray-100 text-[#64748B] px-8 py-2 rounded-[12px] font-semibold cursor-pointer h-[46px] hover:bg-gray-200 transition-colors">Vazgeç</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <section className="mb-12">
              <div className="flex gap-10 border-b border-[#E2E5EA] mb-8">
                <TabButton label="Aktif Gruplar" active={activeTab === 'aktif'} onClick={() => setActiveTab('aktif')} />
                <TabButton label="Arşiv" active={activeTab === 'arsiv'} onClick={() => setActiveTab('arsiv')} />
              </div>
              <div className="flex flex-wrap gap-5">
                {currentTabGroups.map((group) => {
                  const count = students.filter(s => s.groupId === group.id).length;
                  return (
                    <div key={group.id} className="relative">
                      <div 
                        onClick={() => {setSelectedGroupId(group.id); setShowAllStudents(false);}}
                        className={`group relative w-[280px] h-[105px] p-8 rounded-[24px] border transition-all duration-300 cursor-pointer flex flex-col justify-center
                          ${selectedGroupId === group.id ? 'bg-[#4D52A6] border-[#4D52A6] text-white shadow-lg' : 'bg-white border-[#E2E5EA] text-[#10294C] hover:border-[#4D52A6]/40 shadow-sm'}`}
                      >
                        <span className={`text-[12px] font-semibold capitalize tracking-[0.1em] ${selectedGroupId === group.id ? 'text-white/70' : 'text-[#4D52A6]'}`}>Grup {group.code}</span>
                        <span className="text-[15px] font-semibold block mt-1">{group.time}</span>
                        <span className="text-[11px] mt-1.5 opacity-60 font-semibold text-inherit">Öğrenci Sayısı: {count}</span>
                        <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === group.id ? null : group.id); }} className={`absolute top-2 right-2 p-1 rounded-lg ${selectedGroupId === group.id ? 'text-white/60 hover:bg-white/10' : 'text-[#94A3B8] hover:bg-gray-50'} cursor-pointer`}>
                          <MoreVertical size={16} />
                        </button>
                      </div>
                      {activeMenuId === group.id && (
                        <div ref={menuRef} className="absolute top-[35px] right-2 bg-white border border-[#E2E5EA] shadow-xl rounded-xl py-2 w-44 z-50 animate-in fade-in zoom-in-95">
                          {activeTab === 'aktif' ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleEditGroup(group); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-[#10294C] hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"><Edit3 size={14} /> Düzenle</button>
                              <button onClick={(e) => { e.stopPropagation(); setArchivedGroups([...archivedGroups, group]); setGroups(groups.filter(g => g.id !== group.id)); setStudents(students.map(s => s.groupId === group.id ? {...s, isArchived: true} : s)); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-[#FF8D28] hover:bg-orange-50 flex items-center gap-2 cursor-pointer transition-colors"><Archive size={14} /> Arşivle</button>
                            </>
                          ) : (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); setGroups([...groups, group]); setArchivedGroups(archivedGroups.filter(g => g.id !== group.id)); setStudents(students.map(s => s.groupId === group.id ? {...s, isArchived: false} : s)); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-green-600 hover:bg-green-50 flex items-center gap-2 cursor-pointer transition-colors"><RefreshCw size={14} /> Aktifleştir</button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, type: 'group', id: group.id }); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"><Trash2 size={14} /> Kalıcı Sil</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {currentTabGroups.length > 0 && (
              <section className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center">
                  <div className="flex items-center gap-16 shrink-0">
                    <div className="flex items-center">
                      <Users className="text-[#10294C] mr-3" size={20} strokeWidth={2.2} />
                      <h2 className="text-[20px] font-bold capitalize">Öğrenci Listesi</h2>
                    </div>
                    <div className="flex bg-[#E2E8F0]/50 p-1 rounded-xl w-[280px] h-[44px] shrink-0">
                      <button onClick={() => setShowAllStudents(false)} className={`flex-1 rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer ${!showAllStudents ? 'bg-white shadow-sm text-[#10294C]' : 'text-[#64748B]'}`}>Grup Listesi</button>
                      <button onClick={() => setShowAllStudents(true)} className={`flex-1 rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer ${showAllStudents ? 'bg-white shadow-sm text-[#10294C]' : 'text-[#64748B]'}`}>Tüm Kayıtlar</button>
                    </div>
                    <button 
                      onClick={() => { setIsStudentFormOpen(!isStudentFormOpen); setEditingStudent(null); }} 
                      disabled={showAllStudents || activeTab === 'arsiv'} 
                      className={`flex items-center gap-2 text-[#4D52A6] font-semibold text-[14px] transition-all shrink-0 ${(showAllStudents || activeTab === 'arsiv') ? 'opacity-20 cursor-not-allowed' : 'hover:text-[#3730A3] cursor-pointer'}`}
                    >
                      <PlusCircle size={18} /> Öğrenci Ekle
                    </button>
                  </div>
                  <div className="relative ml-16 w-[550px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="İsim ile Ara..." className="w-full pl-11 pr-4 py-2 bg-white border border-[#E2E5EA] rounded-xl text-[14px] outline-none shadow-sm font-medium h-[46px]" />
                  </div>
                </div>

                <div className={`grid transition-all duration-300 ${isStudentFormOpen ? 'grid-rows-[1fr] opacity-100 mb-6' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                  <div className="overflow-hidden">
                    <form onSubmit={handleSaveStudent} className="bg-white border border-[#E2E5EA] rounded-[24px] p-8 flex flex-wrap items-end gap-6 w-full shadow-sm">
                      <div className="flex-1 min-w-[280px] space-y-2">
                        <label className="text-[14px] font-semibold text-[#64748B] capitalize ml-1 tracking-wider">İsim Soyisim</label>
                        <input name="sName" defaultValue={editingStudent?.name} className="w-full px-5 py-2 bg-[#F8FAFC] border border-[#E2E5EA] rounded-xl outline-none font-medium text-[14px] h-[46px] focus:border-[#4D52A6] transition-all" required />
                      </div>
                      <div className="flex-1 min-w-[280px] space-y-2">
                        <label className="text-[14px] font-semibold text-[#64748B] capitalize ml-1 tracking-wider">E-mail Adresi</label>
                        <input name="sEmail" type="email" defaultValue={editingStudent?.email} className="w-full px-5 py-2 bg-[#F8FAFC] border border-[#E2E5EA] rounded-xl outline-none font-medium text-[14px] h-[46px] focus:border-[#4D52A6] transition-all" required />
                      </div>
                      <div className="flex-[3] min-w-[400px] space-y-2">
                        <label className="text-[14px] font-semibold text-[#64748B] capitalize ml-1 tracking-wider">Eğitmen Notu</label>
                        <textarea name="sNote" rows={1} defaultValue={editingStudent?.note} className="w-full px-5 py-2 bg-[#F8FAFC] border border-[#E2E5EA] rounded-xl outline-none font-medium text-[14px] resize-none min-h-[46px] focus:border-[#4D52A6] transition-all" />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="bg-[#4D52A6] text-white px-10 py-2 rounded-[12px] font-semibold cursor-pointer h-[46px] hover:bg-[#3730A3] transition-colors">Kaydet</button>
                        <button type="button" onClick={() => setIsStudentFormOpen(false)} className="bg-gray-100 text-[#64748B] px-8 py-2 rounded-[12px] font-semibold cursor-pointer h-[46px] hover:bg-gray-200 transition-colors">Vazgeç</button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E5EA] rounded-[28px] overflow-hidden shadow-sm">
                  <table className="w-full text-left table-fixed border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E5EA]">
                        <th className="px-10 py-5 text-[15px] font-semibold text-[#64748B] capitalize">İsim Soyisim</th>
                        <th className="px-10 py-5 text-[15px] font-semibold text-[#64748B] capitalize">E-mail Adresi</th>
                        <th className="px-10 py-5 text-[15px] font-semibold text-[#64748B] capitalize">Eğitmen Notları</th>
                        <th className="px-10 py-5 text-[15px] font-semibold text-right pr-10 capitalize">Aksiyonlar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {filteredStudents.length > 0 ? filteredStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-[#F8FAFC] transition-colors group">
                          <td className="px-10 py-8 align-top font-bold text-[#10294C] text-[15px]">{s.name}</td>
                          <td className="px-10 py-8 align-top font-medium text-[#64748B] text-[15px]">{s.email}</td>
                          <td className="px-10 py-8 align-top text-[15px] text-[#64748B] leading-relaxed font-medium">{s.note}</td>
                          <td className="px-10 py-8 text-right pr-10 align-top">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => {setEditingStudent(s); setIsStudentFormOpen(true);}} className="p-2 text-[#4D52A6] hover:bg-[#4D52A6]/10 rounded-lg cursor-pointer transition-all"><Edit3 size={18} /></button>
                              <button onClick={() => setDeleteModal({ isOpen: true, type: 'student', id: s.id })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="px-10 py-20 text-center text-[#94A3B8] font-medium italic">
                            Henüz kayıtlı bir veri bulunamadı.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </main>
        
        <Footer />
      </div>

      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10294C]/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[24px] p-8 w-[400px] shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 font-bold text-[24px]">!</div>
            <h3 className="text-[18px] font-bold text-[#10294C] capitalize">{deleteModal.type === 'student' ? 'Öğrenciyi' : 'Grubu'} Siliyoruz</h3>
            <p className="text-[14px] text-[#64748B]">Emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex gap-3 w-full mt-4">
              <button onClick={executeDelete} className="flex-1 bg-red-500 text-white py-3 rounded-[12px] font-semibold cursor-pointer hover:bg-red-700 transition-colors">Evet, Sil</button>
              <button onClick={() => setDeleteModal({ isOpen: false, type: 'student', id: null })} className="flex-1 bg-gray-100 text-[#64748B] py-3 rounded-[12px] font-semibold cursor-pointer hover:bg-gray-200 transition-colors">Vazgeç</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormInputField({ label, name, defaultValue, placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[14px] font-semibold text-[#64748B] capitalize ml-1 tracking-wider">{label}</label>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="w-full px-5 py-3 bg-[#F8FAFC] border border-[#E2E5EA] rounded-xl outline-none focus:border-[#4D52A6] transition-all font-medium h-[46px] text-[14px]" />
    </div>
  );
}

function TabButton({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className="pb-4 text-[14px] font-semibold transition-all relative cursor-pointer outline-none group">
      <span className={active ? 'text-[#10294C]' : 'text-[#94A3B8] group-hover:text-[#10294C] capitalize'}>{label}</span>
      {active && <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#FF8D28] rounded-t-full shadow-[0_-2px_6px_rgba(255,141,40,0.2)]" />}
    </button>
  );
}