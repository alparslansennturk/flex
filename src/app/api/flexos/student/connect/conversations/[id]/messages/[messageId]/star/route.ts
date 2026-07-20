import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { toggleMessageStar } from "@/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string; messageId: string }> }) => {
  const { id, messageId } = await ctx.params;
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { starred?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await toggleMessageStar(principal, id, messageId, !!body.starred, connectDeps);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[student/connect/.../messages/:messageId/star POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
