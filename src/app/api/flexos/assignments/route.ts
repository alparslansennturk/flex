import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can, widestScope, ownerMatches } from "@/app/lib/domain/access/can";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAssignmentTemplateRepo } from "@/app/lib/server/assignment-template-repo.firestore";
import { assignTask, type AssignTaskInput } from "@/app/lib/domain/services/assignment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * GET /api/flexos/assignments?groupId=... — ödev listesi (kiracıya göre, opsiyonel grup filtresi).
 * Assigned-scope aktör (eğitmen) `groupId` ne olursa olsun SADECE kendi ödevlerini görür —
 * `groups/route.ts`'teki `trainerId` zorlama deseniyle aynı (client'a güvenilmez).
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "assignment.read")) {
    return NextResponse.json({ error: "Yetki yok: assignment.read" }, { status: 403 });
  }

  const groupId = req.nextUrl.searchParams.get("groupId") ?? undefined;
  const isOrgScope = widestScope(actor, "assignment.read") === "org";

  try {
    let items = await firestoreAssignmentRepo.list(actor.tenantId, groupId);
    if (!isOrgScope) items = items.filter((a) => ownerMatches(actor, a.trainerId));
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/assignments GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * POST /api/flexos/assignments — yeni ödev oluştur/ata (gated `assignment.create`).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: AssignTaskInput;
  try {
    body = (await req.json()) as AssignTaskInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const assignment = await assignTask(actor, body, firestoreAssignmentRepo, {
      groups: firestoreGroupRepo,
      templates: firestoreAssignmentTemplateRepo,
    });
    return NextResponse.json({ id: assignment.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/assignments POST] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
