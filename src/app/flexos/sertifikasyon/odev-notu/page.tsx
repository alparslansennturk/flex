"use client";

/**
 * FlexOS · Ödev Notu — Claude Design çıktısından (`Ödev Notu Verme.dc.html`) BİREBİR
 * UI portu. İki görünüm: (1) grup seç + ödev listesi (durum özeti), (2) seçili ödev
 * için öğrenci bazlı puanlama (teslim durumu + puan + gecikme cezası + net puan).
 *
 * Kullanıcı notu: normalde bu puan elle girilmeyecek, öğrencinin gerçek teslim
 * durumuna göre OTOMATİK hesaplanıp sabitlenecek — ama bu henüz backend'e bağlı
 * değil (kullanıcı kararı: "UI kısmını en önce yapalım", Sertifika Notu'yla aynı
 * desen). Grup/ödev/öğrenci listesi GERÇEK veri (groups/assignments/roster) —
 * teslim durumu her öğrenci için gerçek Submission'dan ÖN-DOLDURULUYOR (var olan
 * teslim → "Teslim etti" başlangıç değeri, yoksa "Teslim etmedi"), ama puan/durum
 * değişiklikleri ve "Notları Kaydet" backend'e YAZMIYOR (henüz Grade domain'i yok).
 * `maxPuan` sabit 100 — Assignment'ta puan alanı henüz yok.
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Award, BookOpen, Check, ArrowLeft, ClipboardList, ChevronRight, Clock } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import type { RosterItem } from "../../siniflar/_shared/groupDisplay";

interface GroupItem { id: string; code: string; branch: string; enrolled: number }
interface AssignmentItem { id: string; title: string; dueDate?: string; status: string }
interface SubmissionRow { id: string; personId: string; status: string }

type TeslimDurum = "teslim" | "gec1" | "gec2" | "yok";
interface StudentGradeState { durum: TeslimDurum; puan: string }

const MAX_PUAN = 100; // Assignment'ta henüz puan alanı yok — sabit varsayım
const CEZA_ORANI: Record<TeslimDurum, number> = { teslim: 0, gec1: 0.10, gec2: 0.20, yok: 1 };
const DURUM_META: Record<TeslimDurum, { label: string; color: string; bg: string; dot: string }> = {
  teslim: { label: "Teslim etti", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" },
  gec1: { label: "1 hafta gecikmeli", color: "#8A5A00", bg: "#FFF3DC", dot: "#FFB020" },
  gec2: { label: "2 hafta+ gecikmeli", color: "#C2410C", bg: "#FFEAD7", dot: "#F97316" },
  yok: { label: "Teslim etmedi", color: "#C22B2B", bg: "#FDE1E1", dot: "#E53935" },
};

const GROUP_COLORS = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#1CB5AE", "#F91079"];
const AVATAR_PALETTES: [string, string][] = [
  ["#689adf", "#2867bd"], ["#F76FA3", "#F91079"], ["#67B5B6", "#1CB5AE"],
  ["#C79BF0", "#8B44D6"], ["#F9B36F", "#E8830F"], ["#7FCE8E", "#2E9E4A"],
];
function groupColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}
function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toLocaleUpperCase("tr");
}
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function OdevNotuPage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [loadingGrading, setLoadingGrading] = useState(false);
  // assignmentId -> (personId -> state) — her ödev için ayrı, sekmeler arası korunur
  const [gradesByAssignment, setGradesByAssignment] = useState<Record<string, Record<string, StudentGradeState>>>({});

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) {
        const data = await res.json() as { items: GroupItem[] };
        setGroups(data.items);
        if (data.items.length > 0) setSelectedGroupId((cur) => cur ?? data.items[0].id);
      }
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    if (!selectedGroupId) return;
    setActiveAssignmentId(null);
    (async () => {
      setLoadingAssignments(true);
      try {
        const headers = await authHeaders();
        const [assignRes, rosterRes] = await Promise.all([
          fetch(`/api/flexos/assignments?groupId=${selectedGroupId}`, { headers }),
          fetch(`/api/flexos/groups/${selectedGroupId}/roster`, { headers }),
        ]);
        setAssignments(assignRes.ok ? (await assignRes.json() as { items: AssignmentItem[] }).items : []);
        setRoster(rosterRes.ok ? (await rosterRes.json() as { items: RosterItem[] }).items : []);
      } finally {
        setLoadingAssignments(false);
      }
    })();
  }, [selectedGroupId]);

  async function openAssignment(assignmentId: string) {
    setActiveAssignmentId(assignmentId);
    if (gradesByAssignment[assignmentId]) return; // zaten yüklendi/düzenlendi

    setLoadingGrading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/submissions?assignmentId=${assignmentId}`, { headers });
      const submissions: SubmissionRow[] = res.ok ? (await res.json() as { items: SubmissionRow[] }).items : [];
      const byPerson = new Map(submissions.map((s) => [s.personId, s]));
      const initial: Record<string, StudentGradeState> = {};
      for (const r of roster) {
        const sub = byPerson.get(r.personId);
        initial[r.personId] = { durum: sub ? "teslim" : "yok", puan: sub ? "" : "" };
      }
      setGradesByAssignment((prev) => ({ ...prev, [assignmentId]: initial }));
    } finally {
      setLoadingGrading(false);
    }
  }

  function setDurum(assignmentId: string, personId: string, durum: TeslimDurum) {
    setGradesByAssignment((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], [personId]: { ...prev[assignmentId]?.[personId], durum, puan: prev[assignmentId]?.[personId]?.puan ?? "" } },
    }));
  }
  function setPuan(assignmentId: string, personId: string, raw: string) {
    const val = raw === "" ? "" : String(Math.max(0, Math.min(MAX_PUAN, parseInt(raw, 10) || 0)));
    setGradesByAssignment((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], [personId]: { ...prev[assignmentId]?.[personId], puan: val, durum: prev[assignmentId]?.[personId]?.durum ?? "teslim" } },
    }));
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const activeAssignment = assignments.find((a) => a.id === activeAssignmentId) ?? null;
  const activeGrades = activeAssignmentId ? gradesByAssignment[activeAssignmentId] ?? {} : {};

  function assignmentStatusMeta(assignmentId: string): { label: string; color: string; bg: string; dot: string } {
    const grades = gradesByAssignment[assignmentId];
    if (!grades) return { label: "Bekliyor", color: "#8E95A3", bg: "#F2F4F7", dot: "#AEB4C0" };
    const puanlanan = roster.filter((r) => grades[r.personId]).length;
    if (puanlanan === 0) return { label: "Bekliyor", color: "#8E95A3", bg: "#F2F4F7", dot: "#AEB4C0" };
    if (puanlanan === roster.length) return { label: "Tamamlandı", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" };
    return { label: `${puanlanan}/${roster.length} puanlandı`, color: "#8A5A00", bg: "#FFF3DC", dot: "#FFB020" };
  }

  let girilenSayisi = 0;
  for (const r of roster) if (activeGrades[r.personId]) girilenSayisi++;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="odev-notu" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<Award size={20} color="#fff" />}
          title="Ödev Notu"
          subtitle="Grup ve ödev seçin, teslim durumuna göre puanlayın."
          roleLabel="Eğitmen"
        />

        {!activeAssignmentId ? (
          /* ===== VIEW 1: Grup + Ödev Seçimi ===== */
          <div style={{ padding: "26px 30px 48px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter">
            <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr", alignItems: "start" }}>

              {/* SOL: gruplar */}
              <div className="bg-white border border-[#E2E5EA] rounded-[20px] p-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] sticky" style={{ top: 96 }}>
                <div className="flex items-center gap-[9px] mb-4">
                  <div className="w-8 h-8 rounded-[10px] bg-[#DDE8F8] text-[#205297] flex items-center justify-center">
                    <BookOpen size={17} />
                  </div>
                  <div>
                    <div className="text-[14px] font-extrabold text-[#1E222B] tracking-tight">Gruplar</div>
                    <div className="text-[11px] text-[#8E95A3] font-medium">Ödevleri görmek için seçin</div>
                  </div>
                </div>
                <div className="flex flex-col gap-[7px]">
                  {loadingGroups ? (
                    <p className="text-[12px] text-[#8E95A3] py-4 text-center">Yükleniyor…</p>
                  ) : groups.length === 0 ? (
                    <p className="text-[12px] text-[#8E95A3] py-4 text-center">Henüz grup yok.</p>
                  ) : (
                    groups.map((g) => {
                      const active = g.id === selectedGroupId;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setSelectedGroupId(g.id)}
                          className="w-full flex items-center gap-[11px] py-[11px] px-3 rounded-[13px] cursor-pointer transition-all"
                          style={{
                            border: active ? "1px solid #AECBF2" : "1px solid #EEF0F3",
                            background: active ? "#EFF5FE" : "#fff",
                            boxShadow: active ? "0 4px 14px -8px rgba(32,82,151,.4)" : "none",
                          }}
                        >
                          <div className="rounded-full shrink-0" style={{ width: 4, alignSelf: "stretch", minHeight: 30, background: groupColor(g.id) }} />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-[13.5px] font-extrabold text-[#1E222B] tracking-tight">{g.code}</div>
                            <div className="text-[11px] text-[#8E95A3] font-medium mt-0.5">{g.branch} • {g.enrolled} öğrenci</div>
                          </div>
                          {active && <Check size={16} strokeWidth={2.6} color="#205297" className="shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SAĞ: ödev listesi */}
              <div className="flex flex-col gap-4 min-w-0">
                <div className="flex items-center gap-[13px] bg-white border border-[#E2E5EA] rounded-[18px] py-4 px-5 shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)]">
                  <div className="rounded-full shrink-0" style={{ width: 5, alignSelf: "stretch", minHeight: 40, background: selectedGroup ? groupColor(selectedGroup.id) : "#CDD2DA" }} />
                  <div>
                    <div className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">{selectedGroup?.code ?? "—"} Ödevleri</div>
                    <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{selectedGroup ? `${selectedGroup.branch} • ${roster.length} öğrenci` : ""} — puanlamak için bir ödev seçin</div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E5EA] rounded-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-hidden">
                  <div className="grid gap-3.5 items-center py-3.5 px-[22px] border-b border-[#EEF0F3] bg-[#FBFCFD]" style={{ gridTemplateColumns: "2.2fr 1fr 1.3fr 90px" }}>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Ödev</div>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Puan</div>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Durum</div>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-right">İşlem</div>
                  </div>

                  {loadingAssignments ? (
                    <div className="py-10 text-center text-[13px] text-[#8E95A3]">Yükleniyor…</div>
                  ) : assignments.length === 0 ? (
                    <div className="py-10 text-center text-[13px] text-[#8E95A3]">Bu gruba ait ödev yok.</div>
                  ) : (
                    assignments.map((a, i) => {
                      const meta = assignmentStatusMeta(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => openAssignment(a.id)}
                          className="w-full text-left grid gap-3.5 items-center py-3.5 px-[22px] cursor-pointer bg-white hover:bg-[#FBFCFD] transition-colors"
                          style={{ gridTemplateColumns: "2.2fr 1fr 1.3fr 90px", borderBottom: i < assignments.length - 1 ? "1px solid #F2F4F7" : "none" }}
                        >
                          <div className="flex items-center gap-[13px] min-w-0">
                            <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-[#DDE8F8] text-[#205297]">
                              <ClipboardList size={20} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[14.5px] font-extrabold text-[#1E222B] tracking-tight truncate">{a.title}</div>
                              <div className="text-[11.5px] text-[#8E95A3] font-medium mt-0.5">Son teslim: {fmtDate(a.dueDate)}</div>
                            </div>
                          </div>
                          <div className="flex items-baseline gap-1 justify-center">
                            <span className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">{MAX_PUAN}</span>
                            <span className="text-[11px] font-bold text-[#8E95A3]">puan</span>
                          </div>
                          <div className="flex items-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-bold" style={{ padding: "4px 11px", color: meta.color, background: meta.bg }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[12.5px] font-bold text-[#205297] whitespace-nowrap">
                            Puanla <ChevronRight size={14} strokeWidth={2.6} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===== VIEW 2: Ödev Puanlama ===== */
          <div style={{ padding: "26px 30px 48px" }} className="font-inter flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveAssignmentId(null)}
                className="inline-flex items-center gap-[7px] py-2.5 px-[15px] rounded-[11px] border border-[#E2E5EA] bg-white text-[#414B59] text-[13px] font-bold cursor-pointer hover:bg-[#F7F8FA] transition-colors"
              >
                <ArrowLeft size={15} strokeWidth={2.5} /> Geri
              </button>
              <div className="text-[12.5px] text-[#8E95A3] font-semibold">
                {selectedGroup?.code} <span className="text-[#CDD2DA]">/</span> <span className="text-[#414B59] font-bold">{activeAssignment?.title}</span>
              </div>
            </div>

            <div className="bg-white border border-[#E2E5EA] rounded-[18px] py-[18px] px-[22px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-[46px] h-[46px] rounded-[13px] shrink-0 flex items-center justify-center bg-[#DDE8F8] text-[#205297]">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <div className="text-[17px] font-extrabold text-[#1E222B] tracking-tight">{activeAssignment?.title}</div>
                  <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{selectedGroup?.code} • {selectedGroup?.branch} • Son teslim: {fmtDate(activeAssignment?.dueDate)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 py-[9px] px-3.5 rounded-[11px] bg-[#EFF5FE] border border-[#D3E3F8]">
                  <span className="text-[11px] font-bold text-[#6F7B87]">Ödev Puanı</span>
                  <span className="text-[14px] font-extrabold text-[#205297]">{MAX_PUAN}</span>
                </div>
                <div className="flex items-center gap-2 py-[9px] px-3.5 rounded-[11px] bg-[#FFF3E9] border border-[#F7D9BF]">
                  <Clock size={15} color="#C2410C" />
                  <span className="text-[11.5px] font-bold text-[#C2410C]">Gecikme cezası: her kademe %10</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E2E5EA] rounded-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-hidden">
              <div className="grid gap-3 items-center py-[15px] px-[22px] border-b border-[#EEF0F3] bg-[#FBFCFD]" style={{ gridTemplateColumns: "1.7fr 1.5fr 1fr 0.9fr 1fr" }}>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Öğrenci</div>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Teslim Durumu</div>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Ödev Puanı</div>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Gecikme Cezası</div>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Net Puan</div>
              </div>

              {loadingGrading ? (
                <div className="py-10 text-center text-[13px] text-[#8E95A3]">Yükleniyor…</div>
              ) : roster.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-[#8E95A3]">Bu grupta öğrenci yok.</div>
              ) : (
                roster.map((r, i) => {
                  const state = activeGrades[r.personId] ?? { durum: "teslim" as TeslimDurum, puan: "" };
                  const dm = DURUM_META[state.durum];
                  const teslimEtmedi = state.durum === "yok";
                  const raw = state.puan === "" ? null : Number(state.puan);
                  const oran = CEZA_ORANI[state.durum];
                  let net: number | null = null;
                  let ceza: number | null = null;
                  if (teslimEtmedi) { net = 0; ceza = null; }
                  else if (raw != null) { ceza = Math.round(raw * oran); net = raw - ceza; }
                  const pal = AVATAR_PALETTES[i % AVATAR_PALETTES.length];

                  return (
                    <div key={r.personId} className="grid gap-3 items-center py-[13px] px-[22px]" style={{ gridTemplateColumns: "1.7fr 1.5fr 1fr 0.9fr 1fr", borderBottom: i < roster.length - 1 ? "1px solid #F2F4F7" : "none" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-[13.5px] font-bold" style={{ background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>
                          {initials(r.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-[#1E222B] truncate">{r.name}</div>
                        </div>
                      </div>
                      <div className="relative">
                        <select
                          value={state.durum}
                          onChange={(e) => setDurum(activeAssignmentId, r.personId, e.target.value as TeslimDurum)}
                          className="w-full py-2.5 pl-3.5 pr-8 rounded-[10px] text-[12.5px] font-bold outline-none cursor-pointer appearance-none"
                          style={{ border: `1px solid ${state.durum === "teslim" ? "#E2E5EA" : dm.dot + "80"}`, background: state.durum === "teslim" ? "#fff" : dm.bg, color: dm.color }}
                        >
                          <option value="teslim">Teslim etti</option>
                          <option value="gec1">1 hafta gecikmeli</option>
                          <option value="gec2">2 hafta+ gecikmeli</option>
                          <option value="yok">Teslim etmedi</option>
                        </select>
                        <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" color="#8E95A3" />
                      </div>
                      <div className="flex justify-center">
                        <input
                          className="gradeInput w-[84px] text-center py-2 px-2 rounded-[10px] border border-[#E2E5EA] text-[14px] font-bold outline-none"
                          type="number" min={0} max={MAX_PUAN}
                          disabled={teslimEtmedi}
                          placeholder={teslimEtmedi ? "—" : `0-${MAX_PUAN}`}
                          value={teslimEtmedi ? "" : state.puan}
                          onChange={(e) => setPuan(activeAssignmentId, r.personId, e.target.value)}
                          style={{ background: teslimEtmedi ? "#F2F4F7" : "#fff", color: teslimEtmedi ? "#CDD2DA" : "#1E222B", cursor: teslimEtmedi ? "not-allowed" : "text" }}
                        />
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="text-[12.5px] font-bold" style={{ color: teslimEtmedi ? "#C22B2B" : ceza ? "#C2410C" : "#AEB4C0" }}>
                          {teslimEtmedi ? "Teslim yok" : ceza == null ? "—" : ceza === 0 ? "Ceza yok" : `−${ceza}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-center">
                        <span
                          className="inline-flex items-baseline gap-0.5 justify-center rounded-[10px] font-extrabold"
                          style={{ minWidth: 58, padding: "7px 12px", fontSize: 15, letterSpacing: "-.3px", color: net == null ? "#AEB4C0" : teslimEtmedi ? "#C22B2B" : "#1E222B", background: net == null ? "#F7F8FA" : teslimEtmedi ? "#FDE1E1" : "#EFF5FE" }}
                        >
                          {net == null ? "—" : net}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="flex items-center justify-between gap-4 py-4 px-[22px] border-t border-[#EEF0F3] bg-[#FBFCFD] flex-wrap">
                <div className="text-[12.5px] text-[#6F7B87] font-semibold">{girilenSayisi} / {roster.length} öğrenci değerlendirildi</div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => toast.info("Bu özellik yakında.")}
                    className="py-[11px] px-[18px] rounded-[11px] border border-[#E2E5EA] bg-white text-[#414B59] text-[13px] font-bold cursor-pointer hover:bg-[#F7F8FA] transition-colors"
                  >
                    Taslak Kaydet
                  </button>
                  <button
                    onClick={() => toast.info("Bu özellik yakında.")}
                    className="inline-flex items-center gap-1.5 py-[11px] px-5 rounded-[11px] border-none text-white text-[13px] font-extrabold cursor-pointer transition-transform hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg,#1F9D57,#0E7A3E)", boxShadow: "0 10px 20px -8px rgba(14,122,62,.5)" }}
                  >
                    <Check size={16} strokeWidth={2.4} />
                    Notları Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}
