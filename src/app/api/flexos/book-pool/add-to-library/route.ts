import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBookPoolRepo } from "@/app/lib/server/book-pool-repo.firestore";
import { firestoreAssignmentTemplateRepo } from "@/app/lib/server/assignment-template-repo.firestore";
import { addBookTemplateToPersonalLibrary } from "@/app/lib/domain/services/book-pool-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/book-pool/add-to-library — body `{globalTemplateId}`.
 * Global "Kitap Dünyası" katalog girdisini eğitmenin kişisel kütüphanesine klonlar
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
    const clone = await addBookTemplateToPersonalLibrary(actorFromCaller(caller), body.globalTemplateId, {
      pools: firestoreBookPoolRepo,
      templates: firestoreAssignmentTemplateRepo,
    });
    return NextResponse.json({ template: clone });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/book-pool/add-to-library POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
