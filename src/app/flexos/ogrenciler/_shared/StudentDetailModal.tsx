"use client";

/**
 * Öğrenci Detay — MODAL. Claude Design çıktısından (`Öğrenci Bilgi Modal.dc.html`)
 * BİREBİR UI portu — SADECE modal'ın kendisi (tasarımdaki sahte arkaplan öğrenci listesi
 * BİLİNÇLİ OLARAK göz ardı edildi, 2026-07-16 kullanıcı talimatı — çağıran ekranın kendi
 * listesi/roster'ı zaten var). Eğitmen Sınıflar'da bir öğrenciye tıklarsa bu açılır
 * (admin/op için bunun yerine sağdan kayan `StudentDetailTabsPanel` açılır).
 *
 * Ödeme sekmesi YOK (tasarımda da yok) — sadece Genel + Eğitim.
 *
 * DÜZENLEME (2026-07-23): `StudentDetailTabsPanel` ile AYNI kural — sadece doğum
 * tarihi + iletişim (tel/e-posta/adres) `person.edit`/`person.pii.write` varsa
 * düzenlenebilir. Bu modal SADECE `canManage=false` (group.assign_student yok)
 * durumda açıldığı için pratikte Full moddaki eğitmende buton hiç görünmez —
 * ama Eğitmen Tek Başına modunda bu capability'ler `EGITMEN_STANDALONE_EXTRA`'dan
 * gelirse (packages.ts) düzenleme burada da doğru şekilde açılır, özel bir rol
 * kontrolü YAZILMADI (capability tek doğruluk kaynağı).
 */

