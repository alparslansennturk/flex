import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { firestoreConnectPresenceRepo } from "@/app/lib/server/connect-presence-repo.firestore";
import { heartbeat } from "@/app/lib/domain/services/connect-presence-service";

/** POST /api/flexos/student/connect/presence/heartbeat — "hâlâ açığım" sinyali (2026-07-20).
 * Öğrenciler için basit otomatik çevrimiçi/çevrimdışı — manuel durum seçimi YOK. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  await heartbeat(principal, firestoreConnectPresenceRepo);
  return NextResponse.json({ ok: true });
});
