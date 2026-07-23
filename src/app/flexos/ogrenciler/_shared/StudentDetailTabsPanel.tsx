"use client";

/**
 * Öğrenci Detay — gömülebilir, 3 SEKMELİ panel (modal DEĞİL, sayfa içi kayan panel).
 * `/flexos/ogrenciler/[id]/page.tsx`'teki Hero+Tab (Genel/Eğitim/Ödeme) içeriğinin
 * BİREBİR aynısı, sadece kendi sidebar/header/route'u olmadan — host sayfa Yoklama
 * Detay'daki (`yoklama/detay/page.tsx`) "liste↔detay kayması" desenini kurar, bu
 * bileşen sadece içeriktir (2026-07-23, Satış Listesi'nden öğrenciye tıklama isteği
 * — kullanıcı burada `StudentDetailPanel` (2 sekmesiz bölüm) yerine tam sayfadaki
 * GİBİ 3 sekmeli görünüm istedi, çünkü satış bağlamında Ödeme sekmesi de anlamlı).
 *
 * `ogrenciler/[id]/page.tsx` de artık BU bileşeni kullanıyor (tek kaynak, iki yerde
 * aynı markup'ın çatallanmaması için).
 *
 * NOT: host, bileşeni kapatmadan farklı bir `personId`'ye geçirebiliyorsa (ör. bir
 * kayan panelde öğrenciden öğrenciye atlanabiliyorsa) `key={personId}` vermeli —
 * aksi halde iç `tab` state'i eski öğrencide kaldığı sekmede takılı kalır.
 */

