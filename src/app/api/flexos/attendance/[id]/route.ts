import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { saveAttendance, deleteAttendance, type SaveAttendanceInput } from "@/app/lib/domain/services/attendance-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

/**
 * PATCH /api/flexos/attendance/[id] — yoklama kaydet (Kaydet) / kapat (Dersi Bitir) /
 * yeniden aç (Op — `close: false`). Gated `attendance.write`.
 *
 * Body: `{ groupId, date, entries, close? }`. `id` ("{groupId}_{date}") sadece
 * URL tutarlılığı için — gövdeyle eşleşmezse 400 (yanlış kayda yazma önlenir).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: SaveAttendanceInput;
  try {
    body = (await req.json()) as SaveAttendanceInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (!body.groupId || !body.date) {
    return NextResponse.json({ error: "groupId ve date zorunludur." }, { status: 400 });
  }
  if (id !== `${body.groupId}_${body.date}`) {
    return NextResponse.json({ error: "id, groupId/date ile uyuşmuyor." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const record = await saveAttendance(actor, body, {
      groups: firestoreGroupRepo,
      attendance: firestoreAttendanceRepo,
    });
    broadcast(actor.tenantId, { type: "attendance.changed", id: record.id });
    return NextResponse.json({ id: record.id, attendanceClosed: record.attendanceClosed });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/attendance/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * DELETE /api/flexos/attendance/[id]?groupId=&date= — "İptal" (Dersi Başlat'ı geri alma).
 * Sadece kapatılmamış kayıtlarda çalışır. Gated `attendance.write`.
 */
export const DELETE = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const groupId = req.nextUrl.searchParams.get("groupId");
  const date = req.nextUrl.searchParams.get("date");
  if (!groupId || !date) return NextResponse.json({ error: "groupId ve date zorunludur." }, { status: 400 });
  if (id !== `${groupId}_${date}`) {
    return NextResponse.json({ error: "id, groupId/date ile uyuşmuyor." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    await deleteAttendance(actor, { groupId, date }, { groups: firestoreGroupRepo, attendance: firestoreAttendanceRepo });
    broadcast(actor.tenantId, { type: "attendance.changed", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/attendance/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
