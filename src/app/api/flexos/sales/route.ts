import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { createSale, type CreateSaleInput } from "@/app/lib/domain/services/sale-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

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
    });
    return NextResponse.json(
      {
        saleId: result.sale.id,
        personId: result.person.id,
        enrollmentId: result.enrollment.id,
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
