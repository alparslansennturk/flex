import type {
  ConnectConversationType,
  ConnectRealm,
  ConnectWritePolicy,
} from "../core/connect";
import type { ConnectAuditRepo } from "../repo/connect-audit-repo";
import type { ConnectRepo } from "../repo/connect-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { FlexosUserRepo } from "../repo/flexos-user-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { TrainerRepo } from "../repo/trainer-repo";

/**
 * Flex Connect çağıranı — mevcut `Actor`/capability modeliyle KARIŞTIRILMAZ.
 * Personel `actorFromCaller` (with-auth Caller → Actor) üzerinden, öğrenci
 * `personId` + `Person.authUid` eşleşmesiyle (diğer öğrenci route'larıyla AYNI
 * desen, bkz. `student/me/route.ts`) çözülür — ikisi de bu tek tipe indirgenir.
 */
export interface ConnectPrincipal {
  tenantId: string;
  uid: string; // Firebase Auth uid
  kind: "staff" | "student";
  personId?: string; // kind==="student" ise dolu
  trainerId?: string; // kind==="staff" ve aynı zamanda kadrolu eğitmense dolu
}

export interface ConnectDeps {
  conversations: ConnectRepo;
  persons: PersonRepo;
  flexosUsers: FlexosUserRepo;
  auditLog: ConnectAuditRepo;
  /** SADECE "öğrenci kendi eğitmenine DM açabilir" doğrulaması için (2026-07-18). */
  enrollments: EnrollmentRepo;
  groups: GroupRepo;
  trainers: TrainerRepo;
  /** Ana FlexOS bildirim ziline/toast'ına yazar (2026-07-20) — `comment-service.ts::CommentDeps.notify`
   * ile AYNI sözleşme/koleksiyon (`users/{uid}/notifications`, bkz. `flexos-notify.ts::notifyUser`).
   * Push (FCM, mobil) ile KARIŞTIRILMAZ — bu, ana Flex uygulamasındaki zil+toast (`NotificationBell`/
   * `NotificationToastListener`) için, Connect penceresinin DIŞINDayken de görünsün diye. */
  notify: (uid: string, input: { type: "message" | "announcement" | "assignment" | "system"; entityId: string; senderId: string; title: string; preview: string; actionUrl: string }) => Promise<void>;
}

export interface CreateConversationInput {
  realm: ConnectRealm;
  type: ConnectConversationType;
  name: string;
  description?: string;
  colorKey?: string;
  memberUids: string[]; // oluşturanı İÇERMEZ — otomatik owner olarak eklenir
  audience?: "all_students";
  childIds?: string[]; // sadece type==="community"
  /** SADECE type==="community" (2026-07-18) — bkz. `ConnectConversation.announcementChannelId`. */
  announcementChannelId?: string;
  /** SADECE type==="group" && realm==="trainer_student" — bkz. `ConnectConversation.sourceGroupId`. */
  sourceGroupId?: string;
  /**
   * SADECE type==="channel" && realm==="staff" (2026-07-18 kullanıcı isteği:
   * "Personel Kanalı" — herkes okur, seçilen Yayıncılar yazar). TÜM aktif personel
   * otomatik okuyucu/member yapılır — server KENDİSİ hesaplar (`flexosUsers.list`),
   * client'a güvenilmez. `memberUids` (Yayıncılar) bunların write/admin hakkı
   * almasını sağlar, okuyucu listesini BELİRLEMEZ.
   */
  broadcastToAllStaff?: boolean;
  /**
   * SADECE type==="channel" — admin/Yayıncı OLMADAN, salt-okunur üye eklemek için
   * (2026-07-18: Topluluk'un "Genel Duyuru" kanalı — bundled sınıfların öğrencileri
   * OKUR ama SADECE eğitmen yazar; `memberUids` burada BOŞ bırakılır, çünkü channel
   * için `memberUids` admins'e girer). Belirsiz "kim yazar kim okur" karışıklığını
   * önlemek için `memberUids`'ten (yazarlar) BİLİNÇLİ olarak ayrı bir alan.
   */
  readerUids?: string[];
  /** SADECE type==="channel" (2026-07-20) — "Herkes Yazabilir" seçimi. Belirtilmezse
   * "admins" (mevcut varsayılan davranış). Diğer tiplerde (group/dm/community) hep
   * "members" — bu alan görmezden gelinir. */
  writePolicy?: ConnectWritePolicy;
}

export interface UpdateConversationMetaInput {
  name?: string;
  description?: string;
  /** Yeni "Yayıncılar" listesi — SADECE type==="channel" (2026-07-18, son 2 madde). */
  adminUids?: string[];
  /** Toplulukta yeni grup ekle/çıkar — TAM liste (mevcut + eklenen - çıkarılan),
   * SADECE type==="community" (2026-07-18, kullanıcı isteği: "yeni grup açıldı
   * onu da var olan topluluğa dahil edebiliyor muyum"). */
  childIds?: string[];
}
