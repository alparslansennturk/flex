"use client";
import React, { useState, useEffect } from "react";
import { X, Check, GraduationCap, MessageSquare, MapPin, User, Mail, Users, Camera, ChevronDown } from "lucide-react";
import { getFlexMessage } from "@/app/lib/messages";

// SADECE TEK BİR INTERFACE (Gereksizleri sildik, errors ve shake ekledik)
interface StudentFormProps {
  isStudentFormOpen: boolean;
  setIsStudentFormOpen: (val: boolean) => void;
  handleAddStudent: (e?: any) => void;
  groups: any[];
  editingStudent?: any;
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
  studentGender: string;
  setStudentGender: (val: string) => void;

}

export const StudentForm: React.FC<StudentFormProps> = ({
  isStudentFormOpen,
  setIsStudentFormOpen,
  handleAddStudent,
  groups,
  editingStudent,
  studentName, setStudentName,
  studentLastName, setStudentLastName,
  studentEmail, setStudentEmail,
  studentNote, setStudentNote,
  studentBranch, setStudentBranch,
  selectedGroupIdForStudent, setSelectedGroupIdForStudent,
  studentGender,
  setStudentGender,
}) => {
  // --- ADIM 1: İÇE GÖMÜLEN STATE'LER ---
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  


  // İçine gömdüğümüz yerel state'ler
  const [localErrors, setLocalErrors] = useState<Record<string, boolean>>({});
  const [localShake, setLocalShake] = useState(false);

  // Shake etkisini temizlemek için useEffect
  useEffect(() => {
    if (localShake) {
      const timer = setTimeout(() => setLocalShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [localShake]);

  // DÜZENLEME MODU İÇİN VERİLERİ STATE'LERE YÜKLE
  useEffect(() => {
    if (editingStudent) {
      setStudentName(editingStudent.name || "");
      setStudentLastName(editingStudent.lastName || "");
      setStudentEmail(editingStudent.email || "");
      setStudentBranch(editingStudent.branch || "");
      setStudentNote(editingStudent.note || "");
      setSelectedGroupIdForStudent(editingStudent.groupId || "");
    }
  }, [editingStudent]);

  useEffect(() => {
    if (!isStudentFormOpen) {
      setIsSuccess(false);
      setLoading(false);
      setLocalErrors({}); 

      setStudentName("");
      setStudentLastName("");
      setStudentEmail("");
      setStudentBranch("");
      setStudentNote("");
      setSelectedGroupIdForStudent("");
      setStudentGender("");
    }
  }, [isStudentFormOpen]);



  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalErrors({});

    const form = e.currentTarget;
    // Gender değerini garantili alalım
    const genderField = form.elements.namedItem("gender") as HTMLSelectElement;
    const genderValue = genderField?.value;

    const data = {
      name: studentName,
      lastName: studentLastName,
      email: studentEmail,
      branch: studentBranch,
      groupId: selectedGroupIdForStudent,
      note: studentNote,
      gender: genderValue
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
    } catch (err) {
      console.error("Kayıt hatası:", err);
      setLocalShake(true); // <--- Hata durumunda da titret
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
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-100">
      <div className="absolute inset-0 bg-[#10294C]/60 backdrop-blur-md" onClick={() => setIsStudentFormOpen(false)} />

      <form
        onSubmit={handleSubmit}
        className={`relative w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] h-fit text-[#10294C] transform-gpu will-change-transform ${localShake ? 'animate-fast-shake' : ''}`}
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
        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          <div className="flex gap-12">
            <div className="flex-col items-center gap-4 hidden md:flex">
              <div className="w-40 h-40 rounded-[24px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden relative shadow-inner group">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${studentName || 'student'}`} className="w-full h-full object-cover" alt="avatar" />
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-5">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Ad</label>
                <input name="name" placeholder="Örn: Alparslan" value={studentName} onChange={(e) => setStudentName(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 outline-none transition-all font-bold text-[14px] placeholder:text-neutral-400 placeholder:font-normal ${localErrors.name ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Soyad</label>
                <input name="surname" placeholder="Örn: Akdağ" value={studentLastName} onChange={(e) => setStudentLastName(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 outline-none transition-all font-bold text-[14px] placeholder:text-neutral-400 placeholder:font-normal ${localErrors.lastName ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">E-Posta</label>
                <input name="email" type="email" placeholder="ornek@email.com" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 outline-none transition-all font-bold text-[14px] placeholder:text-neutral-400 placeholder:font-normal ${localErrors.email ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`} />
              </div>
              <div className="space-y-1.5 relative">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Cinsiyet</label>
                <div className="relative">
                  <select name="gender" value={studentGender} onChange={(e) => setStudentGender(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 pr-10 outline-none appearance-none cursor-pointer transition-all font-bold text-[14px] ${!studentGender ? '!text-neutral-600' : '!text-[#10294C]'} ${localErrors.gender ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`}>
                    <option value="" disabled hidden>Cinsiyet Seçiniz...</option>
                    <option value="male">Erkek</option>
                    <option value="female">Kadın</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"><ChevronDown size={18} /></div>
                </div>
              </div>
              <div className="space-y-1.5 relative">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Şube</label>
                <div className="relative">
                  <select value={studentBranch} onChange={(e) => setStudentBranch(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 pr-10 outline-none appearance-none cursor-pointer transition-all font-bold text-[14px] ${localErrors.branch ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'}`}>
                    <option value="" disabled hidden>Şube Seçiniz...</option>
                    <option value="Kadıköy">Kadıköy</option>
                    <option value="Şirinevler">Şirinevler</option>
                    <option value="Pendik">Pendik</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"><ChevronDown size={18} /></div>
                </div>
              </div>
              <div className="space-y-1.5 relative">
                <label className="text-[14px] font-semibold text-neutral-500 ml-1">Grup Seçimi</label>
                <div className="relative">
                  <select name="groupId" value={selectedGroupIdForStudent} onChange={(e) => setSelectedGroupIdForStudent(e.target.value)} className={`h-12 w-full border rounded-[12px] px-4 pr-10 outline-none appearance-none cursor-pointer transition-all font-bold text-[14px] ${localErrors.groupId ? 'border-red-500 bg-red-50' : 'border-neutral-100 bg-neutral-50 focus:border-orange-500 focus:bg-white'} ${!selectedGroupIdForStudent ? '!text-neutral-600' : '!text-[#10294C]'}`}>
                    <option value="" disabled hidden>Bir grup seçin...</option>
                    {groups.filter(g => g && (g.code || g.name)).map((g) => (<option key={g.id} value={g.id}>{g.code}{g.branch ? ` (${g.branch})` : ""}</option>))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"><ChevronDown size={18} /></div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4 pt-6 border-t border-neutral-50">
            <div className="flex items-center gap-3 text-[#10294C] font-semibold text-[16px] border-l-4 border-[#10294C] pl-4">
              <span>Öğrenci Notları</span>
            </div>
            <textarea name="instructorNote" value={studentNote} onChange={(e) => setStudentNote(e.target.value)} placeholder="Öğrencinin teknik seviyesi ve özel durumları..." className="w-full h-[140px] bg-neutral-50 border border-neutral-100 rounded-[12px] p-6 outline-none font-medium text-[14px] placeholder:text-neutral-400 placeholder:font-normal focus:border-orange-200 focus:bg-white transition-all resize-none" />
          </div>
        </div>
        <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end shrink-0">
          {!isSuccess && Object.keys(localErrors).length > 0 && (<span className="text-[13px] font-bold text-red-500 mr-8 animate-in fade-in slide-in-from-right-4">{getFlexMessage('validation/required-fields').text}</span>)}
          <button type="button" onClick={() => setIsStudentFormOpen(false)} className="px-8 font-bold text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors">Vazgeç</button>
          <button type="submit" disabled={loading || isSuccess} className={`px-[24px] py-[12px] rounded-[12px] font-semibold transition-all flex items-center gap-3 ${isSuccess ? 'bg-green-500 text-white' : 'bg-[var(--color-designstudio-primary-500)] text-white active:scale-95 cursor-pointer hover:bg-[var(--color-designstudio-primary-700)]'}`}>
            {isSuccess ? <><Check size={24} strokeWidth={3} /><span>Öğrenci Kaydedildi</span></> : loading ? "Kaydediliyor..." : "Öğrenciyi Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
};