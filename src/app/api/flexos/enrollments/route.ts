import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { createEnrollment, type CreateEnrollmentInput } from "@/app/lib/domain/services/enrollment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

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

  const actor = actorFromCaller(caller);

  try {
    const enrollment = await createEnrollment(actor, body, firestoreEnrollmentRepo);
    return NextResponse.json({ id: enrollment.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/enrollments] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
