"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import {
  doc, getDoc, collection, query, where, getDocs,
  writeBatch, deleteField, updateDoc, serverTimestamp, setDoc, onSnapshot,
} from "firebase/firestore";
import {
  ArrowLeft, CheckCircle2, Users, Zap, CalendarDays, AlertTriangle,
  ClipboardList, Award, Sparkles, ChevronRight, BookOpen, Archive,
  ChevronDown, ChevronUp, Trash2, Clock, RotateCcw, Eye, EyeOff,
  GraduationCap,
} from "lucide-react";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import { useUser } from "@/app/context/UserContext";
import { useScoring } from "@/app/context/ScoringContext";
import { calculateXP, getLevelXP, calculateLeaderboardScore, computeStudentStats, GradedTaskEntry } from "@/app/lib/scoring";
import { Task, TYPE_CONFIG, TYPE_GRADIENT, getIcon } from "../../components/dashboard/assignment/taskTypes";
import StudentDetailModal, { ModalStudent } from "../../components/dashboard/student-management/StudentDetailModal";

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface Student {
  id: string; name: string; lastName: string;
  gender: "male" | "female"; avatarId?: number; groupCode: string; groupId?: string;
}
interface GradeEntry { submitted: boolean; weeksLate: number; xp: number; }
type GradesMap = Record<string, GradeEntry>;
type ListTab = "pending" | "done";
type CertTab = "GRAFIK_1" | "GRAFIK_2";
interface Group { id: string; code: string; originalCode?: string; currentModule?: "GRAFIK_1" | "GRAFIK_2"; codeAtGrafik2?: string; }

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
// filterGroupCodes varsa sadece o sınıfların öğrencileri sıfırlanır (not girişi scope)
// filterGroupCodes yoksa tüm öğrenciler sıfırlanır (ödev yönetimi scope)
function ResetPointsModal({
  onCancel,
  onSuccess,
  filterGroupCodes,
  groupLabel,
}: {
  onCancel: () => void;
  onSuccess: () => void;
  filterGroupCodes?: string[];
  groupLabel?: string;
}) {
  const [step,     setStep]     = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);
  const [visible,  setVisible]  = useState(false);

  const { bumpSeason } = useScoring();

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };
  const isMineScope  = filterGroupCodes && filterGroupCodes.length > 0;
  const isGroupScope = isMineScope && !!groupLabel;

  const handleConfirm = async () => {
    if (!password.trim()) { setError("Şifrenizi girin."); return; }
    setLoading(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("no-user");
      if (!user.email) throw new Error("no-email");

      await signInWithEmailAndPassword(auth, user.email, password);

      let snap;
      if (isMineScope) {
        snap = await getDocs(query(
          collection(db, "students"),
          where("groupCode", "in", filterGroupCodes!.slice(0, 30)),
        ));
      } else {
        snap = await getDocs(collection(db, "students"));
      }

      if (isGroupScope) {
        // GRUP BAZLI RESET: sadece ödev puanları (gradedTasks) silinir,
        // proje notları (projectGrades) ve season dokunulmaz.
        for (let i = 0; i < snap.docs.length; i += 500) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 500).forEach(d =>
            batch.update(d.ref, { gradedTasks: deleteField(), rankChange: 0 })
          );
          await batch.commit();
        }
      } else {
        // SOFT RESET (tüm / benim sınıflarım):
        // 1. Yeni sezon başlat → yeni görevler bu sezonda kaydedilir
        // 2. isScoreHidden=true → leaderboard soft reset öncesini 0 gösterir
        await bumpSeason();
        for (let i = 0; i < snap.docs.length; i += 500) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 500).forEach(d =>
            batch.update(d.ref, { isScoreHidden: true, rankChange: 0 })
          );
          await batch.commit();
        }
      }

      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 1500);
    } catch (e: any) {
      console.error("[ResetPointsModal] hata:", e);
      const code = e?.code ?? "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        setError("Şifre yanlış.");
      } else if (e?.message === "no-user") {
        setError("Oturum bilgisi alınamadı. Lütfen sayfayı yenileyip tekrar deneyin.");
      } else if (e?.message === "no-email") {
        setError("Bu işlem için email ile giriş yapmalısınız.");
      } else {
        setError("Şifre yanlış veya işlem sırasında hata oluştu.");
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

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-status-danger-50 border border-status-danger-500/20 flex items-center justify-center">
            <RotateCcw size={20} className="text-status-danger-500" />
          </div>
          <div>
            <p className="text-[17px] font-bold text-base-primary-900">
              {isGroupScope
                ? `${groupLabel} Grubunu Sıfırla`
                : isMineScope ? "Sınıflarımın Puanlarını Sıfırla" : "Tüm Puanları Sıfırla"}
            </p>
            <p className="text-[13px] text-surface-400 mt-1">
              {isGroupScope
                ? <><strong className="text-base-primary-700">{groupLabel}</strong> grubundaki öğrencilerin puanları gizlenecek.</>
                : isMineScope
                  ? <>Kendi <strong className="text-base-primary-700">sınıflarındaki</strong> öğrencilerin puanları gizlenecek.</>
                  : <>Sistemdeki <strong className="text-base-primary-700">tüm öğrencilerin</strong> puanları gizlenecek.</>
              }{" "}Veri silinmez, yalnızca gizlenir.
            </p>
          </div>
        </div>

        {done ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <CheckCircle2 size={16} className="text-status-success-500" />
            <span className="text-[14px] font-bold text-status-success-500">Tüm puanlar sıfırlandı.</span>
          </div>

        ) : step === 1 ? (
          <>
            <div className="bg-status-danger-50 rounded-xl px-4 py-3 border border-status-danger-100">
              <p className="text-[13px] text-status-danger-600">
                Bu işlem tüm öğrencilerin puanlarını gizler. Leaderboard'da herkes 0 XP görecek.
                İşlem geri alınabilir (Admin → Veri Yönetimi → Gizli Puanları Aç).
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 h-11 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-600 active:scale-95 transition-all cursor-pointer"
              >
                Devam Et →
              </button>
            </div>
          </>

        ) : (
          <>
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
            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); setPassword(""); setError(""); }}
                className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
              >
                ← Geri
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !password.trim()}
                className="flex-1 h-11 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// ─── TAB LİSTESİ (Bekleyen + Tamamlananlar) ─────────────────────────────────

