import type { Grant } from "./types";

/**
 * AŞAMA 1 — "Kullanıcı Ayarları"ndaki 9 yetki modülünü (`perm-modules.ts`) gerçek
 * capability+scope'a bağlayan tablo. Sadece OFİS/idari roller için (Genel Müdür,
 * Eğitim Koordinatörü, Öğrenci İşleri, Satış Temsilcisi, Finans, kurum-özel roller).
 *
 * `egitmen` ROLÜ (kişinin flexos_users.roles'unda "egitmen" olması) BU TABLOYU
 * KULLANMAZ — kendi ayrı `ROLE_PACKAGES.egitmen` paketi vardır (`packages.ts`,
 * assigned/self scope, standalone-mode farkındalı). Karışıklık olmasın diye modül
 * anahtarı da "egitmen" olsa da (Eğitmen Kadrosu = eğitmen listesini YÖNETME
 * yetkisi — CRUD+ücret, Eğitim Koordinatörü'nün sahip olduğu şey) bu, "ben eğitmenim"
 * rolüyle AYNI ŞEY DEĞİL.
 *
 * Hepsi "org" scope — ofis rolleri şube/tenant genelinde çalışır, `satis`/`operasyon`/
 * `admin` paketleriyle (packages.ts) AYNI desen. Yoklama/Ödev capability'leri "sinif"
 * modülüne kondu (bilinçli seçim — modül kataloğunun açıklama metninde açıkça
 * yazmıyordu, karar verilmesi gerekiyordu): sınıfın günlük işleyişi (yoklama, ödev
 * verme/notlandırma) "Sınıf / Grup" modülünün doğal uzantısı sayıldı.
 */
export const PERM_MODULE_CAPABILITIES: Record<string, string[]> = {
  kisi: [
    "person.create", "person.read", "person.read.pii", "person.pii.write",
    "person.edit", "person.search", "person.note.read", "person.note.write",
  ],
  kayit: ["enrollment.create", "enrollment.read", "enrollment.transfer"],
  sinif: [
    "group.create", "group.read", "group.edit", "group.assign_student",
    "group.assign_trainer", "group.activate", "group.delete",
    "attendance.write", "attendance.read", "attendance.report.read",
    "assignment.create", "assignment.edit", "assignment.read", "assignment.delete",
    "template.manage", "assignment.pool.manage",
    "submission.read", "submission.status.write", "submission.grade", "assignment.comment.write",
  ],
  not: ["grade.read", "grade.write", "grade.finalize", "grade.report.read", "certificate.settings.write"],
  satis: [
    "sale.create", "sale.read", "sale.cancel",
    "bundle.create", "bundle.edit", "bundle.delete", "bundle.read",
    "campaign.create", "campaign.edit", "campaign.delete", "campaign.read",
    "case.create", "case.read", "case.edit",
    "activity.create", "activity.read",
    "appointment.create", "appointment.read",
  ],
  odeme: ["payment.create", "payment.read"],
  egitmen: ["trainer.create", "trainer.read", "trainer.edit", "trainer.delete", "trainer.rate.read", "trainer.rate.write"],
  katalog: ["branch.create", "education.create", "education.edit", "section.create", "track.create", "holiday.manage"],
  sistem: ["role.manage", "capability.grant"],
};

/** Seçili modül listesini org-scope grant'lere çevirir (çift capability = tekilleşir). */
export function grantsForPermModules(modules: string[]): Grant[] {
  const caps = new Set<string>();
  for (const m of modules) {
    for (const c of PERM_MODULE_CAPABILITIES[m] ?? []) caps.add(c);
  }
  return Array.from(caps).map((capability) => ({ capability, scope: "org" as const }));
}
