import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreLotteryResultRepo } from "@/app/lib/server/lottery-result-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { getLotteryResult, saveDraw, type SaveDrawInput } from "@/app/lib/domain/services/lottery-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

const deps = {
  results: firestoreLotteryResultRepo,
  assignments: firestoreAssignmentRepo,
  groups: firestoreGroupRepo,
  enrollments: firestoreEnrollmentRepo,
};

/** GET /api/flexos/lottery-results?assignmentId=... — çekiliş sonucunu okur. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const assignmentId = req.nextUrl.searchParams.get("assignmentId");
  if (!assignmentId) return NextResponse.json({ error: "assignmentId zorunludur." }, { status: 400 });

  try {
    const result = await getLotteryResult(actorFromCaller(caller), assignmentId, deps);
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/lottery-results GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** POST /api/flexos/lottery-results — bir öğrencinin çekiliş sonucunu kaydeder. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: SaveDrawInput;
  try {
    body = (await req.json()) as SaveDrawInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const result = await saveDraw(actorFromCaller(caller), body, deps);
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/lottery-results POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
