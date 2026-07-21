import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreActivityLogRepo } from "@/app/lib/server/activity-log-repo.firestore";
import { submissionStorage } from "@/app/lib/server/submission-storage";
import { submissionDrive } from "@/app/lib/server/submission-drive";
import { updateAssignment, deleteAssignment, type UpdateAssignmentInput } from "@/app/lib/domain/services/assignment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { notifyAssignmentPublished } from "@/app/lib/server/assignment-mail";
import { invalidateActivityLogCache } from "@/app/api/flexos/egitmen-anasayfa/activity-log/route";

/**
 * GET /api/flexos/assignments/[id] — tekil ödev (ör. `/flexos/kolaj` çekiliş ekranının
 * ihtiyaç duyduğu groupId/gamifiedType/status gibi alanlar için).
 */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  const actor = await actorFromCaller(caller);
  const assignment = await firestoreAssignmentRepo.getById(id, actor.tenantId);
  if (!assignment) return NextResponse.json({ error: "Ödev bulunamadı." }, { status: 404 });

  if (!can(actor, "assignment.read", { groupId: assignment.groupId, ownerUid: assignment.trainerId })) {
    return NextResponse.json({ error: "Yetki yok: assignment.read" }, { status: 403 });
  }
  return NextResponse.json({ item: assignment });
});

/**
 * PATCH /api/flexos/assignments/[id] — ödev güncelle (gated `assignment.edit`).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateAssignmentInput;
  try {
    body = (await req.json()) as UpdateAssignmentInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    // 2026-07-18: "Ödev Oluştur" modalı artık sürüklenen dosyayı HEMEN yüklemek için
    // sessizce bir taslak ödev oluşturuyor (bkz. `OdevOlusturModal.tsx::ensureDraftId`)
    // — o taslağın "Ödevi Başlat"a geçişi de bu PATCH üzerinden olduğu için, POST'taki
    // AYNI yayın yan etkileri (mail + cache invalidation) burada da tetiklenmeli.
    const before = await firestoreAssignmentRepo.getById(id, actor.tenantId);
    const assignment = await updateAssignment(actor, id, body, firestoreAssignmentRepo, {
      activityLog: firestoreActivityLogRepo,
      storage: submissionStorage,
      drive: submissionDrive,
    });
    // Ödev Parkuru (Ana Sayfa) widget'ı bu event'i dinleyip "Notları Kaydet"in arşivlediği
    // (veya "Ödevi Bitir"in kapattığı) ödevleri gerçek zamanlı düşürsün diye. 2026-07-13:
    // BİLEREK "grades.changed" DEĞİL — o TEK öğrenci notu değiştiğinde N kere ateşleniyor
    // (kota fix, bkz. realtime-hub.ts yorumu).
    broadcast(actor.tenantId, { type: "assignments.changed", id: assignment.id });

    let mail: { sent: number; total: number } | undefined;
    if (before && before.status !== "published" && assignment.status === "published") {
      invalidateActivityLogCache(actor.tenantId);
      try {
        mail = await notifyAssignmentPublished(assignment);
      } catch (mailErr) {
        console.error("[flexos/assignments/:id PATCH] mail gönderim hatası:", mailErr);
      }
    }

    return NextResponse.json({ id: assignment.id, mail });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/assignments/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * DELETE /api/flexos/assignments/[id] — ödev sil (gated `assignment.delete`).
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteAssignment((await actorFromCaller(caller)), id, firestoreAssignmentRepo, {
      storage: submissionStorage,
      drive: submissionDrive,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/assignments/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
