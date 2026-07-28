import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { closeAccount } from "@/app/lib/domain/services/person-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { invalidateCache } from "@/app/lib/server/read-cache";
import { apiError } from "@/app/lib/server/api-error";

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
    return apiError(e, "flexos/persons/[id]/close-account");
  }
});
