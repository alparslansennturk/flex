import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePaymentRepo } from "@/app/lib/server/payment-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { createPerson, type CreatePersonInput } from "@/app/lib/domain/services/person-service";
import { derivePaymentRollup } from "@/app/lib/domain/services/payment-service";
import { officeName } from "@/app/lib/branch-offices";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import type { Person } from "@/app/lib/domain/core/person";
import type { Enrollment } from "@/app/lib/domain/core/enrollment";
import type { Payment } from "@/app/lib/domain/eduos/payment";
import type { Sale } from "@/app/lib/domain/eduos/sale";

/**
 * GET /api/flexos/persons — Öğrenci Havuzu listesi.
 * Server-side read-time join: Person + Enrollment + Education + Branch + Group.
 * PII alanları `person.read.pii` yetkisiyle kapılıdır.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);

  if (!can(actor, "person.read")) {
    return NextResponse.json({ error: "Yetki yok: person.read" }, { status: 403 });
  }

  try {
    const [persons, enrollments, educations, branches, groups, allPayments, allSales] = await Promise.all([
      firestorePersonRepo.list(actor.tenantId),
      firestoreEnrollmentRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreBranchRepo.list(actor.tenantId),
      firestoreGroupRepo.list(actor.tenantId),
      can(actor, "payment.read") ? firestorePaymentRepo.list(actor.tenantId) : Promise.resolve([] as Payment[]),
      can(actor, "payment.read") ? firestoreSaleRepo.list(actor.tenantId) : Promise.resolve([] as Sale[]),
    ]);

    const eduMap = new Map(educations.map((e) => [e.id, e]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));

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

    const items = persons.map((p: Person) => {
      const enrs = enrollByPerson.get(p.id) ?? [];

      // branş listesi (enrollment → education → branch)
      const branchNames = new Set<string>();
      const groupList: Array<{ label: string; branch: string }> = [];
      const officeNames = new Set<string>(); // şube = öğrencinin gruplarından türetilir

      for (const enr of enrs) {
        const edu = enr.educationId ? eduMap.get(enr.educationId) : undefined;
        const branch = edu?.branchId ? branchMap.get(edu.branchId) : undefined;
        if (branch) branchNames.add(branch.name);

        if (enr.groupId) {
          const grp = groupMap.get(enr.groupId);
          groupList.push({
            label: grp?.code ? `Grup ${grp.code}` : enr.groupId,
            branch: branch?.name ?? "",
          });
          const office = officeName(grp?.branchOfficeId);
          if (office) officeNames.add(office);
        }
      }

      // enrollment durumundan havuz durumu türet (öğrenci durumu = üyelikten, Person'dan değil)
      const status = derivePoolStatus(enrs);

      // "Gruba Ata" için atanabilir kayıt: aktif + grupsuz (ilk uygun)
      const assignable = enrs.find((e) => e.status === "active" && !e.groupId);

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
        subeler: [...officeNames],
        assignableEnrollmentId: assignable?.id ?? null,
        assignableEducationId: assignable?.educationId ?? null,
        gender: p.gender ?? "",
        createdAt: p.createdAt,
        paymentStatus,
      };
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

  const actor = actorFromCaller(caller);

  try {
    const result = await createPerson(actor, body, firestorePersonRepo);
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
