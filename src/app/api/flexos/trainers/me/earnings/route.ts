import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";
import { getMyTrainerEarnings } from "@/app/lib/domain/services/trainer-earnings-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * GET /api/flexos/trainers/me/earnings?month=YYYY-MM — çağıranın KENDİ aylık hak edişi.
 * `me` — bilerek bir id parametresi YOK, `actor.trainerId`'den çözülür (bkz.
 * `getMyTrainerEarnings` — bu uç yapı gereği başka bir eğitmenin verisini asla döndüremez).
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const month = req.nextUrl.searchParams.get("month") ?? undefined;

  try {
    const actor = await actorFromCaller(caller);
    const earnings = await getMyTrainerEarnings(actor, month, {
      trainers: firestoreTrainerRepo,
      groups: firestoreGroupRepo,
      attendance: firestoreAttendanceRepo,
      settings: firestoreSettingsRepo,
    });
    return NextResponse.json(earnings);
  } catch (e) {
    return apiError(e, "flexos/trainers/me/earnings");
  }
});
