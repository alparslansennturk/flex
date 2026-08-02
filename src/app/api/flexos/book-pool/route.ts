import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBookPoolRepo } from "@/app/lib/server/book-pool-repo.firestore";
import { getMyBookPool, updateMyBookPool } from "@/app/lib/domain/services/book-pool-service";
import { apiError } from "@/app/lib/server/api-error";
import type { BookItem } from "@/app/lib/domain/core/book-pool";

/** GET /api/flexos/book-pool — eğitmenin KENDİ havuz kopyası (yoksa `pool: null`). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const pool = await getMyBookPool((await actorFromCaller(caller)), firestoreBookPoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    return apiError(e, "flexos/book-pool GET");
  }
});

/** PATCH /api/flexos/book-pool — eğitmenin kendi havuzunu yeniden yazar (body: `{items}`). */
export const PATCH = withAuth(async (req: NextRequest, caller) => {
  let body: { items: BookItem[] };
  try {
    body = (await req.json()) as { items: BookItem[] };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const pool = await updateMyBookPool((await actorFromCaller(caller)), body.items ?? [], firestoreBookPoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    return apiError(e, "flexos/book-pool PATCH");
  }
});
