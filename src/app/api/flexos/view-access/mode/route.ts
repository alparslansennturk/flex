import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller, primeViewModeCache } from "@/app/lib/server/auth-actor";
import { firestoreViewModeRepo } from "@/app/lib/server/view-mode-repo.firestore";
import { setViewMode } from "@/app/lib/domain/services/view-access-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/view-access/mode — görünüm modunu (Core/Full) sunucuda kalıcı
 * yapar. Body: { mode: "core" | "full" }. `view.toggle` gated. Core→Full için
 * client bu uca gelmeden önce zaten /verify ile PIN doğrulamış olmalı.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { mode?: string };
  try { body = (await req.json()) as { mode?: string }; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  if (body.mode !== "core" && body.mode !== "full") {
    return NextResponse.json({ error: "mode 'core' veya 'full' olmalı." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);
  try {
    await setViewMode(actor, body.mode, firestoreViewModeRepo);
    primeViewModeCache(body.mode); // TTL beklemeden bu instance'ta anında yansısın
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/view-access/mode POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
