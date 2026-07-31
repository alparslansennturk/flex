import type { ConnectAttachment, ConnectConversation, ConnectMessage } from "../core/connect";
import { ForbiddenError, ValidationError } from "../errors";
import {
  assertCanRead,
  assertCanWrite,
  isAfterHoursStudentToTrainerDm,
  MAX_MESSAGE_LEN,
  nowISO,
  resolveDisplayName,
} from "./connect-helpers";
import type { ConnectDeps, ConnectPrincipal } from "./connect-types";

/** Mesaj gönder — `writePolicy` uygulanır (channel=admins, group/dm/community=members). */
export async function sendMessage(
  principal: ConnectPrincipal,
  conversationId: string,
  text: string,
  deps: ConnectDeps,
  /** Faz 2 madde 5 (2026-07-18) — WhatsApp gibi: metin BOŞ olabilir, ek varsa yeterli. */
  attachments?: ConnectAttachment[],
  /** Yanıtlama (2026-07-20) — statik anlık görüntü, bkz. `ConnectMessage.replyTo` yorumu. */
  replyTo?: ConnectMessage["replyTo"],
): Promise<ConnectMessage> {
  const trimmed = text.trim();
  const hasAttachment = !!attachments && attachments.length > 0;
  if (!trimmed && !hasAttachment) throw new ValidationError("Mesaj boş olamaz.");
  if (trimmed.length > MAX_MESSAGE_LEN) throw new ValidationError(`Mesaj ${MAX_MESSAGE_LEN} karakteri aşamaz.`);

  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  assertCanWrite(conversation, principal.uid, member);

  const now = nowISO();
  const message: ConnectMessage = {
    id: deps.conversations.nextMessageId(),
    authorUid: principal.uid,
    text: trimmed,
    createdAt: now,
    attachments: hasAttachment ? attachments : undefined,
    afterHours: isAfterHoursStudentToTrainerDm(principal, conversation) || undefined,
    replyTo,
  };
  const newMessageCount = (conversation.messageCount ?? 0) + 1;
  await deps.conversations.saveMessage(conversationId, message);
  await deps.conversations.saveConversation({
    ...conversation,
    lastMessage: { messageId: message.id, text: trimmed || `📎 ${attachments![0].fileName}`, senderUid: principal.uid, at: now },
    messageCount: newMessageCount,
    updatedAt: now,
    updatedBy: principal.uid,
  });

  // Gönderenin kendi okunma damgası — yeni mesajı kendine "okunmamış" göstermesin.
  if (member) {
    await deps.conversations.saveMember(conversationId, { ...member, lastReadAt: now, readMessageCount: newMessageCount });
  }

  return message;
}

export async function listMessages(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
  limit?: number,
): Promise<ConnectMessage[]> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  assertCanRead(conversation, member);
  const messages = await deps.conversations.listMessages(conversationId, limit);
  // "Benim için sil" — SADECE bu çağıranın görünümünden kaybolur, mesaj bozulmaz.
  const visible = messages.filter((m) => !m.hiddenFor?.includes(principal.uid));
  // "Sohbeti Temizle" (2026-07-25) — `member.clearedAt`'ten ÖNCEKİ mesajlar bu
  // çağıran için gizlenir, karşı taraf etkilenmez (bkz. `clearConversationForMe`).
  return member?.clearedAt ? visible.filter((m) => m.createdAt > member.clearedAt!) : visible;
}

/**
 * Mesaj düzenle (WhatsApp — 2026-07-18) — SADECE yazar düzenleyebilir. Silinmiş
 * ("herkes için") bir mesaj düzenlenemez. Konuşmanın ANLIK önizlemesi (`lastMessage`)
 * de bu mesajsa güncellenir (messageId ile eşleştirilir).
 */
export async function editMessage(
  principal: ConnectPrincipal,
  conversationId: string,
  messageId: string,
  text: string,
  deps: ConnectDeps,
): Promise<ConnectMessage> {
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Mesaj boş olamaz.");
  if (trimmed.length > MAX_MESSAGE_LEN) throw new ValidationError(`Mesaj ${MAX_MESSAGE_LEN} karakteri aşamaz.`);

  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const message = await deps.conversations.getMessage(conversationId, messageId);
  if (!message) throw new ValidationError("Mesaj bulunamadı.");
  if (message.authorUid !== principal.uid) throw new ForbiddenError("connect.message.edit");
  if (message.deletedForEveryone) throw new ValidationError("Silinmiş bir mesaj düzenlenemez.");

  const now = nowISO();
  const updated: ConnectMessage = { ...message, text: trimmed, editedAt: now };
  await deps.conversations.saveMessage(conversationId, updated);

  if (conversation.lastMessage?.messageId === messageId) {
    await deps.conversations.saveConversation({ ...conversation, lastMessage: { ...conversation.lastMessage, text: trimmed } });
  }
  return updated;
}

