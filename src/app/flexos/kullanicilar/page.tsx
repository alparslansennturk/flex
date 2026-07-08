"use client";

/**
 * FlexOS · Kullanıcılar — 2 sekmeli kullanıcı yönetimi.
 * Sekme 1 — Personel: admin / operasyon / satış / eğitmen
 * Sekme 2 — Öğrenciler: auth/erişim bilgileri (şifre sıfırla, tek kullanımlık kod, son giriş)
 * Kullanıcı Ekle → /flexos/kullanicilar/ekle (tam sayfa form)
 */

import React, { useEffect, useState, useMemo, useCallback, useRef, CSSProperties } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import FlexModal from "../_components/FlexModal";
import Footer from "@/app/components/layout/Footer";
import { useRoleDefs } from "./_shared/useRoleDefs";

// ── types ──
type TabKey = "personel" | "ogrenciler";
type RoleKey = string;

interface UserItem {
  id: string; name: string; surname: string; email: string; phone: string;
  roles: RoleKey[]; subes: string[]; status: "aktif" | "pasif"; createdAt: string; title: string;
}

interface StudentUserItem {
  id: string; name: string; email: string; phone: string;
  lastLogin: string | null; status: "aktif" | "pasif" | "askıda"; createdAt: string;
}

const ALL_SUBES = ["Kadıköy", "Pendik", "Ümraniye", "Beşiktaş", "Şirinevler"];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  aktif: { label: "Aktif", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" },
  pasif: { label: "Pasif", color: "#6F7B87", bg: "#EEF0F3", dot: "#AEB4C0" },
  "askıda": { label: "Askıda", color: "#B45309", bg: "#FEF3C7", dot: "#D97706" },
};

const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"],
  ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"],
];

const PAGE_SIZE = 10;

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Hiç giriş yapmadı";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}


// ── Demo Veri — Öğrenci Kullanıcıları ──
const DUMMY_STUDENTS: StudentUserItem[] = [
  { id: "s1", name: "İrem Arslanoğlu", email: "irem@gmail.com", phone: "0 (532) 111 22 33", lastLogin: "2026-06-26T09:14:00", status: "aktif", createdAt: "2026-02-01" },
  { id: "s2", name: "Yusuf Kılıç", email: "yusuf.k@gmail.com", phone: "0 (544) 222 33 44", lastLogin: "2026-06-25T18:30:00", status: "aktif", createdAt: "2026-02-15" },
  { id: "s3", name: "Defne Çetin", email: "defne.c@gmail.com", phone: "0 (555) 333 44 55", lastLogin: "2026-06-20T11:00:00", status: "aktif", createdAt: "2026-03-01" },
  { id: "s4", name: "Arda Şahin", email: "arda@hotmail.com", phone: "0 (533) 444 55 66", lastLogin: null, status: "askıda", createdAt: "2026-03-10" },
  { id: "s5", name: "Melis Yıldırım", email: "melis.y@gmail.com", phone: "0 (545) 555 66 77", lastLogin: "2026-06-24T14:20:00", status: "aktif", createdAt: "2026-03-20" },
  { id: "s6", name: "Baran Demir", email: "baran.d@gmail.com", phone: "0 (537) 666 77 88", lastLogin: "2026-05-10T08:00:00", status: "pasif", createdAt: "2026-04-01" },
  { id: "s7", name: "Elif Nur Aydın", email: "elifnur@gmail.com", phone: "0 (542) 777 88 99", lastLogin: "2026-06-26T07:45:00", status: "aktif", createdAt: "2026-04-15" },
  { id: "s8", name: "Kerem Öztürk", email: "kerem.oz@gmail.com", phone: "0 (530) 888 99 00", lastLogin: "2026-06-22T16:10:00", status: "aktif", createdAt: "2026-05-01" },
  { id: "s9", name: "Zehra Korkmaz", email: "zehra.k@gmail.com", phone: "0 (546) 999 00 11", lastLogin: null, status: "askıda", createdAt: "2026-05-20" },
  { id: "s10", name: "Emir Can Polat", email: "emircan@gmail.com", phone: "0 (538) 000 11 22", lastLogin: "2026-06-18T12:30:00", status: "aktif", createdAt: "2026-06-01" },
  { id: "s11", name: "Sude Aksoy", email: "sude.a@gmail.com", phone: "0 (541) 111 22 33", lastLogin: "2026-06-25T20:00:00", status: "aktif", createdAt: "2026-06-10" },
  { id: "s12", name: "Toprak Yılmaz", email: "toprak@gmail.com", phone: "0 (535) 222 33 44", lastLogin: "2026-04-30T10:15:00", status: "pasif", createdAt: "2026-06-15" },
];

