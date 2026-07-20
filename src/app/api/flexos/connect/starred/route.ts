import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { buildStarredMessageViews } from "@/app/lib/server/connect-view";
import { listStarredMessages } from "@/app/lib/domain/services/connect-service";

/** GET /api/flexos/connect/starred — "Yıldızlı Mesajlarım" (2026-07-20), tüm konuşmalar arası. */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    const items = await listStarredMessages(principal, connectDeps);
    const views = await buildStarredMessageViews(items, principal.uid, principal.tenantId);
    return NextResponse.json({ items: views });
  } catch (e) {
    console.error("[flexos/connect/starred GET] hata:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sunucu hatası." }, { status: 500 });
  }
});
