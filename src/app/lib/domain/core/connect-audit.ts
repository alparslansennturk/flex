import type { EntityId, ISODateTime, TenantId } from "../base";
import type { ConnectRealm } from "./connect";

/**
 * FLEX CONNECT — kurumsal Audit Log. Kullanıcı hareketi (mesajlaşma) DEĞİL,
 * YÖNETİMSEL işlemleri kayıt altına alır (kim neyi ne zaman oluşturdu/sildi/
 * değiştirdi). Normal mesaj gönderme buraya YAZILMAZ. Append-only: repo katmanı
 * kasıtlı olarak sadece `create` sunar, update/delete YOK (bkz. connect-audit-repo.ts).
 *
 * Kapsamdaki eylemlerin bir kısmı (channel.delete, admin.grant/revoke,
 * conversation.settings.update, message.delete/edit, member.bulk_add,
 * realm.change) Flex Connect Faz 1'de HENÜZ servis fonksiyonu olarak yok —
 * taksonomi ileriye hazır tanımlanır, gerçek çağrı o işlem yazıldığında eklenir.
 */
export type ConnectAuditAction =
  | "channel.create"
  | "channel.delete"
  | "group.create"
  | "group.delete"
  | "community.create"
  | "member.add"
  | "member.remove"
  | "member.bulk_add"
  | "admin.grant"
  | "admin.revoke"
  | "conversation.settings.update"
  | "message.delete"
  | "message.edit"
  | "audience_channel.create"
  | "realm.change";

/** İsteğe bağlı — route katmanında `NextRequest` header'larından okunur. */
export interface ConnectRequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface ConnectAuditEntry {
  id: EntityId;
  action: ConnectAuditAction;
  actorUid: string;
  actorName: string;
  conversationId: string;
  conversationName: string;
  targetUid?: string;
  targetName?: string;
  realm: ConnectRealm;
  tenantId: TenantId;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
  ip?: string;
  userAgent?: string;
}
