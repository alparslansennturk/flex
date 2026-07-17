import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * FLEX CONNECT — bağımsız kurumsal mesajlaşma domain'i. Ödev/teslim sistemine
 * (`chats/{assignmentId}_{personId}`) HİÇ dokunmaz, tamamen ayrı koleksiyon.
 * Tam mimari: `FLEX_CONNECT.md` (kök dizin).
 *
 * **İki realm + asimetrik izolasyon (mimarinin belkemiği):**
 *  - `staff` — personel kendi arasında (kanal/grup/dm). Öğrenci ASLA üye olamaz.
 *  - `trainer_student` — eğitmen + öğrenci (grup=sınıf odası, dm=özel, community=
 *    eğitmenin gruplarını paketleyen duyuru).
 * Tek kontrollü köprü: personelin yazıp öğrencinin OKUDUĞU resmi kanallar
 * (`audience:"all_students"` — Kurum Duyuruları, Öğrenci İşleri).
 */
export type ConnectRealm = "staff" | "trainer_student";

export type ConnectConversationType = "channel" | "group" | "community" | "dm";

/** channel = sadece admins[] yazar (tek yönlü duyuru); group/dm/community = her üye yazar. */
export type ConnectWritePolicy = "admins" | "members";

export type ConnectAudience = "all_students";

export type ConnectMemberRole = "owner" | "admin" | "member" | "guest";

export interface ConnectConversation extends Audit {
  id: EntityId;
  tenantId: TenantId;

  realm: ConnectRealm;
  type: ConnectConversationType;

  name: string; // dm'de boş bırakılabilir — liste adı karşı taraftan çözülür (client)
  description?: string;
  colorKey?: string; // avatar/ikon rengi — tasarım paleti, bkz. FLEX_CONNECT.md §11

  writePolicy: ConnectWritePolicy;
  admins: EntityId[]; // channel yazarları + konuşma yöneticileri (küçük dizi, member'dan AYRI — hızlı erişim)

  /** Doluysa: personel bu konuşmaya yazar, ADI GEÇEN audience'daki HERKES üye olmadan okur. */
  audience?: ConnectAudience;

  /** SADECE type==="community" — paketlediği grup konuşmalarının id'leri (fiziksel grup DEĞİL, mantıksal fan-out). */
  childIds?: EntityId[];

  lastMessage?: { text: string; senderUid: string; at: ISODateTime } | null;

  /** Toplam mesaj sayısı — her `sendMessage`'da artar. Okunmamış SAYISINI (badge'deki
   * gerçek rakam) tek tek mesaj taraması yapmadan hesaplamak için denormalize edilir:
   * `unreadCount = messageCount - member.readMessageCount`. */
  messageCount: number;

  ownerUid: string; // oluşturan
}

/**
 * `connect_conversations/{conversationId}/members/{uid}` — üyelik + okunma + tercih
 * TEK yerde (2026-07-18 revizyonu: eskiden `Conversation.memberUids[]` + ayrı `reads`
 * koleksiyonu vardı, ikisi de kaldırıldı). `uid`+`realm` denormalize edilir ki
 * `collectionGroup("members").where("uid","==",me)` ile "bana ait konuşmalar" TEK
 * sorguda çözülsün (bkz. FLEX_CONNECT.md §3).
 */
export interface ConnectMember {
  uid: string; // == doküman id
  realm: ConnectRealm; // parent conversation.realm denormalize — defansif izolasyon sorgusu
  role: ConnectMemberRole;
  joinedAt: ISODateTime;
  lastReadAt?: ISODateTime;
  /** `Conversation.messageCount`'ın son okunduğu andaki değeri — okunmamış SAYISI buradan türetilir. */
  readMessageCount?: number;
  muted?: boolean;
  pinned?: boolean;
}

/**
 * `connect_conversations/{conversationId}/messages/{messageId}` — SADECE `authorUid`
 * tutulur (isim/avatar YOK — ad değişince geçmiş bozulmasın, tek doğruluk kaynağı
 * user koleksiyonu). Render sırasında uid→{name,colorKey} toplu çözülür.
 */
export interface ConnectMessage {
  id: EntityId;
  authorUid: string;
  text: string;
  createdAt: ISODateTime;
  editedAt?: ISODateTime;
  // FAZ 2: attachments?: ConnectAttachment[]; reactions?: Record<string, number>;
}
