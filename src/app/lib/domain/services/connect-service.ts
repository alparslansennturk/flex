import type { ISODateTime } from "../base";
import type {
  ConnectAttachment,
  ConnectConversation,
  ConnectConversationType,
  ConnectMember,
  ConnectMemberRole,
  ConnectMessage,
  ConnectRealm,
  ConnectWritePolicy,
} from "../core/connect";
import type { ConnectAuditAction, ConnectAuditEntry, ConnectRequestMeta } from "../core/connect-audit";
import { ForbiddenError, ValidationError } from "../errors";
import type { ConnectRepo } from "../repo/connect-repo";
import type { ConnectAuditRepo } from "../repo/connect-audit-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { FlexosUserRepo } from "../repo/flexos-user-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { TrainerRepo } from "../repo/trainer-repo";
import type { Group } from "../core/group";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

function auditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * "X kişi gruba eklendi" sistem mesajı (2026-07-20, WhatsApp'taki gibi) — normal
 * mesajlarla AYNI `messages` alt-koleksiyonuna yazılır (okunmamış sayısı/sıralama
 * bozulmasın diye `messageCount` de AYNI şekilde artırılır). SADECE `type==="group"`
 * konuşmalarda çağrılır (`createConversation` roster seed'i + `addMember`).
 */
async function insertSystemMessage(
  conversation: ConnectConversation,
  count: number,
  deps: Pick<ConnectDeps, "conversations">,
): Promise<void> {
  if (count <= 0) return;
  const ts = nowISO();
  const message: ConnectMessage = {
    id: deps.conversations.nextMessageId(),
    authorUid: "system",
    text: "",
    createdAt: ts,
    kind: "system",
    systemEvent: { type: "members_added", count },
  };
  await deps.conversations.saveMessage(conversation.id, message);
  await deps.conversations.saveConversation({ ...conversation, messageCount: (conversation.messageCount ?? 0) + 1, updatedAt: ts });
}

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

const MAX_MESSAGE_LEN = 4000;

const ISTANBUL_TZ = "Europe/Istanbul";

/** Sunucunun İstanbul yerel saatine göre "şu an kaç dakika" hesabı — `attendance-
 * service.ts::istanbulNow` ile AYNI desen (Vercel runtime UTC varsayar, `Intl.
 * DateTimeFormat`'a açıkça timeZone verilir). */
function istanbulMinutesOfDay(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISTANBUL_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
}

/** Kurumsal kural (2026-07-20, kullanıcı kararı) — kişisel açma/kapama YOK, herkeste
 * her zaman geçerli: öğrenci → eğitmen DM'de 22:00-09:00 arası gönderilen mesajlar
 * "mesai saati dışı" işaretlenir (mesaj engellenmez, sadece etiketlenir — kurumun
 * amacı öğrenci-eğitmen arası kontrolsüz/gayriresmi iletişim riskini azaltmak). */
function isAfterHoursStudentToTrainerDm(principal: ConnectPrincipal, conversation: ConnectConversation): boolean {
  if (principal.kind !== "student") return false;
  if (conversation.realm !== "trainer_student" || conversation.type !== "dm") return false;
  const mins = istanbulMinutesOfDay();
  return mins >= 22 * 60 || mins < 9 * 60;
}

/** Hedef uid'in gerçekten `staff` mı `student` mı olduğunu çözer — realm/üye
 * doğrulaması için (bkz. FLEX_CONNECT.md §1: öğrenci staff realm'e ASLA eklenemez). */
async function resolveUidKind(
  uid: string,
  tenantId: string,
  deps: Pick<ConnectDeps, "persons" | "flexosUsers">,
): Promise<"staff" | "student" | "unknown"> {
  const person = await deps.persons.findByAuthUid(uid, tenantId);
  if (person) return "student";
  const user = await deps.flexosUsers.findByAuthUid(uid, tenantId);
  if (user) return "staff";
  return "unknown";
}

async function assertMembersMatchRealm(
  uids: string[],
  realm: ConnectRealm,
  tenantId: string,
  deps: Pick<ConnectDeps, "persons" | "flexosUsers">,
): Promise<void> {
  const kinds = await Promise.all(uids.map((uid) => resolveUidKind(uid, tenantId, deps)));
  kinds.forEach((kind, i) => {
    if (kind === "unknown") throw new ValidationError(`Kullanıcı bulunamadı: ${uids[i]}`);
    if (realm === "staff" && kind === "student") {
      throw new ForbiddenError("connect.staff.no-student"); // öğrenci staff realm'e ASLA eklenemez
    }
  });
}

/**
 * Kurumsal Audit Log yazımı — kullanıcı hareketi (mesaj gönderme) DEĞİL, YÖNETİMSEL
 * işlemler için (bkz. `domain/core/connect-audit.ts`). Best-effort: activity-log/mail
 * ile AYNI ilke, audit yazımındaki bir hata asıl işlemi ASLA geri almaz/başarısız
 * kılmaz — sadece konsola loglanır.
 */
async function logAudit(
  deps: Pick<ConnectDeps, "auditLog" | "persons" | "flexosUsers">,
  principal: ConnectPrincipal,
  conversation: Pick<ConnectConversation, "id" | "name" | "realm">,
  action: ConnectAuditAction,
  opts: { targetUid?: string; targetName?: string; metadata?: Record<string, unknown>; meta?: ConnectRequestMeta } = {},
): Promise<void> {
  try {
    const actorName = await resolveDisplayName(principal.uid, principal.tenantId, deps);
    const entry: ConnectAuditEntry = {
      id: auditId(),
      action,
      actorUid: principal.uid,
      actorName,
      conversationId: conversation.id,
      conversationName: conversation.name,
      targetUid: opts.targetUid,
      targetName: opts.targetName,
      realm: conversation.realm,
      tenantId: principal.tenantId,
      metadata: opts.metadata,
      createdAt: nowISO(),
      ip: opts.meta?.ip,
      userAgent: opts.meta?.userAgent,
    };
    await deps.auditLog.create(entry);
  } catch (e) {
    console.error("[connect-audit] yazım hatası:", e);
  }
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

/**
 * Öğrencinin AKTİF/tamamlanmış kayıtlarından bağımsız olarak (client'a güvenmeden)
 * hesaplanan "kendi eğitmenleri" kümesi — `targetUid` bunlardan biri mi diye
 * doğrulanır. `/api/flexos/student/connect/trainer-directory` İLE AYNI hesap,
 * ama bu servis fonksiyonu kendi başına, dizine güvenmeden yeniden hesaplar.
 */
async function isStudentsOwnTrainer(
  principal: ConnectPrincipal,
  targetUid: string,
  deps: Pick<ConnectDeps, "enrollments" | "groups" | "trainers">,
): Promise<boolean> {
  if (!principal.personId) return false;
  const enrollments = await deps.enrollments.listByPerson(principal.personId, principal.tenantId);
  const groupIds = [
    ...new Set(
      enrollments
        .filter((e) => (e.status === "active" || e.status === "completed") && e.groupId)
        .map((e) => e.groupId!),
    ),
  ];
  const groups = (await Promise.all(groupIds.map((id) => deps.groups.getById(id, principal.tenantId)))).filter(
    (g): g is Group => !!g,
  );
  const trainerIds = [...new Set(groups.map((g) => g.trainerId).filter((id): id is string => !!id))];
  const trainers = await Promise.all(trainerIds.map((id) => deps.trainers.getById(id, principal.tenantId)));
  return trainers.some((t) => t?.authUid === targetUid);
}

/** Aynı iki kişi arasında zaten bir DM varsa onu döner — dizinden tekrar
 * tıklayınca (Personel/Öğrenciler/Eğitmenlerim) yeni bir kopya oluşmasın. */
async function findExistingDm(
  principal: ConnectPrincipal,
  targetUid: string,
  deps: ConnectDeps,
): Promise<ConnectConversation | null> {
  const memberships = await deps.conversations.listMembershipsForUid(principal.uid);
  if (memberships.length === 0) return null;
  const convs = await deps.conversations.getConversationsByIds(
    memberships.map((m) => m.conversationId),
    principal.tenantId,
  );
  for (const c of convs.filter((c) => c.type === "dm")) {
    const member = await deps.conversations.getMember(c.id, targetUid);
    if (member) return c;
  }
  return null;
}

/**
 * Yeni konuşma oluşturur — gated: SADECE `staff` çağıran oluşturabilir (Faz 1
 * kararı: öğrenci tarafında kanal/grup/topluluk "Yeni" YOK, server defansif
 * reddeder). TEK istisna (2026-07-18 kullanıcı isteği): öğrenci KENDİ eğitmenine
 * DM başlatabilir — bkz. `isStudentsOwnTrainer`.
 */
export async function createConversation(
  principal: ConnectPrincipal,
  input: CreateConversationInput,
  deps: ConnectDeps,
  meta?: ConnectRequestMeta,
): Promise<ConnectConversation> {
  if (principal.kind !== "staff") {
    const isOwnTrainerDm =
      principal.kind === "student" &&
      input.type === "dm" &&
      input.realm === "trainer_student" &&
      input.memberUids.length === 1 &&
      (await isStudentsOwnTrainer(principal, input.memberUids[0], deps));
    if (!isOwnTrainerDm) throw new ForbiddenError("connect.conversation.create");
  }

  const name = input.name.trim();
  if (input.type !== "dm" && !name) throw new ValidationError("Konuşma adı zorunludur.");
  if (input.type === "community" && (input.childIds?.length ?? 0) < 2) {
    throw new ValidationError("Topluluk en az 2 grup içermelidir.");
  }
  if (input.type === "dm" && input.memberUids.length !== 1) {
    throw new ValidationError("Özel mesaj tam olarak bir hedef kullanıcı gerektirir.");
  }
  if (input.audience && input.realm !== "trainer_student") {
    throw new ValidationError("Audience sadece trainer_student realm'inde kullanılabilir.");
  }

  if (input.type === "dm") {
    const existing = await findExistingDm(principal, input.memberUids[0], deps);
    if (existing) return existing;
  }
  if (input.type === "group" && input.sourceGroupId) {
    const existing = await deps.conversations.findBySourceGroupId(principal.tenantId, input.sourceGroupId);
    if (existing) return existing;
  }

  // Yayıncılar (+ oluşturan) — kanalda GERÇEKTEN yazabilecekler (admins). "Personel
  // Kanalı" (broadcastToAllStaff) okuyucu listesini bundan AYRI, aşağıda genişletir —
  // Yayıncı seçimi okuyucu kümesini BELİRLEMEZ, sadece yazma hakkı verir.
  const explicitMemberUids = [...new Set([principal.uid, ...input.memberUids])];

  let readerUids = explicitMemberUids;
  if (input.type === "channel") {
    const extraReaders = new Set(readerUids);
    if (input.realm === "staff" && input.broadcastToAllStaff) {
      const allStaff = await deps.flexosUsers.list(principal.tenantId);
      allStaff
        .filter((u) => u.authUid && u.status === "aktif" && u.roles.some((r) => r !== "ogrenci"))
        .forEach((u) => extraReaders.add(u.authUid!));
    }
    for (const uid of input.readerUids ?? []) extraReaders.add(uid);
    readerUids = [...extraReaders];
  }
  await assertMembersMatchRealm(readerUids, input.realm, principal.tenantId, deps);

  const writePolicy: ConnectWritePolicy = input.type === "channel" ? (input.writePolicy ?? "admins") : "members";
  const now = nowISO();

  const conversation: ConnectConversation = {
    id: deps.conversations.nextConversationId(),
    tenantId: principal.tenantId,
    realm: input.realm,
    type: input.type,
    name,
    description: input.description?.trim() || undefined,
    colorKey: input.colorKey,
    writePolicy,
    // Kanal: "Yayıncılar" olarak seçilenler GERÇEKTEN yazabilsin diye admins'e de
    // eklenir (2026-07-18 kullanıcı bulgusu — önceden SADECE oluşturan admin
    // oluyordu, seçilen "Yayıncılar" sessizce salt-okunur üye kalıyordu, isim/
    // gerçek davranış uyuşmuyordu). Grup/topluluk/dm'de değişmedi (writePolicy
    // "members" olduğu için admins sadece ekle/çıkar yetkisinde rol oynar).
    admins: input.type === "channel" ? explicitMemberUids : [principal.uid],
    audience: input.audience,
    childIds: input.type === "community" ? input.childIds : undefined,
    announcementChannelId: input.type === "community" ? input.announcementChannelId : undefined,
    sourceGroupId: input.type === "group" ? input.sourceGroupId : undefined,
    lastMessage: null,
    messageCount: 0,
    ownerUid: principal.uid,
    createdAt: now,
    createdBy: principal.uid,
  };
  await deps.conversations.saveConversation(conversation);

  await Promise.all(
    readerUids.map((uid) =>
      deps.conversations.saveMember(conversation.id, {
        uid,
        realm: input.realm,
        role: uid === principal.uid ? "owner" : "member",
        joinedAt: now,
      }),
    ),
  );

  // "N kişi gruba eklendi" sistem mesajı (2026-07-20) — SADECE grup, oluşturan
  // (owner) kendi eklediği için sayılmaz (WhatsApp'ta da "You added X" oluşturan
  // hariç sayılır).
  if (input.type === "group") {
    await insertSystemMessage(conversation, readerUids.length - 1, deps);
  }

  // Yönetimsel işlem — kanal/grup/topluluk oluşturma audit'e yazılır (dm hariç,
  // kullanıcının kapsam listesinde DM oluşturma yok).
  const auditAction: ConnectAuditAction | null =
    input.type === "channel"
      ? input.audience
        ? "audience_channel.create"
        : "channel.create"
      : input.type === "group"
        ? "group.create"
        : input.type === "community"
          ? "community.create"
          : null;
  if (auditAction) {
    await logAudit(deps, principal, conversation, auditAction, {
      metadata: { type: input.type, audience: input.audience ?? null, broadcastToAllStaff: !!input.broadcastToAllStaff, memberCount: readerUids.length },
      meta,
    });
  }

  return conversation;
}

function assertCanRead(conversation: ConnectConversation, member: ConnectMember | null): void {
  const audienceOpen = conversation.realm === "trainer_student" && conversation.audience === "all_students";
  if (!member && !audienceOpen) throw new ForbiddenError("connect.conversation.read");
}

function assertCanWrite(conversation: ConnectConversation, principalUid: string, member: ConnectMember | null): void {
  if (conversation.writePolicy === "admins") {
    if (!conversation.admins.includes(principalUid)) throw new ForbiddenError("connect.message.write");
    return;
  }
  if (!member) throw new ForbiddenError("connect.message.write");
}

/** Tekil konuşma — okuma yetkisi doğrulanır (üyelik VEYA audience köprüsü). */
export async function getConversation(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
): Promise<ConnectConversation> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  assertCanRead(conversation, member);
  return conversation;
}

/**
 * "Bana ait konuşmalar" — izolasyonun bel kemiği (FLEX_CONNECT.md §3): üyelikler
 * (`collectionGroup(members)`) ∪ audience köprü kanalları (öğrenci için: Öğrenci
 * İşleri/Kurum Duyuruları gibi üye OLMADIĞI ama okuduğu resmi kanallar).
 */
export async function listConversationsForPrincipal(
  principal: ConnectPrincipal,
  deps: ConnectDeps,
): Promise<{ conversation: ConnectConversation; member: ConnectMember | null }[]> {
  const memberships = await deps.conversations.listMembershipsForUid(principal.uid);
  // Defansif: öğrenci ASLA staff realm üyeliğine sahip olamaz (servis zaten hiç
  // eklemez) — yine de burada da süzülür, çift katman.
  const relevantMemberships =
    principal.kind === "student" ? memberships.filter((m) => m.member.realm === "trainer_student") : memberships;

  const memberConvIds = relevantMemberships.map((m) => m.conversationId);
  const memberConvs = await deps.conversations.getConversationsByIds(memberConvIds, principal.tenantId);
  const memberMap = new Map(relevantMemberships.map((m) => [m.conversationId, m.member]));

  const results = memberConvs.map((conversation) => ({ conversation, member: memberMap.get(conversation.id) ?? null }));

  // Audience köprüsü — trainer_student realm'de audience:"all_students" olan,
  // üyesi OLMADIĞIM konuşmalar (personel de görebilir, zararsız — bkz. rules yorumu).
  const audienceConvs = await deps.conversations.listConversationsByAudience(
    principal.tenantId,
    "trainer_student",
    "all_students",
  );
  for (const conversation of audienceConvs) {
    if (!memberMap.has(conversation.id)) results.push({ conversation, member: null });
  }

  // "Sohbeti Sil" (kişisel gizleme, 2026-07-20) — karşı taraftan YENİ mesaj gelip
  // messageCount artana kadar bu DM listeden düşer (bkz. `hideConversationForMe`).
  return results.filter(
    ({ conversation, member }) =>
      !(conversation.type === "dm" && member?.hiddenAtMessageCount !== undefined && conversation.messageCount <= member.hiddenAtMessageCount),
  );
}

/**
 * WhatsApp çift GRİ tik (2026-07-22) — konuşma LİSTESİ her çekildiğinde (`ConnectWidget`
 * zaten 30sn'de bir + her sayfa yüklemesinde) çağrılır: `conversation.lastMessage`
 * çağıranın kendi mesajı DEĞİLSE ve üyenin `lastDeliveredAt`'i bu mesajdan eskiyse
 * (veya hiç yoksa) `lastDeliveredAt`'i bumper. Konuşma listesini gerçekten ÇEKMİŞ
 * olmak "istemciye ulaştı" için makul bir gerçek sinyal — yeni bir realtime altyapı
 * gerektirmez. Sadece gerçekten değişen üyeler yazılır (poll başına genelde 0 yazma).
 * Non-fatal (ana isteği asla bloklamaz/başarısız kılmaz).
 */
export async function markDeliveredFromList(
  principal: ConnectPrincipal,
  items: { conversation: ConnectConversation; member: ConnectMember | null }[],
  deps: ConnectDeps,
): Promise<void> {
  const updates = items.filter(({ conversation, member }) => {
    if (!member || !conversation.lastMessage) return false;
    if (conversation.lastMessage.senderUid === principal.uid) return false;
    return !member.lastDeliveredAt || member.lastDeliveredAt < conversation.lastMessage.at;
  });
  if (updates.length === 0) return;
  try {
    await Promise.all(
      updates.map(({ conversation, member }) =>
        deps.conversations.saveMember(conversation.id, { ...member!, lastDeliveredAt: conversation.lastMessage!.at }),
      ),
    );
  } catch (e) {
    console.error("[connect-service] markDeliveredFromList başarısız (non-fatal):", e);
  }
}

/**
 * "Sohbeti Sil" (2026-07-20 kullanıcı kararı) — WhatsApp'taki "Sohbeti Sil" gibi
 * KİŞİSEL bir gizleme, gerçek/kalıcı silme DEĞİL: SADECE çağıranın kendi listesinden
 * kaybolur, karşı tarafın görünümü HİÇ etkilenmez, mesajlar SİLİNMEZ. Karşı taraf
 * yeni mesaj yazarsa `messageCount` artar ve DM otomatik geri görünür.
 * SADECE `type==="dm"`. Yetki: `realm==="trainer_student"` DM'lerde SADECE personel
 * (eğitmen) gizleyebilir, öğrenci gizleyemez (kullanıcı kararı) — `realm==="staff"`
 * DM'lerinde iki taraf da personel olduğu için (öğrenci staff realm'e giremez) bu
 * kısıtlama otomatik olarak geçersiz kalır.
 */
export async function hideConversationForMe(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  if (conversation.type !== "dm") throw new ValidationError("Bu işlem sadece birebir sohbetler için geçerli.");
  if (conversation.realm === "trainer_student" && principal.kind !== "staff") {
    throw new ForbiddenError("connect.conversation.hide");
  }
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  if (!member) throw new ValidationError("Bu konuşmanın üyesi değilsin.");
  await deps.conversations.saveMember(conversationId, { ...member, hiddenAtMessageCount: conversation.messageCount ?? 0 });
}

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
  return messages.filter((m) => !m.hiddenFor?.includes(principal.uid));
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
  const results: { conversation: ConnectConversation; message: ConnectMessage }[] = [];
  for (const { conversationId, message } of raw) {
    const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
    if (!conversation) continue;
    const member = await deps.conversations.getMember(conversationId, principal.uid);
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

/**
 * Sabitleme (Favoriler) tercihi — SADECE kendi member dokümanı, yetki gerektirmez
 * (herkes kendi konuşmasını sabitleyebilir/kaldırabilir). `markRead` ile AYNI
 * ilke: üye değilse (audience-only okuyucu) no-op. Kişisel tercih olduğu için
 * Audit Log'a YAZILMAZ (yönetimsel işlem değil).
 */
export async function setPinned(
  principal: ConnectPrincipal,
  conversationId: string,
  pinned: boolean,
  deps: ConnectDeps,
): Promise<void> {
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  if (!member) return;
  await deps.conversations.saveMember(conversationId, { ...member, pinned });
}

/**
 * Arşivle/arşivden çıkar (2026-07-22) — `hideConversationForMe` ile AYNI stateless
 * ilke (`archivedAtMessageCount`, bkz. `connect.ts`) ama `type==="dm"`/staff-only
 * kısıtı YOK: yıkıcı değil (kalıcı silme değil, sadece varsayılan listeden gizleme),
 * her konuşma tipinde herkes kendi görünümünü arşivleyebilir. Karşı taraftan yeni
 * mesaj gelince `messageCount` artıp otomatik geri çıkar — ekstra yazma gerekmez.
 */
export async function setArchived(
  principal: ConnectPrincipal,
  conversationId: string,
  archived: boolean,
  deps: ConnectDeps,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) return;
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  if (!member) return;
  await deps.conversations.saveMember(conversationId, {
    ...member,
    archivedAtMessageCount: archived ? conversation.messageCount ?? 0 : undefined,
  });
}

/**
 * Sessize alma (2026-07-19) — `setPinned` ile AYNI ilke: sadece kendi member
 * dokümanı, yetki gerektirmez, Audit Log'a yazılmaz. `connect-push-service.ts`
 * `notifyNewMessage` bu bayrağı okuyup sessize alınmış konuşmalardan push
 * göndermez (mesajın kendisi yine de normal akar, sadece bildirim tetiklenmez).
 */
export async function setMuted(
  principal: ConnectPrincipal,
  conversationId: string,
  muted: boolean,
  deps: ConnectDeps,
): Promise<void> {
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  if (!member) return;
  await deps.conversations.saveMember(conversationId, { ...member, muted });
}

export async function resolveDisplayName(
  uid: string,
  tenantId: string,
  deps: Pick<ConnectDeps, "persons" | "flexosUsers">,
): Promise<string> {
  const person = await deps.persons.findByAuthUid(uid, tenantId);
  if (person) return `${person.firstName} ${person.lastName}`.trim();
  const user = await deps.flexosUsers.findByAuthUid(uid, tenantId);
  if (user) return `${user.name} ${user.surname}`.trim();
  return "Kullanıcı";
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

/** Üye ekle — SADECE owner/admin. Realm uyuşmazlığı (öğrenci→staff) reddedilir. */
export async function addMember(
  principal: ConnectPrincipal,
  conversationId: string,
  targetUid: string,
  role: ConnectMemberRole,
  deps: ConnectDeps,
  meta?: ConnectRequestMeta,
  /** SADECE role==="guest" (Faz 2 madde 4, 2026-07-18) — tasarımdaki "Yardımcı
   * Eğitmen/Gözlemci/Konuk/Veli" gibi açıklayıcı etiket. Yetki/izolasyonu ETKİLEMEZ,
   * SADECE üye listesinde görünen bir rozet — misafir de normal üye gibi okur/yazar
   * (grubun writePolicy'sine göre), ayrı bir kısıtlı yetki katmanı YOK (kapsam kararı). */
  guestTitle?: string,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  if (!conversation.admins.includes(principal.uid)) throw new ForbiddenError("connect.member.add");

  await assertMembersMatchRealm([targetUid], conversation.realm, principal.tenantId, deps);
  const existing = await deps.conversations.getMember(conversationId, targetUid);
  if (existing) return; // zaten üye

  await deps.conversations.saveMember(conversationId, {
    uid: targetUid,
    realm: conversation.realm,
    role,
    joinedAt: nowISO(),
    guestTitle: role === "guest" ? guestTitle : undefined,
  });

  // "1 kişi gruba eklendi" sistem mesajı (2026-07-20) — SADECE grup, createConversation'ın
  // toplu roster seed'iyle AYNI ilke (bkz. `insertSystemMessage`).
  if (conversation.type === "group") {
    await insertSystemMessage(conversation, 1, deps);
  }

  const targetName = await resolveDisplayName(targetUid, principal.tenantId, deps);
  await logAudit(deps, principal, conversation, "member.add", { targetUid, targetName, metadata: { role, guestTitle }, meta });
}

/** Üye çıkar — owner/admin BAŞKASINI çıkarabilir; herkes KENDİNİ çıkarabilir (ayrıl). */
export async function removeMember(
  principal: ConnectPrincipal,
  conversationId: string,
  targetUid: string,
  deps: ConnectDeps,
  meta?: ConnectRequestMeta,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const isSelf = targetUid === principal.uid;
  if (!isSelf && !conversation.admins.includes(principal.uid)) throw new ForbiddenError("connect.member.remove");
  if (targetUid === conversation.ownerUid) throw new ValidationError("Konuşma sahibi çıkarılamaz.");

  await deps.conversations.deleteMember(conversationId, targetUid);

  const targetName = await resolveDisplayName(targetUid, principal.tenantId, deps);
  await logAudit(deps, principal, conversation, "member.remove", { targetUid, targetName, metadata: { isSelf }, meta });
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

/**
 * Kanal/grup/topluluk adı, açıklaması, (kanalda) yayıncı listesi, (toplulukta)
 * grup listesi — kuruluş sonrası düzenleme. SADECE owner/admin. DM düzenlenemez
 * (adı karşı taraftan çözülür, sabit). `admins` değişirse realm uyuşmazlığı
 * (öğrenci→staff) `assertMembersMatchRealm` ile AYNI şekilde reddedilir —
 * addMember'daki kural.
 */
export async function updateConversationMeta(
  principal: ConnectPrincipal,
  conversationId: string,
  input: UpdateConversationMetaInput,
  deps: ConnectDeps,
  meta?: ConnectRequestMeta,
): Promise<ConnectConversation> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  if (conversation.type === "dm") throw new ValidationError("DM düzenlenemez.");
  if (!conversation.admins.includes(principal.uid)) throw new ForbiddenError("connect.conversation.update");

  const updated: ConnectConversation = { ...conversation };
  const changedFields: string[] = [];

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new ValidationError("Ad boş olamaz.");
    updated.name = trimmed;
    changedFields.push("name");
  }
  if (input.description !== undefined) {
    updated.description = input.description.trim() || undefined;
    changedFields.push("description");
  }
  if (input.adminUids !== undefined) {
    if (conversation.type !== "channel") throw new ValidationError("Yayıncı listesi sadece kanallarda düzenlenebilir.");
    const nextAdmins = Array.from(new Set([conversation.ownerUid, ...input.adminUids]));
    await assertMembersMatchRealm(nextAdmins, conversation.realm, principal.tenantId, deps);
    updated.admins = nextAdmins;
    changedFields.push("admins");
  }
  if (input.childIds !== undefined) {
    if (conversation.type !== "community") throw new ValidationError("Grup listesi sadece topluluklarda düzenlenebilir.");
    if (input.childIds.length < 2) throw new ValidationError("Topluluk en az 2 grup içermelidir.");
    const children = await deps.conversations.getConversationsByIds(input.childIds, principal.tenantId);
    if (children.length !== new Set(input.childIds).size) throw new ValidationError("Seçilen gruplardan biri bulunamadı.");
    if (children.some((c) => c.type !== "group")) throw new ValidationError("Topluluk sadece grup konuşmalarını içerebilir.");
    updated.childIds = [...new Set(input.childIds)];
    changedFields.push("childIds");
  }

  if (changedFields.length === 0) return conversation;

  // Yeni Yayıncı'nın gerçekten okuyabilmesi için `members/{uid}` dokümanı da
  // gerekir (Firestore rules `isConnectMember` buna bakar) — SADECE admins[]'e
  // eklemek yetmez (2026-07-18 bulgusu, admin ekleme UI'ı ile birlikte fark
  // edildi). Çıkarılanlar üyelikten ATILMAZ, SADECE "admin" rozeti geri "member"
  // olur (okuyucu olarak kalır — WhatsApp'ta da Yayıncılıktan çıkarma gruptan
  // atmaz).
  if (input.adminUids !== undefined) {
    const oldAdmins = new Set(conversation.admins);
    const newAdmins = new Set(updated.admins);
    for (const uid of updated.admins) {
      if (oldAdmins.has(uid)) continue;
      const existing = await deps.conversations.getMember(conversationId, uid);
      await deps.conversations.saveMember(conversationId, {
        ...(existing ?? { uid, realm: conversation.realm, joinedAt: nowISO() }),
        role: "admin",
      });
    }
    for (const uid of conversation.admins) {
      if (newAdmins.has(uid) || uid === conversation.ownerUid) continue;
      const existing = await deps.conversations.getMember(conversationId, uid);
      if (existing && existing.role === "admin") {
        await deps.conversations.saveMember(conversationId, { ...existing, role: "member" });
      }
    }
  }

  // Topluluğa YENİ eklenen grubun rosteru, bağlı "Genel Duyuru" kanalına GERÇEKTEN
  // okuyucu olarak eklenir (2026-07-18, kullanıcı isteği — sadece `childIds` listesi
  // güncellemek yeterli değil, aksi halde yeni grubun öğrencileri duyuruyu hiç
  // görmez). `announcementChannelId` yoksa (eski topluluklar) sessizce atlanır —
  // childIds yine de güncellenir, sadece otomatik köprü kurulamaz.
  if (input.childIds !== undefined && conversation.announcementChannelId) {
    const oldChildren = new Set(conversation.childIds ?? []);
    const newlyAdded = updated.childIds!.filter((id) => !oldChildren.has(id));
    for (const groupConvId of newlyAdded) {
      const roster = await deps.conversations.listMembers(groupConvId);
      for (const m of roster) {
        const existing = await deps.conversations.getMember(conversation.announcementChannelId, m.uid);
        if (existing) continue; // zaten okuyucu (ör. başka bir gruptan zaten eklenmiş)
        await deps.conversations.saveMember(conversation.announcementChannelId, {
          uid: m.uid,
          realm: "trainer_student",
          role: "member",
          joinedAt: nowISO(),
        });
      }
    }
  }

  await deps.conversations.saveConversation(updated);
  const action: ConnectAuditAction = changedFields.includes("childIds") ? "community.child_groups.update" : "conversation.settings.update";
  await logAudit(deps, principal, conversation, action, { metadata: { changedFields }, meta });
  return updated;
}

/**
 * Konuşmayı SİL — SADECE owner (admin/yayıncı yeterli değil, en yüksek yetki).
 * DM silinemez (ayrılma zaten var). Alt-koleksiyonlar (`members`/`messages`/
 * `typing`) repo katmanında `recursiveDelete` ile temizlenir. Topluluk silinince
 * paketlediği grup konuşmaları ETKİLENMEZ (`childIds` sadece topluluğun kendi
 * dokümanında, bağımsız konuşmalar).
 */
export async function deleteConversation(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
  meta?: ConnectRequestMeta,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  if (conversation.type === "dm") throw new ValidationError("DM silinemez.");
  if (conversation.ownerUid !== principal.uid) throw new ForbiddenError("connect.conversation.delete");

  await deps.conversations.deleteConversation(conversationId, principal.tenantId);

  const action: ConnectAuditAction =
    conversation.type === "channel" ? "channel.delete" : conversation.type === "group" ? "group.delete" : "community.delete";
  await logAudit(deps, principal, conversation, action, { meta });
}

export async function listMembers(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
): Promise<ConnectMember[]> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  assertCanRead(conversation, member);
  return deps.conversations.listMembers(conversationId);
}
