import type { Grant } from "./types";

/**
 * AŞAMA 1 — "Kullanıcı Ayarları"ndaki yetki modüllerini (`perm-modules.ts`) gerçek
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
 * `admin` paketleriyle (packages.ts) AYNI desen.
 *
 * 2026-07-10 DÜZELTME (gerçek testte ortaya çıktı): Yoklama/Ödev capability'leri
 * önceden "sinif" modülüne konmuştu ("sınıfın günlük işi" gerekçesiyle) — ama Eğitim
 * Koordinatörü de "sinif"e sahip olduğundan (öğrenci/eğitmen atama için), ödev
 * yönetimi de yanına yapışıyordu. Ödev/teslim/yoklama-ALMA artık SADECE Eğitmen'in
 * kendi ayrı paketinde (`ROLE_PACKAGES.egitmen`) — bu tablodan tamamen çıkarıldı.
 * "sinif" artık sadece grup CRUD + öğrenci/eğitmen atama + yoklama RAPORU (görüntüleme,
 * bizzat yoklama almak değil). Ayrıca "satis" tek modülü Satış Yap/Satış Listesi/Paket/
 * Kampanya olarak 4'e bölündü (her biri ayrı aç/kapa) ve "Aktivite Merkezi" kendi
 * paylaşımlı modülüne taşındı (Satış/Eğitim Op/Finans ortak kullanır, satışa özel değil).
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
    "attendance.read", "attendance.report.read",
  ],
  not: ["grade.read", "grade.write", "grade.finalize", "grade.report.read", "certificate.settings.write"],
  satis_yap: ["sale.create", "sale.cancel"],
  satis_liste: ["sale.read"],
  paket_yonetimi: ["bundle.create", "bundle.edit", "bundle.delete", "bundle.read"],
  kampanya_yonetimi: ["campaign.create", "campaign.edit", "campaign.delete", "campaign.read"],
  odeme: ["payment.create", "payment.read"],
  aktivite: [
    "case.create", "case.read", "case.edit",
    "activity.create", "activity.read",
    "appointment.create", "appointment.read",
  ],
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
