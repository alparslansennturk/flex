import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { widestScope } from "@/app/lib/domain/access/can";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import {
  listSubmissionsForAssignment,
  listSubmissionsForGroup,
} from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * GET /api/flexos/submissions?assignmentId=...|groupId=... — teslim listesi (gated `submission.read`).
 * Assigned-scope aktör (eğitmen) SADECE kendi gruplarının teslimlerini görür —
 * `assignments/route.ts`'teki `trainerId` zorlama deseniyle aynı (client'a güvenilmez).
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const assignmentId = req.nextUrl.searchParams.get("assignmentId") ?? undefined;
  const groupId = req.nextUrl.searchParams.get("groupId") ?? undefined;

  if (!assignmentId && !groupId) {
    return NextResponse.json({ error: "assignmentId veya groupId zorunlu." }, { status: 400 });
  }

  try {
    let items = assignmentId
      ? await listSubmissionsForAssignment(actor, assignmentId, { submissions: firestoreSubmissionRepo })
      : await listSubmissionsForGroup(actor, groupId!, { submissions: firestoreSubmissionRepo });

    const isOrgScope = widestScope(actor, "submission.read") === "org";
    if (!isOrgScope) {
      // `Group.trainerId` eğitmen kadrosu docId'si, actor.uid DEĞİL (bkz. can.ts
      // ownerMatches yorumu) — 2026-07-11 düzeltmesi.
      const ownGroups = await firestoreGroupRepo.list(actor.tenantId, actor.trainerId ?? actor.uid);
      const ownGroupIds = new Set(ownGroups.map((g) => g.id));
      items = items.filter((s) => ownGroupIds.has(s.groupId));
    }

    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
