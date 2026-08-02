import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCollagePoolRepo } from "@/app/lib/server/collage-pool-repo.firestore";
import { getMyCollagePool, updateMyCollagePool } from "@/app/lib/domain/services/collage-pool-service";
import { apiError } from "@/app/lib/server/api-error";
import type { CollageItem } from "@/app/lib/domain/core/collage-pool";

/** GET /api/flexos/collage-pool — eğitmenin KENDİ havuz kopyası (yoksa `pool: null`). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const pool = await getMyCollagePool((await actorFromCaller(caller)), firestoreCollagePoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    return apiError(e, "flexos/collage-pool GET");
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
    const pool = await updateMyCollagePool((await actorFromCaller(caller)), body.items ?? [], firestoreCollagePoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    return apiError(e, "flexos/collage-pool PATCH");
  }
});
