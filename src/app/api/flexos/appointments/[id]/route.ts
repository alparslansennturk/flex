import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { firestoreAppointmentRepo } from "@/app/lib/server/appointment-repo.firestore";
import { firestoreCaseRepo } from "@/app/lib/server/case-repo.firestore";
import { firestoreActivityRepo } from "@/app/lib/server/activity-repo.firestore";
import { updateAppointment, type UpdateAppointmentInput } from "@/app/lib/domain/services/case-service";
import { broadcast } from "@/app/lib/server/realtime-hub";

/**
 * PATCH /api/flexos/appointments/[id] — randevu düzenle/iptal et.
 * Randevu Takvimi sayfası (Düzenle modalı + İptal onayı, `{status:"iptal"}`).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  let body: Omit<UpdateAppointmentInput, "id">;
  try {
    body = (await req.json()) as Omit<UpdateAppointmentInput, "id">;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { id } = await ctx.params;

  try {
    const actor = await actorFromCaller(caller);
    const updated = await updateAppointment(actor, { id, ...body }, {
      appointments: firestoreAppointmentRepo,
      cases: firestoreCaseRepo,
      activities: firestoreActivityRepo,
    });
    broadcast(actor.tenantId, { type: "activities.changed", id: updated.id });
    return NextResponse.json({ appointment: updated });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/appointments/[id] PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
