"use client";
import React, { useState } from "react";
import { PenLine, Trash2, RefreshCw, Check, Loader2, X, Mail } from "lucide-react";

type AccountStatus = "pending" | "active" | "disabled" | undefined;

interface StudentUser {
  id: string;
  name?: string;
  lastName?: string;
  email?: string;
  branch?: string;
  groupCode?: string;
  gender?: string;
  avatarId?: number;
  authUid?: string;
  accountStatus?: AccountStatus;
}

function getStatusConfig(accountStatus: AccountStatus, hasAccount: boolean) {
  if (!hasAccount) return null;

  if (accountStatus === "disabled") {
    return {
      label: "Pasif",
      badgeCls: "bg-neutral-100 text-neutral-500",
      dotCls: "bg-neutral-400",
      toggleOn: false,
      toggleCls: "bg-neutral-300",
      confirmText: "aktifleştirmek",
    };
  }
  if (accountStatus === "pending") {
    return {
      label: "Beklemede",
      badgeCls: "bg-amber-50 text-amber-700",
      dotCls: "bg-amber-400",
      toggleOn: true,
      toggleCls: "bg-amber-400",
      confirmText: "devre dışı bırakmak",
    };
  }
  return {
    label: "Aktif",
    badgeCls: "bg-green-50 text-green-600",
    dotCls: "bg-green-500",
    toggleOn: true,
    toggleCls: "bg-green-500",
    confirmText: "devre dışı bırakmak",
  };
}

