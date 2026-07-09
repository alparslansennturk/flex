import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";
import { transferEnrollment } from "@/app/lib/domain/services/enrollment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/enrollments/[id]/transfer — bir kaydı başka bir gruba "taşır".
 * Eski kaydı MUTASYONA UĞRATMAZ — ek satış gibi YENİ bir kayıt açar, eskisi `closeAs`
 * ("completed"=mezun veya "cancelled"=henüz bitmedi/sadece sınıf değişti) ile kapanır
 * (bkz `transferEnrollment` — bölüm/modül bazlı eğitimlerde her bölümün kendi
 * yoklama/sertifikası olabilsin diye).
 * Body: { toGroupId, closeAs: "completed"|"cancelled" }. Gated `enrollment.transfer`
 * VEYA `sale.create` — hangisinin gerektiği `flexos_settings.transferRequiresManualSale`
 * switch'ine bağlı (bkz `transferEnrollment`).
 */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: { toGroupId?: string; closeAs?: "completed" | "cancelled" };
  try { body = (await req.json()) as { toGroupId?: string; closeAs?: "completed" | "cancelled" }; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  if (!body.toGroupId) return NextResponse.json({ error: "toGroupId zorunludur." }, { status: 400 });
  if (body.closeAs !== "completed" && body.closeAs !== "cancelled") {
    return NextResponse.json({ error: "closeAs \"completed\" veya \"cancelled\" olmalıdır." }, { status: 400 });
  }

  try {
    const { closedEnrollment, newEnrollment, sale } = await transferEnrollment(
      await actorFromCaller(caller),
      { enrollmentId: id, toGroupId: body.toGroupId, closeAs: body.closeAs },
      {
        enrollments: firestoreEnrollmentRepo,
        groups: firestoreGroupRepo,
        sales: firestoreSaleRepo,
        settings: firestoreSettingsRepo,
      },
    );
    return NextResponse.json({
      closedEnrollmentId: closedEnrollment.id,
      newEnrollmentId: newEnrollment.id,
      groupId: newEnrollment.groupId,
      saleId: sale.id,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/enrollments/:id/transfer POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
