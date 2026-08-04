import type { ConnectMember, ConnectMemberRole } from "../core/connect";
import type { ConnectRequestMeta } from "../core/connect-audit";
import { ForbiddenError, ValidationError } from "../errors";
import { assertCanRead, assertMembersMatchRealm, insertSystemMessage, logAudit, nowISO, resolveDisplayName } from "./connect-helpers";
import type { ConnectDeps, ConnectPrincipal } from "./connect-types";

/** Üye ekle — SADECE owner/admin. Realm uyuşmazlığı (öğrenci→staff) reddedilir. */
export async function addMember(
  principal: ConnectPrincipal,
  conversationId: string,
  targetUid: string,
  role: ConnectMemberRole,
  deps: ConnectDeps,
  meta?: ConnectRequestMeta,
  /** SADECE role==="guest" (Faz 2 madde 4, 2026-07-18) — tasarımdaki "Yardımcı
   * Eğitmen/Gözlemci/Konuk/Veli" gibi açıklayıcı etiket. Yetki/izolasyonu ETKİLEMEZ,
   * SADECE üye listesinde görünen bir rozet — misafir de normal üye gibi okur/yazar
   * (grubun writePolicy'sine göre), ayrı bir kısıtlı yetki katmanı YOK (kapsam kararı). */
  guestTitle?: string,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  if (!conversation.admins.includes(principal.uid)) throw new ForbiddenError("connect.member.add");

  const kinds = await assertMembersMatchRealm([targetUid], conversation.realm, principal.tenantId, deps);
  const existing = await deps.conversations.getMember(conversationId, targetUid);
  if (existing) return; // zaten üye

  await deps.conversations.saveMember(conversationId, {
    uid: targetUid,
    realm: conversation.realm,
    role,
    kind: kinds.get(targetUid),
    joinedAt: nowISO(),
    guestTitle: role === "guest" ? guestTitle : undefined,
  });

  // "1 kişi gruba eklendi" sistem mesajı (2026-07-20) — SADECE grup, createConversation'ın
  // toplu roster seed'iyle AYNI ilke (bkz. `insertSystemMessage`).
  if (conversation.type === "group") {
    await insertSystemMessage(conversation, 1, deps);
  }

  const targetName = await resolveDisplayName(targetUid, principal.tenantId, deps);
  await logAudit(deps, principal, conversation, "member.add", { targetUid, targetName, metadata: { role, guestTitle }, meta });
}

/** Üye çıkar — owner/admin BAŞKASINI çıkarabilir; herkes KENDİNİ çıkarabilir (ayrıl). */
export async function removeMember(
  principal: ConnectPrincipal,
  conversationId: string,
  targetUid: string,
  deps: ConnectDeps,
  meta?: ConnectRequestMeta,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const isSelf = targetUid === principal.uid;
  if (!isSelf && !conversation.admins.includes(principal.uid)) throw new ForbiddenError("connect.member.remove");
  if (targetUid === conversation.ownerUid) throw new ValidationError("Konuşma sahibi çıkarılamaz.");

  await deps.conversations.deleteMember(conversationId, targetUid);

  const targetName = await resolveDisplayName(targetUid, principal.tenantId, deps);
  await logAudit(deps, principal, conversation, "member.remove", { targetUid, targetName, metadata: { isSelf }, meta });
}

export async function listMembers(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
): Promise<ConnectMember[]> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  assertCanRead(conversation, member);
  return deps.conversations.listMembers(conversationId);
}
