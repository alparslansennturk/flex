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
  /** WhatsApp'taki çift GRİ tik (2026-07-22, kullanıcı isteği) — mesaj bu üyenin
   * İSTEMCİSİNE ulaştığı an (`lastReadAt`'ten AYRI: "gördü" değil "cihazına indi").
   * Yeni bir yazma noktası: konuşma LİSTESİ her çekildiğinde (`ConnectWidget` zaten
   * 30sn'de bir + her sayfa yüklemesinde bunu yapıyor — gerçek WhatsApp'taki "telefon
   * online oldu, mesaj indi" anına en yakın, gerçek sinyal) `markDeliveredFromList`
   * bunu `Conversation.lastMessage.at`'e bumper. `markRead` da bunu en az okuma anına
   * bumper (okumak zaten teslim almayı ima eder, tik hiç geriye gitmesin). */
  lastDeliveredAt?: ISODateTime;
  /** `Conversation.messageCount`'ın son okunduğu andaki değeri — okunmamış SAYISI buradan türetilir. */
  readMessageCount?: number;
  muted?: boolean;
  pinned?: boolean;
  /** SADECE role==="guest" (Faz 2 madde 4, 2026-07-18) — "Yardımcı Eğitmen"/
   * "Gözlemci"/"Konuk"/"Veli" gibi açıklayıcı etiket, üye listesinde rozet olarak
   * gösterilir. Yetkiyi ETKİLEMEZ (bkz. `connect-service.ts::addMember`). */
  guestTitle?: string;
  /** SADECE type==="dm" (2026-07-20) — "Sohbeti Sil" (WhatsApp'taki gibi KİŞİSEL
   * gizleme, gerçek/kalıcı silme DEĞİL): tıklandığı andaki `Conversation.messageCount`
   * değeri. Listelemede `conversation.messageCount <= hiddenAtMessageCount` ise DM
   * gizlenir; karşı taraftan YENİ mesaj gelip `messageCount` artınca otomatik geri
   * görünür (bkz. `connect-service.ts::hideConversationForMe`/`listConversationsForPrincipal`).
   * Karşı tarafın kendi görünümünü HİÇ etkilemez. */
  hiddenAtMessageCount?: number;
  /** "Arşivle" (2026-07-22, WhatsApp'taki gibi) — `hiddenAtMessageCount` ile AYNI desen
   * (kalıcı silme DEĞİL, sadece varsayılan listeden gizleme): tıklandığı andaki
   * `Conversation.messageCount`. Listelemede `conversation.messageCount <=
   * archivedAtMessageCount` ise ana listede gizlenir, "Arşivlenenler" filtresinde
   * görünür. Karşı taraftan YENİ mesaj gelip `messageCount` artınca otomatik ana
   * listeye geri döner (ekstra yazma GEREKMEZ — okuma anında karşılaştırılır,
   * `hideConversationForMe`'nin aksine `type==="dm"`/staff-only kısıtı YOK — arşiv
   * yıkıcı olmadığı için herkes her konuşma tipini arşivleyebilir). */
  archivedAtMessageCount?: number;
}

/** Mesaj eki (Faz 2 madde 5, 2026-07-18) — tek seferlik (resumable/chunk YOK —
 * Vercel'in 4.5MB body sınırı altında kalınır, `MAX_ATTACHMENT_BYTES`).
 *
 * 2026-07-21: Google Drive'dan Cloud Storage'a geçildi — YENİ ekler
 * `storagePath` doldurur, `driveFileId` ESKİ (Drive tabanlı) ekler için
 * opsiyonel olarak kalır (geriye dönük uyumluluk, mevcut mesajlar bozulmasın).
 * `webViewLink` HER İKİ durumda da dolu (Drive webViewLink VEYA GCS public URL) —
 * "görüntüle/indir" linki için ortak alan. */
export interface ConnectAttachment {
  driveFileId?: string;
  storagePath?: string;
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
  /** SADECE "system" mesajlarını "text" mesajlarından ayırt eder (2026-07-20,
   * WhatsApp'taki "X gruba eklendi" gibi satırlar). Yoksa "text" varsayılır
   * (geriye dönük uyumlu — mevcut mesajlarda bu alan hiç yok). */
  kind?: "text" | "system";
  /** SADECE kind==="system". İleride başka event tipleri eklenebilir diye union
   * açık bırakıldı. `authorUid`/`text` sistem mesajlarında anlamsız (boş geçilir). */
  systemEvent?: { type: "members_added"; count: number };
  /** Yanıtlama (2026-07-20) — CANLI referans DEĞİL, gönderim anındaki statik
   * anlık görüntü (`lastMessage` denormalizasyonuyla AYNI ilke): orijinal mesaj
   * sonradan düzenlense/silinse bile bu alıntı SABİT kalır. "Özelden Yanıtla"da
   * (grup mesajı → yazarın DM'i) `messageId` FARKLI bir konuşmaya ait olabilir —
   * bilerek "orijinale git" navigasyonu YOK, sadece görsel alıntı. */
  replyTo?: { messageId: string; authorUid: string; authorName: string; textSnippet: string };
  /** Yıldızlama (2026-07-20) — kişi başına bağımsız, `hiddenFor` ile AYNI desen
   * (Record değil, uid dizisi — reaksiyonun aksine kişi başı TEK bir emoji değil
   * salt boolean olduğu için dizi yeterli/basit). Ayrı bir "Yıldızlı Mesajlar"
   * ekranı YOK (kullanıcı kararı) — sadece mesaj üzerinde küçük bir gösterge. */
  starredBy?: string[];
}
