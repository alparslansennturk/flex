"use client";
import React, { useState, useEffect } from "react";
import { X, Check, GraduationCap, ChevronDown } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface Props {
  isOpen: boolean;
  student: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export const StudentQuickEditModal: React.FC<Props> = ({ isOpen, student, onClose, onSaved }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [localGender, setLocalGender] = useState("");
  const [avatarId, setAvatarId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (student) {
      setLocalGender(student.gender || "");
      setAvatarId(Number(student.avatarId) || 1);
      setErrors({});
      setIsSuccess(false);
    }
  }, [student, isOpen]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!student) return;
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());

    const newErrors: Record<string, boolean> = {};
    if (!data.name) newErrors.name = true;
    if (!data.lastName) newErrors.lastName = true;
    if (!data.branch) newErrors.branch = true;
    if (!localGender) newErrors.gender = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    try {
      await setDoc(doc(db, "students", student.id), {
        ...data,
        gender: localGender,
        avatarId: Number(avatarId),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setIsSuccess(true);
      setTimeout(() => {
        onSaved();
        onClose();
        setIsSuccess(false);
        setErrors({});
      }, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className={`fixed inset-0 z-[600] flex items-center justify-center p-6 transition-all duration-300 ${isVisible ? "visible" : "invisible pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-[#10294C]/40 backdrop-blur-md transition-opacity duration-500 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div className={`relative w-full max-w-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] transform ${isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}>
        <form onSubmit={handleSave} className="bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#10294C]">

          {/* Header */}
          <div className="bg-[#10294C] p-6 text-white flex items-center justify-between shrink-0 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                <GraduationCap size={20} />
              </div>
              <div>
                <h3 className="text-[18px] font-bold">Öğrenci Düzenleme</h3>
                <p className="text-white/40 text-[12px] mt-0.5">Temel bilgileri güncelle</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">

            {/* Avatar + Rol */}
            <div className="flex items-center gap-6 pb-6 border-b border-neutral-100">
              <div className="relative w-24 h-24 rounded-[20px] bg-neutral-50 border-2 border-dashed border-neutral-200 overflow-hidden shrink-0">
                {localGender ? (
                  <img
                    key={`${localGender}-${avatarId}`}
                    src={`/avatars/${localGender}/${avatarId}.svg`}
                    className="w-full h-full object-cover" alt="Avatar"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-300 text-[10px] font-bold text-center px-2">
                    Cinsiyet Seçiniz
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { if (localGender) setAvatarId(Math.floor(Math.random() * 70) + 1); else alert("Önce cinsiyet seç!"); }}
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 bg-white rounded-lg shadow border border-neutral-100 flex items-center justify-center text-[14px] cursor-pointer hover:bg-neutral-50 active:scale-90 transition-all"
                >🔄</button>
              </div>
              <div>
                <p className="text-[12px] font-bold text-neutral-500 mb-2">Rol</p>
                <span className="px-3 py-1.5 rounded-lg text-[13px] font-bold border bg-purple-50 text-purple-600 border-purple-200 inline-block">
                  Öğrenci
                </span>
                <p className="text-[11px] text-neutral-400 mt-2">Öğrenci rolü değiştirilemez.</p>
              </div>
            </div>

            {/* Ad & Soyad */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Ad</label>
                <input
                  name="name" defaultValue={student?.name} placeholder="Örn: Ali"
                  className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal ${errors.name ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Soyad</label>
                <input
                  name="lastName" defaultValue={student?.lastName} placeholder="Örn: Yılmaz"
                  className={`h-12 w-full border rounded-xl px-4 outline-none transition-all font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal ${errors.lastName ? `border-red-500 bg-red-50 ${shake ? 'error-shake' : ''}` : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-neutral-500 ml-1">E-Posta</label>
              <input
                name="email" type="email" defaultValue={student?.email} placeholder="ornek@email.com"
                className="h-12 w-full border border-neutral-200 bg-neutral-50 rounded-xl px-4 outline-none focus:border-orange-500 font-bold text-[#10294C] placeholder:text-neutral-500 placeholder:font-normal"
              />
            </div>

            {/* Şube & Cinsiyet */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Şube</label>
                <div className="relative">
                  <select
                    name="branch" defaultValue={student?.branch || ""}
                    className={`h-12 w-full border rounded-xl px-4 pr-10 outline-none cursor-pointer appearance-none font-semibold text-neutral-800 transition-all ${errors.branch ? 'border-red-500 bg-red-50' : 'border-neutral-200 bg-neutral-50 focus:border-orange-500'}`}
                  >
                    <option value="" disabled hidden>Şube Seçiniz...</option>
                    <option value="Kadıköy Şb">Kadıköy Şb</option>
                    <option value="Şirinevler Şb">Şirinevler Şb</option>
                    <option value="Pendik Şb">Pendik Şb</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"><ChevronDown size={18} /></div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-neutral-500 ml-1">Cinsiyet</label>
                <div className="relative">
                  <select
                    value={localGender}
                    onChange={(e) => setLocalGender(e.target.value)}
                    className={`h-12 w-full border rounded-xl px-4 pr-10 outline-none cursor-pointer appearance-none font-semibold transition-all ${!localGender ? 'text-neutral-600' : 'text-[#10294C] font-bold'} ${errors.gender ? 'border-red-500 bg-red-50' : 'border-neutral-200 bg-neutral-50'}`}
                  >
                    <option value="" disabled>Cinsiyet Seçiniz...</option>
                    <option value="male">Erkek</option>
                    <option value="female">Kadın</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"><ChevronDown size={18} /></div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-4 shrink-0">
            {!isSuccess && Object.keys(errors).length > 0 && (
              <span className="text-[13px] font-bold text-red-500 mr-auto">Lütfen eksik alanları doldurun.</span>
            )}
            <button type="button" onClick={onClose} className="px-8 font-bold text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors">
              Vazgeç
            </button>
            <button
              type="submit" disabled={loading || isSuccess}
              className={`h-12 px-10 rounded-xl font-bold transition-all flex items-center gap-3 shadow-lg ${isSuccess ? 'bg-green-500 text-white' : 'bg-orange-500 text-white active:scale-95 cursor-pointer hover:bg-orange-600'}`}
            >
              {isSuccess ? <><Check size={20} strokeWidth={3} /><span>Kaydedildi</span></> : loading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
