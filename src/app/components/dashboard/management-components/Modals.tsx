import React from "react";
import { Trash2, RotateCcw, Archive, GraduationCap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface GlobalModalProps {
  isOpen: boolean;
  type: 'archive' | 'delete' | 'restore' | 'student-delete' | 'bulk-delete' | null;
  count?: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const GlobalConfirmationModal: React.FC<GlobalModalProps> = ({ isOpen, type, count, onClose, onConfirm }) => {
  const isBulk = type === 'bulk-delete';
  const isDelete = type === 'delete' || isBulk;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-base-primary-900/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="bg-white rounded-2xl p-10 max-w-[480px] w-full shadow-2xl relative z-10"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 ${isDelete ? 'bg-red-50 text-red-500' : (type === 'restore' ? 'bg-blue-50 text-base-primary-500' : 'bg-orange-50 text-orange-500')}`}>
              {isDelete ? <Trash2 size={30} /> : (type === 'restore' ? <RotateCcw size={30} /> : <Archive size={30} />)}
            </div>
            <h3 className="text-[22px] font-bold text-base-primary-900 mb-3">{type === 'restore' ? 'Geri Al' : 'Emin misiniz?'}</h3>
            <p className="text-[15px] text-neutral-500 leading-relaxed mb-10">
              {isBulk
                ? `Seçilen ${count ?? ''} grup kalıcı olarak silinecek. Bu işlem geri alınamaz.`
                : isDelete
                  ? "Bu işlem kalıcı olarak silinecek. Bu işlem geri alınamaz."
                  : type === 'restore'
                    ? "Bu kayıt aktif listeye taşınacak."
                    : "Bu kayıt arşive taşınacak."}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-13 bg-neutral-100 text-neutral-600 rounded-xl font-bold text-[14px] hover:bg-neutral-200 transition-colors cursor-pointer">Vazgeç</button>
              <button onClick={onConfirm} className={`flex-1 h-13 text-white rounded-xl font-bold text-[14px] transition-all active:scale-95 cursor-pointer ${isDelete ? 'bg-red-500' : (type === 'restore' ? 'bg-base-primary-500' : 'bg-[#FF8D28]')}`}>
                {isDelete ? "Sil" : (type === 'restore' ? "Geri Al" : "Arşive Taşı")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface DeleteModalProps {
  isOpen: boolean;
  type?: 'delete' | 'graduate';
  onClose: () => void;
  onConfirm: () => void;
}

export const StudentDeleteModal: React.FC<DeleteModalProps> = ({ isOpen, type = 'delete', onClose, onConfirm }) => {
  const isGraduate = type === 'graduate';
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="bg-white rounded-2xl p-10 max-w-[480px] w-full shadow-2xl relative z-10 text-center"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${isGraduate ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
              {isGraduate ? <GraduationCap size={32} /> : <Trash2 size={32} />}
            </div>
            <h3 className="text-[22px] font-bold text-neutral-800 mb-3">Emin misiniz?</h3>
            <p className="text-[15px] text-neutral-500 mb-10 leading-relaxed">
              {isGraduate
                ? "Bu öğrenci mezun listesine taşınacak. İstersen daha sonra aktife alabilirsin."
                : "Bu öğrenci kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz."}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-13 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all cursor-pointer">Vazgeç</button>
              <button onClick={onConfirm} className={`flex-1 h-13 text-white font-bold rounded-xl transition-all hover:opacity-90 cursor-pointer ${isGraduate ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {isGraduate ? "Mezun Et" : "SİL"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};