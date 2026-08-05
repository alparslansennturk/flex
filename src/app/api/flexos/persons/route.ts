import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can, widestScope, ownerMatches } from "@/app/lib/domain/access/can";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { generateActivationCode } from "@/app/lib/user-validation";
import { buildFlexosActivationEmail } from "@/app/lib/server/flexos-activation-email";
import { sendMail } from "@/app/lib/email";
import type { FlexosUser } from "@/app/lib/domain/core/flexos-user";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo, firestoreBranchOfficeRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePaymentRepo } from "@/app/lib/server/payment-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestoreBundleRepo } from "@/app/lib/server/bundle-repo.firestore";
import { createPerson, type CreatePersonInput } from "@/app/lib/domain/services/person-service";
import { derivePaymentRollup } from "@/app/lib/domain/services/payment-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { cachedRead, invalidateCache } from "@/app/lib/server/read-cache";
import type { Person } from "@/app/lib/domain/core/person";

// Persons GET EN AĞIR uç (8 koleksiyon: persons+enrollments+sales+payments+bundles+...).
// 2026-07-13'te bir silme-sonrası-gecikme bulgusu burada yaşandı (kök neden HİÇBİR ZAMAN
// kanıtlanamadı) — o gün TTL tamamen kapatılmıştı (0). 2026-07-14 (Öğrenci Havuzu 500+
// kişiye çıktığında bu uç tek başına binlerce okumaya mal olacağı için) kısa bir TTL'e
// geri dönüldü — kanıtlanmamış bir şüphe yüzünden kalıcı olarak "hep taze" kalmak,
// gerçek ölçekte (yüzlerce öğrenci) kotaya çok daha somut bir zarar veriyor. Doğrudan
// person mutasyonları (PATCH/DELETE/close-account) artık `invalidateCache` çağırıyor —
// gerçek bir değişiklik en kötü ihtimalle bu TTL kadar (20sn) gecikir, groups/templates'te
// zaten kabul edilen AYNI tercih.
const PERSONS_CACHE_TTL_MS = 20_000;
import type { Enrollment } from "@/app/lib/domain/core/enrollment";
import type { Payment } from "@/app/lib/domain/eduos/payment";
import type { Sale } from "@/app/lib/domain/eduos/sale";
import { apiError } from "@/app/lib/server/api-error";

interface PersonJoinContext {
  eduMap: Map<string, { id: string; name: string; branchId?: string }>;
  branchMap: Map<string, { id: string; name: string }>;
  officeMap: Map<string, string>;
  groupMap: Map<string, { id: string; code: string; branchOfficeId?: string; trainerId?: string }>;
  bundleMap: Map<string, { id: string; name: string }>;
  saleMap: Map<string, Sale>;
  enrollByPerson: Map<string, Enrollment[]>;
  paymentsByPerson: Map<string, Payment[]>;
  salesByPerson: Map<string, Sale[]>;
  accountStatusByPersonId: Map<string, "aktif" | "askıda" | "pasif">;
  lastLoginByPersonId: Map<string, string | null>;
  allowPII: boolean;
  today: string;
}

/**
 * Bir Person'ı Havuz/Kullanıcılar yanıt satırına çevirir — tam-liste (`buildAllPersons`)
 * ve sayfalı (`buildPersonsPage`) yol AYNI mantığı paylaşır, davranış sapması olmasın diye.
 */
