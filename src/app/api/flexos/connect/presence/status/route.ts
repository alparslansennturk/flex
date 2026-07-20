import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { firestoreConnectPresenceRepo } from "@/app/lib/server/connect-presence-repo.firestore";
import { setPresenceStatus } from "@/app/lib/domain/services/connect-presence-service";
import type { ConnectPresenceStatus } from "@/app/lib/domain/core/connect-presence";

const VALID: ConnectPresenceStatus[] = ["online", "in_class", "dnd"];

/** POST /api/flexos/connect/presence/status — manuel durum seçimi (2026-07-20), sadece personel. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!body.status || !VALID.includes(body.status as ConnectPresenceStatus)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  await setPresenceStatus(principal, body.status as ConnectPresenceStatus, firestoreConnectPresenceRepo);
  return NextResponse.json({ ok: true });
});
