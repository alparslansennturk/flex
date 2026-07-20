import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { hideConversationForMe } from "@/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/connect/conversations/[id]/hide — "Sohbeti Sil" (2026-07-20,
 * kişisel gizleme, kalıcı silme DEĞİL). Öğrenci tarafında karşılığı YOK (yetki
 * kuralı gereği trainer_student DM'lerde sadece personel gizleyebilir).
 */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    await hideConversationForMe(principal, id, connectDeps);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[connect/conversations/[id]/hide POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
