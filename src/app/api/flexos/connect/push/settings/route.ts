import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { firestoreConnectPushRepo } from "@/app/lib/server/connect-push-repo.firestore";
import { getPushSettings, setNotificationsEnabled, setSoundEnabled } from "@/app/lib/domain/services/connect-push-service";

/**
 * GET /api/flexos/connect/push/settings — genel bildirim tercihini oku.
 * POST /api/flexos/connect/push/settings — aç/kapat (+ opsiyonel `soundEnabled`,
 * 2026-07-20 — bildirim sesi, bildirimin kendisinden bağımsız, varsayılan kapalı).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const settings = await getPushSettings(principal, firestoreConnectPushRepo);
  return NextResponse.json(settings);
});

export const POST = withAuth(async (req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { enabled?: boolean; soundEnabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (body.soundEnabled !== undefined) {
    await setSoundEnabled(principal, !!body.soundEnabled, firestoreConnectPushRepo);
  } else {
    await setNotificationsEnabled(principal, !!body.enabled, firestoreConnectPushRepo);
  }
  return NextResponse.json({ ok: true });
});
