import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { buildConversationViews } from "@/app/lib/server/connect-view";
import {
  createConversation,
  listConversationsForPrincipal,
  type CreateConversationInput,
} from "@/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * GET /api/flexos/connect/conversations — çağıranın (personel) konuşma listesi.
 * POST /api/flexos/connect/conversations — yeni kanal/grup/dm/topluluk oluştur.
 *
 * Personel route ailesi (`/api/flexos/connect/*`) — öğrenci tarafı AYRI:
 * `/api/flexos/student/connect/*` (personId+authUid, bkz. connect-principal.ts).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const items = await listConversationsForPrincipal(principal, connectDeps);
  const views = await buildConversationViews(items, principal.uid, principal.tenantId);
  return NextResponse.json({ items: views });
});

export const POST = withAuth(async (req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: CreateConversationInput;
  try {
    body = (await req.json()) as CreateConversationInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const conversation = await createConversation(principal, body, connectDeps);
    return NextResponse.json({ id: conversation.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/connect/conversations POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
