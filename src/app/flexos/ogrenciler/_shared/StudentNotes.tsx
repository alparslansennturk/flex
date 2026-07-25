"use client";

/**
 * Öğrenci Detay — serbest metin personel notu (2026-07-25 kullanıcı isteği).
 * Genel Bilgiler'de Adres'in altında, ana listede (Öğrenci Havuzu) GÖRÜNMEZ.
 * Tek alan — üzerine yazılır, geçmiş tutmaz ("düz bir metin alanı yeterli, fazla
 * karmaşaya gerek yok" kararı, önce tasarlanan çoklu/zaman-damgalı `PersonNote`
 * koleksiyonu fikrinden BİLEREK vazgeçildi). Sağ üstte sistem OTOMATİK olarak son
 * güncelleme tarihini basar — elle girilmez, `notesUpdatedAt` sunucu tarafından set edilir.
 *
 * Host'un genel "Düzenle" akışından (`EditableDraft`) BİLEREK BAĞIMSIZ — kendi
 * kaydet butonu var, ne zaman istenirse tek başına kaydedilebilir.
 */

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { fmtDateLong } from "./studentShared";

export function StudentNotes({
  personId, initialNotes, notesUpdatedAt, canWrite, onSaved,
}: {
  personId: string;
  initialNotes: string;
  notesUpdatedAt: string | null;
  /** false ise salt-okunur gösterir (yetkisi olmayan ama `person.note.read`'i olan biri). */
  canWrite: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [value, setValue] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initialNotes;

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const u = auth.currentUser;
      const token = u ? await u.getIdToken() : "";
      const res = await fetch(`/api/flexos/persons/${personId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Not kaydedilemedi.");
        return;
      }
      toast.success("Not kaydedildi.");
      await onSaved();
    } catch {
      toast.error("Sunucu hatası — not kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3.5 bg-[#F7F8FA] border border-[#EEF0F3] rounded-[13px] p-4">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 text-[#8E95A3]">
          <StickyNote size={15} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">Not</span>
        </div>
        {notesUpdatedAt && (
          <span className="text-[11px] font-semibold text-[#8E95A3]">
            Güncellendi: {fmtDateLong(notesUpdatedAt.slice(0, 10))}
          </span>
        )}
      </div>
      {canWrite ? (
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Örn. bir sebeple dondurdu, bu yüzden grupsuz…"
            rows={5}
            className="w-full bg-white border border-[#DCE3EC] rounded-[8px] px-2.5 py-2 text-[13.5px] font-medium text-[#1E222B] outline-none focus:border-[#2867bd] resize-y"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="px-3.5 py-1.5 rounded-[9px] border-none text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#2867bd,#205297)" }}
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </>
      ) : (
        <div className="text-[13.5px] font-medium text-[#1E222B] whitespace-pre-wrap break-words">
          {value || "—"}
        </div>
      )}
    </div>
  );
}
