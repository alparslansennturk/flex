import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { setMyHourlyRate } from "@/app/lib/domain/services/trainer-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * PATCH /api/flexos/trainers/me/rate — çağıranın KENDİ ders saati ücretini günceller.
 * SADECE Core görünümündeki owner kullanabilir (`trainer.rate.write.self`, self scope —
 * bkz. `auth-actor.ts`). Full modda ücret hâlâ Eğitmenler CRUD'undan (`PATCH
 * /api/flexos/trainers/[id]`, `trainer.rate.write`, admin-only) girilir, bu uç ONU
 * değiştirmez, ayrı bir yoldur. `id` YOK — "me", başka bir eğitmenin ücretini asla
 * değiştiremez.
 */
export const PATCH = withAuth(async (req: NextRequest, caller) => {
  let body: { hourlyRate?: number };
  try {
    body = (await req.json()) as { hourlyRate?: number };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (typeof body.hourlyRate !== "number") {
    return NextResponse.json({ error: "hourlyRate zorunludur." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    const trainer = await setMyHourlyRate(actor, body.hourlyRate, firestoreTrainerRepo);
    return NextResponse.json({ id: trainer.id, hourlyRate: trainer.hourlyRate });
  } catch (e) {
    return apiError(e, "flexos/trainers/me/rate");
  }
});
