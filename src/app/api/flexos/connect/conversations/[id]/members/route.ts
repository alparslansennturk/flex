import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller, extractConnectRequestMeta } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { resolveConnectIdentities } from "@/app/lib/server/connect-identity";
import { addMember, listMembers, removeMember } from "@/app/lib/domain/services/connect-service";
import type { ConnectMemberRole } from "@/app/lib/domain/core/connect";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    const members = await listMembers(principal, id, connectDeps);
    const identities = await resolveConnectIdentities(members.map((m) => m.uid), principal.tenantId);
    return NextResponse.json({
      items: members.map((m) => ({ ...m, name: identities[m.uid]?.name, colorKey: identities[m.uid]?.colorKey })),
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[flexos/connect/conversations/:id/members GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { uid?: string; role?: ConnectMemberRole; guestTitle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!body.uid) return NextResponse.json({ error: "uid zorunlu." }, { status: 400 });

  try {
    await addMember(principal, id, body.uid, body.role ?? "member", connectDeps, extractConnectRequestMeta(req), body.guestTitle);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/connect/conversations/:id/members POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const targetUid = req.nextUrl.searchParams.get("uid");
  if (!targetUid) return NextResponse.json({ error: "uid zorunlu." }, { status: 400 });

  try {
    await removeMember(principal, id, targetUid, connectDeps, extractConnectRequestMeta(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/connect/conversations/:id/members DELETE] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
