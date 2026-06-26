import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { cancelSale } from "@/app/lib/domain/services/sale-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/sales/[id]/cancel — satış iptali (soft).
 *
 * Body: { reason?: string }
 * Cascade: Sale→cancelled + bağlı Enrollment'lar→cancelled.
 * Person/Enrollment SİLİNMEZ (audit/remarketing).
 */
export const POST = withAuth(async (req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = actorFromCaller(caller);

  let body: { reason?: string } = {};
  try {
    body = (await req.json()) as { reason?: string };
  } catch {
    // boş body kabul edilir (sebep opsiyonel)
  }

  try {
    const result = await cancelSale(actor, { saleId: id, reason: body.reason }, {
      sales: firestoreSaleRepo,
      enrollments: firestoreEnrollmentRepo,
    });

    return NextResponse.json({
      ok: true,
      cancelledEnrollments: result.cancelledEnrollments,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/sales/[id]/cancel] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
