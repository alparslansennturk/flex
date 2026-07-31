import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBookPoolRepo } from "@/app/lib/server/book-pool-repo.firestore";
import { firestoreAssignmentTemplateRepo } from "@/app/lib/server/assignment-template-repo.firestore";
import { addBookTemplateToPersonalLibrary } from "@/app/lib/domain/services/book-pool-service";
import { apiError } from "@/app/lib/server/api-error";

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
    const clone = await addBookTemplateToPersonalLibrary((await actorFromCaller(caller)), body.globalTemplateId, {
      pools: firestoreBookPoolRepo,
      templates: firestoreAssignmentTemplateRepo,
    });
    return NextResponse.json({ template: clone });
  } catch (e) {
    return apiError(e, "flexos/book-pool/add-to-library");
  }
});
