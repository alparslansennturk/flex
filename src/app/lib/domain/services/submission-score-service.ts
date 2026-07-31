import type { EntityId } from "../base";
import type { AssignmentKind } from "../core/assignment";
import type { OdevKategoriSonucu, OdevYuzdeleriResult, SubmissionDeps } from "./submission-types";

/**
 * 2026-07-17 kararı (2026-07-06'daki İÇ ağırlıklandırma kararının YERİNE geçti):
 * `proje` türü ödevler Ödev Notu'na ARTIK HİÇ GİRMEZ — sadece `normal` ödevler sayılır.
 * "Proje" kavramı SADECE Sertifika Notu'nda yaşar (`Grade.projectGrade`, elle girilir,
 * ödev sisteminden bağımsız) — bir ödeve `kind:"proje"` verilse bile o ödevin puanı/
 * teslimi Ödev Notu hesabına (payda/pay) hiç eklenmez. `ODEV_TUR_AGIRLIK.proje` (70)
 * artık asla kullanılmaz (proje kategorisi `computeOdevYuzdeleri`'de hep boş kalır,
 * `combineOdevYuzdesi` "kategori yok" dalına düşüp normalOran'ı ×100 uygular) — sabit
 * geriye dönük uyumluluk için (`sertifikasyon/not/page.tsx`'in aynı formülü client-side
 * tekrarlayan kopyası dahil) SİLİNMEDİ, sadece proje'ye hiç veri akmıyor.
 */
export const ODEV_TUR_AGIRLIK: Record<AssignmentKind, number> = { normal: 30, proje: 70 };

function bosKategori(): OdevKategoriSonucu {
  return { totalMaxPuan: 0, earnedByPerson: {} };
}

/**
 * Ödev Notu hesabının ham girdisi — grup içindeki TÜM yayınlanmış ödevler `kind`'a göre
 * `normal`/`proje` diye ikiye ayrılır, her kategori için ayrı ayrı `maxPuan` toplamı
 * (payda) + kazanılan `Submission.grade` toplamı (pay) OKUMA ANINDA hesaplanır
 * (manuel giriş YOK, teslim/not değiştikçe otomatik güncellenir). Nihai yüzdeye
 * çevirme + ağırlıklandırma `combineOdevYuzdesi()`'ye bırakılır.
 */
export async function computeOdevYuzdeleri(
  tenantId: string,
  groupId: EntityId,
  deps: Pick<SubmissionDeps, "assignments" | "submissions">,
): Promise<OdevYuzdeleriResult> {
  const [assignments, submissions] = await Promise.all([
    deps.assignments.list(tenantId, groupId),
    deps.submissions.listByGroup(groupId, tenantId),
  ]);

  // 2026-07-12 fix: SADECE "published" filtrelemek `computeOdevYuzdeleri`'yi "Notları
  // Kaydet"in artık HER ZAMAN sonunda ödevi "archived"a çektiği akışla (bkz. odev-notu
  // sayfası) çelişkiye düşürüyordu — bir ödevin notu girilip kaydedildiği AN o ödev
  // hem payda (maxPuan) hem pay (kazanılan puan) hesabından TAMAMEN düşüyordu, yani
  // gerçek `Submission.grade` veritabanında dururken Ödev Notu yüzdesine hiç
  // yansımıyordu. Draft (henüz yayınlanmamış, öğrenciye hiç gitmemiş) hariç HER durum
  // (`published`/`closed`/`archived`) sayılmalı — öğrenciye bir kez atanan ödev, notu
  // girildikten/ödev arşivlendikten sonra da hesaba dahil kalmalı.
  // 2026-07-17 kararı: `proje` türü ödevler bu hesaba HİÇ girmez (bkz. ODEV_TUR_AGIRLIK
  // yorumu) — sadece `normal` ödevler payda/paya dahil edilir, proje kategorisi kasıtlı
  // olarak hep boş (`bosKategori()`) kalır.
  const published = assignments.filter((a) => a.status !== "draft" && (a.kind ?? "normal") === "normal");
  const result: OdevYuzdeleriResult = { normal: bosKategori(), proje: bosKategori() };
  const kindByAssignmentId = new Map<string, AssignmentKind>();

  for (const a of published) {
    kindByAssignmentId.set(a.id, "normal");
    result.normal.totalMaxPuan += a.maxPuan ?? 100;
  }

  for (const s of submissions) {
    const kind = kindByAssignmentId.get(s.assignmentId);
    if (!kind || s.grade == null) continue;
    const kategori = result[kind];
    kategori.earnedByPerson[s.personId] = (kategori.earnedByPerson[s.personId] ?? 0) + s.grade;
  }

  return result;
}

/**
 * Ödev Notu'nun nihai yüzdesi — `normal` %30 + `proje` %70 ağırlıklı (bkz. `ODEV_TUR_AGIRLIK`).
 * Bir kategori hiç yoksa ağırlık tamamen diğerine kayar. İkisi de yoksa `null` (veri yok —
 * sertifika hesabı bu durumda yalnız Sertifika Notu'na düşer, `CertificateSettings` ağırlığı
 * ne olursa olsun).
 */
export function combineOdevYuzdesi(result: OdevYuzdeleriResult, personId: string): number | null {
  const normalOran = result.normal.totalMaxPuan > 0
    ? (result.normal.earnedByPerson[personId] ?? 0) / result.normal.totalMaxPuan
    : null;
  const projeOran = result.proje.totalMaxPuan > 0
    ? (result.proje.earnedByPerson[personId] ?? 0) / result.proje.totalMaxPuan
    : null;

  if (normalOran == null && projeOran == null) return null;
  if (normalOran == null) return Math.round(projeOran! * 100);
  if (projeOran == null) return Math.round(normalOran * 100);
  return Math.round(normalOran * ODEV_TUR_AGIRLIK.normal + projeOran * ODEV_TUR_AGIRLIK.proje);
}
