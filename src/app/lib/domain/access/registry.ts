import type { CapabilityDef } from "./types";

/**
 * Capability Registry — MVP altkümesi (FLEXOS.md §3.3 / §4.5).
 *
 * Tam liste ~75 capability; burada çekirdek akış (person · enrollment · group ·
 * grade) + alan-bazlı PII ayrımı (`person.read.pii` / `person.pii.write`) var.
 * Pack/sektör genişledikçe registry'ye EKLENİR (veri-driven, hardcode değil).
 */
export const CAPABILITY_REGISTRY: CapabilityDef[] = [
  // ── person ──
  { key: "person.create", domain: "person", label: "Kişi Oluştur", sensitivity: "yellow", write: true, scopable: false, audited: true },
  { key: "person.read", domain: "person", label: "Kişi Temel Bilgi", sensitivity: "green", write: false, scopable: true, audited: false },
  { key: "person.read.pii", domain: "person", label: "Kişi PII Görüntüle (TC/tel/e-posta)", sensitivity: "yellow", write: false, scopable: true, audited: true },
  { key: "person.pii.write", domain: "person", label: "Kişi PII Düzenle", sensitivity: "yellow", write: true, scopable: true, audited: true },
  { key: "person.edit", domain: "person", label: "Kişi Temel Düzenle", sensitivity: "yellow", write: true, scopable: true, audited: true },
  { key: "person.note.read", domain: "person", label: "Eğitmen Notu Gör", sensitivity: "yellow", write: false, scopable: true, audited: true },
  { key: "person.note.write", domain: "person", label: "Eğitmen Notu Yaz", sensitivity: "green", write: true, scopable: true, audited: false },
  { key: "person.search", domain: "person", label: "Ctrl+K Arama", sensitivity: "green", write: false, scopable: true, audited: false },

  // ── enrollment ──
  { key: "enrollment.create", domain: "enrollment", label: "Eğitime Kaydet", sensitivity: "yellow", write: true, scopable: false, audited: true },
  { key: "enrollment.read", domain: "enrollment", label: "Kayıt Gör", sensitivity: "green", write: false, scopable: true, audited: false },
  { key: "enrollment.transfer", domain: "enrollment", label: "Grup Değiştir", sensitivity: "yellow", write: true, scopable: true, audited: true },

  // ── group ──
  { key: "group.create", domain: "group", label: "Grup Oluştur", sensitivity: "green", write: true, scopable: true, audited: false },
  { key: "group.read", domain: "group", label: "Grup Gör", sensitivity: "green", write: false, scopable: true, audited: false },
  { key: "group.edit", domain: "group", label: "Grup Düzenle", sensitivity: "green", write: true, scopable: true, audited: false },
  { key: "group.assign_student", domain: "group", label: "Öğrenci Yerleştir", sensitivity: "yellow", write: true, scopable: true, audited: true },
  { key: "group.assign_trainer", domain: "group", label: "Eğitmen Ata", sensitivity: "yellow", write: true, scopable: true, audited: true },
  { key: "group.activate", domain: "group", label: "Grubu Aktif Et", sensitivity: "yellow", write: true, scopable: true, audited: true },

  // ── grade ──
  { key: "grade.read", domain: "grade", label: "Not Gör", sensitivity: "green", write: false, scopable: true, audited: false },
  { key: "grade.write", domain: "grade", label: "Not Gir", sensitivity: "green", write: true, scopable: true, audited: false },
  { key: "grade.finalize", domain: "grade", label: "Modülü Bitir (not donar)", sensitivity: "red", write: true, scopable: true, audited: true },
  { key: "grade.report.read", domain: "grade", label: "Not Raporu", sensitivity: "green", write: false, scopable: true, audited: false },

  // ── catalog (Branş/Eğitim/Bölüm/Track — Eğitim Op) ──
  { key: "branch.create", domain: "catalog", label: "Branş Oluştur", sensitivity: "yellow", write: true, scopable: false, audited: true },
  { key: "education.create", domain: "catalog", label: "Eğitim Oluştur", sensitivity: "yellow", write: true, scopable: false, audited: true },
  { key: "education.edit", domain: "catalog", label: "Eğitim Düzenle (taslak/satış)", sensitivity: "yellow", write: true, scopable: false, audited: true },
  { key: "section.create", domain: "catalog", label: "Bölüm Oluştur", sensitivity: "yellow", write: true, scopable: false, audited: true },
  { key: "track.create", domain: "catalog", label: "Track Oluştur", sensitivity: "yellow", write: true, scopable: false, audited: true },

  // ── system ──
  { key: "role.manage", domain: "system", label: "Capability Paketlerini Düzenle", sensitivity: "red", write: true, scopable: false, audited: true },
  { key: "capability.grant", domain: "system", label: "Tekil Yetki Ver/Al", sensitivity: "red", write: true, scopable: false, audited: true },
];

/** Hızlı erişim: key → tanım. */
export const CAPABILITY_BY_KEY: Record<string, CapabilityDef> = Object.fromEntries(
  CAPABILITY_REGISTRY.map((c) => [c.key, c]),
);

export function getCapability(key: string): CapabilityDef | undefined {
  return CAPABILITY_BY_KEY[key];
}
