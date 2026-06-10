"use client";
import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { X, Check, GraduationCap, ChevronDown, Users, Monitor, AlertTriangle } from "lucide-react";
import { getFlexMessage } from "@/app/lib/messages";

interface Student {
  id?: string;
  name?: string;
  lastName?: string;
  email?: string;
  note?: string;
  branch?: string;
  groupId?: string;
  gender?: string;
  avatarId?: number | null;
  isOnlineStudent?: boolean;
  status?: string;
}

interface Group {
  id: string;
  code?: string;
  name?: string;
  branch?: string;
}

interface StudentFormData {
  name: string;
  lastName: string;
  email: string;
  branch: string;
  groupId: string;
  note: string;
  gender: string;
  isOnlineStudent: boolean;
}

// Tüm aktif öğrenciler arasında kullanılmayan bir avatar ID seçer
function getUnusedAvatar(
  gender: string,
  students: Student[],
  excludeId: string | number | null,
  total: number
): number {
  const usedIds = new Set(
    students
      .filter(s => s.status !== "passive" && s.gender === gender && s.id !== excludeId)
      .map(s => s.avatarId)
      .filter(Boolean)
  );
  const available = Array.from({ length: total }, (_, i) => i + 1).filter(id => !usedIds.has(id));
  const pool = available.length > 0 ? available : Array.from({ length: total }, (_, i) => i + 1);
  return pool[Math.floor(Math.random() * pool.length)];
}

// SADECE TEK BİR INTERFACE (Gereksizleri sildik, errors ve shake ekledik)
interface StudentFormProps {
  isStudentFormOpen: boolean;
  setIsStudentFormOpen: (val: boolean) => void;
  handleAddStudent: (data?: StudentFormData) => void | Promise<void>;
  groups: Group[];
  students: Student[];
  editingStudent?: Student | null;
  avatarId: number | null;
  setAvatarId: (val: number | null) => void;
  studentName: string;
  setStudentName: (val: string) => void;
  studentLastName: string;
  setStudentLastName: (val: string) => void;
  studentEmail: string;
  setStudentEmail: (val: string) => void;
  studentNote: string;
  setStudentNote: (val: string) => void;
  studentBranch: string;
  setStudentBranch: (val: string) => void;
  selectedGroupIdForStudent: string;
  setSelectedGroupIdForStudent: (val: string) => void;
  selectedGroupId: string | null;
  studentGender: string;
  setStudentGender: (val: string) => void;
}

