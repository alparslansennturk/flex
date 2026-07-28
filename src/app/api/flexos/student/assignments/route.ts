import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { listAssignmentsForStudent } from "@/app/lib/domain/services/submission-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/student/assignments?personId=... — dashboard: yayınlanmış ödevler + kendi teslim durumu. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    const items = await listAssignmentsForStudent(caller.uid, DEFAULT_TENANT, personId, {
      persons: firestorePersonRepo,
      enrollments: firestoreEnrollmentRepo,
      assignments: firestoreAssignmentRepo,
      submissions: firestoreSubmissionRepo,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/student/assignments");
  }
});
