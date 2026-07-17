import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { buildConversationViews } from "@/app/lib/server/connect-view";
import { listConversationsForPrincipal } from "@/app/lib/domain/services/connect-service";

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
  const views = await buildConversationViews(items, principal.uid, principal.tenantId);
  return NextResponse.json({ items: views });
});