/* ── Resend Confirm Modal ── */
function ResendConfirmModal({
  student,
  onConfirm,
  onClose,
}: {
  student: StudentUser;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handle = async () => {
    setState("loading");
    try {
      await onConfirm();
      setState("done");
      setTimeout(onClose, 1800);
    } catch {
      setState("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[400px] mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        {state !== "done" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-neutral-300 hover:text-neutral-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}

        {state === "done" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500">
              <Check size={24} />
            </div>
            <p className="text-[15px] font-bold text-neutral-800">Kod gönderildi!</p>
            <p className="text-[13px] text-neutral-400 text-center">
              {student.name} {student.lastName} adresine yeni aktivasyon kodu iletildi.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-[15px] font-bold text-neutral-800">Aktivasyon Kodunu Yenile</p>
                <p className="text-[12px] text-neutral-400 mt-0.5">Eski kod geçersiz sayılacak</p>
              </div>
            </div>

            <p className="text-[13px] text-neutral-600 leading-relaxed mb-6">
              <span className="font-semibold text-neutral-800">{student.name} {student.lastName}</span> adlı öğrenciye
              yeni bir aktivasyon kodu gönderilecek. Önceki kod kullanılamaz hale gelecek.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-10 rounded-xl border border-neutral-200 text-[13px] font-semibold text-neutral-500 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handle}
                disabled={state === "loading"}
                className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-bold transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {state === "loading" ? (
                  <><Loader2 size={14} className="animate-spin" /> Gönderiliyor...</>
                ) : (
                  <><RefreshCw size={14} /> Evet, Gönder</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface StudentUserTableProps {
  students: StudentUser[];
  onEdit: (student: StudentUser) => void;
  onDelete: (id: string) => void;
  onToggle: (student: StudentUser) => void;
  onResend: (student: StudentUser) => Promise<void>;
}

export const StudentUserTable = ({ students, onEdit, onDelete, onToggle, onResend }: StudentUserTableProps) => {
  const [resendTarget, setResendTarget] = useState<StudentUser | null>(null);

  return (
    <>
      {/* Resend Modal */}
      {resendTarget && (
        <ResendConfirmModal
          student={resendTarget}
          onConfirm={() => onResend(resendTarget)}
          onClose={() => setResendTarget(null)}
        />
      )}

      <div className="bg-white rounded-[24px] border border-neutral-100 overflow-hidden shadow-sm mt-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50">
              <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-64 xl:w-72">Öğrenci</th>
              <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-24 text-left">Rol</th>
              <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-40 text-left">Şube</th>
              <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-32 text-left">Sınıf</th>
              <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-52 text-left">E-Posta</th>
              <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-56 text-left">Hesap Durumu</th>
              <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-right sticky right-0 bg-neutral-50/80 backdrop-blur-sm">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {students.map((student) => {
              const hasAccount = !!student.authUid;
              const accountStatus: AccountStatus = student.accountStatus;
              const cfg = getStatusConfig(accountStatus, hasAccount);

              return (
                <tr
                  key={student.id}
                  className={`hover:bg-neutral-50/50 transition-colors group ${accountStatus === "disabled" ? "bg-neutral-50/40" : ""}`}
                >
                  <td className="p-3 xl:p-5">
                    <div className="flex items-center gap-2 xl:gap-3 min-w-0">
                      <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 shadow-sm">
                        <img
                          src={`/avatars/${student.gender === "female" ? "female" : "male"}/${student.avatarId || 1}.svg`}
                          className="w-full h-full object-cover"
                          alt=""
                          onError={(e) => { (e.target as HTMLImageElement).src = "/avatars/male/1.svg"; }}
                        />
                      </div>
                      <div className="font-bold text-[#10294C] text-[13px] xl:text-[14px] min-w-0 truncate">
                        {student.name} {student.lastName}
                      </div>
                    </div>
                  </td>

                  <td className="p-3 xl:p-5">
                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold border shadow-sm bg-purple-50 text-purple-600 border-purple-100 whitespace-nowrap">
                      Öğrenci
                    </span>
                  </td>

                  <td className="p-3 xl:p-5">
                    <span className="text-[12px] xl:text-[13px] font-semibold text-[#10294C] bg-neutral-100 px-2 xl:px-3 py-0.5 xl:py-1 rounded-lg border border-neutral-200 whitespace-nowrap inline-block">
                      {student.branch || "—"}
                    </span>
                  </td>

                  <td className="p-3 xl:p-5 text-[12px] xl:text-[13px] text-[#10294C] font-medium whitespace-nowrap">
                    {student.groupCode || "—"}
                  </td>

                  <td className="p-3 xl:p-5 text-[12px] xl:text-[13px] text-neutral-400 truncate">
                    {student.email || "—"}
                  </td>

                  <td className="p-3 xl:p-5">
                    {cfg ? (
                      <div className="flex items-center gap-2 xl:gap-3">
                        <span className={`inline-flex items-center px-2 xl:px-2.5 py-0.5 rounded-full text-[10px] xl:text-[11px] font-bold shrink-0 ${cfg.badgeCls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 xl:mr-1.5 ${cfg.dotCls}`} />
                          {cfg.label}
                        </span>
                        <button
                          type="button"
                          title={cfg.toggleOn ? "Hesabı devre dışı bırak" : "Hesabı aktifleştir"}
                          onClick={() => {
                            if (window.confirm(`${student.name} ${student.lastName} hesabını ${cfg.confirmText} istediğinize emin misiniz?`)) {
                              onToggle(student);
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${cfg.toggleCls}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cfg.toggleOn ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[12px] text-neutral-300 italic">— Kod gönderilmedi</span>
                    )}
                  </td>

                  <td className="p-3 xl:p-5 text-right sticky right-0 bg-white group-hover:bg-neutral-50/50">
                    <div className="flex justify-end gap-2">
                      {/* Kodu Yenile — sadece Beklemede, ilk sırada */}
                      {accountStatus === "pending" && (
                        <button
                          onClick={() => setResendTarget(student)}
                          title="Aktivasyon kodunu tekrar gönder"
                          className="p-1.5 xl:p-2 text-neutral-400 hover:text-amber-500 transition-colors cursor-pointer"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      <button onClick={() => onEdit(student)} className="p-1.5 xl:p-2 text-neutral-400 hover:text-orange-500 transition-colors cursor-pointer">
                        <PenLine size={16} />
                      </button>
                      <button onClick={() => onDelete(student.id)} className="p-1.5 xl:p-2 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-[13px] font-medium text-neutral-300">
                  Gösterilecek öğrenci bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
