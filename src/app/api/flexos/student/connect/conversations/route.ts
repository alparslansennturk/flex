import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { buildConversationViews } from "@/app/lib/server/connect-view";
import { createConversation, listConversationsForPrincipal, markDeliveredFromList, type CreateConversationInput } from "@/app/lib/domain/services/connect-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * GET /api/flexos/student/connect/conversations?personId=... — öğrencinin konuşma
 * listesi. Personel (`staff` realm) HİÇBİR KOŞULDA dönmez — servis katmanında
 * (`listConversationsForPrincipal`) realm filtresi zaten uygulanıyor, burada SADECE
 * kimlik `personId`+`authUid` eşleşmesiyle doğrulanıyor (diğer öğrenci route'larıyla
 * AYNI desen, Actor/capability sistemi YOK).
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const items = await listConversationsForPrincipal(principal, connectDeps);
  await markDeliveredFromList(principal, items, connectDeps);
  const views = await buildConversationViews(items, principal.uid, principal.tenantId);
  return NextResponse.json({ items: views });
});

/**
 * POST — öğrenci TEK istisna olarak KENDİ eğitmenine DM başlatabilir (2026-07-18
 * kullanıcı isteği: "Eğitmenlerim" dizininden birine tıklayınca). Servis katmanı
 * (`createConversation`) bunu client'a güvenmeden kendi enrollment/grup kayıtlarından
 * doğrular — burada sadece body geçiriliyor.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const principal = await studentPrincipalFromRequest(req, caller);
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
    return apiError(e, "flexos/student/connect/conversations");
  }
});
