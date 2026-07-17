// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import type { ConnectConversation, ConnectMember } from "../domain/core/connect";
import { firestoreConnectRepo } from "./connect-repo.firestore";
import { resolveConnectIdentities } from "./connect-identity";

/** API'nin döndürdüğü, client'ın doğrudan render edeceği şekil — isim/renk ÇÖZÜLMÜŞ. */
export interface ConnectConversationView {
  id: string;
  realm: ConnectConversation["realm"];
  type: ConnectConversation["type"];
  name: string; // dm için karşı tarafın adı, diğerlerinde conversation.name
  colorKey?: string;
  writePolicy: ConnectConversation["writePolicy"];
  audience?: string;
  lastMessage: { text: string; senderUid: string; senderName: string; at: string } | null;
  unread: boolean;
  /** Gerçek okunmamış SAYISI — badge'de rakam olarak gösterilir (2026-07-18 kullanıcı
   * isteği: sabit nokta yerine gerçek mesaj sayısı). `Conversation.messageCount` -
   * `Member.readMessageCount` — tek tek mesaj taramadan hesaplanır. */
  unreadCount: number;
  isMember: boolean;
  /** Çağıran bu konuşmanın admin/owner'ı mı — `writePolicy:"admins"` kanallarda
   * composer'ı göster/gizle kararı BUNA bakar (2026-07-18 bug fix: önceden hiç
   * kontrol edilmiyordu, admin bile kendi kanalına yazamıyor gibi görünüyordu). */
  isAdmin: boolean;
  /** Kişisel sabitleme tercihi (Favoriler, Faz 2) — üye değilse (audience-only) hep false. */
  pinned: boolean;
  /** SADECE type==="dm" — karşı tarafın uid'i. Dizinden (Personel/Öğrenciler/
   * Eğitmenlerim) bir kişiye tıklayınca "bununla zaten DM var mı" eşleşmesi için. */
  peerUid?: string;
}

/**
 * Ham (conversation, member) çiftlerini isim/renk çözülmüş, client-hazır şekle
 * çevirir. DM'lerde karşı tarafın adı için o konuşmanın üyeleri AYRICA çekilir
 * (`Conversation.name` dm'de boş bırakılır — bkz. FLEX_CONNECT.md §2).
 */
export async function buildConversationViews(
  items: { conversation: ConnectConversation; member: ConnectMember | null }[],
  principalUid: string,
  tenantId: string,
): Promise<ConnectConversationView[]> {
  const dmItems = items.filter((i) => i.conversation.type === "dm");
  const dmMemberLists = await Promise.all(
    dmItems.map(async (i) => ({ id: i.conversation.id, members: await firestoreConnectRepo.listMembers(i.conversation.id) })),
  );
  const dmPeerUidByConvId = new Map<string, string>();
  for (const { id, members } of dmMemberLists) {
    const peer = members.find((m) => m.uid !== principalUid);
    if (peer) dmPeerUidByConvId.set(id, peer.uid);
  }

  const uidsToResolve = new Set<string>();
  for (const { conversation } of items) {
    if (conversation.lastMessage) uidsToResolve.add(conversation.lastMessage.senderUid);
  }
  for (const uid of dmPeerUidByConvId.values()) uidsToResolve.add(uid);
  const identities = await resolveConnectIdentities([...uidsToResolve], tenantId);

  return items
    .map(({ conversation, member }) => {
      const peerUid = dmPeerUidByConvId.get(conversation.id);
      const isDm = conversation.type === "dm" && !!peerUid;
      const name = isDm ? (identities[peerUid!]?.name ?? "Kullanıcı") : conversation.name;
      const colorKey = isDm ? identities[peerUid!]?.colorKey : conversation.colorKey;
      const lastMessage = conversation.lastMessage
        ? {
            text: conversation.lastMessage.text,
            senderUid: conversation.lastMessage.senderUid,
            senderName: identities[conversation.lastMessage.senderUid]?.name ?? "Kullanıcı",
            at: conversation.lastMessage.at,
          }
        : null;
      const unreadCount = Math.max(0, (conversation.messageCount ?? 0) - (member?.readMessageCount ?? 0));
      const unread = unreadCount > 0;
      return {
        id: conversation.id,
        realm: conversation.realm,
        type: conversation.type,
        name,
        colorKey,
        writePolicy: conversation.writePolicy,
        audience: conversation.audience,
        lastMessage,
        unread,
        unreadCount,
        isMember: !!member,
        isAdmin: conversation.admins.includes(principalUid),
        pinned: member?.pinned ?? false,
        peerUid,
      };
    })
    .sort((a, b) => (b.lastMessage?.at ?? "").localeCompare(a.lastMessage?.at ?? ""));
}

export interface ConnectMessageView {
  id: string;
  authorUid: string;
  authorName: string;
  colorKey: string;
  isMine: boolean;
  text: string;
  createdAt: string;
}

export async function buildMessageViews(
  messages: { id: string; authorUid: string; text: string; createdAt: string }[],
  principalUid: string,
  tenantId: string,
): Promise<ConnectMessageView[]> {
  const identities = await resolveConnectIdentities(
    messages.map((m) => m.authorUid),
    tenantId,
  );
  return messages.map((m) => ({
    id: m.id,
    authorUid: m.authorUid,
    authorName: identities[m.authorUid]?.name ?? "Kullanıcı",
    colorKey: identities[m.authorUid]?.colorKey ?? "#3A7BD5",
    isMine: m.authorUid === principalUid,
    text: m.text,
    createdAt: m.createdAt,
  }));
}
