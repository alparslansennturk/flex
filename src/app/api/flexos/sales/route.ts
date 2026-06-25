import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePaymentRepo } from "@/app/lib/server/payment-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createSale, type CreateSaleInput } from "@/app/lib/domain/services/sale-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * GET /api/flexos/sales — satış listesi.
 * Server-side join: Sale + Person + Education + Branch.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  if (!can(actor, "sale.read")) {
    return NextResponse.json({ error: "Yetki yok: sale.read" }, { status: 403 });
  }

  try {
    const [sales, persons, educations, branches] = await Promise.all([
      firestoreSaleRepo.list(actor.tenantId),
      firestorePersonRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreBranchRepo.list(actor.tenantId),
    ]);

    const personMap = new Map(persons.map((p) => [p.id, p]));
    const eduMap = new Map(educations.map((e) => [e.id, e]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    const items = sales
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .map((s) => {
        const person = personMap.get(s.personId);
        const edu = s.educationId ? eduMap.get(s.educationId) : undefined;
        const branch = edu?.branchId ? branchMap.get(edu.branchId) : undefined;
        return {
          id: s.id,
          date: s.date ?? s.createdAt?.slice(0, 10) ?? "",
          studentName: person ? `${person.firstName} ${person.lastName}` : s.personId,
          educationName: edu?.name ?? "",
          branchName: branch?.name ?? "",
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

  const actor = actorFromCaller(caller);

  try {
    const result = await createSale(actor, body, {
      sales: firestoreSaleRepo,
      persons: firestorePersonRepo,
      enrollments: firestoreEnrollmentRepo,
      payments: firestorePaymentRepo,
    });
    return NextResponse.json(
      {
        saleId: result.sale.id,
        personId: result.person.id,
        enrollmentId: result.enrollment.id,
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
