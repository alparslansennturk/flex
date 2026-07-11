import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePaymentRepo } from "@/app/lib/server/payment-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreBundleRepo } from "@/app/lib/server/bundle-repo.firestore";
import { createSale, type CreateSaleInput } from "@/app/lib/domain/services/sale-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

/**
 * GET /api/flexos/sales — satış listesi.
 * Server-side join: Sale + Person + Education + Branch.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "sale.read")) {
    return NextResponse.json({ error: "Yetki yok: sale.read" }, { status: 403 });
  }

  try {
    const [sales, persons, educations, branches, bundles] = await Promise.all([
      firestoreSaleRepo.list(actor.tenantId),
      firestorePersonRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreBranchRepo.list(actor.tenantId),
      firestoreBundleRepo.list(actor.tenantId),
    ]);

    const personMap = new Map(persons.map((p) => [p.id, p]));
    const eduMap = new Map(educations.map((e) => [e.id, e]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const bundleMap = new Map(bundles.map((b) => [b.id, b]));

    const items = sales
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .map((s) => {
        const person = personMap.get(s.personId);
        const edu = s.educationId ? eduMap.get(s.educationId) : undefined;
        const bundle = s.bundleId ? bundleMap.get(s.bundleId) : undefined;
        const branch = edu?.branchId ? branchMap.get(edu.branchId) : undefined;
        return {
          id: s.id,
          date: s.date ?? s.createdAt?.slice(0, 10) ?? "",
          studentName: person ? `${person.firstName} ${person.lastName}` : s.personId,
          educationName: edu?.name ?? bundle?.name ?? "",
          branchName: branch?.name ?? "",
          bundleId: s.bundleId,
          soldPrice: s.soldPrice ?? 0,
          status: s.status ?? "active",
          type: s.type,
          customerType: s.customerType,
          createdAt: s.createdAt,
        };
      });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/sales GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * POST /api/flexos/sales — satış yap (orchestrator).
 * Tek çağrıyla Person + Sale + Enrollment oluşturur.
 * Yazım Admin SDK ile; client erişimi kapalı (Firestore rules: if false).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateSaleInput;
  try {
    body = (await req.json()) as CreateSaleInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const result = await createSale(actor, body, {
      sales: firestoreSaleRepo,
      persons: firestorePersonRepo,
      enrollments: firestoreEnrollmentRepo,
      bundles: firestoreBundleRepo,
      payments: firestorePaymentRepo,
    });
    broadcast(actor.tenantId, { type: "sales.changed", id: result.sale.id });
    broadcast(actor.tenantId, { type: "students.changed", id: result.person.id });
    return NextResponse.json(
      {
        saleId: result.sale.id,
        personId: result.person.id,
        enrollmentIds: result.enrollments.map((e) => e.id),
        paymentCount: result.payments.length,
        financingFee: result.sale.financingFee ?? 0,
        piiDropped: result.piiDropped,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/sales] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