/**
 * "Herkes için sil" (WhatsApp) — SADECE yazar silebilir. `text` VE `attachments`
 * kalıcı temizlenir, HERKESTE "Bu mesaj silindi" placeholder'ı gösterilir
 * (`deletedForEveryone`). Dönüş değeri SİLİNMEDEN ÖNCEKİ mesaj (attachments dahil)
 * — çağıran route bununla Drive'daki gerçek dosyayı da temizler (2026-07-18
 * kullanıcı bulgusu: eskiden mesaj "silinsin" ama Drive'daki dosya YETİM kalıyordu).
 */
export async function deleteMessageForEveryone(
  principal: ConnectPrincipal,
  conversationId: string,
  messageId: string,
  deps: ConnectDeps,
): Promise<ConnectMessage> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const message = await deps.conversations.getMessage(conversationId, messageId);
  if (!message) throw new ValidationError("Mesaj bulunamadı.");
  if (message.authorUid !== principal.uid) throw new ForbiddenError("connect.message.delete");

  await deps.conversations.saveMessage(conversationId, { ...message, text: "", deletedForEveryone: true, attachments: undefined });

  if (conversation.lastMessage?.messageId === messageId) {
    await deps.conversations.saveConversation({
      ...conversation,
      lastMessage: { ...conversation.lastMessage, text: "Bu mesaj silindi" },
    });
  }
  return message;
}

/**
 * "Benim için sil" (WhatsApp) — yetki gerekmez, HERKES (yazar dahil) kendi
 * görünümünden gizleyebilir. Mesaj diğerleri için DEĞİŞMEZ.
 */
export async function deleteMessageForMe(
  principal: ConnectPrincipal,
  conversationId: string,
  messageId: string,
  deps: ConnectDeps,
): Promise<void> {
  const message = await deps.conversations.getMessage(conversationId, messageId);
  if (!message) throw new ValidationError("Mesaj bulunamadı.");
  if (message.hiddenFor?.includes(principal.uid)) return;
  await deps.conversations.saveMessage(conversationId, { ...message, hiddenFor: [...(message.hiddenFor ?? []), principal.uid] });
}

/**
 * Reaksiyon ver/değiştir/kaldır (Faz 2 madde 2, WhatsApp — 2026-07-18). Yazma
 * yetkisi GEREKMEZ, SADECE okuma (`assertCanRead`) — broadcast kanalında salt-okunur
 * üyeler VE audience-only (member dokümanı olmayan) okuyucular da tepki verebilir,
 * tam WhatsApp kanallarındaki davranış. `emoji:null` → kaldır. Aynı emojiye tekrar
 * basmak da kaldırır (toggle).
 */
export async function setMessageReaction(
  principal: ConnectPrincipal,
  conversationId: string,
  messageId: string,
  emoji: string | null,
  deps: ConnectDeps,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  assertCanRead(conversation, member); // okuma yetkisi yeter — audience-only (member dokümanı olmayan) okuyucu da tepki verebilir

  const message = await deps.conversations.getMessage(conversationId, messageId);
  if (!message) throw new ValidationError("Mesaj bulunamadı.");
  if (message.deletedForEveryone) throw new ValidationError("Silinmiş bir mesaja reaksiyon verilemez.");

  const reactions = { ...(message.reactions ?? {}) };
  if (emoji === null || reactions[principal.uid] === emoji) delete reactions[principal.uid];
  else reactions[principal.uid] = emoji;

  await deps.conversations.saveMessage(conversationId, { ...message, reactions });
}

/**
 * Yıldızla/kaldır (2026-07-20) — reaksiyonla AYNI yetki ilkesi: SADECE okuma
 * yeterli (`assertCanRead`), audience-only okuyucu da yıldızlayabilir. Kişi
 * başına bağımsız (`starredBy` dizisi) — ayrı bir "Yıldızlı Mesajlar" ekranı
 * YOK (kullanıcı kararı), sadece mesaj üzerinde küçük bir gösterge.
 */
export async function toggleMessageStar(
  principal: ConnectPrincipal,
  conversationId: string,
  messageId: string,
  starred: boolean,
  deps: ConnectDeps,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  assertCanRead(conversation, member);

  const message = await deps.conversations.getMessage(conversationId, messageId);
  if (!message) throw new ValidationError("Mesaj bulunamadı.");

  const starredBy = new Set(message.starredBy ?? []);
  if (starred) starredBy.add(principal.uid);
  else starredBy.delete(principal.uid);

  await deps.conversations.saveMessage(conversationId, { ...message, starredBy: [...starredBy] });
}

/**
 * "Yıldızlı Mesajlarım" (2026-07-20) — TÜM konuşmalar arasında (`collectionGroup`,
 * `listMembershipsForUid` ile AYNI desen) çağıranın yıldızladığı mesajlar, en
 * yeniden eskiye. Mesaj dokümanında `tenantId` YOK — her sonuç için konuşma
 * ayrıca çekilip tenant + okuma yetkisi (`assertCanRead`) doğrulanır, geçmezse
 * sessizce elenir (ör. konuşmadan çıkarılmış olabilir).
 */
