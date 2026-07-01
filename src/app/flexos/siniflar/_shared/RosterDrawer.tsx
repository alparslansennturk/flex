"use client";

/**
 * FlexOS · Sınıflar — paylaşımlı roster (sınıf listesi) drawer.
 * `canManage=false` (Full/Operasyon): salt görüntüleme — ekleme Öğrenci Havuzu'nun
 * "Gruba Ata" akışında. `canManage=true` (Core/eğitmen standalone): öğrenci
 * ekleme/çıkarma formu drawer'ın içinde (Havuz olmadığı için tek yer burası).
 *
 * Avatar = daire+baş harf (gradient) — görsel avatar YOK (feedback_avatar_style).
 */
import React, { CSSProperties, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { FlexSpinner } from "../../_components/FlexSpinner";
import { formatTrPhone } from "@/app/lib/phone";
import { type RosterItem, fmtTrDate, initials, avatarStyle } from "./groupDisplay";

interface RosterGroupRef { id: string; kod: string; eğitim: string; şube?: string; dolu: number; kontenjan: number }

interface RosterDrawerProps {
  group: RosterGroupRef | null;
  onClose: () => void;
  canManage: boolean;
  onChanged?: () => void;
}

export default function RosterDrawer({ group, onClose, canManage, onChanged }: RosterDrawerProps) {
  const [items, setItems] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(false);
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

  const load = useCallback(async (groupId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/flexos/groups/${groupId}/roster`, { headers: await authHeaders() });
      const json = res.ok ? await res.json() : { items: [] };
      setItems(json.items ?? []);
    } catch {
      toast.error("Sınıf listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!group) { setItems([]); return; }
    setRAd(""); setRSoyad(""); setRTelefon(""); setREposta("");
    load(group.id);
  }, [group, load]);

  const onAddStudent = async () => {
    if (!group) return;
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
        body: JSON.stringify({ personId: personJson.id, groupId: group.id }),
      });
      const enrollJson = await enrollRes.json().catch(() => ({}));
      if (!enrollRes.ok) { toast.error(enrollJson.error || "Öğrenci sınıfa eklenemedi."); return; }

      toast.success("Öğrenci eklendi.");
      setRAd(""); setRSoyad(""); setRTelefon(""); setREposta("");
      await load(group.id);
      onChanged?.();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setRSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeId) return;
    const id = removeId; setRemoveId(null);
    try {
      const res = await fetch(`/api/flexos/enrollments/${id}`, { method: "DELETE", headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Öğrenci çıkarılamadı."); return; }
      setItems((prev) => prev.filter((r) => r.enrollmentId !== id));
      toast.success("Öğrenci sınıftan çıkarıldı.");
      onChanged?.();
    } catch {
      toast.error("Sunucu hatası.");
    }
  };

  if (!group) return null;

  return (
    <>
      <div onClick={onClose} style={S.overlay}>
        <div onClick={(e) => e.stopPropagation()} style={S.drawer}>
          <div style={S.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={S.headerIcon} dangerouslySetInnerHTML={{ __html: IC.usersSmall }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>{group.kod} · Sınıf Listesi</h3>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                  {group.eğitim}{group.şube && group.şube !== "—" ? ` · ${group.şube}` : ""} · {group.dolu}/{group.kontenjan || "—"} öğrenci
                </p>
              </div>
            </div>
            <button onClick={onClose} style={S.closeBtn}>
              <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
            </button>
          </div>

          {canManage && (
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
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 20px" }}>
                <FlexSpinner />
                <div style={{ fontSize: 13, color: "#8E95A3" }}>Yükleniyor…</div>
              </div>
            )}
            {!loading && items.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 20px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#EEF0F3", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }} dangerouslySetInnerHTML={{ __html: IC.graduationBig }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "#414B59" }}>Bu sınıfta henüz öğrenci yok</div>
                <div style={{ fontSize: 13, color: "#8E95A3", maxWidth: 260 }}>
                  {canManage ? "Yukarıdaki formdan ilk öğrencinizi ekleyin." : "Öğrenci Havuzu'ndan \"Gruba Ata\" ile bu gruba öğrenci ekleyin."}
                </div>
              </div>
            )}
            {!loading && items.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((r, i) => (
                  <div key={r.enrollmentId} style={S.row}>
                    <span style={{ ...S.avatar, ...avatarStyle(i) }}>{initials(r.name)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email || (r.phone ? formatTrPhone(r.phone) : "") || "—"}</div>
                    </div>
                    {canManage ? (
                      <button style={S.removeBtn} onClick={() => setRemoveId(r.enrollmentId)}>Çıkar</button>
                    ) : (
                      r.assignedAt && <span style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtTrDate(r.assignedAt)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
    </>
  );
}

const S: Record<string, CSSProperties> = {
  overlay: { position: "fixed", inset: 0, zIndex: 95, background: "rgba(15,31,61,.42)", display: "flex", justifyContent: "flex-end" },
  drawer: { width: "100%", maxWidth: 440, height: "100%", background: "#fff", boxShadow: "-20px 0 60px -20px rgba(15,31,61,.4)", display: "flex", flexDirection: "column" },
  header: { padding: "22px 24px", borderBottom: "1px solid #EEF0F3", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, background: "#E2EAF3", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  closeBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", flex: "0 0 auto" },
  input: { padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E5EA", fontSize: 13, color: "#1E222B", fontFamily: "inherit", outline: "none", background: "#fff" },
  saveBtn: { padding: "10px 18px", borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 12, border: "1px solid #EEF0F3", background: "#fff" },
  avatar: { width: 32, height: 32, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 },
  removeBtn: { padding: "6px 12px", borderRadius: 8, border: "1px solid #FCD5D2", background: "#FFF3F2", color: "#D63A2E", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  confirmModal: { margin: "auto", background: "#fff", borderRadius: 16, padding: 24, width: 380, boxShadow: "0 8px 32px rgba(15,31,61,.18)" },
  cancelBtn: { padding: "10px 18px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  dangerBtn: { padding: "10px 18px", borderRadius: 10, border: "none", background: "#D63A2E", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
};

const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  usersSmall: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  xMark: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="15" height="15" stroke-width="2.2"'),
  graduationBig: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', 'width="26" height="26" stroke-width="1.8"'),
};