function GradingTabs({ initialTab = "pending" }: { initialTab?: ListTab }) {
  const router = useRouter();
  const { user } = useUser();

  const [tab,          setTab]          = useState<ListTab>(initialTab);
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [detailMap,    setDetailMap]    = useState<Record<string, Student[]>>({});
  const [archivingId,  setArchivingId]  = useState<string | null>(null);
  const [showReset,    setShowReset]    = useState(false);
  const [resetScope,   setResetScope]   = useState<string>(""); // "" = tümü, grup kodu = sadece o grup
  const [myGroupCodes, setMyGroupCodes] = useState<string[]>([]);
  const [toast,        setToast]        = useState({ show: false, message: "" });

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  // Eğitmenin kendi grup kodlarını çek (reset scope için)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    getDocs(query(
      collection(db, "groups"),
      where("instructorId", "==", uid),
      where("status", "==", "active"),
    )).then(snap => {
      setMyGroupCodes(snap.docs.map(d => (d.data() as any).code).filter(Boolean));
    });
  }, [user?.uid]);

  useEffect(() => {
    (async () => {
      const uid = await loadUid();
      if (!uid) { setLoading(false); return; }
      try {
        const q    = query(collection(db, "tasks"), where("status", "==", "completed"));
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

  // Detay genişlet — öğrencileri lazy yükle (sadece expand butonu için)
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

  // Arşivle
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
    <div className="w-full max-w-250 mx-auto px-8 py-8 space-y-6">

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
            <div className="flex items-center rounded-xl border border-status-danger-500/30 overflow-hidden">
              <select
                value={resetScope}
                onChange={e => setResetScope(e.target.value)}
                className="h-9 pl-3 pr-7 bg-status-danger-50 text-status-danger-500 text-[12px] font-bold outline-none cursor-pointer appearance-none border-r border-status-danger-500/20"
              >
                <option value="">Tümü</option>
                {myGroupCodes.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <button
                onClick={() => setShowReset(true)}
                className="flex items-center gap-1.5 h-9 px-3 bg-status-danger-50 text-status-danger-500 text-[12px] font-bold hover:bg-status-danger-500 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw size={13} /> Puanları Sıfırla
              </button>
            </div>
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

      {/* ── BEKLEYENLEr ── */}
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

      {/* ── TAMAMLANANLAR ── */}
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
                const grades         = (task as any).grades as GradesMap | undefined;
                const submittedCount = grades ? Object.values(grades).filter(g => g.submitted).length : 0;
                const totalStudents  = grades ? Object.keys(grades).length : 0;
                const totalXP        = grades ? Object.values(grades).reduce((s, g) => s + g.xp, 0) : 0;
                const isExpanded     = expandedId === task.id;
                const students       = detailMap[task.id] ?? [];

                return (
                  <div key={task.id} className="border-b border-surface-100 last:border-0">
                    {/* Ana satır — tıklayınca not girişi formuna git */}
                    <div
                      onClick={() => router.push(`/dashboard/grading?taskId=${task.id}&from=done`)}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-surface-50/40 transition-colors cursor-pointer group"
                    >
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
                        {/* Detay genişlet */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleDetail(task); }}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-base-primary-50 text-base-primary-600 text-[12px] font-bold hover:bg-base-primary-100 transition-all cursor-pointer"
                        >
                          Detay {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {/* Arşivle */}
                        <button
                          onClick={e => { e.stopPropagation(); handleArchive(task); }}
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
                              const grade      = grades?.[student.id] ?? { submitted: false, weeksLate: 0, xp: 0 };
                              const avatarSrc  = student.gender ? `/avatars/${student.gender}/${student.avatarId ?? 1}.svg` : null;
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
          filterGroupCodes={resetScope ? [resetScope] : myGroupCodes}
          groupLabel={resetScope || undefined}
          onCancel={() => setShowReset(false)}
          onSuccess={() => { setShowReset(false); showToast(resetScope ? `${resetScope} grubu sıfırlandı` : "Tüm puanlar sıfırlandı"); }}
        />
      )}

      {/* TOAST */}
      {toast.show && (
        <div className="fixed top-12 right-12 z-200 animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white border border-surface-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-16 p-5 flex items-center gap-4 min-w-75">
            <div className="w-10 h-10 rounded-full bg-status-success-50 flex items-center justify-center text-status-success-500">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-[14px] font-bold text-text-primary">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NOT GİRİŞİ FORMU ────────────────────────────────────────────────────────
function GradingForm({ taskId, fromTab }: { taskId: string; fromTab?: ListTab }) {
  const router       = useRouter();
  const backUrl      = fromTab === "done" ? "/dashboard/grading?tab=done" : "/dashboard/grading";
  const { settings, activeSeasonId } = useScoring();

  const [task,             setTask]             = useState<Task | null>(null);
  const [students,         setStudents]         = useState<Student[]>([]);
  const [grades,           setGrades]           = useState<GradesMap>({});
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [justSaved,        setJustSaved]        = useState(false);
  const [wasAlreadyGraded, setWasAlreadyGraded] = useState(false);
  const [archiving,        setArchiving]        = useState(false);
  const [archived,         setArchived]         = useState(false);
  const [saveError,        setSaveError]        = useState("");
  const [groupModule,      setGroupModule]      = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const taskSnap = await getDoc(doc(db, "tasks", taskId));
        if (!taskSnap.exists()) { setLoading(false); return; }
        const taskData = { id: taskSnap.id, ...taskSnap.data() } as Task;
        setTask(taskData);

        // Görevi açtığımızda zaten notlandırılmış mı?
        if (taskData.isGraded) setWasAlreadyGraded(true);

        // Grubun modülünü çek (xpMultiplier fallback için)
        if ((taskData as any).groupId) {
          const groupSnap = await getDoc(doc(db, "groups", (taskData as any).groupId));
          if (groupSnap.exists()) setGroupModule((groupSnap.data() as any).module ?? null);
        }

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

  // xpMultiplier: önce task'a kayıtlı değeri kullan, yoksa grup modülünden türet
  const storedMultiplier = (task as any)?.xpMultiplier;
  const xpMultiplier = storedMultiplier != null
    ? storedMultiplier
    : ((task as any)?.module === "GRAFIK_2" && groupModule === "GRAFIK_1" ? 0.5 : 1);

  const updateGrade = (id: string, patch: Partial<GradeEntry>) => {
    setGrades(prev => {
      const next = { ...prev[id], ...patch };
      if (next.submitted) { next.xp = Math.round(calculateXP(task?.level, next.weeksLate, settings) * xpMultiplier); }
      else { next.xp = 0; next.weeksLate = 0; }
      return { ...prev, [id]: next };
    });
  };

  const markAll = (submitted: boolean) => {
    setGrades(prev => {
      const next = { ...prev };
      students.forEach(s => { next[s.id] = { submitted, weeksLate: 0, xp: submitted ? Math.round(calculateXP(task?.level, 0, settings) * xpMultiplier) : 0 }; });
      return next;
    });
  };

  // ── Not kaydet — gradedTasks haritası yaklaşımı (unique görev, exploit-proof) ──
  const handleSaveGrades = async () => {
    if (!task) return;
    setSaving(true); setSaveError("");

    const baseXP = Math.round(getLevelXP(task.level, settings) * xpMultiplier);

    try {
      // 1. Tüm aktif öğrencileri gradedTasks haritasıyla çek
      const allSnap = await getDocs(query(collection(db, "students"), where("status", "==", "active")));
      const allStudents = allSnap.docs.map(d => {
        const data = d.data() as any;
        const gradedTasks: Record<string, GradedTaskEntry> = data.gradedTasks ?? {};
        const isScoreHidden: boolean = data.isScoreHidden ?? false;
        const { totalXP, completedTasks, latePenaltyTotal } = computeStudentStats(gradedTasks, isScoreHidden, activeSeasonId);
        return { id: d.id, gradedTasks, isScoreHidden, totalXP, completedTasks, latePenaltyTotal };
      });

      const getScore = (xp: number, tasks: number) =>
        calculateLeaderboardScore(xp, tasks, settings);

      // 2. Eski sıralamayı hesapla
      const oldRankMap: Record<string, number> = {};
      [...allStudents]
        .sort((a, b) => {
          const diff = getScore(b.totalXP, b.completedTasks) - getScore(a.totalXP, a.completedTasks);
          return diff !== 0 ? diff : a.latePenaltyTotal - b.latePenaltyTotal;
        })
        .forEach((s, i) => { oldRankMap[s.id] = i + 1; });

      // 3. Batch: her öğrenci için gradedTasks.${taskId} SET veya DELETE
      //    Aynı görev kaç kez tamamlanırsa tek kayıt kalır — XP farm imkânsız
      const batch = writeBatch(db);
      const touchedStudents = new Set<string>();

      Object.entries(grades).forEach(([sid, g]) => {
        if (g.submitted && g.xp > 0) {
          const penalty = Math.max(baseXP - g.xp, 0);
          const entry: GradedTaskEntry = { xp: g.xp, penalty, seasonId: activeSeasonId, classId: task.classId ?? undefined, endDate: task.endDate ?? undefined };
          batch.update(doc(db, "students", sid), {
            [`gradedTasks.${taskId}`]: entry,
            isScoreHidden: false,   // yeni görev kaydedilince artık gizli değil
          });
        } else {
          batch.update(doc(db, "students", sid), {
            [`gradedTasks.${taskId}`]: deleteField(),
          });
        }
        touchedStudents.add(sid);
      });

      batch.update(doc(db, "tasks", taskId), { isGraded: true, grades, gradedAt: serverTimestamp() });
      await batch.commit();

      // 4. Yeni sıralamayı bellekte hesapla (Firestore'dan okumaya gerek yok)
      const adjStudents = allStudents.map(s => {
        const g = grades[s.id];
        const newTasks = { ...s.gradedTasks };
        if (g?.submitted && g.xp > 0) {
          newTasks[taskId] = { xp: g.xp, penalty: Math.max(baseXP - g.xp, 0), seasonId: activeSeasonId, classId: task.classId ?? undefined, endDate: task.endDate ?? undefined };
        } else {
          delete newTasks[taskId];
        }
        const { totalXP, completedTasks, latePenaltyTotal } = computeStudentStats(newTasks, false, activeSeasonId);
        return { ...s, totalXP, completedTasks, latePenaltyTotal };
      });

      const newRankMap: Record<string, number> = {};
      [...adjStudents]
        .sort((a, b) => {
          const diff = getScore(b.totalXP, b.completedTasks) - getScore(a.totalXP, a.completedTasks);
          return diff !== 0 ? diff : a.latePenaltyTotal - b.latePenaltyTotal;
        })
        .forEach((s, i) => { newRankMap[s.id] = i + 1; });

      // 5. rankChange güncelle
      const rankUpdates = allStudents.filter(s =>
        oldRankMap[s.id] !== newRankMap[s.id] || touchedStudents.has(s.id)
      );
      if (rankUpdates.length > 0) {
        const rankBatch = writeBatch(db);
        rankUpdates.slice(0, 500).forEach(s => {
          const oldR = oldRankMap[s.id] ?? allStudents.length + 1;
          const newR = newRankMap[s.id] ?? allStudents.length + 1;
          rankBatch.update(doc(db, "students", s.id), { rankChange: oldR - newR });
        });
        await rankBatch.commit();
      }

      setJustSaved(true);
      setTask(p => p ? { ...p, isGraded: true } : p);

      // İlk kez kaydediyorsa → tamamlananlar listesine git
      if (!wasAlreadyGraded) {
        setTimeout(() => router.push("/dashboard/grading?tab=done"), 900);
      }
    } catch { setSaveError("Kayıt sırasında hata oluştu."); }
    finally { setSaving(false); }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await updateDoc(doc(db, "tasks", taskId), { status: "archived", isActive: false });
      setArchived(true);
      setTimeout(() => router.push(backUrl), 2000);
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
      <button onClick={() => router.push(backUrl)} className="text-[13px] text-base-primary-500 font-bold hover:underline cursor-pointer">Listeye dön</button>
    </div>
  );

  const typeCfg = TYPE_CONFIG[task.type ?? "odev"];

  return (
    <div className="w-full max-w-275 mx-auto px-8 py-8 space-y-5">

      {/* Başlık kartı */}
      <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-8 py-7">
        <div className="flex items-start gap-4 mb-6">
          <button onClick={() => router.push(backUrl)}
            className="w-10 h-10 rounded-2xl bg-surface-50 hover:bg-surface-100 border border-surface-200 flex items-center justify-center text-base-primary-600 transition-all cursor-pointer shrink-0 mt-0.5 active:scale-95">
            <ArrowLeft size={17} />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-surface-400 uppercase tracking-widest">Not Girişi</span>
            <h1 className="text-[24px] font-bold text-base-primary-900 leading-tight mt-0.5" style={{ letterSpacing: "-0.022em" }}>{task.name}</h1>
            {task.description && <p className="text-[13px] text-surface-400 mt-1 line-clamp-1">{task.description}</p>}
          </div>
          {wasAlreadyGraded && (
            <span className="px-3 py-1.5 rounded-xl bg-status-success-100 text-status-success-700 text-[12px] font-bold flex items-center gap-1.5 shrink-0 mt-0.5">
              <CheckCircle2 size={12} /> Notlandırıldı
            </span>
          )}
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
            <button
              onClick={() => markAll(false)}
              title="Tüm notları sıfırla"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-surface-300 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer shrink-0"
            >
              <RotateCcw size={14} />
            </button>
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

      {/* ── Alt bar ── */}
      {students.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-surface-100 px-6 py-4 shadow-sm gap-4">
          <div className="flex-1">
            {saveError ? (
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-status-danger-500" />
                <span className="text-[13px] font-bold text-status-danger-500">{saveError}</span>
              </div>
            ) : archived ? (
              <div className="flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={14} className="text-status-success-500" />
                <span className="text-[13px] font-bold text-status-success-500">Ödev arşive taşındı. Yönlendiriliyor…</span>
              </div>
            ) : justSaved && !wasAlreadyGraded ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-status-success-500" />
                <span className="text-[13px] font-bold text-status-success-500">Notlar kaydedildi.</span>
                <span className="text-[13px] text-surface-400 ml-1">Tamamlananlar listesine yönlendiriliyor…</span>
              </div>
            ) : justSaved ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-status-success-500" />
                <span className="text-[13px] font-bold text-status-success-500">Notlar güncellendi.</span>
              </div>
            ) : (
              <p className="text-[13px] text-surface-400">
                <strong className="text-base-primary-900">{submittedCount}</strong>
                <span className="text-surface-300">/{students.length}</span> öğrenci · Toplam <strong className="text-designstudio-primary-500">{totalXP} XP</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Notları Kaydet — arşivlenmedikçe her zaman görünür */}
            {!archived && (
              <button
                onClick={handleSaveGrades}
                disabled={saving}
                className="flex items-center gap-2 h-11 px-6 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40 shadow-sm"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Kaydediliyor…</>
                  : <><ClipboardList size={14} />Notları Kaydet</>
                }
              </button>
            )}

            {/* Tamamla ve Arşive Gönder — sadece tamamlananlar'dan açıldığında (wasAlreadyGraded) */}
            {wasAlreadyGraded && (
              <button
                onClick={handleArchive}
                disabled={archiving || archived}
                className="flex items-center gap-2 h-11 px-6 rounded-xl bg-designstudio-primary-500 text-white text-[13px] font-bold hover:bg-designstudio-primary-600 active:scale-95 transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-designstudio-primary-500/25"
              >
                {archiving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />İşleniyor…</>
                  : <><Archive size={14} />Tamamla ve Arşive Gönder</>
                }
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SERTİFİKASYON — MODÜL SEKMESİ ──────────────────────────────────────────
function CertModuleTab({ module }: { module: CertTab }) {
  const { user } = useUser();
  const { settings } = useScoring();

  const [groups,          setGroups]          = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [students,        setStudents]        = useState<Student[]>([]);
  const [scores,          setScores]          = useState<Record<string, number | "">>({});
  const studentUnsubRef = useRef<(() => void) | undefined>(undefined);
  const [studentXPs,      setStudentXPs]      = useState<Record<string, number>>({});
  const [maxXP,           setMaxXP]           = useState(0);
  const [groupsLoading,   setGroupsLoading]   = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [showFinalize,    setShowFinalize]     = useState(false);
  const [finalizing,      setFinalizing]      = useState(false);
  const [finalized,       setFinalized]       = useState(false);
  const [detailStudent,   setDetailStudent]   = useState<ModalStudent | null>(null);

  // Grupları çek (tek seferlik)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    getDocs(query(
      collection(db, "groups"),
      where("instructorId", "==", uid),
      where("status", "==", "active"),
    )).then(async snap => {
      const rawGroups = snap.docs.map(d => ({
        id: d.id,
        code: (d.data() as any).code ?? d.id,
        // codeAt_GRAFIK_1 / codeAt_GRAFIK_2: finalize sırasında group doc'a yazılır
        originalCode: (d.data() as any)[`codeAt_${module}`] as string | undefined,
        currentModule: (d.data() as any).module as "GRAFIK_1" | "GRAFIK_2" | undefined,
        codeAtGrafik2: (d.data() as any).codeAt_GRAFIK_2 as string | undefined,
      }));

      // Eski veriler için fallback: projectGrades'deki groupCode alanından orijinal kodu çek
      const gradeSnap = await getDocs(query(
        collection(db, "projectGrades"),
        where("isFinalized", "==", true),
      ));
      const codeFromGrades: Record<string, string> = {};
      gradeSnap.docs.forEach(d => {
        const data = d.data() as any;
        if (data.module === module && data.groupId && data.groupCode) {
          codeFromGrades[data.groupId] = data.groupCode;
        }
      });

      const mergedGroups = rawGroups.map(g => ({
        ...g,
        originalCode: g.originalCode ?? codeFromGrades[g.id],
      }));

      // Modüle göre filtrele:
      // GRAFIK_1 sekmesi → tüm gruplar görünür (Grafik 2 her grubun Grafik 1 devamıdır, o yüzden Grafik 2'ye geçenler de burada listelenir)
      // GRAFIK_2 sekmesi → sadece şu an GRAFIK_2 olan VEYA daha önce GRAFIK_2 olmuş gruplar (salt Grafik-1'de kalanlar görünmez)
      const filteredGroups = mergedGroups.filter(g => {
        if (module === "GRAFIK_2") return g.currentModule === "GRAFIK_2" || !!g.codeAtGrafik2 || !!codeFromGrades[g.id];
        return true; // GRAFIK_1: hepsi göster
      });

      setGroups(filteredGroups);
      setGroupsLoading(false);
    });
  }, [user?.uid]);

  // Grup değişince proje notlarını çek + öğrenci listesini realtime dinle
  useEffect(() => {
    // Önceki öğrenci aboneliğini iptal et
    studentUnsubRef.current?.();
    studentUnsubRef.current = undefined;

    if (!selectedGroupId) { setStudents([]); setScores({}); setFinalized(false); return; }
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    setStudentsLoading(true);

    getDocs(query(
      collection(db, "projectGrades"),
      where("groupId", "==", selectedGroupId),
    )).then(gradeSnap => {
      const moduleGrades = gradeSnap.docs
        .map(d => ({ docId: d.id, ...d.data() } as any))
        .filter(d => d.module === module);

      const isAlreadyFinalized = moduleGrades.some(d => d.isFinalized === true);
      setFinalized(isAlreadyFinalized);

      const initScores: Record<string, number | ""> = {};
      moduleGrades.forEach(d => {
        if (d.studentId != null) initScores[d.studentId] = d.projectScore ?? "";
      });

      if (isAlreadyFinalized) {
        // Finalize edilmiş → öğrenci listesi dondurulmuş (projectGrades'den)
        const frozenList: Student[] = moduleGrades
          .filter(d => d.studentName)
          .map(d => ({
            id:        d.studentId,
            name:      d.studentName?.split(" ")[0] ?? "",
            lastName:  d.studentName?.split(" ").slice(1).join(" ") ?? "",
            gender:    d.gender ?? "male",
            avatarId:  d.avatarId ?? 1,
            groupCode: d.groupCode ?? group.originalCode ?? group.code,
          } as Student))
          .sort((a, b) => `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr"));
        setStudents(frozenList);
        setScores(initScores);
        setStudentsLoading(false);
      } else {
        // Finalize edilmemiş → öğrenci listesini realtime dinle
        // Yeni transfer gelen öğrenciler anında görünür
        studentUnsubRef.current = onSnapshot(
          query(
            collection(db, "students"),
            where("groupId", "==", selectedGroupId),
            where("status",  "==", "active"),
          ),
          studSnap => {
            const list = studSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as Student))
              .sort((a, b) => `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr"));
            setStudents(list);
            // Kayıtlı proje notlarını koru; yeni gelen öğrencilere boş değer ver
            setScores(prev => {
              const next: Record<string, number | ""> = {};
              list.forEach(s => {
                next[s.id] = s.id in prev ? prev[s.id] : (initScores[s.id] ?? "");
              });
              return next;
            });
            setStudentsLoading(false);
          }
        );
      }
    });

    return () => {
      studentUnsubRef.current?.();
      studentUnsubRef.current = undefined;
    };
  }, [selectedGroupId, module, groups]);

  // Realtime task aboneliği → maxXP ve studentXPs otomatik güncellenir
  useEffect(() => {
    if (!selectedGroupId) { setMaxXP(0); setStudentXPs({}); return; }
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    // originalCode: finalize öncesi grup kodunu kullan (kod değişmiş olabilir)
    const q = query(collection(db, "tasks"), where("classId", "==", group.originalCode ?? group.code));
    const unsub = onSnapshot(q, snap => {
      const moduleTasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Task))
        .filter(t => {
          // groupModule: task verilirken grubun modülü (en güvenilir)
          // module: şablon modülü (fallback — eski kayıtlar için)
          const gm = (t as any).groupModule as string | undefined;
          const tm = (t as any).module      as string | undefined;
          const moduleMatch = gm != null ? gm === module : tm === module;
          return moduleMatch && (t as any).isGraded === true && !(t as any).isCancelled;
        });

      // maxXP: her görev için ulaşılabilir max XP (xpMultiplier dahil)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const mx = moduleTasks.reduce((sum, t) =>
        sum + getLevelXP(t.level, settings) * ((t as any).xpMultiplier ?? 1), 0);
      setMaxXP(mx);

      // Her öğrencinin aldığı XP (task.grades içinden)
      const xpMap: Record<string, number> = {};
      moduleTasks.forEach(t => {
        const grades = (t as any).grades as Record<string, any> | undefined;
        if (!grades) return;
        Object.entries(grades).forEach(([sid, g]) => {
          xpMap[sid] = (xpMap[sid] ?? 0) + (g?.xp ?? 0);
        });
      });
      setStudentXPs(xpMap);
    });

    return () => unsub();
  }, [selectedGroupId, module, groups]);

  // Proje notlarını kaydet
  const handleSave = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    setSaved(false);
    try {
      const group = groups.find(g => g.id === selectedGroupId)!;
      await Promise.all(students.map(s => {
        const docId     = `${s.id}_${selectedGroupId}_${module}`;
        const ps        = scores[s.id];
        // finalNote ve odevPuani her zaman güncel hesaplanır —
        // finalize sonrası not değişirse de doğru değer Firestore'a yazılır
        const odevPuani = maxXP > 0 ? (studentXPs[s.id] ?? 0) / maxXP * 30 : 0;
        const finalNote = ps !== "" && ps != null
          ? Number(ps) * 0.7 + odevPuani
          : null;
        return setDoc(doc(db, "projectGrades", docId), {
          studentId:    s.id,
          groupId:      selectedGroupId,
          groupCode:    group.code,
          module,
          projectScore: ps === "" ? null : Number(ps),
          odevPuani:    parseFloat(odevPuani.toFixed(2)),
          finalNote:    finalNote != null ? parseFloat(finalNote.toFixed(2)) : null,
          updatedAt:    serverTimestamp(),
        }, { merge: true });
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  // Modülü bitir: nihai notları hesapla ve kaydet
  const handleFinalize = async () => {
    if (!selectedGroupId) return;
    const group = groups.find(g => g.id === selectedGroupId)!;
    setFinalizing(true);
    try {
      await Promise.all(students.map(s => {
        const odevPuani = maxXP > 0 ? (studentXPs[s.id] ?? 0) / maxXP * 30 : 0;
        const ps        = scores[s.id];
        const finalNote = ps !== "" && ps != null
          ? Number(ps) * 0.7 + odevPuani
          : null;
        const docId = `${s.id}_${selectedGroupId}_${module}`;
        return setDoc(doc(db, "projectGrades", docId), {
          studentId:    s.id,
          studentName:  `${s.name} ${s.lastName}`,
          gender:       s.gender ?? "male",
          avatarId:     s.avatarId ?? 1,
          groupId:      selectedGroupId,
          groupCode:    group.code,
          module,
          projectScore: ps === "" ? null : Number(ps),
          odevPuani:    parseFloat(odevPuani.toFixed(2)),
          finalNote:    finalNote != null ? parseFloat(finalNote.toFixed(2)) : null,
          isFinalized:  true,
          finalizedAt:  serverTimestamp(),
        }, { merge: true });
      }));
      // Grup dokümanına finalize anındaki kodu kaydet (gelecekte kod değişse bile orijinal bilinsin)
      await updateDoc(doc(db, "groups", selectedGroupId), {
        [`codeAt_${module}`]: group.code,
      });
      setFinalized(true);
      setShowFinalize(false);
    } finally { setFinalizing(false); }
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const moduleLabel   = module === "GRAFIK_1" ? "Grafik 1" : "Grafik 2";

  const getOdevPuani = (studentId: string) =>
    maxXP > 0 ? (studentXPs[studentId] ?? 0) / maxXP * 30 : 0;

  const getFinalNot = (studentId: string): number | null => {
    const ps = scores[studentId];
    if (ps === "" || ps == null) return null;
    return Number(ps) * 0.7 + getOdevPuani(studentId);
  };

  return (
    <div className="space-y-6">
      {/* Grup seçimi */}
      <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-8 py-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <label className="text-[12px] font-bold text-surface-500 uppercase tracking-wide block mb-2">Grup Seçimi</label>
            <div className="relative w-72">
              <select
                value={selectedGroupId}
                onChange={e => { setSelectedGroupId(e.target.value); setSaved(false); setFinalized(false); }}
                disabled={groupsLoading}
                className="w-full h-12 px-4 pr-10 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{groupsLoading ? "Yükleniyor…" : "Grup seçiniz"}</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.originalCode && g.originalCode !== g.code
                      ? `${g.originalCode} (şimdi: ${g.code})`
                      : g.code}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
            </div>
          </div>
        </div>
        {selectedGroupId && !studentsLoading && (
          <p className="text-[12px] text-surface-400 mt-3">
            Max XP: <strong className="text-base-primary-900">{maxXP}</strong>
            {maxXP === 0 && <span className="ml-2 text-surface-400">— Bu modüle ait notlandırılmış ödev yok</span>}
          </p>
        )}
      </div>

      {/* Öğrenci tablosu */}
      {selectedGroupId && (
        studentsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-16 border border-surface-100 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <Users size={24} className="text-surface-200" />
            <p className="text-[14px] font-bold text-surface-400">Bu grupta aktif öğrenci bulunamadı.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-16 border border-surface-100 shadow-sm overflow-hidden">
              {/* Tablo başlığı */}
              <div className="flex items-center gap-4 px-6 py-3.5 bg-surface-50 border-b border-surface-100">
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-bold text-surface-600">Öğrenci Adı</span>
                </div>
                <div className="w-36 shrink-0 text-center">
                  <span className="text-[13px] font-bold text-surface-600">Proje Notu</span>
                  <span className="block text-[11px] text-surface-400 font-medium">× 0.70</span>
                </div>
                <div className="w-28 shrink-0 text-center">
                  <span className="text-[13px] font-bold text-surface-600">Ödev Puanı</span>
                  <span className="block text-[11px] text-surface-400 font-medium">/ 30</span>
                </div>
                <div className="w-28 shrink-0 text-center">
                  <span className="text-[13px] font-bold text-surface-600">Toplam Not</span>
                  <span className="block text-[11px] text-surface-400 font-medium">/ 100</span>
                </div>
              </div>

              {/* Satırlar */}
              {students.map(s => {
                const odevPuani = getOdevPuani(s.id);
                const finalNot  = getFinalNot(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-4 px-6 py-3.5 border-b border-surface-100 last:border-0 hover:bg-base-primary-50/40 transition-colors cursor-pointer" onClick={() => setDetailStudent({ id: s.id, name: s.name, lastName: s.lastName, rank: 0, score: 0, groupCode: s.groupCode, gender: s.gender, avatarId: s.avatarId })}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-2xl overflow-hidden shrink-0 border border-surface-100">
                        <img
                          src={`/avatars/${s.gender}/${s.avatarId ?? 1}.svg`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).src = `/avatars/${s.gender}/1.svg`; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-base-primary-900 truncate">{s.name} {s.lastName}</p>
                        <p className="text-[12px] text-surface-400">{s.groupCode}</p>
                      </div>
                    </div>

                    {/* Proje Notu input */}
                    <div className="w-36 shrink-0 flex justify-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scores[s.id] ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          setScores(prev => ({ ...prev, [s.id]: val === "" ? "" : Math.min(100, Math.max(0, Number(val))) }));
                        }}
                        placeholder="—"
                        className="w-20 h-10 text-center rounded-xl border border-surface-200 bg-surface-50 text-[14px] font-bold text-base-primary-900 outline-none focus:border-base-primary-500 focus:bg-white transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>

                    {/* Ödev Puanı */}
                    <div className="w-28 shrink-0 text-center">
                      {maxXP > 0
                        ? <span className="text-[15px] font-bold text-base-primary-900">{odevPuani.toFixed(2)}</span>
                        : <span className="text-[14px] text-surface-300">—</span>
                      }
                    </div>

                    {/* Toplam Not */}
                    <div className="w-28 shrink-0 text-center">
                      {finalNot != null
                        ? <span className={`text-[15px] font-bold ${finalNot >= 50 ? "text-status-success-600" : "text-status-danger-500"}`}>{finalNot.toFixed(2)}</span>
                        : <span className="text-[14px] text-surface-300">—</span>
                      }
                    </div>
                  </div>
                );
              })}

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 bg-surface-50 border-t border-surface-100">
                <p className="text-[13px] text-surface-400">
                  <strong className="text-base-primary-900">{students.length}</strong> öğrenci · {selectedGroup?.code}
                </p>
                <div className="flex items-center gap-3">
                  {saved && (
                    <div className="flex items-center gap-1.5 text-status-success-500 animate-in fade-in">
                      <CheckCircle2 size={14} />
                      <span className="text-[13px] font-bold">Kaydedildi.</span>
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 h-11 px-6 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40 shadow-sm"
                  >
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Kaydediliyor…</>
                      : <><ClipboardList size={14} />Notları Kaydet</>
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Bitirme kartı */}
            <div className={`rounded-16 border px-8 py-6 flex items-center justify-between ${finalized ? "bg-status-success-50 border-status-success-200" : "bg-white border-surface-100 shadow-sm"}`}>
              <div>
                <p className="text-[14px] font-bold text-base-primary-900">
                  {finalized ? `${moduleLabel} tamamlandı` : `${moduleLabel} Modülünü Bitir`}
                </p>
                <p className="text-[12px] text-surface-400 mt-0.5">
                  {finalized
                    ? "Nihai notlar hesaplanıp kaydedildi."
                    : "Nihai notları hesaplayıp Firestore'a kalıcı olarak kaydeder."}
                </p>
              </div>
              {finalized ? (
                <div className="flex items-center gap-2 text-status-success-600">
                  <CheckCircle2 size={20} />
                  <span className="text-[13px] font-bold">Tamamlandı</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowFinalize(true)}
                  className="flex items-center gap-2 h-11 px-6 rounded-xl bg-designstudio-secondary-500 text-white text-[13px] font-bold hover:bg-designstudio-secondary-600 active:scale-95 transition-all cursor-pointer shadow-lg shadow-designstudio-secondary-500/25"
                >
                  <GraduationCap size={15} />{moduleLabel} Bitir
                </button>
              )}
            </div>
          </>
        )
      )}

      {/* Finalize onay modalı */}
      {showFinalize && (
        <div className="fixed inset-0 z-600 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-base-primary-900/40 backdrop-blur-md" onClick={() => setShowFinalize(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-designstudio-secondary-50 border border-designstudio-secondary-100 flex items-center justify-center mb-5">
              <GraduationCap size={22} className="text-designstudio-secondary-500" />
            </div>
            <h3 className="text-[18px] font-bold text-base-primary-900 mb-2">{moduleLabel} Modülünü Bitir</h3>
            <p className="text-[13px] text-surface-500 mb-6">
              <strong>{students.length}</strong> öğrenci için nihai notlar hesaplanacak ve Firestore'a kaydedilecek.
              Daha sonra "Notları Kaydet" ile güncelleme yapılabilir.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinalize(false)}
                className="flex-1 h-11 rounded-xl border border-surface-200 text-surface-500 text-[13px] font-bold hover:border-surface-400 transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="flex-1 h-11 rounded-xl bg-designstudio-secondary-500 text-white text-[13px] font-bold hover:bg-designstudio-secondary-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {finalizing
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />İşleniyor…</>
                  : "Onayla ve Bitir"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentDetailModal
        student={detailStudent}
        isOpen={!!detailStudent}
        onClose={() => setDetailStudent(null)}
      />
    </div>
  );
}

// ─── SERTİFİKASYON PANELİ ────────────────────────────────────────────────────
function CertificationPanel() {
  const [certTab, setCertTab] = useState<CertTab>("GRAFIK_1");

  return (
    <div className="w-full max-w-250 mx-auto px-8 py-8 space-y-6">
      {/* Başlık */}
      <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-8 py-7">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-2xl bg-base-primary-50 border border-base-primary-100 flex items-center justify-center">
                <GraduationCap size={17} className="text-base-primary-500" />
              </div>
              <span className="text-[12px] font-bold text-surface-400 uppercase tracking-widest">Sertifikasyon</span>
            </div>
            <h1 className="text-[26px] font-bold text-base-primary-900" style={{ letterSpacing: "-0.022em" }}>Proje Notları</h1>
            <p className="text-[13px] text-surface-400 mt-1">Modül bazında proje notlarını gir</p>
          </div>
        </div>

        {/* İç sekmeler */}
        <div className="flex items-center gap-1 bg-surface-100/60 w-fit p-1 rounded-[14px] border border-surface-100 mt-6">
          {([
            { id: "GRAFIK_1" as CertTab, label: "Grafik 1" },
            { id: "GRAFIK_2" as CertTab, label: "Grafik 2" },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setCertTab(t.id)}
              className={`px-6 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${
                certTab === t.id
                  ? "bg-white text-base-primary-900 shadow-sm border border-surface-100"
                  : "text-surface-400 hover:text-surface-600 border border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <CertModuleTab key={certTab} module={certTab} />
    </div>
  );
}

// ─── Router + Sayfa kabuğu ────────────────────────────────────────────────────
function GradingRouter() {
  const searchParams = useSearchParams();
  const router    = useRouter();
  const taskId    = searchParams.get("taskId");
  const tabParam  = searchParams.get("tab") as ListTab | null;
  const fromParam = searchParams.get("from") as ListTab | null;
  const section   = searchParams.get("section");

  if (taskId) {
    return <GradingForm taskId={taskId} fromTab={fromParam === "done" ? "done" : "pending"} />;
  }

  return (
    <>
      {/* Üst bölüm sekmeleri */}
      <div className="w-full max-w-250 mx-auto px-8 pt-8">
        <div className="flex items-center gap-1 bg-surface-50 w-fit p-1 rounded-[14px] border border-surface-100 shadow-sm">
          {([
            { id: null,            label: "Not Girişi",    icon: <ClipboardList size={13} /> },
            { id: "certification", label: "Sertifikasyon", icon: <GraduationCap size={13} /> },
          ] as const).map(t => {
            const isActive = t.id === null ? !section : section === t.id;
            return (
              <button
                key={String(t.id)}
                onClick={() => router.push(t.id ? `/dashboard/grading?section=${t.id}` : "/dashboard/grading")}
                className={`flex items-center gap-2 px-5 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-base-primary-900 shadow-sm border border-surface-100"
                    : "text-surface-400 hover:text-surface-600 border border-transparent"
                }`}
              >
                {t.icon}{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {section === "certification"
        ? <CertificationPanel />
        : <GradingTabs initialTab={tabParam === "done" ? "done" : "pending"} />
      }
    </>
  );
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
