"use client";

import { useEffect, useState } from "react";
import { X, GraduationCap, Zap, BookOpen, Star } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { useScoring } from "@/app/context/ScoringContext";
import { calcScore, calcStudentFinalScore, getLevelXP, computeStudentStats } from "@/app/lib/scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalStudent {
  id: string;
  name: string;
  lastName: string;
  rank: number;
  score: number;
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
          {loading || animatedNote == null ? "—" : animatedNote.toFixed(1)}
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
            {loading ? "—" : effOdev.toFixed(1)}
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

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function StudentDetailModal({ student, isOpen, onClose }: {
  student: ModalStudent | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { settings, activeSeasonId } = useScoring();

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

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      // Modal kapanınca state'i sıfırla — tekrar açılınca eski veri/bar görünmesin
      setEmail("");
      setG1Code(""); setG2Code("");
      setG1Grade(null); setG2Grade(null);
      setG1Stats(EMPTY_STATS); setG2Stats(EMPTY_STATS);
      setComputedScore(null); setComputedXP(null); setComputedTasks(null);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !student) return;
    let cancelled = false;

    setEmail(""); setG1Code(""); setG2Code("");
    setG1Grade(null); setG2Grade(null);
    setG1Stats(EMPTY_STATS); setG2Stats(EMPTY_STATS);
    setLoading(true);

    (async () => {
      // 1. Öğrenci belgesi → email + groupId
      const sDoc  = await getDoc(doc(db, "students", student.id));
      const sData = sDoc.exists() ? (sDoc.data() as any) : {};
      const studentEmail = sData.email ?? "";

      // carryOverScore ve groupCode — lig hesabıyla aynı parametreler
      const g2StartXP = (sData.g2StartXP ?? 0) as number;
      const groupCode = (sData.groupCode  ?? "") as string;

      // Lig puanını Firestore'dan gelen gerçek gradedTasks ile hesapla
      // (prop'taki score=0 veya eski değere bağımlı olmadan)
      // KRİTİK: lig sayfasıyla aynı filtre — sadece mevcut gruba ait görevler
      const allGradedTasks = (sData.gradedTasks ?? {}) as Record<string, any>;
      const filteredForScore = groupCode
        ? Object.fromEntries(
            Object.entries(allGradedTasks).filter(([, e]: any) => {
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

      const groupId = sData.groupId as string | undefined;
      if (!groupId) {
        // Grup yoksa totalAssignedTasks bilinmiyor → undefined geç (completionRate=1.0)
        if (!cancelled) {
          const { finalScore: fs, debug: dbg } = calcStudentFinalScore(cXP, cTasks, settings, undefined, g2StartXP, 0);
          if (process.env.NODE_ENV === "development") console.log(`[StudentModal] ${student.name} ${student.lastName}`, dbg);
          setComputedScore(fs);
          setComputedXP(cXP);
          setComputedTasks(cTasks);
          setEmail(studentEmail);
          setLoading(false);
        }
        return;
      }

      // 2. Grup belgesi, proje notları ve görev sayısı → hepsini paralel çek
      const [gDoc, g1Doc, g2Doc, tasksSnap] = await Promise.all([
        getDoc(doc(db, "groups", groupId)),
        getDoc(doc(db, "projectGrades", `${student.id}_${groupId}_GRAFIK_1`)),
        getDoc(doc(db, "projectGrades", `${student.id}_${groupId}_GRAFIK_2`)),
        getDocs(query(collection(db, "tasks"), where("classId", "==", groupCode))),
      ]);
      // Lig hesabıyla aynı totalAssignedTasks: published veya completed görevler (draft hariç)
      const todayStr = new Date().toISOString().split("T")[0];
      const totalAssignedTasks = tasksSnap.docs.filter(d => {
        const data = d.data() as any;
        const st = data.status as string | undefined;
        const ed = data.endDate as string | undefined;
        return (st === "active" || st === "published" || st === "completed" || !st) &&
               (st === "completed" || (ed ? ed <= todayStr : true));
      }).length;
      const { finalScore: computedFinalScore, debug: scoreDebug } = calcStudentFinalScore(
        cXP, cTasks, settings, totalAssignedTasks || undefined, g2StartXP, 0,
      );
      if (process.env.NODE_ENV === "development") console.log(`[StudentModal] ${student.name} ${student.lastName}`, scoreDebug);

      const gData = gDoc.exists()  ? (gDoc.data()  as any) : {};
      const g1Raw = g1Doc.exists() ? (g1Doc.data() as any) : null;
      const g2Raw = g2Doc.exists() ? (g2Doc.data() as any) : null;

      // codeAt_GRAFIK_1/2: finalizasyon sırasında gruba yazılan orijinal kodlar
      // grafik1Code/grafik2Code: öğrenci transferinde student doc'a kaydedilen eski modül kodları
      const codeG1 = (sData.grafik1Code as string | undefined)
        ?? (gData.codeAt_GRAFIK_1 as string | undefined)
        ?? (gData.module === "GRAFIK_1" ? (gData.code as string) : "")
        ?? "";
      const codeG2 = (sData.grafik2Code as string | undefined)
        ?? (gData.codeAt_GRAFIK_2 as string | undefined)
        ?? (gData.module === "GRAFIK_2" ? (gData.code as string) : "")
        ?? "";

      // 3. Modül bazlı görev istatistikleri
      // Firestore student doc'tan gelen gradedTasks (prop boş gelebilir)
      const fsGradedTasks = (sData.gradedTasks ?? {}) as Record<string, { xp: number; penalty: number }>;
      const gradedIds = new Set(Object.keys(fsGradedTasks));

      // Tek bir classId için tüm graded task'ları çek, öğrencinin tamamladıklarını say
      const calcModuleStats = async (classId: string): Promise<ModuleStats> => {
        if (!classId) return EMPTY_STATS;
        // Sadece classId filtresi — isGraded+classId composite index gerektirmez
        const snap = await getDocs(query(collection(db, "tasks"), where("classId", "==", classId)));
        const validTasks = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
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
            const g = (t.grades ?? {})[student.id];
            if (g?.submitted === true) {
              taskCount++;
              studentXP += (g.xp ?? 0);
              countedTaskIds.add(t.id);
            }
          }
        });

        // Arşivden silinmiş görevler: task belgesi yok ama gradedTasks'ta XP korunuyor
        let deletedMaxXP = 0;
        Object.entries(fsGradedTasks).forEach(([taskId, entry]) => {
          if (countedTaskIds.has(taskId)) return; // zaten sayıldı
          if ((entry as any).classId !== classId) return; // farklı sınıf
          taskCount++;
          studentXP += (entry.xp ?? 0);
          deletedMaxXP += ((entry as any).maxXp ?? entry.xp); // maxXp yoksa xp'yi alt sınır olarak kullan
        });

        const maxXP = validTasks.reduce((s, t) => s + getLevelXP(t.level, settings) * (t.xpMultiplier ?? 1), 0) + deletedMaxXP;
        const odevPuani = maxXP > 0 ? (studentXP / maxXP) * 30 : 0;
        return { taskCount, xp: studentXP, score: calcScore(studentXP, taskCount, settings), maxXP, odevPuani };
      };

      // codeG1/codeG2 bilinmiyorsa doğru classId'yi bul:
      // 1. gradedTasks classId'lerinden → 2. instructor'ın grup taramasından (task.grades fallback)
      const instructorId = gData.instructorId as string | undefined;

      const resolveCode = async (
        knownCode: string,
        module: "GRAFIK_1" | "GRAFIK_2"
      ): Promise<string> => {
        if (knownCode) return knownCode;

        // Yol 1: gradedTasks'taki classId'lere ait grupları sorgula
        const classIdsInGT = [...new Set(
          Object.values(sData.gradedTasks ?? {})
            .map((e: any) => e?.classId)
            .filter((c): c is string => !!c)
        )];
        if (classIdsInGT.length > 0) {
          for (let i = 0; i < classIdsInGT.length; i += 10) {
            const gSnap = await getDocs(query(
              collection(db, "groups"),
              where("code", "in", classIdsInGT.slice(i, i + 10))
            ));
            for (const gd of gSnap.docs) {
              const d = gd.data() as any;
              if (d.module === module) return d.code as string;
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
          const code = (gd.data() as any).code as string;
          if (!code) continue;
          const tSnap = await getDocs(query(
            collection(db, "tasks"),
            where("classId", "==", code)
          ));
          for (const td of tSnap.docs) {
            const g = ((td.data() as any).grades ?? {})[student.id];
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
      const makeGrade = (raw: any | null, stats: ModuleStats): GradeData | null => {
        if (!raw && stats.taskCount === 0) return null;
        const projectScore: number | null = raw?.projectScore ?? null;
        // Finalize edilmişse snapshot'taki odevPuani'yi kullan (yeni task eklense bile değişmez)
        const odevPuani = (raw?.isFinalized && raw?.odevPuani != null)
          ? (raw.odevPuani as number)
          : stats.odevPuani;
        const finalNote = projectScore != null
          ? parseFloat((projectScore * 0.7 + odevPuani).toFixed(2))
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
    })();

    return () => { cancelled = true; };
  }, [isOpen, student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !student) return null;

  const safeGender = student.gender === "female" ? "female" : "male";
  const safeAvatar = student.avatarId && student.avatarId > 0 ? student.avatarId : 1;
  const medal      = MEDALS[student.rank];
  const totalXP    = computedXP    ?? student.points    ?? 0;
  const totalTasks = computedTasks ?? student.completedTasks ?? 0;
  const displayScore = computedScore ?? student.score;

  // Yüzde: kazanılan XP / o modülde kazanılabilir maksimum XP
  // Arzu Alan 300/300 XP aldıysa → %100 gösterilmeli
  const g1Pct = g1Stats.maxXP > 0 ? Math.round((g1Stats.xp / g1Stats.maxXP) * 100) : 0;
  const g2Pct = g2Stats.maxXP > 0 ? Math.round((g2Stats.xp / g2Stats.maxXP) * 100) : 0;

  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };

  return (
    <div className={`fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      {/* Arka plan */}
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Kart */}
      <div className={`relative bg-white rounded-24 shadow-2xl w-full max-w-4xl max-h-[94vh] overflow-y-auto z-10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-6"}`}>

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

        {/* ── İçerik: sabit iki sütun ── */}
        <div className="p-6 grid grid-cols-[260px_1fr] gap-5 min-h-135">

          {/* SOL */}
          <div className="space-y-4">

            {/* Sınıf kodları */}
            <div className="rounded-16 border border-surface-100 bg-surface-50 p-4">
              <p className="text-[10px] font-bold text-surface-400 tracking-tight mb-3">Sınıf</p>
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
                <p className="text-[10px] font-bold text-surface-400 tracking-tight">Ödevler</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Toplam" value={loading ? "…" : g1Stats.taskCount + g2Stats.taskCount} loading={loading} />
                <StatBox label="Grafik-1"     value={loading ? "…" : g1Stats.taskCount} colorClass="text-base-primary-700" loading={loading} />
                <StatBox label="Grafik-2"     value={loading ? "…" : g2Stats.taskCount} colorClass="text-accent-purple-700" loading={loading} />
              </div>
            </div>

            {/* Lig puanları */}
            <div className="rounded-16 border border-surface-100 bg-surface-50 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Star size={11} className="text-surface-400" />
                <p className="text-[10px] font-bold text-surface-400 tracking-tight">Lig Puanı</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Toplam"   value={loading ? "…" : Math.round(computedScore ?? (g1Stats.score + g2Stats.score))} loading={loading} />
                <StatBox label="Grafik-1" value={loading ? "…" : Math.round(g1Stats.score)} colorClass="text-base-primary-700" loading={loading} />
                <StatBox label="Grafik-2" value={loading ? "…" : Math.round(computedScore ?? g2Stats.score)} colorClass="text-accent-purple-700" loading={loading} />
              </div>
            </div>
          </div>

          {/* SAĞ */}
          <div className="space-y-4 min-w-0">

            {/* XP Dağılımı */}
            <div className="rounded-16 border border-surface-100 bg-surface-50 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-surface-400" />
                  <p className="text-[10px] font-bold text-surface-400 tracking-tight">Görev XP</p>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                  <Zap size={10} className="text-amber-500" />
                  <span className="text-[11px] font-black text-amber-700 tabular-nums">{totalXP} XP</span>
                </div>
              </div>

              {/* XP barları her zaman render edilir; yükleme sırasında genişlik 0, değerler soluk */}
              <div className="space-y-3">
                {/* G1 bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-base-primary-600">Grafik-1</span>
                    <span className={`text-[11px] font-bold text-text-primary tabular-nums transition-opacity duration-300 ${loading ? "opacity-20" : "opacity-100"}`}>
                      {g1Stats.xp} XP <span className="text-surface-400 font-normal">({g1Pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-base-primary-500 rounded-full transition-all duration-700" style={{ width: `${loading ? 0 : g1Pct}%` }} />
                  </div>
                </div>

                {/* G2 bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-accent-purple-600">Grafik-2</span>
                    <span className={`text-[11px] font-bold text-text-primary tabular-nums transition-opacity duration-300 ${loading ? "opacity-20" : "opacity-100"}`}>
                      {g2Stats.xp} XP <span className="text-surface-400 font-normal">({g2Pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-purple-500 rounded-full transition-all duration-700" style={{ width: `${loading ? 0 : g2Pct}%` }} />
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

            {/* Mezuniyet Notları */}
            <div>
              <p className="text-[10px] font-bold text-surface-400 tracking-tight mb-3 px-0.5">Mezuniyet Notu</p>
              <div className="flex gap-3">
                <GradCard
                  label="Grafik-1"
                  code={g1Code}
                  grade={g1Grade}
                  odevPuaniCalc={g1Stats.odevPuani}
                  loading={loading}
                  color="blue"
                />
                <GradCard
                  label="Grafik-2"
                  code={g2Code || "—"}
                  grade={g2Grade}
                  odevPuaniCalc={g2Stats.odevPuani}
                  loading={loading}
                  color="purple"
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
