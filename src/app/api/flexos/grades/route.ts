import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { widestScope } from "@/app/lib/domain/access/can";
import { firestoreGradeRepo } from "@/app/lib/server/grade-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { saveGrades, getGradesByGroup, type SaveGradesInput } from "@/app/lib/domain/services/grade-service";
import { computeOdevYuzdeleri } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * GET /api/flexos/grades?groupId=... — grubun notlarını getirir (gated `grade.read`).
 * `odev` alanı Ödev Notu'nun HAM girdisidir — `{normal, proje}` iki kategoriye ayrılmış
 * (`{totalMaxPuan, earnedByPerson}`, `computeOdevYuzdeleri`) — 2026-07-06 kararıyla manuel
 * `assignmentScore` kaldırıldı; nihai yüzde `combineOdevYuzdesi()` ile (normal %30 +
 * proje %70 ağırlıklı) istemcide/tüketen ekranda türetilir.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const groupId = req.nextUrl.searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ error: "groupId zorunlu." }, { status: 400 });

  try {
    const actor = actorFromCaller(caller);
    const [items, odev] = await Promise.all([
      getGradesByGroup(actor, groupId, { grades: firestoreGradeRepo, groups: firestoreGroupRepo }),
      computeOdevYuzdeleri(actor.tenantId, groupId, { assignments: firestoreAssignmentRepo, submissions: firestoreSubmissionRepo }),
    ]);
    // Kilit KİŞİ-bazlı (`items[].locked` — ör. sertifikası basılmış biri), grup-genelinde
    // DEĞİL (2026-07-08 kararı: roster gerçekte tek seferde değil, kişi kişi doldurulur).
    // `canOverrideLock` true ise (org scope/yetkili) kilit o aktörü hiç bağlamaz.
    const canOverrideLock = widestScope(actor, "grade.write") === "org";
    return NextResponse.json({ items, odev, canOverrideLock });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/grades GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * POST /api/flexos/grades — grup için notları toplu kaydet (taslak; gated `grade.write`).
 * Body: `{ groupId, entries: [{ enrollmentId, personId, projectGrade? }] }` — Ödev Notu
 * ARTIK BURADAN YAZILMAZ (bkz. `Submission.grade` + `submission.grade` capability).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: SaveGradesInput;
  try {
    body = (await req.json()) as SaveGradesInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const items = await saveGrades(actorFromCaller(caller), body, {
      grades: firestoreGradeRepo,
      groups: firestoreGroupRepo,
    });
    return NextResponse.json({ items }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/grades POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
