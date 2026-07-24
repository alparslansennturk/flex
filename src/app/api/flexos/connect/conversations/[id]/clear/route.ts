import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { clearConversationForMe } from "@/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/connect/conversations/[id]/clear — "Sohbeti Temizle" (2026-07-25,
 * kişisel mesaj geçmişi gizleme, kalıcı silme DEĞİL — bkz. `clearConversationForMe`).
 * "Sohbeti Sil"in aksine konuşma listede kalır. `hideConversationForMe` gibi bu da
 * şimdilik SADECE personel sayfasından çağrılıyor (öğrenci route ailesinde karşılığı yok).
 */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    await clearConversationForMe(principal, id, connectDeps);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[connect/conversations/[id]/clear POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
