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
  const actor = await actorFromCaller(caller);
  if (!can(actor, "appointment.read")) {
    return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
  }

  // Kişi başına ayrı getById() yerine (N+1 Firestore round-trip) tek list() + bellekte join —
  // sales/route.ts'teki desenle aynı, veri büyüdükçe fark yaratır.
  const [appointments, persons] = await Promise.all([
    firestoreAppointmentRepo.list(actor.tenantId),
    firestorePersonRepo.list(actor.tenantId),
  ]);
  const personMap = new Map(persons.map((p) => [p.id, p]));
  // `cases/route.ts`'teki AYNI PII gating — telefon sadece bu yetkiye sahip roller görür.
  const showPII = can(actor, "person.read.pii");

  const items = appointments.map((a) => {
    const person = personMap.get(a.personId);
    return {
      id: a.id,
      caseId: a.caseId,
      personId: a.personId,
      personName: person ? `${person.firstName} ${person.lastName}` : "—",
      personPhone: showPII ? (person?.pii?.phone ?? null) : null,
      scheduledAt: a.scheduledAt,
      note: a.note ?? null,
      status: a.status,
      assignedToName: a.assignedToName ?? null,
      // Eski kayıtlarda yok — Randevu Takvimi bu alanı YOKSA "telefon" varsayar.
      meetingType: a.meetingType ?? "telefon",
    };
  });

  return NextResponse.json({ items });
});
