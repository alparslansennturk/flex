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

// Eğitmen yetkileri her zaman geçerli olan çekirdek + standalone-modda eklenen ekstra
// olmak üzere ikiye ayrılır — switch kapalıyken sadece çekirdek kalır (resolvePackages bkz).
const EGITMEN_CORE: Grant[] = at(
  "assigned",
  "person.read",
  "person.search",
  "person.note.read",
  "person.note.write",
  "enrollment.read",
  "group.read", // entegre modda da kendi grubunu görmesi/yoklama alması gerekir
  "grade.read",
  "grade.write",
  "grade.finalize",
  "trainer.read", // kadroyu görür ama ücret (trainer.rate.read) YOK
);

const EGITMEN_STANDALONE_EXTRA: Grant[] = at(
  "assigned",
  "person.create",
  // PII (tel/e-posta/TC) normalde eğitmende YOK (Satış yazar) — standalone'da Satış
  // olmadığı için eğitmen kendi öğrencisinin iletişim bilgisini girebilmeli/görebilmeli.
  "person.read.pii",
  "person.pii.write",
  "person.edit",
  "enrollment.create",
  "enrollment.transfer",
  "group.create",
  "group.edit",
  "group.assign_student",
  "group.activate",
  "group.delete",
);

export const ROLE_PACKAGES: Record<PackageName, Grant[]> = {
  // Satış: kişi (PII dahil) + eğitime kaydet + satış + CRM. PII YAZAR.
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
    "bundle.create",
    "bundle.edit",
    "bundle.delete",
    "bundle.read",
    "campaign.create",
    "campaign.edit",
    "campaign.delete",
    "campaign.read",
    "case.create",
    "case.read",
    "case.edit",
    "activity.create",
    "activity.read",
    "appointment.create",
    "appointment.read",
  ),

  // Operasyon: grup + kayıt yönetimi, kişi (PII dahil) okur, rapor + CRM okur.
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
    "bundle.create",
    "bundle.edit",
    "bundle.delete",
    "bundle.read",
    "campaign.create",
    "campaign.edit",
    "campaign.delete",
    "campaign.read",
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
    "case.read",
    "case.edit",
    "activity.read",
    "appointment.read",
  ),

  // Eğitmen: kendi grupları (@assigned). Kişi açabilir (quick-add, iskelet) ama
  // PII YAZAMAZ/GÖREMEZ — person.read.pii / person.pii.write YOK. İşin püf noktası.
  //
  // GENİŞ kurulum (Ayrılabilirlik Kısıtı — FLEXOS.md §2.1): standalone "Flex Classroom"
  // ihtimaline karşı eğitmen kendi kendine yeter → grup oluştur + öğrenci ekle + sınıfa
  // kaydet hepsi onda. Tam FlexOS entegre modunda (switch kapalı) bu grup/kişi-yaratma
  // yetkileri DÜŞER — Satış/Operasyon besler, eğitmen sadece okur/yoklama-not girer.
  // Bkz. `EGITMEN_STANDALONE_EXTRA` + `resolvePackages(packages, { standaloneMode })`.
  egitmen: [...EGITMEN_CORE, ...EGITMEN_STANDALONE_EXTRA],

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
      "bundle.create",
      "bundle.edit",
      "bundle.delete",
      "bundle.read",
      "campaign.create",
      "campaign.edit",
      "campaign.delete",
      "campaign.read",
      "trainer.create",
      "trainer.read",
      "trainer.edit",
      "trainer.delete",
      "trainer.rate.read",
      "trainer.rate.write",
      "role.manage",
      "capability.grant",
      "view.toggle",
      "case.create",
      "case.read",
      "case.edit",
      "activity.create",
      "activity.read",
      "appointment.create",
      "appointment.read",
    ),
  ],
};

export interface ResolvePackagesOptions {
  /**
   * Eğitmen "tek başına" (standalone) çalışıyor mu? `true`/`undefined` (varsayılan,
   * geriye dönük uyumlu) → eğitmen kendi grubunu/öğrencisini açabilir. `false`
   * (tam FlexOS entegre modu) → bu yaratma yetkileri düşer, Satış/Operasyon besler.
   */
  standaloneMode?: boolean;
}

/** Paket adlarını birleştirilmiş grant listesine çözer (çift yetki = birden çok paket). */
export function resolvePackages(packages: PackageName[], options?: ResolvePackagesOptions): Grant[] {
  return packages.flatMap((p) => {
    if (p === "egitmen" && options?.standaloneMode === false) {
      return EGITMEN_CORE;
    }
    return ROLE_PACKAGES[p] ?? [];
  });
}
