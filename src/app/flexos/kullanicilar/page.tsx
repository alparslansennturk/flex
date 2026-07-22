"use client";

/**
 * FlexOS · Kullanıcılar — 3 sekmeli kullanıcı yönetimi (2026-07-10 kararı: "kim bu
 * sistemde kim" tek yerden görünsün — bağımsız "Eğitmenler" sidebar linki de AYRICA
 * duruyor, kullanıcı isteğiyle kaldırılmadı, bkz. FlexSidebar.tsx).
 * Sekme 1 — Personel: admin / operasyon / satış (SADECE `role.manage`)
 * Sekme 2 — Eğitmenler: hafif özet (`trainer.read`) — tam CRUD/müsaitlik/ücret BURADA
 *   DEĞİL, "Eğitmen Kadrosu'na Git" ile /flexos/egitmenler'e yönlendirir.
 * Sekme 3 — Öğrenciler: auth/erişim bilgileri (`person.read`)
 * Sekmeler caller'ın gerçek yetkisine göre gösterilir/gizlenir (kozmetik — asıl kapı
 * her zaman backend'de). Kullanıcı Ekle → /flexos/kullanicilar/ekle (tam sayfa form)
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
import { useRealtimeSync } from "../_shared/useRealtimeSync";

// ── types ──
type TabKey = "personel" | "egitmenler" | "ogrenciler";
type RoleKey = string;

interface UserItem {
  id: string; name: string; surname: string; email: string; phone: string;
  roles: RoleKey[]; subes: string[]; status: "aktif" | "pasif"; createdAt: string; title: string;
  /** Aktivasyon kodu henüz kullanılmadı — `status` (istihdam aktif/pasif) ile AYRI kavram. */
  pendingActivation: boolean;
}

interface StudentUserItem {
  id: string; name: string; email: string;
  lastLogin: string | null; status: "aktif" | "pasif" | "askıda"; createdAt: string;
}

interface TrainerSummaryItem {
  id: string; name: string; email: string; subes: string[];
  status: "aktif" | "pasif"; groupCount: number;
}

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



/**
 * Gerçek sistem sahibi — `auth-actor.ts::VIEW_TOGGLE_OWNER_EMAIL` ile AYNI hardcode
 * (2026-07-10 kullanıcı kararı: "Genel Müdür" gerçek bir gelecek işe alım, kendisi o
 * değil). "Admin" rozeti SADECE bu kişi kendi hesabını görüntülerken, kendi satırında
 * çıkar — atanabilir bir rol DEĞİL, RoleDef listesine hiç girmez, başka kimsenin
 * ekranında görünmez (viewer VE row ikisi de bu e-posta olmalı).
 */
const SYSTEM_OWNER_EMAIL = "alparslan.sennturk@gmail.com";

