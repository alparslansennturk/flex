import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";

/** GET /api/flexos/student/me?personId=... — kişi + aktif grup bilgisi (header/sidebar için). */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  const person = await firestorePersonRepo.getById(personId, DEFAULT_TENANT);
  if (!person) return NextResponse.json({ error: "Kişi bulunamadı." }, { status: 400 });
  if (person.authUid !== caller.uid) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const enrollments = await firestoreEnrollmentRepo.listByPerson(personId, DEFAULT_TENANT);
  const activeEnrollment = enrollments.find((e) => e.status === "active" && e.groupId);
  const group = activeEnrollment?.groupId
    ? await firestoreGroupRepo.getById(activeEnrollment.groupId, DEFAULT_TENANT)
    : null;

  return NextResponse.json({
    person: { firstName: person.firstName, lastName: person.lastName },
    group: group ? { id: group.id, code: group.code } : null,
  });
});
