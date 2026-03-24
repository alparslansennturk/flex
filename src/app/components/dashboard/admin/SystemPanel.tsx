"use client";

import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, writeBatch,
  addDoc, serverTimestamp, doc, deleteDoc, limit,
  where, updateDoc,
} from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/app/lib/firebase";
import { useScoring } from "@/app/context/ScoringContext";
import {
  Database, Flame, RotateCcw, ShieldAlert, Check,
  AlertTriangle, Eye, EyeOff, Trash2, Plus,
} from "lucide-react";

// ─── Yardımcı ────────────────────────────────────────────────────────────────
async function deleteCollection(colName: string) {
  const snap = await getDocs(collection(db, colName));
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

function fmt(ts: any) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Modal: Puan Sıfırla ─────────────────────────────────────────────────────
function HardResetModal({ onCancel, onSuccess, seasonId }: {
  onCancel: () => void; onSuccess: () => void; seasonId: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleReset = async () => {
    if (!password.trim()) { setError("Şifrenizi girin."); return; }
    setLoading(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error("no-user");
      await signInWithEmailAndPassword(auth, user.email, password);
      const allSnap = await getDocs(collection(db, "students"));
      const backupRef = await addDoc(collection(db, "scores_backup"), {
        createdAt: serverTimestamp(), createdBy: user.uid,
        studentCount: allSnap.docs.length, seasonId,
      });
      for (let i = 0; i < allSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        allSnap.docs.slice(i, i + 500).forEach(d => {
          const data = d.data() as any;
          batch.set(doc(collection(db, "scores_backup_entries")), {
            backupId: backupRef.id, studentId: d.id,
            gradedTasks: data.gradedTasks ?? {}, isScoreHidden: data.isScoreHidden ?? false,
          });
        });
        await batch.commit();
      }
      const allBackups = await getDocs(query(collection(db, "scores_backup"), orderBy("createdAt", "desc")));
      for (const old of allBackups.docs.slice(5)) {
        const oldEntries = await getDocs(query(collection(db, "scores_backup_entries"), where("backupId", "==", old.id)));
        const b = writeBatch(db);
        oldEntries.docs.forEach(e => b.delete(e.ref));
        b.delete(old.ref);
        await b.commit();
      }
      for (let i = 0; i < allSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        allSnap.docs.slice(i, i + 500).forEach(d =>
          batch.update(d.ref, { gradedTasks: {}, isScoreHidden: false, rankChange: 0 })
        );
        await batch.commit();
      }
      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch (e: any) {
      const code = e?.code ?? "";
      if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login"))
        setError("Şifre hatalı.");
      else if (e?.message === "no-user") setError("Oturum bilgisi bulunamadı.");
      else setError("Hata oluştu.");
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} onClose={handleCancel}>
      {done ? <SuccessView text="Puanlar sıfırlandı" /> : step === 1 ? (
        <>
          <ModalHeader icon={<Flame size={20} className="text-status-danger-500" />} iconBg="bg-status-danger-50"
            title="Puan Sıfırlama" sub="Tüm öğrenci puanları silinecek — otomatik yedek oluşturulur" />
          <p className="text-[13px] text-surface-500 leading-relaxed">
            Bu işlem geri alınamaz. İşlem öncesi otomatik puan yedeği oluşturulur.
          </p>
          <ModalActions onCancel={handleCancel} onConfirm={() => setStep(2)} confirmLabel="Devam Et" danger />
        </>
      ) : (
        <>
          <p className="text-[15px] font-bold text-base-primary-900">Kimliğinizi doğrulayın</p>
          <div className="relative">
            <input type={showPw ? "text" : "password"} placeholder="Şifreniz" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && password.trim() && handleReset()}
              className="w-full h-11 rounded-xl border border-surface-200 px-4 pr-10 text-[14px] outline-none focus:border-base-primary-400" />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 cursor-pointer">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <ErrorBanner text={error} />}
          <ModalActions onCancel={handleCancel} onConfirm={handleReset}
            confirmLabel="Sıfırla" danger disabled={!password.trim() || loading} loading={loading} />
        </>
      )}
    </Modal>
  );
}

// ─── Modal: Puan Yedeği Geri Yükle ───────────────────────────────────────────
function RestoreModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    getDocs(query(collection(db, "scores_backup"), orderBy("createdAt", "desc"), limit(5)))
      .then(s => setBackups(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setError("Yedek bilgisi yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);
  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleRestore = async (backupId: string) => {
    setApplying(backupId); setError("");
    try {
      const snap = await getDocs(query(collection(db, "scores_backup_entries"), where("backupId", "==", backupId)));
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach(d => {
          const data = d.data() as any;
          batch.update(doc(db, "students", data.studentId), {
            gradedTasks: data.gradedTasks ?? {}, isScoreHidden: data.isScoreHidden ?? false, rankChange: 0,
          });
        });
        await batch.commit();
      }
      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch { setError("Geri yükleme sırasında hata oluştu."); }
    finally { setApplying(null); }
  };

  return (
    <Modal visible={visible} onClose={handleCancel}>
      {done ? <SuccessView text="Yedek geri yüklendi" /> : (
        <>
          <ModalHeader icon={<RotateCcw size={18} className="text-base-primary-500" />} iconBg="bg-base-primary-50"
            title="Puan Yedeği Geri Yükle" sub="Son 5 yedek listeleniyor" />
          {error && <ErrorBanner text={error} />}
          {loading
            ? <div className="flex justify-center py-6"><span className="w-6 h-6 border-2 border-base-primary-200 border-t-base-primary-500 rounded-full animate-spin" /></div>
            : backups.length === 0
              ? <p className="text-[13px] text-surface-400 text-center py-4">Kayıtlı yedek bulunamadı</p>
              : <div className="flex flex-col gap-2">
                {backups.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-surface-100 bg-surface-50">
                    <div>
                      <p className="text-[13px] font-bold text-base-primary-900">{fmt(b.createdAt)}</p>
                      <p className="text-[11px] text-surface-400">{b.studentCount} öğrenci{b.seasonId ? ` · ${b.seasonId}` : ""}</p>
                    </div>
                    <button onClick={() => handleRestore(b.id)} disabled={!!applying}
                      className="h-8 px-4 rounded-lg bg-base-primary-500 text-white text-[12px] font-bold hover:bg-base-primary-600 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
                      {applying === b.id ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><RotateCcw size={11} /> Uygula</>}
                    </button>
                  </div>
                ))}
              </div>}
          <button onClick={handleCancel} className="h-10 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">Kapat</button>
        </>
      )}
    </Modal>
  );
}

// ─── Modal: Gizli Puanları Aç ─────────────────────────────────────────────────
function UnhideModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const { revertSeason } = useScoring();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleUnhide = async () => {
    setLoading(true); setError("");
    try {
      const snap = await getDocs(query(collection(db, "students"), where("isScoreHidden", "==", true)));
      if (!snap.empty) {
        for (let i = 0; i < snap.docs.length; i += 500) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 500).forEach(d => batch.update(d.ref, { isScoreHidden: false }));
          await batch.commit();
        }
      }
      await revertSeason();
      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch { setError("İşlem sırasında hata oluştu."); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} onClose={handleCancel}>
      {done ? <SuccessView text="Puanlar açıldı" /> : (
        <>
          <ModalHeader icon={<Eye size={18} className="text-[#FFB020]" />} iconBg="bg-[#FFF9EB]"
            title="Gizli Puanları Aç" sub="isScoreHidden=true olan tüm öğrenciler etkilenir" />
          <div className="bg-[#FFF9EB] rounded-xl p-4 border border-[#FFE8A0]">
            <p className="text-[13px] text-[#C98A00]">
              Eğitmenin "Puanları Sıfırla" işlemiyle gizlenen tüm öğrenci puanları tekrar görünür hale gelir. Herhangi bir veri silinmez.
            </p>
          </div>
          {error && <ErrorBanner text={error} />}
          <ModalActions onCancel={handleCancel} onConfirm={handleUnhide}
            confirmLabel="Puanları Aç" confirmBg="bg-[#FFB020] hover:bg-[#E09A00]" loading={loading} />
        </>
      )}
    </Modal>
  );
}