export async function listStarredMessages(
  principal: ConnectPrincipal,
  deps: ConnectDeps,
): Promise<{ conversation: ConnectConversation; message: ConnectMessage }[]> {
  const raw = await deps.conversations.listStarredMessages(principal.uid);
  if (raw.length === 0) return [];

  // Önceden her yıldızlı mesaj için ayrı ayrı `getConversationById` + `getMember`
  // (N+1) vardı — çok yıldızlı mesajı olan kullanıcıda sıralı okuma sayısı katlanıyordu.
  // Konuşmalar tek `getConversationsByIds` ile, üyelikler tek `listMembershipsForUid`
  // ile toplu çekilip döngü sadece bellekte Map lookup yapıyor.
  const conversationIds = [...new Set(raw.map((r) => r.conversationId))];
  const [conversations, memberships] = await Promise.all([
    deps.conversations.getConversationsByIds(conversationIds, principal.tenantId),
    deps.conversations.listMembershipsForUid(principal.uid),
  ]);
  const conversationMap = new Map(conversations.map((c) => [c.id, c]));
  const memberMap = new Map(memberships.map((m) => [m.conversationId, m.member]));

  const results: { conversation: ConnectConversation; message: ConnectMessage }[] = [];
  for (const { conversationId, message } of raw) {
    const conversation = conversationMap.get(conversationId);
    if (!conversation) continue;
    const member = memberMap.get(conversationId) ?? null;
    try {
      assertCanRead(conversation, member);
    } catch {
      continue;
    }
    results.push({ conversation, message });
  }
  return results.sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt));
}

/**
 * Okundu işaretle. Audience-only okuyucular (üye dokümanı yok — ör. "Kurum
 * Duyuruları" gibi audience:"all_students" kanalları) için Faz 1'de burada
 * sessizce no-op ediliyordu ("basitlik kararı") — bu yüzden okunmamış sayısı HİÇ
 * kalıcı olmuyor, ekrana her girişte sunucudan gelen eski sayı geri geliyordu
 * (2026-07-20 kullanıcı bulgusu: "24 hep geri geliyor"). Artık İLK okumada gerçek
 * bir member dokümanı oluşturuluyor (role:"member") — bundan sonra bu kişi için
 * hem okunmamış sayısı HEM push bildirimleri (bkz. `notifyNewMessage` — alıcı
 * listesi `listMembers`'tan geliyor) gerçek çalışır. Kanalın yazma yetkisi
 * SADECE `conversation.admins` dizisine bakıyor (`assertCanWrite`), bu doküman
 * yazma iznini HİÇ etkilemez — audience okuyucusu hâlâ sadece okuyucu.
 */
export async function markRead(principal: ConnectPrincipal, conversationId: string, deps: ConnectDeps): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) return;
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  const ts = nowISO();
  if (!member) {
    const audienceOpen = conversation.realm === "trainer_student" && conversation.audience === "all_students";
    if (!audienceOpen) return;
    await deps.conversations.saveMember(conversationId, {
      uid: principal.uid, realm: conversation.realm, role: "member",
      joinedAt: ts, lastReadAt: ts, lastDeliveredAt: ts, readMessageCount: conversation.messageCount ?? 0,
    });
    return;
  }
  // `lastDeliveredAt` de en az okuma anına bumper — okumak zaten teslim almayı
  // ima eder, çift gri tik çift mavi tikten "geride" görünüp kalmasın (2026-07-22).
  await deps.conversations.saveMember(conversationId, {
    ...member,
    lastReadAt: ts,
    lastDeliveredAt: !member.lastDeliveredAt || member.lastDeliveredAt < ts ? ts : member.lastDeliveredAt,
    readMessageCount: conversation.messageCount ?? member.readMessageCount ?? 0,
  });
}

const TYPING_TTL_MS = 6000;

/**
 * "Yazıyor" presence sinyali — GERÇEK, ephemeral (2026-07-18 kullanıcı isteği:
 * önce görsel önizleme onaylandı, sonra gerçek presence istendi). Mesaj yazma
 * yetkisiyle AYNI kapı (`assertCanWrite`) — okuma-izni olan ama yazamayan biri
 * (audience-only öğrenci, admin-only kanalda) sinyal gönderemez, sessizce yok sayılır.
 */
export async function setTypingSignal(principal: ConnectPrincipal, conversationId: string, deps: ConnectDeps): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) return;
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  try {
    assertCanWrite(conversation, principal.uid, member);
  } catch {
    return; // yazma yetkisi yoksa sinyal de gönderilmez — sessiz no-op
  }
  const name = await resolveDisplayName(principal.uid, principal.tenantId, deps);
  await deps.conversations.setTyping(conversationId, principal.uid, name, nowISO());
}

/** Aktif yazanlar — TTL'i geçmiş (durmuş) sinyaller burada süzülür, kendisi hariç. */
export async function listTypingSignals(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
): Promise<{ uid: string; name: string }[]> {
  const signals = await deps.conversations.listTyping(conversationId);
  const now = Date.now();
  return signals
    .filter((s) => s.uid !== principal.uid && now - new Date(s.at).getTime() < TYPING_TTL_MS)
    .map((s) => ({ uid: s.uid, name: s.name }));
}
