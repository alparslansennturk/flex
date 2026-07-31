import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreLotteryResultRepo } from "@/app/lib/server/lottery-result-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { getLotteryResult, saveDraw, type SaveDrawInput } from "@/app/lib/domain/services/lottery-service";
import { apiError } from "@/app/lib/server/api-error";

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
    const result = await getLotteryResult((await actorFromCaller(caller)), assignmentId, deps);
    return NextResponse.json({ result });
  } catch (e) {
    return apiError(e, "flexos/lottery-results");
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
    const result = await saveDraw((await actorFromCaller(caller)), body, deps);
    return NextResponse.json({ result });
  } catch (e) {
    return apiError(e, "flexos/lottery-results");
  }
});