export const StudentForm: React.FC<StudentFormProps> = ({
  isStudentFormOpen,
  setIsStudentFormOpen,
  handleAddStudent,
  groups,
  students,
  editingStudent,
  selectedGroupId,
  avatarId,
  setAvatarId,
  studentName,
  setStudentName,
  studentLastName,
  setStudentLastName,
  studentEmail,
  setStudentEmail,
  studentNote,
  setStudentNote,
  studentBranch,
  setStudentBranch,
  selectedGroupIdForStudent,
  setSelectedGroupIdForStudent,
  studentGender,
  setStudentGender,
}) => {
  // --- ADIM 1: İÇE GÖMÜLEN STATE'LER ---
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const TOTAL_AVATARS = 70;



  // İçine gömdüğümüz yerel state'ler
  const [localErrors, setLocalErrors] = useState<Record<string, boolean>>({});
  const [localShake, setLocalShake] = useState(false);
  const [emailErrorMsg, setEmailErrorMsg] = useState("");
  const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; msg: string }>({ open: false, msg: "" });
  const [isOnlineStudent, setIsOnlineStudent] = useState(false);
  const [isGenderDropOpen, setIsGenderDropOpen] = useState(false);
  const [genderDropPos, setGenderDropPos]       = useState({ top: 0, left: 0, width: 0 });
  const [isBranchDropOpen, setIsBranchDropOpen] = useState(false);
  const [branchDropPos, setBranchDropPos]       = useState({ top: 0, left: 0, width: 0 });
  const [isGroupDropOpen, setIsGroupDropOpen]   = useState(false);
  const [groupDropPos, setGroupDropPos]         = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  // Shake etkisini temizlemek için useEffect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (localShake) {
      const timer = setTimeout(() => setLocalShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [localShake]);

  useEffect(() => {
    if (isStudentFormOpen) {
      if (editingStudent) {
        setStudentName(editingStudent.name || "");
        setStudentLastName(editingStudent.lastName || "");
        setStudentEmail(editingStudent.email || "");
        setStudentBranch(editingStudent.branch || "");
        setStudentNote(editingStudent.note || "");
        setSelectedGroupIdForStudent(editingStudent.groupId || "");
        setStudentGender(editingStudent.gender || "");
        setIsOnlineStudent(editingStudent.isOnlineStudent ?? false);
        const id = editingStudent.avatarId;
        if (id !== undefined && id !== null && id !== 0) {
          setAvatarId(Number(id));
        } else {
          setAvatarId(Math.floor(Math.random() * TOTAL_AVATARS) + 1);
        }
      } else {
        if (avatarId === null) {
          setAvatarId(Math.floor(Math.random() * TOTAL_AVATARS) + 1);
        }
        if (selectedGroupId && !selectedGroupIdForStudent) {
          setSelectedGroupIdForStudent(selectedGroupId);
        }
      }
    } else {
      setIsSuccess(false);
      setLoading(false);
      setLocalErrors({});
      setEmailErrorMsg("");
      setStudentName("");
      setStudentLastName("");
      setStudentEmail("");
      setStudentBranch("");
      setStudentNote("");
      setSelectedGroupIdForStudent("");
      setStudentGender("");
      setIsOnlineStudent(false);
      setAvatarId(null);
      setIsGenderDropOpen(false);
      setIsBranchDropOpen(false);
      setIsGroupDropOpen(false);
    }
  }, [isStudentFormOpen, editingStudent, selectedGroupId, setAvatarId, setStudentName, setStudentLastName, setStudentEmail, setStudentBranch, setStudentNote, setSelectedGroupIdForStudent, setStudentGender]);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalErrors({});

    const data = {
      name: studentName,
      lastName: studentLastName,
      email: studentEmail,
      branch: studentBranch,
      groupId: selectedGroupIdForStudent,
      note: studentNote,
      gender: studentGender,
      isOnlineStudent,
    };

    // VALIDATION
    let newErrors: Record<string, boolean> = {};
    if (!data.name?.trim()) newErrors.name = true;
    if (!data.lastName?.trim()) newErrors.lastName = true;
    if (!data.email?.trim()) newErrors.email = true;
    if (!data.gender) newErrors.gender = true;
    if (!data.branch) newErrors.branch = true;
    if (!data.groupId) newErrors.groupId = true;

    if (Object.keys(newErrors).length > 0) {
      setLocalErrors(newErrors);
      setLocalShake(true); // <--- İşte titremeyi başlatan komut!
      return;
    }

    setLoading(true);

    try {
      // BURASI ÇOK KRİTİK: Dışarıdaki fonksiyona datayı paslıyoruz
      await handleAddStudent(data);

      setIsSuccess(true);

      // Kayıttan sonra formu temizle ve kapat
      setTimeout(() => {
        setIsStudentFormOpen(false);
        // Eğer resetStudentForm proplardan gelmiyorsa yerelde tanımlı olmalı
        if (typeof resetStudentForm === 'function') resetStudentForm();
      }, 1500);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === "DUPLICATE_EMAIL") {
        setLocalErrors({ email: true });
        setDuplicateModal({ open: true, msg: e.message ?? "Bu e-posta aktif bir gruptaki öğrenciye tanımlı." });
      } else {
        console.error("Kayıt hatası:", err);
      }
      setLocalShake(true);
    } finally {
      setLoading(false);
    }
  };
  const resetStudentForm = () => {
    setStudentName("");
    setStudentLastName("");
    setStudentEmail("");
    setStudentNote("");
    setStudentBranch("");
    setSelectedGroupIdForStudent("");
    setLocalErrors({});
    setIsSuccess(false);
  };

  return (
    <>
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
  <motion.div
    className="absolute inset-0 bg-[#10294C]/60 backdrop-blur-md"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
    onClick={() => setIsStudentFormOpen(false)}
  />

  <motion.form
    onSubmit={handleSubmit}
    className={`relative w-full max-w-5xl bg-white rounded-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] min-h-130 text-[#10294C] -mt-10 ${localShake ? 'error-shake' : ''}`}
    initial={{ opacity: 0, y: 80 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 60, transition: { duration: 0.2 } }}
    transition={{ type: "spring", stiffness: 350, damping: 28 }}
  >
        <div className="bg-[#10294C] p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 rounded-[12px] flex items-center justify-center shadow-lg shadow-orange-500/20"><GraduationCap size={26} strokeWidth={2.5} /></div>
            <div>
              <h3 className="text-[20px] font-bold">{editingStudent ? "Öğrenci Kartını Düzenle" : "Yeni Öğrenci Tanımla"}</h3>
              <p className="text-white/50 text-[13px] font-medium">Öğrenci bilgilerini ve gelişim notlarını buradan yönetin.</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsStudentFormOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X size={20} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          <div className="flex gap-12">
            <div className="flex-col items-center gap-4 hidden md:flex">
              <div className="w-40 h-40 rounded-[24px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden relative shadow-inner group flex items-center justify-center">
  {studentGender ? (
    <img
      src={`/avatars/${studentGender}/${avatarId || (studentName.length + studentLastName.length) % 70 + 1}.svg`}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 pointer-events-none"
      alt="Öğrenci Avatarı"
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = `/avatars/${studentGender}/1.svg`; }}
    />
  ) : (
    <div className="flex flex-col items-center justify-center text-neutral-400 px-4 text-center">
      <span className="text-[10px] font-bold tracking-widest uppercase">Cinsiyet Seç</span>
    </div>
  )}
 {studentGender && (
    <button
      type="button"
      onClick={() => setAvatarId(getUnusedAvatar(studentGender, students, editingStudent?.id ?? null, TOTAL_AVATARS))}
      className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-lg shadow-md border border-neutral-100 flex items-center justify-center hover:bg-neutral-50 transition-all cursor-pointer active:scale-90 z-10"
    >
      <span className="text-[14px]">🔄</span>
    </button>
  )}
