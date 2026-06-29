import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { firestoreCaseRepo } from "@/app/lib/server/case-repo.firestore";
import { firestoreActivityRepo } from "@/app/lib/server/activity-repo.firestore";
import { firestoreAppointmentRepo } from "@/app/lib/server/appointment-repo.firestore";
import { addActivity, type AddActivityInput } from "@/app/lib/domain/services/case-service";

/**
 * POST /api/flexos/activities — mevcut talebe aktivite ekle.
 * Randevu oluşturma + talep kapatma da bu endpoint üzerinden yapılır.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: AddActivityInput;
  try {
    body = (await req.json()) as AddActivityInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const result = await addActivity(actorFromCaller(caller), body, {
      cases: firestoreCaseRepo,
      activities: firestoreActivityRepo,
      appointments: firestoreAppointmentRepo,
    });

    return NextResponse.json(
      {
        activityId: result.activity.id,
        appointmentId: result.appointment?.id ?? null,
        caseStatus: result.updatedCase.status,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/activities POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
