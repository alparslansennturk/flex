// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import type { ConnectAttachment, ConnectConversation, ConnectMember } from "../domain/core/connect";
import { firestoreConnectRepo } from "./connect-repo.firestore";
import { resolveConnectIdentities } from "./connect-identity";

/** API'nin döndürdüğü, client'ın doğrudan render edeceği şekil — isim/renk ÇÖZÜLMÜŞ. */
export interface ConnectConversationView {
  id: string;
  realm: ConnectConversation["realm"];
  type: ConnectConversation["type"];
  name: string; // dm için karşı tarafın adı, diğerlerinde conversation.name
  description?: string;
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
  /** Çağıran bu konuşmanın SAHİBİ mi — silme gibi en-yüksek-yetki işlemler SADECE
   * owner'a açılır (2026-07-18, admin/yayıncı yeterli değil). */
  isOwner: boolean;
  /** Kişisel sabitleme tercihi (Favoriler, Faz 2) — üye değilse (audience-only) hep false. */
  pinned: boolean;
  /** Kişisel sessize alma tercihi (2026-07-19, push bildirimi) — üye değilse hep false. */
  muted: boolean;
  /** SADECE type==="dm" — karşı tarafın uid'i. Dizinden (Personel/Öğrenciler/
   * Eğitmenlerim) bir kişiye tıklayınca "bununla zaten DM var mı" eşleşmesi için. */
  peerUid?: string;
  /** Düzenleme modalının ANINDA (fetch beklemeden) açılabilmesi için (2026-07-18
   * kullanıcı bulgusu: "Yayıncılar 1sn sonra geliyor") — liste zaten bu veriyi
   * taşıyor, ayrı bir `GET .../[id]` çağrısına hiç gerek yok. */
  admins: string[];
  ownerUid: string;
  childIds?: string[];
  announcementChannelId?: string;
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
        description: conversation.description,
        colorKey,
        writePolicy: conversation.writePolicy,
        audience: conversation.audience,
        lastMessage,
        unread,
        unreadCount,
        isMember: !!member,
        isAdmin: conversation.admins.includes(principalUid),
        isOwner: conversation.ownerUid === principalUid,
        pinned: member?.pinned ?? false,
        muted: member?.muted ?? false,
        peerUid,
        admins: conversation.admins,
        ownerUid: conversation.ownerUid,
        childIds: conversation.childIds,
        announcementChannelId: conversation.announcementChannelId,
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
  /** Düzenlenmişse dolu — UI "Düzenlendi" etiketi gösterir (WhatsApp, 2026-07-18). */
  editedAt?: string;
  /** "Herkes için sil" — true ise `text` zaten boş, UI "Bu mesaj silindi" placeholder'ı gösterir. */
  deletedForEveryone?: boolean;
  /** emoji → kaç kişi seçti (gruplu, render'a hazır — Faz 2 madde 2, 2026-07-18). */
  reactionCounts?: Record<string, number>;
  /** Çağıranın KENDİ reaksiyonu (varsa) — UI kendi seçtiği emojiyi vurgular. */
  myReaction?: string;
  /** SADECE isMine — okundu-tikleri (Faz 2 madde 3, 2026-07-18): DİĞER tüm üyeler
   * bu mesajdan SONRA okumuşsa (lastReadAt >= createdAt) true — WhatsApp'taki çift
   * mavi tik. Yeni bir "okundu" kaydı YOK, var olan `Member.lastReadAt`'ten türetilir. */
  readByAll?: boolean;
  /** Faz 2 madde 5 (2026-07-18) — dosya eki(leri), doğrudan geçirilir. */
  attachments?: ConnectAttachment[];
  /** Kurumsal kural (2026-07-20) — öğrenci→eğitmen DM'de 22:00-09:00 arası gönderildi. */
  afterHours?: boolean;
}

export async function buildMessageViews(
  messages: {
    id: string; authorUid: string; text: string; createdAt: string; editedAt?: string;
    deletedForEveryone?: boolean; reactions?: Record<string, string>; attachments?: ConnectAttachment[];
    afterHours?: boolean;
  }[],
  principalUid: string,
  tenantId: string,
  /** Okundu-tikleri için: DİĞER üyelerin (çağıran hariç) `lastReadAt` değerleri. */
  otherMembersLastReadAt: string[] = [],
): Promise<ConnectMessageView[]> {
  const identities = await resolveConnectIdentities(
    messages.map((m) => m.authorUid),
    tenantId,
  );
  return messages.map((m) => {
    const reactionCounts: Record<string, number> = {};
    for (const emoji of Object.values(m.reactions ?? {})) reactionCounts[emoji] = (reactionCounts[emoji] ?? 0) + 1;
    const isMine = m.authorUid === principalUid;
    const readByAll = isMine && otherMembersLastReadAt.length > 0
      ? otherMembersLastReadAt.every((t) => t >= m.createdAt)
      : undefined;
    return {
      id: m.id,
      authorUid: m.authorUid,
      authorName: identities[m.authorUid]?.name ?? "Kullanıcı",
      colorKey: identities[m.authorUid]?.colorKey ?? "#3A7BD5",
      isMine,
      readByAll,
      text: m.text,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      deletedForEveryone: m.deletedForEveryone,
      reactionCounts: Object.keys(reactionCounts).length > 0 ? reactionCounts : undefined,
      myReaction: m.reactions?.[principalUid],
      attachments: m.attachments,
      afterHours: m.afterHours,
    };
  });
}
