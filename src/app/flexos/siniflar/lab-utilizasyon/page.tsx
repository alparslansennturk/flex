"use client";

/**
 * FlexOS · Gruplar — Lab Utilizasyon.
 * Tasarım: Claude Design "Laboratuvar Utilizasyonu.dc.html" (proje "Flex-Eğitim
 * Yönetimi") birebir React'e portlandı. Sidebar/header dışındaki tüm içerik
 * (toolbar, lab rail, hero, haftalık/günlük/aylık/liste görünümleri, Planlama Yap
 * modalı, Uygun Seansları Göster modalı) tasarımdaki hesaplama mantığıyla aynı —
 * seans verisi deterministik seed'li mock (gerçek Lab/Group ilişkisi henüz yok).
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { authHeaders } from "@/app/lib/client/auth-headers";
import {
  AX_END, AX_START, ANCHOR, Block, DOW, DOW_FULL, HOURH, Lab, ListRow, MONTHS, NOW_MIN, PageState, RawItem, SeansSlot, TODAY, ViewKey,
} from "./_shared/types";
import {
  addDays, dayUtil, firstFreeRange, firstFreeSession, freeGaps, isoDate, mondayOf, monthUtil, parseISO, sessionsFor, setSeansPool, toMin, fmtTime, weekUtil,
} from "./_shared/mockEngine";
import { T, cardBox, heatColor } from "./_shared/theme";
import { Toolbar } from "./_shared/Toolbar";
import { FilterPanel } from "./_shared/FilterPanel";
import { LabRail, LabItem } from "./_shared/LabRail";
import { HeroSection, OpportunityCard } from "./_shared/HeroSection";
import { ViewCardHeader } from "./_shared/ViewCardHeader";
import { TimelineView } from "./_shared/TimelineView";
import { MonthHeatmapView, HeatCell } from "./_shared/MonthHeatmapView";
import { ListTableView } from "./_shared/ListTableView";
import { PlanModal } from "./_shared/PlanModal";
import { SlotsModal } from "./_shared/SlotsModal";
import { CardDetailModal, CardDetail } from "./_shared/CardDetailModal";
import { LabAddModal } from "./_shared/LabAddModal";

export default function LabUtilizasyonPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
    })();
  }, [router]);

  const [state, setState] = useState<PageState>({
    view: "week", sel: "", weekOffset: 0, dayISO: isoDate(TODAY), monthOffset: 0, dolulukView: "week",
    filtersOpen: false, fSube: "Tümü", fType: "Tümü", fStatus: "Tümü", fCap: "Tümü", fOs: "Tümü",
    planOpen: false, planDate: isoDate(TODAY), planStart: "600", planDur: "150", planCap: "0",
    slotsOpen: false, slotsView: "list", sRange: "week", sDay: "Tümü", sMin: "0", sStatus: "all",
  });
  const patch = (p: Partial<PageState>) => setState((st) => ({ ...st, ...p }));

  // ── gerçek laboratuvar listesi (Firestore) — seans/doluluk verisi hâlâ mock ──
  const [labs, setLabs] = useState<Lab[]>([]);
  const [officeOptions, setOfficeOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [labModalOpen, setLabModalOpen] = useState(false);
  // ders kartına tıklayınca açılan küçük detay modalı (mock program tarihleri dahil)
  const [cardDetail, setCardDetail] = useState<CardDetail | null>(null);
  const [newLabName, setNewLabName] = useState("");
  const [newLabType, setNewLabType] = useState<"windows" | "mac">("windows");
  const [newLabCapacity, setNewLabCapacity] = useState("");
  const [newLabOffice, setNewLabOffice] = useState("");
  const [savingLab, setSavingLab] = useState(false);

  const loadLabs = React.useCallback(async () => {
    const headers = await authHeaders();
    const [labsRes, officesRes, seansRes] = await Promise.all([
      fetch("/api/flexos/labs", { headers }),
      fetch("/api/flexos/branch-offices", { headers }),
      fetch("/api/flexos/seanslar", { headers }),
    ]);
    const labsJson = labsRes.ok ? await labsRes.json() : { items: [] };
    const officesJson = officesRes.ok ? await officesRes.json() : { items: [] };
    const seansJson = seansRes.ok ? await seansRes.json() : { items: [] };
    const offices: { id: string; name: string }[] = officesJson.items ?? [];
    const officeMap = new Map(offices.map((o) => [o.id, o.name]));
    setOfficeOptions(offices);
    setLabs((labsJson.items ?? []).map((l: { id: string; name: string; type: string; capacity: number; branchOfficeId: string }) => ({
      id: l.id,
      name: l.name,
      type: l.type === "mac" ? "Mac" : "Windows",
      capacity: l.capacity,
      sube: officeMap.get(l.branchOfficeId) ?? "",
    })));
    // gerçek Seans (haftalık ders kalıbı) kayıtlarını gün+saat aralıklarına aç —
    // mock doluluk üretici artık rastgele saat yerine bunlardan seçim yapıyor
    const pool: SeansSlot[] = [];
    (seansJson.items ?? []).forEach((sn: { days: number[]; startTime: string; endTime: string }) => {
      const s = toMin(sn.startTime), e = toMin(sn.endTime);
      sn.days.forEach((dow) => pool.push({ dow, s, e }));
    });
    setSeansPool(pool);
    setLoadingLabs(false);
  }, []);

  useEffect(() => { if (authed) void loadLabs(); }, [authed, loadLabs]);

  const openLabModal = () => {
    setNewLabName(""); setNewLabType("windows"); setNewLabCapacity(""); setNewLabOffice("");
    setLabModalOpen(true);
  };

  const saveLab = async () => {
    if (!newLabName.trim()) { toast.error("Laboratuvar adı zorunludur."); return; }
    if (!newLabOffice) { toast.error("Şube seçimi zorunludur."); return; }
    if (!newLabCapacity || Number(newLabCapacity) <= 0) { toast.error("Geçerli bir kapasite girin."); return; }
    setSavingLab(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/flexos/labs", {
        method: "POST", headers,
        body: JSON.stringify({ name: newLabName.trim(), type: newLabType, capacity: Number(newLabCapacity), branchOfficeId: newLabOffice }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Laboratuvar oluşturulamadı."); return; }
      toast.success("Laboratuvar oluşturuldu.");
      setLabModalOpen(false);
      await loadLabs();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSavingLab(false);
    }
  };

  if (authed === null) return null;

  const s = state;
  const todayISO = isoDate(TODAY);
  const weekMon = addDays(mondayOf(ANCHOR), s.weekOffset * 7);
  const dayISO = s.dayISO || todayISO;
  const isWeekV = s.view === "week", isDayV = s.view === "day", isMonthV = s.view === "month", isListV = s.view === "list";

  if (loadingLabs || labs.length === 0) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", background: T.bg }}>
        <FlexSidebar active="lab-utilizasyon" />
        <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: T.bg, display: "flex", flexDirection: "column" }}>
          <FlexHeader
            icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>}
            title="Laboratuvar Utilizasyonu"
            subtitle="Laboratuvar doluluğunu izleyin, boş zamanları anında görün, planlama yapın."
            maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
          />
          <FlexPageContent style={{ padding: "24px 0 56px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {loadingLabs ? (
              <div style={{ fontSize: 13, color: T.mutedC, fontWeight: 600 }}>Yükleniyor…</div>
            ) : (
              <div style={{ textAlign: "center", maxWidth: 360 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>Henüz laboratuvar eklenmemiş</div>
                <div style={{ fontSize: 13, color: T.mutedC, lineHeight: 1.6, marginBottom: 18 }}>
                  Grup açarken hangi lab&apos;ın müsait olduğunu görebilmek için önce en az bir laboratuvar ekleyin.
                </div>
                <button type="button" onClick={openLabModal} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                  Laboratuvar Ekle
                </button>
              </div>
            )}
          </FlexPageContent>
          <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
        </main>
        <LabAddModal
          open={labModalOpen} onClose={() => setLabModalOpen(false)}
          name={newLabName} setName={setNewLabName}
          type={newLabType} setType={setNewLabType}
          capacity={newLabCapacity} setCapacity={setNewLabCapacity}
          officeId={newLabOffice} setOfficeId={setNewLabOffice}
          officeOptions={officeOptions} saving={savingLab} onSave={saveLab}
        />
      </div>
    );
  }

  // ---- seçili lab ----
  const sel = labs.find((l) => l.id === s.sel) || labs[0];
  const selSessionsToday = sessionsFor(labs, sel.id, todayISO);
  const nowSession = selSessionsToday.find((x) => NOW_MIN >= x.start && NOW_MIN < x.start + x.dur);
  const isBusyNow = !!nowSession;
  const selWeekPct = weekUtil(labs, sel.id, weekMon);
  const selMonthPct = monthUtil(labs, sel.id, ANCHOR);
  const freeSess = firstFreeSession(labs, sel.id, weekMon);

  const opportunityCards: OpportunityCard[] = [
    {
      key: "now", label: "Şu Anki Durum", icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
      value: isBusyNow ? "Dolu" : "Boş",
      sub: isBusyNow && nowSession ? (nowSession.group.split(" ")[0] + " · " + fmtTime(nowSession.start + nowSession.dur) + "’de biter") : "şu an ders yok",
      tone: isBusyNow ? "warn" : "ok",
    },
    {
      key: "sess", label: "İlk Uygun Seans", icon: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/>',
      value: freeSess ? fmtTime(freeSess.from) + "–" + fmtTime(freeSess.to) : "—",
      sub: freeSess ? freeSess.dowFull + " · tamamen boş" : "bu hafta boş seans yok",
      tone: "ok",
    },
  ].map((c) => {
    const toneC = c.tone === "ok" ? T.okC : c.tone === "warn" ? T.warnC : T.brand;
    const toneBg = c.tone === "ok" ? T.okBg : c.tone === "warn" ? T.warnBg : T.brandBg;
    return { ...c, toneC, toneBg };
  });

  // ---- lab rail ----
  const statusOf = (labId: string) => {
    const ss = sessionsFor(labs, labId, todayISO);
    return ss.some((x) => NOW_MIN >= x.start && NOW_MIN < x.start + x.dur);
  };
  const labItems: LabItem[] = labs.map((l) => {
    const active = l.id === s.sel;
    const busy = statusOf(l.id);
    const pct = weekUtil(labs, l.id, weekMon);
    const barC = T.brand;
    const fr = firstFreeRange(labs, l.id, todayISO, NOW_MIN);
    const slotText = fr ? fmtTime(fr.start) + "–" + fmtTime(fr.end) : "bugün yok";
    return { lab: l, active, busy, pct, barC, fr, slotText };
  });

  // ---- timeline ----
  const span = AX_END - AX_START, bodyH = (span / 60) * HOURH;
  const hourLabels: { label: string; top: string }[] = [];
  for (let h = 8; h <= 20; h++) hourLabels.push({ label: String(h).padStart(2, "0") + ":00", top: (((h * 60 - AX_START) / 60) * HOURH) + "px" });

  const buildBlocks = (labId: string, dISO: string, labName: string): Block[] => {
    const ss = sessionsFor(labs, labId, dISO);
    return ss.map((b) => {
      const top = ((b.start - AX_START) / 60) * HOURH;
      const h = (b.dur / 60) * HOURH - 4;
      return {
        group: b.group, instructor: b.instructor, students: String(b.students), isConflict: b.conflict, showDetail: h > 54,
        timeText: fmtTime(b.start) + "–" + fmtTime(b.start + b.dur), top, height: h, dISO, labName,
      };
    });
  };

  const colHeads: { top: string; bottom: string; isToday: boolean }[] = [];
  const tlColumns: { isToday: boolean; blocks: Block[] }[] = [];
  let tlCols = 6;
  if (isWeekV) {
    tlCols = 6;
    for (let i = 0; i < 6; i++) {
      const d = addDays(weekMon, i);
      const dISO = isoDate(d);
      const isT = dISO === todayISO;
      colHeads.push({ top: DOW[i], bottom: String(d.getDate()), isToday: isT });
      tlColumns.push({ isToday: isT, blocks: buildBlocks(sel.id, dISO, sel.name) });
    }
  } else if (isDayV) {
    tlCols = labs.length;
    const isT = dayISO === todayISO;
    labs.forEach((l) => {
      colHeads.push({ top: l.name, bottom: l.type + " · " + l.capacity, isToday: false });
      tlColumns.push({ isToday: isT, blocks: buildBlocks(l.id, dayISO, l.name) });
    });
  }
  const gutter = 64;
  // Fixed per-column width (not 1fr) so the grid keeps its natural size instead of
  // stretching to fill the card — otherwise a single day-view lab column (or a
  // handful of week-view days) blows up to the full width of the container.
  const colWidth = isDayV ? 170 : 128;
  const timelineWidth = gutter + tlCols * colWidth;

  // ---- aylık heatmap ----
  const monthBase = new Date(ANCHOR.getFullYear(), ANCHOR.getMonth() + s.monthOffset, 1);
  const mStart = mondayOf(monthBase);
  const heatCells: HeatCell[] = [];
  for (let i = 0; i < 35; i++) {
    const d = addDays(mStart, i);
    const dISO = isoDate(d);
    const inMonth = d.getMonth() === monthBase.getMonth();
    const dow = (d.getDay() + 6) % 7;
    const isSun = dow === 6;
    const pct = inMonth && !isSun ? dayUtil(labs, sel.id, dISO) : 0;
    const isToday = dISO === todayISO;
    const strong = pct >= 60;
    heatCells.push({
      num: d.getDate(), inMonth, isToday, strong, cellC: heatColor(pct, inMonth),
      pctText: isSun ? "—" : "%" + pct,
      tag: isSun ? "kapalı" : pct === 0 ? "boş" : pct >= 80 ? "dolu" : "",
    });
  }

  // ---- liste ----
  const listRows: ListRow[] = [];
  for (let i = 0; i < 6; i++) {
    const d = addDays(weekMon, i);
    const dISO = isoDate(d);
    sessionsFor(labs, sel.id, dISO).forEach((b) => {
      listRows.push({ day: DOW[i] + " " + d.getDate(), time: fmtTime(b.start) + "–" + fmtTime(b.start + b.dur), lab: sel.name, group: b.group, instructor: b.instructor, students: String(b.students), conflict: b.conflict });
    });
  }

  // ---- filtreler ----
  const fopt = (a: string[]) => ["Tümü", ...a];
  const filterSelects = [
    { label: "Şube", value: s.fSube, options: fopt(["Kadıköy", "Pendik", "Ümraniye"]), onChange: (v: string) => patch({ fSube: v }) },
    { label: "Laboratuvar Türü", value: s.fType, options: fopt(["Genel Lab", "Yazılım Lab", "Tasarım Lab"]), onChange: (v: string) => patch({ fType: v }) },
    { label: "Boş / Dolu", value: s.fStatus, options: fopt(["Boş", "Dolu"]), onChange: (v: string) => patch({ fStatus: v }) },
    { label: "Kapasite", value: s.fCap, options: fopt(["16+", "20+", "24+", "30+"]), onChange: (v: string) => patch({ fCap: v }) },
    { label: "İşletim Sistemi", value: s.fOs, options: fopt(["Windows", "Mac"]), onChange: (v: string) => patch({ fOs: v }) },
  ];
  const activeFilterCount = [s.fSube, s.fType, s.fStatus, s.fCap, s.fOs].filter((x) => x !== "Tümü").length;

  // ---- görünüm sekmeleri + aralık etiketi ----
  let rangeText = "";
  if (isWeekV) {
    const f = weekMon, l = addDays(weekMon, 5);
    rangeText = f.getMonth() === l.getMonth() ? (f.getDate() + "–" + l.getDate() + " " + MONTHS[f.getMonth()] + " " + f.getFullYear()) : (f.getDate() + " " + MONTHS[f.getMonth()] + " – " + l.getDate() + " " + MONTHS[l.getMonth()]);
  } else if (isDayV) {
    const d = parseISO(dayISO);
    rangeText = d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + " · " + DOW_FULL[(d.getDay() + 6) % 7];
  } else {
    rangeText = MONTHS[monthBase.getMonth()] + " " + monthBase.getFullYear();
  }
  const goPrev = () => { if (isWeekV) patch({ weekOffset: s.weekOffset - 1 }); else if (isDayV) patch({ dayISO: isoDate(addDays(parseISO(dayISO), -1)) }); else if (isMonthV) patch({ monthOffset: s.monthOffset - 1 }); };
  const goNext = () => { if (isWeekV) patch({ weekOffset: s.weekOffset + 1 }); else if (isDayV) patch({ dayISO: isoDate(addDays(parseISO(dayISO), 1)) }); else if (isMonthV) patch({ monthOffset: s.monthOffset + 1 }); };
  const goToday = () => patch({ weekOffset: 0, monthOffset: 0, dayISO: todayISO });

  // ---- planlama modalı ----
  const startOptions: { v: string; l: string }[] = [];
  for (let m = AX_START; m <= AX_END - 30; m += 30) startOptions.push({ v: String(m), l: fmtTime(m) });
  const durOptions = [{ v: "90", l: "1.5 saat" }, { v: "120", l: "2 saat" }, { v: "150", l: "2.5 saat" }, { v: "180", l: "3 saat" }, { v: "240", l: "4 saat" }];
  const capOptions = [{ v: "0", l: "Farketmez" }, { v: "16", l: "16+ kişi" }, { v: "20", l: "20+ kişi" }, { v: "24", l: "24+ kişi" }, { v: "30", l: "30 kişi" }];
  const pStart = Number.parseInt(s.planStart), pDur = Number.parseInt(s.planDur), pCap = Number.parseInt(s.planCap), pEnd = pStart + pDur;
  const planDateVal = s.planDate || todayISO;
  const pd = parseISO(planDateVal);
  const planSlotLabel = pd.getDate() + " " + MONTHS[pd.getMonth()] + ", " + fmtTime(pStart) + "–" + fmtTime(pEnd) + (pCap ? " · en az " + pCap + " kişi" : "");
  let planFit = 0;
  const planCandidates = labs.map((l) => {
    const ss = sessionsFor(labs, l.id, planDateVal);
    const overlap = ss.some((b) => b.start < pEnd && pStart < b.start + b.dur);
    const capOk = pCap ? l.capacity >= pCap : true;
    const dow = (pd.getDay() + 6) % 7;
    const closed = dow === 6;
    const fit = !overlap && capOk && !closed && pEnd <= AX_END;
    if (fit) planFit++;
    const reason = closed ? "Kapalı gün" : overlap ? "O saatte dolu" : !capOk ? "Kapasite < " + pCap : pEnd > AX_END ? "Saat dışı" : "Uygun";
    return { lab: l, fit, reason };
  });

  // ---- uygun seanslar modalı ----
  const sMinV = Number.parseInt(s.sMin);
  const sDayCount = s.sRange === "2week" ? 12 : 6;
  const slotDays: { d: Date; dISO: string }[] = [];
  for (let i = 0; i < sDayCount; i++) { const dd = addDays(weekMon, i); if ((dd.getDay() + 6) % 7 === 6) continue; slotDays.push({ d: dd, dISO: isoDate(dd) }); }
  const rawItems: RawItem[] = [];
  slotDays.forEach((day) => {
    const ss = sessionsFor(labs, sel.id, day.dISO);
    ss.forEach((b) => rawItems.push({ dow: DOW[(day.d.getDay() + 6) % 7], dowFull: DOW_FULL[(day.d.getDay() + 6) % 7], num: day.d.getDate(), start: b.start, end: b.start + b.dur, dur: b.dur, free: false, detail: b.group + " · " + b.instructor }));
    freeGaps(ss).forEach((g) => rawItems.push({ dow: DOW[(day.d.getDay() + 6) % 7], dowFull: DOW_FULL[(day.d.getDay() + 6) % 7], num: day.d.getDate(), start: g.start, end: g.start + g.dur, dur: g.dur, free: true, detail: "Tamamen boş" }));
  });
  rawItems.sort((a, b) => a.num - b.num || a.start - b.start);
  const filteredItems = rawItems.filter((it) => {
    if (s.sDay !== "Tümü" && it.dowFull !== s.sDay) return false;
    if (s.sStatus === "free" && !it.free) return false;
    if (s.sStatus === "busy" && it.free) return false;
    if (it.free && sMinV && it.dur < sMinV) return false;
    return true;
  });
  const freeItems = filteredItems.filter((x) => x.free);
  const busyCountAll = filteredItems.filter((x) => !x.free).length;
  const durTxt = (m: number) => { const h = m / 60; return (Number.isInteger(h) ? h : h.toFixed(1)) + " saat"; };
  const onPlanFromSlot = (dISO: string, start: number, dur: number) => patch({ slotsOpen: false, planOpen: true, planDate: dISO, planStart: String(start), planDur: String(Math.min(240, Math.max(90, dur))) });
  // "Rapor Al" — Liste görünümündeki (bu haftanın seansları) aynı satırları CSV olarak indirir.
  const exportListCsv = () => {
    if (!sel || listRows.length === 0) { toast.info("Aktarılacak seans bulunmuyor."); return; }
    const header = ["Gün", "Saat", "Laboratuvar", "Grup", "Eğitmen", "Öğrenci", "Durum"];
    const escape = (v: string) => '"' + v.replaceAll(/"/g, '""') + '"';
    const rows = listRows.map((r) => [r.day, r.time, r.lab, r.group, r.instructor, r.students, r.conflict ? "Çakışma" : "Rezerve"]);
    const csv = "﻿" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-utilizasyon_${sel.name.replaceAll(/[^\p{L}\p{N}]+/gu, "-")}_${isoDate(weekMon)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const calColumns = slotDays.slice(0, 6).map((day) => ({ d: day.d, items: filteredItems.filter((x) => x.num === day.d.getDate()) }));
  const totalFreeMin = freeItems.reduce((a, x) => a + x.dur, 0);
  const firstFree = freeItems[0];
  const longestFree = freeItems.reduce((mx, x) => (x.dur > mx.dur ? x : mx), { dur: 0 } as RawItem);
  const slotsSummary = [
    { label: "Toplam Uygun Saat", value: (totalFreeMin / 60).toFixed(totalFreeMin % 60 ? 1 : 0) + " saat" },
    { label: "İlk Uygun Seans", value: firstFree ? firstFree.dow + " " + fmtTime(firstFree.start) + "–" + fmtTime(firstFree.end) : "—" },
    { label: "En Uzun Kesintisiz Boş", value: longestFree.dur ? durTxt(longestFree.dur) : "—" },
  ];

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", background: T.bg, transition: "background .2s" }}>
      <FlexSidebar active="lab-utilizasyon" />

      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: T.bg, display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>}
          title="Laboratuvar Utilizasyonu"
          subtitle="Laboratuvar doluluğunu izleyin, boş zamanları anında görün, planlama yapın."
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        <FlexPageContent style={{ padding: "24px 0 56px", flex: 1 }}>
          <Toolbar
            view={s.view} onViewChange={(v: ViewKey) => patch({ view: v })}
            filtersOpen={s.filtersOpen} onToggleFilters={() => patch({ filtersOpen: !s.filtersOpen })}
            activeFilterCount={activeFilterCount}
            onExportCsv={exportListCsv}
            onShowSlots={() => patch({ slotsOpen: true })}
            onAddLab={openLabModal}
            onPlan={() => patch({ planOpen: true })}
          />

          <FilterPanel open={s.filtersOpen} filterSelects={filterSelects} />

          {/* CONTENT: lab rail + workspace */}
          <div style={{ display: "grid", gridTemplateColumns: "288px 1fr", gap: 20, alignItems: "start" }}>

            <LabRail labItems={labItems} onSelect={(labId) => patch({ sel: labId })} />

            {/* WORKSPACE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

              <HeroSection
                sel={sel} isBusyNow={isBusyNow} nowSession={nowSession} opportunityCards={opportunityCards}
                dolulukView={s.dolulukView} onDolulukViewChange={(v) => patch({ dolulukView: v })}
                selWeekPct={selWeekPct} selMonthPct={selMonthPct} monthLabel={MONTHS[ANCHOR.getMonth()]}
              />

              {/* VIEW CARD */}
              <div style={{ ...cardBox, overflow: "hidden" }}>
                <ViewCardHeader rangeText={rangeText} onPrev={goPrev} onToday={goToday} onNext={goNext} />

                {(isWeekV || isDayV) && (
                  <TimelineView
                    isDayV={isDayV} tlCols={tlCols} colWidth={colWidth} timelineWidth={timelineWidth} gutter={gutter}
                    bodyH={bodyH} hourLabels={hourLabels} colHeads={colHeads} tlColumns={tlColumns}
                    onBlockClick={setCardDetail}
                  />
                )}

                {isMonthV && <MonthHeatmapView heatCells={heatCells} />}

                {isListV && <ListTableView rows={listRows} />}
              </div>
            </div>
          </div>
        </FlexPageContent>
        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>

      <PlanModal
        open={s.planOpen} onClose={() => patch({ planOpen: false })}
        planDateVal={planDateVal} onPlanDateChange={(v) => patch({ planDate: v })}
        planStart={s.planStart} onPlanStartChange={(v) => patch({ planStart: v })} startOptions={startOptions}
        planDur={s.planDur} onPlanDurChange={(v) => patch({ planDur: v })} durOptions={durOptions}
        planCap={s.planCap} onPlanCapChange={(v) => patch({ planCap: v })} capOptions={capOptions}
        planSlotLabel={planSlotLabel} planFit={planFit} planCandidates={planCandidates}
      />

      <SlotsModal
        open={s.slotsOpen} onClose={() => patch({ slotsOpen: false })} sel={sel} weekMon={weekMon}
        slotsView={s.slotsView} onSlotsViewChange={(v) => patch({ slotsView: v })}
        sRange={s.sRange} onSRangeChange={(v) => patch({ sRange: v })}
        sDay={s.sDay} onSDayChange={(v) => patch({ sDay: v })}
        sMin={s.sMin} onSMinChange={(v) => patch({ sMin: v })}
        sStatus={s.sStatus} onSStatusChange={(v) => patch({ sStatus: v })}
        filteredItems={filteredItems} freeItems={freeItems} busyCountAll={busyCountAll} durTxt={durTxt}
        onPlanFromSlot={onPlanFromSlot} calColumns={calColumns} slotsSummary={slotsSummary}
      />

      <CardDetailModal detail={cardDetail} onClose={() => setCardDetail(null)} />

      <LabAddModal
        open={labModalOpen} onClose={() => setLabModalOpen(false)}
        name={newLabName} setName={setNewLabName}
        type={newLabType} setType={setNewLabType}
        capacity={newLabCapacity} setCapacity={setNewLabCapacity}
        officeId={newLabOffice} setOfficeId={setNewLabOffice}
        officeOptions={officeOptions} saving={savingLab} onSave={saveLab}
      />
    </div>
  );
}
