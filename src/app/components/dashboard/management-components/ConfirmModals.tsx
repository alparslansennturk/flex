import React from "react";
import { AlertTriangle, RotateCcw, Archive, Trash2 } from "lucide-react";

interface ConfirmModalsProps {
  modalType: 'archive' | 'delete' | 'restore' | null;
  isProcessing: boolean;
  closeModal: () => void;
  confirmAction: () => void;
}

export const ConfirmModals: React.FC<ConfirmModalsProps> = ({
  modalType,
  isProcessing,
  closeModal,
  confirmAction
}) => {
  if (!modalType) return null;

  const content = {
    archive: {
      icon: <Archive className="text-amber-500" size={24} />,
      title: "Grubu Bitir",
      desc: "Grup arşive taşınacak ve içindeki tüm öğrenciler mezun listesine alınacak. Arşivden geri alabilirsiniz.",
      btn: "Grubu Bitir",
      color: "bg-amber-500 hover:bg-amber-600"
    },
    delete: {
      icon: <Trash2 className="text-red-500" size={24} />,
      title: "Grubu Sil",
      desc: "Bu işlem geri alınamaz. Grup ve tüm verileri kalıcı olarak silinecek. Emin misiniz?",
      btn: "Kalıcı Olarak Sil",
      color: "bg-red-500 hover:bg-red-600"
    },
    restore: {
      icon: <RotateCcw className="text-base-primary-600" size={24} />,
      title: "Grubu Geri Yükle",
      desc: "Grup tekrar aktif hale getirilecek ve mezun listesindeki öğrencileri gruba geri dönecek. Emin misiniz?",
      btn: "Geri Yükle",
      color: "bg-base-primary-600 hover:bg-base-primary-700"
    }
  }[modalType];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-50 flex items-center justify-center mb-4">
            {content.icon}
          </div>
          <h3 className="text-lg font-bold text-neutral-800 mb-2">{content.title}</h3>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">{content.desc}</p>
          
          <div className="flex w-full gap-3">
            <button
              onClick={closeModal}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-100 text-neutral-600 font-bold text-sm hover:bg-neutral-200 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={confirmAction}
              disabled={isProcessing}
              className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 ${content.color}`}
            >
              {isProcessing ? "İşleniyor..." : content.btn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};