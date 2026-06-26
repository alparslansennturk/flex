import type { Grant, Scope } from "./types";

/**
 * Rol/Departman = isimlendirilmiş capability+scope paketi (FLEXOS.md §4.6).
 * Kodda asla `if (role === "x")` yok — paket grant'lere çözülür, `can()` karar verir.
 * Departman→yetki eşleşmesi kuruma göre değişebilir; bu yüzden burada veri olarak durur.
 */
export type PackageName = "satis" | "operasyon" | "egitmen" | "admin";

/** Aynı scope'lu capability listesini grant'lere çevirir (okunabilirlik için). */
function at(scope: Scope, ...capabilities: string[]): Grant[] {
  return capabilities.map((capability) => ({ capability, scope }));
}

export const ROLE_PACKAGES: Record<PackageName, Grant[]> = {
  // Satış: kişi (PII dahil) + eğitime kaydet + satış. PII YAZAR.
  satis: at(
    "org",
    "person.create",
    "person.read",
    "person.read.pii",
    "person.pii.write",
    "person.edit",
    "person.search",
    "enrollment.create",
    "sale.create",
    "sale.read",
    "sale.cancel",
    "payment.create",
    "payment.read",
  ),

  // Operasyon: grup + kayıt yönetimi, kişi (PII dahil) okur, rapor.
  operasyon: at(
    "org",
    "person.create",
    "person.read",
    "person.read.pii",
    "person.pii.write",
    "person.edit",
    "person.search",
    "enrollment.create",
    "enrollment.read",
    "enrollment.transfer",
    "group.create",
    "group.read",
    "group.edit",
    "group.assign_student",
    "group.assign_trainer",
    "group.activate",
    "group.delete",
    "grade.report.read",
    "sale.create",
    "sale.read",
    "sale.cancel",
    "payment.create",
    "payment.read",
    "branch.create",
    "education.create",
    "education.edit",
    "section.create",
    "track.create",
    "trainer.create",
    "trainer.read",
    "trainer.edit",
    "trainer.delete",
    "trainer.rate.read",
    "trainer.rate.write",
  ),

  // Eğitmen: kendi grupları (@assigned). Kişi açabilir (quick-add, iskelet) ama
  // PII YAZAMAZ/GÖREMEZ — person.read.pii / person.pii.write YOK. İşin püf noktası.
  //
  // GENİŞ kurulum (Ayrılabilirlik Kısıtı — FLEXOS.md §2.1): standalone "Flex Classroom"
  // ihtimaline karşı eğitmen kendi kendine yeter → grup oluştur + öğrenci ekle + sınıfa
  // kaydet hepsi onda. Tam FlexOS'a geçilirse grup yetkileri en sonda daraltılır (ops alır).
  egitmen: at(
    "assigned",
    "person.create",
    "person.read",
    "person.search",
    "person.note.read",
    "person.note.write",
    "enrollment.create",
    "enrollment.read",
    "enrollment.transfer",
    "group.create",
    "group.read",
    "group.edit",
    "group.assign_student",
    "group.activate",
    "group.delete",
    "grade.read",
    "grade.write",
    "grade.finalize",
    "trainer.read", // kadroyu görür ama ücret (trainer.rate.read) YOK
  ),

  // Admin: tümü @org + meta yetkiler.
  admin: [
    ...at(
      "org",
      "person.create",
      "person.read",
      "person.read.pii",
      "person.pii.write",
      "person.edit",
      "person.note.read",
      "person.note.write",
      "person.search",
      "enrollment.create",
      "enrollment.read",
      "enrollment.transfer",
      "group.create",
      "group.read",
      "group.edit",
      "group.assign_student",
      "group.assign_trainer",
      "group.activate",
      "group.delete",
      "grade.read",
      "grade.write",
      "grade.finalize",
      "grade.report.read",
      "branch.create",
      "education.create",
      "education.edit",
      "section.create",
      "track.create",
      "sale.create",
      "sale.read",
      "sale.cancel",
      "payment.create",
      "payment.read",
      "trainer.create",
      "trainer.read",
      "trainer.edit",
      "trainer.delete",
      "trainer.rate.read",
      "trainer.rate.write",
      "role.manage",
      "capability.grant",
    ),
  ],
};

/** Paket adlarını birleştirilmiş grant listesine çözer (çift yetki = birden çok paket). */
export function resolvePackages(packages: PackageName[]): Grant[] {
  return packages.flatMap((p) => ROLE_PACKAGES[p] ?? []);
}
