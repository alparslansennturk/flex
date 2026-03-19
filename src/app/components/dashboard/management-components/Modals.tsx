import React from "react";
import { Trash2, RotateCcw, Archive, GraduationCap } from "lucide-react";

interface GlobalModalProps {
  isOpen: boolean;
  type: 'archive' | 'delete' | 'restore' | 'student-delete' | 'bulk-delete' | null;
  count?: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const GlobalConfirmationModal: React.FC<GlobalModalProps> = ({ isOpen, type, count, onClose, onConfirm }) => {
  if (!isOpen) return null;

  const isBulk = type === 'bulk-delete';
  const isDelete = type === 'delete' || isBulk;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base-primary-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-lg p-8 max-w-[400px] w-full shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className={`w-14 h-14 rounded-lg flex items-center justify-center mb-6 ${isDelete ? 'bg-red-50 text-red-500' : (type === 'restore' ? 'bg-blue-50 text-base-primary-500' : 'bg-orange-50 text-orange-500')}`}>
          {isDelete ? <Trash2 size={28} /> : (type === 'restore' ? <RotateCcw size={28} /> : <Archive size={28} />)}
        </div>
        <h3 className="text-[20px] font-bold text-base-primary-900 mb-2">{type === 'restore' ? 'Geri Al' : 'Emin misiniz?'}</h3>
        <p className="text-[15px] text-neutral-500 leading-relaxed mb-8">
          {isBulk
            ? `Seçilen ${count ?? ''} grup kalıcı olarak silinecek. Bu işlem geri alınamaz.`
            : isDelete
              ? "Bu işlem kalıcı olarak silinecek. Bu işlem geri alınamaz."
              : type === 'restore'
                ? "Bu kayıt aktif listeye taşınacak."
                : "Bu kayıt arşive taşınacak."}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 bg-neutral-100 text-neutral-600 rounded-lg font-bold text-[14px] hover:bg-neutral-200 transition-colors cursor-pointer">Vazgeç</button>
          <button onClick={onConfirm} className={`flex-1 h-12 text-white rounded-lg font-bold text-[14px] transition-all active:scale-95 cursor-pointer ${isDelete ? 'bg-red-500' : (type === 'restore' ? 'bg-base-primary-500' : 'bg-[#FF8D28]')}`}>
            {isDelete ? "Sil" : (type === 'restore' ? "Geri Al" : "Arşive Taşı")}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteModalProps {
  isOpen: boolean;
  type?: 'delete' | 'graduate';
  onClose: () => void;
  onConfirm: () => void;
}

export const StudentDeleteModal: React.FC<DeleteModalProps> = ({ isOpen, type = 'delete', onClose, onConfirm }) => {
  if (!isOpen) return null;
  const isGraduate = type === 'graduate';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl p-8 max-w-[400px] w-full shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${isGraduate ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
          {isGraduate ? <GraduationCap size={32} /> : <Trash2 size={32} />}
        </div>
        <h3 className="text-[20px] font-bold text-neutral-800 mb-2">Emin misiniz?</h3>
        <p className="text-[14px] text-neutral-500 mb-8 leading-relaxed">
          {isGraduate
            ? "Bu öğrenci mezun listesine taşınacak. İstersen daha sonra aktife alabilirsin."
            : "Bu öğrenci kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz."}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all cursor-pointer">Vazgeç</button>
          <button onClick={onConfirm} className={`flex-1 h-12 text-white font-bold rounded-xl transition-all hover:opacity-90 cursor-pointer ${isGraduate ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {isGraduate ? "Mezun Et" : "SİL"}
          </button>
        </div>
      </div>
    </div>
  );
};