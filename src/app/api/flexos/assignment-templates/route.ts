import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import type { Actor } from "@/app/lib/domain/access/types";
import { firestoreAssignmentTemplateRepo } from "@/app/lib/server/assignment-template-repo.firestore";
import { createTemplate, listTemplates, type CreateTemplateInput } from "@/app/lib/domain/services/assignment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { cachedRead, invalidateCache } from "@/app/lib/server/read-cache";

// Şablonlar nadir değişir ama Ana Sayfa'da 2× + katalog ekranlarında çekiliyor — 5dk TTL
// cache tekrarları Firestore'a hiç göndermez (yeni şablon POST'ta invalidate edilir).
const TEMPLATES_CACHE_TTL_MS = 5 * 60_000;

/** bootstrap/route.ts da AYNI fonksiyonu (dolayısıyla aynı cache key'i) kullanır. */
export function fetchTemplatesForActor(actor: Actor) {
  return cachedRead(`templates:${actor.tenantId}:${actor.uid}`, TEMPLATES_CACHE_TTL_MS, () =>
    listTemplates(actor, firestoreAssignmentTemplateRepo),
  );
}

/**
 * GET /api/flexos/assignment-templates — şablon kütüphanesi listesi.
 * Okuma `assignment.read` ile serbest — eğitmen kütüphaneyi görür ama düzenleyemez.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const actor = await actorFromCaller(caller);
    const items = await fetchTemplatesForActor(actor);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    console.error("[flexos/assignment-templates GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * POST /api/flexos/assignment-templates — yeni şablon oluştur (gated `template.manage`,
 * sadece Operasyon/Admin — eğitmen şablon oluşturamaz).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateTemplateInput;
  try {
    body = (await req.json()) as CreateTemplateInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    const template = await createTemplate(actor, body, firestoreAssignmentTemplateRepo);
    invalidateCache(`templates:${actor.tenantId}`); // yeni şablon — tüm kullanıcıların cache'ini düşür
    return NextResponse.json({ id: template.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/assignment-templates POST] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
