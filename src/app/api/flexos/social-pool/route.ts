import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSocialPoolRepo } from "@/app/lib/server/social-pool-repo.firestore";
import { getMySocialPool, updateMySocialPool, type SocialPoolData } from "@/app/lib/domain/services/social-pool-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** GET /api/flexos/social-pool — eğitmenin KENDİ havuz kopyası (yoksa `pool: null`). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const pool = await getMySocialPool((await actorFromCaller(caller)), firestoreSocialPoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    console.error("[flexos/social-pool GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** PATCH /api/flexos/social-pool — eğitmenin kendi havuzunu yeniden yazar (body: `{brands,sectors,formats,globalPurposes,sharedRule}`). */
export const PATCH = withAuth(async (req: NextRequest, caller) => {
  let body: Partial<SocialPoolData>;
  try {
    body = (await req.json()) as Partial<SocialPoolData>;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const data: SocialPoolData = {
      brands: body.brands ?? [],
      sectors: body.sectors ?? [],
      formats: body.formats ?? [],
      globalPurposes: body.globalPurposes ?? [],
      sharedRule: body.sharedRule ?? "",
    };
    const pool = await updateMySocialPool((await actorFromCaller(caller)), data, firestoreSocialPoolRepo);
    return NextResponse.json({ pool });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/social-pool PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
