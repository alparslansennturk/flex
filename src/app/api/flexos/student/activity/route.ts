import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { listRecentActivityForStudent } from "@/app/lib/domain/services/submission-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/student/activity?personId=... — "En Son Aktiviteler" paneli: kendi teslim/not hareketleri. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    const items = await listRecentActivityForStudent(caller.uid, DEFAULT_TENANT, personId, {
      persons: firestorePersonRepo,
      enrollments: firestoreEnrollmentRepo,
      assignments: firestoreAssignmentRepo,
      submissions: firestoreSubmissionRepo,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/student/activity");
  }
});
