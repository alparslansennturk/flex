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
 *
 * DÜZENLEME (2026-07-27, kullanıcı bulgusu): tasarımın 940px genişliği artık BİREBİR
 * kopyalanmıyor — sonradan eklenen "Not" alanı (`StudentNotes`, tasarımda hiç yoktu) +
 * sertifika grid'i (2+ modüllü eğitimlerde yan yana 2 kart) tasarımın öngördüğünden daha
 * fazla yer istiyordu, sonuç dikey/uzun bir modal + küçük ekranda scroll'du. 940→1040px
 * + sol sütun 300→260px (bkz. `StudentGenelBilgiler` 2 sütunlu grid'i) ile sağ taraf daha
 * geniş, iki sütun birbirine yakın yükseklikte bitiyor.
 */

import { AnimatePresence, motion } from "framer-motion";
import { X, Mail, MapPin, Pencil } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { useStudentDetail } from "./useStudentDetail";
import { StudentGenelBilgiler, type EditableDraft } from "./StudentGenelBilgiler";
import { StudentNotes } from "./StudentNotes";
import { StudentEgitimBilgileri } from "./StudentEgitimBilgileri";
import { FlexSpinner } from "../../_components/FlexSpinner";
import { useCapabilities } from "../../_components/useCapabilities";
import { initials, avatarGradient, statusMeta } from "./studentShared";

const EMPTY_DRAFT: EditableDraft = { birthDate: "", phone: "", email: "", address: "" };

/** Kısa ekran yüksekliği (2026-07-29 kullanıcı bulgusu) — `Sidebar.tsx::useCompact`
 * ile AYNI desen. 900px'te sorun yoktu, 750px altında modal içeriği (min-h-[620px]
 * body + header) viewport'a sığmıyor, scroll da olmadığı için alt kısım kesiliyordu.
 * Kullanıcı kararı: scroll EKLEMEDEN, içeriği (font/padding/ikon oranlı) küçülterek
 * sığdır. */
function useWindowHeight() {
  const [h, setH] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 0));
  useEffect(() => {
    const onResize = () => setH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return h;
}

export function StudentDetailModal({ personId, onClose }: { personId: string; onClose: () => void }) {
  const { caps, loaded: capsLoaded } = useCapabilities();
  const { person, trainings, poolStatus, subeler, loading, reload } = useStudentDetail(personId);
  const fullName = person ? `${person.firstName} ${person.lastName}`.trim() : "";
  const [c1, c2] = avatarGradient(personId);
  const windowHeight = useWindowHeight();
  const shortViewport = windowHeight > 0 && windowHeight < 750;
  const status = statusMeta(poolStatus);

  const canEdit = caps.has("person.edit");
  const canWritePii = caps.has("person.pii.write");
  const canReadNote = caps.has("person.note.read");
  const canWriteNote = caps.has("person.note.write");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditableDraft>(EMPTY_DRAFT);

  // Kısa ekranda SABİT bir küçültme oranı yetmiyordu (2026-07-29 kullanıcı bulgusu:
  // notu girilmiş bir öğrencide sertifika bölümü — "Geçti/Kaldı" rozeti + varsa ödev
  // ağırlığı satırı — daha uzun, sabit 0.8 zoom bazen yine sığdırmıyordu). Bunun yerine
  // GERÇEK içerik yüksekliğini ölçüp mevcut alana göre `zoom` oranını dinamik hesaplıyoruz
  // — kaç sertifika modülü/not girilmiş olursa olsun her zaman sığar. Genişlik de AYNI
  // orana göre daralır (kullanıcı isteği: sabit 1040px'te küçültülmüş içerik etrafında
  // boşluk kalıp "yayılmış" görünmesin).
  const bodyOuterRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoomFactor, setZoomFactor] = useState(1);
  useLayoutEffect(() => {
    // `trainings` `person`'dan SONRA gelir (Eğitim Bilgileri kendi küçük spinner'ıyla
    // ayrı yükleniyor, bkz. `loading && trainings.length === 0` render dalı) — `loading`
    // beklenmeden ölçüm yapılırsa, henüz kısa (spinner'lı) içeriğe göre YANLIŞ bir zoom
    // hesaplanıp, `trainings` gelince (özellikle 2 sertifika modülü varsa) modal ikinci
    // kez, gözle görülür şekilde küçülüyordu ("en son biraz daha yükselme hareketi
    // yapıyor" — kullanıcı bulgusu, 2026-07-29). Tam veri gelene kadar bekleniyor.
    //
    // İKİNCİ kaynak (aynı gün, ikinci bulgu): `useCapabilities` KENDİ başına ayrı bir
    // async çağrı (`/api/flexos/me`) — `canReadNote` ilk render'da HER ZAMAN false
    // (capsCache soğukken), sonra true'ya döner. Bu, `StudentNotes` panelini SONRADAN
    // mount ediyordu — özellikle notu girilmiş (sertifika bölümü uzun) öğrencilerde bu
    // geç panel sol sütunu sağdakinden de uzun yapıp satırı tekrar büyütüyordu. `caps`
    // yüklenmeden de ölçüm yapılmıyor.
    if (!shortViewport || !person) { setZoomFactor(1); return; }
    if (loading || !capsLoaded) return; // trainings/caps tam gelmeden eksik içeriğe göre yanlış ölçüm yapma
    const outer = bodyOuterRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;
    content.style.zoom = "1"; // doğal (küçültülmemiş) yüksekliği ölç
    const natural = content.scrollHeight;
    const available = outer.clientHeight;
    // 2026-07-29 kullanıcı bulgusu: tam sınıra göre hesaplanan oran, alt piksel
    // yuvarlaması yüzünden birkaç piksellik taşmaya (dolayısıyla scroll'a) yol
    // açabiliyordu — "çok çok az bir içerik yüzünden scroll çıkıyor". %3'lük bir
    // güvenlik payı (`* 0.97`) ile ASLA tam sınırda durmuyor, scroll hiç tetiklenmiyor.
    const factor = available > 0 && natural > available ? Math.max(0.6, Math.min(1, (available / natural) * 0.97)) : 1;
    content.style.zoom = String(factor);
    setZoomFactor(factor);
  }, [shortViewport, person, trainings, loading, capsLoaded, editing, canReadNote, windowHeight]);

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
          className="w-full max-w-[1040px] bg-white rounded-[20px] shadow-[0_30px_70px_-20px_rgba(15,31,61,.5)] overflow-hidden flex flex-col"
          style={{ maxHeight: "calc(100vh - 40px)", maxWidth: shortViewport ? Math.round(1040 * zoomFactor) : undefined }}
        >
          {/* HEADER — kısa ekranda (bkz. `windowHeight`/`shortViewport`) padding/avatar/font küçülür,
              modal içeriğinin altta kesilmesi/scroll gerekmesi yerine viewport'a sığması için. */}
          <div className={shortViewport ? "p-3.5 shrink-0" : "p-6 shrink-0"} style={{ background: "linear-gradient(135deg,#EAF1FB,#F4F7FC)", borderBottom: "1px solid #EEF0F3" }}>
            <div className="flex items-start justify-between gap-4">
            <div className={shortViewport ? "flex items-center gap-3 min-w-0" : "flex items-center gap-[17px] min-w-0"}>
              <div
                className={`rounded-full shrink-0 flex items-center justify-center text-white font-extrabold ${shortViewport ? "w-[42px] h-[42px] text-[15px]" : "w-[62px] h-[62px] text-[22px]"}`}
                style={{ background: `linear-gradient(135deg,${c1},${c2})`, boxShadow: "0 10px 22px -10px rgba(15,31,61,.4)" }}
              >
                {fullName ? initials(fullName) : ""}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className={`m-0 font-extrabold tracking-tight text-[#1E222B] ${shortViewport ? "text-[16px]" : "text-[21px]"}`}>
                    {fullName || "Yükleniyor…"}
                    {person?.isOnlineStudent && <span className="ml-1.5 text-[13px] font-bold text-blue-500">(O)</span>}
                  </h2>
                  {person && (
                    <span className={`inline-flex items-center rounded-full font-bold ${shortViewport ? "px-2.5 py-0.5 text-[10.5px]" : "px-4 py-1 text-[12px]"}`} style={{ color: status.color, background: status.background }}>
                      {status.label}
                    </span>
                  )}
                </div>
                {!shortViewport && (
                  <div className="text-[12.5px] text-[#6F7B87] font-semibold mt-1.5 flex items-center gap-3 flex-wrap">
                    <span>Öğrenci bilgi kartı · Eğitmen görünümü</span>
                    {person?.pii?.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{person.pii.email}</span>}
                    {subeler.length > 0 && <span className="inline-flex items-center gap-1"><MapPin size={12} />{subeler.join(", ")}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canEdit && person && (
                editing ? (
                  <>
                    <button type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="h-9 px-3.5 rounded-[10px] border border-[#DCE3EC] bg-white/85 flex items-center text-[12.5px] font-bold text-[#6F7B87] cursor-pointer disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                    <button type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="h-9 px-3.5 rounded-[10px] border-none text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#2867bd,#205297)" }}
                    >
                      {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  </>
                ) : (
                  <button type="button"
                    onClick={startEdit}
                    className="h-9 px-3.5 rounded-[10px] border border-[#DCE3EC] bg-white/85 flex items-center gap-1.5 text-[12.5px] font-bold text-[#6F7B87] cursor-pointer hover:text-[#205297] hover:bg-white transition-colors"
                  >
                    <Pencil size={14} />
                    Düzenle
                  </button>
                )
              )}
              <button type="button"
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
              kutusu en baştan gerçek boyutuna yakın açılıyor, veri gelince sıçrama olmuyor.
              2026-07-29 fix: kısa ekranda (`shortViewport`) bu `min-h-[620px]` dış kutunun
              `maxHeight: calc(100vh-40px)`'iyle çakışıp altı kesiliyordu (scroll aktive
              olamıyordu çünkü içerik zaten kendi min-height'ı yüzünden hiç küçülmüyordu) —
              kısa ekranda min-height kaldırılıp `zoom` ile içerik oranlı küçültülüyor
              (kullanıcı kararı: scroll değil, küçültme). */}
          <div ref={bodyOuterRef} className={shortViewport ? "flex-1 overflow-y-auto relative" : "flex-1 overflow-y-auto min-h-[620px] relative"}>
            {!person ? (
              <div className="absolute inset-0 flex items-center justify-center"><FlexSpinner /></div>
            ) : (
              <div
                ref={contentRef}
                className={shortViewport ? "p-4 grid gap-4" : "p-6 grid gap-6"}
                style={{ gridTemplateColumns: "minmax(0,260px) minmax(0,1fr)", zoom: shortViewport ? zoomFactor : undefined }}
              >
                {/* 2026-07-27: `items-start` KALDIRILDI — grid'in varsayılan `stretch`'i sol/sağ
                    sütunu her zaman AYNI yüksekliğe zorluyor (sağ taraf içerik miktarına göre
                    değişken: 1 vs 2 sertifika modülü, not girilmiş/girilmemiş vb.). Sol sütun
                    `flex flex-col h-full` + Not alanı `flex-1` ile bu stretch'lenmiş yüksekliği
                    dolduruyor — sabit bir piksel farkını tahmin etmek yerine, hangi taraf daha
                    uzunsa diğeri KENDİLİĞİNDEN ona göre ayarlanıyor. */}
                <div className="flex flex-col h-full">
                  <div className="text-[12px] font-extrabold text-[#414B59] uppercase tracking-wide mb-3">Genel Bilgiler</div>
                  <StudentGenelBilgiler
                    person={person} poolStatus={poolStatus} subeler={subeler} compact
                    editing={editing} draft={draft} onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                  />
                  {canReadNote && (
                    <StudentNotes
                      personId={person.id}
                      initialNotes={person.notes ?? ""}
                      notesUpdatedAt={person.notesUpdatedAt}
                      canWrite={canWriteNote}
                      onSaved={reload}
                    />
                  )}
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
