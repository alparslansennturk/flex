import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller, extractConnectRequestMeta } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { resolveConnectIdentities } from "@/app/lib/server/connect-identity";
import { getConversation, listMembers, updateConversationMeta, deleteConversation } from "@/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { ensureFolderPath, deleteFromDrive } from "@/app/lib/googledrive";

/** GET /api/flexos/connect/conversations/[id] — tekil konuşma + üye özeti (başlık meta'sı için). */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
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
    console.error("[flexos/connect/conversations/:id GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * PATCH /api/flexos/connect/conversations/[id] — ad/açıklama/yayıncı listesi
 * düzenleme (2026-07-18, kalan 2 madde). SADECE personel — konuşma
 * oluşturabilen tek taraf (öğrenci hiçbir zaman owner/admin olamaz, bkz.
 * createConversation'daki "öğrenci oluşturamaz" kısıtı).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { name?: string; description?: string; adminUids?: string[]; childIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const updated = await updateConversationMeta(principal, id, body, connectDeps, extractConnectRequestMeta(req));
    return NextResponse.json({ item: updated });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/connect/conversations/:id PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * DELETE /api/flexos/connect/conversations/[id] — kanal/grup/topluluk silme
 * (2026-07-18, kullanıcı isteği). SADECE owner. Alt-koleksiyonlar servis
 * katmanında `recursiveDelete` ile temizlenir; Drive'daki `Flex Connect/{id}`
 * eki klasörü de best-effort silinir (dosya hiç yoksa zararsız — Drive klasör
 * silme HERKESİN silme işlemini geri almaz, sadece loglanır).
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    await deleteConversation(principal, id, connectDeps, extractConnectRequestMeta(_req));
    try {
      const folderId = await ensureFolderPath(["Flex Connect", id]);
      await deleteFromDrive(folderId);
    } catch (driveErr) {
      console.error("[connect] konuşma silindi ama Drive klasörü silinemedi:", driveErr);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/connect/conversations/:id DELETE] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