import { AnimatePresence, motion } from "framer-motion";
import { X, Mail, MapPin, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { useStudentDetail } from "./useStudentDetail";
import { StudentGenelBilgiler, type EditableDraft } from "./StudentGenelBilgiler";
import { StudentEgitimBilgileri } from "./StudentEgitimBilgileri";
import { FlexSpinner } from "../../_components/FlexSpinner";
import { useCapabilities } from "../../_components/useCapabilities";
import { initials, avatarGradient, statusMeta } from "./studentShared";

const EMPTY_DRAFT: EditableDraft = { birthDate: "", phone: "", email: "", address: "" };

export function StudentDetailModal({ personId, onClose }: { personId: string; onClose: () => void }) {
  const { caps } = useCapabilities();
  const { person, trainings, poolStatus, subeler, loading, reload } = useStudentDetail(personId);
  const fullName = person ? `${person.firstName} ${person.lastName}`.trim() : "";
  const [c1, c2] = avatarGradient(personId);
  const status = statusMeta(poolStatus);

  const canEdit = caps.has("person.edit");
  const canWritePii = caps.has("person.pii.write");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditableDraft>(EMPTY_DRAFT);

  const startEdit = () => {
    if (!person) return;
    setDraft({
      birthDate: person.birthDate || "",
      phone: person.pii?.phone || "",
      email: person.pii?.email || "",
      address: person.pii?.address || "",
    });
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const u = auth.currentUser;
      const token = u ? await u.getIdToken() : "";
      const body: Record<string, unknown> = { birthDate: draft.birthDate };
      if (canWritePii) body.pii = { phone: draft.phone, email: draft.email, address: draft.address };
      const res = await fetch(`/api/flexos/persons/${personId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Bilgiler güncellenemedi.");
        return;
      }
      toast.success("Öğrenci bilgileri güncellendi.");
      setEditing(false);
      await reload();
    } catch {
      toast.error("Sunucu hatası — güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="student-modal-ov"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center p-5"
        style={{ background: "rgba(15,31,61,.45)" }}
      >
        <motion.div
          key="student-modal"
          initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[940px] bg-white rounded-[20px] shadow-[0_30px_70px_-20px_rgba(15,31,61,.5)] overflow-hidden flex flex-col"
          style={{ maxHeight: "calc(100vh - 40px)" }}
        >
          {/* HEADER */}
          <div className="p-6 shrink-0" style={{ background: "linear-gradient(135deg,#EAF1FB,#F4F7FC)", borderBottom: "1px solid #EEF0F3" }}>
            <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-[17px] min-w-0">
              <div
                className="w-[62px] h-[62px] rounded-full shrink-0 flex items-center justify-center text-white text-[22px] font-extrabold"
                style={{ background: `linear-gradient(135deg,${c1},${c2})`, boxShadow: "0 10px 22px -10px rgba(15,31,61,.4)" }}
              >
                {fullName ? initials(fullName) : ""}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="m-0 text-[21px] font-extrabold tracking-tight text-[#1E222B]">
                    {fullName || "Yükleniyor…"}
                    {person?.isOnlineStudent && <span className="ml-1.5 text-[13px] font-bold text-blue-500">(O)</span>}
                  </h2>
                  {person && (
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-[12px] font-bold" style={{ color: status.color, background: status.background }}>
                      {status.label}
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] text-[#6F7B87] font-semibold mt-1.5 flex items-center gap-3 flex-wrap">
                  <span>Öğrenci bilgi kartı · Eğitmen görünümü</span>
                  {person?.pii?.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{person.pii.email}</span>}
                  {subeler.length > 0 && <span className="inline-flex items-center gap-1"><MapPin size={12} />{subeler.join(", ")}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canEdit && person && (
                editing ? (
                  <>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="h-9 px-3.5 rounded-[10px] border border-[#DCE3EC] bg-white/85 flex items-center text-[12.5px] font-bold text-[#6F7B87] cursor-pointer disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="h-9 px-3.5 rounded-[10px] border-none text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#2867bd,#205297)" }}
                    >
                      {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEdit}
                    className="h-9 px-3.5 rounded-[10px] border border-[#DCE3EC] bg-white/85 flex items-center gap-1.5 text-[12.5px] font-bold text-[#6F7B87] cursor-pointer hover:text-[#205297] hover:bg-white transition-colors"
                  >
                    <Pencil size={14} />
                    Düzenle
                  </button>
                )
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-[10px] border border-[#DCE3EC] flex items-center justify-center cursor-pointer text-[#6F7B87] hover:text-[#1E222B] hover:bg-white transition-colors shrink-0"
                style={{ background: "rgba(255,255,255,.85)" }}
              >
                <X size={18} />
              </button>
            </div>
            </div>
          </div>

          {/* BODY — 2026-07-16 GERÇEK BUG FIX: yüklenme durumunda burası sadece küçük bir
              spinner bloğuydu, veri gelince modal aniden gerçek içerik boyutuna sıçrıyordu
              ("daracık açılıp sonra büyüyor"). `min-h` artık HER İKİ dalda da sabit — modal
              kutusu en baştan gerçek boyutuna yakın açılıyor, veri gelince sıçrama olmuyor. */}
          <div className="flex-1 overflow-y-auto min-h-[620px]">
            {!person ? (
              <div className="flex items-center justify-center h-full py-16"><FlexSpinner /></div>
            ) : (
              <div className="p-6 grid gap-6 items-start" style={{ gridTemplateColumns: "minmax(0,300px) minmax(0,1fr)" }}>
                <div>
                  <div className="text-[12px] font-extrabold text-[#414B59] uppercase tracking-wide mb-3">Genel Bilgiler</div>
                  <StudentGenelBilgiler
                    person={person} poolStatus={poolStatus} subeler={subeler} compact
                    editing={editing} draft={draft} onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                  />
                </div>
                <div>
                  <div className="text-[12px] font-extrabold text-[#414B59] uppercase tracking-wide mb-3">Eğitim Bilgileri</div>
                  {loading && trainings.length === 0 ? <FlexSpinner size={26} /> : <StudentEgitimBilgileri trainings={trainings} compact />}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
