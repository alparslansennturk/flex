"use client";

/**
 * FlexOS · Sertifika Notu — Claude Design çıktısından (`Sertifika Notu Verme.dc.html`)
 * BİREBİR UI portu. Kullanıcı kararı: "UI kısmını en önce yapalım" — bu turda backend
 * YOK (`Grade` domain entity zaten var — `domain/education/grade.ts` — ama repo/servis/
 * route hiç kurulmadı). Notlar SADECE local state'te tutulur, "Taslak Kaydet"/
 * "Notları Gönder" butonları backend hazır olana kadar "yakında" toast'ı verir.
 * Grup/öğrenci listesi GERÇEK veri (GET /api/flexos/groups + roster) — sahte veri yok.
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Award, BookOpen, Check } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import type { RosterItem } from "../../siniflar/_shared/groupDisplay";

interface GroupItem { id: string; code: string; branch: string; enrolled: number }

interface GradeEntry { sertifika: string; odev: string }

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
function clamp100(raw: string): string {
  if (raw === "") return "";
  const n = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
  return String(n);
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function SertifikaNotuPage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [odevAktif, setOdevAktif] = useState(true);
  const [grades, setGrades] = useState<Record<string, GradeEntry>>({});

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) {
        const data = await res.json() as { items: GroupItem[] };
        setGroups(data.items);
        if (data.items.length > 0) setSelectedId((cur) => cur ?? data.items[0].id);
      }
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoadingRoster(true);
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/groups/${selectedId}/roster`, { headers });
        if (res.ok) setRoster((await res.json() as { items: RosterItem[] }).items);
        else setRoster([]);
      } finally {
        setLoadingRoster(false);
      }
    })();
  }, [selectedId]);

  function setGrade(personId: string, field: keyof GradeEntry, raw: string) {
    const val = clamp100(raw);
    setGrades((prev) => ({ ...prev, [personId]: { ...(prev[personId] ?? { sertifika: "", odev: "" }), [field]: val } }));
  }

  function computeTotal(entry: GradeEntry | undefined): number | null {
    const s = entry?.sertifika === "" || entry?.sertifika == null ? null : Number(entry.sertifika);
    const o = entry?.odev === "" || entry?.odev == null ? null : Number(entry.odev);
    if (odevAktif) {
      if (s == null) return null;
      return Math.round(s * 0.7 + (o ?? 0) * 0.3);
    }
    return s == null ? null : Math.round(s);
  }

  const selected = groups.find((g) => g.id === selectedId) ?? null;
  const girilenCount = roster.filter((r) => computeTotal(grades[r.personId]) != null).length;
  const gridCols = odevAktif ? "1.6fr 1fr 1fr 1fr 1fr" : "1.8fr 1.2fr 1.2fr 1.2fr";

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="sertifika-notu" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<Award size={20} color="#fff" />}
          title="Sertifika Notu"
          subtitle="Grup seçin, öğrencilere sertifika ve ödev notu girin."
          roleLabel="Eğitmen"
        />

        <div style={{ padding: "26px 30px 48px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter">
          <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr", alignItems: "start" }}>

            {/* ===== SOL: Grup seçimi ===== */}
            <div className="bg-white border border-[#E2E5EA] rounded-[20px] p-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] sticky" style={{ top: 96 }}>
              <div className="flex items-center gap-[9px] mb-4">
                <div className="w-8 h-8 rounded-[10px] bg-[#DDE8F8] text-[#205297] flex items-center justify-center">
                  <BookOpen size={17} />
                </div>
                <div>
                  <div className="text-[14px] font-extrabold text-[#1E222B] tracking-tight">Gruplar</div>
                  <div className="text-[11px] text-[#8E95A3] font-medium">Not vermek için seçin</div>
                </div>
              </div>
              <div className="flex flex-col gap-[7px]">
                {loadingGroups ? (
                  <p className="text-[12px] text-[#8E95A3] py-4 text-center">Yükleniyor…</p>
                ) : groups.length === 0 ? (
                  <p className="text-[12px] text-[#8E95A3] py-4 text-center">Henüz grup yok.</p>
                ) : (
                  groups.map((g) => {
                    const active = g.id === selectedId;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setSelectedId(g.id)}
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

            {/* ===== SAĞ: Not tablosu ===== */}
            <div className="flex flex-col gap-4 min-w-0">

              {/* toolbar */}
              <div className="bg-white border border-[#E2E5EA] rounded-[18px] py-4 px-5 shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-[13px] min-w-0">
                  <div className="rounded-full shrink-0" style={{ width: 5, alignSelf: "stretch", minHeight: 40, background: selected ? groupColor(selected.id) : "#CDD2DA" }} />
                  <div>
                    <div className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">{selected?.code ?? "—"}</div>
                    <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{selected ? `${selected.branch} • ${roster.length} öğrenci` : ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="text-right leading-tight">
                      <div className="text-[12.5px] font-bold text-[#1E222B]">Ödev Notu</div>
                      <div className="text-[10.5px] text-[#8E95A3] font-medium">{odevAktif ? "Aktif" : "Kapalı"}</div>
                    </div>
                    <button
                      onClick={() => setOdevAktif((v) => !v)}
                      className="relative rounded-full cursor-pointer border-none p-0 transition-colors"
                      style={{ width: 44, height: 25, background: odevAktif ? "#1F9D57" : "#CDD2DA" }}
                    >
                      <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 3, left: odevAktif ? 22 : 3, width: 19, height: 19 }} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 py-2 px-[13px] rounded-[11px] bg-[#F7F8FA] border border-[#EEF0F3]">
                    <span className="text-[11px] font-bold text-[#6F7B87]">Ağırlık</span>
                    <span className="text-[12px] font-extrabold text-[#205297]">{odevAktif ? "Sertifika %70 · Ödev %30" : "Sertifika %100"}</span>
                  </div>
                </div>
              </div>

              {/* table */}
              <div className="bg-white border border-[#E2E5EA] rounded-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-hidden">
                <div className="grid gap-3 items-center py-[15px] px-[22px] border-b border-[#EEF0F3] bg-[#FBFCFD]" style={{ gridTemplateColumns: gridCols }}>
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Öğrenci</div>
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">
                    Sertifika Notu<br /><span className="text-[10px] font-semibold normal-case text-[#AEB4C0]">{odevAktif ? "%70" : "%100"}</span>
                  </div>
                  {odevAktif && (
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">
                      Ödev Notu<br /><span className="text-[10px] font-semibold normal-case text-[#AEB4C0]">%30</span>
                    </div>
                  )}
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Toplam Not</div>
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-left">Durum</div>
                </div>

                {loadingRoster ? (
                  <div className="py-10 text-center text-[13px] text-[#8E95A3]">Yükleniyor…</div>
                ) : roster.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[#8E95A3]">Bu grupta öğrenci yok.</div>
                ) : (
                  roster.map((r, i) => {
                    const entry = grades[r.personId];
                    const total = computeTotal(entry);
                    const bos = total == null;
                    const gecti = !bos && total >= 50;
                    const pal = AVATAR_PALETTES[i % AVATAR_PALETTES.length];
                    let durumLabel = "", durumColor = "", durumBg = "", dotColor = "";
                    if (!bos && gecti) {
                      if (total >= 90) { durumLabel = "Başarı Srtf."; durumColor = "#007A30"; durumBg = "#E6F5ED"; dotColor = "#009F3E"; }
                      else { durumLabel = "Katılım Srtf."; durumColor = "#205297"; durumBg = "#DDE8F8"; dotColor = "#3A7BD5"; }
                    }
                    return (
                      <div
                        key={r.personId}
                        className="grid gap-3 items-center py-[13px] px-[22px]"
                        style={{ gridTemplateColumns: gridCols, borderBottom: i < roster.length - 1 ? "1px solid #F2F4F7" : "none" }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-[13.5px] font-bold"
                            style={{ background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}
                          >
                            {initials(r.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-bold text-[#1E222B] truncate">{r.name}</div>
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <input
                            className="gradeInput w-[78px] text-center py-2 px-2 rounded-[10px] border border-[#E2E5EA] bg-white text-[14px] font-bold text-[#1E222B] outline-none"
                            type="number" min={0} max={100} placeholder="0-100"
                            value={entry?.sertifika ?? ""}
                            onChange={(e) => setGrade(r.personId, "sertifika", e.target.value)}
                          />
                        </div>
                        {odevAktif && (
                          <div className="flex justify-center">
                            <input
                              className="gradeInput w-[78px] text-center py-2 px-2 rounded-[10px] border border-[#E2E5EA] bg-white text-[14px] font-bold text-[#1E222B] outline-none"
                              type="number" min={0} max={100} placeholder="0-100"
                              value={entry?.odev ?? ""}
                              onChange={(e) => setGrade(r.personId, "odev", e.target.value)}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-center">
                          <span
                            className="inline-flex items-center justify-center rounded-[10px] font-extrabold"
                            style={{
                              minWidth: 48, padding: "7px 12px", fontSize: 15, letterSpacing: "-.3px",
                              color: bos ? "#AEB4C0" : gecti ? "#007A30" : "#C22B2B",
                              background: bos ? "#F7F8FA" : gecti ? "#E6F5ED" : "#FDE1E1",
                            }}
                          >
                            {bos ? "—" : total}
                          </span>
                        </div>
                        <div className="flex items-center justify-start">
                          {durumLabel ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap" style={{ padding: "4px 12px", color: durumColor, background: durumBg }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                              {durumLabel}
                            </span>
                          ) : (
                            <span className="w-[22px] h-[3px] rounded-[2px] bg-[#CDD2DA] shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="flex items-center justify-between gap-4 py-4 px-[22px] border-t border-[#EEF0F3] bg-[#FBFCFD] flex-wrap">
                  <div className="text-[12.5px] text-[#6F7B87] font-semibold">{girilenCount} / {roster.length} öğrenciye not girildi</div>
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
                      Notları Gönder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}