function mapPersonToItem(p: Person, ctx: PersonJoinContext) {
  const enrs = ctx.enrollByPerson.get(p.id) ?? [];

  const branchNames = new Set<string>();
  // `status` (enrollment.status, GRUBA ÖZEL) — bir kişi A grubunda "completed"
  // (mezun), B grubunda "active" olabilir (bkz. enrollment.ts EnrollmentStatus
  // yorumu: "durum üyeliğe ait, kişiye değil"). `derivePoolStatus` (aşağıda) TÜM
  // enrollment'ları birleştirip TEK bir kişi-seviyeli özet üretir (Havuz listesi
  // için uygun) — ama grup-bazlı görünümlerde (EgitmenSiniflarPanel "Mevcut Grup")
  // bu özeti kullanmak yanlış: 550'den 784'e taşınan biri 784'te "aktif" olduğu için
  // özet "aktif" döner, 550'deki asıl "mezun" durumunu gizler. groupList'e status
  // eklenip client'ta grup-özel gösterim için kullanılıyor (2026-07-11 bulgusu).
  const groupList: Array<{ label: string; branch: string; educationName: string; groupId: string; enrollmentId: string; status: string }> = [];
  const officeNames = new Set<string>(); // şube = öğrencinin gruplarından türetilir

  const educationList: Array<{ educationId: string; name: string; status: string }> = [];
  const seenEduIds = new Set<string>();
  const seenBundleSaleIds = new Set<string>(); // paket satışı → tek satır

  for (const enr of enrs) {
    const edu = enr.educationId ? ctx.eduMap.get(enr.educationId) : undefined;
    const branch = edu?.branchId ? ctx.branchMap.get(edu.branchId) : undefined;
    if (branch) branchNames.add(branch.name);

    if (enr.groupId) {
      const grp = ctx.groupMap.get(enr.groupId);
      groupList.push({
        label: grp?.code ?? enr.groupId,
        branch: branch?.name ?? "",
        educationName: edu?.name ?? "",
        groupId: enr.groupId,
        enrollmentId: enr.id,
        status: enr.status,
      });
      const office = grp?.branchOfficeId ? ctx.officeMap.get(grp.branchOfficeId) : undefined;
      if (office) officeNames.add(office);
    }

    if (enr.status === "cancelled") continue;

    // Eğitim sütunu: paket satışı → paket adı (tek satır); bireysel → eğitim adı
    const sale = enr.saleId ? ctx.saleMap.get(enr.saleId) : undefined;
    if (sale?.bundleId) {
      if (!seenBundleSaleIds.has(sale.id)) {
        seenBundleSaleIds.add(sale.id);
        const bundle = ctx.bundleMap.get(sale.bundleId);
        if (bundle) {
          educationList.push({ educationId: sale.bundleId, name: bundle.name, status: enr.status });
        }
      }
    } else if (edu && !seenEduIds.has(edu.id)) {
      seenEduIds.add(edu.id);
      educationList.push({ educationId: edu.id, name: edu.name, status: enr.status });
    }
  }

  // enrollment durumundan havuz durumu türet (öğrenci durumu = üyelikten, Person'dan değil)
  const status = derivePoolStatus(enrs);

  // "Gruba Ata" için atanabilir kayıtlar: aktif + grupsuz TÜMÜ (bir paket/bundle satışı
  // aynı anda birden çok grupsuz enrollment açabilir — Grafik Tasarım + Dijital Pazarlama +
  // Video gibi — hepsi tek seferde listelenmeli, sadece ilki değil).
  const assignableEnrollments = enrs
    .filter((e) => e.status === "active" && !e.groupId)
    .map((e) => ({
      enrollmentId: e.id,
      educationId: e.educationId ?? null,
      educationName: (e.educationId && ctx.eduMap.get(e.educationId)?.name) ?? "",
    }));

  // ödeme durumu rollup'ı (payment.read yetkisiyle)
  const personPayments = ctx.paymentsByPerson.get(p.id) ?? [];
  const personSales = ctx.salesByPerson.get(p.id) ?? [];
  const totalExpected = personSales.reduce((a, s) => a + (s.soldPrice ?? 0) + (s.financingFee ?? 0), 0);
  const paymentStatus = personPayments.length > 0 || totalExpected > 0
    ? derivePaymentRollup(personPayments, totalExpected, ctx.today)
    : null;

  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    email: ctx.allowPII ? (p.pii?.email ?? "") : "",
    phone: ctx.allowPII ? (p.pii?.phone ?? "") : "",
    status,
    branches: [...branchNames],
    groups: groupList,
    educations: educationList,
    subeler: [...officeNames],
    assignableEnrollments,
    // Core (eğitmen) basit tablosu için tekil düzenlenebilir kayıt (Mezun Et/Sil/Aktife Al).
    primaryEnrollmentId: enrs.find((e) => e.status === "active")?.id ?? enrs[0]?.id ?? null,
    gender: p.gender ?? "",
    createdAt: p.createdAt,
    paymentStatus,
    accountStatus: ctx.accountStatusByPersonId.get(p.id) ?? "pasif",
    lastLogin: ctx.lastLoginByPersonId.get(p.id) ?? null,
  };
}

