"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, GraduationCap, Zap, BookOpen, Star, CalendarCheck, History, Phone, CreditCard, ArrowRight } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, documentId, orderBy } from "firebase/firestore";
import { useScoring } from "@/app/context/ScoringContext";
import { useUser } from "@/app/context/UserContext";
import { calcScore, calcStudentFinalScore, getLevelXP, computeStudentStats } from "@/app/lib/scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalStudent {
  id: string;
  name: string;
  lastName: string;
  rank: number;
  score: number;
  generalScore?: number; // lig sayfasından gelen toplam skor (herzaman toplam mod)
  points?: number;
  completedTasks?: number;
  latePenaltyTotal?: number;
  branch?: string;
  groupCode?: string;
  gender?: string;
  avatarId?: number;
  gradedTasks?: Record<string, { xp: number; penalty: number }>;
}

interface GradeData {
  groupId:      string;
  projectScore: number | null;
  odevPuani:    number;
  finalNote:    number | null;
  isFinalized:  boolean;
}

interface ModuleStats {
  taskCount: number;
  xp:        number;
  score:     number;
  maxXP:     number;
  odevPuani: number;
}

interface GradedTaskEntry {
  xp: number;
  penalty: number;
  classId?: string;
  endDate?: string;
  completedAt?: string;
  maxXp?: number;
}

interface StudentDoc {
  email?: string;
  groupCode?: string;
  groupId?: string;
  gradedTasks?: Record<string, GradedTaskEntry>;
  isScoreHidden?: boolean;
  grafik1Code?: string;
  grafik2Code?: string;
}

interface AttendanceDoc {
  entries?: Record<string, { hours: number }>;
  sessionHours?: number;
}

interface TaskDoc {
  classId?: string;
  endDate?: string;
  status?: string;
  isGraded?: boolean;
  isCancelled?: boolean;
  level?: string;
  xpMultiplier?: number;
  grades?: Record<string, { submitted: boolean; xp?: number }>;
}

interface TaskWithId extends TaskDoc { id: string; }

interface GroupDocData {
  code?: string;
  module?: string;
  instructorId?: string;
  codeAt_GRAFIK_1?: string;
  codeAt_GRAFIK_2?: string;
}

interface ProjectGradeDoc {
  projectScore?: number | null;
  odevPuani?: number;
  isFinalized?: boolean;
}

interface HistoryEntry {
  groupCode: string;
  module: string;
  startDate: string | null;
  endDate: string;
  reason: string;
}

const REASON_LABEL: Record<string, string> = {
  enrollment:      "Kayıt",
  transfer:        "Transfer",
  module_upgrade:  "Modül Yükseltme",
  graduation:      "Mezuniyet",
  cancellation:    "İptal",
};

type TabId = "ders" | "gecmis" | "iletisim" | "odeme";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ElementType;
  adminOnly: boolean;
}

const TABS: TabDef[] = [
  { id: "ders",      label: "Ders Bilgileri", icon: BookOpen,    adminOnly: false },
  { id: "gecmis",    label: "Geçmiş",         icon: History,     adminOnly: true  },
  { id: "iletisim",  label: "İletişim",       icon: Phone,       adminOnly: true  },
  { id: "odeme",     label: "Ödeme",          icon: CreditCard,  adminOnly: true  },
];

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const EMPTY_STATS: ModuleStats = { taskCount: 0, xp: 0, score: 0, maxXP: 0, odevPuani: 0 };

// ─── useCountUp — sayaç animasyonu ────────────────────────────────────────────

function useCountUp(target: number | null, active: boolean, duration = 900): number | null {
  const [display, setDisplay] = useState<number | null>(null);

  useEffect(() => {
    if (!active || target == null) { setDisplay(null); return; }
    let startTime: number | null = null;
    let raf: number;

    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(parseFloat((target * eased).toFixed(1)));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return display;
}

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, colorClass, loading }: {
  label: string; value: string | number; colorClass?: string; loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-12 border border-surface-100 p-3 text-center">
      <p className={`text-[17px] font-black tabular-nums leading-none transition-opacity duration-300 ${colorClass ?? "text-text-primary"} ${loading ? "opacity-20" : "opacity-100"}`}>
        {value}
      </p>
      <p className="text-[9px] text-surface-400 font-bold mt-1.5 leading-tight">{label}</p>
    </div>
  );
}

// ─── GradCard ─────────────────────────────────────────────────────────────────

