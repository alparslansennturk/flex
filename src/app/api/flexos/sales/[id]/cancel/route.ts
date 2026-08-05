import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { cancelSale } from "@/app/lib/domain/services/sale-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { invalidateCache } from "@/app/lib/server/read-cache";
import { apiError } from "@/app/lib/server/api-error";

/**
 * POST /api/flexos/sales/[id]/cancel — satış iptali (soft).
 *
 * Body: { reason?: string }
 * Cascade: Sale→cancelled + bağlı Enrollment'lar→cancelled.
 * Person/Enrollment SİLİNMEZ (audit/remarketing).
 */
export const POST = withAuth(async (req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);

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

    invalidateCache(`sales:${actor.tenantId}`);
    broadcast(actor.tenantId, { type: "sales.changed", id });
    broadcast(actor.tenantId, { type: "students.changed", id });
    return NextResponse.json({
      ok: true,
      cancelledEnrollments: result.cancelledEnrollments,
    });
  } catch (e) {
    return apiError(e, "flexos/sales/[id]/cancel");
  }
});
