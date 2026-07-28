import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller, extractConnectRequestMeta } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { buildConversationViews } from "@/app/lib/server/connect-view";
import {
  createConversation,
  listConversationsForPrincipal,
  markDeliveredFromList,
  type CreateConversationInput,
} from "@/app/lib/domain/services/connect-service";
import { apiError } from "@/app/lib/server/api-error";

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
  // Serverless'te fonksiyon yanıt sonrası hemen sonlanabileceğinden fire-and-forget
  // GÜVENLİ DEĞİL — await edilir (kendi içinde non-fatal, hata fırlatmaz).
  await markDeliveredFromList(principal, items, connectDeps);
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
    const conversation = await createConversation(principal, body, connectDeps, extractConnectRequestMeta(req));
    return NextResponse.json({ id: conversation.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/connect/conversations");
  }
});