function GradCard({ label, code, grade, odevPuaniCalc, loading, color }: {
  label: string;
  code: string;
  grade: GradeData | null;
  odevPuaniCalc: number;
  loading: boolean;
  color: "blue" | "purple";
}) {
  const blue = color === "blue";
  const s = {
    bg:    blue ? "bg-base-primary-50"      : "bg-accent-purple-100/40",
    bdr:   blue ? "border-base-primary-200" : "border-accent-purple-100",
    dot:   blue ? "bg-base-primary-500"     : "bg-accent-purple-500",
    ttl:   blue ? "text-base-primary-600"   : "text-accent-purple-600",
    big:   blue ? "text-base-primary-900"   : "text-accent-purple-700",
    sub:   blue ? "text-base-primary-400"   : "text-accent-purple-400",
    bdg:   blue ? "bg-base-primary-100 text-base-primary-600" : "bg-accent-purple-100 text-accent-purple-700",
    bar:   blue ? "bg-base-primary-500"     : "bg-accent-purple-500",
    cell:  blue ? "bg-base-primary-100/60"  : "bg-accent-purple-100/60",
  };

  const effOdev      = grade?.odevPuani ?? odevPuaniCalc;
  const finalNotePct = grade?.finalNote != null ? Math.min(100, grade.finalNote) : 0;

  // Sayaç animasyonu: yükleme bitince 0'dan finalNote'a kadar sayar
  const animatedNote = useCountUp(grade?.finalNote ?? null, !loading);

  // Yapı her zaman tam yükseklikte render edilir — yükleme sırasında değerler "—" gösterilir
  return (
    <div className={`flex-1 rounded-16 border ${s.bg} ${s.bdr} p-4 min-w-0`}>

      {/* Başlık */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
          <span className={`text-[11px] font-bold tracking-tight ${s.ttl}`}>{label}</span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-opacity duration-300 ${s.bdg} ${loading || !code ? "opacity-0" : "opacity-100"}`}>
          {code || "—"}
        </span>
      </div>

      {/* Final nota — sayaç animasyonuyla */}
      <div className="mb-2">
        <p className={`text-[28px] font-black tabular-nums leading-none ${s.big}`}>
          {loading || animatedNote == null ? "—" : Math.round(animatedNote)}
        </p>
        <p className={`text-[10px] font-semibold mt-0.5 ${s.sub}`}>Final Notu</p>
      </div>

      {/* Bar */}
      <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full ${s.bar} transition-all duration-700`}
          style={{ width: `${loading ? 0 : finalNotePct}%` }} />
      </div>

      <div className="h-px bg-surface-200 mb-3" />

      {/* Detay grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-12 px-3 py-2 ${s.cell}`}>
          <p className={`text-[14px] font-bold tabular-nums transition-opacity duration-300 ${s.big} ${loading ? "opacity-20" : "opacity-100"}`}>
            {loading ? "—" : grade?.projectScore != null ? grade.projectScore : "—"}
          </p>
          <p className={`text-[10px] font-medium ${s.sub}`}>Proje</p>
        </div>
        <div className={`rounded-12 px-3 py-2 ${s.cell}`}>
          <p className={`text-[14px] font-bold tabular-nums transition-opacity duration-300 ${s.big} ${loading ? "opacity-20" : "opacity-100"}`}>
            {loading ? "—" : effOdev}
          </p>
          <p className={`text-[10px] font-medium ${s.sub}`}>Ödev / 30</p>
        </div>
      </div>

      <div className="h-5 mt-2">
        {!loading && grade?.isFinalized && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bdg}`}>
            <GraduationCap size={9} /> Onaylandı
          </span>
        )}
      </div>
    </div>
  );
}

// ─── AttendanceDonut ──────────────────────────────────────────────────────────

function AttendanceDonut({ rate, animate }: { rate: number; animate: boolean }) {
  const [filled, setFilled] = useState(false);
  const countedRate = useCountUp(rate, animate);

  useEffect(() => {
    if (!animate) { setFilled(false); return; }
    const t = setTimeout(() => setFilled(true), 120);
    return () => clearTimeout(t);
  }, [animate]);

  const circ = 2 * Math.PI * 40;
  const color     = rate > 70 ? "#22c55e" : rate > 50 ? "#f97316" : "#ef4444";
  const textColor = rate > 70 ? "#15803d" : rate > 50 ? "#c2410c" : "#b91c1c";
  const offset    = filled ? circ - (rate / 100) * circ : circ;
  const bgStroke  = rate === 0 ? "#ef4444" : "#f1f5f9";

  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      <circle cx="56" cy="56" r="40" fill="none" stroke={bgStroke} strokeWidth="10" />
      <circle
        cx="56" cy="56" r="40"
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={String(circ)}
        strokeDashoffset={offset}
        transform="rotate(-90 56 56)"
        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
      <text x="58" y="63" textAnchor="middle" fontWeight="800" fill={textColor}>
        <tspan fontSize="15">{countedRate != null ? Math.round(countedRate) : 0}</tspan>
        <tspan fontSize="9" dy="-2" dx="1">%</tspan>
      </text>
    </svg>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function StudentDetailModal({ student, isOpen, onClose, prefetchStudentId }: {
  student: ModalStudent | null;
  isOpen: boolean;
  onClose: () => void;
  prefetchStudentId?: string | null;
}) {
  const { settings, activeSeasonId } = useScoring();
  const { isAdmin } = useUser();
  const [activeTab, setActiveTab] = useState<TabId>("ders");

  const [visible,        setVisible]        = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [email,          setEmail]          = useState("");
  const [g1Code,         setG1Code]         = useState("");
  const [g2Code,         setG2Code]         = useState("");
  const [g1Grade,        setG1Grade]        = useState<GradeData | null>(null);
  const [g2Grade,        setG2Grade]        = useState<GradeData | null>(null);
  const [g1Stats,        setG1Stats]        = useState<ModuleStats>(EMPTY_STATS);
  const [g2Stats,        setG2Stats]        = useState<ModuleStats>(EMPTY_STATS);
  const [computedScore,  setComputedScore]  = useState<number | null>(null);
  const [computedXP,     setComputedXP]     = useState<number | null>(null);
  const [computedTasks,  setComputedTasks]  = useState<number | null>(null);
  const [carryOver,      setCarryOver]      = useState(0);

  const [groupHistory,     setGroupHistory]     = useState<HistoryEntry[]>([]);

  const [attTotal,         setAttTotal]         = useState<number | null>(null);
  const [attAttended,      setAttAttended]      = useState<number | null>(null);
  const [attAbsent,        setAttAbsent]        = useState<number | null>(null);
  const [attRate,          setAttRate]          = useState<number | null>(null);
  const [attAttendedHours, setAttAttendedHours] = useState<number | null>(null);
  const [attAbsentHours,   setAttAbsentHours]   = useState<number | null>(null);

  // Hover'dan gelen ID yoksa student.id, ikisi de yoksa null
  const fetchId = student?.id ?? prefetchStudentId ?? null;

  // Visibility — sadece isOpen değişince
  useEffect(() => {
    if (isOpen) {
      setActiveTab("ders");
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // Fetch — fetchId değişince başlar (hover veya click)
  // fetchId null olunca state sıfırlanır
  useEffect(() => {
    if (!fetchId) {
      setEmail(""); setG1Code(""); setG2Code("");
      setG1Grade(null); setG2Grade(null);
      setG1Stats(EMPTY_STATS); setG2Stats(EMPTY_STATS);
      setComputedScore(null); setComputedXP(null); setComputedTasks(null); setCarryOver(0);
      setAttTotal(null); setAttAttended(null); setAttAbsent(null); setAttRate(null);
      setAttAttendedHours(null); setAttAbsentHours(null);
      setGroupHistory([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    setEmail(""); setG1Code(""); setG2Code("");
    setG1Grade(null); setG2Grade(null);
    setG1Stats(EMPTY_STATS); setG2Stats(EMPTY_STATS);
    setAttTotal(null); setAttAttended(null); setAttAbsent(null); setAttRate(null);
    setLoading(true);

    const unsubscribeStudent = onSnapshot(doc(db, "students", fetchId), async (sDoc) => {
      if (cancelled) return;
      const sData = sDoc.exists() ? (sDoc.data() as StudentDoc) : {} as StudentDoc;
      const studentEmail = sData.email ?? "";

      const groupCode = sData.groupCode ?? "";

      // Lig puanını Firestore'dan gelen gerçek gradedTasks ile hesapla
      // (prop'taki score=0 veya eski değere bağımlı olmadan)
      // KRİTİK: lig sayfasıyla aynı filtre — sadece mevcut gruba ait görevler
      const allGradedTasks = sData.gradedTasks ?? {};
      const filteredForScore = groupCode
        ? Object.fromEntries(
            Object.entries(allGradedTasks).filter(([, e]) => {
              const cid = e?.classId;
              if (!cid) return true;       // classId yoksa dahil et (eski kayıtlar)
              return cid === groupCode;
            })
          )
        : allGradedTasks;
      const { totalXP: cXP, completedTasks: cTasks } = computeStudentStats(
        filteredForScore,
        sData.isScoreHidden,
        activeSeasonId,
      );

      const groupId = sData.groupId;
      if (!groupId) {
        if (!cancelled) {
          const { finalScore: fs } = calcStudentFinalScore(cXP, cTasks, settings, undefined, 0, 0);
          setComputedScore(fs);
          setComputedXP(cXP);
          setComputedTasks(cTasks);
          setEmail(studentEmail);
          setLoading(false);
        }
        return;
      }

      // 2a. Grup geçmişini bağımsız çek
      getDocs(query(
        collection(db, "students", fetchId, "group_history"),
        orderBy("createdAt", "asc"),
      )).then(snap => {
        if (cancelled) return;
        setGroupHistory(snap.docs.map(d => d.data() as HistoryEntry));
      }).catch(() => {});

      // 2b. Yoklama sorgusunu bağımsız başlat — ana loading'i bloke etmez
      const studentId = fetchId;
      getDocs(query(collection(db, "design_attendance"), where("groupId", "==", groupId)))
        .then(attSnap => {
          if (cancelled) return;
          const lessonDocs = attSnap.docs.filter(d =>
            Object.keys((d.data() as AttendanceDoc).entries ?? {}).length > 0
          );
          const calcAttTotal = lessonDocs.length;
          const attendedDocs = lessonDocs.filter(d =>
            ((d.data() as AttendanceDoc).entries?.[studentId]?.hours ?? 0) > 0
          );
          const calcAttAttended     = attendedDocs.length;
          const calcAttAbsent       = calcAttTotal - calcAttAttended;
          const calcAttRate         = calcAttTotal > 0
            ? Math.round((calcAttAttended / calcAttTotal) * 100) : 0;
          const calcAttAttendedHours = attendedDocs.reduce(
            (s, d) => s + ((d.data() as AttendanceDoc).sessionHours ?? 0), 0
          );
          const calcAttAbsentHours  = lessonDocs
            .filter(d => ((d.data() as AttendanceDoc).entries?.[studentId]?.hours ?? 0) === 0)
            .reduce((s, d) => s + ((d.data() as AttendanceDoc).sessionHours ?? 0), 0);
          setAttTotal(calcAttTotal);
          setAttAttended(calcAttAttended);
          setAttAbsent(calcAttAbsent);
          setAttRate(calcAttRate);
          setAttAttendedHours(calcAttAttendedHours);
          setAttAbsentHours(calcAttAbsentHours);
        });

      // 3. Grup belgesi, proje notları ve G2 görevleri paralel çek
      const [gDoc, g1Doc, g2Doc, tasksSnap] = await Promise.all([
        getDoc(doc(db, "groups", groupId)),
        getDoc(doc(db, "projectGrades", `${fetchId}_${groupId}_GRAFIK_1`)),
        getDoc(doc(db, "projectGrades", `${fetchId}_${groupId}_GRAFIK_2`)),
        getDocs(query(collection(db, "tasks"), where("classId", "==", groupCode))),
      ]);

      // Birleşik task haritası: önce G2 task'larını ekle
      const combinedTasksMap: Record<string, { endDate?: string; classId?: string; status?: string }> = {};
      tasksSnap.docs.forEach(d => {
        const data = d.data() as TaskDoc;
        combinedTasksMap[d.id] = { endDate: data.endDate, classId: data.classId, status: data.status };
      });

      // G2'de olmayan gradedTask ID'lerini doğrudan çek (G1 veya silinmiş task ayrımı için)
      // Bu lig'in tasksMap'ini kopyalar: hangi task hangi sınıfa ait bilgisi tam olur
      const g2TaskIds = new Set(tasksSnap.docs.map(d => d.id));
      const unknownIds = Object.keys(allGradedTasks).filter(tid => !g2TaskIds.has(tid));
      if (unknownIds.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < unknownIds.length; i += 10) chunks.push(unknownIds.slice(i, i + 10));
        const extraSnaps = await Promise.all(
          chunks.map(ids => getDocs(query(collection(db, "tasks"), where(documentId(), "in", ids))))
        );
        extraSnaps.forEach(snap => snap.docs.forEach(d => {
          const data = d.data() as TaskDoc;
          combinedTasksMap[d.id] = { endDate: data.endDate, classId: data.classId, status: data.status };
        }));
      }

      // G1 classId'leri: lig ile aynı — sadece entry'lerde açıkça yazılı classId'ler
      const g1ClassIds = [...new Set(
        Object.values(allGradedTasks)
          .map(e => e?.classId)
          .filter((c): c is string => !!c && c !== groupCode)
      )];

      // G1 sınıflarına ait TÜM görevleri çek (öğrencinin sadece tamamladıkları değil)
      // → lig sayfasındaki assignedInMonthMulti ile eşdeğer mAssigned hesabı için
      let g1AllTasks: Array<{ endDate?: string; classId?: string; status?: string }> = [];
      if (g1ClassIds.length > 0) {
        const g1Chunks: string[][] = [];
        for (let i = 0; i < g1ClassIds.length; i += 10) g1Chunks.push(g1ClassIds.slice(i, i + 10));
        const g1Snaps = await Promise.all(
          g1Chunks.map(ids => getDocs(query(collection(db, "tasks"), where("classId", "in", ids))))
        );
        g1Snaps.forEach(snap => snap.docs.forEach(d => {
          const data = d.data() as TaskDoc;
          g1AllTasks.push({ endDate: data.endDate, classId: data.classId, status: data.status });
        }));
      }

      // ─── Lig sayfası ile birebir aynı algoritma ────────────────────────────
      const ligNow = new Date();
      const ligToday = ligNow.toISOString().split("T")[0];
      const ligCurrentMonth = `${ligNow.getFullYear()}-${String(ligNow.getMonth() + 1).padStart(2, "0")}`;

      const effectiveMonth = (ca?: string, end?: string): string | null =>
        ((end ?? ca ?? null) as string | null)?.substring(0, 7) ?? null;

      // G2 için aylık atanan görev sayısı (sadece G2 task'ları — tasksSnap)
      const countAssignedInMonth = (mStart: string, mEnd: string): number | undefined => {
        const n = tasksSnap.docs.filter(d => {
          const data = d.data() as TaskDoc;
          const st = data.status;
          const ed = data.endDate;
          return (st === "active" || st === "published" || st === "completed" || !st) &&
                 ed && ed >= mStart && ed <= mEnd;
        }).length;
        return n || undefined;
      };

      // G1 için aylık atanan görev sayısı (g1AllTasks üzerinden — tüm G1 görevleri)
      const countAssignedInMonthForCodes = (mStart: string, mEnd: string, codes: string[]): number | undefined => {
        const n = g1AllTasks.filter(t =>
          codes.includes(t.classId ?? "") &&
          (t.status === "active" || t.status === "published" || t.status === "completed" || !t.status) &&
          t.endDate && t.endDate >= mStart && t.endDate <= mEnd
        ).length;
        return n || undefined;
      };

      // g2Bonus: lig sayfası gibi G1 entry'lerden dinamik hesapla (g2StartXP değil)
      let g2Bonus = 0;
      if (g1ClassIds.length > 0) {
        const g1Entries = Object.entries(allGradedTasks).filter(([tid, e]) => {
          const cid = e?.classId;
          if (cid) return g1ClassIds.includes(cid);
          const mapCid = combinedTasksMap[tid]?.classId;
          return mapCid ? g1ClassIds.includes(mapCid) : false;
        });
        const g1ByMonth: Record<string, Array<[string, GradedTaskEntry]>> = {};
        for (const [tid, e] of g1Entries) {
          const m = effectiveMonth(e.completedAt, e.endDate ?? combinedTasksMap[tid]?.endDate);
          if (!m) continue;
          if (!g1ByMonth[m]) g1ByMonth[m] = [];
          g1ByMonth[m].push([tid, e]);
        }
        let g1TotalScore = 0;
        for (const [month, entries] of Object.entries(g1ByMonth)) {
          const mXP   = entries.reduce((s, [, e]) => s + (e.xp ?? 0), 0);
          const mComp = entries.length;
          const [y, mo] = month.split("-");
          const mStart   = `${y}-${mo}-01`;
          const mLastDay = new Date(parseInt(y), parseInt(mo), 0).getDate();
          const mEndFull = `${y}-${mo}-${String(mLastDay).padStart(2, "0")}`;
          const mAssigned = countAssignedInMonthForCodes(mStart, mEndFull, g1ClassIds);
          const { finalScore: mScore } = calcStudentFinalScore(mXP, mComp, settings, mAssigned, 0, 0);
          g1TotalScore += mScore;
        }
        g2Bonus = Math.round(g1TotalScore * 0.10);
      }
      setCarryOver(g2Bonus);

      // G2 classEntries — lig ile aynı filtre (combinedTasksMap ile classId-siz entry'ler çözülür)
      const g2ClassEntries = Object.entries(allGradedTasks).filter(([tid, e]) => {
        const cid = e?.classId;
        if (cid) return cid === groupCode;
        const mapCid = combinedTasksMap[tid]?.classId;
        if (!mapCid) return true; // task silinmiş → G2 kabul (lig ile aynı)
        return mapCid === groupCode;
      });

      // G2 entry'lerini aya göre grupla
      const byMonthEntries: Record<string, Array<[string, GradedTaskEntry]>> = {};
      for (const [tid, e] of g2ClassEntries) {
        const m = effectiveMonth(e.completedAt, e.endDate ?? combinedTasksMap[tid]?.endDate);
        if (!m) continue;
        if (!byMonthEntries[m]) byMonthEntries[m] = [];
        byMonthEntries[m].push([tid, e]);
      }

      // Kümülatif skor: g2Bonus + Σ aylık skor
      let cumulativeMonthlyScore = g2Bonus;
      for (const [month, entries] of Object.entries(byMonthEntries)) {
        const mXP   = entries.reduce((s, [, e]) => s + (e.xp ?? 0), 0);
        const mComp = entries.length;
        const [y, mo] = month.split("-");
        const mStart   = `${y}-${mo}-01`;
        const mLastDay = new Date(parseInt(y), parseInt(mo), 0).getDate();
        const mEndFull = `${y}-${mo}-${String(mLastDay).padStart(2, "0")}`;
        const mEnd     = month === ligCurrentMonth ? ligToday : mEndFull;
        const mAssigned = countAssignedInMonth(mStart, mEnd);
        const { finalScore: mScore } = calcStudentFinalScore(mXP, mComp, settings, mAssigned, 0, 0);
        cumulativeMonthlyScore += mScore;
      }
      const computedFinalScore = isFinite(cumulativeMonthlyScore) && !isNaN(cumulativeMonthlyScore)
        ? cumulativeMonthlyScore : 0;
      if (process.env.NODE_ENV === "development" && student) {
        console.log(`[StudentModal] ${student.name} ${student.lastName}`, { computedFinalScore, g2Bonus, g2ClassEntries: g2ClassEntries.length, months: Object.keys(byMonthEntries) });
      }

      const gData = gDoc.exists()  ? (gDoc.data()  as GroupDocData) : {} as GroupDocData;
      const g1Raw = g1Doc.exists() ? (g1Doc.data() as ProjectGradeDoc) : null;
      const g2Raw = g2Doc.exists() ? (g2Doc.data() as ProjectGradeDoc) : null;

      // codeAt_GRAFIK_1/2: finalizasyon sırasında gruba yazılan orijinal kodlar
      // grafik1Code/grafik2Code: öğrenci transferinde student doc'a kaydedilen eski modül kodları
      const codeG1 = sData.grafik1Code
        ?? gData.codeAt_GRAFIK_1
        ?? (gData.module === "GRAFIK_1" ? (gData.code ?? "") : "")
        ?? "";
      const codeG2 = sData.grafik2Code
        ?? gData.codeAt_GRAFIK_2
        ?? (gData.module === "GRAFIK_2" ? (gData.code ?? "") : "")
        ?? "";

      // 3. Modül bazlı görev istatistikleri
      // Firestore student doc'tan gelen gradedTasks (prop boş gelebilir)
      const fsGradedTasks = sData.gradedTasks ?? {};
      const gradedIds = new Set(Object.keys(fsGradedTasks));

      // Tek bir classId için tüm graded task'ları çek, öğrencinin tamamladıklarını say
      const calcModuleStats = async (classId: string): Promise<ModuleStats> => {
        if (!classId) return EMPTY_STATS;
        // Sadece classId filtresi — isGraded+classId composite index gerektirmez
        const snap = await getDocs(query(collection(db, "tasks"), where("classId", "==", classId)));
        const validTasks = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as TaskWithId))
          .filter(t => t.isGraded === true && !t.isCancelled);

        let taskCount = 0, studentXP = 0;
        const countedTaskIds = new Set<string>();
        validTasks.forEach(t => {
          if (gradedIds.has(t.id)) {
            // gradedTasks mevcut → buradan XP al
            taskCount++;
            studentXP += (fsGradedTasks[t.id]?.xp ?? 0);
            countedTaskIds.add(t.id);
          } else {
            // Fallback: eski transfer gradedTasks'ı sildiyse task.grades map'ine bak
            const g = (t.grades ?? {})[fetchId];
            if (g?.submitted === true) {
              taskCount++;
              studentXP += (g.xp ?? 0);
              countedTaskIds.add(t.id);
            }
          }
        });

        // Arşivden silinmiş görevler: task belgesi yok ama gradedTasks'ta XP korunuyor
        let deletedMaxXP = 0;
        let deletedTaskCount = 0;
        Object.entries(fsGradedTasks).forEach(([taskId, entry]) => {
          if (countedTaskIds.has(taskId)) return; // zaten sayıldı
          if (entry.classId !== classId) return; // farklı sınıf
          taskCount++;
          studentXP += (entry.xp ?? 0);
          deletedMaxXP += (entry.maxXp ?? entry.xp); // maxXp yoksa xp'yi alt sınır olarak kullan
          deletedTaskCount++;
        });

        // totalAssigned: mevcut görevler + silinmiş görevler — completionRate için doğru payda
        const totalAssigned = validTasks.length + deletedTaskCount;

        const maxXP = validTasks.reduce((s, t) => s + getLevelXP(t.level, settings) * (t.xpMultiplier ?? 1), 0) + deletedMaxXP;
        const odevPuani = Math.round(maxXP > 0 ? (studentXP / maxXP) * 30 : 0);
        return { taskCount, xp: studentXP, score: calcScore(studentXP, taskCount, settings, totalAssigned || undefined), maxXP, odevPuani };
      };

      // codeG1/codeG2 bilinmiyorsa doğru classId'yi bul:
      // 1. gradedTasks classId'lerinden → 2. instructor'ın grup taramasından (task.grades fallback)
      const instructorId = gData.instructorId;

      const resolveCode = async (
        knownCode: string,
        module: "GRAFIK_1" | "GRAFIK_2"
      ): Promise<string> => {
        if (knownCode) return knownCode;

        // Yol 1: gradedTasks'taki classId'lere ait grupları sorgula
        const classIdsInGT = [...new Set(
          Object.values(sData.gradedTasks ?? {})
            .map(e => e?.classId)
            .filter((c): c is string => !!c)
        )];
        if (classIdsInGT.length > 0) {
          for (let i = 0; i < classIdsInGT.length; i += 10) {
            const gSnap = await getDocs(query(
              collection(db, "groups"),
              where("code", "in", classIdsInGT.slice(i, i + 10))
            ));
            for (const gd of gSnap.docs) {
              const d = gd.data() as GroupDocData;
              if (d.module === module) return d.code ?? "";
            }
          }
        }

        // Yol 2: gradedTasks silinmişse → instructor'ın tüm modül gruplarını tara
        // task.grades'den öğrencinin görev yaptığı grubu bul
        if (!instructorId) return "";
        const gSnap = await getDocs(query(
          collection(db, "groups"),
          where("instructorId", "==", instructorId),
          where("module", "==", module)
        ));
        for (const gd of gSnap.docs) {
          const code = (gd.data() as GroupDocData).code;
          if (!code) continue;
          const tSnap = await getDocs(query(
            collection(db, "tasks"),
            where("classId", "==", code)
          ));
          for (const td of tSnap.docs) {
            const g = ((td.data() as TaskDoc).grades ?? {})[fetchId];
            if (g?.submitted === true) return code;
          }
        }
        return "";
      };

      const [resolvedG1, resolvedG2] = await Promise.all([
        resolveCode(codeG1, "GRAFIK_1"),
        resolveCode(codeG2, "GRAFIK_2"),
      ]);

      const [s1, s2] = await Promise.all([
        calcModuleStats(resolvedG1),
        resolvedG2 ? calcModuleStats(resolvedG2) : Promise.resolve(EMPTY_STATS),
      ]);

      if (cancelled) return;

      // 4. finalNote'u Firestore'daki eski/hatalı değerden değil,
      //    mevcut projectScore ve hesaplanan odevPuani'den yeniden hesapla
      const makeGrade = (raw: ProjectGradeDoc | null, stats: ModuleStats): GradeData | null => {
        if (!raw && stats.taskCount === 0) return null;
        const projectScore: number | null = raw?.projectScore ?? null;
        // Finalize edilmişse snapshot'taki odevPuani'yi kullan (yeni task eklense bile değişmez)
        const odevPuani = (raw?.isFinalized && raw?.odevPuani != null)
          ? raw.odevPuani
          : stats.odevPuani;
        const finalNote = projectScore != null
          ? Math.round(projectScore * 0.7 + odevPuani)
          : null;
        return { groupId, projectScore, odevPuani, finalNote, isFinalized: !!raw?.isFinalized };
      };

      // 5. Tüm state güncellemelerini tek seferde yap → tek render, layout kayması yok
      setEmail(studentEmail);
      setG1Code(codeG1);
      setG2Code(codeG2);
      setG1Grade(makeGrade(g1Raw, s1));
      setG2Grade(makeGrade(g2Raw, s2));
      setG1Stats(s1);
      setG2Stats(s2);
      // Lig puanı: calcStudentFinalScore ile hesaplandı (league/LeaderboardWidget ile aynı kaynak)
      setComputedScore(computedFinalScore);
      setComputedXP(cXP);
      setComputedTasks(cTasks);
      setLoading(false);
    });

    return () => { cancelled = true; unsubscribeStudent(); };
  }, [fetchId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !student) return null;

  const safeGender = student.gender === "female" ? "female" : "male";
  const safeAvatar = student.avatarId && student.avatarId > 0 ? student.avatarId : 1;
  const medal      = MEDALS[student.rank];
  const totalXP    = computedXP    ?? student.points    ?? 0;
  const totalTasks = computedTasks ?? student.completedTasks ?? 0;
  // generalScore: lig sayfasından gelen per-aylık toplam (herzaman doğru kaynak)
  // computedScore: management/grading sayfalarından score:0 geldiğinde fallback
  const displayScore = student.generalScore ?? computedScore ?? student.score;

  // Yüzde: kazanılan XP / o modülde kazanılabilir maksimum XP
  // Arzu Alan 300/300 XP aldıysa → %100 gösterilmeli
  const g1Pct = g1Stats.maxXP > 0 ? Math.round((g1Stats.xp / g1Stats.maxXP) * 100) : 0;
  const g2Pct = g2Stats.maxXP > 0 ? Math.round((g2Stats.xp / g2Stats.maxXP) * 100) : 0;

  // Tüm animasyonlar için tek sinyal: hem ana veri hem attendance hazır olunca
  const dataReady = !loading && attRate !== null;

  const handleClose = () => setVisible(false);

  return (
    <AnimatePresence onExitComplete={onClose}>
    {visible && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      {/* Arka plan */}
      <motion.div
        className="absolute inset-0 bg-base-primary-900/40 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleClose}
      />

      {/* Kart */}
      <motion.div
        className="relative bg-white rounded-24 shadow-2xl w-full max-w-4xl max-h-[94vh] overflow-y-auto z-10"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
      >

        {/* Kapat */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-12 bg-white/20 hover:bg-white/30 transition-colors cursor-pointer z-10"
        >
          <X size={14} className="text-white" />
        </button>

        {/* ── Header ── */}
        <div className="relative bg-base-primary-900 rounded-t-24 px-8 py-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/4 pointer-events-none" />
          <div className="absolute -bottom-6 left-1/3  w-36 h-36 rounded-full bg-white/4 pointer-events-none" />

          <div className="relative flex items-center gap-5 pr-14">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 overflow-hidden bg-base-primary-800 shadow-xl">
                <img
                  src={`/avatars/${safeGender}/${safeAvatar}.svg`} alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = `/avatars/${safeGender}/1.svg`; }}
                />
              </div>
              {medal && <span className="absolute -bottom-1 -right-1 text-[18px] leading-none">{medal}</span>}
            </div>

            {/* Bilgi */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h2 className="text-[20px] font-black text-white leading-tight">{student.name} {student.lastName}</h2>
                <span className="shrink-0 text-[10px] font-bold text-base-primary-200 bg-white/10 px-2 py-0.5 rounded-full">
                  #{student.rank}. sıra
                </span>
              </div>
              <p className="text-[12px] text-base-primary-300 truncate">
                {email || (loading ? <span className="italic opacity-40">yükleniyor…</span> : "")}
              </p>
              <p className="text-[11px] text-base-primary-400 mt-0.5">{student.branch}</p>
            </div>

            {/* Lig Puanı */}
            <div className="shrink-0 text-right hidden sm:block">
              <p className="text-[32px] font-black text-white tabular-nums leading-none">{Math.round(displayScore)}</p>
              <p className="text-[10px] text-base-primary-300 font-semibold">Lig Puanı</p>
            </div>
          </div>
        </div>

        {/* ── Tab Bar — sadece admin görür ── */}
        {isAdmin() && (
          <div className="flex gap-0 border-b border-surface-100 px-6 bg-white">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3.5 text-[12px] font-semibold transition-all border-b-2 -mb-px cursor-pointer whitespace-nowrap
                    ${active
                      ? "border-[#10294C] text-[#10294C]"
                      : "border-transparent text-surface-400 hover:text-surface-600 hover:border-surface-300"
                    }`}
                >
                  <Icon size={12} strokeWidth={2.2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tab İçerik Wrapper — sabit boyut ── */}
        <div className="min-h-135">

        {/* ── İçerik: Ders Bilgileri ── */}
        {activeTab === "ders" && (
        <div className="p-6 grid grid-cols-[260px_1fr] gap-5">

          {/* SOL */}
          <div className="space-y-4">

            {/* Sınıf kodları */}
            <div className="rounded-16 border border-surface-100 bg-surface-50 p-4">
              <p className="text-[11px] font-bold text-neutral-500 tracking-tight mb-3">Sınıf</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-base-primary-50 border border-base-primary-100 rounded-12 px-3 py-2.5">
                  <span className="text-[10px] font-bold text-base-primary-400 tracking-tight">Grafik-1</span>
                  <span className={`text-[16px] font-black text-base-primary-900 transition-opacity duration-300 ${loading ? "opacity-20" : "opacity-100"}`}>
                    {g1Code || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-accent-purple-100/40 border border-accent-purple-100 rounded-12 px-3 py-2.5">
                  <span className="text-[10px] font-bold text-accent-purple-400 tracking-tight">Grafik-2</span>
                  <span className={`text-[16px] font-black text-accent-purple-700 transition-opacity duration-300 ${loading ? "opacity-20" : "opacity-100"}`}>
                    {g2Code || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Ödev sayıları */}
            <div className="rounded-16 border border-surface-100 bg-surface-50 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <BookOpen size={11} className="text-surface-400" />
                <p className="text-[11px] font-bold text-neutral-500 tracking-tight">Ödevler</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Toplam" value={dataReady ? g1Stats.taskCount + g2Stats.taskCount : "…"} loading={!dataReady} />
                <StatBox label="Grafik-1"     value={dataReady ? g1Stats.taskCount : "…"} colorClass="text-base-primary-700" loading={!dataReady} />
                <StatBox label="Grafik-2"     value={dataReady ? g2Stats.taskCount : "…"} colorClass="text-accent-purple-700" loading={!dataReady} />
              </div>
            </div>

            {/* Lig puanları */}
            <div className="rounded-16 border border-surface-100 bg-surface-50 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Star size={11} className="text-surface-400" />
                <p className="text-[11px] font-bold text-neutral-500 tracking-tight">Lig Puanı</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Toplam"
                  value={dataReady ? (
                    g2Code
                      ? Math.round(g1Stats.score + (student.generalScore ?? computedScore ?? g2Stats.score + carryOver))
                      : Math.round(student.generalScore ?? g1Stats.score)
                  ) : "…"}
                  loading={!dataReady}
                />
                <StatBox label="Grafik-1" value={dataReady ? Math.round(g1Stats.score) : "…"} colorClass="text-base-primary-700" loading={!dataReady} />
                <StatBox label="Grafik-2"
                  value={dataReady ? (
                    g2Code
                      ? Math.round(student.generalScore ?? computedScore ?? g2Stats.score + carryOver)
                      : "—"
                  ) : "…"}
                  colorClass="text-accent-purple-700"
                  loading={!dataReady}
                />
              </div>
            </div>
          </div>

          {/* SAĞ */}
          <div className="space-y-4 min-w-0">

            {/* XP Dağılımı + Devam — 2 ayrı kart */}
            <div className="grid grid-cols-2 gap-4">

              {/* Sol — XP barları */}
              <div className="rounded-16 border border-surface-100 bg-surface-50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-surface-400" />
                      <p className="text-[11px] font-bold text-neutral-500 tracking-tight">Görev XP</p>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                      <Zap size={10} className="text-amber-500" />
                      <span className="text-[11px] font-black text-amber-700 tabular-nums">{totalXP} XP</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-base-primary-600">Grafik-1</span>
                        <span className={`text-[11px] font-bold text-text-primary tabular-nums transition-opacity duration-300 ${dataReady ? "opacity-100" : "opacity-20"}`}>
                          {g1Stats.xp} XP <span className="text-surface-400 font-normal">({g1Pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-base-primary-500 rounded-full transition-all duration-700" style={{ width: `${dataReady ? g1Pct : 0}%` }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-accent-purple-600">Grafik-2</span>
                        <span className={`text-[11px] font-bold text-text-primary tabular-nums transition-opacity duration-300 ${dataReady ? "opacity-100" : "opacity-20"}`}>
                          {g2Stats.xp} XP <span className="text-surface-400 font-normal">({g2Pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-purple-500 rounded-full transition-all duration-700" style={{ width: `${dataReady ? g2Pct : 0}%` }} />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-1">
                      <span className="flex items-center gap-1.5 text-[10px] text-surface-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-base-primary-500 shrink-0" />Grafik-1
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-surface-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-accent-purple-500 shrink-0" />Grafik-2
                      </span>
                    </div>
                  </div>
                </div>

              {/* Sağ — Devam durumu */}
              <div className="rounded-16 border border-surface-100 bg-surface-50 p-4 flex flex-col">
                  <div className="flex items-center gap-1.5 mb-4">
                    <CalendarCheck size={11} className="text-surface-400" />
                    <p className="text-[11px] font-bold text-neutral-500 tracking-tight">Devam Durumu</p>
                  </div>

                  {attRate === null ? (
                    /* Attendance verisi henüz gelmedi — spinner */
                    <div className="flex flex-1 items-center justify-center">
                      <div className="w-5 h-5 rounded-full border-2 border-surface-200 border-t-base-primary-400 animate-spin" />
                    </div>
                  ) : attTotal === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                      <p className="text-[11px] text-surface-300 font-medium">Yoklama kaydı yok</p>
                    </div>
                  ) : (
                  <div className="flex flex-1 items-center gap-3">
                    {/* Metin — üst Katıldığı saat, alt Devamsızlık */}
                    <div className="flex flex-col justify-between flex-1 self-stretch py-1">
                      <div>
                        <p className="text-[9px] font-bold text-surface-400 tracking-wide mb-0.5">Katıldığı</p>
                        <p className="text-[22px] font-black tabular-nums leading-none text-text-primary">
                          {attAttendedHours ?? "—"}{attAttendedHours != null ? " saat" : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-surface-400 tracking-wide mb-0.5">Devamsızlık</p>
                        <p className={`text-[22px] font-black tabular-nums leading-none ${attAbsentHours != null && attAbsentHours > 0 ? "text-red-400" : "text-text-primary"}`}>
                          {attAbsentHours ?? "—"}{attAbsentHours != null ? " saat" : ""}
                        </p>
                      </div>
                    </div>

                    {/* Donut — attRate gelince render edilir, animate hemen başlar */}
                    <div className="shrink-0">
                      <AttendanceDonut rate={attRate} animate={visible} />
                    </div>
                  </div>
                  )}
                </div>

              </div>

            {/* Mezuniyet Notları */}
            <div>
              <p className="text-[11px] font-bold text-neutral-500 tracking-tight mb-3 px-0.5">Mezuniyet Notu</p>
              <div className="flex gap-3">
                <GradCard
                  label="Grafik-1"
                  code={g1Code}
                  grade={g1Grade}
                  odevPuaniCalc={g1Stats.odevPuani}
                  loading={!dataReady}
                  color="blue"
                />
                <GradCard
                  label="Grafik-2"
                  code={g2Code || "—"}
                  grade={g2Grade}
                  odevPuaniCalc={g2Stats.odevPuani}
                  loading={!dataReady}
                  color="purple"
                />
              </div>
            </div>

          </div>
        </div>
        )} {/* ── Ders Bilgileri sonu ── */}

        {/* ── Geçmiş Tab ── */}
        {activeTab === "gecmis" && (
          <div className="p-6">
            {groupHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-surface-300">
                <History size={32} strokeWidth={1.5} />
                <p className="text-[13px] font-medium">Henüz geçmiş kaydı yok</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {groupHistory.map((entry, i) => {
                  const isCurrent = entry.endDate === "9999-12-31";
                  const isG2      = entry.module === "GRAFIK_2";
                  const moduleCls = isG2
                    ? "bg-accent-purple-100 text-accent-purple-700"
                    : "bg-base-primary-100 text-base-primary-700";
                  const reasonCls = entry.reason === "graduation"
                    ? "bg-green-50 text-green-700 border-green-100"
                    : entry.reason === "transfer"
                    ? "bg-amber-50 text-amber-700 border-amber-100"
                    : entry.reason === "module_upgrade"
                    ? "bg-purple-50 text-purple-700 border-purple-100"
                    : "bg-surface-50 text-surface-500 border-surface-100";
                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-16 border ${isCurrent ? "bg-green-50/50 border-green-100" : "bg-surface-50 border-surface-100"}`}>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${moduleCls}`}>
                        {entry.module === "GRAFIK_2" ? "Grafik-2" : entry.module === "GRAFIK_1" ? "Grafik-1" : "—"}
                      </span>
                      <span className="text-[14px] font-bold text-text-primary shrink-0">{entry.groupCode || "—"}</span>
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${reasonCls}`}>
                        {REASON_LABEL[entry.reason] ?? entry.reason}
                      </span>
                      <div className="ml-auto flex items-center gap-1.5 text-[11px] text-surface-400 tabular-nums whitespace-nowrap">
                        <span>{entry.startDate ?? "?"}</span>
                        <ArrowRight size={10} className="text-surface-300" />
                        {isCurrent
                          ? <span className="text-green-600 font-semibold">Devam ediyor</span>
                          : <span>{entry.endDate}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── İletişim Tab ── */}
        {activeTab === "iletisim" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-surface-300">
            <div className="w-14 h-14 rounded-2xl bg-surface-50 border border-surface-100 flex items-center justify-center">
              <Phone size={22} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-surface-400">İletişim Bilgileri</p>
              <p className="text-[12px] text-surface-300 mt-1">Eğitim Operasyon modülü ile birlikte gelecek</p>
            </div>
          </div>
        )}

        {/* ── Ödeme Tab ── */}
        {activeTab === "odeme" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-surface-300">
            <div className="w-14 h-14 rounded-2xl bg-surface-50 border border-surface-100 flex items-center justify-center">
              <CreditCard size={22} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-surface-400">Ödeme Bilgileri</p>
              <p className="text-[12px] text-surface-300 mt-1">Flex-CRM entegrasyonu ile birlikte gelecek</p>
            </div>
          </div>
        )}

        </div> {/* ── Tab İçerik Wrapper sonu ── */}

      </motion.div>
    </div>
    )}
    </AnimatePresence>
  );
}
