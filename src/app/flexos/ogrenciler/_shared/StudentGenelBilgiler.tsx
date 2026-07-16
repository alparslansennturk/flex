"use client";

/**
 * Öğrenci Detay — "Genel Bilgiler" alan grid'i. `Öğrenci Bilgi.dc.html` (sayfa, 9 alan) ve
 * `Öğrenci Bilgi Modal.dc.html` (modal — mockup'tan farklı olarak 4 alan: Ad Soyad/E-posta/
 * Şube/Cinsiyet; TC/Telefon/Doğum/Kayıt Tarihi/Durum yok, 2026-07-16 kullanıcı kararı)
 * portu — `compact` prop'u hangi alan setinin gösterileceğini seçer.
 */

import { User, IdCard, Calendar, VenusAndMars, Phone, Mail, MapPin, CalendarCheck, CircleCheck } from "lucide-react";
import type { PersonDetail } from "./useStudentDetail";
import { fmtDateLong, statusMeta } from "./studentShared";

interface Field { label: string; value: string; icon: React.ReactNode }

const GENDER_LABEL: Record<string, string> = { male: "Erkek", female: "Kadın" };

export function StudentGenelBilgiler({
  person, poolStatus, subeler, compact = false,
}: {
  person: PersonDetail; poolStatus: string; subeler: string[]; compact?: boolean;
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
    { label: "E-posta", value: person.pii?.email || "—", icon: <Mail size={18} /> },
    { label: "Şube", value: sube, icon: <MapPin size={18} /> },
    ...(compact ? [] : [{ label: "TC Kimlik No", value: person.pii?.idNo || "—", icon: <IdCard size={18} /> }]),
    { label: "Cinsiyet", value: person.gender ? (GENDER_LABEL[person.gender] ?? person.gender) : "—", icon: <VenusAndMars size={18} /> },
    ...(compact
      ? []
      : [
          { label: "Telefon", value: person.pii?.phone || "—", icon: <Phone size={18} /> },
          { label: "Doğum Tarihi", value: fmtDateLong(person.birthDate), icon: <Calendar size={18} /> },
          { label: "Kayıt Tarihi", value: fmtDateLong(person.createdAt?.slice(0, 10)), icon: <CalendarCheck size={18} /> },
          { label: "Durum", value: status.label, icon: <CircleCheck size={18} /> },
        ]),
  ];

  return (
    <div className={compact ? "flex flex-col gap-2.5" : "grid grid-cols-3 gap-3.5"}>
      {fields.map((f) => (
        <div
          key={f.label}
          className={`flex items-center gap-3 bg-[#F7F8FA] border border-[#EEF0F3] rounded-[13px] ${compact ? "p-3" : "p-4"}`}
        >
          <div className={`rounded-[10px] shrink-0 flex items-center justify-center bg-[#EAF1FB] text-[#205297] ${compact ? "w-9 h-9" : "w-[38px] h-[38px]"}`}>
            {f.icon}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#8E95A3] mb-0.5">{f.label}</div>
            <div className="text-[14px] font-bold text-[#1E222B] break-words">{f.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
