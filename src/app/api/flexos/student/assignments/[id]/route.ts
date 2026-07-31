import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreSubmissionFileRepo } from "@/app/lib/server/submission-file-repo.firestore";
import { getAssignmentForStudent } from "@/app/lib/domain/services/submission-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/student/assignments/[id]?personId=... — ödev detay + kendi teslim geçmişi. */
export const GET = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    const result = await getAssignmentForStudent(caller.uid, DEFAULT_TENANT, personId, id, {
      persons: firestorePersonRepo,
      enrollments: firestoreEnrollmentRepo,
      assignments: firestoreAssignmentRepo,
      submissions: firestoreSubmissionRepo,
      submissionFiles: firestoreSubmissionFileRepo,
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e, "flexos/student/assignments/[id]");
  }
});
