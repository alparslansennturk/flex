import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can, widestScope, ownerMatches } from "@/app/lib/domain/access/can";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePaymentRepo } from "@/app/lib/server/payment-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestoreBundleRepo } from "@/app/lib/server/bundle-repo.firestore";
import { createPerson, type CreatePersonInput } from "@/app/lib/domain/services/person-service";
import { derivePaymentRollup } from "@/app/lib/domain/services/payment-service";
import { officeName } from "@/app/lib/branch-offices";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { cachedRead, invalidateCache } from "@/app/lib/server/read-cache";
import type { Person } from "@/app/lib/domain/core/person";

// Persons GET EN AĞIR uç (8 koleksiyon: persons+enrollments+sales+payments+bundles+...) ve
// Ana Sayfa mount'unda + öğrenci ekranlarında çekiliyor. Grading sırasında değişmez → 5dk
// cache (groups'taki 2026-07-13 gerekçesiyle aynı: grading tek gruba 30sn'den uzun sürüyor)
// dönüş başına ~150 okumayı ~0'a indirir (yeni öğrenci POST'ta invalidate edilir).
const PERSONS_CACHE_TTL_MS = 5 * 60_000;
import type { Enrollment } from "@/app/lib/domain/core/enrollment";
import type { Payment } from "@/app/lib/domain/eduos/payment";
import type { Sale } from "@/app/lib/domain/eduos/sale";