const SUBE_OPTIONS = ["Tümü", ...ALL_SUBES];

export default function KullanicilarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const didMount = useRef(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("personel");

  const [users, setUsers] = useState<UserItem[]>([]);
  const { roleDefs } = useRoleDefs();
  const roleDefsById = useMemo(() => Object.fromEntries((roleDefs ?? []).map((r) => [r.id, r])), [roleDefs]);
  const rolOptions = useMemo(() => ["Tümü", ...(roleDefs ?? []).map((r) => r.id)], [roleDefs]);
  const rolLabelsMap = useMemo(() => {
    const map: Record<string, string> = { Tümü: "Tümü" };
    (roleDefs ?? []).forEach((r) => { map[r.id] = r.label; });
    return map;
  }, [roleDefs]);
  const [search, setSearch] = useState("");
  const [rolFilter, setRolFilter] = useState("Tümü");
  const [subeFilter, setSubeFilter] = useState("Tümü");
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [page, setPage] = useState(1);
  const [rolDD, setRolDD] = useState(false);
  const [subeDD, setSubeDD] = useState(false);
  const [statusDD, setStatusDD] = useState(false);

  const [students, setStudents] = useState<StudentUserItem[]>(DUMMY_STUDENTS);
  const [stuSearch, setStuSearch] = useState("");
  const [stuStatusFilter, setStuStatusFilter] = useState("Tümü");
  const [stuPage, setStuPage] = useState(1);
  const [stuStatusDD, setStuStatusDD] = useState(false);

  // ── Sistem Modu (Eğitmen Tek Başına switch) ──
  const [standaloneMode, setStandaloneMode] = useState<boolean | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  const [modeConfirm, setModeConfirm] = useState<boolean | null>(null); // onay bekleyen hedef değer (null = modal kapalı)

  // ── Kişisel Görünüm PIN'i (Core/Full anahtarı, sadece owner görür) ──
  const [canPin, setCanPin] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const fetchViewAccess = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/view-access", { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!res.ok) { if (!signal?.aborted) setCanPin(false); return; }
      const json = await res.json();
      if (signal?.aborted) return;
      setCanPin(true);
      setHasPin(!!json.hasPin);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setCanPin(false);
    }
  }, []);

  const savePin = async () => {
    if (!/^\d{4}$/.test(newPin)) { toast.error("Yeni PIN 4 haneli rakam olmalı."); return; }
    if (newPin !== newPin2) { toast.error("Yeni PIN'ler eşleşmiyor."); return; }
    setPinBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/view-access/pin", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "PIN güncellenemedi."); return; }
      toast.success(hasPin ? "PIN değiştirildi." : "PIN oluşturuldu.");
      setNewPin(""); setNewPin2("");
      setHasPin(true);
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setPinBusy(false);
    }
  };

  const fetchSettings = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/settings", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (!signal?.aborted) setStandaloneMode(!!json.standaloneMode);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[kullanicilar] sistem modu yüklenemedi:", e);
      }
    }
  }, []);

  const applyStandaloneMode = async (next: boolean) => {
    if (modeBusy) return;
    setModeBusy(true);
    setStandaloneMode(next); // optimistic
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/settings", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ standaloneMode: next }),
      });
      if (!res.ok) throw new Error("patch failed");
      toast.success(next ? "Eğitmen tek başına çalışma modu açıldı." : "Tam sistem moduna dönüldü.");
    } catch {
      setStandaloneMode(!next); // rollback
      toast.error("Sistem modu güncellenemedi.");
    } finally {
      setModeBusy(false);
    }
  };

  const confirmModeChange = () => {
    if (modeConfirm === null) return;
    const next = modeConfirm;
    setModeConfirm(null);
    applyStandaloneMode(next);
  };

  // ── Veri yükleme ──
  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/users", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (!signal?.aborted) {
        setUsers(json.items ?? []);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[kullanicilar] veri yüklenemedi:", e);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      fetchUsers(ac.signal);
      fetchSettings(ac.signal);
      fetchViewAccess(ac.signal);
    })();
    return () => { ac.abort(); };
  }, [router, fetchUsers, fetchSettings, fetchViewAccess]);

  // Ekle sayfasından dönünce listeyi yenile
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (pathname === "/flexos/kullanicilar") fetchUsers();
  }, [pathname, fetchUsers]);

  // personel filtreleme
  const filtered = useMemo(() => {
    let list = users;
    const q = search.trim().toLocaleLowerCase("tr");
    if (q) list = list.filter((u) => `${u.name} ${u.surname} ${u.email}`.toLocaleLowerCase("tr").includes(q));
    if (rolFilter !== "Tümü") list = list.filter((u) => u.roles.includes(rolFilter as RoleKey));
    if (subeFilter !== "Tümü") list = list.filter((u) => u.subes.includes(subeFilter));
    if (statusFilter !== "Tümü") list = list.filter((u) => u.status === statusFilter);
    return list;
  }, [users, search, rolFilter, subeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [search, rolFilter, subeFilter, statusFilter]);

  // öğrenci filtreleme
  const stuFiltered = useMemo(() => {
    let list = students;
    const q = stuSearch.trim().toLocaleLowerCase("tr");
    if (q) list = list.filter((s) => `${s.name} ${s.email} ${s.phone}`.toLocaleLowerCase("tr").includes(q));
    if (stuStatusFilter !== "Tümü") list = list.filter((s) => s.status === stuStatusFilter);
    return list;
  }, [students, stuSearch, stuStatusFilter]);

  const stuTotalPages = Math.max(1, Math.ceil(stuFiltered.length / PAGE_SIZE));
  const stuPageItems = stuFiltered.slice((stuPage - 1) * PAGE_SIZE, stuPage * PAGE_SIZE);
  useEffect(() => setStuPage(1), [stuSearch, stuStatusFilter]);

  // metrikler
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "aktif").length;
  const rolCounts = useMemo(() => { const m: Record<string, number> = {}; users.forEach((u) => { u.roles.forEach((r) => { m[r] = (m[r] || 0) + 1; }); }); return m; }, [users]);
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === "aktif").length;
  const pendingStudents = students.filter((s) => s.status === "askıda").length;

  const toggleUserStatus = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    const newStatus = user.status === "aktif" ? "pasif" : "aktif";
    // Optimistic update
    setUsers((p) => p.map((u) => u.id === id ? { ...u, status: newStatus } : u));
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/flexos/users/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("patch failed");
      toast.success("Durum güncellendi.");
    } catch {
      // Rollback
      setUsers((p) => p.map((u) => u.id === id ? { ...u, status: user.status } : u));
      toast.error("Durum güncellenemedi.");
    }
  };
  const toggleStudentStatus = (id: string) => { setStudents((p) => p.map((s) => s.id !== id ? s : { ...s, status: s.status === "aktif" ? "pasif" : "aktif" })); toast.success("Durum güncellendi."); };

  // ── Sil ──
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const askDelete = (u: UserItem) => setDeleteModal({ id: u.id, name: `${u.name} ${u.surname}` });

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDelBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/flexos/users/${deleteModal.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Silinemedi." }));
        throw new Error(err.error);
      }
      setUsers((p) => p.filter((u) => u.id !== deleteModal.id));
      toast.success(`${deleteModal.name} silindi.`);
      setDeleteModal(null);
    } catch (e) {
      toast.error((e as Error).message || "Kullanıcı silinemedi.");
    } finally {
      setDelBusy(false);
    }
  };

  function renderSubes(subes: string[]) {
    if (subes.length === 0) return <span style={{ fontSize: 12.5, color: "#AEB4C0", fontWeight: 500 }}>—</span>;
    if (subes.length >= ALL_SUBES.length) return <span style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 6 }}>Tümü</span>;
    return <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{subes.map((s) => <span key={s} style={{ fontSize: 11.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", padding: "3px 8px", borderRadius: 6 }}>{s}</span>)}</div>;
  }

  if (authed === null) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="kullanicilar" />
      <style>{`.ku-iconbtn:hover{background:rgba(0,0,0,.04)!important}`}</style>
      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          title="Kullanıcılar"
          subtitle="Sisteme erişimi olan tüm kullanıcıları yönetin."
          roleLabel="Yönetici · Eğitmen"
          maxWidth={1560}
        />

        <div style={{ padding: "28px 36px 56px", maxWidth: 1560, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
            <TabBtn label="Personel" count={totalUsers} active={tab === "personel"} onClick={() => setTab("personel")} />
            <TabBtn label="Öğrenciler" count={totalStudents} active={tab === "ogrenciler"} onClick={() => setTab("ogrenciler")} />
          </div>

          {/* ═══════════ SİSTEM MODU + KİŞİSEL GÖRÜNÜM PIN'İ — 2 sütun ═══════════ */}
          <div style={{ display: "grid", gridTemplateColumns: canPin ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 22, alignItems: "stretch" }}>
            <div style={{ ...S.tableCard, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "18px 22px", flexWrap: "wrap" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: standaloneMode ? "#DCFCE7" : "#EDE9FE", color: standaloneMode ? "#15803D" : "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <IconGraduation />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>Sistem Modu</div>
                  <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2 }}>
                    {standaloneMode === null
                      ? "Yükleniyor…"
                      : standaloneMode
                        ? "Eğitmen Tek Başına — eğitmen kendi grubunu/öğrencisini kendi ekler, Satış/Operasyon devre dışı."
                        : "Tam Sistem — öğrenci ve grup Satış + Operasyon üzerinden beslenir, eğitmen sadece yoklama/not girer."}
                  </div>
                </div>
              </div>
              <SystemModeSegment value={standaloneMode} busy={modeBusy} onChange={(next) => { if (standaloneMode !== null && next !== standaloneMode) setModeConfirm(next); }} />
            </div>

            {canPin && (
              <div style={{ ...S.tableCard, padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EDE9FE", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <IconLock />
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>{"Kişisel Görünüm PIN'i"}</div>
                    <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, marginTop: 2 }}>
                      {"Ctrl/Cmd+Alt+M ile Eğitmen görünümünden admin ekranına geçerken sorulan 4 haneli PIN. "}{hasPin ? "Kurulu." : "Henüz kurulmadı."}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>Yeni PIN</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={S.pinInput} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87" }}>Yeni PIN (Tekrar)</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={newPin2} onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, "").slice(0, 4))} style={S.pinInput} />
                  </div>
                  <button onClick={savePin} disabled={pinBusy} style={{ ...S.addBtn, background: "#7C3AED", boxShadow: "none" }}>
                    {pinBusy ? "Kaydediliyor…" : hasPin ? "PIN'i Değiştir" : "PIN Oluştur"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ═══════════ PERSONEL ═══════════ */}
          {tab === "personel" && (
            <>
              {/* section header + CTA */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginTop: 40, marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={S.countChip}>{totalUsers} personel</span>
                </div>
                <button onClick={() => router.push("/flexos/kullanicilar/ekle")} style={S.addBtn}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                  Kullanıcı Ekle
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
                <MetricCard icon={<IconUsers />} bg="#EDE9FE" iconColor="#7C3AED" label="Toplam Personel" value={String(totalUsers)} />
                <MetricCard icon={<IconCheck />} bg="#E6F5ED" iconColor="#007A30" label="Aktif" value={String(activeUsers)} />
                <MetricCard icon={<IconBriefcase />} bg="#E0F2FE" iconColor="#0369A1" label="Koordinatör / İşleri" value={String((rolCounts.egitim_koordinatoru || 0) + (rolCounts.ogrenci_isleri || 0))} />
                <MetricCard icon={<IconGraduation />} bg="#DCFCE7" iconColor="#15803D" label="Eğitmen" value={String(rolCounts.egitmen || 0)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <SearchInput value={search} onChange={setSearch} placeholder="Ad, e-posta ara…" />
                <DropdownFilter label="Rol" value={rolLabelsMap[rolFilter] ?? rolFilter} open={rolDD} onToggle={() => { setRolDD((o) => !o); setSubeDD(false); setStatusDD(false); }}>
                  {rolOptions.map((r) => <DropdownItem key={r} label={rolLabelsMap[r] ?? r} selected={rolFilter === r} onClick={() => { setRolFilter(r); setRolDD(false); }} />)}
                </DropdownFilter>
                <DropdownFilter label="Şube" value={subeFilter} open={subeDD} onToggle={() => { setSubeDD((o) => !o); setRolDD(false); setStatusDD(false); }}>
                  {SUBE_OPTIONS.map((s) => <DropdownItem key={s} label={s} selected={subeFilter === s} onClick={() => { setSubeFilter(s); setSubeDD(false); }} />)}
                </DropdownFilter>
                <DropdownFilter label="Durum" value={statusFilter === "Tümü" ? "Tümü" : STATUS_MAP[statusFilter]?.label ?? statusFilter} open={statusDD} onToggle={() => { setStatusDD((o) => !o); setRolDD(false); setSubeDD(false); }}>
                  {["Tümü", "aktif", "pasif"].map((s) => <DropdownItem key={s} label={s === "Tümü" ? "Tümü" : STATUS_MAP[s]?.label ?? s} selected={statusFilter === s} onClick={() => { setStatusFilter(s); setStatusDD(false); }} />)}
                </DropdownFilter>
                {(search || rolFilter !== "Tümü" || subeFilter !== "Tümü" || statusFilter !== "Tümü") && (
                  <button onClick={() => { setSearch(""); setRolFilter("Tümü"); setSubeFilter("Tümü"); setStatusFilter("Tümü"); }} style={S.clearBtn}>Temizle</button>
                )}
              </div>
              <div style={S.tableCard}>
                <div style={S.tableHead}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Personel Listesi</span>
                    <span style={S.countBadge}>{filtered.length}</span>
                  </div>
                </div>
                {pageUsers.length === 0 ? <EmptyState text="Kullanıcı bulunamadı" sub="Arama veya filtre kriterlerine uygun kullanıcı yok." /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}><thead><tr style={S.theadRow}>
                      <th style={S.thFirst}>Kullanıcı</th><th style={S.th}>E-posta</th><th style={S.th}>Rol</th><th style={S.th}>Şube</th><th style={S.th}>Durum</th><th style={S.thRight}>İşlem</th>
                    </tr></thead><tbody>
                      {pageUsers.map((u, i) => {
                        const pal = AV_PALETTES[((page - 1) * PAGE_SIZE + i) % AV_PALETTES.length];
                        return (
                          <tr key={u.id} style={{ borderBottom: "1px solid #EEF0F3" }}>
                            <td style={S.tdFirst}><div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <span style={{ ...S.avatar, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(`${u.name} ${u.surname}`)}</span>
                              <div><div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{u.name} {u.surname}</div><div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>{u.title || fmtDate(u.createdAt)}</div></div>
                            </div></td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>{u.email}</span></td>
                            <td style={S.td}><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{u.roles.map((r) => { const rd = roleDefsById[r]; const color = rd?.color || "#414B59"; return <span key={r} style={{ display: "inline-flex", padding: "4px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700, color, background: rd ? `${color}1A` : "#EEF0F3" }}>{rd?.label ?? r}</span>; })}</div></td>
                            <td style={S.td}>{renderSubes(u.subes)}</td>
                            <td style={S.td}><ToggleSwitch active={u.status === "aktif"} onClick={() => toggleUserStatus(u.id)} /></td>
                            <td style={S.tdRight}><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button onClick={() => router.push(`/flexos/kullanicilar/${u.id}/duzenle`)} title="Düzenle" style={S.iconBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
                              <button onClick={() => askDelete(u)} title="Sil" style={{ ...S.iconBtn, color: "#94A3B8" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                            </div></td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                )}
                <Pagination total={filtered.length} totalPages={totalPages} page={page} setPage={setPage} />
              </div>
            </>
          )}

          {/* ═══════════ ÖĞRENCİLER ═══════════ */}
          {tab === "ogrenciler" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
                <MetricCard icon={<IconUsers />} bg="#EDE9FE" iconColor="#7C3AED" label="Toplam Öğrenci" value={String(totalStudents)} />
                <MetricCard icon={<IconCheck />} bg="#E6F5ED" iconColor="#007A30" label="Aktif" value={String(activeStudents)} />
                <MetricCard icon={<IconClock />} bg="#FEF3C7" iconColor="#B45309" label="Askıda" value={String(pendingStudents)} />
                <MetricCard icon={<IconLock />} bg="#FEE2E2" iconColor="#DC2626" label="Pasif" value={String(totalStudents - activeStudents - pendingStudents)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <SearchInput value={stuSearch} onChange={setStuSearch} placeholder="Ad, e-posta, telefon ara…" />
                <DropdownFilter label="Durum" value={stuStatusFilter === "Tümü" ? "Tümü" : STATUS_MAP[stuStatusFilter]?.label ?? stuStatusFilter} open={stuStatusDD} onToggle={() => setStuStatusDD((o) => !o)}>
                  {["Tümü", "aktif", "pasif", "askıda"].map((s) => <DropdownItem key={s} label={s === "Tümü" ? "Tümü" : STATUS_MAP[s]?.label ?? s} selected={stuStatusFilter === s} onClick={() => { setStuStatusFilter(s); setStuStatusDD(false); }} />)}
                </DropdownFilter>
                {(stuSearch || stuStatusFilter !== "Tümü") && <button onClick={() => { setStuSearch(""); setStuStatusFilter("Tümü"); }} style={S.clearBtn}>Temizle</button>}
              </div>
              <div style={S.tableCard}>
                <div style={S.tableHead}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Öğrenci Hesapları</span>
                    <span style={S.countBadge}>{stuFiltered.length}</span>
                  </div>
                </div>
                {stuPageItems.length === 0 ? <EmptyState text="Öğrenci bulunamadı" sub="Arama veya filtre kriterlerine uygun öğrenci yok." /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}><thead><tr style={S.theadRow}>
                      <th style={S.thFirst}>Öğrenci</th><th style={S.th}>E-posta</th><th style={S.th}>Telefon</th><th style={S.th}>Son Giriş</th><th style={S.th}>Durum</th><th style={S.thRight}>İşlem</th>
                    </tr></thead><tbody>
                      {stuPageItems.map((s, i) => {
                        const pal = AV_PALETTES[((stuPage - 1) * PAGE_SIZE + i) % AV_PALETTES.length];
                        const ago = s.lastLogin ? daysSince(s.lastLogin) : null;
                        return (
                          <tr key={s.id} style={{ borderBottom: "1px solid #EEF0F3" }}>
                            <td style={S.tdFirst}><div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <span style={{ ...S.avatar, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(s.name)}</span>
                              <div><div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>{fmtDate(s.createdAt)}</div></div>
                            </div></td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>{s.email}</span></td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>{s.phone}</span></td>
                            <td style={S.td}><div><div style={{ fontSize: 13, color: s.lastLogin ? "#1E222B" : "#AEB4C0", fontWeight: 500 }}>{fmtDateTime(s.lastLogin)}</div>{ago !== null && ago > 7 && <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginTop: 2 }}>{ago} gündür giriş yok</div>}</div></td>
                            <td style={S.td}><ToggleSwitch active={s.status === "aktif"} onClick={() => toggleStudentStatus(s.id)} /></td>
                            <td style={S.tdRight}><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button onClick={() => toast.success(`${s.name} için şifre sıfırlama bağlantısı gönderildi.`)} title="Şifre Sıfırla" style={S.iconBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
                              <button onClick={() => toast.success(`${s.name} için tek kullanımlık giriş kodu gönderildi.`)} title="Tek Kullanımlık Kod" style={S.iconBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12h4"/><path d="M10 16h4"/></svg></button>
                            </div></td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                )}
                <Pagination total={stuFiltered.length} totalPages={stuTotalPages} page={stuPage} setPage={setStuPage} />
              </div>
            </>
          )}
        </div>
        <Footer mini containerClassName="w-full max-w-[1560px] mx-auto px-9" />
      </main>
      {(rolDD || subeDD || statusDD || stuStatusDD) && <div onClick={() => { setRolDD(false); setSubeDD(false); setStatusDD(false); setStuStatusDD(false); }} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}

      <FlexModal
        open={!!deleteModal}
        title="Kullanıcıyı Sil"
        message={<>
          <strong>{deleteModal?.name}</strong> adlı kullanıcıyı silmek istediğinize emin misiniz?
          <br />Bu işlem geri alınamaz.
        </>}
        confirmLabel="Sil"
        tone="danger"
        busy={delBusy}
        onConfirm={confirmDelete}
        onCancel={() => !delBusy && setDeleteModal(null)}
      />

      <FlexModal
        open={modeConfirm !== null}
        title="Sistem Modunu Değiştir"
        message={
          modeConfirm
            ? <>Eğitmenler <strong>kendi grubunu/öğrencisini kendi ekleyecek</strong>, Satış ve Operasyon devre dışı kalacak. Bu değişiklik sistemdeki HERKESİ etkiler.</>
            : <>Öğrenci ve grup ekleme yeniden <strong>Satış/Operasyon</strong> üzerinden yapılacak, eğitmenler sadece yoklama/not girecek. Bu değişiklik sistemdeki HERKESİ etkiler.</>
        }
        confirmLabel={modeConfirm ? "Evet, Eğitmen Moduna Geç" : "Evet, Tam Sisteme Dön"}
        cancelLabel="Vazgeç"
        tone="primary"
        busy={modeBusy}
        onConfirm={confirmModeChange}
        onCancel={() => !modeBusy && setModeConfirm(null)}
      />
    </div>
  );
}

function daysSince(iso: string): number { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

function TabBtn({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: "12px 20px", border: "none", borderBottom: active ? "2.5px solid #7C3AED" : "2.5px solid transparent", background: "transparent", color: active ? "#7C3AED" : "#6F7B87", fontSize: 14, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all .15s" }}>
    {label}<span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: active ? "#EDE9FE" : "#F2F4F7", color: active ? "#7C3AED" : "#8E95A3" }}>{count}</span>
  </button>;
}

function SystemModeSegment({ value, busy, onChange }: { value: boolean | null; busy: boolean; onChange: (standaloneMode: boolean) => void }) {
  const items: Array<{ key: boolean; label: string }> = [
    { key: false, label: "Tam Sistem" },
    { key: true, label: "Eğitmen Tek Başına" },
  ];
  return (
    <div style={{ display: "inline-flex", padding: 3, borderRadius: 11, background: "#F2F4F7", border: "1px solid #E2E5EA", opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
      {items.map((it) => {
        const selected = value === it.key;
        return (
          <button
            key={String(it.key)}
            onClick={() => onChange(it.key)}
            disabled={value === null}
            style={{
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: selected ? "#fff" : "transparent",
              color: selected ? (it.key ? "#15803D" : "#7C3AED") : "#8E95A3",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              cursor: value === null ? "default" : "pointer",
              boxShadow: selected ? "0 1px 3px rgba(15,31,61,.12)" : "none",
              transition: "all .15s",
              whiteSpace: "nowrap",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({ active, onClick }: { active: boolean; onClick: () => void }) {
  return <button onClick={onClick} title={active ? "Pasife al" : "Aktife al"} style={{ position: "relative", width: 44, height: 24, borderRadius: 999, border: "none", flex: "0 0 auto", background: active ? "#22C55E" : "#D1D5DB", cursor: "pointer", transition: "background .2s", padding: 0 }}>
    <span style={{ position: "absolute", top: 2, left: active ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
  </button>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <span style={{ position: "relative", display: "flex", width: 260, maxWidth: "50vw" }}>
    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", outline: "none" }} />
  </span>;
}

function DropdownFilter({ label, value, open, onToggle, children }: { label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div style={{ position: "relative" }}>
    <button onClick={onToggle} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
      <span style={{ color: "#8E95A3", fontWeight: 500 }}>{label}:</span><span>{value}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open && <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, minWidth: 160, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 8px 24px -4px rgba(15,31,61,.12)", padding: "6px" }}>{children}</div>}
  </div>;
}

function DropdownItem({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ display: "block", width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", background: selected ? "#F3F0FF" : "transparent", color: selected ? "#7C3AED" : "#414B59", fontSize: 13.5, fontWeight: selected ? 700 : 500, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>{label}</button>;
}

function EmptyState({ text, sub }: { text: string; sub: string }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px", textAlign: "center" }}>
    <div style={{ width: 54, height: 54, borderRadius: 15, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#414B59" }}>{text}</div><div style={{ fontSize: 13.5, color: "#8E95A3" }}>{sub}</div>
  </div>;
}

function Pagination({ total, totalPages, page, setPage }: { total: number; totalPages: number; page: number; setPage: (p: number) => void }) {
  if (total === 0) return null;
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "15px 22px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
    <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>Toplam <strong style={{ color: "#1E222B", fontWeight: 700 }}>{total}</strong> kayıt</div>
    {totalPages > 1 && <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ ...S.pageBtn, color: page === 1 ? "#AEB4C0" : "#414B59", cursor: page === 1 ? "not-allowed" : "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} style={{ ...S.pageBtn, minWidth: 36, border: p === page ? "1px solid #7C3AED" : "1px solid #E2E5EA", background: p === page ? "#7C3AED" : "#fff", color: p === page ? "#fff" : "#414B59", fontWeight: p === page ? 700 : 600, fontSize: 13.5 }}>{p}</button>)}
      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ ...S.pageBtn, color: page === totalPages ? "#AEB4C0" : "#414B59", cursor: page === totalPages ? "not-allowed" : "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
    </div>}
  </div>;
}

function MetricCard({ icon, bg, iconColor, label, value }: { icon: React.ReactNode; bg: string; iconColor: string; label: string; value: string }) {
  return <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
    <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{icon}</div>
    <div style={{ fontSize: 25, fontWeight: 800, color: "#1E222B", letterSpacing: "-.6px", whiteSpace: "nowrap" }}>{value}</div>
    <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 600, marginTop: 3 }}>{label}</div>
  </div>;
}

function IconUsers() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconCheck() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>; }
function IconBriefcase() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>; }
function IconGraduation() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>; }
function IconClock() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconLock() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }

const S: Record<string, CSSProperties> = {
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 999 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },
  bellBtn: { position: "relative" as const, width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s", fontFamily: "inherit" },
  bellDot: { position: "absolute" as const, top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar2: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 780 },
  theadRow: { background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" },
  th: { padding: "13px 18px", textAlign: "left" as const, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  thFirst: { padding: "13px 18px 13px 22px", textAlign: "left" as const, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  thRight: { padding: "13px 22px 13px 18px", textAlign: "right" as const, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  td: { padding: "13px 18px", verticalAlign: "middle" as const },
  tdFirst: { padding: "13px 18px 13px 22px", verticalAlign: "middle" as const },
  tdRight: { padding: "13px 22px 13px 18px", textAlign: "right" as const, verticalAlign: "middle" as const },
  avatar: { width: 34, height: 34, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 },
  tableCard: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  tableHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const, padding: "18px 22px", borderBottom: "1px solid #EEF0F3" },
  countBadge: { fontSize: 12, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 999 },
  clearBtn: { padding: "9px 16px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  pageBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit" },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", transition: "all .14s" },
  pinInput: { width: 90, padding: "9px 12px", borderRadius: 10, border: "1px solid #E2E5EA", fontSize: 15, letterSpacing: "4px", textAlign: "center" as const, fontFamily: "inherit", outline: "none", color: "#1E222B" },
};
