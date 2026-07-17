import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { markRead } from "@/app/lib/domain/services/connect-service";

/** POST /api/flexos/connect/conversations/[id]/read — okundu işaretle (üye değilse no-op). */
export const POST = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  await markRead(principal, id, connectDeps);
  return NextResponse.json({ ok: true });
});