import { Mail, Phone, MapPin, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { useStudentDetail } from "./useStudentDetail";
import { StudentGenelBilgiler, type EditableDraft } from "./StudentGenelBilgiler";
import { StudentEgitimBilgileri } from "./StudentEgitimBilgileri";
import { StudentOdemeBilgileri } from "./StudentOdemeBilgileri";
import { FlexPageContent } from "../../_components/FlexHeader";
import { FlexSpinner } from "../../_components/FlexSpinner";
import { useCapabilities } from "../../_components/useCapabilities";
import { initials, avatarGradient, statusMeta } from "./studentShared";

type Tab = "genel" | "odeme" | "egitim";

const EMPTY_DRAFT: EditableDraft = { birthDate: "", phone: "", email: "", address: "" };

export function StudentDetailTabsPanel({ personId, className }: { personId: string | null; className: string }) {
  const { caps } = useCapabilities();
  const [tab, setTab] = useState<Tab>("genel");
  const { person, trainings, poolStatus, subeler, loading, reload } = useStudentDetail(personId);

  // Düzenleme (2026-07-23 kullanıcı isteği): SADECE doğum tarihi + iletişim bilgileri
  // (tel/e-posta/adres) değiştirilebilir — satış/kayıt alanları (ad, TC, şube, kayıt
  // tarihi, durum) HİÇ dokunulmaz. Buton görünürlüğü + gerçek yazma yetkisi tamamen
  // capability'ye bağlı (`person.edit`/`person.pii.write`) — bu paket kombinasyonu
  // zaten "Full modda eğitmen asla düzenleyemez, Eğitmen Tek Başına'da düzenleyebilir"
  // kuralını packages.ts'te KENDİLİĞİNDEN sağlıyor (EGITMEN_STANDALONE_EXTRA'da var,
  // EGITMEN_CORE'da yok), burada rol bazlı ayrı bir kontrol YAZILMADI.
  const canEdit = caps.has("person.edit");
  const canWritePii = caps.has("person.pii.write");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditableDraft>(EMPTY_DRAFT);

  const canReadPayment = caps.has("payment.read");
  const fullName = person ? `${person.firstName} ${person.lastName}`.trim() : "";
  const [c1, c2] = avatarGradient(personId ?? "x");
  const status = statusMeta(poolStatus);

  const startEdit = () => {
    if (!person) return;
    setDraft({
      birthDate: person.birthDate || "",
      phone: person.pii?.phone || "",
      email: person.pii?.email || "",
      address: person.pii?.address || "",
    });
    setTab("genel");
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);

  const handleSave = async () => {
    if (!personId) return;
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "genel", label: "Genel Bilgiler" },
    { key: "egitim", label: "Eğitim Bilgileri" },
    ...(canReadPayment ? [{ key: "odeme" as const, label: "Ödeme Bilgileri" }] : []),
  ];

  return (
    <FlexPageContent className={className}>
      {!personId || (loading && !person) ? (
        // `FlexPageLoader` tam-sayfa (100vh + gri #EEF0F3 arkaplan) için tasarlanmış —
        // bu panel host'un kayan/beyaz alanı içine gömülü olduğundan onun yerine düz
        // beyaz zeminde ortalanmış bir spinner kullanılıyor (2026-07-23 kullanıcı bulgusu:
        // FlexPageLoader burada dar-uzun gri bir "kutu" gibi görünüp çirkin duruyordu).
        // `h-full` — host'un kayan panel motion.div'i `flex flex-col` OLMALI ki
        // `FlexPageContent`'in kendi `flex:1`'i gerçek bir yükseklik versin, aksi halde
        // bu spinner içerik kadar dar bir kutuda üstte kalır (kullanıcı bulgusu #2).
        <div className="flex items-center justify-center h-full min-h-[50vh]"><FlexSpinner /></div>
      ) : !person ? (
        <div className="py-20 text-center text-[13px] text-[#8E95A3]">Öğrenci bulunamadı.</div>
      ) : (
        <>
          {/* HERO */}
          <div className="bg-white border border-[#E2E5EA] rounded-[18px] p-6 shadow-[0_1px_3px_rgba(15,31,61,.05)] mb-4.5">
            <div className="flex items-center gap-5 flex-wrap">
              <div
                className="w-[68px] h-[68px] rounded-full shrink-0 flex items-center justify-center text-white text-[24px] font-extrabold"
                style={{ background: `linear-gradient(135deg,${c1},${c2})`, boxShadow: "0 10px 22px -10px rgba(15,31,61,.35)" }}
              >
                {initials(fullName)}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="m-0 text-[22px] font-extrabold tracking-tight text-[#1E222B]">
                    {fullName}
                    {person.isOnlineStudent && <span className="ml-1.5 text-[14px] font-bold text-blue-500">(O)</span>}
                  </h2>
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-[12.5px] font-bold" style={{ color: status.color, background: status.background }}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-4.5 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#414B59] font-semibold"><Phone size={14} className="text-[#8E95A3]" />{person.pii?.phone || "—"}</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#414B59] font-semibold"><Mail size={14} className="text-[#8E95A3]" />{person.pii?.email || "—"}</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#414B59] font-semibold"><MapPin size={14} className="text-[#8E95A3]" />{subeler.length > 0 ? `${subeler.join(", ")} Şubesi` : "Şube atanmadı"}</span>
                </div>
              </div>
              {canEdit && (
                editing ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="px-3.5 py-2 rounded-[10px] border border-[#E2E5EA] bg-white text-[#414B59] text-[13px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3.5 py-2 rounded-[10px] border-none text-white text-[13px] font-bold cursor-pointer disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#2867bd,#205297)" }}
                    >
                      {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startEdit}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-[#E2E5EA] bg-white text-[#414B59] text-[13px] font-bold cursor-pointer shrink-0 hover:border-[#92b6e8] hover:text-[#205297] hover:bg-[#EFF3FA]"
                  >
                    <Pencil size={14} />
                    Düzenle
                  </button>
                )
              )}
            </div>
          </div>

          {/* TABS */}
          <div className="flex items-center gap-1 border-b border-[#E2E5EA] mb-5.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4.5 py-3 border-none bg-transparent text-[14.5px] font-semibold cursor-pointer -mb-px"
                style={{
                  fontWeight: tab === t.key ? 800 : 600,
                  color: tab === t.key ? "#205297" : "#8E95A3",
                  borderBottom: tab === t.key ? "2.5px solid #205297" : "2.5px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "genel" && (
            <StudentGenelBilgiler
              person={person} poolStatus={poolStatus} subeler={subeler}
              editing={editing} draft={draft} onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            />
          )}
          {tab === "odeme" && canReadPayment && (
            <div className="bg-white border border-[#E2E5EA] rounded-[18px] p-6 shadow-[0_1px_3px_rgba(15,31,61,.05)]">
              <StudentOdemeBilgileri person={person} />
            </div>
          )}
          {tab === "egitim" && (
            loading ? <div className="flex items-center justify-center py-24"><FlexSpinner /></div> : <StudentEgitimBilgileri trainings={trainings} />
          )}
        </>
      )}
    </FlexPageContent>
  );
}
