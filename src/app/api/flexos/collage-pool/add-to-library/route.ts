import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCollagePoolRepo } from "@/app/lib/server/collage-pool-repo.firestore";
import { firestoreAssignmentTemplateRepo } from "@/app/lib/server/assignment-template-repo.firestore";
import { addTemplateToPersonalLibrary } from "@/app/lib/domain/services/collage-pool-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/collage-pool/add-to-library — body `{globalTemplateId}`.
 * Global oyunlaştırılmış katalog girdisini eğitmenin kişisel kütüphanesine klonlar
 * + kendi bağımsız havuz kopyasını tenant varsayılanından tohumlar (idempotent).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { globalTemplateId: string };
  try {
    body = (await req.json()) as { globalTemplateId: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!body.globalTemplateId) {
    return NextResponse.json({ error: "globalTemplateId zorunludur." }, { status: 400 });
  }

  try {
    const clone = await addTemplateToPersonalLibrary((await actorFromCaller(caller)), body.globalTemplateId, {
      pools: firestoreCollagePoolRepo,
      templates: firestoreAssignmentTemplateRepo,
    });
    return NextResponse.json({ template: clone });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/collage-pool/add-to-library POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
