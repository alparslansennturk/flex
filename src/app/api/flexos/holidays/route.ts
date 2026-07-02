import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreHolidayRepo } from "@/app/lib/server/holiday-repo.firestore";
import { createHoliday, type CreateHolidayInput } from "@/app/lib/domain/services/holiday-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** POST /api/flexos/holidays — tatil ekle (gated `holiday.manage`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateHolidayInput;
  try { body = (await req.json()) as CreateHolidayInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  try {
    const holiday = await createHoliday(actorFromCaller(caller), body, firestoreHolidayRepo);
    return NextResponse.json({ id: holiday.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/holidays POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * GET /api/flexos/holidays — tatil listesi (kiracıya göre, herkes okuyabilir —
 * yoklama takvimi dahil tüm aktörlerin görmesi gerekiyor, sadece yazma kapılı).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const items = await firestoreHolidayRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});
