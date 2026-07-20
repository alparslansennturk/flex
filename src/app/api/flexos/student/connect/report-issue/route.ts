import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { firestoreCaseRepo } from "@/app/lib/server/case-repo.firestore";
import { firestoreActivityRepo } from "@/app/lib/server/activity-repo.firestore";
import { reportStudentIssue } from "@/app/lib/domain/services/case-service";
import { ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

/**
 * POST /api/flexos/student/connect/report-issue — Flex Connect Mobil "Sorun Bildir" /
 * "Öneri Gönder" (2026-07-20). Aktivite Merkezi'ne "destek" talebi olarak düşer,
 * `case.create` yetkisi GEREKMEZ (öğrencinin kendi personId'sine dar kapsamlı
 * self-servis eylem — bkz. `reportStudentIssue` yorumu).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal || !principal.personId) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { kind?: "sorun" | "oneri"; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (body.kind !== "sorun" && body.kind !== "oneri") {
    return NextResponse.json({ error: "kind gerekli." }, { status: 400 });
  }
  if (!body.message) return NextResponse.json({ error: "message gerekli." }, { status: 400 });

  try {
    const result = await reportStudentIssue(
      principal.tenantId,
      principal.personId,
      principal.uid,
      body.kind,
      body.message,
      { cases: firestoreCaseRepo, activities: firestoreActivityRepo },
    );
    broadcast(principal.tenantId, { type: "activities.changed", id: result.caseId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[student/connect/report-issue POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
