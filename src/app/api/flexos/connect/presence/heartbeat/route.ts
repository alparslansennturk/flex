import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { firestoreConnectPresenceRepo } from "@/app/lib/server/connect-presence-repo.firestore";
import { heartbeat } from "@/app/lib/domain/services/connect-presence-service";

/** POST /api/flexos/connect/presence/heartbeat — "hâlâ açığım" sinyali (2026-07-20), sadece personel. */
export const POST = withAuth(async (_req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  await heartbeat(principal, firestoreConnectPresenceRepo);
  return NextResponse.json({ ok: true });
});
