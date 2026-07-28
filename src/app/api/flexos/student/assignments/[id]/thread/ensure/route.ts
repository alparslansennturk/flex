import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreChatRepo } from "@/app/lib/server/chat-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { ensureThreadChatForStudent } from "@/app/lib/domain/services/comment-service";
import { apiError } from "@/app/lib/server/api-error";

const deps = {
  assignments: firestoreAssignmentRepo,
  groups: firestoreGroupRepo,
  persons: firestorePersonRepo,
  enrollments: firestoreEnrollmentRepo,
  chats: firestoreChatRepo,
  trainers: firestoreTrainerRepo,
};

/**
 * POST /api/flexos/student/assignments/[id]/thread/ensure?personId=... — öğrenci sayfası
 * mount olduğunda (ilk mesajdan ÖNCE) `chats/{chatId}` dokümanını garanti eder.
 */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    await ensureThreadChatForStudent(caller.uid, DEFAULT_TENANT, personId, id, deps);
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e, "flexos/student/assignments/[id]/thread/ensure");
  }
});
