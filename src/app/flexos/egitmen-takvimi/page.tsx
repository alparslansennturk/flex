"use client";

/**
 * FlexOS · Eğitmen Takvimi — eğitmen müsaitlik/program görünümü.
 * Tasarım kaynağı: `Eğitmen Takvimi.dc.html` (Claude Design, proje "Flex-Eğitim
 * Yönetimi") — SADECE ana içerik alanı portlandı (sidebar/header mockup'ın kendi
 * HTML'i DEĞİL, gerçek app'teki `FlexSidebar`/`FlexHeader` zaten var).
 *
 * 2026-07-27 — İLK TUR (kısıtlı vakit, oturum bitmeden önce): SADECE Hafta
 * (resource grid) görünümü + stat kartları + toolbar + legend portlandı, veri
 * MOCK (deterministik seed'li, tasarımdaki `Component` sınıfının aynısı TS'e
 * çevrildi). Gün/Ay görünümleri + Eğitmen Günü modalı + Eğitim Planla modalı
 * (müsait eğitmen önerisi) HENÜZ YAPILMADI — sıradaki iş, bkz. FLEXOS.md.
 * Backend/gerçek müsaitlik verisi de HENÜZ YOK — bu sadece görsel port.
 */

import { useMemo, useState } from "react";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const BLK: Record<string, { key: string; label: string; color: string; bg: string; border: string; dot: string }> = {
  ders: { key: "ders", label: "Eğitimde", color: "#205297", bg: "#EAF1FB", border: "#C6DBF5", dot: "#2867bd" },
  musait: { key: "musait", label: "Müsait", color: "#0A6B3F", bg: "#E7F6EE", border: "#BFE6D0", dot: "#12A56A" },
  rezerve: { key: "rezerve", label: "Rezerve", color: "#B45309", bg: "#FFF4E3", border: "#F3D9AE", dot: "#E8890C" },
  izin: { key: "izin", label: "İzin", color: "#B7791F", bg: "#FDF4E3", border: "#F2E0B8", dot: "#E8A20C" },
  rapor: { key: "rapor", label: "Raporlu", color: "#C0392B", bg: "#FCEDEC", border: "#F4CFCB", dot: "#D93636" },
  tatil: { key: "tatil", label: "Resmi Tatil", color: "#5B4B8A", bg: "#EDE9F7", border: "#D6CEEE", dot: "#7A66B8" },
};

const BRANSLAR = ["Yazılım", "Tasarım", "Finans", "Pazarlama", "Dil"];
const SUBELER = ["Kadıköy", "Pendik", "Ümraniye", "Beşiktaş"];
const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#F76FA3", "#F91079"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"],
];

interface Instructor { id: number; name: string; brans: string; sube: string; av: [string, string] }

