import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { firestoreConnectPushRepo } from "@/app/lib/server/connect-push-repo.firestore";
import { registerPushToken } from "@/app/lib/domain/services/connect-push-service";

/** POST /api/flexos/connect/push/register — FCM token kaydet (cihaz başına). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!body.token) return NextResponse.json({ error: "token gerekli." }, { status: 400 });

  await registerPushToken(principal, body.token, firestoreConnectPushRepo);
  return NextResponse.json({ ok: true });
});
