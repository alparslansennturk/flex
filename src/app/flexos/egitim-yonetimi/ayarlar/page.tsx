"use client";

/**
 * FlexOS · Eğitim Yönetimi → Eğitim Ayarları (yapılandırma merkezi).
 * Branş Havuzu, Senelik Tatiller, Sertifika Ayarları gibi eğitim-yapılandırma
 * sayfalarına buradan gidilir. Eğitimler (katalog) sayfasından ayrıdır.
 */

import React, { useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";

interface SettingCard {
  key: string;
  title: string;
  desc: string;
  icon: string;
  to: string | null; // null = yakında
  accent: { color: string; background: string };
}

export default function EgitimAyarlariPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) {
        router.push("/login");
        return;
      }
      if (!cancelled) setAuthed(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const soon = () => toast.info("Bu özellik yakında.");

  const cards: SettingCard[] = [
    { key: "brans", title: "Branş Havuzu", desc: "Eğitimlerin üst kategorileri (Grafik Tasarım, Yazılım…). Eğitim Ekle dropdown'ı buradan beslenir.", icon: IC.branch, to: "/flexos/egitim-yonetimi/branslar", accent: { color: "#4338ca", background: "#e6e9ff" } },
    { key: "tatil", title: "Senelik Tatiller", desc: "Resmî tatil ve kurum tatil günleri — ders/grup takvimleri bunları atlar.", icon: IC.calendar, to: null, accent: { color: "#c2410c", background: "#ffedd5" } },
    { key: "sertifika", title: "Sertifika Ayarları", desc: "Sertifika kural ve şablonları (başarı/katılım barajları, belge tasarımı).", icon: IC.award, to: null, accent: { color: "#15803d", background: "#dcfce7" } },
    { key: "seans", title: "Seans Yönetimi", desc: "Grup açarken seçilebilecek seans kalıpları (gün + saat aralığı).", icon: IC.clock, to: "/flexos/egitim-yonetimi/seanslar", accent: { color: "#7c3aed", background: "#ede9fe" } },
    { key: "sozlesme", title: "Sözleşme Şablonları", desc: "Mesafeli satış, kurumsal hizmet vb. sözleşme metinleri.", icon: IC.file, to: null, accent: { color: "#0369a1", background: "#e0f2fe" } },
  ];

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="ea-spin" />
        <style>{globalCss}</style>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="ayarlar" />

      {/* MAIN */}
      <main style={S.main}>
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={S.headerIcon} dangerouslySetInnerHTML={{ __html: IC.settings }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#0f1f3d" }}>Eğitim Ayarları</h1>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Branşlar, seanslar, tatiller ve sertifika yapılandırması.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button className="ea-iconbtn" style={S.bellBtn} onClick={soon}>
              <span dangerouslySetInnerHTML={{ __html: IC.bell }} />
              <span style={S.bellDot} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #e2e8f1" }}>
              <div style={{ textAlign: "right", lineHeight: 1.25 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f1f3d" }}>Alparslan Şentürk</div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>Yönetici · Eğitmen</div>
              </div>
              <div style={S.avatar}>AŞ</div>
            </div>
          </div>
        </header>

        <div style={{ padding: "30px 36px 48px", maxWidth: 1920, margin: "0 auto" }}>
          <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#64748b", fontWeight: 500 }}>
            Eğitim modülünün yapılandırması — branşlar, tatiller, sertifika ve sözleşme ayarları.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {cards.map((c) => {
              const active = !!c.to;
              return (
                <div
                  key={c.key}
                  className="ea-card"
                  style={{ ...S.card, cursor: "pointer", opacity: active ? 1 : 0.85 }}
                  onClick={() => (c.to ? router.push(c.to) : soon())}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ ...S.cardIcon, color: c.accent.color, background: c.accent.background }} dangerouslySetInnerHTML={{ __html: c.icon }} />
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: "#0f1f3d", flex: 1 }}>{c.title}</span>
                    {active ? (
                      <span style={{ display: "inline-flex", color: "#cbd5e1" }} dangerouslySetInnerHTML={{ __html: IC.arrow }} />
                    ) : (
                      <span style={S.soonChip}>yakında</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif", background: "#eef2f8" },
  sidebar: { width: 252, flex: "0 0 252px", height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  logoBox: { width: 38, height: 38, borderRadius: 11, background: "#0a1c38", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#9fb2cd", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  navActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.22),rgba(249,115,22,.05))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.28)" },
  navActiveBar: { position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: "0 3px 3px 0", background: "#fb923c" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 1920px) / 2 + 36px))", background: "rgba(238,242,248,.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e2e8f1" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(15,31,61,.05)", transition: "all .14s" },
  cardIcon: { width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  soonChip: { fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "3px 9px", borderRadius: 999 },
};

const sv = (inner: string, attrs = 'width="20" height="20"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  home: sv('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>', 'width="19" height="19"'),
  book: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>', 'width="19" height="19"'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'width="19" height="19"'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  award: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
  file: sv('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),
  branch: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>'),
  settings: sv('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', 'width="23" height="23" stroke="#fff" stroke-width="2"'),
  clock: sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  arrow: sv('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 'width="18" height="18" stroke-width="2.2"'),
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes ea-spin{to{transform:rotate(360deg)}}
.ea-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:ea-spin 1s linear infinite}
.ea-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
.ea-iconbtn:hover{background:#f8fafc;color:#0f172a}
.ea-card:hover{border-color:#c7d0de;box-shadow:0 10px 24px -14px rgba(15,31,61,.3);transform:translateY(-2px)}
`;
