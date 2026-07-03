import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreAppointmentRepo } from "@/app/lib/server/appointment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";

/**
 * GET /api/flexos/appointments — tüm randevular (kişi adı join'li).
 * Satış Dashboard'daki "Bugünkü Randevular" kartı için.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  if (!can(actor, "appointment.read")) {
    return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
  }

  const appointments = await firestoreAppointmentRepo.list(actor.tenantId);

  const personIds = [...new Set(appointments.map((a) => a.personId))];
  const persons = await Promise.all(
    personIds.map((id) => firestorePersonRepo.getById(id, actor.tenantId)),
  );
  const personMap = new Map(persons.filter(Boolean).map((p) => [p!.id, p!]));

  const items = appointments.map((a) => {
    const person = personMap.get(a.personId);
    return {
      id: a.id,
      caseId: a.caseId,
      personId: a.personId,
      personName: person ? `${person.firstName} ${person.lastName}` : "—",
      scheduledAt: a.scheduledAt,
      note: a.note ?? null,
      status: a.status,
    };
  });

  return NextResponse.json({ items });
});
