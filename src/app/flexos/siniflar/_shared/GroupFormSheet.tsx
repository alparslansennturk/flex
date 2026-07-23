"use client";

/**
 * FlexOS · Sınıflar — "Grup Ekle / Düzenle" bottom-sheet, PAYLAŞIMLI bileşen.
 *
 * 2026-07-23 kullanıcı bulgusu: Sınıf Detayı'ndaki "Sınıfı Düzenle" butonu
 * `router.push("/flexos/siniflar?edit=...")` yapıyordu — bu, kullanıcının GÖZÜNDE
 * "önce bir önceki sayfaya (Sınıflar listesi) döndü, sonra düzenleme sheet'i geldi"
 * gibi bir sıçramaya sebep oluyordu (gerçekten de önce liste sayfası mount oluyor,
 * sonra `?edit=` query'sini okuyup sheet'i açıyordu). Kök çözüm: formun kendisi
 * (`siniflar/page.tsx`'te ~300 satır inline'dı) buraya, PAYLAŞIMLI bir bileşene
 * çıkarıldı — hem Sınıflar listesi hem Sınıf Detayı AYNI bileşeni, kendi sayfasından
 * hiç ayrılmadan, doğrudan render eder.
 */

import React, { useCallback, useEffect, useRef, useState, CSSProperties } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import { useGroupCatalog, type EducationDoc } from "./useGroupCatalog";
import { type GroupApiItem, DAY_ABBR, formatSeansLabel } from "./groupDisplay";

type EğitimTipi = "standart" | "ozel_ders" | "kurumsal";

export interface GroupFormSheetProps {
  open: boolean;
  /** null = Yeni Grup Oluştur, dolu = o grubu düzenle. */
  editingGroup: GroupApiItem | null;
  onClose: () => void;
  /** Kaydetme başarılı olunca (host kendi listesini/detayını yeniden çeker). */
  onSaved: () => void;
}

