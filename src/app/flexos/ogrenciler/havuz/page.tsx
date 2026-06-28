"use client";

/**
 * FlexOS · Öğrenciler — "Öğrenci Havuzu".
 * Tasarım: _design "Öğrenci Havuzu.dc.html" (Claude Design) React'e portlandı.
 * Katalog/Satış ile aynı desen: inline S/IC, Inter, authStateReady korumalı, FlexSidebar.
 *
 * MİMARİ: Havuz = enrollment listesi + filtre (ayrı koleksiyon değil). Bir satış
 * yapılınca createSale → Person + Enrollment oluşur ve kayıt buraya düşer.
 *
 * DURUM: Liste şu an DEMO veriyle dolu (görsel doğrulama için). Gerçek veri ayağı iki
 * işe bağlı ve sonraki etapta bağlanacak:
 *   1) GET /api/flexos/persons (enrollment/grup/branş read-time join) — henüz YOK.
 *   2) createSale (iş "B") — satış DB'ye yazınca havuz gerçek kayıtlarla dolar.
 * NOT: Tasarımdaki "Şube" ve 7 zengin durum, domain'de henüz birebir karşılığı olmayan
 *   alanlar — wiring adımında modele eklenecek/eşlenecek (bkz. FLEXOS.md Durum bloğu).
 */

