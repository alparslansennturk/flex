import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";

/**
 * GET /api/flexos/connect/student-directory — eğitmenin KENDİ gruplarındaki
 * (`Group.trainerId === principal.trainerId`) tüm öğrencileri (authUid'i olan,
 * yani giriş yapabilen), dedup edilmiş tek liste. `/connect/directory`'nin
 * (personel dizini) öğrenci karşılığı — DM başlatmak için (bkz. FLEX_CONNECT.md).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
  if (!principal.trainerId) return NextResponse.json({ items: [] });

  const groups = await firestoreGroupRepo.list(principal.tenantId, principal.trainerId);
  const rosters = await Promise.all(groups.map((g) => firestoreEnrollmentRepo.listByGroup(g.id, principal.tenantId)));
  const persons = await firestorePersonRepo.list(principal.tenantId);
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const seen = new Set<string>();
  const items: { uid: string; name: string }[] = [];
  for (const enrollments of rosters) {
    for (const e of enrollments) {
      if (e.status !== "active" && e.status !== "completed") continue;
      const p = personMap.get(e.personId);
      if (!p?.authUid || seen.has(p.authUid)) continue;
      seen.add(p.authUid);
      items.push({ uid: p.authUid, name: `${p.firstName} ${p.lastName}`.trim() });
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return NextResponse.json({ items });
});
