import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { startLesson, isWithinEditWindow, type StartLessonInput } from "@/app/lib/domain/services/attendance-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/attendance — Dersi Başlat (boş yoklama kaydı açar).
 * Gated `attendance.write`. Mevcut kaydın üzerine yazmaz.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: StartLessonInput;
  try {
    body = (await req.json()) as StartLessonInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = actorFromCaller(caller);

  try {
    const record = await startLesson(actor, body, {
      groups: firestoreGroupRepo,
      attendance: firestoreAttendanceRepo,
    });
    return NextResponse.json({ id: record.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/attendance] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * GET /api/flexos/attendance?groupId=&date= — tek günün kaydı (Yoklama Al/Detay).
 * GET /api/flexos/attendance?groupId=&month=YYYY-MM — bir grubun aylık kayıtları (takvim/sayaç).
 * Gated `attendance.read`, hedef gruba göre kapsam kontrolü (kendi grubu / org).
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const groupId = req.nextUrl.searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ error: "groupId zorunludur." }, { status: 400 });

  const group = await firestoreGroupRepo.getById(groupId, actor.tenantId);
  if (!group) return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });

  if (!can(actor, "attendance.read", { groupId, ownerUid: group.trainerId })) {
    return NextResponse.json({ error: "Yetki yok: attendance.read" }, { status: 403 });
  }

  const date = req.nextUrl.searchParams.get("date");

  try {
    if (date) {
      const record = await firestoreAttendanceRepo.getByGroupAndDate(groupId, date, actor.tenantId);
      if (!record) return NextResponse.json({ record: null });
      return NextResponse.json({
        record,
        withinEditWindow: isWithinEditWindow(record.date),
      });
    }

    const month = req.nextUrl.searchParams.get("month") ?? undefined;
    const items = await firestoreAttendanceRepo.listByGroup(groupId, actor.tenantId, month);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/attendance GET]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
