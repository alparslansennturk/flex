import type { ISODateTime, TenantId } from "../base";

/**
 * `connect_push_subscriptions/{uid}` — Flex Connect Mobil push/badge tercihleri.
 * Konuşma bazlı sessize alma BURADA DEĞİL (`ConnectMember.muted`, connect.ts) —
 * bu doküman SADECE genel açma/kapama + cihaz token'ları için.
 */
export interface ConnectPushSubscription {
  uid: string; // == doküman id
  tenantId: TenantId;
  /** Birden fazla cihaz/tarayıcı aynı kullanıcıya bağlı olabilir. */
  tokens: string[];
  /** Genel anahtar — kapalıysa hiçbir push gönderilmez (konuşma sessize alınmış olsun olmasın). */
  notificationsEnabled: boolean;
  updatedAt: ISODateTime;
}
