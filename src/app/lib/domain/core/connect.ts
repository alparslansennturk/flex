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

  /** SADECE type==="community" (2026-07-18, "yeni grup açıldı topluluğa dahil
   * edebiliyor muyum" kullanıcı isteği) — toplulukla birlikte oluşturulan "Genel
   * Duyuru" kanalının id'si. `childIds`'e yeni bir grup eklendiğinde o grubun
   * rosteru OTOMATİK bu kanala okuyucu olarak eklenir (gerçek WhatsApp Topluluk
   * davranışı — sadece bilgi listesi değil, gerçek erişim genişlemesi). */
  announcementChannelId?: EntityId;

  /** SADECE type==="group" && realm==="trainer_student" — hangi FlexOS sınıfından
   * (`Group.id`) oluşturuldu (2026-07-18). Aynı sınıf için ikinci bir "sınıf odası"
   * oluşturulmasını engeller (dedup) + Topluluk'un `childIds`'i bu conversation'ı
   * güvenle yeniden kullanabilir. */
  sourceGroupId?: EntityId;

  lastMessage?: { messageId: string; text: string; senderUid: string; at: ISODateTime } | null;

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
  /** SADECE role==="guest" (Faz 2 madde 4, 2026-07-18) — "Yardımcı Eğitmen"/
   * "Gözlemci"/"Konuk"/"Veli" gibi açıklayıcı etiket, üye listesinde rozet olarak
   * gösterilir. Yetkiyi ETKİLEMEZ (bkz. `connect-service.ts::addMember`). */
  guestTitle?: string;
}

/** Mesaj eki (Faz 2 madde 5, 2026-07-18) — Google Drive'a yükleniyor (assignment
 * eklerinin AYNI deseni: `uploadBufferToFolder` + `setPublicReadPermission`), tek
 * seferlik (resumable/chunk YOK — Vercel'in 4.5MB body sınırı altında kalınır,
 * `MAX_ATTACHMENT_BYTES`). */
export interface ConnectAttachment {
  driveFileId: string;
  webViewLink: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
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
  /** Faz 2 madde 5 — WhatsApp gibi: metin BOŞ olabilir, ek varsa yeterli. */
  attachments?: ConnectAttachment[];
  editedAt?: ISODateTime;
  /** "Herkes için sil" (WhatsApp — 2026-07-18) — SADECE yazar silebilir. `text`
   * kalıcı olarak temizlenir, HERKESTE "Bu mesaj silindi" placeholder'ı gösterilir. */
  deletedForEveryone?: boolean;
  /** "Benim için sil" — yazar dahil HERKES kendi görünümünden gizleyebilir, SADECE
   * bu uid'lerin listesinden filtrelenir, diğerleri normal görür (mesaj bozulmaz). */
  hiddenFor?: string[];
  /** Reaksiyonlar (Faz 2 madde 2, 2026-07-18) — WhatsApp tarzı: kişi başına TEK
   * emoji (uid → emoji). Aynı emojiye tekrar basınca kaldırılır. Okuma yetkisi
   * olan HERKES reaksiyon verebilir (yazma yetkisi gerekmez — broadcast kanalında
   * okuyucular da tepki verebilsin diye, WhatsApp kanalları ile AYNI davranış). */
  reactions?: Record<string, string>;
  /** realm==="trainer_student" && type==="dm" && gönderen öğrenciyse, İstanbul saatiyle
   * 22:00-09:00 arasında gönderildiyse true (2026-07-20, kurumsal kural — kişisel
   * tercih DEĞİL, herkeste her zaman açık). Mesaj engellenmez/geciktirilmez, sadece
   * her iki tarafa da "mesai saati dışı" olarak işaretlenir (bkz. `sendMessage`). */
  afterHours?: boolean;
}
