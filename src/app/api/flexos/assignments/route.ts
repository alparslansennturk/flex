import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import type { Actor } from "@/app/lib/domain/access/types";
import { can, widestScope } from "@/app/lib/domain/access/can";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAssignmentTemplateRepo } from "@/app/lib/server/assignment-template-repo.firestore";
import { firestoreActivityLogRepo } from "@/app/lib/server/activity-log-repo.firestore";
import { assignTask, type AssignTaskInput } from "@/app/lib/domain/services/assignment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { notifyAssignmentPublished } from "@/app/lib/server/assignment-mail";
import { invalidateActivityLogCache } from "@/app/api/flexos/egitmen-anasayfa/activity-log/route";

/** bootstrap/route.ts da AYNI fonksiyonu çağırır (kod tekrarı yok). */
export async function fetchAssignmentsForActor(actor: Actor, groupId?: string) {
  const isOrgScope = widestScope(actor, "assignment.read") === "org";
  if (isOrgScope) return firestoreAssignmentRepo.list(actor.tenantId, groupId);
  // 2026-07-13 kota fix: tüm kiracıyı okuyup JS'te süzmek yerine SADECE bu eğitmenin
  // ödevleri sorgulanır (`ownerMatches` actor.uid VEYA actor.trainerId eşleşmesiyle AYNI).
  const trainerIds = [actor.uid, actor.trainerId].filter((v): v is string => !!v);
  const items = await firestoreAssignmentRepo.listByTrainerIds(trainerIds, actor.tenantId);
  return groupId ? items.filter((a) => a.groupId === groupId) : items;
}

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

  try {
    const items = await fetchAssignmentsForActor(actor, groupId);
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
      activityLog: firestoreActivityLogRepo,
    });
    if (assignment.status === "published") invalidateActivityLogCache(actor.tenantId);

    // Mail duyurusu SADECE "Ödevi Başlat" (published) için — taslak sessiz kalır.
    // Best-effort: gönderim hatası ödev oluşturmayı asla başarısız kılmaz.
    let mail: { sent: number; total: number } | undefined;
    if (assignment.status === "published") {
      try {
        mail = await notifyAssignmentPublished(assignment);
      } catch (mailErr) {
        console.error("[flexos/assignments POST] mail gönderim hatası:", mailErr);
      }
    }

    return NextResponse.json({ id: assignment.id, mail }, { status: 201 });
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
