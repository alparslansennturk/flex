import type { ConnectMessage } from "../core/connect";
import type { ConnectPushRepo } from "../repo/connect-push-repo";
import type { ConnectPrincipal, ConnectDeps } from "./connect-service";
import { resolveDisplayName } from "./connect-service";

export async function registerPushToken(principal: ConnectPrincipal, token: string, pushRepo: ConnectPushRepo): Promise<void> {
  if (!token) return;
  await pushRepo.addToken(principal.uid, principal.tenantId, token);
}

export async function unregisterPushToken(principal: ConnectPrincipal, token: string, pushRepo: ConnectPushRepo): Promise<void> {
  if (!token) return;
  await pushRepo.removeToken(principal.uid, token);
}

export async function setNotificationsEnabled(principal: ConnectPrincipal, enabled: boolean, pushRepo: ConnectPushRepo): Promise<void> {
  await pushRepo.setNotificationsEnabled(principal.uid, principal.tenantId, enabled);
}

/** Bildirim SESİ (2026-07-20) — varsayılan KAPALI, bildirimin kendisinden bağımsız açılıp kapatılır. */
export async function setSoundEnabled(principal: ConnectPrincipal, enabled: boolean, pushRepo: ConnectPushRepo): Promise<void> {
  await pushRepo.setSoundEnabled(principal.uid, principal.tenantId, enabled);
}

export async function getPushSettings(principal: ConnectPrincipal, pushRepo: ConnectPushRepo): Promise<{ notificationsEnabled: boolean; soundEnabled: boolean }> {
  const sub = await pushRepo.getSubscription(principal.uid);
  return { notificationsEnabled: sub?.notificationsEnabled ?? false, soundEnabled: sub?.soundEnabled ?? false };
}

/**
 * Yeni mesaj push+badge bildirimi (2026-07-19) — `sendMessage` başarılı olduktan
 * SONRA route katmanından çağrılır, `logAudit`/`notifyUser` ile AYNI ilke:
 * best-effort, asla asıl mesaj gönderimini bloklamaz/başarısız kılmaz.
 *
 * BİLEREK "data-only" FCM mesajı gönderiyoruz (`notification` alanı YOK) — üstte
 * `notification` olsaydı FCM arka planda kendi bildirimini OTOMATİK gösterip bizim
 * `sw-connect-mobile.js`'teki `push` handler'ını (badge güncelleme + özel tıklama
 * davranışı) hiç ÇALIŞTIRMAYABİLİRDİ. Data-only ile handler HER ZAMAN tetiklenir.
 */
export async function notifyNewMessage(
  conversationId: string,
  message: ConnectMessage,
  senderUid: string,
  tenantId: string,
  deps: ConnectDeps,
  pushRepo: ConnectPushRepo,
): Promise<void> {
  try {
    const conversation = await deps.conversations.getConversationById(conversationId, tenantId);
    if (!conversation) return;

    const members = await deps.conversations.listMembers(conversationId);
    const recipients = members.filter((m) => m.uid !== senderUid && !m.muted);
    if (recipients.length === 0) return;

    const senderName = await resolveDisplayName(senderUid, tenantId, deps);
    const bodyText = message.text || (message.attachments?.length ? `📎 ${message.attachments[0].fileName}` : "");
    const isDm = conversation.type === "dm";
    const title = isDm ? senderName : conversation.name || "Flex Connect";
    const body = isDm ? bodyText : `${senderName}: ${bodyText}`;

    await Promise.all(
      recipients.map(async (recipient) => {
        // Ana FlexOS bildirim zili/toast'ı (2026-07-20) — mobil PUSH aboneliğinden
        // BAĞIMSIZ, Connect dışındaki her yerde `NotificationBell`/`NotificationToastListener`
        // zaten dinlediği `users/{uid}/notifications` koleksiyonuna düşer (bkz. `ConnectDeps.notify`).
        const student = await deps.persons.findByAuthUid(recipient.uid, tenantId);
        const actionUrl = student ? `/flexos/student/${student.id}/connect` : "/flexos/connect";
        await deps.notify(recipient.uid, { type: "message", entityId: conversationId, senderId: senderUid, title, preview: body, actionUrl });

        const sub = await pushRepo.getSubscription(recipient.uid);
        if (!sub || !sub.notificationsEnabled || sub.tokens.length === 0) return;

        // Badge = TÜM konuşmalardaki (sessize alınmamış) okunmamış toplamı —
        // `Conversation.messageCount - member.readMessageCount` denormalize
        // alanlarından, mesaj taraması YAPMADAN (bkz. connect.ts:61-64 yorumu).
        const memberships = await deps.conversations.listMembershipsForUid(recipient.uid);
        const activeMemberships = memberships.filter((m) => !m.member.muted);
        const convIds = activeMemberships.map((m) => m.conversationId);
        const convs = await deps.conversations.getConversationsByIds(convIds, tenantId);
        const convById = new Map(convs.map((c) => [c.id, c]));
        const badge = activeMemberships.reduce((sum, m) => {
          const conv = convById.get(m.conversationId);
          if (!conv) return sum;
          return sum + Math.max(0, (conv.messageCount ?? 0) - (m.member.readMessageCount ?? 0));
        }, 0);

        // `silent` — recipient'ın KENDİ ses tercihi (2026-07-20, varsayılan kapalı);
        // SW `showNotification({ silent })`'a geçirir, bildirim yine gösterilir,
        // sadece OS sesi çalmaz.
        const { deadTokens } = await pushRepo.sendPush(sub.tokens, {
          title, body, conversationId, badge: String(badge), silent: String(!sub.soundEnabled),
        });
        await Promise.all(deadTokens.map((t) => pushRepo.removeToken(recipient.uid, t)));
      }),
    );
  } catch (e) {
    console.error("[connect-push] notifyNewMessage hatası (non-fatal):", e);
  }
}
