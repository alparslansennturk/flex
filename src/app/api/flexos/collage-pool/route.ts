import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCollagePoolRepo } from "@/app/lib/server/collage-pool-repo.firestore";
import { getMyCollagePool, updateMyCollagePool } from "@/app/lib/domain/services/collage-pool-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import type { CollageItem } from "@/app/lib/domain/core/collage-pool";

/** GET /api/flexos/collage-pool — eğitmenin KENDİ havuz kopyası (yoksa `pool: null`). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const pool = await getMyCollagePool(actorFromCaller(caller), firestoreCollagePoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    console.error("[flexos/collage-pool GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** PATCH /api/flexos/collage-pool — eğitmenin kendi havuzunu yeniden yazar (body: `{items}`). */
export const PATCH = withAuth(async (req: NextRequest, caller) => {
  let body: { items: CollageItem[] };
  try {
    body = (await req.json()) as { items: CollageItem[] };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const pool = await updateMyCollagePool(actorFromCaller(caller), body.items ?? [], firestoreCollagePoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/collage-pool PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
