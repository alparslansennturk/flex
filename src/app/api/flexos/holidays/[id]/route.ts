import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreHolidayRepo } from "@/app/lib/server/holiday-repo.firestore";
import { updateHoliday, deleteHoliday, type UpdateHolidayInput } from "@/app/lib/domain/services/holiday-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** PATCH /api/flexos/holidays/[id] — tatil güncelle (gated `holiday.manage`). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateHolidayInput;
  try { body = (await req.json()) as UpdateHolidayInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  try {
    const holiday = await updateHoliday(actorFromCaller(caller), id, body, firestoreHolidayRepo);
    return NextResponse.json({ id: holiday.id });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/holidays/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** DELETE /api/flexos/holidays/[id] — tatil sil (gated `holiday.manage`). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteHoliday(actorFromCaller(caller), id, firestoreHolidayRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/holidays/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