export default function GroupFormSheet({ open, editingGroup, onClose, onSaved }: GroupFormSheetProps) {
  const [eğitimTipi, setEğitimTipi] = useState<EğitimTipi>("standart");
  const [fŞube, setFŞube] = useState("");
  const [fBrans, setFBrans] = useState("");
  const [fEğitim, setFEğitim] = useState("");
  const [fBölüm, setFBölüm] = useState("");
  const [fKod, setFKod] = useState("");
  const [fTarih, setFTarih] = useState("");
  const [fEğitmen, setFEğitmen] = useState("");
  const [fSeansIdx, setFSeansIdx] = useState(-1);
  const [fDersSaat, setFDersSaat] = useState("");
  const [fKontenjan, setFKontenjan] = useState("");
  // Düzenlenen grubun ham schedule'ı — Seans kütüphanesinde eşleşme bulunamazsa (kayıt
  // sonradan değişmiş/silinmişse, fSeansIdx=-1 kalır) `onSave` bunu geri düşer, "eşleşme
  // yok" diye grubun GERÇEK gün/saat bilgisini boş diziyle EZMEZ (2026-07-16 gerçek bug fix).
  const [editOrigSchedule, setEditOrigSchedule] = useState<{ days?: number[]; startTime?: string; endTime?: string } | null>(null);
  const [seansOpen, setSeansOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trainerOptions, setTrainerOptions] = useState<{ id: string; name: string }[]>([]);
  const [officeOptions, setOfficeOptions] = useState<{ id: string; name: string }[]>([]);

  const isEditing = !!editingGroup;

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const { branches, educations, sections, seanslar, loadingEdu, loadingSec, isSectioned, setEducations, setSections } =
    useGroupCatalog(fBrans, fEğitim, open);

  const toplamSaat = isSectioned
    ? sections.find((s) => s.id === fBölüm)?.hours ?? null
    : educations.find((e) => e.id === fEğitim)?.totalHours ?? null;

  // Eğitmen/Şube listeleri — sheet açıldığında bir kez çekilir (host'un kendi
  // sayfasında zaten varsa bile burada bağımsız/self-contained tutuluyor, host'a
  // prop drilling yaptırmamak için).
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    (async () => {
      try {
        const hdrs = await authHeaders();
        const [trRes, ofRes] = await Promise.all([
          fetch("/api/flexos/trainers", { headers: hdrs, signal: ac.signal }),
          fetch("/api/flexos/branch-offices", { headers: hdrs, signal: ac.signal }),
        ]);
        const trJson = trRes.ok ? await trRes.json() : { items: [] };
        const ofJson = ofRes.ok ? await ofRes.json() : { items: [] };
        if (!ac.signal.aborted) {
          setTrainerOptions((trJson.items ?? []).filter((t: { status?: string }) => t.status !== "pasif").map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
          setOfficeOptions(ofJson.items ?? []);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Eğitmen/şube listesi yüklenemedi.");
      }
    })();
    return () => ac.abort();
  }, [open, authHeaders]);

  const resetForm = useCallback(() => {
    setFŞube(""); setFBrans(""); setFEğitim(""); setFBölüm(""); setFKod("");
    setFTarih(""); setFEğitmen(""); setFSeansIdx(-1); setFDersSaat("");
    setFKontenjan(""); setEğitimTipi("standart");
    setEditOrigSchedule(null);
  }, []);

  // Sheet her açılışta (yeni grup VEYA düzenleme) formu doğru şekilde doldurur/sıfırlar.
  const prefilledForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { prefilledForRef.current = null; return; }
    const key = editingGroup?.id ?? "__new__";
    if (prefilledForRef.current === key) return;
    prefilledForRef.current = key;

    if (!editingGroup) { resetForm(); return; }

    const raw = editingGroup;
    setEğitimTipi((raw.type as EğitimTipi) || "standart");
    setFKod(raw.code);
    setFEğitmen(raw.trainerId || "");
    setFKontenjan(String(raw.capacity));
    setFŞube(raw.branchOfficeId || "");
    setFTarih(raw.schedule?.startDate?.split("T")[0] || "");
    setFDersSaat(raw.schedule?.sessionHours ? String(raw.schedule.sessionHours) : "");
    setEditOrigSchedule(raw.schedule ? { days: raw.schedule.days, startTime: raw.schedule.startTime, endTime: raw.schedule.endTime } : null);
    setFBölüm("");
    setFBrans("");
    setFEğitim("");

    if (raw.educationId) {
      (async () => {
        try {
          const hdrs = await authHeaders();
          const eduRes = await fetch(`/api/flexos/educations/${raw.educationId}`, { headers: hdrs });
          const eduJson = eduRes.ok ? await eduRes.json() : null;
          const branchId = eduJson?.item?.branchId;
          if (branchId) {
            setFBrans(branchId);
            const eduListRes = await fetch(`/api/flexos/educations?branchId=${encodeURIComponent(branchId)}`, { headers: hdrs });
            const eduListJson = eduListRes.ok ? await eduListRes.json() : { items: [] };
            setEducations(eduListJson.items ?? []);
            setFEğitim(raw.educationId!);

            const edu = (eduListJson.items ?? []).find((e: EducationDoc) => e.id === raw.educationId);
            if (edu?.structure === "sectioned") {
              const secRes = await fetch(`/api/flexos/sections?educationId=${encodeURIComponent(raw.educationId!)}`, { headers: hdrs });
              const secJson = secRes.ok ? await secRes.json() : { items: [] };
              setSections(secJson.items ?? []);
              if (raw.sectionId) setFBölüm(raw.sectionId);
            }

            // seans eşleştir (gün+saat aynı olan seans) — seans kütüphanesi zaten yüklü olmalı (useGroupCatalog)
            if (raw.schedule?.days?.length && raw.schedule.startTime) {
              // seanslar henüz state'e düşmemiş olabilir; bir sonraki render'da eşleşsin diye
              // burada değil, aşağıdaki ayrı effect'te (seanslar bağımlılığıyla) yapılıyor.
            }
          }
        } catch { /* alanlar boş kalır */ }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingGroup?.id]);

  // Seans eşleştirme — `seanslar` (useGroupCatalog'tan) yüklendikten SONRA çalışmalı,
  // yukarıdaki prefill effect'i seanslar boşken de tetiklenebiliyor.
  useEffect(() => {
    if (!open || !editingGroup || fSeansIdx >= 0) return;
    const raw = editingGroup;
    if (raw.schedule?.days?.length && raw.schedule.startTime && seanslar.length > 0) {
      const idx = seanslar.findIndex((s) =>
        JSON.stringify(s.days) === JSON.stringify(raw.schedule.days) &&
        s.startTime === raw.schedule.startTime && s.endTime === raw.schedule.endTime
      );
      if (idx >= 0) setFSeansIdx(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingGroup?.id, seanslar]);

  const onBransChange = (id: string) => { setFBrans(id); setFEğitim(""); setFBölüm(""); setSections([]); };
  const onEğitimChange = (id: string) => { setFEğitim(id); setFBölüm(""); setSections([]); };

  const onSave = async () => {
    if (!fKod.trim()) { toast.error("Grup kodu zorunludur."); return; }
    setSaving(true);

    const selSeans = fSeansIdx >= 0 ? seanslar[fSeansIdx] : null;
    const fallbackSchedule = !selSeans ? editOrigSchedule : null;

    const body = {
      code: fKod.trim(),
      type: eğitimTipi,
      educationId: fEğitim || undefined,
      sectionId: isSectioned && fBölüm ? fBölüm : undefined,
      branchOfficeId: fŞube || undefined,
      trainerId: fEğitmen || undefined,
      seansId: selSeans?.id ?? undefined,
      schedule: {
        startDate: fTarih || undefined,
        days: selSeans?.days ?? fallbackSchedule?.days ?? [],
        startTime: selSeans?.startTime ?? fallbackSchedule?.startTime ?? undefined,
        endTime: selSeans?.endTime ?? fallbackSchedule?.endTime ?? undefined,
        sessionHours: fDersSaat ? Number(fDersSaat) : undefined,
      },
      capacity: fKontenjan ? Number(fKontenjan) : undefined,
    };

    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";

      let res: Response;
      if (editingGroup) {
        res = await fetch(`/api/flexos/groups/${editingGroup.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      } else {
        res = await fetch("/api/flexos/groups", { method: "POST", headers, body: JSON.stringify({ ...body, status: "planned" }) });
      }

      const json = await res.json();
      if (!res.ok) { toast.error(json.error || (editingGroup ? "Grup güncellenemedi." : "Grup oluşturulamadı.")); return; }
      toast.success(editingGroup ? "Grup başarıyla güncellendi!" : "Grup başarıyla oluşturuldu!");
      resetForm();
      onSaved();
      onClose();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  const seansDisplay = fSeansIdx >= 0 && seanslar[fSeansIdx] ? formatSeansLabel(seanslar[fSeansIdx]) : "Seans seçin";
  const isCorporate = eğitimTipi === "kurumsal";

  return (
    <AnimatePresence>
      {open && (
        <>
          <style>{css}</style>
          <motion.div key="gfs-overlay" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={() => { if (!saving) onClose(); }} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.4)" }} />
          <motion.div key="gfs-sheet" className="fx-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, zIndex: 81, height: "85vh", maxHeight: "85vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 28px 18px", background: "#F7F8FA" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ ...S.headIconWrap, background: isEditing ? "#FFF3DC" : "#E2EAF3", color: isEditing ? "#8A5A00" : "#205297" }}>
                  <span dangerouslySetInnerHTML={{ __html: isEditing ? IC.pencil : IC.plus }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>
                    {isEditing ? "Grup Düzenle" : "Yeni Grup Oluştur"}
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                    {isEditing ? "Seçili grubun bilgilerini güncelleyin." : "Yeni bir sınıf grubu oluşturun."}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isEditing && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: "#FFF3DC", color: "#8A5A00", fontSize: 12.5, fontWeight: 700 }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                    {fKod} düzenleniyor
                  </span>
                )}
                <button onClick={() => { if (!saving) onClose(); }} className="gfs-iconbtn" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
                </button>
              </div>
            </div>

            {/* scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>
              {/* Eğitim Formatı segmented */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#414B59", letterSpacing: ".04em", marginBottom: 9 }}>Eğitim Formatı</span>
                <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
                  {([
                    { key: "standart" as EğitimTipi, label: "Grup (standart)", icon: IC.usersSmall },
                    { key: "ozel_ders" as EğitimTipi, label: "Özel Ders", icon: IC.userSingle },
                    { key: "kurumsal" as EğitimTipi, label: "Kurumsal Eğitim", icon: IC.buildingSm },
                  ]).map((t) => {
                    const active = eğitimTipi === t.key;
                    return (
                      <button key={t.key} onClick={() => setEğitimTipi(t.key)} style={segStyle(active)}>
                        <span style={segCheck(active)}>{active && <span dangerouslySetInnerHTML={{ __html: IC.checkTiny }} />}</span>
                        <span dangerouslySetInnerHTML={{ __html: t.icon }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {isCorporate && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "18px 20px", borderRadius: 14, background: "#FFF3DC", border: "1px solid #FFE2A8" }}>
                  <span style={{ flex: "0 0 auto", marginTop: 1 }} dangerouslySetInnerHTML={{ __html: IC.info }} />
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#8A5A00" }}>Kurumsal eğitim akışı ayrı tasarlanacak</div>
                    <div style={{ fontSize: 13, color: "#8A5A00", opacity: 0.85, marginTop: 3, lineHeight: 1.5 }}>Kurumsal eğitimlerde firma bilgileri, sözleşme ve özel fiyatlandırma alanları farklıdır. Bu form şu an Grup ve Özel Ders için hazırdır.</div>
                  </div>
                </div>
              )}

              {!isCorporate && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "18px 20px" }}>
                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Şube</span>
                      <SelectW>
                        <select value={fŞube} onChange={(e) => setFŞube(e.target.value)} style={S.sel}>
                          <option value="">Şube seçin</option>
                          {officeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </SelectW>
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Branş</span>
                      <SelectW>
                        <select value={fBrans} onChange={(e) => onBransChange(e.target.value)} style={S.sel}>
                          <option value="">Branş seçin</option>
                          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </SelectW>
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Eğitim</span>
                      <SelectW>
                        <select value={fEğitim} onChange={(e) => onEğitimChange(e.target.value)} disabled={!fBrans || loadingEdu}
                          style={{ ...S.sel, background: !fBrans ? "#f1f5f9" : "#fff", cursor: !fBrans ? "not-allowed" : "pointer" }}>
                          <option value="">{loadingEdu ? "Yükleniyor..." : educations.length ? "Eğitim seçin" : !fBrans ? "Önce branş seçin" : "Bu branşta eğitim yok"}</option>
                          {educations.map((ed) => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                        </select>
                      </SelectW>
                    </label>

                    {isSectioned && (
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Bölüm</span>
                        <SelectW>
                          <select value={fBölüm} onChange={(e) => setFBölüm(e.target.value)} disabled={loadingSec}
                            style={{ ...S.sel, cursor: loadingSec ? "not-allowed" : "pointer" }}>
                            <option value="">{loadingSec ? "Yükleniyor..." : sections.length ? "Bölüm seçin" : "Bölüm bulunamadı"}</option>
                            {sections.sort((a, b) => a.order - b.order).map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                          </select>
                        </SelectW>
                      </label>
                    )}

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Grup Kodu</span>
                      <input value={fKod} onChange={(e) => setFKod(e.target.value)} placeholder="örn. GRP-251" style={S.inp} />
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Başlangıç Tarihi</span>
                      <input type="date" value={fTarih} onChange={(e) => setFTarih(e.target.value)} style={S.inp} />
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Eğitmen <span style={{ fontWeight: 500, color: "#AEB4C0" }}>(opsiyonel)</span></span>
                      <SelectW>
                        <select value={fEğitmen} onChange={(e) => setFEğitmen(e.target.value)} style={S.sel}>
                          <option value="">{trainerOptions.length ? "Eğitmen seçin" : "Eğitmen yok — önce Eğitmenler'den ekleyin"}</option>
                          {trainerOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </SelectW>
                    </label>

                    <SeansPicker
                      seanslar={seanslar} fSeansIdx={fSeansIdx} setFSeansIdx={setFSeansIdx}
                      seansOpen={seansOpen} setSeansOpen={setSeansOpen} seansDisplay={seansDisplay}
                    />

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Ders Saati</span>
                      <span style={{ position: "relative", display: "flex" }}>
                        <input type="number" value={fDersSaat} onChange={(e) => setFDersSaat(e.target.value)} placeholder="örn. 3" style={{ ...S.inp, paddingRight: 80 }} />
                        <span style={S.suffix}>saat/ders</span>
                      </span>
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Toplam Saat</span>
                      <span style={{ position: "relative", display: "flex" }}>
                        <input type="text" readOnly value={toplamSaat ?? "—"} placeholder="0"
                          style={{ ...S.inp, paddingRight: 56, background: "#F7F8FA", color: "#6F7B87", cursor: "default" }} />
                        <span style={S.suffix}>saat</span>
                      </span>
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Kontenjan</span>
                      <span style={{ position: "relative", display: "flex" }}>
                        <input type="number" value={fKontenjan} onChange={(e) => setFKontenjan(e.target.value)} placeholder="0" style={{ ...S.inp, paddingRight: 52 }} />
                        <span style={S.suffix}>kişi</span>
                      </span>
                    </label>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 26, paddingTop: 20, borderTop: "1px solid #EEF0F3" }}>
                    <button className="gfs-cancel" onClick={() => { if (isEditing) onClose(); else resetForm(); }} style={S.cancelBtn}>
                      {isEditing ? "Vazgeç" : "Temizle"}
                    </button>
                    <button className="gfs-save" onClick={onSave} disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1, pointerEvents: saving ? "none" : "auto" }}>
                      <span dangerouslySetInnerHTML={{ __html: isEditing ? IC.saveFloppy : IC.plusWhite }} />
                      {saving ? "Kaydediliyor..." : isEditing ? "Değişiklikleri Kaydet" : "Grubu Oluştur"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SeansPicker({ seanslar, fSeansIdx, setFSeansIdx, seansOpen, setSeansOpen, seansDisplay }: {
  seanslar: { id: string; days: number[]; startTime: string; endTime: string }[];
  fSeansIdx: number; setFSeansIdx: (i: number) => void;
  seansOpen: boolean; setSeansOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  seansDisplay: string;
}) {
  const seansRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!seansOpen) return;
    const close = (e: MouseEvent) => {
      if (seansRef.current && !seansRef.current.contains(e.target as Node)) setSeansOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => { document.removeEventListener("mousedown", close); };
  }, [seansOpen, setSeansOpen]);

  return (
    <div ref={seansRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={S.lbl}>Seans</span>
      <button onClick={() => setSeansOpen((o) => !o)} className="gfs-seans-btn" style={S.seansBtn}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span dangerouslySetInnerHTML={{ __html: IC.clockGray }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: fSeansIdx >= 0 ? "#1E222B" : "#AEB4C0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seansDisplay}</span>
        </span>
        <span dangerouslySetInnerHTML={{ __html: IC.chevDownGray }} />
      </button>
      {seansOpen && (
        <div style={S.seansPopup}>
          {seanslar.length === 0 && (
            <div style={{ padding: "14px 11px", fontSize: 13, color: "#8E95A3", textAlign: "center" }}>Henüz seans eklenmemiş. Eğitim Ayarları → Seans Yönetimi&apos;nden ekleyin.</div>
          )}
          {seanslar.map((se, i) => {
            const active = fSeansIdx === i;
            const daysStr = se.days.map((d) => DAY_ABBR[d] ?? "?").join(" - ");
            return (
              <div key={se.id} onClick={() => { setFSeansIdx(i); setSeansOpen(false); }}
                className="gfs-seans-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: active ? "#EFF3FA" : "transparent" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 9px", borderRadius: 7, whiteSpace: "nowrap", flex: "0 0 auto" }}>{daysStr}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#414B59" }}>{se.startTime} - {se.endTime}</span>
                {active && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SelectW({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: "relative", display: "flex" }}>
      {children}
      <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }} dangerouslySetInnerHTML={{ __html: IC.chevDownGray }} />
    </span>
  );
}

const segStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit", transition: "all .14s", border: active ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA",
  background: active ? "#EFF3FA" : "#fff", color: active ? "#205297" : "#6F7B87",
});

const segCheck = (active: boolean): CSSProperties => ({
  width: 15, height: 15, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
  background: active ? "#2867bd" : "transparent", border: active ? "none" : "1.5px solid #CDD2DA",
});

const S: Record<string, CSSProperties> = {
  headIconWrap: { width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  fieldWrap: { display: "flex", flexDirection: "column" as const, gap: 7 },
  lbl: { fontSize: 12, fontWeight: 700, color: "#414B59" },
  inp: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const },
  sel: { width: "100%", padding: "11px 38px 11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", appearance: "none" as const, WebkitAppearance: "none" as const, cursor: "pointer", boxSizing: "border-box" as const },
  suffix: { position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, color: "#8E95A3", fontWeight: 600, pointerEvents: "none" as const },
  seansBtn: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", fontFamily: "inherit", cursor: "pointer", transition: "all .14s", overflow: "hidden" },
  seansPopup: { position: "absolute" as const, top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 14px 40px -12px rgba(15,31,61,.22)", padding: 7, zIndex: 60, maxHeight: 288, overflowY: "auto" as const, animation: "gfsDown .15s cubic-bezier(.2,.8,.3,1)" },
  cancelBtn: { padding: "12px 20px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  saveBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },
};

const sv = (inner: string, attrs = 'width="19" height="19" stroke="currentColor"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="20" height="20" stroke="currentColor" stroke-width="2.1"'),
  plusWhite: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke="#fff" stroke-width="2.2"'),
  pencil: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="20" height="20" stroke="currentColor" stroke-width="2.1"'),
  pencilSm: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="14" height="14" stroke="currentColor" stroke-width="2"'),
  saveFloppy: sv('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', 'width="17" height="17" stroke="#fff" stroke-width="2.2"'),
  usersSmall: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.1"'),
  userSingle: sv('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.1"'),
  buildingSm: sv('<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.1"'),
  checkTiny: sv('<path d="M20 6 9 17l-5-5"/>', 'width="10" height="10" stroke="#fff" stroke-width="3.6"'),
  checkBlue: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#205297" stroke-width="3"'),
  info: sv('<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/>', 'width="22" height="22" stroke="#8A5A00" stroke-width="2"'),
  chevDownGray: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2.3"'),
  clockGray: sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 'width="16" height="16" stroke="#8E95A3" stroke-width="2"'),
  xMark: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="15" height="15" stroke="currentColor" stroke-width="2.2"'),
};

const css = `
@keyframes gfsDown{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
/* Bottom-sheet + overlay'i içerik alanına hapset (sidebar'ı kaplamasın); geniş ekranda içerik gibi ortalanır */
.fx-sheet{left:248px;right:0;max-width:1920px;margin-left:auto;margin-right:auto}
.fx-sheet-ov{left:248px;right:0}
@media(min-width:1536px){.fx-sheet,.fx-sheet-ov{left:272px}}
@media(min-width:2560px){.fx-sheet,.fx-sheet-ov{left:300px}}
.gfs-iconbtn:hover{background:#F7F8FA;color:#1E222B}
.gfs-cancel:hover{background:#F7F8FA}
.gfs-save:hover{filter:brightness(1.07)}
.gfs-seans-btn:hover{border-color:#CDD2DA}
.gfs-seans-row:hover{background:#F7F8FA!important}
input:focus,select:focus{border-color:#a5b4fc!important;background:#fff!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
`;
