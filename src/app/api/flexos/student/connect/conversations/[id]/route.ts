import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { resolveConnectIdentities } from "@/app/lib/server/connect-identity";
import { getConversation, listMembers } from "@/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** GET /api/flexos/student/connect/conversations/[id]?personId=... — "Bilgi" paneli için. */
export const GET = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    const conversation = await getConversation(principal, id, connectDeps);
    const members = await listMembers(principal, id, connectDeps);
    const identities = await resolveConnectIdentities(members.map((m) => m.uid), principal.tenantId);
    return NextResponse.json({
      item: conversation,
      members: members.map((m) => ({ ...m, name: identities[m.uid]?.name, colorKey: identities[m.uid]?.colorKey })),
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[flexos/student/connect/conversations/:id GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