</div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-5">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Ad</label>
                <input name="name" placeholder="Örn: Alparslan" value={studentName} onChange={(e) => setStudentName(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 outline-none transition-all font-bold text-[14px] placeholder:text-neutral-500 placeholder:font-normal ${localErrors.name ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Soyad</label>
                <input name="surname" placeholder="Örn: Akdağ" value={studentLastName} onChange={(e) => setStudentLastName(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 outline-none transition-all font-bold text-[14px] placeholder:text-neutral-500 placeholder:font-normal ${localErrors.lastName ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">E-Posta</label>
                <input
                  name="email" type="email" placeholder="ornek@email.com" value={studentEmail}
                  onChange={(e) => { setStudentEmail(e.target.value); setLocalErrors(p => { const n = {...p}; delete n.email; return n; }); setEmailErrorMsg(""); }}
                  className={`h-12 w-full border rounded-[12px] px-4 outline-none transition-all font-bold text-[14px] placeholder:text-neutral-500 placeholder:font-normal ${localErrors.email ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`}
                />
                {emailErrorMsg && (
                  <p className="text-[12px] font-semibold text-red-500 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">{emailErrorMsg}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Cinsiyet</label>
                <div tabIndex={0} onClick={(e) => { if (!isGenderDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setGenderDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsGenderDropOpen(!isGenderDropOpen); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setGenderDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); setIsGenderDropOpen(v => !v); } }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 outline-none focus:ring-2 focus:ring-orange-300 ${localErrors.gender ? 'border-red-500 bg-red-50' : isGenderDropOpen ? 'border-orange-500 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
                  <span className={`text-[14px] ${studentGender ? 'font-bold text-[#10294C]' : 'font-normal text-neutral-400'}`}>{studentGender === 'male' ? 'Erkek' : studentGender === 'female' ? 'Kadın' : 'Cinsiyet Seçiniz...'}</span>
                  <ChevronDown size={18} className={`shrink-0 transition-transform duration-300 ${isGenderDropOpen ? 'rotate-180 text-orange-500' : 'text-neutral-400'}`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Şube</label>
                <div tabIndex={0} onClick={(e) => { if (!isBranchDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setBranchDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsBranchDropOpen(!isBranchDropOpen); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setBranchDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); setIsBranchDropOpen(v => !v); } }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 outline-none focus:ring-2 focus:ring-orange-300 ${localErrors.branch ? 'border-red-500 bg-red-50' : isBranchDropOpen ? 'border-orange-500 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
                  <span className={`text-[14px] ${studentBranch ? 'font-bold text-[#10294C]' : 'font-normal text-neutral-400'}`}>{studentBranch || 'Şube Seçiniz...'}</span>
                  <ChevronDown size={18} className={`shrink-0 transition-transform duration-300 ${isBranchDropOpen ? 'rotate-180 text-orange-500' : 'text-neutral-400'}`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Grup Seçimi</label>
                <div tabIndex={0} onClick={(e) => { if (!isGroupDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setGroupDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsGroupDropOpen(!isGroupDropOpen); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setGroupDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); setIsGroupDropOpen(v => !v); } }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 outline-none focus:ring-2 focus:ring-orange-300 ${localErrors.groupId ? 'border-red-500 bg-red-50' : isGroupDropOpen ? 'border-orange-500 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
                  <span className={`text-[14px] truncate ${selectedGroupIdForStudent ? 'font-bold text-[#10294C]' : 'font-normal text-neutral-400'}`}>{(() => { if (!selectedGroupIdForStudent) return 'Bir grup seçin...'; const g = groups.find(x => x.id === selectedGroupIdForStudent); return g ? `${g.code}${g.branch ? ` (${g.branch})` : ''}` : 'Bir grup seçin...'; })()}</span>
                  <ChevronDown size={18} className={`shrink-0 transition-transform duration-300 ${isGroupDropOpen ? 'rotate-180 text-orange-500' : 'text-neutral-400'}`} />
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Katılım Türü</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOnlineStudent(false)}
                    className={`flex-1 h-12 rounded-[12px] border-2 flex items-center justify-center gap-2 font-bold text-[14px] transition-all cursor-pointer ${
                      !isOnlineStudent
                        ? "border-orange-500 bg-orange-50 text-orange-600"
                        : "border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200"
                    }`}
                  >
                    <Users size={16} /> Yüz Yüze
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOnlineStudent(true)}
                    className={`flex-1 h-12 rounded-[12px] border-2 flex items-center justify-center gap-2 font-bold text-[14px] transition-all cursor-pointer ${
                      isOnlineStudent
                        ? "border-orange-500 bg-orange-50 text-orange-600"
                        : "border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200"
                    }`}
                  >
                    <Monitor size={16} /> Online
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4 pt-6 border-t border-neutral-50">
            <div className="flex items-center gap-3 text-[#10294C] font-semibold text-[16px] border-l-4 border-[#10294C] pl-4">
              <span>Öğrenci Notları</span>
            </div>
            <textarea name="instructorNote" value={studentNote} onChange={(e) => setStudentNote(e.target.value)} placeholder="Öğrencinin teknik seviyesi ve özel durumları..." className="w-full h-[140px] bg-neutral-50 border border-neutral-100 rounded-[12px] p-6 outline-none font-medium text-[14px] placeholder:text-neutral-500 placeholder:font-normal focus:border-orange-200 focus:bg-white transition-all resize-none" />
          </div>
        </div>
        <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end shrink-0">
          {!isSuccess && Object.keys(localErrors).length > 0 && (<span className="text-[13px] font-bold text-red-500 mr-8 animate-in fade-in slide-in-from-right-4">{getFlexMessage('validation/required-fields').text}</span>)}
          <button type="button" onClick={() => setIsStudentFormOpen(false)} className="px-8 font-bold text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors">Vazgeç</button>
          <button type="submit" disabled={loading || isSuccess} className={`px-[24px] py-[12px] rounded-[12px] font-semibold transition-all flex items-center gap-3 ${isSuccess ? 'bg-green-500 text-white' : 'bg-[var(--color-designstudio-primary-500)] text-white active:scale-95 cursor-pointer hover:bg-[var(--color-designstudio-primary-700)]'}`}>
            {isSuccess ? <><Check size={24} strokeWidth={3} /><span>Öğrenci Kaydedildi</span></> : loading ? "Kaydediliyor..." : "Öğrenciyi Kaydet"}
          </button>
        </div>
      </motion.form>
    </div>

    {mounted && createPortal(
      <>
        {isGenderDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsGenderDropOpen(false)} />}
        <AnimatePresence>
          {isGenderDropOpen && (
            <motion.div className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden"
              initial={{ opacity: 0, y: -6, scaleY: 0.92 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -6, scaleY: 0.92 }} transition={{ duration: 0.15 }}
              style={{ transformOrigin: 'top', top: genderDropPos.top, left: genderDropPos.left, width: genderDropPos.width }}
            >
              {[{ value: 'male', label: 'Erkek' }, { value: 'female', label: 'Kadın' }].map(opt => (
                <div key={opt.value} onClick={() => { setStudentGender(opt.value); setAvatarId(getUnusedAvatar(opt.value, students, editingStudent?.id ?? null, TOTAL_AVATARS)); setIsGenderDropOpen(false); }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                  <span className="text-[14px] font-medium text-neutral-700">{opt.label}</span>
                  {studentGender === opt.value && <Check size={16} className="text-orange-500" strokeWidth={3} />}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </>, document.body
    )}

    {mounted && createPortal(
      <>
        {isBranchDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsBranchDropOpen(false)} />}
        <AnimatePresence>
          {isBranchDropOpen && (
            <motion.div className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden"
              initial={{ opacity: 0, y: -6, scaleY: 0.92 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -6, scaleY: 0.92 }} transition={{ duration: 0.15 }}
              style={{ transformOrigin: 'top', top: branchDropPos.top, left: branchDropPos.left, width: branchDropPos.width }}
            >
              {['Kadıköy', 'Şirinevler', 'Pendik'].map(loc => (
                <div key={loc} onClick={() => { setStudentBranch(loc); setIsBranchDropOpen(false); }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                  <span className="text-[14px] font-medium text-neutral-700">{loc}</span>
                  {studentBranch === loc && <Check size={16} className="text-orange-500" strokeWidth={3} />}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </>, document.body
    )}

    {mounted && createPortal(
      <>
        {isGroupDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsGroupDropOpen(false)} />}
        <AnimatePresence>
          {isGroupDropOpen && (
            <motion.div className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden max-h-60 overflow-y-auto"
              initial={{ opacity: 0, y: -6, scaleY: 0.92 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -6, scaleY: 0.92 }} transition={{ duration: 0.15 }}
              style={{ transformOrigin: 'top', top: groupDropPos.top, left: groupDropPos.left, width: groupDropPos.width }}
            >
              {groups.filter(g => g && (g.code || g.name)).map(g => (
                <div key={g.id} onClick={() => { setSelectedGroupIdForStudent(g.id); setIsGroupDropOpen(false); }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                  <span className="text-[14px] font-medium text-neutral-700">{g.code}{g.branch ? ` (${g.branch})` : ''}</span>
                  {selectedGroupIdForStudent === g.id && <Check size={16} className="text-orange-500" strokeWidth={3} />}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </>, document.body
    )}

    {mounted && duplicateModal.open && createPortal(
      <div className="fixed inset-0 z-[700] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-[#10294C]/60 backdrop-blur-sm" onClick={() => setDuplicateModal({ open: false, msg: "" })} />
        <motion.div
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 26 }}
        >
          <div className="p-7 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <AlertTriangle size={28} className="text-red-500" strokeWidth={2.2} />
            </div>
            <h3 className="text-[18px] font-bold text-[#10294C] mb-2">Bu e-posta kullanılamaz</h3>
            <p className="text-[13px] font-medium text-neutral-500 leading-relaxed mb-6">
              {duplicateModal.msg}<br />
              Aktif bir gruptaki öğrenciye tanımlı e-posta ile yeni kayıt yapılamaz.
            </p>
            <button
              onClick={() => setDuplicateModal({ open: false, msg: "" })}
              className="h-11 w-full bg-[#10294C] hover:bg-[#1c3a64] text-white rounded-xl text-[14px] font-semibold transition-colors cursor-pointer"
            >
              Anladım
            </button>
          </div>
        </motion.div>
      </div>, document.body
    )}
    </>
  );
};
