import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreHolidayRepo } from "@/app/lib/server/holiday-repo.firestore";
import { updateHoliday, deleteHoliday, type UpdateHolidayInput } from "@/app/lib/domain/services/holiday-service";
import { apiError } from "@/app/lib/server/api-error";

/** PATCH /api/flexos/holidays/[id] — tatil güncelle (gated `holiday.manage`). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateHolidayInput;
  try { body = (await req.json()) as UpdateHolidayInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  try {
    const holiday = await updateHoliday((await actorFromCaller(caller)), id, body, firestoreHolidayRepo);
    return NextResponse.json({ id: holiday.id });
  } catch (e) {
    return apiError(e, "flexos/holidays/[id]");
  }
});

/** DELETE /api/flexos/holidays/[id] — tatil sil (gated `holiday.manage`). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteHoliday((await actorFromCaller(caller)), id, firestoreHolidayRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/holidays/[id]");
  }
});
