import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreLessonExceptionRepo } from "@/app/lib/server/lesson-exception-repo.firestore";
import { saveLessonException, getLessonException, type SaveLessonExceptionInput } from "@/app/lib/domain/services/lesson-exception-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/lesson-exceptions — "Ders Olmadı" kaydet. Gated `attendance.write`
 * (scope="system" için org-scope zorunlu). Öğrenci-kaynaklıysa otomatik devamsızlık yazar.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: SaveLessonExceptionInput;
  try { body = (await req.json()) as SaveLessonExceptionInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  try {
    const ex = await saveLessonException(actorFromCaller(caller), body, {
      groups: firestoreGroupRepo,
      exceptions: firestoreLessonExceptionRepo,
      attendance: firestoreAttendanceRepo,
      enrollments: firestoreEnrollmentRepo,
    });
    return NextResponse.json({ id: ex.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/lesson-exceptions POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * GET /api/flexos/lesson-exceptions?groupId=&date= — o gün için geçerli istisna
 * (önce grup-özel, yoksa sistem-geneli). `attendance.read` gated.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const groupId = req.nextUrl.searchParams.get("groupId");
  const date = req.nextUrl.searchParams.get("date");
  if (!groupId || !date) return NextResponse.json({ error: "groupId ve date zorunludur." }, { status: 400 });

  const { can } = await import("@/app/lib/domain/access/can");
  const group = await firestoreGroupRepo.getById(groupId, actor.tenantId);
  if (!group) return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });
  if (!can(actor, "attendance.read", { groupId, ownerUid: group.trainerId })) {
    return NextResponse.json({ error: "Yetki yok: attendance.read" }, { status: 403 });
  }

  const exception = await getLessonException(groupId, date, actor.tenantId, firestoreLessonExceptionRepo);
  return NextResponse.json({ exception });
});
