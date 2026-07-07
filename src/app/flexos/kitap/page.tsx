"use client";

/**
 * FlexOS · Kitap Dünyası çekiliş sayfası (`/flexos/kitap?assignmentId=`) — `flexos/kolaj/page.tsx`
 * ile birebir aynı desen (EntryScreen→BookGameScreen), sadece hedef ekran farklı.
 */
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, ChevronRight, Check } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import BookGameScreen from "./BookGameScreen";
import type { AssignmentData, Student, StudentDraw } from "./types";

const ACCENT = "#60a5fa";

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function splitName(fullName: string): { name: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { name: parts[0], lastName: "" };
  return { name: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function EntryScreen({
  assignment, groupCode, students, drawnStudentIds, onStart,
}: {
  assignment: AssignmentData;
  groupCode: string;
  students: Student[];
  drawnStudentIds: string[];
  onStart: (students: Student[]) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(students.filter((s) => !drawnStudentIds.includes(s.id)).map((s) => s.id)),
  );

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectable = students.filter((s) => !drawnStudentIds.includes(s.id));
  const allSelected = selectable.length > 0 && selectable.every((s) => selected.has(s.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((s) => s.id)));

  const handleStart = () => {
    const list = students.filter((s) => selected.has(s.id) || drawnStudentIds.includes(s.id));
    if (list.length > 0) onStart(list);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "radial-gradient(ellipse at 50% 38%, #0f1f45 0%, #060D1A 82%)" }}>
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/6">
        <button onClick={() => router.push("/flexos/egitmen-anasayfa")} className="flex items-center gap-2 cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}>
          <ArrowLeft size={17} />
          <span className="text-[15px] font-semibold">Ana Sayfa</span>
        </button>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[13px] font-bold text-white">{assignment.title}</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.30)" }}>{groupCode}</p>
          </div>
        </div>
        <div className="w-28" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold tracking-[0.45em] uppercase mb-3" style={{ color: ACCENT }}>Çekiliş Hazırlığı</p>
            <h2 className="text-[34px] font-black text-white" style={{ letterSpacing: "-0.03em" }}>Katılımcıları Seç</h2>
            <p className="text-[13px] mt-2" style={{ color: "rgba(255,255,255,0.30)" }}>O an olmayan öğrencileri seçme — sonra eklenip çekilebilirler.</p>
          </div>

          <div className="w-full overflow-hidden mb-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24 }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: "rgba(255,255,255,0.30)" }} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.30)" }}>Öğrenciler</span>
              </div>
              {selectable.length > 0 && (
                <button onClick={toggleAll} className="text-[12px] font-bold cursor-pointer transition-opacity hover:opacity-70" style={{ color: ACCENT }}>
                  {allSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
                </button>
              )}
            </div>

            {students.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 gap-3">
                <Users size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-[13px] font-medium text-center" style={{ color: "rgba(255,255,255,0.25)" }}>Bu gruba henüz öğrenci eklenmemiş</p>
              </div>
            ) : (
              <div>
                {students.map((s, i) => {
                  const isDrawn = drawnStudentIds.includes(s.id);
                  const isSel = selected.has(s.id);
                  if (isDrawn) {
                    return (
                      <div key={s.id} className="w-full flex items-center gap-4 px-6 py-3.5" style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                        <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(56,161,105,0.18)", border: "1.5px solid rgba(56,161,105,0.4)" }}>
                          <Check size={10} style={{ color: "#4ade80" }} strokeWidth={3} />
                        </div>
                        <span className="text-[14px] font-semibold flex-1" style={{ color: "rgba(255,255,255,0.20)" }}>{s.name} {s.lastName}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(56,161,105,0.12)", color: "rgba(74,222,128,0.55)" }}>Tamamlandı</span>
                      </div>
                    );
                  }
                  return (
                    <button key={s.id} onClick={() => toggle(s.id)} className="w-full flex items-center gap-4 px-6 py-3.5 text-left cursor-pointer"
                      style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)", background: isSel ? `${ACCENT}12` : "transparent" }}>
                      <div className="w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all" style={{ borderColor: isSel ? ACCENT : "rgba(255,255,255,0.18)", background: isSel ? ACCENT : "transparent" }}>
                        {isSel && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-[14px] font-semibold" style={{ color: isSel ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.38)" }}>{s.name} {s.lastName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3">
            <button onClick={handleStart} disabled={selected.size === 0}
              className="flex items-center gap-3 px-10 h-14 rounded-2xl text-[15px] font-black text-white transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: ACCENT, boxShadow: `0 8px 32px ${ACCENT}50` }}>
              Ödev Ekranına Geç <ChevronRight size={18} strokeWidth={2.5} />
            </button>
            {selected.size > 0 && <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.22)" }}>{selected.size} öğrenci katılıyor</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KitapPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060D1A" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: ACCENT }} />
      </div>
    }>
      <KitapPageInner />
    </Suspense>
  );
}

function KitapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId") ?? "";

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [groupCode, setGroupCode] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [drawnStudentIds, setDrawnStudentIds] = useState<string[]>([]);
  const [initialDraws, setInitialDraws] = useState<StudentDraw[]>([]);
  const [phase, setPhase] = useState<"entry" | "game">("entry");
  const [participants, setParticipants] = useState<Student[]>([]);

  const load = useCallback(async () => {
    if (!assignmentId) { setLoading(false); return; }
    setLoading(true);
    try {
      const headers = await authHeaders();
      const assignRes = await fetch(`/api/flexos/assignments/${assignmentId}`, { headers });
      if (!assignRes.ok) { setLoading(false); return; }
      const { item }: { item: AssignmentData } = await assignRes.json();

      if (item.status !== "draft") {
        router.replace("/flexos/sertifikasyon/odev-notu");
        return;
      }
      setAssignment(item);

      const [groupsRes, rosterRes, resultRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers }),
        fetch(`/api/flexos/groups/${item.groupId}/roster`, { headers }),
        fetch(`/api/flexos/lottery-results?assignmentId=${assignmentId}`, { headers }),
      ]);

      if (groupsRes.ok) {
        const data = await groupsRes.json() as { items: { id: string; code: string }[] };
        setGroupCode(data.items.find((g) => g.id === item.groupId)?.code ?? "");
      }
      if (rosterRes.ok) {
        const data = await rosterRes.json() as { items: { personId: string; name: string }[] };
        setStudents(data.items.map((r) => ({ id: r.personId, ...splitName(r.name) })));
      }
      if (resultRes.ok) {
        const data = await resultRes.json() as { result: { draws: StudentDraw[] } | null };
        const draws = data.result?.draws ?? [];
        setInitialDraws(draws);
        setDrawnStudentIds(draws.map((d) => d.studentId));
      }
    } finally {
      setLoading(false);
    }
  }, [assignmentId, router]);

  useEffect(() => {
    auth.authStateReady().then(() => {
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      load();
    });
  }, [load, router]);

  if (authed === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060D1A" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: ACCENT }} />
      </div>
    );
  }

  if (!assignmentId || !assignment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#060D1A" }}>
        <p className="text-white/40 text-[14px]">Ödev bulunamadı.</p>
        <button onClick={() => router.push("/flexos/egitmen-anasayfa")} className="text-[13px] font-bold cursor-pointer" style={{ color: ACCENT, background: "none", border: "none" }}>
          Ana sayfaya dön
        </button>
      </div>
    );
  }

  if (phase === "entry") {
    return (
      <EntryScreen
        assignment={assignment}
        groupCode={groupCode}
        students={students}
        drawnStudentIds={drawnStudentIds}
        onStart={(list) => { setParticipants(list); setPhase("game"); }}
      />
    );
  }

  return (
    <BookGameScreen
      assignmentId={assignmentId}
      groupCode={groupCode}
      taskName={assignment.title}
      endDate={assignment.dueDate}
      students={participants}
      initialDraws={initialDraws}
    />
  );
}