import React, { useEffect, useMemo, useState, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import { formatTrPhone } from "@/app/lib/phone";
import FlexSidebar from "../../_components/FlexSidebar";
import { BRANCH_OFFICES } from "@/app/lib/branch-offices";

// ── Durum & Branş sözlükleri (tasarımdan) ────────────────────────────────────
type StatusKey =
  | "beklemede" | "aktif" | "grupsuz" | "tekrar" | "mezun" | "pasif" | "donduruldu" | "iptal";

const ST: Record<StatusKey, { label: string; hint: string; color: string; background: string; dot: string }> = {
  beklemede: { label: "Beklemede", hint: "Ödeme bekleniyor", color: "#8A5A00", background: "#FFF3DC", dot: "#FFB020" },
  aktif: { label: "Aktif", hint: "Ödeme yapıldı", color: "#007A30", background: "#E6F5ED", dot: "#009F3E" },
  grupsuz: { label: "Grupsuz", hint: "Gruba atanmadı", color: "#205297", background: "#DDE8F8", dot: "#3A7BD5" },
  tekrar: { label: "Tekrar", hint: "Tekrar isteyen", color: "#652980", background: "#E6D1F0", dot: "#652980" },
  mezun: { label: "Mezun", hint: "Eğitimi tamamladı", color: "#285253", background: "#CBE6E6", dot: "#4FA3A5" },
  pasif: { label: "Pasif", hint: "Kaydı pasif", color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" },
  donduruldu: { label: "Donduruldu", hint: "Kayıt donduruldu", color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  iptal: { label: "İptal", hint: "Satış iptal edildi", color: "#991b1b", background: "#fef2f2", dot: "#dc2626" },
};

const BRANS_COLORS: Record<string, { color: string; background: string; dot: string }> = {
  Design: { color: "#B80E57", background: "#FED7E9", dot: "#F91079" },
  Finance: { color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  Software: { color: "#4D52A6", background: "#DDE0FA", dot: "#6F74D8" },
};
const BRANS_FALLBACK = { color: "#414B59", background: "#EEF0F3", dot: "#8E95A3" };
const BRANS = new Proxy(BRANS_COLORS, {
  get: (t, k: string) => t[k] ?? BRANS_FALLBACK,
});

const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"],
];

const SUBE_LIST = ["Tümü", ...BRANCH_OFFICES.map((o) => o.name)];
const PAGE_SIZE = 8;

interface StudentGroup { label: string; branch: string; educationName?: string }
interface StudentEducation { educationId: string; name: string; status: string }
interface Student {
  id: string; name: string; email: string; phone: string;
  status: StatusKey; subeler: string[]; gender: string; branches: string[];
  groups: StudentGroup[];
  educations: StudentEducation[];
  assignableEnrollmentId: string | null;
  assignableEducationId: string | null;
}

/** API'den gelen ham havuz kaydı (GET /api/flexos/persons). */
interface PersonApiItem {
  id: string; name: string; email: string; phone: string;
  status: string; branches?: string[]; groups?: StudentGroup[];
  educations?: StudentEducation[];
  assignableEnrollmentId?: string | null; assignableEducationId?: string | null;
  gender?: string; subeler?: string[];
}

/** Modal'daki atanabilir grup seçeneği. */
interface GroupOption { id: string; code: string; sub: string; educationId?: string }

/** Öğrenci detayı (GET /api/flexos/persons/[id]) — drawer için. */
interface SaleSummary { id: string; educationName: string; status: string; soldPrice: number; financingFee: number; guardian: { name: string; idNo?: string } | null; date: string }
interface PaymentLine { id: string; saleId: string; method: string; amount: number; installmentNo: number | null; installmentTotal: number | null; dueDate: string | null; paidAt: string | null; status: string }
interface PersonDetail {
  birthDate: string;
  pii: { phone: string; email: string; address: string; idNo: string; idType: string } | null;
  sales: SaleSummary[];
  payments: PaymentLine[];
  totals: { expected: number; paid: number; remaining: number; rollup: string | null };
}

const PAY_METHOD_LABEL: Record<string, string> = { cash: "Nakit", card: "Kredi Kartı", transfer: "Havale/EFT", senet: "Senet" };
const PAY_STATUS_BADGE: Record<string, { label: string; color: string; background: string }> = {
  paid: { label: "Ödendi", color: "#007A30", background: "#E6F5ED" },
  planned: { label: "Planlandı", color: "#6F7B87", background: "#EEF0F3" },
  upcoming: { label: "Yaklaşıyor", color: "#8A5A00", background: "#FFF3DC" },
  overdue: { label: "Gecikti", color: "#B42318", background: "#FEE4E2" },
};
const ROLLUP_BADGE: Record<string, { label: string; color: string; background: string }> = {
  completed: { label: "Tamamlandı", color: "#007A30", background: "#E6F5ED" },
  partial: { label: "Kısmi Ödendi", color: "#205297", background: "#DDE8F8" },
  upcoming: { label: "Yaklaşıyor", color: "#8A5A00", background: "#FFF3DC" },
  overdue: { label: "Gecikti", color: "#B42318", background: "#FEE4E2" },
  planned: { label: "Planlandı", color: "#6F7B87", background: "#EEF0F3" },
};
const tl = (n: number) => `${n.toLocaleString("tr-TR")} ₺`;
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR") : "—");

/** Seçili eğitimin ödeme durumu rollup'ı (client; server derivePaymentRollup ile aynı mantık). */
function clientRollup(payments: PaymentLine[], expected: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const paid = payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  if (expected > 0 && paid >= expected) return "completed";
  const unpaidDue = payments.filter((p) => !p.paidAt && p.dueDate);
  if (unpaidDue.some((p) => p.dueDate! < today)) return "overdue";
  if (unpaidDue.some((p) => p.dueDate! >= today && p.dueDate! <= in7)) return "upcoming";
  if (paid > 0) return "partial";
  return "planned";
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");
}

export default function OgrenciHavuzuPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  // applied filtreler
  const [statusFilter, setStatusFilter] = useState<StatusKey[]>([]);
  const [subeFilter, setSubeFilter] = useState("Tümü");
  const [bransFilter, setBransFilter] = useState("Tümü");
  const [egitimFilter, setEgitimFilter] = useState("Tümü");
  // pending (Filtrele'ye basılana kadar)
  const [pStatus, setPStatus] = useState<StatusKey[]>([]);
  const [pSube, setPSube] = useState("Tümü");
  const [pBrans, setPBrans] = useState("Tümü");
  const [pEgitim, setPEgitim] = useState("Tümü");

  const [openDropdown, setOpenDropdown] = useState<null | "sube" | "brans" | "egitim">(null);
  const [hoveredBrans, setHoveredBrans] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [hoveredEdu, setHoveredEdu] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);

  // ── Gruba Ata modal state ──
  const [assignTarget, setAssignTarget] = useState<Student | null>(null);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // ── Öğrenci Detay Drawer state ──
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailTab, setDetailTab] = useState<"bilgiler" | "odeme">("bilgiler");
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>(""); // Ödeme sekmesi: seçili eğitim/satış
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", email: "", gender: "", idNo: "", birthDate: "", address: "", guardianName: "", guardianIdNo: "" });
  const [guardianSaleId, setGuardianSaleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadStudents = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/flexos/persons", { headers: await authHeaders(), signal });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const items: PersonApiItem[] = json.items ?? [];
      if (signal?.aborted) return;
      setStudents(items.map((it) => ({
        id: it.id,
        name: it.name,
        email: it.email ?? "",
        phone: it.phone ?? "",
        status: (it.status as StatusKey) ?? "beklemede",
        subeler: it.subeler ?? [],
        gender: it.gender ?? "",
        branches: it.branches ?? [],
        groups: it.groups ?? [],
        educations: it.educations ?? [],
        assignableEnrollmentId: it.assignableEnrollmentId ?? null,
        assignableEducationId: it.assignableEducationId ?? null,
      })));
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Öğrenciler yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await loadStudents(ac.signal);
    })();
    return () => ac.abort();
  }, [router, loadStudents]);

  // ── Gruba Ata: modal aç + öğrencinin eğitimine ait grupları çek ──
  const openAssign = useCallback(async (st: Student) => {
    setAssignTarget(st);
    setSelectedGroupId("");
    setGroupOptions([]);
    setLoadingGroups(true);
    try {
      const hdrs = await authHeaders();
      const [gRes, eRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers: hdrs }),
        fetch("/api/flexos/educations", { headers: hdrs }),
      ]);
      const gJson = gRes.ok ? await gRes.json() : { items: [] };
      const eJson = eRes.ok ? await eRes.json() : { items: [] };
      const eduName = new Map<string, string>((eJson.items ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));
      // archived/completed grupları çıkar — öğrenci atanamaz
      const rawGroups = (gJson.items ?? []).filter((g: { status?: string }) => g.status !== "archived" && g.status !== "completed");
      const allGroups: GroupOption[] = rawGroups.map((g: { id: string; code: string; educationId?: string; branch?: string; type?: string }) => ({
        id: g.id,
        code: g.code,
        educationId: g.educationId,
        sub: (g.educationId && eduName.get(g.educationId)) || g.branch || (g.type === "ozel_ders" ? "Özel Ders" : g.type === "kurumsal" ? "Kurumsal" : "Grup"),
      }));
      // öğrencinin eğitimine ait grupları filtrele (educationId yoksa hepsini göster)
      const eduId = st.assignableEducationId;
      const opts = eduId ? allGroups.filter((g) => g.educationId === eduId) : allGroups;
      setGroupOptions(opts);
    } catch {
      toast.error("Gruplar yüklenemedi.");
    } finally {
      setLoadingGroups(false);
    }
  }, [authHeaders]);

  const closeAssign = () => { if (!assigning) { setAssignTarget(null); setSelectedGroupId(""); } };

  const confirmAssign = async () => {
    if (!assignTarget?.assignableEnrollmentId || !selectedGroupId) return;
    setAssigning(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/enrollments/${assignTarget.assignableEnrollmentId}`, {
        method: "PATCH", headers, body: JSON.stringify({ groupId: selectedGroupId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Gruba atama başarısız."); return; }
      const grpCode = groupOptions.find((g) => g.id === selectedGroupId)?.code ?? "";
      toast.success(`${assignTarget.name} ${grpCode ? `${grpCode} grubuna` : "gruba"} atandı.`);
      setAssignTarget(null); setSelectedGroupId("");
      await loadStudents(); // havuz durumu güncellensin (grupsuz → aktif)
    } catch {
      toast.error("Sunucu hatası — atama yapılamadı.");
    } finally {
      setAssigning(false);
    }
  };

  // ── Öğrenci Detay: aç / düzenle / kaydet ──
  /** editForm'u (liste + yüklenen detaydan) yeniden kurar. */
  const buildForm = (st: Student, d: PersonDetail | null) => {
    const [firstName, ...rest] = st.name.split(" ");
    const gSale = d?.sales.find((s) => s.guardian);
    return {
      firstName, lastName: rest.join(" "),
      phone: d?.pii?.phone ?? st.phone,
      email: d?.pii?.email ?? st.email,
      gender: st.gender,
      idNo: d?.pii?.idNo ?? "",
      birthDate: d?.birthDate ?? "",
      address: d?.pii?.address ?? "",
      guardianName: gSale?.guardian?.name ?? "",
      guardianIdNo: gSale?.guardian?.idNo ?? "",
    };
  };

  const openDetail = useCallback(async (st: Student) => {
    setDetailStudent(st);
    setDetailTab("bilgiler");
    setEditMode(false);
    setDetail(null);
    setGuardianSaleId(null);
    setEditForm(buildForm(st, null)); // PII/detay gelene kadar liste verisiyle ön-doldur
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/flexos/persons/${st.id}`, { headers: await authHeaders() });
      if (!res.ok) throw new Error(String(res.status));
      const d: PersonDetail = await res.json();
      setDetail(d);
      setGuardianSaleId(d.sales.find((s) => s.guardian)?.id ?? null);
      setSelectedSaleId(d.sales[0]?.id ?? "");
      setEditForm(buildForm(st, d));
    } catch {
      toast.error("Öğrenci detayı yüklenemedi.");
    } finally {
      setLoadingDetail(false);
    }
  }, [authHeaders]);

  const closeDetail = () => { if (!saving) { setDetailStudent(null); setEditMode(false); setDetail(null); setGuardianSaleId(null); } };
  const startEdit = () => setEditMode(true);
  const cancelEdit = () => {
    if (detailStudent) setEditForm(buildForm(detailStudent, detail));
    setEditMode(false);
  };

  const saveDetail = async () => {
    if (!detailStudent) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/persons/${detailStudent.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          gender: editForm.gender,
          birthDate: editForm.birthDate || "",
          pii: {
            phone: editForm.phone.trim(),
            email: editForm.email.trim(),
            address: editForm.address.trim(),
            idNo: editForm.idNo.trim(),
            idType: "tc",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Güncelleme başarısız."); return; }

      // Veli — Sale alanı (yalnız mevcut veli kaydı varsa düzenlenir)
      if (guardianSaleId) {
        const gres = await fetch(`/api/flexos/sales/${guardianSaleId}`, {
          method: "PATCH", headers,
          body: JSON.stringify({ guardian: { name: editForm.guardianName.trim(), idNo: editForm.guardianIdNo.trim() } }),
        });
        if (!gres.ok) {
          const gj = await gres.json().catch(() => ({}));
          toast.error(gj.error || "Veli bilgisi güncellenemedi.");
        }
      }

      toast.success("Öğrenci bilgileri güncellendi.");
      setEditMode(false);
      await loadStudents();
      // detay drawer'ı tazele (PII/veli güncel görünsün)
      const dres = await fetch(`/api/flexos/persons/${detailStudent.id}`, { headers });
      if (dres.ok) setDetail(await dres.json());
      // header isim/tel/email güncelle
      setDetailStudent((prev) => prev ? {
        ...prev,
        name: `${editForm.firstName.trim()} ${editForm.lastName.trim()}`,
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        gender: editForm.gender,
      } : null);
    } catch {
      toast.error("Sunucu hatası — güncelleme yapılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const togglePStatus = (k: StatusKey) =>
    setPStatus((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const toggleDropdown = (n: "sube" | "brans" | "egitim") => setOpenDropdown((o) => (o === n ? null : n));
  const applyFilters = () => {
    setStatusFilter([...pStatus]); setSubeFilter(pSube); setBransFilter(pBrans); setEgitimFilter(pEgitim);
    setPage(1); setOpenDropdown(null);
  };
  const clearFilters = () => {
    setStatusFilter([]); setSubeFilter("Tümü"); setBransFilter("Tümü"); setEgitimFilter("Tümü");
    setPStatus([]); setPSube("Tümü"); setPBrans("Tümü"); setPEgitim("Tümü"); setPage(1); setOpenDropdown(null);
  };
  const soon = () => toast.info("Bu özellik yakında.");

  const filtered = useMemo(
    () => students.filter((st) => {
      if (statusFilter.length && !statusFilter.includes(st.status)) return false;
      if (subeFilter !== "Tümü" && !st.subeler.includes(subeFilter)) return false;
      if (bransFilter !== "Tümü" && !st.branches.includes(bransFilter)) return false;
      if (egitimFilter !== "Tümü" && !st.groups.some((g) => g.educationName === egitimFilter)) return false;
      return true;
    }),
    [students, statusFilter, subeFilter, bransFilter, egitimFilter],
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const startIdx = (curPage - 1) * PAGE_SIZE;
  const pageStudents = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  // Branş listesini gerçek öğrenci verisinden türet
  const BRANS_LIST = useMemo(() => {
    const set = new Set<string>();
    students.forEach((st) => st.branches.forEach((b) => set.add(b)));
    return ["Tümü", ...Array.from(set).sort()];
  }, [students]);

  // Eğitim listesini öğrenci gruplarından türet
  const EGITIM_LIST = useMemo(() => {
    const set = new Set<string>();
    students.forEach((st) => st.groups.forEach((g) => { if (g.educationName) set.add(g.educationName); }));
    return ["Tümü", ...Array.from(set).sort()];
  }, [students]);

  const anyFilter = pStatus.length > 0 || pSube !== "Tümü" || pBrans !== "Tümü" || pEgitim !== "Tümü";

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
        <div className="oh-spin" />
        <style>{spinCss}</style>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="ogrenci-havuzu" />

      {/* ============ MAIN ============ */}
      <main style={S.main}>
        {/* header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={S.headerIcon} dangerouslySetInnerHTML={{ __html: IC.headerUsers }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Öğrenciler</h1>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6F7B87", fontWeight: 500 }}>Tüm öğrenci kayıtlarını filtreleyin ve gruplara atayın.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button className="oh-iconbtn" style={S.bellBtn} onClick={soon}>
              <span dangerouslySetInnerHTML={{ __html: IC.bell }} />
              <span style={S.bellDot} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #E2E5EA" }}>
              <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>Alparslan Şentürk</div>
                <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Yönetici · Eğitmen</div>
              </div>
              <div style={S.avatar}>AŞ</div>
            </div>
          </div>
        </header>

        <div style={{ padding: "30px 36px 48px", maxWidth: 1920, margin: "0 auto" }}>
          {/* section chip */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
            <span style={S.countChip}>{total} öğrenci</span>
          </div>

          {/* ============ FILTER PANEL ============ */}
          <div style={S.filterPanel}>
            {/* DURUM */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <span style={S.sectionLabel}>Durum</span>
              <div style={{ flex: 1, height: 1, background: "#EEF0F3" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
              {(Object.keys(ST) as StatusKey[]).map((k) => {
                const o = ST[k];
                const checked = pStatus.includes(k);
                return (
                  <div key={k} className="oh-chip" onClick={() => togglePStatus(k)} title={o.hint}
                    style={{ ...S.statusChip, border: checked ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: checked ? "#EFF3FA" : "#fff" }}>
                    <span style={{ ...S.statusCheck, border: checked ? "1.5px solid #2867bd" : "1.5px solid #CDD2DA", background: checked ? "#2867bd" : "#fff" }}>
                      {checked && <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />}
                    </span>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: o.dot, flex: "0 0 auto" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#414B59", whiteSpace: "nowrap" }}>{o.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Şube / Branş row */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
              {/* ŞUBE */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={S.sectionLabel}>Şube</span>
                <button className="oh-select" style={{ ...S.selectBtn, minWidth: 190 }} onClick={() => toggleDropdown("sube")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.pin }} />{pSube}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                </button>
                {openDropdown === "sube" && (
                  <div style={{ ...S.dropdown, width: 200 }}>
                    {SUBE_LIST.map((v) => (
                      <div key={v} className="oh-ddrow" style={pSube === v ? S.ddActive : S.ddBase} onClick={() => { setPSube(v); setOpenDropdown(null); }}>
                        <span>{v}</span>
                        {pSube === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BRANŞ */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={S.sectionLabel}>Branş</span>
                <button className="oh-select" style={{ ...S.selectBtn, minWidth: 180 }} onClick={() => toggleDropdown("brans")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.checkSmall }} />{pBrans}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                </button>
                {openDropdown === "brans" && (
                  <div style={{ ...S.dropdown, width: 200 }}>
                    {BRANS_LIST.map((v) => (
                      <div key={v} className="oh-ddrow" style={pBrans === v ? S.ddActive : S.ddBase} onClick={() => { setPBrans(v); setOpenDropdown(null); }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: v === "Tümü" ? "#CDD2DA" : (BRANS[v]?.dot ?? BRANS_FALLBACK.dot) }} />
                          {v}
                        </span>
                        {pBrans === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* EĞİTİM */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={S.sectionLabel}>Eğitim</span>
                <button className="oh-select" style={{ ...S.selectBtn, minWidth: 200 }} onClick={() => toggleDropdown("egitim")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9, overflow: "hidden", maxWidth: 160, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.checkSmall }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pEgitim}</span>
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                </button>
                {openDropdown === "egitim" && (
                  <div style={{ ...S.dropdown, width: 240 }}>
                    {EGITIM_LIST.map((v) => (
                      <div key={v} className="oh-ddrow" style={pEgitim === v ? S.ddActive : S.ddBase} onClick={() => { setPEgitim(v); setOpenDropdown(null); }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{v}</span>
                        {pEgitim === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 10 }} />

              {anyFilter && (
                <button className="oh-clear" style={S.clearBtn} onClick={clearFilters}>
                  <span dangerouslySetInnerHTML={{ __html: IC.x }} />
                  Temizle
                </button>
              )}

              <button className="oh-filter" style={S.filterBtn} onClick={applyFilters}>
                <span dangerouslySetInnerHTML={{ __html: IC.funnel }} />
                Filtrele
              </button>
            </div>
          </div>

          {/* ============ TABLE ============ */}
          <div style={S.tableCard}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                    <th style={S.th}>Ad Soyad</th>
                    <th style={S.th}>Branş</th>
                    <th style={{ ...S.th, minWidth: 160 }}>Eğitim</th>
                    <th style={S.th}>Durum</th>
                    <th className="oh-wide-col" style={S.th}>E-posta</th>
                    <th className="oh-wide-col" style={S.th}>Telefon</th>
                    <th style={S.th}>Grup</th>
                    <th style={{ ...S.th, textAlign: "right" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.map((st) => {
                    const ss = ST[st.status];
                    const idHash = st.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
                    const pal = AV_PALETTES[idHash % AV_PALETTES.length];
                    const branchCount = st.branches.length;
                    const activeBrans = st.branches[0] ?? "—";
                    const popupOpen = hoveredBrans === st.id && branchCount > 1;
                    const groups = st.groups;
                    const groupCount = groups.length;
                    const hasGroup = groupCount > 0;
                    const groupPopupOpen = hoveredGroup === st.id && groupCount > 1;
                    return (
                      <tr key={st.id} className="oh-row" style={{ borderBottom: "1px solid #EEF0F3", cursor: "pointer" }} onClick={() => openDetail(st)}>
                        {/* Ad Soyad */}
                        <td style={S.cell}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ ...S.avatarSm, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(st.name)}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{st.name}</span>
                          </div>
                        </td>
                        {/* Branş */}
                        <td style={S.cell}>
                          <div
                            style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, cursor: "default" }}
                            onMouseEnter={() => setHoveredBrans(st.id)}
                            onMouseLeave={() => setHoveredBrans(null)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span style={{ ...S.bransBadge, color: (BRANS[activeBrans] ?? BRANS_FALLBACK).color, background: (BRANS[activeBrans] ?? BRANS_FALLBACK).background }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: (BRANS[activeBrans] ?? BRANS_FALLBACK).dot, flex: "0 0 auto" }} />
                              {activeBrans}
                            </span>
                            {branchCount > 1 && <span style={S.branchBadge}>+{branchCount - 1}</span>}
                            {popupOpen && (
                              <div style={S.branchPopup}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", padding: "4px 9px 7px" }}>
                                  Branşlar ({branchCount})
                                </div>
                                {st.branches.map((b, bi) => {
                                  const c = BRANS[b] ?? BRANS_FALLBACK;
                                  return (
                                    <div key={b} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 8, background: bi === 0 ? "#EFF3FA" : "transparent" }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: c.dot }} />
                                      <span style={{ fontSize: 13, fontWeight: 600, color: "#414B59" }}>{b}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Eğitim */}
                        <td style={S.cell} onClick={(e) => e.stopPropagation()}>
                          {st.educations.length === 0 ? (
                            <span style={{ fontSize: 13, color: "#CDD2DA" }}>—</span>
                          ) : (
                            <div
                              style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, cursor: "default" }}
                              onMouseEnter={() => setHoveredEdu(st.id)}
                              onMouseLeave={() => setHoveredEdu(null)}
                            >
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#414B59", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                title={st.educations[0].name}>
                                {st.educations[0].name}
                              </span>
                              {st.educations.length > 1 && (
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, borderRadius: 10, background: "#2867bd", color: "#fff", fontSize: 11, fontWeight: 700, padding: "0 5px" }}>
                                  +{st.educations.length - 1}
                                </span>
                              )}
                              {hoveredEdu === st.id && st.educations.length > 1 && (
                                <div style={{ ...S.branchPopup, minWidth: 200 }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", padding: "4px 9px 7px" }}>
                                    Eğitimler ({st.educations.length})
                                  </div>
                                  {st.educations.map((edu, ei) => (
                                    <div key={edu.educationId} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 8, background: ei === 0 ? "#EFF3FA" : "transparent" }}>
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto", background: "#3A7BD5" }} />
                                      <span style={{ fontSize: 13, fontWeight: 600, color: "#414B59" }}>{edu.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        {/* Durum */}
                        <td style={S.cell}>
                          <span style={{ ...S.statusBadge, color: ss.color, background: ss.background }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: ss.dot, flex: "0 0 auto" }} />
                            {ss.label}
                          </span>
                        </td>
                        {/* E-posta — geniş ekran */}
                        <td className="oh-wide-col" style={S.cell}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>{st.email}</span></td>
                        {/* Telefon — geniş ekran */}
                        <td className="oh-wide-col" style={S.cell}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 600, whiteSpace: "nowrap" }}>{st.phone ? formatTrPhone(st.phone) : "—"}</span></td>
                        {/* Grup */}
                        <td style={S.cell} onClick={(e) => e.stopPropagation()}>
                          {groupCount === 0 ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#8E95A3", fontStyle: "italic", whiteSpace: "nowrap" }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.alert }} />
                              Atanmadı
                            </span>
                          ) : groupCount === 1 ? (
                            <span style={S.groupChip}>
                              <span dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                              {groups[0].label}
                            </span>
                          ) : (
                            <div
                              style={{ position: "relative", display: "inline-flex", cursor: "default" }}
                              onMouseEnter={() => setHoveredGroup(st.id)}
                              onMouseLeave={() => setHoveredGroup(null)}
                            >
                              <span style={S.groupChip}>
                                <span dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                                {groupCount} Grup
                                <span style={S.branchBadge}>{groupCount}</span>
                              </span>
                              {groupPopupOpen && (
                                <div style={S.branchPopup}>
                                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", padding: "4px 9px 7px" }}>
                                    Gruplar ({groupCount})
                                  </div>
                                  {groups.map((g) => {
                                    const c = BRANS[g.branch] ?? BRANS_FALLBACK;
                                    return (
                                      <div key={g.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 9px", borderRadius: 8 }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                                          <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: c.dot }} />
                                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{g.label}</span>
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "#8E95A3", whiteSpace: "nowrap" }}>{g.branch}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        {/* İşlem — Gruba Ata */}
                        <td style={{ ...S.cell, textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const canAssign = !!st.assignableEnrollmentId;
                            return (
                              <button
                                className={canAssign ? "oh-assign" : undefined}
                                disabled={!canAssign}
                                title={canAssign ? "Gruba ata" : (hasGroup ? (groupCount === 1 ? `Zaten bir gruba atanmış (${groups[0].label})` : `Zaten ${groupCount} gruba atanmış`) : "Atanabilir grupsuz kayıt yok")}
                                onClick={() => openAssign(st)}
                                style={{ ...S.assignBtn, color: canAssign ? "#414B59" : "#CDD2DA", cursor: canAssign ? "pointer" : "not-allowed" }}
                              >
                                <span dangerouslySetInnerHTML={{ __html: IC.userPlus }} />
                                Gruba Ata
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* loading */}
            {loading && pageStudents.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
                <div className="oh-spin" />
                <div style={{ fontSize: 13.5, color: "#8E95A3" }}>Öğrenciler yükleniyor…</div>
              </div>
            )}

            {/* empty state */}
            {!loading && pageStudents.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
                <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.searchBig }} />
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>{students.length === 0 ? "Henüz öğrenci yok" : "Sonuç bulunamadı"}</div>
                <div style={{ fontSize: 13.5, color: "#8E95A3", maxWidth: 320 }}>{students.length === 0 ? "İlk satışı yaptığınızda öğrenciler burada görünecek." : "Seçili filtrelere uygun öğrenci yok. Filtreleri temizleyip tekrar deneyin."}</div>
              </div>
            )}

            {/* pagination */}
            {pageStudents.length > 0 && (
              <div style={S.pagination}>
                <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
                  <strong style={{ color: "#1E222B", fontWeight: 700 }}>{total}</strong> öğrenciden{" "}
                  <strong style={{ color: "#1E222B", fontWeight: 700 }}>{total ? startIdx + 1 : 0}–{startIdx + pageStudents.length}</strong> arası gösteriliyor
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <button style={{ ...S.pageArrow, cursor: curPage > 1 ? "pointer" : "not-allowed", opacity: curPage > 1 ? 1 : 0.4 }} onClick={() => setPage(Math.max(1, curPage - 1))}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} style={p === curPage ? S.pageCur : S.pageReg} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button style={{ ...S.pageArrow, cursor: curPage < totalPages ? "pointer" : "not-allowed", opacity: curPage < totalPages ? 1 : 0.4 }} onClick={() => setPage(Math.min(totalPages, curPage + 1))}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevRight }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* click-away overlay */}
      {openDropdown && <div onClick={() => setOpenDropdown(null)} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}

      {/* ============ GRUBA ATA MODAL ============ */}
      {assignTarget && (
        <div style={S.modalOverlay} onClick={closeAssign}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            {/* head */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "22px 24px 16px", borderBottom: "1px solid #EEF0F3" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DDE8F8", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
                  dangerouslySetInnerHTML={{ __html: IC.userPlus }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>Gruba Ata</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                    <strong style={{ color: "#414B59", fontWeight: 700 }}>{assignTarget.name}</strong> için bir grup seçin.
                  </p>
                </div>
              </div>
              <button className="oh-iconbtn" style={{ ...S.bellBtn, width: 36, height: 36 }} onClick={closeAssign}>
                <span dangerouslySetInnerHTML={{ __html: IC.x }} />
              </button>
            </div>

            {/* body */}
            <div style={{ padding: 16, maxHeight: 360, overflowY: "auto" }}>
              {loadingGroups ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px" }}>
                  <div className="oh-spin" />
                  <div style={{ fontSize: 13, color: "#8E95A3" }}>Gruplar yükleniyor…</div>
                </div>
              ) : groupOptions.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 20px", textAlign: "center" }}>
                  <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#414B59" }}>Henüz grup yok</div>
                  <div style={{ fontSize: 13, color: "#8E95A3", maxWidth: 280 }}>Önce Sınıflar sayfasından bir grup oluşturun.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groupOptions.map((g) => {
                    const sel = selectedGroupId === g.id;
                    return (
                      <div key={g.id} className="oh-grow" onClick={() => setSelectedGroupId(g.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: sel ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: sel ? "#EFF3FA" : "#fff" }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: sel ? "5px solid #2867bd" : "2px solid #CDD2DA", transition: "all .12s" }} />
                        <span style={{ width: 34, height: 34, borderRadius: 9, background: "#f1f5f9", color: "#6F7B87", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
                          dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{g.code}</div>
                          <div style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 11, padding: "16px 24px 20px", borderTop: "1px solid #EEF0F3" }}>
              <button className="oh-clear" style={{ ...S.selectBtn, border: "1px solid #E2E5EA", color: "#6F7B87" }} onClick={closeAssign} disabled={assigning}>Vazgeç</button>
              <button className="oh-filter" style={{ ...S.filterBtn, opacity: !selectedGroupId || assigning ? 0.55 : 1, pointerEvents: !selectedGroupId || assigning ? "none" : "auto" }} onClick={confirmAssign}>
                <span dangerouslySetInnerHTML={{ __html: IC.userPlus }} />
                {assigning ? "Atanıyor…" : "Gruba Ata"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ÖĞRENCİ DETAY BOTTOM SHEET (grup ekleme deseni) ============ */}
      <AnimatePresence>
        {detailStudent && (() => {
        const ds = detailStudent;
        const ss = ST[ds.status];
        const idHash = ds.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const pal = AV_PALETTES[idHash % AV_PALETTES.length];
        return (
          <>
            <motion.div key="oh-detail-ov" className="fx-sheet-ov"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              onClick={closeDetail}
              style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.4)" }} />
            <motion.div key="oh-detail-sheet" className="fx-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, zIndex: 81, height: "70vh", maxHeight: "70vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Sheet header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 28px 18px", background: "#F7F8FA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ ...S.avatarSm, width: 48, height: 48, fontSize: 16, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(ds.name)}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>{ds.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ ...S.statusBadge, color: ss.color, background: ss.background, fontSize: 11.5, padding: "3px 10px" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.dot }} />
                        {ss.label}
                      </span>
                      {ds.branches.map((b) => {
                        const c = BRANS[b] ?? BRANS_FALLBACK;
                        return <span key={b} style={{ ...S.bransBadge, color: c.color, background: c.background, fontSize: 11.5, padding: "3px 10px" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />{b}</span>;
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {detailTab === "bilgiler" && !editMode && (
                    <button className="oh-filter" onClick={startEdit} style={{ ...S.filterBtn, padding: "9px 18px", fontSize: 13 }}>
                      <span dangerouslySetInnerHTML={{ __html: IC.pencil }} />
                      Düzenle
                    </button>
                  )}
                  <button className="oh-iconbtn" style={{ ...S.bellBtn, width: 36, height: 36 }} onClick={closeDetail}>
                    <span dangerouslySetInnerHTML={{ __html: IC.x }} />
                  </button>
                </div>
              </div>

              {/* Sekme çubuğu */}
              <div style={{ display: "flex", gap: 4, padding: "0 28px", borderBottom: "1px solid #E2E5EA", background: "#F7F8FA" }}>
                {([
                  { key: "bilgiler" as const, label: "Bilgiler", icon: IC.idCard },
                  { key: "odeme" as const, label: "Ödeme & Satış", icon: IC.wallet },
                ]).map((t) => {
                  const on = detailTab === t.key;
                  return (
                    <button key={t.key} onClick={() => { if (!saving) { setDetailTab(t.key); if (t.key === "odeme") setEditMode(false); } }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: on ? "#205297" : "#8E95A3", borderBottom: on ? "2.5px solid #2867bd" : "2.5px solid transparent", marginBottom: -1 }}>
                      <span dangerouslySetInnerHTML={{ __html: t.icon }} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Sheet body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 28px" }}>
                {detailTab === "bilgiler" ? (
                  !editMode ? (
                    /* ── Bilgiler · Görüntüleme ── */
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 32px" }}>
                      <div><div style={S.fieldLabel}>Ad</div><div style={S.fieldValue}>{editForm.firstName || "—"}</div></div>
                      <div><div style={S.fieldLabel}>Soyad</div><div style={S.fieldValue}>{editForm.lastName || "—"}</div></div>
                      <div><div style={S.fieldLabel}>Telefon</div><div style={S.fieldValue}>{editForm.phone ? formatTrPhone(editForm.phone) : "—"}</div></div>
                      <div><div style={S.fieldLabel}>E-posta</div><div style={S.fieldValue}>{editForm.email || "—"}</div></div>
                      <div><div style={S.fieldLabel}>TC Kimlik No</div><div style={S.fieldValue}>{loadingDetail && !detail ? "…" : (editForm.idNo || "—")}</div></div>
                      <div><div style={S.fieldLabel}>Doğum Tarihi</div><div style={S.fieldValue}>{loadingDetail && !detail ? "…" : (editForm.birthDate ? fmtDate(editForm.birthDate) : "—")}</div></div>
                      <div><div style={S.fieldLabel}>Cinsiyet</div><div style={S.fieldValue}>{editForm.gender === "male" ? "Erkek" : editForm.gender === "female" ? "Kadın" : "—"}</div></div>
                      <div>
                        <div style={S.fieldLabel}>Gruplar</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                          {ds.groups.length === 0
                            ? <span style={{ fontSize: 13.5, color: "#8E95A3", fontStyle: "italic" }}>Grup atanmamış</span>
                            : ds.groups.map((g) => (
                              <span key={g.label} style={S.groupChip}>
                                <span dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                                {g.label}
                              </span>
                            ))
                          }
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={S.fieldLabel}>Adres</div>
                        <div style={S.fieldValue}>{loadingDetail && !detail ? "…" : (editForm.address || "—")}</div>
                      </div>
                      {guardianSaleId && (
                        <div style={{ gridColumn: "1 / -1", paddingTop: 14, borderTop: "1px dashed #E2E5EA" }}>
                          <div style={{ ...S.fieldLabel, color: "#8A5A00", marginBottom: 10 }}>Veli (18 yaş altı)</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px" }}>
                            <div><div style={S.fieldLabel}>Veli Adı Soyadı</div><div style={S.fieldValue}>{editForm.guardianName || "—"}</div></div>
                            <div><div style={S.fieldLabel}>Veli TC</div><div style={S.fieldValue}>{editForm.guardianIdNo || "—"}</div></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Bilgiler · Düzenleme ── */
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 24px" }}>
                      <div>
                        <label style={S.fieldLabel}>Ad</label>
                        <input style={S.input} value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>Soyad</label>
                        <input style={S.input} value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>Telefon</label>
                        <input style={S.input} value={formatTrPhone(editForm.phone)} inputMode="tel" onChange={(e) => setEditForm((f) => ({ ...f, phone: formatTrPhone(e.target.value) }))} placeholder="0 (5XX) XXX XX XX" />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>E-posta</label>
                        <input style={S.input} type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="ornek@mail.com" />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>TC Kimlik No</label>
                        <input style={S.input} value={editForm.idNo} inputMode="numeric" maxLength={11} onChange={(e) => setEditForm((f) => ({ ...f, idNo: e.target.value.replace(/\D/g, "") }))} placeholder="11 haneli" />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>Doğum Tarihi</label>
                        <input style={{ ...S.input, cursor: "pointer" }} type="date" value={editForm.birthDate} onChange={(e) => setEditForm((f) => ({ ...f, birthDate: e.target.value }))} />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>Cinsiyet</label>
                        <select style={{ ...S.input, cursor: "pointer" }} value={editForm.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}>
                          <option value="">Belirtilmemiş</option>
                          <option value="male">Erkek</option>
                          <option value="female">Kadın</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={S.fieldLabel}>Adres</label>
                        <textarea style={{ ...S.input, minHeight: 64, resize: "vertical", lineHeight: 1.4 }} value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} placeholder="İletişim adresi" />
                      </div>
                      {guardianSaleId && (
                        <div style={{ gridColumn: "1 / -1", paddingTop: 14, borderTop: "1px dashed #E2E5EA" }}>
                          <div style={{ ...S.fieldLabel, color: "#8A5A00", marginBottom: 10 }}>Veli (18 yaş altı)</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
                            <div>
                              <label style={S.fieldLabel}>Veli Adı Soyadı</label>
                              <input style={S.input} value={editForm.guardianName} onChange={(e) => setEditForm((f) => ({ ...f, guardianName: e.target.value }))} />
                            </div>
                            <div>
                              <label style={S.fieldLabel}>Veli TC</label>
                              <input style={S.input} value={editForm.guardianIdNo} inputMode="numeric" maxLength={11} onChange={(e) => setEditForm((f) => ({ ...f, guardianIdNo: e.target.value.replace(/\D/g, "") }))} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* ── Ödeme & Satış · salt görüntüleme ── */
                  loadingDetail && !detail ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 20px" }}>
                      <div className="oh-spin" /><div style={{ fontSize: 13, color: "#8E95A3" }}>Ödeme bilgileri yükleniyor…</div>
                    </div>
                  ) : !detail || (detail.sales.length === 0 && detail.payments.length === 0) ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 20px", textAlign: "center" }}>
                      <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.wallet }} />
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#414B59" }}>Ödeme/satış kaydı yok</div>
                      <div style={{ fontSize: 13, color: "#8E95A3", maxWidth: 300 }}>Bu öğrenciye ait ödeme planı bulunmuyor veya görüntüleme yetkiniz yok.</div>
                    </div>
                  ) : (
                    (() => {
                      // Seçili eğitim (= satış/enrollment) — selector bunu sürer
                      const sales = detail.sales;
                      const sel = sales.find((s) => s.id === selectedSaleId) ?? sales[0];
                      const selPayments = sel ? detail.payments.filter((p) => p.saleId === sel.id) : [];
                      const expected = (sel?.soldPrice ?? 0) + (sel?.financingFee ?? 0);
                      const paid = selPayments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
                      const remaining = Math.max(0, expected - paid);
                      const rb = ROLLUP_BADGE[clientRollup(selPayments, expected)];
                      const single = sales.length <= 1;
                      return (
                        <>
                          {/* eğitim seçici (satın aldığı eğitimler) + salt görüntüleme şeridi */}
                          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                              <span style={S.fieldLabel}>Satın aldığı eğitim{single ? "" : `ler (${sales.length})`}</span>
                              <div style={{ position: "relative" }}>
                                <select
                                  value={sel?.id ?? ""}
                                  disabled={single}
                                  onChange={(e) => setSelectedSaleId(e.target.value)}
                                  style={{ ...S.input, minWidth: 280, appearance: "none", paddingRight: 40, cursor: single ? "default" : "pointer", background: single ? "#EEF0F3" : "#fff", color: single ? "#6F7B87" : "#1E222B" }}
                                >
                                  {sales.map((s) => (
                                    <option key={s.id} value={s.id}>{s.educationName}{s.status === "cancelled" ? " (İptal)" : ""}</option>
                                  ))}
                                </select>
                                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: single ? 0.4 : 1 }} dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                              </div>
                            </div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: "#EEF0F3", color: "#6F7B87", fontSize: 12, fontWeight: 600 }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.lock }} /> Salt görüntüleme
                            </div>
                          </div>

                          {/* seçili eğitim başlık kartı */}
                          {sel && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", marginBottom: 14 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel.educationName}</div>
                                <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 2 }}>{fmtDate(sel.date)}{sel.status === "cancelled" ? " · İptal edildi" : ""}</div>
                              </div>
                              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <div style={{ fontSize: 14.5, fontWeight: 800, color: sel.status === "cancelled" ? "#B42318" : "#1E222B", textDecoration: sel.status === "cancelled" ? "line-through" : "none" }}>{tl(sel.soldPrice)}</div>
                                {sel.financingFee > 0 && <div style={{ fontSize: 11.5, color: "#8A5A00", fontWeight: 600 }}>+{tl(sel.financingFee)} vade farkı</div>}
                              </div>
                            </div>
                          )}

                          {/* özet kartları (seçili eğitim) */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
                            <div style={S.payStat}><div style={S.payStatLbl}>Toplam</div><div style={{ ...S.payStatVal, color: "#1E222B" }}>{tl(expected)}</div></div>
                            <div style={S.payStat}><div style={S.payStatLbl}>Ödenen</div><div style={{ ...S.payStatVal, color: "#007A30" }}>{tl(paid)}</div></div>
                            <div style={S.payStat}><div style={S.payStatLbl}>Kalan</div><div style={{ ...S.payStatVal, color: remaining > 0 ? "#B42318" : "#007A30" }}>{tl(remaining)}</div></div>
                          </div>
                          {rb && (
                            <div style={{ marginBottom: 22 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: rb.color, background: rb.background }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: rb.color }} />Ödeme durumu: {rb.label}
                              </span>
                            </div>
                          )}

                          {/* ödeme planı (seçili eğitim) */}
                          <div>
                            <div style={S.payecHead}>Ödeme Planı</div>
                            {selPayments.length === 0 ? (
                              <div style={{ padding: "18px 16px", borderRadius: 12, border: "1px dashed #E2E5EA", background: "#fff", fontSize: 13, color: "#8E95A3", textAlign: "center" }}>
                                Bu eğitim için ödeme planı girilmemiş.
                              </div>
                            ) : (
                              <div style={{ border: "1px solid #E2E5EA", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                                {selPayments.map((p, i) => {
                                  const b = PAY_STATUS_BADGE[p.status] ?? PAY_STATUS_BADGE.planned;
                                  const isInst = p.installmentNo != null;
                                  return (
                                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid #EEF0F3" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                        <span style={{ width: 30, height: 30, borderRadius: 8, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", color: "#6F7B87", fontSize: 12, fontWeight: 700 }}>
                                          {isInst ? `${p.installmentNo}` : <span dangerouslySetInnerHTML={{ __html: IC.cash }} />}
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>
                                            {PAY_METHOD_LABEL[p.method] ?? p.method}{isInst ? ` · ${p.installmentNo}/${p.installmentTotal}. taksit` : ""}
                                          </div>
                                          <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, marginTop: 1 }}>
                                            {p.paidAt ? `Ödendi: ${fmtDate(p.paidAt)}` : p.dueDate ? `Vade: ${fmtDate(p.dueDate)}` : "—"}
                                          </div>
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap" }}>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: "#1E222B" }}>{tl(p.amount)}</span>
                                        <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: b.color, background: b.background }}>{b.label}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()
                  )
                )}
              </div>

              {/* Sheet footer (düzenleme modunda) */}
              {detailTab === "bilgiler" && editMode && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 11, padding: "16px 28px 22px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
                  <button className="oh-clear" onClick={cancelEdit} disabled={saving}
                    style={{ ...S.selectBtn, border: "1px solid #E2E5EA", color: "#6F7B87" }}>Vazgeç</button>
                  <button className="oh-filter" onClick={saveDetail}
                    style={{ ...S.filterBtn, opacity: saving ? 0.55 : 1, pointerEvents: saving ? "none" : "auto" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.checkWhiteLg }} />
                    {saving ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        );
      })()}
      </AnimatePresence>
    </div>
  );
}

// ── stiller ───────────────────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 1920px) / 2 + 36px))", background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 },
  filterPanel: { position: "relative", zIndex: 20, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(15,31,61,.04)", marginBottom: 18 },
  sectionLabel: { fontSize: 11.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em" },
  statusChip: { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, cursor: "pointer", transition: "all .14s" },
  statusCheck: { position: "relative", width: 17, height: 17, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  selectBtn: { display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 15px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  dropdown: { position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "oh-ddin .15s cubic-bezier(.2,.8,.3,1)" },
  ddBase: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#414B59" },
  ddActive: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#205297", background: "#E2EAF3" },
  clearBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 14px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  filterBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },
  tableCard: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  th: { padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", letterSpacing: ".02em" },
  cell: { padding: "15px 24px", verticalAlign: "middle" },
  avatarSm: { width: 36, height: 36, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12.5, fontWeight: 700 },
  statusBadge: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" },
  bransBadge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" },
  groupChip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #E2E5EA", fontSize: 13, fontWeight: 700, color: "#414B59", whiteSpace: "nowrap" },
  assignBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "none", background: "transparent", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .13s" },
  branchBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#2867bd", boxShadow: "0 3px 8px -3px rgba(40,103,189,.55)", flex: "0 0 auto" },
  branchPopup: { position: "absolute", top: "calc(100% + 9px)", left: 0, minWidth: 172, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 18px 40px -12px rgba(15,31,61,.26)", padding: 8, zIndex: 50, animation: "oh-ddin .14s cubic-bezier(.2,.8,.3,1)" },
  emptyIcon: { width: 58, height: 58, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "16px 24px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" },
  pageArrow: { width: 38, height: 38, borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  pageCur: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #2867bd", background: "#2867bd", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(40,103,189,.5)" },
  pageReg: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", fontWeight: 600, fontSize: 14, fontFamily: "inherit", cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "oh-ddin .14s ease" },
  modal: { width: "100%", maxWidth: 440, background: "#fff", borderRadius: 18, boxShadow: "0 28px 60px -16px rgba(15,31,61,.4)", overflow: "hidden", display: "flex", flexDirection: "column" },
  fieldLabel: { fontSize: 11.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", marginBottom: 6 },
  fieldValue: { fontSize: 14.5, fontWeight: 600, color: "#1E222B", lineHeight: 1.4 },
  payStat: { padding: "13px 15px", borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff" },
  payStatLbl: { fontSize: 11.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", marginBottom: 5 },
  payStatVal: { fontSize: 17, fontWeight: 800, letterSpacing: "-.3px" },
  payecHead: { fontSize: 12.5, fontWeight: 800, color: "#414B59", letterSpacing: ".02em", marginBottom: 10, textTransform: "uppercase" },
  input: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#F7F8FA", fontSize: 14, fontWeight: 600, color: "#1E222B", fontFamily: "inherit", outline: "none", transition: "border-color .14s" },
};

// ── ikonlar (lucide, design'dan birebir) ──────────────────────────────────────
const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  headerUsers: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'width="23" height="23" stroke="#fff"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  pin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16" stroke="#8E95A3"'),
  checkSmall: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>', 'width="16" height="16" stroke="#8E95A3"'),
  chevDown: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2.3"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="11" height="11" stroke="#fff" stroke-width="3.4"'),
  checkBlue: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#205297" stroke-width="3"'),
  x: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.3"'),
  funnel: sv('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 'width="17" height="17"'),
  groupIcon: sv('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>', 'width="14" height="14" stroke="#6F7B87"'),
  alert: sv('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>', 'width="13" height="13"'),
  eye: sv('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', 'width="15" height="15"'),
  userPlus: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>', 'width="15" height="15"'),
  searchBig: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="26" height="26" stroke-width="1.8"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  pencil: sv('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>', 'width="14" height="14"'),
  checkWhiteLg: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#fff" stroke-width="2.8"'),
  idCard: sv('<rect width="18" height="14" x="3" y="5" rx="2"/><path d="M7 15h4M15 11h2M15 15h2M7 11h.01"/><circle cx="9" cy="11" r="0"/>', 'width="15" height="15"'),
  wallet: sv('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>', 'width="15" height="15"'),
  lock: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="13" height="13"'),
  cash: sv('<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>', 'width="14" height="14" stroke="#6F7B87"'),
};

const spinCss = `.oh-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:oh-spin 1s linear infinite}@keyframes oh-spin{to{transform:rotate(360deg)}}`;
const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes oh-ddin{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
.oh-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:oh-spin 1s linear infinite}@keyframes oh-spin{to{transform:rotate(360deg)}}
.oh-chip:hover{border-color:#CDD2DA}
.oh-select:hover{border-color:#CDD2DA;background:#F7F8FA}
.oh-clear:hover{background:#FFECEC}
.oh-filter:hover{filter:brightness(1.05)}
.oh-ddrow:hover{background:#F5F7FB}
.oh-row:hover{background:#F7F8FA}
.oh-iconbtn:hover{background:#F7F8FA;color:#1E222B}
.oh-detail:hover{border-color:#92b6e8;color:#2867bd;background:#EFF3FA}
.oh-assign:hover{color:#2867bd;background:#EFF3FA}
.oh-grow:hover{border-color:#92b6e8 !important;background:#F7F8FA}
@media(max-width:1599px){.oh-wide-col{display:none}}
.fx-sheet{left:248px;right:0;max-width:1920px;margin-left:auto;margin-right:auto}
.fx-sheet-ov{left:248px;right:0}
@media(min-width:1536px){.fx-sheet,.fx-sheet-ov{left:272px}}
@media(min-width:2560px){.fx-sheet,.fx-sheet-ov{left:300px}}
`;
