"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import {
  doc, getDoc, collection, query, where, getDocs,
  writeBatch, increment, updateDoc, serverTimestamp,
} from "firebase/firestore";
import {
  ArrowLeft, CheckCircle2, Users, Zap, CalendarDays, AlertTriangle,
  ClipboardList, Award, Sparkles, ChevronRight, BookOpen, Archive,
  ChevronDown, ChevronUp, Trash2, Clock, RotateCcw, Eye, EyeOff,
} from "lucide-react";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import Footer from "../../components/Footer";
import { useScoring } from "@/app/context/ScoringContext";
import { calculateXP, getLevelXP } from "@/app/lib/scoring";
import { Task, TYPE_CONFIG, TYPE_GRADIENT, getIcon } from "../../components/dashboard/taskTypes";

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface Student {
  id: string; name: string; lastName: string;
  gender: "male" | "female"; avatarId?: number; groupCode: string;
}
interface GradeEntry { submitted: boolean; weeksLate: number; xp: number; }
type GradesMap = Record<string, GradeEntry>;

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}

async function loadUid(): Promise<string | null> {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user?.uid ?? null); });
  });
}

// ─── ORTAK: Ödev satırı ikon + başlık kısmı ──────────────────────────────────
function TaskMeta({ task }: { task: Task }) {
  const cfg  = TYPE_CONFIG[task.type ?? "odev"];
  const grad = TYPE_GRADIENT[task.type ?? "odev"];
  return (
    <div className="flex items-center gap-4 flex-1 min-w-0">
      <div className={`w-10 h-10 rounded-2xl ${grad} flex items-center justify-center text-white shrink-0 shadow-sm`}>
        {getIcon(task.icon, task.type ?? "odev", 17)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[14px] font-bold text-base-primary-900 truncate">{task.name}</p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${cfg.badgeBg} ${cfg.badgeText} shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {task.classId && <span className="flex items-center gap-1 text-[11px] text-surface-400 font-medium"><Users size={10} />{task.classId}</span>}
          {task.level   && <span className="flex items-center gap-1 text-[11px] text-surface-400 font-medium"><Zap size={10} />{task.level}</span>}
          {task.endDate && <span className="flex items-center gap-1 text-[11px] text-surface-400 font-medium"><CalendarDays size={10} />{fmtDate(task.endDate)}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── PUAN SIFIRLAMA MODALI ────────────────────────────────────────────────────
function ResetPointsModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [password,    setPassword]    = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [done,        setDone]        = useState(false);
  const [visible,     setVisible]     = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleConfirm = async () => {
    if (!password.trim()) { setError("Şifrenizi girin."); return; }
    setLoading(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error("no-user");

      // Şifreyi doğrula
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);

      // Tüm öğrenci puanlarını sıfırla (500'lük batch chunk)
      const snap = await getDocs(collection(db, "students"));
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach(d => batch.update(d.ref, { points: 0 }));
        await batch.commit();
      }

      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 1500);
    } catch (e: any) {
      const code = e?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Şifre hatalı. Lütfen tekrar deneyin.");
      } else if (e?.message === "no-user") {
        setError("Oturum bilgisi alınamadı.");
      } else {
        setError("Bir hata oluştu. Tekrar deneyin.");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className={`fixed inset-0 z-800 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-16 shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>

        {/* İkon + Başlık */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-status-danger-50 border border-status-danger-500/20 flex items-center justify-center">
            <RotateCcw size={20} className="text-status-danger-500" />
          </div>
          <div>
            <p className="text-[17px] font-bold text-base-primary-900">Tüm Puanları Sıfırla</p>
            <p className="text-[13px] text-surface-400 mt-1">
              Sistemdeki <strong className="text-base-primary-700">tüm öğrencilerin</strong> puanı 0'a çekilecek. Bu işlem geri alınamaz.
            </p>
          </div>
        </div>

        {done ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <CheckCircle2 size={16} className="text-status-success-500" />
            <span className="text-[14px] font-bold text-status-success-500">Tüm puanlar sıfırlandı.</span>
          </div>
        ) : (
          <>
            {/* Şifre */}
            <div>
              <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Giriş Şifreniz</p>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleConfirm()}
                  placeholder="Şifrenizi girin"
                  className="w-full h-12 px-4 pr-11 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 cursor-pointer"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-[12px] text-status-danger-500 font-medium mt-1.5">{error}</p>}
            </div>

            {/* Butonlar */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !password.trim()}
                className="flex-1 h-11 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : "Sıfırla"
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── TAB LISTESI (Bekleyen + Tamamlananlar) ───────────────────────────────────
type ListTab = "pending" | "done";

function GradingTabs() {
  const router = useRouter();
  const [tab,          setTab]          = useState<ListTab>("pending");
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [detailMap,    setDetailMap]    = useState<Record<string, Student[]>>({});
  const [archivingId,  setArchivingId]  = useState<string | null>(null);
  const [showReset,    setShowReset]    = useState(false);

  useEffect(() => {
    (async () => {
      const uid = await loadUid();
      if (!uid) { setLoading(false); return; }
      try {
        const q = query(collection(db, "tasks"), where("status", "==", "completed"));
        const snap = await getDocs(q);
        const all  = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        const mine = all.filter(t => t.ownedBy === uid || t.createdBy === uid);
        mine.sort((a, b) => {
          const aT = (a as any).createdAt?.toMillis?.() ?? 0;
          const bT = (b as any).createdAt?.toMillis?.() ?? 0;
          return bT - aT;
        });
        setTasks(mine);
      } finally { setLoading(false); }
    })();
  }, []);

  const pending = tasks.filter(t => !t.isGraded);
  const done    = tasks.filter(t => !!t.isGraded);

  // Detay genişlet — öğrencileri lazy yükle
  const toggleDetail = async (task: Task) => {
    const id = task.id;
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!detailMap[id] && task.classId) {
      const q    = query(collection(db, "students"), where("groupCode", "==", task.classId), where("status", "==", "active"));
      const snap = await getDocs(q);
      setDetailMap(p => ({ ...p, [id]: snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)) }));
    }
  };

  // Arşivle (Tamamlananlar sekmesindeki sil)
  const handleArchive = async (task: Task) => {
    setArchivingId(task.id);
    try {
      await updateDoc(doc(db, "tasks", task.id), { status: "archived", isActive: false });
      setTasks(p => p.filter(t => t.id !== task.id));
    } finally { setArchivingId(null); }
  };

  const grouped = pending.reduce<Record<string, Task[]>>((acc, t) => {
    const k = t.classId || "Grup Yok";
    (acc[k] = acc[k] || []).push(t);
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-[1000px] mx-auto px-8 py-8 space-y-6">

      {/* Başlık */}
      <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-8 py-7">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-2xl bg-base-primary-50 border border-base-primary-100 flex items-center justify-center">
                <ClipboardList size={17} className="text-base-primary-500" />
              </div>
              <span className="text-[12px] font-bold text-surface-400 uppercase tracking-widest">Not Girişi</span>
            </div>
            <h1 className="text-[26px] font-bold text-base-primary-900" style={{ letterSpacing: "-0.022em" }}>Not Yönetimi</h1>
            <p className="text-[13px] text-surface-400 mt-1">Tamamlanan ödevlere sınıf bazında not girişi yap</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {pending.length > 0 && (
              <div className="bg-designstudio-primary-50 border border-designstudio-primary-100 rounded-2xl px-5 py-3 text-center">
                <p className="text-[28px] font-bold text-designstudio-primary-600 leading-none">{pending.length}</p>
                <p className="text-[11px] text-surface-400 mt-1 font-medium">Bekleyen</p>
              </div>
            )}
            <button
              onClick={() => setShowReset(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl border border-status-danger-500/30 bg-status-danger-50 text-status-danger-500 text-[12px] font-bold hover:bg-status-danger-500 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw size={13} /> Puanları Sıfırla
            </button>
          </div>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center gap-1 bg-surface-50 w-fit p-1 rounded-[14px] border border-surface-100 shadow-sm">
        {([
          { id: "pending" as ListTab, label: "Bekleyen",      count: pending.length },
          { id: "done"    as ListTab, label: "Tamamlananlar", count: done.length    },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${
              tab === t.id
                ? "bg-white text-base-primary-900 shadow-sm border border-surface-100"
                : "text-surface-400 hover:text-surface-600 border border-transparent"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                tab === t.id
                  ? t.id === "pending" ? "bg-designstudio-primary-50 text-designstudio-primary-600" : "bg-status-success-100 text-status-success-700"
                  : "bg-surface-200 text-surface-500"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── SEKMELERİN İÇERİĞİ ── */}

      {/* BEKLEYENLEr */}
      {tab === "pending" && (
        <>
          {pending.length === 0 ? (
            <div className="bg-white rounded-16 border border-surface-100 shadow-sm flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-50 flex items-center justify-center"><BookOpen size={28} className="text-surface-200" /></div>
              <div className="text-center">
                <p className="text-[16px] font-bold text-surface-400">Bekleyen not girişi yok</p>
                <p className="text-[13px] text-surface-300 mt-1">Bir ödev "Tamamlandı" durumuna geldiğinde burada görünür.</p>
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([classId, classTasks]) => (
              <div key={classId} className="space-y-3">
                <div className="flex items-center gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-base-primary-400" />
                    <h2 className="text-[16px] font-bold text-base-primary-900">{classId}</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-lg bg-designstudio-primary-50 text-designstudio-primary-600 text-[11px] font-bold">
                    {classTasks.length} bekliyor
                  </span>
                  <div className="flex-1 h-px bg-surface-100" />
                </div>
                <div className="bg-white rounded-16 border border-surface-100 shadow-sm overflow-hidden">
                  {classTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-5 px-6 py-4 border-b border-surface-100 last:border-0 hover:bg-surface-50/60 transition-colors">
                      <TaskMeta task={task} />
                      <button
                        onClick={() => router.push(`/dashboard/grading?taskId=${task.id}`)}
                        className="flex items-center gap-2 h-9 px-5 rounded-xl bg-designstudio-primary-500 text-white text-[12px] font-bold hover:bg-designstudio-primary-600 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0"
                      >
                        Not Girişi Yap <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* TAMAMLANANLAR */}
      {tab === "done" && (
        <>
          {done.length === 0 ? (
            <div className="bg-white rounded-16 border border-surface-100 shadow-sm flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-50 flex items-center justify-center"><Archive size={28} className="text-surface-200" /></div>
              <p className="text-[16px] font-bold text-surface-400">Henüz notlandırılan ödev yok</p>
            </div>
          ) : (
            <div className="bg-white rounded-16 border border-surface-100 shadow-lg overflow-hidden">
              {/* Başlık satırı */}
              <div className="flex items-center gap-4 px-6 py-3.5 bg-surface-50 border-b border-surface-100">
                <div className="flex-1 min-w-0"><span className="text-[12px] font-bold text-surface-600">Ödev</span></div>
                <div className="w-24 shrink-0 text-center"><span className="text-[12px] font-bold text-surface-600">Teslim</span></div>
                <div className="w-24 shrink-0 text-center"><span className="text-[12px] font-bold text-surface-600">Toplam XP</span></div>
                <div className="w-36 shrink-0" />
              </div>

              {done.map(task => {
                const grades  = (task as any).grades as GradesMap | undefined;
                const submittedCount = grades ? Object.values(grades).filter(g => g.submitted).length : 0;
                const totalStudents  = grades ? Object.keys(grades).length : 0;
                const totalXP        = grades ? Object.values(grades).reduce((s, g) => s + g.xp, 0) : 0;
                const isExpanded = expandedId === task.id;
                const students   = detailMap[task.id] ?? [];

                return (
                  <div key={task.id} className="border-b border-surface-100 last:border-0">
                    {/* Ana satır */}
                    <div className="flex items-center gap-4 px-6 py-4 hover:bg-surface-50/40 transition-colors">
                      <TaskMeta task={task} />
                      <div className="w-24 shrink-0 text-center">
                        <span className="text-[13px] font-bold text-base-primary-900">{submittedCount}</span>
                        <span className="text-[12px] text-surface-300">/{totalStudents}</span>
                      </div>
                      <div className="w-24 shrink-0 text-center">
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-designstudio-primary-600">
                          <Zap size={11} className="text-designstudio-primary-500" />{totalXP}
                        </span>
                      </div>
                      <div className="w-36 shrink-0 flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleDetail(task)}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-base-primary-50 text-base-primary-600 text-[12px] font-bold hover:bg-base-primary-100 transition-all cursor-pointer"
                        >
                          Detay {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        <button
                          onClick={() => handleArchive(task)}
                          disabled={archivingId === task.id}
                          title="Arşive taşı"
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {archivingId === task.id
                            ? <div className="w-3.5 h-3.5 border-2 border-surface-200 border-t-surface-500 rounded-full animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Detay genişletme */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-surface-50/50 border-t border-surface-100">
                        {students.length === 0 && !detailMap[task.id] ? (
                          <div className="py-4 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-surface-200 border-t-base-primary-400 rounded-full animate-spin" />
                          </div>
                        ) : (
                          <div className="pt-4 space-y-2">
                            {(students.length > 0 ? students : Object.keys(grades ?? {}).map(id => ({ id } as Student))).map(student => {
                              const grade = grades?.[student.id] ?? { submitted: false, weeksLate: 0, xp: 0 };
                              const avatarSrc = student.gender ? `/avatars/${student.gender}/${student.avatarId ?? 1}.svg` : null;
                              const displayName = student.name ? `${student.name} ${student.lastName}` : student.id;

                              return (
                                <div key={student.id} className="flex items-center gap-3 bg-white rounded-12 px-4 py-2.5 border border-surface-100">
                                  {avatarSrc && (
                                    <img src={avatarSrc} alt={displayName} className="w-7 h-7 rounded-xl object-cover border border-surface-100 shrink-0"
                                      onError={e => { (e.target as HTMLImageElement).src = `/avatars/male/1.svg`; }} />
                                  )}
                                  <span className="text-[13px] font-bold text-base-primary-900 flex-1 truncate">{displayName}</span>
                                  {grade.submitted ? (
                                    <>
                                      <span className="flex items-center gap-1 text-[11px] font-bold text-status-success-600 bg-status-success-100 px-2 py-1 rounded-lg">
                                        <CheckCircle2 size={11} />Teslim
                                      </span>
                                      {grade.weeksLate > 0 && (
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#FFB020] bg-[#FFF9EB] px-2 py-1 rounded-lg">
                                          <Clock size={11} />{grade.weeksLate} hf. geç
                                        </span>
                                      )}
                                      <span className="flex items-center gap-1 text-[12px] font-bold text-designstudio-primary-600 bg-designstudio-primary-50 px-2.5 py-1 rounded-lg">
                                        <Zap size={11} className="text-designstudio-primary-500" />{grade.xp} XP
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-[11px] font-bold text-status-danger-500 bg-status-danger-50 px-2 py-1 rounded-lg">Teslim Etmedi</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {showReset && (
        <ResetPointsModal
          onCancel={() => setShowReset(false)}
          onSuccess={() => setShowReset(false)}
        />
      )}
    </div>
  );
}

// ─── NOT GİRİŞİ FORMU ────────────────────────────────────────────────────────
function GradingForm({ taskId }: { taskId: string }) {
  const router       = useRouter();
  const { settings } = useScoring();

  const [task,        setTask]        = useState<Task | null>(null);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [grades,      setGrades]      = useState<GradesMap>({});
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [gradesSaved, setGradesSaved] = useState(false);
  const [archiving,   setArchiving]   = useState(false);
  const [archived,    setArchived]    = useState(false);
  const [saveError,   setSaveError]   = useState("");

  useEffect(() => {
    (async () => {
      try {
        const taskSnap = await getDoc(doc(db, "tasks", taskId));
        if (!taskSnap.exists()) { setLoading(false); return; }
        const taskData = { id: taskSnap.id, ...taskSnap.data() } as Task;
        setTask(taskData);
        if (taskData.isGraded) setGradesSaved(true);

        if (taskData.classId) {
          const q    = query(collection(db, "students"), where("groupCode", "==", taskData.classId), where("status", "==", "active"));
          const snap = await getDocs(q);
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
          list.sort((a, b) => `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr"));
          setStudents(list);

          const existing = (taskData as any).grades ?? {};
          const init: GradesMap = {};
          list.forEach(s => { init[s.id] = existing[s.id] ?? { submitted: false, weeksLate: 0, xp: 0 }; });
          setGrades(init);
        }
      } finally { setLoading(false); }
    })();
  }, [taskId]);

  const updateGrade = (id: string, patch: Partial<GradeEntry>) => {
    setGrades(prev => {
      const next = { ...prev[id], ...patch };
      if (next.submitted) { next.xp = calculateXP(task?.level, next.weeksLate, settings); }
      else { next.xp = 0; next.weeksLate = 0; }
      return { ...prev, [id]: next };
    });
  };

  const markAll = (submitted: boolean) => {
    setGrades(prev => {
      const next = { ...prev };
      students.forEach(s => { next[s.id] = { submitted, weeksLate: 0, xp: submitted ? calculateXP(task?.level, 0, settings) : 0 }; });
      return next;
    });
  };

  const handleSaveGrades = async () => {
    if (!task) return;
    setSaving(true); setSaveError("");
    try {
      const batch = writeBatch(db);
      Object.entries(grades).forEach(([sid, g]) => {
        if (g.submitted && g.xp > 0) batch.update(doc(db, "students", sid), { points: increment(g.xp) });
      });
      batch.update(doc(db, "tasks", taskId), { isGraded: true, grades, gradedAt: serverTimestamp() });
      await batch.commit();
      setGradesSaved(true);
      setTask(p => p ? { ...p, isGraded: true } : p);
    } catch { setSaveError("Kayıt sırasında hata oluştu."); }
    finally { setSaving(false); }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await updateDoc(doc(db, "tasks", taskId), { status: "archived", isActive: false });
      setArchived(true);
      setTimeout(() => router.push("/dashboard/grading"), 2000);
    } finally { setArchiving(false); }
  };

  const submittedCount = Object.values(grades).filter(g => g.submitted).length;
  const totalXP        = Object.values(grades).reduce((s, g) => s + g.xp, 0);
  const baseXP         = task ? getLevelXP(task.level, settings) : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
    </div>
  );

  if (!task) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <AlertTriangle size={32} className="text-surface-200" />
      <p className="text-[14px] font-bold text-surface-400">Görev bulunamadı.</p>
      <button onClick={() => router.push("/dashboard/grading")} className="text-[13px] text-base-primary-500 font-bold hover:underline cursor-pointer">Listeye dön</button>
    </div>
  );

  const typeCfg = TYPE_CONFIG[task.type ?? "odev"];

  return (
    <div className="w-full max-w-[1100px] mx-auto px-8 py-8 space-y-5">

      {/* Başlık kartı */}
      <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-8 py-7">
        <div className="flex items-start gap-4 mb-6">
          <button onClick={() => router.push("/dashboard/grading")}
            className="w-10 h-10 rounded-2xl bg-surface-50 hover:bg-surface-100 border border-surface-200 flex items-center justify-center text-base-primary-600 transition-all cursor-pointer shrink-0 mt-0.5 active:scale-95">
            <ArrowLeft size={17} />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-surface-400 uppercase tracking-widest">Not Girişi</span>
            <h1 className="text-[24px] font-bold text-base-primary-900 leading-tight mt-0.5" style={{ letterSpacing: "-0.022em" }}>{task.name}</h1>
            {task.description && <p className="text-[13px] text-surface-400 mt-1 line-clamp-1">{task.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-6">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold ${typeCfg.badgeBg} ${typeCfg.badgeText}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${typeCfg.dot}`} />{typeCfg.label}
          </span>
          {task.classId && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-50 border border-surface-200 text-surface-600 text-[12px] font-bold"><Users size={11} />{task.classId}</span>}
          {task.level   && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-50 border border-surface-200 text-surface-600 text-[12px] font-bold"><Zap size={11} />{task.level}</span>}
          {task.endDate && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-50 border border-surface-200 text-surface-600 text-[12px] font-bold"><CalendarDays size={11} />{fmtDate(task.endDate)}</span>}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-designstudio-primary-50 border border-designstudio-primary-100 text-designstudio-primary-600 text-[12px] font-bold"><Sparkles size={11} />Baz XP: {baseXP}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
            <Users size={14} className="text-surface-400 mb-2.5" />
            <p className="text-[26px] font-bold text-base-primary-900 leading-none">{students.length}</p>
            <p className="text-[11px] text-surface-400 mt-1.5 font-medium">Toplam Öğrenci</p>
          </div>
          <div className={`rounded-2xl p-4 border transition-all ${submittedCount === students.length && students.length > 0 ? "bg-status-success-100 border-status-success-500/20" : "bg-surface-50 border-surface-100"}`}>
            <CheckCircle2 size={14} className="text-status-success-500 mb-2.5" />
            <p className="text-[26px] font-bold text-base-primary-900 leading-none">{submittedCount}</p>
            <p className="text-[11px] text-surface-400 mt-1.5 font-medium">Teslim Etti</p>
          </div>
          <div className="bg-designstudio-primary-50 rounded-2xl p-4 border border-designstudio-primary-100">
            <Award size={14} className="text-designstudio-primary-500 mb-2.5" />
            <p className="text-[26px] font-bold text-base-primary-900 leading-none">{totalXP}</p>
            <p className="text-[11px] text-surface-400 mt-1.5 font-medium">Dağıtılacak XP</p>
          </div>
        </div>
      </div>

      {/* Öğrenci listesi */}
      {students.length === 0 ? (
        <div className="bg-white rounded-16 border border-surface-100 shadow-sm flex flex-col items-center justify-center py-20 gap-4">
          <ClipboardList size={28} className="text-surface-200" />
          <div className="text-center">
            <p className="text-[15px] font-bold text-surface-400">Bu sınıfta öğrenci bulunamadı.</p>
            <p className="text-[12px] text-surface-300 mt-1">Ödev <strong>{task.classId}</strong> grubuyla eşleşmiyor olabilir.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-16 border border-surface-100 shadow-lg overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-3.5 bg-surface-50 border-b border-surface-100">
            <div className="w-10 shrink-0" />
            <div className="flex-1 min-w-0"><span className="text-[12px] font-bold text-surface-600">Öğrenci</span></div>
            <div className="w-52 shrink-0 flex items-center justify-between">
              <span className="text-[12px] font-bold text-surface-600">Teslim</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => markAll(true)}  className="text-[11px] font-bold text-status-success-500 hover:text-status-success-700 cursor-pointer">Tümü</button>
                <span className="text-surface-200">·</span>
                <button onClick={() => markAll(false)} className="text-[11px] font-bold text-surface-400 hover:text-surface-600 cursor-pointer">Temizle</button>
              </div>
            </div>
            <div className="w-64 shrink-0 text-center"><span className="text-[12px] font-bold text-surface-600">Gecikme</span></div>
            <div className="w-20 shrink-0 text-right"><span className="text-[12px] font-bold text-surface-600">XP</span></div>
          </div>

          {students.map(student => {
            const grade = grades[student.id] ?? { submitted: false, weeksLate: 0, xp: 0 };
            return (
              <div key={student.id} className={`flex items-center gap-4 px-6 py-4 border-b border-surface-100 last:border-0 transition-colors ${grade.submitted ? "bg-status-success-100/25" : "hover:bg-surface-50/60"}`}>
                <div className={`w-10 h-10 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${grade.submitted ? "border-status-success-500/40" : "border-surface-100"}`}>
                  <img src={`/avatars/${student.gender}/${student.avatarId ?? 1}.svg`} alt="" className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = `/avatars/${student.gender}/1.svg`; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-base-primary-900 truncate">{student.name} {student.lastName}</p>
                  <p className="text-[11px] text-surface-400">{student.groupCode}</p>
                </div>
                <div className="w-52 shrink-0 flex items-center gap-2">
                  <button onClick={() => updateGrade(student.id, { submitted: true })}
                    className={`flex-1 h-9 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${grade.submitted ? "bg-status-success-500 text-white border-status-success-500 shadow-sm" : "bg-white text-surface-400 border-surface-200 hover:border-status-success-500/50 hover:text-status-success-600"}`}>
                    Teslim Etti
                  </button>
                  <button onClick={() => updateGrade(student.id, { submitted: false })}
                    className={`flex-1 h-9 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${!grade.submitted ? "bg-status-danger-500 text-white border-status-danger-500 shadow-sm" : "bg-white text-surface-400 border-surface-200 hover:border-status-danger-500/50 hover:text-status-danger-500"}`}>
                    Etmedi
                  </button>
                </div>
                <div className="w-64 shrink-0 flex items-center gap-1.5">
                  {([
                    { v: 0, label: "Zamanında", ac: "bg-status-success-500 border-status-success-500 text-white" },
                    { v: 1, label: "1 Hafta",   ac: "bg-[#FFB020] border-[#FFB020] text-white" },
                    { v: 2, label: "2 Hafta",   ac: "bg-designstudio-primary-500 border-designstudio-primary-500 text-white" },
                    { v: 3, label: "3+ Hafta",  ac: "bg-status-danger-500 border-status-danger-500 text-white" },
                  ] as const).map(({ v, label, ac }) => (
                    <button key={v} onClick={() => grade.submitted && updateGrade(student.id, { weeksLate: v })} disabled={!grade.submitted}
                      className={`flex-1 h-8 rounded-xl text-[11px] font-bold transition-all border ${!grade.submitted ? "bg-surface-50 text-surface-200 border-surface-100 cursor-not-allowed" : grade.weeksLate === v ? `${ac} cursor-pointer shadow-sm` : "bg-white text-surface-400 border-surface-200 hover:border-surface-400 cursor-pointer"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="w-20 shrink-0 flex justify-end">
                  <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all ${grade.submitted && grade.xp > 0 ? "bg-designstudio-primary-50 text-designstudio-primary-600" : "bg-surface-100 text-surface-300"}`}>
                    <Zap size={11} className={grade.submitted && grade.xp > 0 ? "text-designstudio-primary-500" : ""} />
                    {grade.xp > 0 ? grade.xp : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alt bar */}
      {students.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-surface-100 px-6 py-4 shadow-sm gap-4">
          <div className="flex-1">
            {saveError ? (
              <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-status-danger-500" /><span className="text-[13px] font-bold text-status-danger-500">{saveError}</span></div>
            ) : archived ? (
              <div className="flex items-center gap-2 animate-in fade-in"><CheckCircle2 size={14} className="text-status-success-500" /><span className="text-[13px] font-bold text-status-success-500">Ödev arşive taşındı. Yönlendiriliyor…</span></div>
            ) : gradesSaved ? (
              <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-status-success-500" /><span className="text-[13px] font-bold text-status-success-500">Notlar kaydedildi.</span><span className="text-[13px] text-surface-400 ml-1">Ödevi arşivlemek için Tamamla'ya bas.</span></div>
            ) : (
              <p className="text-[13px] text-surface-400">
                <strong className="text-base-primary-900">{submittedCount}</strong><span className="text-surface-300">/{students.length}</span> öğrenci · Toplam <strong className="text-designstudio-primary-500">{totalXP} XP</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Notları Kaydet */}
            {!gradesSaved && (
              <button onClick={handleSaveGrades} disabled={saving}
                className="flex items-center gap-2 h-11 px-6 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40 shadow-sm">
                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Kaydediliyor…</> : <><ClipboardList size={14} />Notları Kaydet</>}
              </button>
            )}

            {/* Tamamla ve Arşivle */}
            <button onClick={handleArchive} disabled={archiving || archived || !gradesSaved}
              className="flex items-center gap-2 h-11 px-6 rounded-xl bg-designstudio-primary-500 text-white text-[13px] font-bold hover:bg-designstudio-primary-600 active:scale-95 transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-designstudio-primary-500/25">
              {archiving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />İşleniyor…</> : <><Archive size={14} />Tamamla ve Arşivle</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Router + Sayfa kabuğu ────────────────────────────────────────────────────
function GradingRouter() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  return taskId ? <GradingForm taskId={taskId} /> : <GradingTabs />;
}

export default function GradingPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter">
      <div className="h-full shrink-0"><Sidebar /></div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel="Not Girişi" />
        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" /></div>}>
            <GradingRouter />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}
