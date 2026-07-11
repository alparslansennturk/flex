import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { firestoreCaseRepo } from "@/app/lib/server/case-repo.firestore";
import { firestoreActivityRepo } from "@/app/lib/server/activity-repo.firestore";
import { firestoreAppointmentRepo } from "@/app/lib/server/appointment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { addActivity, type AddActivityInput } from "@/app/lib/domain/services/case-service";
import { broadcast } from "@/app/lib/server/realtime-hub";

const RECENT_LIMIT = 30;

/**
 * GET /api/flexos/activities — son aktiviteler (tüm taleplerden, kişi adı join'li).
 * Satış Dashboard'daki "Canlı Aktivite Akışı" kartı için.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "activity.read")) {
    return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
  }

  // Query-seviyesinde limit(30) — tam koleksiyon taraması yok (önceki `list()+slice()`
  // her poll'da tüm koleksiyonu okuyordu, 20sn'lik client polling ile maliyeti katlıyordu).
  const recent = await firestoreActivityRepo.listRecent(actor.tenantId, RECENT_LIMIT);
  // Kişi başına ayrı getById() yerine (N+1) ama tüm koleksiyon yerine sadece
  // referans verilen kişiler tek "in" sorgusuyla (en fazla 30 id).
  const personIds = [...new Set(recent.map((a) => a.personId))];
  const persons = await firestorePersonRepo.getByIds(personIds, actor.tenantId);
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const items = recent.map((a) => ({
    id: a.id,
    caseId: a.caseId,
    personId: a.personId,
    personName: personMap.get(a.personId)
      ? `${personMap.get(a.personId)!.firstName} ${personMap.get(a.personId)!.lastName}`
      : "—",
    type: a.type,
    note: a.note ?? null,
    createdAt: a.createdAt,
  }));

  return NextResponse.json({ items });
});

/**
 * POST /api/flexos/activities — mevcut talebe aktivite ekle.
 * Randevu oluşturma + talep kapatma da bu endpoint üzerinden yapılır.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: AddActivityInput;
  try {
    body = (await req.json()) as AddActivityInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    const result = await addActivity(actor, body, {
      cases: firestoreCaseRepo,
      activities: firestoreActivityRepo,
      appointments: firestoreAppointmentRepo,
    });

    broadcast(actor.tenantId, { type: "activities.changed", id: result.activity.id });
    return NextResponse.json(
      {
        activityId: result.activity.id,
        appointmentId: result.appointment?.id ?? null,
        caseStatus: result.updatedCase.status,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/activities POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
