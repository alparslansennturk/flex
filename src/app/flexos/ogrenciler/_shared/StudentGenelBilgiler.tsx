"use client";

/**
 * Öğrenci Detay — "Genel Bilgiler" alan grid'i. `Öğrenci Bilgi.dc.html` (sayfa, non-compact)
 * ve `Öğrenci Bilgi Modal.dc.html` (modal, `compact`) portu — `compact` prop'u SADECE
 * TC Kimlik No + Kayıt Tarihi + Durum alanlarını gizler (Ad/Eğitim bağlamında dolduruk).
 *
 * DÜZENLEME (2026-07-23, kullanıcı isteği): satışı/kaydı ilgilendiren alanlar (Ad Soyad,
 * TC, Şube, Kayıt Tarihi, Durum) HİÇBİR ZAMAN buradan değiştirilemez — sadece Doğum
 * Tarihi + iletişim bilgileri (Telefon, E-posta, Adres) `editing=true` olduğunda inputa
 * dönüşür, `compact` (modal) dahil HER YERDE gösterilir (eğitmen tek-başına modunda
 * `person.read.pii`/`person.edit` varsa görebilmeli/düzenleyebilmeli — 2026-07-16'daki
 * "eğitmen telefon göremez" kısıtı capability'ye taşındı, sabit gizleme kaldırıldı).
 * Host (`StudentDetailTabsPanel`/`StudentDetailModal`) düzenlenebilirliği `person.edit`/
 * `person.pii.write` capability'sine göre açar/kapar — bu bileşen SADECE görünümü çizer,
 * yetki kararı vermez.
 */

import { User, IdCard, Calendar, VenusAndMars, Phone, Mail, MapPin, Home, CalendarCheck, CircleCheck } from "lucide-react";
import type { PersonDetail } from "./useStudentDetail";
import { fmtDateLong, statusMeta } from "./studentShared";

export interface EditableDraft { birthDate: string; phone: string; email: string; address: string }
type EditableKey = keyof EditableDraft;
interface Field { label: string; value: string; icon: React.ReactNode; key?: EditableKey; inputType?: "date" | "text"; wide?: boolean }

const GENDER_LABEL: Record<string, string> = { male: "Erkek", female: "Kadın" };

export function StudentGenelBilgiler({
  person, poolStatus, subeler, compact = false,
  editing = false, draft, onDraftChange,
}: {
  person: PersonDetail; poolStatus: string; subeler: string[]; compact?: boolean;
  /** true iken doğum tarihi/telefon/e-posta/adres inputa döner (host capability kontrolünü zaten yaptı). */
  editing?: boolean;
  draft?: EditableDraft;
  onDraftChange?: (patch: Partial<EditableDraft>) => void;
}) {
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  const sube = subeler.length > 0 ? subeler.join(", ") : "—";
  const status = statusMeta(poolStatus);

  // 2026-07-16 kullanıcı isteği: sıra Ad Soyad → E-posta → Şube. Modalda (compact,
  // HER ZAMAN eğitmen bağlamı) Doğum Tarihi VE Kayıt Tarihi yok — kullanıcı doğru
  // tespit etti: "Kayıt Tarihi" aslında satış/kayıt olayının tarihi, eğitmen
  // bağlamında dolduruk bir alan olurdu, ders tarihleri zaten Eğitim Bilgileri'nde
  // var. Modal kasıtlı olarak 4 alanla kalıyor. Telefon zaten SADECE non-compact'ta
  // (admin/eğitim-op bağlamı — Öğrenci Havuzu/Sınıflar admin akışı, modal DEĞİL)
  // gösteriliyor, dokunulmadı (eğitmen telefon göremez kuralı zaten buradan geliyordu).
  const fields: Field[] = [
    { label: "Ad Soyad", value: fullName || "—", icon: <User size={18} /> },
    { label: "E-posta", value: person.pii?.email || "—", icon: <Mail size={18} />, key: "email", inputType: "text" },
    { label: "Şube", value: sube, icon: <MapPin size={18} /> },
    ...(compact ? [] : [{ label: "TC Kimlik No", value: person.pii?.idNo || "—", icon: <IdCard size={18} /> }]),
    { label: "Cinsiyet", value: person.gender ? (GENDER_LABEL[person.gender] ?? person.gender) : "—", icon: <VenusAndMars size={18} /> },
    // Telefon/Doğum Tarihi/Adres — düzenlenebilir 3'lü, compact (modal) dahil HER YERDE
    // görünür (2026-07-23: eğitmen tek-başına modunda `person.read.pii`/`person.edit`
    // varsa bu bilgiyi görmeli/düzenleyebilmeli — capability zaten kapılıyor, alan
    // gizlemeye gerek yok). Kayıt Tarihi + Durum SADECE non-compact'ta kalır (düzenleme
    // dışı, sayfa/panel bağlamına özel).
    { label: "Telefon", value: person.pii?.phone || "—", icon: <Phone size={18} />, key: "phone" as EditableKey, inputType: "text" as const },
    { label: "Doğum Tarihi", value: fmtDateLong(person.birthDate), icon: <Calendar size={18} />, key: "birthDate" as EditableKey, inputType: "date" as const },
    ...(compact
      ? []
      : [
          { label: "Kayıt Tarihi", value: fmtDateLong(person.createdAt?.slice(0, 10)), icon: <CalendarCheck size={18} /> },
          { label: "Durum", value: status.label, icon: <CircleCheck size={18} /> },
        ]),
    { label: "Adres", value: person.pii?.address || "—", icon: <Home size={18} />, key: "address" as EditableKey, inputType: "text" as const, wide: !compact },
  ];

  return (
    <div className={compact ? "flex flex-col gap-2.5" : "grid grid-cols-3 gap-3.5"}>
      {fields.map((f) => {
        const isEditableField = editing && f.key && draft && onDraftChange;
        return (
          <div
            key={f.label}
            className={`flex items-center gap-3 bg-[#F7F8FA] border border-[#EEF0F3] rounded-[13px] ${compact ? "p-3" : "p-4"} ${f.wide ? "col-span-3" : ""}`}
          >
            <div className={`rounded-[10px] shrink-0 flex items-center justify-center bg-[#EAF1FB] text-[#205297] ${compact ? "w-9 h-9" : "w-[38px] h-[38px]"}`}>
              {f.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-[#8E95A3] mb-0.5">{f.label}</div>
              {isEditableField ? (
                <input
                  type={f.inputType === "date" ? "date" : "text"}
                  value={draft![f.key!]}
                  onChange={(e) => onDraftChange!({ [f.key!]: e.target.value } as Partial<EditableDraft>)}
                  placeholder={f.inputType === "date" ? undefined : "—"}
                  className="w-full bg-white border border-[#DCE3EC] rounded-[8px] px-2.5 py-1.5 text-[14px] font-bold text-[#1E222B] outline-none focus:border-[#2867bd]"
                />
              ) : (
                <div className="text-[14px] font-bold text-[#1E222B] break-words">{f.value}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