export default function KullanicilarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const didMount = useRef(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("personel");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [allSubes, setAllSubes] = useState<string[]>([]);
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

  const [students, setStudents] = useState<StudentUserItem[]>([]);
  const [stuSearch, setStuSearch] = useState("");
  const [stuStatusFilter, setStuStatusFilter] = useState("Tümü");
  const [stuPage, setStuPage] = useState(1);
  const [stuStatusDD, setStuStatusDD] = useState(false);

  // ── Eğitmenler sekmesi — hafif özet (tam CRUD /flexos/egitmenler'de kalır) ──
  const [trainers, setTrainers] = useState<TrainerSummaryItem[]>([]);
  const [trnSearch, setTrnSearch] = useState("");
  const [trnPage, setTrnPage] = useState(1);

  // ── Sekme görünürlüğü — caller'ın gerçek yetkisine göre (kozmetik, asıl kapı backend'de) ──
  const [caps, setCaps] = useState<Set<string> | null>(null);
  const canSeePersonel = caps?.has("role.manage") ?? false;
  const canSeeEgitmenler = caps?.has("trainer.read") ?? false;
  const canSeeOgrenciler = caps?.has("person.read") ?? false;

  // Not: Sistem Modu / Grup Taşıma Kuralı / Kişisel Görünüm PIN'i artık ayrı
  // "Sistem Ayarları" sayfasında (`/flexos/sistem-ayarlari`, 2026-07-10 kullanıcı kararı
  // — "sistem ayarlarının içine taşıyalım").

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

  const fetchOffices = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/branch-offices", { headers: { Authorization: `Bearer ${token}` }, signal });
      const json = res.ok ? await res.json() : { items: [] };
      if (!signal?.aborted) setAllSubes((json.items ?? []).map((o: { name: string }) => o.name));
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("[kullanicilar] şubeler yüklenemedi:", e);
    }
  }, []);

  // Öğrenciler sekmesi — gerçek /api/flexos/persons (Öğrenci Havuzu ile AYNI kaynak).
  // accountStatus/lastLogin backend'de canlı `users/{uid}.isActivated` + Firebase Auth
  // `lastSignInTime`'dan salt-okunur türetiliyor (bkz. persons route).
  const fetchStudents = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/persons", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (!signal?.aborted) {
        const items: StudentUserItem[] = (json.items ?? []).map((p: {
          id: string; name: string; email: string;
          lastLogin: string | null; accountStatus: "aktif" | "askıda" | "pasif"; createdAt: string;
        }) => ({
          id: p.id, name: p.name, email: p.email,
          lastLogin: p.lastLogin, status: p.accountStatus, createdAt: p.createdAt,
        }));
        setStudents(items);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[kullanicilar] öğrenci verisi yüklenemedi:", e);
      }
    }
  }, []);

  // Eğitmenler sekmesi — gerçek /api/flexos/trainers (Eğitmen Kadrosu ile AYNI kaynak),
  // sadece özet alanlar (ücret/müsaitlik/not BURADA yok — tam CRUD /flexos/egitmenler'de).
  const fetchTrainers = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/trainers", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (!signal?.aborted) {
        const items: TrainerSummaryItem[] = (json.items ?? []).map((t: {
          id: string; name: string; email: string; subes: string[];
          status: "aktif" | "pasif"; groups: unknown[];
        }) => ({
          id: t.id, name: t.name, email: t.email, subes: t.subes ?? [],
          status: t.status, groupCount: (t.groups ?? []).length,
        }));
        setTrainers(items);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[kullanicilar] eğitmen verisi yüklenemedi:", e);
      }
    }
  }, []);

  // Sekme görünürlüğü için caller'ın gerçek capability'leri (kozmetik — bkz. /api/flexos/me).
  const fetchMe = useCallback(async (signal?: AbortSignal): Promise<Set<string>> => {
    const user = auth.currentUser;
    if (!user) return new Set();
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      const capSet = new Set<string>(json.capabilities ?? []);
      if (!signal?.aborted) setCaps(capSet);
      return capSet;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[kullanicilar] yetki bilgisi yüklenemedi:", e);
        setCaps(new Set());
      }
      return new Set();
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      // Personel/Eğitmenler/Öğrenciler uçları capability-gated (403) — sekmesi zaten
      // gizli olan biri için o isteği hiç atmıyoruz (2026-07-10 bulgu: Eğitim
      // Koordinatörü Kullanıcılar'a girince role.manage'i olmadığı için Personel
      // isteği 403 dönüp konsola "fetch failed" basıyordu, işlevsel bir bug değildi
      // ama gereksiz gürültüydü).
      const capSet = await fetchMe(ac.signal);
      if (ac.signal.aborted) return;
      if (capSet.has("role.manage")) fetchUsers(ac.signal);
      if (capSet.has("person.read")) fetchStudents(ac.signal);
      if (capSet.has("trainer.read")) fetchTrainers(ac.signal);
      fetchOffices(ac.signal);
    })();
    return () => { ac.abort(); };
  }, [router, fetchMe, fetchUsers, fetchStudents, fetchTrainers, fetchOffices]);

  // Ekle sayfasından dönünce listeyi yenile (SADECE Personel'i görebilen biri için).
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (pathname === "/flexos/kullanicilar" && caps?.has("role.manage")) fetchUsers();
  }, [pathname, fetchUsers, caps]);

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı öğrenci/eğitmen ekleyip/
  // düzenlediğinde SSE üzerinden haber alınır, ilgili sekme tekrar çekilir.
  useRealtimeSync(["students.changed"], useCallback(() => { void fetchStudents(); }, [fetchStudents]));
  useRealtimeSync(["trainers.changed"], useCallback(() => { void fetchTrainers(); }, [fetchTrainers]));

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
    if (q) list = list.filter((s) => `${s.name} ${s.email}`.toLocaleLowerCase("tr").includes(q));
    if (stuStatusFilter !== "Tümü") list = list.filter((s) => s.status === stuStatusFilter);
    return list;
  }, [students, stuSearch, stuStatusFilter]);

  const stuTotalPages = Math.max(1, Math.ceil(stuFiltered.length / PAGE_SIZE));
  const stuPageItems = stuFiltered.slice((stuPage - 1) * PAGE_SIZE, stuPage * PAGE_SIZE);
  useEffect(() => setStuPage(1), [stuSearch, stuStatusFilter]);

  // eğitmen filtreleme
  const trnFiltered = useMemo(() => {
    let list = trainers;
    const q = trnSearch.trim().toLocaleLowerCase("tr");
    if (q) list = list.filter((t) => `${t.name} ${t.email}`.toLocaleLowerCase("tr").includes(q));
    return list;
  }, [trainers, trnSearch]);

  const trnTotalPages = Math.max(1, Math.ceil(trnFiltered.length / PAGE_SIZE));
  const trnPageItems = trnFiltered.slice((trnPage - 1) * PAGE_SIZE, trnPage * PAGE_SIZE);
  useEffect(() => setTrnPage(1), [trnSearch]);

  // Sekme erişimi caps'e göre daralınca (ör. sadece person.read olan biri) aktif
  // sekme erişilemez kalmasın — ilk erişilebilir sekmeye düş.
  useEffect(() => {
    if (!caps) return;
    const allowed: Record<TabKey, boolean> = { personel: canSeePersonel, egitmenler: canSeeEgitmenler, ogrenciler: canSeeOgrenciler };
    if (!allowed[tab]) {
      const first = (["personel", "egitmenler", "ogrenciler"] as TabKey[]).find((k) => allowed[k]);
      if (first) setTab(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps]);

  // metrikler
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "aktif" && !u.pendingActivation).length;
  const rolCounts = useMemo(() => { const m: Record<string, number> = {}; users.forEach((u) => { u.roles.forEach((r) => { m[r] = (m[r] || 0) + 1; }); }); return m; }, [users]);
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === "aktif").length;
  const pendingStudents = students.filter((s) => s.status === "askıda").length;
  const totalTrainers = trainers.length;

  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const resendCode = async (u: UserItem) => {
    if (resendBusyId) return;
    setResendBusyId(u.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/flexos/users/${u.id}/resend-code`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Kod gönderilemedi."); return; }
      toast.success(`${u.name} ${u.surname} için aktivasyon kodu tekrar gönderildi.`);
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setResendBusyId(null);
    }
  };

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

  // ── Öğrenci: Hesabı Kapat (Person kalır, sadece giriş erişimi kapanır) ──
  const [closeAccountModal, setCloseAccountModal] = useState<{ id: string; name: string } | null>(null);
  const [closeAccountBusy, setCloseAccountBusy] = useState(false);

  const askCloseAccount = (s: StudentUserItem) => setCloseAccountModal({ id: s.id, name: s.name });

  const confirmCloseAccount = async () => {
    if (!closeAccountModal) return;
    setCloseAccountBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/flexos/persons/${closeAccountModal.id}/close-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Hesap kapatılamadı." }));
        throw new Error(err.error);
      }
      setStudents((p) => p.map((s) => s.id === closeAccountModal.id ? { ...s, status: "pasif", lastLogin: s.lastLogin } : s));
      toast.success(`${closeAccountModal.name} için hesap kapatıldı.`);
      setCloseAccountModal(null);
    } catch (e) {
      toast.error((e as Error).message || "Hesap kapatılamadı.");
    } finally {
      setCloseAccountBusy(false);
    }
  };

  // ── Öğrenci: Tamamen Sil (satış/ödeme geçmişi varsa backend reddeder) ──
  const [stuDeleteModal, setStuDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [stuDelBusy, setStuDelBusy] = useState(false);

  const askStudentDelete = (s: StudentUserItem) => setStuDeleteModal({ id: s.id, name: s.name });

  const confirmStudentDelete = async () => {
    if (!stuDeleteModal) return;
    setStuDelBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/flexos/persons/${stuDeleteModal.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Silinemedi." }));
        throw new Error(err.error);
      }
      setStudents((p) => p.filter((s) => s.id !== stuDeleteModal.id));
      toast.success(`${stuDeleteModal.name} silindi.`);
      setStuDeleteModal(null);
    } catch (e) {
      toast.error((e as Error).message || "Öğrenci silinemedi.");
    } finally {
      setStuDelBusy(false);
    }
  };

  function renderSubes(subes: string[]) {
    if (subes.length === 0) return <span style={{ fontSize: 12.5, color: "#AEB4C0", fontWeight: 500 }}>—</span>;
    if (allSubes.length > 0 && subes.length >= allSubes.length) return <span style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 6 }}>Tümü</span>;
    return <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{subes.map((s) => <span key={s} style={{ fontSize: 11.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", padding: "3px 8px", borderRadius: 6 }}>{s}</span>)}</div>;
  }

  if (authed === null) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="kullanicilar" />
      <style>{`.ku-iconbtn:hover{background:rgba(0,0,0,.04)!important}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          title="Kullanıcılar"
          subtitle="Sisteme erişimi olan tüm kullanıcıları yönetin."
          roleLabel="Yönetici · Eğitmen"
          maxWidth={1560}
        />

        <div style={{ padding: "28px 36px 56px", maxWidth: 1560, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 0 }}>
              {canSeePersonel && <TabBtn label="Personel" count={totalUsers} active={tab === "personel"} onClick={() => setTab("personel")} />}
              {canSeeEgitmenler && <TabBtn label="Eğitmenler" count={totalTrainers} active={tab === "egitmenler"} onClick={() => setTab("egitmenler")} />}
              {canSeeOgrenciler && <TabBtn label="Öğrenciler" count={totalStudents} active={tab === "ogrenciler"} onClick={() => setTab("ogrenciler")} />}
            </div>
            {tab === "personel" && (
              <button onClick={() => router.push("/flexos/kullanicilar/ekle")} style={S.addBtn}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                Kullanıcı Ekle
              </button>
            )}
          </div>

          {/* ═══════════ PERSONEL ═══════════ */}
          {tab === "personel" && (
            <>
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
                  {["Tümü", ...allSubes].map((s) => <DropdownItem key={s} label={s} selected={subeFilter === s} onClick={() => { setSubeFilter(s); setSubeDD(false); }} />)}
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
                        const viewerIsOwner = auth.currentUser?.email === SYSTEM_OWNER_EMAIL;
                        const rowIsSelf = u.email === auth.currentUser?.email;
                        const showOwnerBadge = viewerIsOwner && rowIsSelf && u.email === SYSTEM_OWNER_EMAIL;
                        return (
                          <tr key={u.id} style={{ borderBottom: "1px solid #EEF0F3" }}>
                            <td style={S.tdFirst}><div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <span style={{ ...S.avatar, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(`${u.name} ${u.surname}`)}</span>
                              <div><div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{u.name} {u.surname}</div><div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>{u.title || fmtDate(u.createdAt)}</div></div>
                            </div></td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>{u.email}</span></td>
                            <td style={S.td}><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {showOwnerBadge
                                ? <span style={{ display: "inline-flex", padding: "4px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE" }}>Admin</span>
                                : u.roles.map((r) => { const rd = roleDefsById[r]; const color = rd?.color || "#414B59"; return <span key={r} style={{ display: "inline-flex", padding: "4px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700, color, background: rd ? `${color}1A` : "#EEF0F3" }}>{rd?.label ?? r}</span>; })}
                            </div></td>
                            <td style={S.td}>{renderSubes(u.subes)}</td>
                            <td style={S.td}>
                              {u.pendingActivation
                                ? <span title="Aktivasyon kodu henüz kullanılmadı" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#B45309", background: "#FEF3C7", padding: "4px 10px", borderRadius: 999 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706" }} />Beklemede
                                  </span>
                                : <ToggleSwitch active={u.status === "aktif"} onClick={() => toggleUserStatus(u.id)} />}
                            </td>
                            <td style={S.tdRight}><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              {u.pendingActivation && (
                                <button onClick={() => resendCode(u)} disabled={resendBusyId === u.id} title="Aktivasyon Kodunu Tekrar Gönder" style={S.iconBtn}>
                                  {resendBusyId === u.id
                                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-9-9"/></svg>
                                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>}
                                </button>
                              )}
                              <button onClick={() => router.push(`/flexos/kullanicilar/${u.id}/duzenle`)} title="Düzenle" style={S.iconBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
                              <button onClick={() => !rowIsSelf && askDelete(u)} disabled={rowIsSelf} title={rowIsSelf ? "Kendi hesabınızı silemezsiniz" : "Sil"} style={{ ...S.iconBtn, color: rowIsSelf ? "#D8DCE3" : "#94A3B8", cursor: rowIsSelf ? "not-allowed" : "pointer" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
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

          {/* ═══════════ EĞİTMENLER (hafif özet — tam CRUD /flexos/egitmenler'de) ═══════════ */}
          {tab === "egitmenler" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <SearchInput value={trnSearch} onChange={setTrnSearch} placeholder="Ad, e-posta ara…" />
                <button onClick={() => router.push("/flexos/egitmenler")} style={S.addBtn}>Eğitmen Kadrosu&apos;na Git</button>
              </div>
              <div style={S.tableCard}>
                <div style={S.tableHead}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Eğitmenler</span>
                    <span style={S.countBadge}>{trnFiltered.length}</span>
                  </div>
                </div>
                {trnPageItems.length === 0 ? <EmptyState text="Eğitmen bulunamadı" sub="Arama kriterlerine uygun eğitmen yok." /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}><thead><tr style={S.theadRow}>
                      <th style={S.thFirst}>Eğitmen</th><th style={S.th}>E-posta</th><th style={S.th}>Şube</th><th style={S.th}>Atanmış Grup</th><th style={S.th}>Durum</th>
                    </tr></thead><tbody>
                      {trnPageItems.map((t, i) => {
                        const pal = AV_PALETTES[((trnPage - 1) * PAGE_SIZE + i) % AV_PALETTES.length];
                        return (
                          <tr key={t.id} style={{ borderBottom: "1px solid #EEF0F3" }}>
                            <td style={S.tdFirst}><div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <span style={{ ...S.avatar, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(t.name)}</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{t.name}</span>
                            </div></td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>{t.email}</span></td>
                            <td style={S.td}>{renderSubes(t.subes)}</td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#414B59", fontWeight: 600 }}>{t.groupCount}</span></td>
                            <td style={S.td}>{(() => { const sm = STATUS_MAP[t.status]; return (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: sm.color, background: sm.bg, padding: "4px 10px", borderRadius: 999 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.dot }} />{sm.label}
                              </span>
                            ); })()}</td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                )}
                <Pagination total={trnFiltered.length} totalPages={trnTotalPages} page={trnPage} setPage={setTrnPage} />
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
                <SearchInput value={stuSearch} onChange={setStuSearch} placeholder="Ad, e-posta ara…" />
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
                      <th style={S.thFirst}>Öğrenci</th><th style={S.th}>E-posta</th><th style={S.th}>Son Giriş</th><th style={S.th}>Durum</th><th style={S.thRight}>İşlem</th>
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
                            <td style={S.td}><div><div style={{ fontSize: 13, color: s.lastLogin ? "#1E222B" : "#AEB4C0", fontWeight: 500 }}>{fmtDateTime(s.lastLogin)}</div>{ago !== null && ago > 7 && <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginTop: 2 }}>{ago} gündür giriş yok</div>}</div></td>
                            <td style={S.td}>{(() => { const sm = STATUS_MAP[s.status]; return (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: sm.color, background: sm.bg, padding: "4px 10px", borderRadius: 999 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.dot }} />{sm.label}
                              </span>
                            ); })()}</td>
                            <td style={S.tdRight}><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button onClick={() => toast("Yakında kullanıma açılacak.")} title="Şifre Sıfırla" style={S.iconBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
                              <button onClick={() => toast("Yakında kullanıma açılacak.")} title="Tek Kullanımlık Kod" style={S.iconBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12h4"/><path d="M10 16h4"/></svg></button>
                              {s.status !== "pasif" && (
                                <button onClick={() => askCloseAccount(s)} title="Hesabı Kapat" style={S.iconBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg></button>
                              )}
                              <button onClick={() => askStudentDelete(s)} title="Kişiyi Sil" style={{ ...S.iconBtn, color: "#DC2626" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
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
        open={!!closeAccountModal}
        title="Hesabı Kapat"
        message={<>
          <strong>{closeAccountModal?.name}</strong> adlı öğrencinin giriş hesabını kapatmak istediğinize emin misiniz?
          <br />Kayıt/not/ödeme geçmişi olduğu gibi kalır — sadece portal girişi kapanır. E-posta serbest kalır. Bu işlem geri alınamaz.
        </>}
        confirmLabel="Hesabı Kapat"
        tone="danger"
        busy={closeAccountBusy}
        onConfirm={confirmCloseAccount}
        onCancel={() => !closeAccountBusy && setCloseAccountModal(null)}
      />

      <FlexModal
        open={!!stuDeleteModal}
        title="Kişiyi Sil"
        message={<>
          <strong>{stuDeleteModal?.name}</strong> adlı kişiyi tamamen silmek istediğinize emin misiniz?
          <br />Satış/ödeme geçmişi varsa işlem reddedilir. Bu işlem geri alınamaz.
        </>}
        confirmLabel="Sil"
        tone="danger"
        busy={stuDelBusy}
        onConfirm={confirmStudentDelete}
        onCancel={() => !stuDelBusy && setStuDeleteModal(null)}
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
};
