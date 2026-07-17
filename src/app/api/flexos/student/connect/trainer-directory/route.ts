import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import type { Group } from "@/app/lib/domain/core/group";
import type { Trainer } from "@/app/lib/domain/core/trainer";

/**
 * GET /api/flexos/student/connect/trainer-directory — öğrencinin aktif/tamamlanmış
 * kayıtlarındaki grupların eğitmen(ler)i, dedup edilmiş liste. DM başlatmak için
 * (bkz. FLEX_CONNECT.md) — `connect-service.ts::createConversation`'daki öğrenci
 * DM istisnası da AYNI kayıt setini (aktif/tamamlanmış enrollment → grup → trainerId)
 * server tarafında bağımsız olarak yeniden hesaplar, buradaki listeye güvenmez.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const enrollments = await firestoreEnrollmentRepo.listByPerson(principal.personId!, principal.tenantId);
  const groupIds = [...new Set(enrollments.filter((e) => (e.status === "active" || e.status === "completed") && e.groupId).map((e) => e.groupId!))];
  const groups = (await Promise.all(groupIds.map((id) => firestoreGroupRepo.getById(id, principal.tenantId)))).filter(
    (g): g is Group => !!g,
  );
  const trainerIds = [...new Set(groups.map((g) => g.trainerId).filter((id): id is string => !!id))];
  const trainers = (await Promise.all(trainerIds.map((id) => firestoreTrainerRepo.getById(id, principal.tenantId)))).filter(
    (t): t is Trainer => !!t && !!t.authUid,
  );

  return NextResponse.json({ items: trainers.map((t) => ({ uid: t.authUid!, name: t.name })) });
});