const INSTRUCTORS: Instructor[] = [
  "Mert Yılmaz", "Selin Aydın", "Burak Demir", "Ece Tunç", "Naz Erdem", "Kaya Şahin", "Aylin Kurt", "Deniz Yalın",
].map((name, i) => ({
  id: i + 1, name, brans: BRANSLAR[i % BRANSLAR.length], sube: SUBELER[i % SUBELER.length], av: AV_PALETTES[i % AV_PALETTES.length],
}));

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");
}
function rnd(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function isoDate(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date) {
  const x = new Date(d);
  const k = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - k);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtTime(m: number) {
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

interface DayCell { status: keyof typeof BLK; chips: { time: string; label: string; dot: string }[] }

/** Deterministik mock — eğitmen+gün bazlı sabit bir durum/ders listesi üretir. */
function cellFor(instrId: number, dateISO: string): DayCell {
  const d = new Date(dateISO + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  const base = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  const seed = instrId * 733 + base;
  if (dow === 6) return { status: "tatil", chips: [] };
  const r = rnd(seed);
  if (r < 0.06) return { status: "izin", chips: [] };
  if (r < 0.1) return { status: "rapor", chips: [] };
  const n = 1 + Math.floor(rnd(seed * 3) * 2);
  const chips: DayCell["chips"] = [];
  let cur = 9 * 60 + Math.floor(rnd(seed * 5) * 3) * 30;
  for (let k = 0; k < n; k++) {
    const sk = seed * 13 + k * 97;
    const dur = [90, 120, 150][Math.floor(rnd(sk) * 3)];
    if (cur + dur > 18 * 60) break;
    chips.push({ time: fmtTime(cur) + "–" + fmtTime(cur + dur), label: "GRP-" + (240 + instrId * 3 + k * 7), dot: BLK.ders.dot });
    cur += dur + [30, 60][Math.floor(rnd(sk * 7) * 2)];
  }
  return { status: chips.length ? "ders" : "musait", chips };
}

export default function EgitmenTakvimiPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const ANCHOR = useMemo(() => new Date(), []);
  const weekMon = useMemo(() => addDays(mondayOf(ANCHOR), weekOffset * 7), [ANCHOR, weekOffset]);
  const todayISO = isoDate(new Date());

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekMon, i)), [weekMon]);
  const rangeLabel = `${weekDays[0].getDate()} – ${weekDays[5].getDate()} ${weekDays[5].toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}`;

  const stats = useMemo(() => {
    let musait = 0, ders = 0, izinRapor = 0;
    for (const ins of INSTRUCTORS) for (const d of weekDays) {
      const c = cellFor(ins.id, isoDate(d));
      if (c.status === "musait") musait++;
      else if (c.status === "ders") ders += c.chips.length;
      else if (c.status === "izin" || c.status === "rapor") izinRapor++;
    }
    return [
      { label: "Toplam Eğitmen", value: String(INSTRUCTORS.length) },
      { label: "Bugün Müsait", value: String(INSTRUCTORS.filter((i) => cellFor(i.id, todayISO).status === "musait").length) },
      { label: "Bugün Derste", value: String(INSTRUCTORS.filter((i) => cellFor(i.id, todayISO).status === "ders").length) },
      { label: "Bu Hafta Müsait Slot", value: String(musait) },
      { label: "Bu Hafta Ders", value: String(ders) },
      { label: "İzinli/Raporlu", value: String(izinRapor) },
    ];
  }, [weekDays, todayISO]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <FlexSidebar active="egitmen-takvimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" /></svg>}
          title="Eğitmen Takvimi"
          subtitle="Eğitmen müsaitlik ve programını tek ekrandan yönetin."
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />
        <FlexPageContent style={{ padding: "22px 0 48px" }}>
          {/* STAT KARTLARI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 13, marginBottom: 18 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, padding: "15px 16px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6F7B87" }}>{s.label}</span>
                <div style={{ fontSize: 25, fontWeight: 800, color: "#1E222B", letterSpacing: "-.6px", marginTop: 10 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* TOOLBAR */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setWeekOffset((v) => v - 1)} style={navBtnStyle}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
                <button onClick={() => setWeekOffset(0)} style={{ padding: "0 15px", height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bugün</button>
                <button onClick={() => setWeekOffset((v) => v + 1)} style={navBtnStyle}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px", minWidth: 210 }}>{rangeLabel}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#E4E7EC", gap: 3 }}>
                <button style={{ padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: "#fff", color: "#1E222B", boxShadow: "0 1px 3px rgba(15,31,61,.12)" }}>Hafta</button>
                <button disabled title="Yakında" style={{ padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "not-allowed", background: "transparent", color: "#AEB4C0" }}>Gün</button>
                <button disabled title="Yakında" style={{ padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "not-allowed", background: "transparent", color: "#AEB4C0" }}>Ay</button>
              </div>
              <button disabled title="Yakında" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 11, border: "none", background: "#CDD2DA", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "not-allowed" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                Eğitim Planla
              </button>
            </div>
          </div>

          {/* LEGEND */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            {Object.values(BLK).map((l) => (
              <span key={l.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#6F7B87" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: l.dot }} />{l.label}
              </span>
            ))}
          </div>

          {/* HAFTA GRID */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 1080 }}>
                <div style={{ display: "grid", gridTemplateColumns: "220px repeat(6,1fr)", borderBottom: "1px solid #EEF0F3" }}>
                  <div style={{ padding: "13px 18px", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", borderRight: "1px solid #EEF0F3", display: "flex", alignItems: "center" }}>Eğitmen</div>
                  {weekDays.map((d, i) => {
                    const iso = isoDate(d);
                    const isToday = iso === todayISO;
                    return (
                      <div key={i} style={{ padding: "10px 8px", textAlign: "center", background: isToday ? "#EFF5FE" : "transparent" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: isToday ? "#2867bd" : "#8E95A3" }}>{DOW[i]}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#1E222B", marginTop: 2 }}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ maxHeight: 600, overflowY: "auto" }}>
                  {INSTRUCTORS.map((ins) => (
                    <div key={ins.id} style={{ display: "grid", gridTemplateColumns: "220px repeat(6,1fr)", borderBottom: "1px solid #F2F4F7" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", borderRight: "1px solid #EEF0F3" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800, background: `linear-gradient(135deg,${ins.av[0]},${ins.av[1]})` }}>{initials(ins.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ins.name}</div>
                          <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{ins.brans} · {ins.sube}</div>
                        </div>
                      </div>
                      {weekDays.map((d, i) => {
                        const c = cellFor(ins.id, isoDate(d));
                        const meta = BLK[c.status];
                        return (
                          <div key={i} style={{ padding: "8px", borderRight: i < 5 ? "1px solid #F2F4F7" : "none", minHeight: 64 }}>
                            {c.status === "musait" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: meta.color, background: meta.bg, border: "1px solid " + meta.border, borderRadius: 8, padding: "6px 9px" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />{meta.label}
                              </div>
                            ) : c.chips.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {c.chips.map((ch, ci) => (
                                  <div key={ci} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: "#205297", background: "#EAF1FB", border: "1px solid #C6DBF5", borderRadius: 7, padding: "5px 8px" }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.dot, flex: "0 0 auto" }} />
                                    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{ch.time}</span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.label}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: meta.color, background: meta.bg, border: "1px solid " + meta.border, borderRadius: 8, padding: "6px 9px" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />{meta.label}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FlexPageContent>
        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = { width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" };
