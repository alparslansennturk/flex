"use client";

/**
 * FlexOS · Eğitmen Tek Başına modu — "Sınıflarım" ekranı.
 * Eğitmenin kendi grubunu açtığı, kendi öğrencisini eklediği basit panel.
 * Sistem Modu "standaloneMode=true" iken siniflar/page.tsx tarafından render edilir
 * (Operasyon'un tam Sınıflar paneli yerine).
 *
 * Stil konvansiyonu: ../kullanicilar/page.tsx ile aynı (inline style, Inter,
 * mor #7C3AED/#EDE9FE aksan, turuncu CTA gradient #FF8D28→#D66500).
 */

import React, { useCallback, useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import { FlexPageLoader, FlexSpinner } from "../_components/FlexSpinner";

// ── tipler ──
interface BranchDoc { id: string; name: string }
interface EducationDoc { id: string; name: string; branchId: string; structure?: "single" | "sectioned" }

interface GroupApiItem {
  id: string; code: string; type: string; status: string;
  educationId: string | null; educationName: string; branch: string;
  schedule: { startDate?: string; days?: number[]; sessionHours?: number };
  capacity: number; enrolled: number;
}

interface RosterItem {
  enrollmentId: string; personId: string; name: string; email: string; phone: string; assignedAt: string;
}

const DAY_LABELS = ["Pzt", "Sal", "Çrş", "Prş", "Cum", "Cts", "Paz"];
// domain: days[] 0=Pazar..6=Cumartesi → UI sırası Pzt..Paz
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

const TR_MONTH_ABBR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function fmtTrDate(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${d} ${TR_MONTH_ABBR[m - 1]} ${y}`;
}

export default function EgitmenSiniflarPanel() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  // -- katalog --
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [educations, setEducations] = useState<EducationDoc[]>([]);
  const [loadingEdu, setLoadingEdu] = useState(false);

  // -- gruplar --
  const [groups, setGroups] = useState<GroupApiItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // -- yeni sınıf formu --
  const [showForm, setShowForm] = useState(false);
  const [fBrans, setFBrans] = useState("");
  const [fEgitim, setFEgitim] = useState("");
  const [fKod, setFKod] = useState("");
  const [fTarih, setFTarih] = useState("");
  const [fGunler, setFGunler] = useState<number[]>([]);
  const [fSaat, setFSaat] = useState("");
  const [fKontenjan, setFKontenjan] = useState("");
  const [saving, setSaving] = useState(false);

  // -- roster paneli --
  const [rosterGroup, setRosterGroup] = useState<GroupApiItem | null>(null);
  const [rosterItems, setRosterItems] = useState<RosterItem[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rAd, setRAd] = useState("");
  const [rSoyad, setRSoyad] = useState("");
  const [rTelefon, setRTelefon] = useState("");
  const [rEposta, setREposta] = useState("");
  const [rSaving, setRSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    setLoadingGroups(true);
    try {
      const uid = auth.currentUser?.uid ?? "";
      const res = await fetch(`/api/flexos/groups?trainerId=${encodeURIComponent(uid)}`, { headers: await authHeaders(), signal });
      const json = res.ok ? await res.json() : { items: [] };
      if (signal?.aborted) return;
      setGroups(json.items ?? []);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Sınıflar yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoadingGroups(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await loadGroups(ac.signal);
      try {
        const hdrs = await authHeaders();
        const res = await fetch("/api/flexos/branches", { headers: hdrs, signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setBranches(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Branşlar yüklenemedi.");
      }
    })();
    return () => ac.abort();
  }, [router, authHeaders, loadGroups]);

  // -- branş seçilince eğitimler --
  useEffect(() => {
    if (!fBrans) { setEducations([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingEdu(true);
      try {
        const res = await fetch(`/api/flexos/educations?branchId=${encodeURIComponent(fBrans)}`, { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setEducations(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Eğitimler yüklenemedi.");
      } finally {
        if (!ac.signal.aborted) setLoadingEdu(false);
      }
    })();
    return () => ac.abort();
  }, [fBrans, authHeaders]);

  const toggleGun = (d: number) => {
    setFGunler((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const resetForm = () => {
    setFBrans(""); setFEgitim(""); setFKod(""); setFTarih("");
    setFGunler([]); setFSaat(""); setFKontenjan("");
  };

  const onSaveGroup = async () => {
    if (!fKod.trim()) { toast.error("Grup kodu zorunludur."); return; }
    if (!fEgitim) { toast.error("Eğitim seçimi zorunludur."); return; }
    setSaving(true);
    const branchObj = branches.find((b) => b.id === fBrans);
    const body = {
      code: fKod.trim(),
      type: "standart",
      educationId: fEgitim,
      branch: branchObj?.name,
      schedule: {
        startDate: fTarih || undefined,
        days: fGunler,
        sessionHours: fSaat ? Number(fSaat) : undefined,
      },
      capacity: fKontenjan ? Number(fKontenjan) : undefined,
    };
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/flexos/groups", { method: "POST", headers, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Sınıf oluşturulamadı."); return; }
      toast.success("Sınıf başarıyla oluşturuldu!");
      resetForm();
      setShowForm(false);
      loadGroups();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  const openRoster = useCallback(async (g: GroupApiItem) => {
    setRosterGroup(g);
    setRosterItems([]);
    setRosterLoading(true);
    setRAd(""); setRSoyad(""); setRTelefon(""); setREposta("");
    try {
      const res = await fetch(`/api/flexos/groups/${g.id}/roster`, { headers: await authHeaders() });
      const json = res.ok ? await res.json() : { items: [] };
      setRosterItems(json.items ?? []);
    } catch {
      toast.error("Sınıf listesi yüklenemedi.");
    } finally {
      setRosterLoading(false);
    }
  }, [authHeaders]);

  const closeRoster = () => { setRosterGroup(null); setRosterItems([]); };

  const onAddStudent = async () => {
    if (!rosterGroup) return;
    if (!rAd.trim() || !rSoyad.trim()) { toast.error("Ad ve soyad zorunludur."); return; }
    setRSaving(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";

      const personRes = await fetch("/api/flexos/persons", {
        method: "POST",
        headers,
        body: JSON.stringify({
          firstName: rAd.trim(),
          lastName: rSoyad.trim(),
          status: "active",
          pii: { phone: rTelefon.trim() || undefined, email: rEposta.trim() || undefined },
        }),
      });
      const personJson = await personRes.json().catch(() => ({}));
      if (!personRes.ok) { toast.error(personJson.error || "Öğrenci eklenemedi."); return; }

      const enrollRes = await fetch("/api/flexos/enrollments", {
        method: "POST",
        headers,
        body: JSON.stringify({ personId: personJson.id, groupId: rosterGroup.id }),
      });
      const enrollJson = await enrollRes.json().catch(() => ({}));
      if (!enrollRes.ok) { toast.error(enrollJson.error || "Öğrenci sınıfa eklenemedi."); return; }

      toast.success("Öğrenci eklendi.");
      setRAd(""); setRSoyad(""); setRTelefon(""); setREposta("");
      await openRoster(rosterGroup);
      loadGroups();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setRSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeId || !rosterGroup) return;
    const id = removeId; setRemoveId(null);
    try {
      const res = await fetch(`/api/flexos/enrollments/${id}`, { method: "DELETE", headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Öğrenci çıkarılamadı."); return; }
      setRosterItems((prev) => prev.filter((r) => r.enrollmentId !== id));
      toast.success("Öğrenci sınıftan çıkarıldı.");
      loadGroups();
    } catch {
      toast.error("Sunucu hatası.");
    }
  };

  if (authed === null) return <FlexPageLoader />;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="siniflar" />

      <main style={S.main}>
        <header style={S.header}>
          <div style={S.headerInner}>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Sınıflarım</h1>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6F7B87", fontWeight: 500 }}>Kendi sınıflarınızı açın, öğrenci ekleyin.</p>
            </div>
            <button style={S.addBtn} onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Vazgeç" : "+ Yeni Sınıf Aç"}
            </button>
          </div>
        </header>

        <div style={{ padding: "30px 36px 72px", maxWidth: 1100, margin: "0 auto" }}>

          {/* ===== YENİ SINIF FORMU ===== */}
          {showForm && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>Yeni Sınıf Aç</h2>
              <div style={S.formGrid}>
                <div style={S.field}>
                  <label style={S.label}>Branş</label>
                  <select style={S.input} value={fBrans} onChange={(e) => { setFBrans(e.target.value); setFEgitim(""); }}>
                    <option value="">Seçin…</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>Eğitim</label>
                  <select style={S.input} value={fEgitim} onChange={(e) => setFEgitim(e.target.value)} disabled={!fBrans || loadingEdu}>
                    <option value="">{loadingEdu ? "Yükleniyor…" : "Seçin…"}</option>
                    {educations.map((ed) => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>Grup Kodu</label>
                  <input style={S.input} value={fKod} onChange={(e) => setFKod(e.target.value)} placeholder="örn. DSN-101" />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Başlangıç Tarihi</label>
                  <input type="date" style={S.input} value={fTarih} onChange={(e) => setFTarih(e.target.value)} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Seans Saati</label>
                  <input type="number" min={0} style={S.input} value={fSaat} onChange={(e) => setFSaat(e.target.value)} placeholder="örn. 2" />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Kontenjan</label>
                  <input type="number" min={0} style={S.input} value={fKontenjan} onChange={(e) => setFKontenjan(e.target.value)} placeholder="opsiyonel" />
                </div>
                <div style={{ ...S.field, gridColumn: "1 / -1" }}>
                  <label style={S.label}>Ders Günleri</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {DAY_LABELS.map((label, i) => {
                      const val = DAY_VALUES[i];
                      const active = fGunler.includes(val);
                      return (
                        <button key={val} type="button" onClick={() => toggleGun(val)} style={dayBtnStyle(active)}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button style={S.cancelBtn} onClick={() => { setShowForm(false); resetForm(); }}>Vazgeç</button>
                <button style={S.saveBtn} disabled={saving} onClick={onSaveGroup}>
                  {saving ? "Kaydediliyor…" : "Sınıfı Oluştur"}
                </button>
              </div>
            </div>
          )}

          {/* ===== SINIF LİSTESİ ===== */}
          <div style={{ marginTop: showForm ? 24 : 0 }}>
            {loadingGroups && (
              <div style={S.emptyBox}>
                <FlexSpinner />
                <div style={{ fontSize: 13.5, color: "#8E95A3", marginTop: 12 }}>Sınıflar yükleniyor…</div>
              </div>
            )}

            {!loadingGroups && groups.length === 0 && (
              <div style={S.emptyBox}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>Henüz sınıfınız yok</div>
                <div style={{ fontSize: 13.5, color: "#8E95A3", marginTop: 6 }}>“Yeni Sınıf Aç” ile ilk sınıfınızı oluşturun.</div>
              </div>
            )}

            {!loadingGroups && groups.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
                {groups.map((g) => {
                  const pct = g.capacity > 0 ? Math.round((g.enrolled / g.capacity) * 100) : 0;
                  return (
                    <div key={g.id} style={S.groupCard} onClick={() => openRoster(g)}>
                      <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B" }}>{g.code}</div>
                      <div style={{ fontSize: 12.5, color: "#6F7B87", marginTop: 3 }}>{g.educationName || "—"} · {g.branch || "—"}</div>
                      <div style={{ fontSize: 12.5, color: "#6F7B87", marginTop: 8 }}>Başlangıç: <strong style={{ color: "#1E222B" }}>{fmtTrDate(g.schedule?.startDate)}</strong></div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                        <div style={{ height: 7, borderRadius: 999, background: "#EEF0F3", flex: 1, overflow: "hidden", marginRight: 10 }}>
                          <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: "#7C3AED" }} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1E222B", whiteSpace: "nowrap" }}>
                          {g.enrolled}<span style={{ color: "#AEB4C0", fontWeight: 600 }}>/{g.capacity || "—"}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ===== ROSTER PANELİ (sağ drawer) ===== */}
      {rosterGroup && (
        <div onClick={closeRoster} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.drawer}>
            <div style={S.drawerHeader}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E222B" }}>{rosterGroup.code}</div>
                <div style={{ fontSize: 12.5, color: "#6F7B87" }}>{rosterGroup.educationName || "—"}</div>
              </div>
              <button style={S.closeBtn} onClick={closeRoster}>×</button>
            </div>

            <div style={{ padding: "18px 22px", borderBottom: "1px solid #EEF0F3" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1E222B", marginBottom: 10 }}>Öğrenci Ekle</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input style={S.input} placeholder="Ad" value={rAd} onChange={(e) => setRAd(e.target.value)} />
                <input style={S.input} placeholder="Soyad" value={rSoyad} onChange={(e) => setRSoyad(e.target.value)} />
                <input style={S.input} placeholder="Telefon" value={rTelefon} onChange={(e) => setRTelefon(e.target.value)} />
                <input style={S.input} placeholder="E-posta" value={rEposta} onChange={(e) => setREposta(e.target.value)} />
              </div>
              <button style={{ ...S.saveBtn, width: "100%", marginTop: 10 }} disabled={rSaving} onClick={onAddStudent}>
                {rSaving ? "Ekleniyor…" : "Öğrenci Ekle"}
              </button>
            </div>

            <div style={{ padding: "16px 22px", flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1E222B", marginBottom: 10 }}>
                Sınıf Listesi {rosterItems.length > 0 && <span style={{ color: "#8E95A3", fontWeight: 600 }}>({rosterItems.length})</span>}
              </div>
              {rosterLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><FlexSpinner /></div>
              )}
              {!rosterLoading && rosterItems.length === 0 && (
                <div style={{ fontSize: 13, color: "#8E95A3", padding: "12px 0" }}>Bu sınıfta henüz öğrenci yok.</div>
              )}
              {!rosterLoading && rosterItems.map((r) => (
                <div key={r.enrollmentId} style={S.rosterRow}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: "#8E95A3" }}>{r.phone || r.email || "—"}</div>
                  </div>
                  <button style={S.removeBtn} onClick={() => setRemoveId(r.enrollmentId)}>Çıkar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== ÇIKAR ONAY MODALI ===== */}
      {removeId !== null && (
        <div onClick={() => setRemoveId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.confirmModal}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Öğrenciyi çıkar</h3>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.5 }}>
              Bu öğrenciyi sınıftan çıkarmak istediğinize emin misiniz?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button style={S.cancelBtn} onClick={() => setRemoveId(null)}>Vazgeç</button>
              <button style={S.dangerBtn} onClick={confirmRemove}>Evet, çıkar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── stiller ──
function dayBtnStyle(active: boolean): CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 9,
    border: active ? "1px solid #7C3AED" : "1px solid #E2E5EA",
    background: active ? "#EDE9FE" : "#fff",
    color: active ? "#7C3AED" : "#414B59",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  };
}

const S: Record<string, CSSProperties> = {
  root: { display: "flex", minHeight: "100vh", background: "#F7F8FA", fontFamily: "'Inter', sans-serif" },
  main: { flex: 1, minWidth: 0 },
  header: { background: "#fff", borderBottom: "1px solid #E2E5EA", position: "sticky", top: 0, zIndex: 10 },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 36px", maxWidth: 1100, margin: "0 auto" },
  addBtn: {
    background: "linear-gradient(135deg, #FF8D28, #D66500)",
    color: "#fff", border: "none", borderRadius: 11, padding: "11px 20px",
    fontSize: 13.5, fontWeight: 700, cursor: "pointer",
  },
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: 24 },
  cardTitle: { margin: "0 0 18px", fontSize: 16, fontWeight: 800, color: "#1E222B" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: "#6F7B87" },
  input: {
    padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E5EA",
    fontSize: 13, color: "#1E222B", fontFamily: "inherit", outline: "none", background: "#fff",
  },
  cancelBtn: {
    padding: "10px 18px", borderRadius: 10, border: "1px solid #E2E5EA",
    background: "#fff", color: "#414B59", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  saveBtn: {
    padding: "10px 18px", borderRadius: 10, border: "none",
    background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  dangerBtn: {
    padding: "10px 18px", borderRadius: 10, border: "none",
    background: "#D63A2E", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  emptyBox: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "64px 20px", textAlign: "center", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16,
  },
  groupCard: {
    background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, padding: 18, cursor: "pointer",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 50,
    display: "flex", justifyContent: "flex-end",
  },
  drawer: {
    width: 420, maxWidth: "100%", height: "100%", background: "#fff",
    display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(15,31,61,.12)",
  },
  drawerHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 22px", borderBottom: "1px solid #EEF0F3",
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff",
    fontSize: 18, color: "#6F7B87", cursor: "pointer", lineHeight: 1,
  },
  rosterRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 0", borderBottom: "1px solid #F2F3F5",
  },
  removeBtn: {
    padding: "6px 12px", borderRadius: 8, border: "1px solid #FCD5D2",
    background: "#FFF3F2", color: "#D63A2E", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  confirmModal: {
    margin: "auto", background: "#fff", borderRadius: 16, padding: 24, width: 380,
    boxShadow: "0 8px 32px rgba(15,31,61,.18)",
  },
};

const globalCss = `
  input:focus, select:focus { border-color: #7C3AED !important; }
`;
