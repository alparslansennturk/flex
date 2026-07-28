import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { createEnrollment, type CreateEnrollmentInput } from "@/app/lib/domain/services/enrollment-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/**
 * POST /api/flexos/enrollments — kişiyi bir gruba kaydet (gated).
 * Çoklu grup serbest (1 Person, N Enrollment); aynı grupta çift kayıt engelli.
 * Yazım Admin SDK ile yeni `enrollments` koleksiyonuna.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateEnrollmentInput;
  try {
    body = (await req.json()) as CreateEnrollmentInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const enrollment = await createEnrollment(actor, body, {
      enrollments: firestoreEnrollmentRepo,
      persons: firestorePersonRepo,
      groups: firestoreGroupRepo,
    });
    broadcast(actor.tenantId, { type: "students.changed", id: enrollment.id });
    return NextResponse.json({ id: enrollment.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/enrollments");
  }
});
