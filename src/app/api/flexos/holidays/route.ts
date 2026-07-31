import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreHolidayRepo } from "@/app/lib/server/holiday-repo.firestore";
import { createHoliday, type CreateHolidayInput } from "@/app/lib/domain/services/holiday-service";
import { apiError } from "@/app/lib/server/api-error";

/** POST /api/flexos/holidays — tatil ekle (gated `holiday.manage`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateHolidayInput;
  try { body = (await req.json()) as CreateHolidayInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  try {
    const holiday = await createHoliday((await actorFromCaller(caller)), body, firestoreHolidayRepo);
    return NextResponse.json({ id: holiday.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/holidays");
  }
});

/**
 * GET /api/flexos/holidays — tatil listesi (kiracıya göre, herkes okuyabilir —
 * yoklama takvimi dahil tüm aktörlerin görmesi gerekiyor, sadece yazma kapılı).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const items = await firestoreHolidayRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});