/**
 * Join haritalarını (eduMap/branchMap/.../salesByPerson) inşa eder — `buildAllPersons` ve
 * `buildPersonsPage` AYNI mantığı paylaşır (2026-08-05 /code-review bulgusu: bu kurulum
 * iki yerde birebir tekrarlanıyordu). Hesap-durumu (`accountStatusByPersonId`) buraya DAHİL
 * DEĞİL — o, scope-filtreleme SONRASI kişi kümesine göre ayrıca hesaplanır (bkz. çağıranlar).
 */
function buildJoinMaps(data: {
  educations: Awaited<ReturnType<typeof firestoreEducationRepo.list>>;
  branches: Awaited<ReturnType<typeof firestoreBranchRepo.list>>;
  offices: Awaited<ReturnType<typeof firestoreBranchOfficeRepo.list>>;
  groups: Awaited<ReturnType<typeof firestoreGroupRepo.list>>;
  bundles: Awaited<ReturnType<typeof firestoreBundleRepo.list>>;
  allSales: Sale[];
  allPayments: Payment[];
  enrollments: Enrollment[];
}): Omit<PersonJoinContext, "accountStatusByPersonId" | "lastLoginByPersonId" | "allowPII" | "today"> {
  const { educations, branches, offices, groups, bundles, allSales, allPayments, enrollments } = data;

  const eduMap = new Map(educations.map((e) => [e.id, e]));
  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const officeMap = new Map(offices.map((o) => [o.id, o.name]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const bundleMap = new Map(bundles.map((b) => [b.id, b]));
  const saleMap = new Map(allSales.map((s) => [s.id, s]));

  const enrollByPerson = new Map<string, Enrollment[]>();
  for (const enr of enrollments) {
    const list = enrollByPerson.get(enr.personId) ?? [];
    list.push(enr);
    enrollByPerson.set(enr.personId, list);
  }
  const paymentsByPerson = new Map<string, Payment[]>();
  for (const pay of allPayments) {
    const list = paymentsByPerson.get(pay.personId) ?? [];
    list.push(pay);
    paymentsByPerson.set(pay.personId, list);
  }
  const salesByPerson = new Map<string, Sale[]>();
  for (const s of allSales) {
    const list = salesByPerson.get(s.personId) ?? [];
    list.push(s);
    salesByPerson.set(s.personId, list);
  }

  return { eduMap, branchMap, officeMap, groupMap, bundleMap, saleMap, enrollByPerson, paymentsByPerson, salesByPerson };
}

/**
 * Hesap (Auth) durumu — Kullanıcılar > Öğrenciler sekmesi için salt-okunur çapraz kontrol.
 * Person.authUid backfill'den (canlı) geliyor; FlexOS henüz kendi öğrenci davet/aktivasyon
 * akışını açmadı, o yüzden aktivasyon bilgisi hâlâ canlı `users/{uid}.isActivated`'te —
 * buraya SADECE okunur, hiç yazılmaz.
 *
 * 2026-07-15 GERÇEK BUG: "Son giriş" SADECE `lastSignInTime`'a bakıyordu — bu alan
 * Firebase Auth'ta SADECE yeni bir kimlik-doğrulama (email/şifre sign-in) olduğunda
 * güncellenir, MEVCUT oturumun sessizce token yenilemesinde (`lastRefreshTime`, normal
 * günlük kullanımda çıkış yapıp tekrar girmeyen HERKESTE olan şey) DEĞİŞMEZ. Kanıtlanmış
 * gerçek örnek: bir öğrenci dün gerçekten kullandı (`lastRefreshTime` dün), ama
 * `lastSignInTime` hâlâ 19 gün önceki son GERÇEK sign-in'i gösteriyordu — ekranda
 * "19 gündür giriş yapmadı" gibi yanlış bir sonuç. `lastRefreshTime`/`lastSignInTime`
 * ikisinin en YENİSİ "gerçek son aktivite"yi doğru yansıtır.
 *
 * `adminAuth.getUsers()` tek çağrıda EN FAZLA 100 identifier kabul eder (SDK sert
 * sınırı, senkron throw — `.catch()` yakalayamaz çünkü reddedilen bir Promise değil).
 * 2026-08-05 GERÇEK BUG (k6 500-öğrenci yük testinde bulundu): 100'den fazla bağlı
 * hesaplı kişide bu uç HER ZAMAN 500 dönüyordu. 100'lük parçalara bölünüp paralel
 * çağrılıyor, sonuçlar birleştiriliyor.
 */
async function resolveAccountStatus(
  persons: Person[],
  withAccountStatus: boolean,
): Promise<{ accountStatusByPersonId: Map<string, "aktif" | "askıda" | "pasif">; lastLoginByPersonId: Map<string, string | null> }> {
  const accountStatusByPersonId = new Map<string, "aktif" | "askıda" | "pasif">();
  const lastLoginByPersonId = new Map<string, string | null>();
  const withAuthUid = withAccountStatus ? persons.filter((p) => p.authUid) : [];
  if (withAuthUid.length > 0) {
    const uids = withAuthUid.map((p) => p.authUid!);
    const uidChunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 100) uidChunks.push(uids.slice(i, i + 100));
    const [liveUserDocs, authUsersChunks] = await Promise.all([
      adminDb.getAll(...uids.map((uid) => adminDb.collection("users").doc(uid))),
      Promise.all(
        uidChunks.map((chunk) =>
          adminAuth.getUsers(chunk.map((uid) => ({ uid }))).catch(() => ({ users: [] })),
        ),
      ),
    ]);
    const authUsersResult = { users: authUsersChunks.flatMap((r) => r.users) };
    const isActivatedByUid = new Map<string, boolean>();
    liveUserDocs.forEach((doc) => { if (doc.exists) isActivatedByUid.set(doc.id, doc.data()?.isActivated === true); });
    const lastSignInByUid = new Map<string, string | null>();
    authUsersResult.users.forEach((u) => {
      const signIn = u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : 0;
      const refresh = u.metadata.lastRefreshTime ? new Date(u.metadata.lastRefreshTime).getTime() : 0;
      const latest = Math.max(signIn, refresh);
      lastSignInByUid.set(u.uid, latest > 0 ? new Date(latest).toISOString() : null);
    });
    for (const p of withAuthUid) {
      accountStatusByPersonId.set(p.id, isActivatedByUid.get(p.authUid!) ? "aktif" : "askıda");
      lastLoginByPersonId.set(p.id, lastSignInByUid.get(p.authUid!) ?? null);
    }
  }
  for (const p of persons) {
    if (!p.authUid) accountStatusByPersonId.set(p.id, "pasif");
  }
  return { accountStatusByPersonId, lastLoginByPersonId };
}

/** `limit` YOKSA — bugünkü davranış BİREBİR (tam liste, tam join, tam koleksiyon taraması). */
async function buildAllPersons(actor: Awaited<ReturnType<typeof actorFromCaller>>, withAccountStatus: boolean) {
  const [persons, enrollments, educations, branches, offices, groups, bundles, allSales, allPayments] = await Promise.all([
    firestorePersonRepo.list(actor.tenantId),
    firestoreEnrollmentRepo.list(actor.tenantId),
    firestoreEducationRepo.list(actor.tenantId),
    firestoreBranchRepo.list(actor.tenantId),
    firestoreBranchOfficeRepo.list(actor.tenantId),
    firestoreGroupRepo.list(actor.tenantId),
    firestoreBundleRepo.list(actor.tenantId),
    firestoreSaleRepo.list(actor.tenantId),
    can(actor, "payment.read") ? firestorePaymentRepo.list(actor.tenantId) : Promise.resolve([] as Payment[]),
  ]);

  const joinMaps = buildJoinMaps({ educations, branches, offices, groups, bundles, allSales, allPayments, enrollments });
  const today = new Date().toISOString().slice(0, 10);
  const allowPII = can(actor, "person.read.pii");

  // Org-genişliğinde scope'u olmayan aktörler (örn. standalone eğitmen, @assigned)
  // sadece KENDİ grubuna kayıtlı öğrencileri görür — havuz org-wide değil, sahiplik-bazlı.
  const isOrgScope = widestScope(actor, "person.read") === "org";
  const scopedPersons = isOrgScope
    ? persons
    : persons.filter((p) =>
        (joinMaps.enrollByPerson.get(p.id) ?? []).some(
          (enr) => enr.groupId && ownerMatches(actor, joinMaps.groupMap.get(enr.groupId)?.trainerId),
        ),
      );

  const { accountStatusByPersonId, lastLoginByPersonId } = await resolveAccountStatus(scopedPersons, withAccountStatus);

  const ctx: PersonJoinContext = { ...joinMaps, accountStatusByPersonId, lastLoginByPersonId, allowPII, today };
  return scopedPersons.map((p) => mapPersonToItem(p, ctx));
}

/**
 * `limit` VARSA — join SADECE o sayfadaki kişilere daraltılır (2026-08-05, C yaklaşımı,
 * kullanıcı kararı). Firestore şeması/denormalizasyon YOK — sadece `getByIds`/
 * `listByPersonIds` (30'luk chunk, mevcut desen).
 *
 * SADECE org-scope aktörler için çağrılır (bkz. GET handler'daki `isOrgScope` kontrolü,
 * 2026-08-05 /code-review düzeltmesi) — assigned-scope aktörler (standalone eğitmen)
 * tam-liste yoluna (`buildAllPersons`) yönlendirilir, çünkü sayfa RAW (tüm org,
 * `createdAt DESC`) üzerinden çekilip scope filtresi sayfa İÇİNDE uygulanırsa, aktörün
 * kendi öğrencileri org genelinde yakın zamanda oluşturulmamışsa erken sayfalarda HİÇ
 * görünmeyebilirdi (sessiz veri kaybı).
 */
async function buildPersonsPage(
  actor: Awaited<ReturnType<typeof actorFromCaller>>,
  limit: number,
  cursor: string | undefined,
  withAccountStatus: boolean,
) {
  const { items: rawPage, nextCursor } = await firestorePersonRepo.listPage(actor.tenantId, { limit, cursor });
  const personIds = rawPage.map((p) => p.id);

  const [enrollments, allSales, allPayments] = await Promise.all([
    firestoreEnrollmentRepo.listByPersonIds(personIds, actor.tenantId),
    firestoreSaleRepo.listByPersonIds(personIds, actor.tenantId),
    can(actor, "payment.read") ? firestorePaymentRepo.listByPersonIds(personIds, actor.tenantId) : Promise.resolve([] as Payment[]),
  ]);

  const groupIds = [...new Set(enrollments.map((e) => e.groupId).filter((id): id is string => !!id))];
  const educationIds = [...new Set(enrollments.map((e) => e.educationId).filter((id): id is string => !!id))];
  const bundleIds = [...new Set(allSales.map((s) => s.bundleId).filter((id): id is string => !!id))];

  const [groups, educations, bundles] = await Promise.all([
    firestoreGroupRepo.getByIds(groupIds, actor.tenantId),
    firestoreEducationRepo.getByIds(educationIds, actor.tenantId),
    firestoreBundleRepo.getByIds(bundleIds, actor.tenantId),
  ]);
  const branchIds = [...new Set(educations.map((e) => e.branchId).filter((id): id is string => !!id))];
  const officeIds = [...new Set(groups.map((g) => g.branchOfficeId).filter((id): id is string => !!id))];
  const [branches, offices] = await Promise.all([
    firestoreBranchRepo.getByIds(branchIds, actor.tenantId),
    firestoreBranchOfficeRepo.getByIds(officeIds, actor.tenantId),
  ]);

  const joinMaps = buildJoinMaps({ educations, branches, offices, groups, bundles, allSales, allPayments, enrollments });
  const today = new Date().toISOString().slice(0, 10);
  const allowPII = can(actor, "person.read.pii");

  const { accountStatusByPersonId, lastLoginByPersonId } = await resolveAccountStatus(rawPage, withAccountStatus);

  const ctx: PersonJoinContext = { ...joinMaps, accountStatusByPersonId, lastLoginByPersonId, allowPII, today };
  return { items: rawPage.map((p) => mapPersonToItem(p, ctx)), nextCursor };
}

/**
 * GET /api/flexos/persons — Öğrenci Havuzu listesi.
 * Server-side read-time join: Person + Enrollment + Education + Branch + Group.
 * PII alanları `person.read.pii` yetkisiyle kapılıdır.
 *
 * 2026-08-05 pagination tasarımı (kullanıcı kararı — Seçenek C, bkz. LOAD_TEST.md):
 * `limit` YOKSA bugünkü davranış (tam liste) BİREBİR korunur — mevcut çağıranların
 * HİÇBİRİ bozulmaz (`{ items: [...] }`). `limit` VARSA yeni sayfalı yol devreye girer
 * (`{ items: [...], nextCursor }`) — join SADECE o sayfadaki kişilere daraltılır,
 * org büyüklüğünden BAĞIMSIZ maliyet. Firestore şeması/denormalizasyon YOK.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);

  if (!can(actor, "person.read")) {
    return NextResponse.json({ error: "Yetki yok: person.read" }, { status: 403 });
  }

  // 2026-08-05 k6 taraması: hesap (Auth) durumu cross-check'i ANA listelemeden bağımsız,
  // İKİNCİL bir özellik — SADECE Kullanıcılar > Öğrenciler sekmesi kullanıyor, diğer
  // çağıran sayfalar bu alanları hiç okumuyor ama HER ÇAĞRIDA bedelini ödüyordu. Artık
  // opt-in — sadece isteyen sayfa `?withAccountStatus=true` gönderir. DAVRANIŞ DEĞİŞİKLİĞİ:
  // bu parametre olmadan `accountStatus`/`lastLogin` artık hesaplanmıyor, `"pasif"`/`null`
  // döner (authUid'siz kişilerle AYNI varsayılan).
  const withAccountStatus = req.nextUrl.searchParams.get("withAccountStatus") === "true";
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : null;
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  // 2026-08-05 /code-review bulgusu (gerçek): assigned-scope aktörler (örn. standalone
  // eğitmen) için `buildPersonsPage` RAW sayfayı (tüm org, `createdAt DESC`) çekip scope
  // filtresini sayfa İÇİNDE uyguluyordu — bu aktörün kendi öğrencileri org genelinde
  // yakın zamanda oluşturulmamışsa erken sayfalarda HİÇ görünmeyebiliyordu (sessiz veri
  // kaybı, "kabul edilen sınır" değil gerçek bir doğruluk sorunu). Bu aktörler zaten
  // küçük bir alt kümeye sahip olduğundan (org-scope DEĞİL), pagination'ı sadece
  // org-scope aktörlere uyguluyoruz; diğerleri her zaman tam-liste yoluna düşer.
  const isOrgScope = widestScope(actor, "person.read") === "org";

  try {
    if (limit && limit > 0 && isOrgScope) {
      const cacheKey = `persons:${actor.tenantId}:${actor.uid}:${withAccountStatus}:page:${limit}:${cursor ?? "first"}`;
      const result = await cachedRead(cacheKey, PERSONS_CACHE_TTL_MS, () => buildPersonsPage(actor, limit, cursor, withAccountStatus));
      return NextResponse.json(result);
    }

    const items = await cachedRead(`persons:${actor.tenantId}:${actor.uid}:${withAccountStatus}`, PERSONS_CACHE_TTL_MS, () =>
      buildAllPersons(actor, withAccountStatus),
    );
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/persons GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * Havuz öğrenci durumu = ENROLLMENT'lardan türetilir (Person.status değil — o, lead/aday ekseni).
 * Öğrenci durumu ≠ ödeme durumu (ayrı eksenler — [[project-status-model]]).
 * Rollup önceliği: aktif (grupsuz öne) > beklemede > mezun > pasif > iptal.
 */
function derivePoolStatus(enrollments: Enrollment[]): string {
  if (enrollments.length === 0) return "grupsuz";

  const active = enrollments.filter((e) => e.status === "active");
  if (active.some((e) => !e.groupId)) return "grupsuz"; // havuzda, gruba atanmayı bekliyor
  if (active.length > 0) return "aktif";

  if (enrollments.some((e) => e.status === "on_hold")) return "beklemede"; // op manuel; yoklamada görünür
  if (enrollments.some((e) => e.status === "completed")) return "mezun";
  if (enrollments.some((e) => e.status === "passive")) return "pasif";
  if (enrollments.every((e) => e.status === "cancelled")) return "iptal";

  return "pasif";
}

const ACTIVATION_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün — trainers/route.ts ile AYNI

/**
 * 2026-07-13 EKLENDİ — kullanıcı bulgusu: "otomatik mail atmalıydı." Öğrenci ekleme
 * (`trainers/route.ts::provisionTrainerLogin` ile AYNI desen, bilerek — o zaten çalışıyor,
 * kod tekrar YAZILMADI, birebir uyarlandı) e-posta varsa giriş hesabı + tek kullanımlık
 * aktivasyon kodu otomatik sağlanır. Idempotent: e-posta zaten bir Auth hesabına/flexos_users
 * kaydına bağlıysa MEVCUT hesap kullanılır, yeni kod/mail gönderilmez. Best-effort: hata
 * olursa kişi kaydı BAŞARISIZ SAYILMAZ (non-fatal, aynen trainer deseni).
 */
async function provisionStudentLogin(person: Person, tenantId: string, createdBy: string): Promise<void> {
  const email = person.pii?.email?.trim().toLowerCase();
  if (!email) return; // e-posta yoksa (PII yetkisi yok/girilmedi) hesap sağlanamaz

  const existingFlexosUser = await firestoreFlexosUserRepo.getByEmail(email, tenantId);
  if (existingFlexosUser) {
    if (existingFlexosUser.authUid && existingFlexosUser.authUid !== person.authUid) {
      await firestorePersonRepo.save({ ...person, authUid: existingFlexosUser.authUid });
    }
    return;
  }

  let authUid: string;
  try {
    const existingAuthUser = await adminAuth.getUserByEmail(email);
    authUid = existingAuthUser.uid;
  } catch {
    const created = await adminAuth.createUser({
      email, displayName: `${person.firstName} ${person.lastName}`.trim(), emailVerified: false,
    });
    authUid = created.uid;
  }
  // Öğrenci tarafı capability-role claim'i GEREKTİRMİYOR — sahiplik kontrolü
  // `person.authUid === caller.uid` üzerinden yapılıyor (bkz. submission-service.ts
  // `requireOwnedPerson`), o yüzden trainer'ın aksine burada `role` claim'i YAZILMIYOR.

  const flexosUser: FlexosUser = {
    id: firestoreFlexosUserRepo.nextId(),
    tenantId,
    name: person.firstName,
    surname: person.lastName,
    email,
    phone: person.pii?.phone,
    gender: person.gender ?? "unspecified",
    roles: ["ogrenci"],
    subes: [],
    status: "aktif",
    authUid,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  await firestoreFlexosUserRepo.save(flexosUser);
  await firestorePersonRepo.save({ ...person, authUid });

  try {
    const code = generateActivationCode();
    const expiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS);
    await adminDb.collection("flexos_codes").add({
      code, flexosUserId: flexosUser.id, tenantId, email: flexosUser.email,
      createdAt: FieldValue.serverTimestamp(), expiresAt, status: "pending",
    });
    const emailTemplate = buildFlexosActivationEmail({
      name: `${flexosUser.name} ${flexosUser.surname}`.trim(), email: flexosUser.email, code, expiresAt,
    });
    await sendMail({ to: flexosUser.email, subject: emailTemplate.subject, html: emailTemplate.html, text: emailTemplate.text });
  } catch (mailErr) {
    console.error("[flexos/persons POST] Aktivasyon maili gönderilemedi:", mailErr);
  }
}

/**
 * POST /api/flexos/persons — yeni kişi oluştur (gated).
 *
 * Yetki + PII filtreleme service'te (`createPerson`). Bu route sadece:
 *  token → Actor, gövde → input, hata → HTTP kodu.
 * Yazım Admin SDK ile yeni `persons` koleksiyonuna; canlıya dokunmaz.
 * 2026-07-13: e-posta verilmişse otomatik giriş hesabı + aktivasyon kodu maili
 * sağlanır (`provisionStudentLogin`, trainer deseninin birebir uyarlaması).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreatePersonInput;
  try {
    body = (await req.json()) as CreatePersonInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const result = await createPerson(actor, body, firestorePersonRepo);
    let loginProvisioned = false;
    try {
      if (!result.piiDropped && result.person.pii?.email) {
        await provisionStudentLogin(result.person, actor.tenantId, actor.uid);
        loginProvisioned = true;
      }
    } catch (loginErr) {
      console.error("[flexos/persons POST] giriş hesabı sağlanamadı:", loginErr);
    }
    invalidateCache(`persons:${actor.tenantId}`); // yeni öğrenci — cache'i anında düşür
    broadcast(actor.tenantId, { type: "students.changed", id: result.person.id });
    return NextResponse.json(
      { id: result.person.id, piiDropped: result.piiDropped, loginProvisioned },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e, "flexos/persons");
  }
});
