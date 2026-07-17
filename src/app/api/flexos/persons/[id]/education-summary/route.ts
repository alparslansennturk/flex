import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEducationRepo, firestoreSectionRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { firestoreGradeRepo } from "@/app/lib/server/grade-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreCertificateSettingsRepo } from "@/app/lib/server/certificate-settings-repo.firestore";
import { firestoreHolidayRepo } from "@/app/lib/server/holiday-repo.firestore";
import { getEducationSummaryForPerson } from "@/app/lib/domain/services/person-education-summary-service";
import { ForbiddenError } from "@/app/lib/domain/errors";

/**
 * GET /api/flexos/persons/[id]/education-summary — Öğrenci Detay (sayfa+modal)
 * "Eğitim Bilgileri" sekmesi: kişinin TÜM enrollment'ları (her modül/branş), her biri
 * için yoklama % + sertifika notu özeti. `persons/[id]` route'una KASITLI eklenmedi —
 * ayrı, composable uç (bkz. person-education-summary-service.ts).
 */
export const GET = withAuth(async (_req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);

  try {
    const result = await getEducationSummaryForPerson(actor, id, {
      enrollments: firestoreEnrollmentRepo,
      persons: firestorePersonRepo,
      groups: firestoreGroupRepo,
      educations: firestoreEducationRepo,
      sections: firestoreSectionRepo,
      trainers: firestoreTrainerRepo,
      attendance: firestoreAttendanceRepo,
      grades: firestoreGradeRepo,
      assignments: firestoreAssignmentRepo,
      submissions: firestoreSubmissionRepo,
      certificateSettings: firestoreCertificateSettingsRepo,
      holidays: firestoreHolidayRepo,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    console.error("[flexos/persons/[id]/education-summary GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
