import type { ConnectConversation, ConnectMember, ConnectMessage, ConnectRealm } from "../core/connect";

/**
 * Flex Connect deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/connect-repo.firestore.ts` (`connect_conversations`).
 */
export interface ConnectRepo {
  nextConversationId(): string;
  nextMessageId(): string;

  saveConversation(conversation: ConnectConversation): Promise<void>;
  getConversationById(id: string, tenantId: string): Promise<ConnectConversation | null>;
  /** Realm + audience filtresiyle (öğrenci-görür köprü kanalları) — izolasyonun bel kemiği. */
  listConversationsByAudience(tenantId: string, realm: ConnectRealm, audience: string): Promise<ConnectConversation[]>;
  getConversationsByIds(ids: string[], tenantId: string): Promise<ConnectConversation[]>;
  deleteConversation(id: string, tenantId: string): Promise<void>;
  /** `sourceGroupId` ile eşleşen konuşma (varsa) — sınıf odası dedup'ı için. */
  findBySourceGroupId(tenantId: string, sourceGroupId: string): Promise<ConnectConversation | null>;

  saveMember(conversationId: string, member: ConnectMember): Promise<void>;
  getMember(conversationId: string, uid: string): Promise<ConnectMember | null>;
  listMembers(conversationId: string): Promise<ConnectMember[]>;
  deleteMember(conversationId: string, uid: string): Promise<void>;
  /** `collectionGroup("members")` — "bana ait konuşmalar" (üye olduğum her yer). */
  listMembershipsForUid(uid: string): Promise<{ conversationId: string; member: ConnectMember }[]>;

  saveMessage(conversationId: string, message: ConnectMessage): Promise<void>;
  listMessages(conversationId: string, limit?: number): Promise<ConnectMessage[]>;

  /** Ephemeral "yazıyor" sinyali — `at`e bakarak client tarafında bayatlığı (TTL) süzülür,
   * ayrı bir temizleme işi YOK (aynı uid'in dokümanı her yazışmada üzerine yazılır). */
  setTyping(conversationId: string, uid: string, name: string, at: string): Promise<void>;
  listTyping(conversationId: string): Promise<{ uid: string; name: string; at: string }[]>;
}
