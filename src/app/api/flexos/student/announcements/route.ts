import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreCommentRepo } from "@/app/lib/server/comment-repo.firestore";
import { listAnnouncementsForStudent } from "@/app/lib/domain/services/comment-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/student/announcements?personId=... — dashboard "Duyurular" (tüm gruplardaki genel yorumlar). */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    const items = await listAnnouncementsForStudent(caller.uid, DEFAULT_TENANT, personId, {
      persons: firestorePersonRepo,
      enrollments: firestoreEnrollmentRepo,
      assignments: firestoreAssignmentRepo,
      comments: firestoreCommentRepo,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/student/announcements");
  }
});
