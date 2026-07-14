import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { closeAccount } from "@/app/lib/domain/services/person-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { invalidateCache } from "@/app/lib/server/read-cache";

/**
 * POST /api/flexos/persons/[id]/close-account — Öğrenci hesabını kapat (admin-only, `role.manage`).
 * Person/Enrollment/Grade/Sale/Payment DOKUNULMAZ — sadece giriş erişimi (Firebase Auth
 * hesabı + `Person.authUid`) kaldırılır. `deletePerson`'dan farkı: kişi kaydı kalır.
 */
export const POST = withAuth(async (_req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);

  try {
    const result = await closeAccount(actor, id, firestorePersonRepo);

    if (result.closedAuthUid) {
      try {
        await adminAuth.deleteUser(result.closedAuthUid);
      } catch {
        // zaten silinmiş olabilir
      }
      try {
        await adminDb.collection("users").doc(result.closedAuthUid).delete();
      } catch {
        // doc yoksa sessizce geç
      }
    }

    invalidateCache(`persons:${actor.tenantId}`);
    broadcast(actor.tenantId, { type: "students.changed", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/persons/close-account POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