/**
 * GET /api/flexos/persons — Öğrenci Havuzu listesi.
 * Server-side read-time join: Person + Enrollment + Education + Branch + Group.
 * PII alanları `person.read.pii` yetkisiyle kapılıdır.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);

  if (!can(actor, "person.read")) {
    return NextResponse.json({ error: "Yetki yok: person.read" }, { status: 403 });
  }

  try {
    const items = await cachedRead(`persons:${actor.tenantId}:${actor.uid}`, PERSONS_CACHE_TTL_MS, async () => {
    const [persons, enrollments, educations, branches, groups, bundles, allSales, allPayments] = await Promise.all([
      firestorePersonRepo.list(actor.tenantId),
      firestoreEnrollmentRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreBranchRepo.list(actor.tenantId),
      firestoreGroupRepo.list(actor.tenantId),
      firestoreBundleRepo.list(actor.tenantId),
      firestoreSaleRepo.list(actor.tenantId),
      can(actor, "payment.read") ? firestorePaymentRepo.list(actor.tenantId) : Promise.resolve([] as Payment[]),
    ]);

    const eduMap = new Map(educations.map((e) => [e.id, e]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const bundleMap = new Map(bundles.map((b) => [b.id, b]));
    const saleMap = new Map(allSales.map((s) => [s.id, s]));

    // enrollment'ları personId'ye göre grupla
    const enrollByPerson = new Map<string, Enrollment[]>();
    for (const enr of enrollments) {
      const list = enrollByPerson.get(enr.personId) ?? [];
      list.push(enr);
      enrollByPerson.set(enr.personId, list);
    }

    // payment'ları ve sale'leri personId'ye göre grupla (ödeme rollup'ı için)
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
    const today = new Date().toISOString().slice(0, 10);

    const allowPII = can(actor, "person.read.pii");

    // Org-genişliğinde scope'u olmayan aktörler (örn. standalone eğitmen, @assigned)
    // sadece KENDİ grubuna kayıtlı öğrencileri görür — havuz org-wide değil, sahiplik-bazlı.
    const isOrgScope = widestScope(actor, "person.read") === "org";
    const scopedPersons = isOrgScope
      ? persons
      : persons.filter((p) =>
          (enrollByPerson.get(p.id) ?? []).some(
            (enr) => enr.groupId && ownerMatches(actor, groupMap.get(enr.groupId)?.trainerId),
          ),
        );

    // Hesap (Auth) durumu — Kullanıcılar > Öğrenciler sekmesi için salt-okunur çapraz kontrol.
    // Person.authUid backfill'den (canlı) geliyor; FlexOS henüz kendi öğrenci davet/aktivasyon
    // akışını açmadı, o yüzden aktivasyon bilgisi hâlâ canlı `users/{uid}.isActivated`'te —
    // buraya SADECE okunur, hiç yazılmaz. "Son giriş" Firebase Auth'un kendi `lastSignInTime`'ı
    // (uydurma veri değil, gerçek metadata).
    const accountStatusByPersonId = new Map<string, "aktif" | "askıda" | "pasif">();
    const lastLoginByPersonId = new Map<string, string | null>();
    const withAuthUid = scopedPersons.filter((p) => p.authUid);
    if (withAuthUid.length > 0) {
      const uids = withAuthUid.map((p) => p.authUid!);
      const [liveUserDocs, authUsersResult] = await Promise.all([
        adminDb.getAll(...uids.map((uid) => adminDb.collection("users").doc(uid))),
        adminAuth.getUsers(uids.map((uid) => ({ uid }))).catch(() => ({ users: [] })),
      ]);
      const isActivatedByUid = new Map<string, boolean>();
      liveUserDocs.forEach((doc) => { if (doc.exists) isActivatedByUid.set(doc.id, doc.data()?.isActivated === true); });
      const lastSignInByUid = new Map<string, string | null>();
      authUsersResult.users.forEach((u) => lastSignInByUid.set(u.uid, u.metadata.lastSignInTime ?? null));
      for (const p of withAuthUid) {
        accountStatusByPersonId.set(p.id, isActivatedByUid.get(p.authUid!) ? "aktif" : "askıda");
        lastLoginByPersonId.set(p.id, lastSignInByUid.get(p.authUid!) ?? null);
      }
    }
    for (const p of scopedPersons) {
      if (!p.authUid) accountStatusByPersonId.set(p.id, "pasif");
    }

    return scopedPersons.map((p: Person) => {
      const enrs = enrollByPerson.get(p.id) ?? [];

      // branş listesi (enrollment → education → branch)
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
        const edu = enr.educationId ? eduMap.get(enr.educationId) : undefined;
        const branch = edu?.branchId ? branchMap.get(edu.branchId) : undefined;
        if (branch) branchNames.add(branch.name);

        if (enr.groupId) {
          const grp = groupMap.get(enr.groupId);
          groupList.push({
            label: grp?.code ?? enr.groupId,
            branch: branch?.name ?? "",
            educationName: edu?.name ?? "",
            groupId: enr.groupId,
            enrollmentId: enr.id,
            status: enr.status,
          });
          const office = officeName(grp?.branchOfficeId);
          if (office) officeNames.add(office);
        }

        if (enr.status === "cancelled") continue;

        // Eğitim sütunu: paket satışı → paket adı (tek satır); bireysel → eğitim adı
        const sale = enr.saleId ? saleMap.get(enr.saleId) : undefined;
        if (sale?.bundleId) {
          if (!seenBundleSaleIds.has(sale.id)) {
            seenBundleSaleIds.add(sale.id);
            const bundle = bundleMap.get(sale.bundleId);
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
          educationName: (e.educationId && eduMap.get(e.educationId)?.name) ?? "",
        }));

      // ödeme durumu rollup'ı (payment.read yetkisiyle)
      const personPayments = paymentsByPerson.get(p.id) ?? [];
      const personSales = salesByPerson.get(p.id) ?? [];
      const totalExpected = personSales.reduce((a, s) => a + (s.soldPrice ?? 0) + (s.financingFee ?? 0), 0);
      const paymentStatus = personPayments.length > 0 || totalExpected > 0
        ? derivePaymentRollup(personPayments, totalExpected, today)
        : null;

      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        email: allowPII ? (p.pii?.email ?? "") : "",
        phone: allowPII ? (p.pii?.phone ?? "") : "",
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
        accountStatus: accountStatusByPersonId.get(p.id) ?? "pasif",
        lastLogin: lastLoginByPersonId.get(p.id) ?? null,
      };
    });
    });

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

/**
 * POST /api/flexos/persons — yeni kişi oluştur (gated).
 *
 * Yetki + PII filtreleme service'te (`createPerson`). Bu route sadece:
 *  token → Actor, gövde → input, hata → HTTP kodu.
 * Yazım Admin SDK ile yeni `persons` koleksiyonuna; canlıya dokunmaz.
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
    invalidateCache(`persons:${actor.tenantId}`); // yeni öğrenci — cache'i anında düşür
    broadcast(actor.tenantId, { type: "students.changed", id: result.person.id });
    return NextResponse.json(
      { id: result.person.id, piiDropped: result.piiDropped },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/persons] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