// ─── Modal: Sistem Yedeğini Geri Yükle ───────────────────────────────────────
const BACKUP_COLS = ["groups", "students", "tasks", "lottery_results", "assignment_archive"] as const;

function RestoreSystemModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [backups,   setBackups]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [applying,  setApplying]  = useState<string | null>(null);
  const [progress,  setProgress]  = useState("");
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");
  const [visible,   setVisible]   = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    getDocs(query(collection(db, "system_backups"), orderBy("createdAt", "desc"), limit(5)))
      .then(s => setBackups(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setError("Yedek listesi yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleRestore = async (backupId: string) => {
    if (!confirm("Bu yedek geri yüklenecek. Mevcut tüm veriler silinip yedeğe dönülecek. Emin misiniz?")) return;
    setApplying(backupId); setError("");
    try {
      for (const col of BACKUP_COLS) {
        setProgress(`Temizleniyor: ${col}…`);
        await deleteCollection(col);

        setProgress(`Geri yükleniyor: ${col}…`);
        const snap = await getDocs(collection(db, "system_backups", backupId, col));
        for (let i = 0; i < snap.docs.length; i += 450) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 450).forEach(d =>
            batch.set(doc(db, col, d.id), d.data())
          );
          await batch.commit();
        }
      }
      setProgress("");
      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch (e) {
      console.error(e);
      setError("Geri yükleme sırasında hata oluştu.");
      setProgress("");
    } finally { setApplying(null); }
  };

  return (
    <Modal visible={visible} onClose={handleCancel}>
      {done ? <SuccessView text="Sistem geri yüklendi" sub="Tüm veriler yedeğe döndürüldü." /> : (
        <>
          <ModalHeader
            icon={<Database size={18} className="text-base-primary-500" />}
            iconBg="bg-base-primary-50"
            title="Sistem Yedeğini Geri Yükle"
            sub="Seçilen yedek anına geri dönülür — mevcut veriler silinir"
          />
          {error && <ErrorBanner text={error} />}
          {progress && (
            <div className="flex items-center gap-3 bg-base-primary-50 rounded-xl px-4 py-3 border border-base-primary-100">
              <span className="w-4 h-4 border-2 border-base-primary-200 border-t-base-primary-500 rounded-full animate-spin shrink-0" />
              <span className="text-[13px] font-semibold text-base-primary-700">{progress}</span>
            </div>
          )}
          {loading
            ? <div className="flex justify-center py-6"><span className="w-6 h-6 border-2 border-surface-200 border-t-base-primary-400 rounded-full animate-spin" /></div>
            : backups.length === 0
              ? <p className="text-[13px] text-surface-400 text-center py-4">Kayıtlı sistem yedeği bulunamadı</p>
              : (
                <div className="flex flex-col gap-2">
                  {backups.map(b => (
                    <div key={b.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-surface-100 bg-surface-50">
                      <div>
                        <p className="text-[13px] font-bold text-base-primary-900">{fmt(b.createdAt)}</p>
                        {b.counts && (
                          <p className="text-[11px] text-surface-400 mt-0.5">
                            {b.counts.groups ?? 0} grup · {b.counts.students ?? 0} öğrenci · {b.counts.tasks ?? 0} görev
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRestore(b.id)}
                        disabled={!!applying}
                        className="h-8 px-4 rounded-lg bg-base-primary-500 text-white text-[12px] font-bold hover:bg-base-primary-600 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {applying === b.id
                          ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <><RotateCcw size={11} /> Uygula</>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
          <button onClick={handleCancel} disabled={!!applying}
            className="h-10 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer disabled:opacity-40">
            Kapat
          </button>
        </>
      )}
    </Modal>
  );
}

// ─── Modal: Sistemi Sıfırla ───────────────────────────────────────────────────
function SystemResetModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleReset = async () => {
    if (confirmText !== "SIFIRLA") return;
    setLoading(true); setError("");
    try {
      await Promise.all([
        deleteCollection("groups"), deleteCollection("students"),
        deleteCollection("tasks"), deleteCollection("lottery_results"),
        deleteCollection("assignment_archive"), deleteCollection("scores_backup"),
        deleteCollection("scores_backup_entries"),
      ]);
      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch (e) {
      console.error(e); setError("Sıfırlama sırasında hata oluştu.");
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} onClose={handleCancel} overlayColor="bg-red-900/40">
      {done ? <SuccessView text="Sistem sıfırlandı" sub="Tüm veriler silindi." /> : (
        <>
          <ModalHeader icon={<ShieldAlert size={20} className="text-red-600" />} iconBg="bg-red-50"
            title="Sistemi Sıfırla" sub={<span className="text-red-500 font-semibold">Bu işlem geri alınamaz</span>} />
          <div className="bg-red-50 rounded-xl p-4 border border-red-100 flex flex-col gap-1.5">
            <p className="text-[12px] font-bold text-red-700 mb-1">Silinecekler:</p>
            {["Tüm gruplar", "Tüm öğrenciler ve puanları", "Tüm görevler", "Tüm çekiliş sonuçları", "Tüm ödev arşivi", "Tüm puan yedekleri"].map(item => (
              <p key={item} className="text-[12px] text-red-600 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />{item}
              </p>
            ))}
            <div className="pt-2 mt-1 border-t border-red-100 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-green-400 shrink-0" />
              <p className="text-[12px] text-green-700 font-semibold">Kullanıcı hesapları (admin/eğitmen) korunur</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-surface-600">
              Onaylamak için <span className="font-black text-red-600">SIFIRLA</span> yazın:
            </p>
            <input type="text" placeholder="SIFIRLA" value={confirmText} onChange={e => setConfirmText(e.target.value)}
              className="w-full h-11 rounded-xl border border-surface-200 px-4 text-[14px] font-bold outline-none focus:border-red-400" />
          </div>
          {error && <ErrorBanner text={error} />}
          <ModalActions onCancel={handleCancel} onConfirm={handleReset}
            confirmLabel="Sistemi Sıfırla" danger disabled={confirmText !== "SIFIRLA" || loading} loading={loading} />
        </>
      )}
    </Modal>
  );
}

// ─── Ortak UI parçaları ───────────────────────────────────────────────────────
function Modal({ children, visible, onClose, overlayColor = "bg-base-primary-900/30" }: any) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 ${overlayColor} backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ icon, iconBg, title, sub }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div><p className="text-[17px] font-bold text-base-primary-900 leading-none">{title}</p><p className="text-[12px] text-surface-400 mt-0.5">{sub}</p></div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, danger, confirmBg, disabled, loading }: any) {
  const bg = confirmBg ?? (danger ? "bg-status-danger-500 hover:bg-status-danger-600" : "bg-base-primary-500 hover:bg-base-primary-600");
  return (
    <div className="flex gap-3">
      <button onClick={onCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">Vazgeç</button>
      <button onClick={onConfirm} disabled={disabled || loading}
        className={`flex-1 h-11 rounded-xl ${bg} text-white text-[13px] font-bold active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2`}>
        {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : confirmLabel}
      </button>
    </div>
  );
}

function SuccessView({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="w-14 h-14 rounded-full bg-status-success-50 flex items-center justify-center">
        <Check size={28} className="text-status-success-600" />
      </div>
      <p className="text-[16px] font-bold text-base-primary-900">{text}</p>
      {sub && <p className="text-[13px] text-surface-400 text-center">{sub}</p>}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 bg-status-danger-50 rounded-xl px-4 py-2.5 border border-status-danger-100">
      <AlertTriangle size={14} className="text-status-danger-500 shrink-0" />
      <span className="text-[13px] font-bold text-status-danger-500">{text}</span>
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({ title, description, icon, iconBg, iconColor, border, children }: any) {
  return (
    <div className={`bg-white rounded-2xl border ${border ?? "border-surface-200"} shadow-sm overflow-hidden`}>
      <div className="px-8 py-6 border-b border-surface-100 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
          {React.cloneElement(icon, { size: 20, className: iconColor })}
        </div>
        <div>
          <p className="text-[16px] font-bold text-base-primary-900 leading-none">{title}</p>
          <p className="text-[12px] text-surface-400 mt-1">{description}</p>
        </div>
      </div>
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}

// ─── Ana Panel ────────────────────────────────────────────────────────────────
export default function SystemPanel() {
  const { activeSeasonId } = useScoring();

  const [showHardReset,     setShowHardReset]     = useState(false);
  const [showRestore,       setShowRestore]       = useState(false);
  const [showUnhide,        setShowUnhide]        = useState(false);
  const [showSystemReset,   setShowSystemReset]   = useState(false);
  const [showSystemRestore, setShowSystemRestore] = useState(false);

  const [backingUp,      setBackingUp]      = useState(false);
  const [backupDone,     setBackupDone]      = useState(false);
  const [backups,        setBackups]         = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups]  = useState(true);
  const [deletingBackup, setDeletingBackup]  = useState<string | null>(null);

  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const loadBackups = () => {
    setLoadingBackups(true);
    getDocs(query(collection(db, "system_backups"), orderBy("createdAt", "desc"), limit(5)))
      .then(snap => setBackups(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .finally(() => setLoadingBackups(false));
  };

  useEffect(() => { loadBackups(); }, []);

  const handleSystemBackup = async () => {
    setBackingUp(true); setBackupDone(false);
    try {
      const user = auth.currentUser;
      const cols = ["groups", "students", "tasks", "lottery_results", "assignment_archive"];
      const counts: Record<string, number> = {};
      const backupRef = await addDoc(collection(db, "system_backups"), {
        createdAt: serverTimestamp(), createdBy: user?.uid ?? "",
      });
      for (const col of cols) {
        const snap = await getDocs(collection(db, col));
        counts[col] = snap.docs.length;
        for (let i = 0; i < snap.docs.length; i += 450) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 450).forEach(d =>
            batch.set(doc(db, "system_backups", backupRef.id, col, d.id), d.data())
          );
          await batch.commit();
        }
      }
      await updateDoc(backupRef, { counts });
      // Son 5 yedeği koru
      const allSnap = await getDocs(query(collection(db, "system_backups"), orderBy("createdAt", "desc")));
      for (const old of allSnap.docs.slice(5)) await deleteDoc(old.ref);
      setBackupDone(true);
      showToast("Sistem yedeği oluşturuldu.");
      loadBackups();
    } catch (e) {
      console.error(e); showToast("Yedekleme sırasında hata oluştu.");
    } finally { setBackingUp(false); }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm("Bu yedeği silmek istediğinize emin misiniz?")) return;
    setDeletingBackup(backupId);
    try {
      await deleteDoc(doc(db, "system_backups", backupId));
      setBackups(prev => prev.filter(b => b.id !== backupId));
    } finally { setDeletingBackup(null); }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto px-8 py-8">
      <div className="flex flex-col gap-6">

        {/* ── Satır 1: Sistem Yedekleme + Tehlikeli Bölge ─────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Sistem Yedekleme */}
          <Section
            title="Sistem Yedekleme"
            description="Tüm grup, öğrenci, görev ve arşiv verilerini yedekler — son 5 yedek saklanır"
            icon={<Database />} iconBg="bg-base-primary-50" iconColor="text-base-primary-500"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <button onClick={handleSystemBackup} disabled={backingUp}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl bg-base-primary-500 text-white text-[13px] font-bold hover:bg-base-primary-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {backingUp
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Yedekleniyor...</>
                    : backupDone
                      ? <><Check size={14} />Yedeklendi</>
                      : <><Plus size={14} />Yedek Al</>}
                </button>
                <button onClick={() => setShowSystemRestore(true)}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl border border-base-primary-200 text-base-primary-600 text-[13px] font-bold hover:bg-base-primary-50 active:scale-95 transition-all cursor-pointer">
                  <RotateCcw size={14} /> Geri Yükle
                </button>
              </div>

              {loadingBackups
                ? <div className="flex justify-center py-4"><span className="w-5 h-5 border-2 border-surface-200 border-t-base-primary-400 rounded-full animate-spin" /></div>
                : backups.length === 0
                  ? <p className="text-[13px] text-surface-400 py-2">Henüz yedek alınmadı</p>
                  : (
                    <div className="flex flex-col gap-2">
                      {backups.map(b => (
                        <div key={b.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-surface-50 border border-surface-100">
                          <div>
                            <p className="text-[13px] font-semibold text-base-primary-900">{fmt(b.createdAt)}</p>
                            {b.counts && (
                              <p className="text-[11px] text-surface-400 mt-0.5">
                                {b.counts.groups ?? 0} grup · {b.counts.students ?? 0} öğrenci · {b.counts.tasks ?? 0} görev
                              </p>
                            )}
                          </div>
                          <button onClick={() => handleDeleteBackup(b.id)} disabled={deletingBackup === b.id}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40">
                            {deletingBackup === b.id
                              ? <span className="w-3.5 h-3.5 border-2 border-surface-300 border-t-surface-500 rounded-full animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          </Section>

          {/* Tehlikeli Bölge */}
          <Section
            title="Tehlikeli Bölge"
            description="Bu işlemler geri alınamaz — dikkatli kullanın"
            icon={<ShieldAlert />} iconBg="bg-red-50" iconColor="text-red-600"
            border="border-red-200"
          >
            <div className="flex items-start justify-between gap-6 py-1">
              <div>
                <p className="text-[14px] font-bold text-base-primary-900">Sistemi Sıfırla</p>
                <p className="text-[12px] text-surface-400 mt-0.5 leading-relaxed max-w-xs">
                  Tüm gruplar, öğrenciler, puanlar, görevler ve arşiv kalıcı olarak silinir
                </p>
              </div>
              <button onClick={() => setShowSystemReset(true)}
                className="shrink-0 flex items-center gap-2 h-10 px-5 rounded-xl bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 active:scale-95 transition-all cursor-pointer shadow-sm">
                <ShieldAlert size={14} /> Sıfırla
              </button>
            </div>
          </Section>

        </div>

        {/* ── Satır 2: Puan Yönetimi — tam genişlik ───────────────────────────── */}
        <Section
          title="Puan Yönetimi"
          description="Öğrenci puanlarını sıfırla, yedeğe geri dön veya gizlenmiş puanları aç"
          icon={<Flame />} iconBg="bg-amber-50" iconColor="text-amber-500"
        >
          <div className="grid grid-cols-3 gap-4">
            <ActionCard
              icon={<Flame size={18} className="text-status-danger-500" />} iconBg="bg-status-danger-50"
              title="Puanları Sıfırla"
              desc="Tüm öğrenci puanlarını ve görev kayıtlarını kalıcı olarak siler. İşlem öncesi otomatik yedek oluşturulur."
              onClick={() => setShowHardReset(true)}
              btnLabel="Sıfırla" btnClass="text-status-danger-600 border-status-danger-200 hover:bg-status-danger-50"
            />
            <ActionCard
              icon={<RotateCcw size={18} className="text-base-primary-500" />} iconBg="bg-base-primary-50"
              title="Yedeği Geri Yükle"
              desc="Önceki bir puan yedeğini seçerek tüm öğrencilerin puanlarını o ana geri alır."
              onClick={() => setShowRestore(true)}
              btnLabel="Yedekleri Gör" btnClass="text-base-primary-600 border-base-primary-200 hover:bg-base-primary-50"
            />
            <ActionCard
              icon={<Eye size={18} className="text-[#FFB020]" />} iconBg="bg-[#FFF9EB]"
              title="Gizli Puanları Aç"
              desc="Eğitmenin 'Puanları Sıfırla' işlemiyle gizlenen öğrenci puanlarını tekrar görünür hale getirir."
              onClick={() => setShowUnhide(true)}
              btnLabel="Puanları Aç" btnClass="text-[#C98A00] border-[#FFE8A0] hover:bg-[#FFF9EB]"
            />
          </div>
        </Section>

      </div>

      {showHardReset   && <HardResetModal   seasonId={activeSeasonId} onCancel={() => setShowHardReset(false)}   onSuccess={() => { setShowHardReset(false);   showToast("Puanlar sıfırlandı."); }} />}
      {showRestore     && <RestoreModal     onCancel={() => setShowRestore(false)}     onSuccess={() => { setShowRestore(false);     showToast("Yedek geri yüklendi."); }} />}
      {showUnhide      && <UnhideModal      onCancel={() => setShowUnhide(false)}      onSuccess={() => { setShowUnhide(false);      showToast("Gizli puanlar açıldı."); }} />}
      {showSystemReset   && <SystemResetModal   onCancel={() => setShowSystemReset(false)}   onSuccess={() => { setShowSystemReset(false);   showToast("Sistem sıfırlandı."); }} />}
      {showSystemRestore && <RestoreSystemModal onCancel={() => setShowSystemRestore(false)} onSuccess={() => { setShowSystemRestore(false); showToast("Sistem geri yüklendi."); }} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-base-primary-900 text-white text-[13px] font-semibold px-5 py-3 rounded-full shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionCard({ icon, iconBg, title, desc, onClick, btnLabel, btnClass }: any) {
  return (
    <div className="flex flex-col gap-5 p-6 rounded-2xl border border-surface-100 bg-surface-50/50">
      <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="flex-1">
        <p className="text-[15px] font-bold text-base-primary-900 leading-none">{title}</p>
        <p className="text-[12px] text-surface-400 mt-2 leading-relaxed">{desc}</p>
      </div>
      <button onClick={onClick}
        className={`h-10 px-4 rounded-xl border text-[13px] font-bold transition-all cursor-pointer ${btnClass}`}>
        {btnLabel}
      </button>
    </div>
  );
}
