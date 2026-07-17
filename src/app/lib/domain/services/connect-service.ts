import type { ISODateTime } from "../base";
import type {
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
}

const MAX_MESSAGE_LEN = 4000;

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
  /** SADECE type==="group" && realm==="trainer_student" — bkz. `ConnectConversation.sourceGroupId`. */
  sourceGroupId?: string;
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

  const allMemberUids = [...new Set([principal.uid, ...input.memberUids])];
  await assertMembersMatchRealm(allMemberUids, input.realm, principal.tenantId, deps);

  const writePolicy: ConnectWritePolicy = input.type === "channel" ? "admins" : "members";
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
    admins: [principal.uid],
    audience: input.audience,
    childIds: input.type === "community" ? input.childIds : undefined,
    sourceGroupId: input.type === "group" ? input.sourceGroupId : undefined,
    lastMessage: null,
    messageCount: 0,
    ownerUid: principal.uid,
    createdAt: now,
    createdBy: principal.uid,
  };
  await deps.conversations.saveConversation(conversation);

  await Promise.all(
    allMemberUids.map((uid) =>
      deps.conversations.saveMember(conversation.id, {
        uid,
        realm: input.realm,
        role: uid === principal.uid ? "owner" : "member",
        joinedAt: now,
      }),
    ),
  );

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
      metadata: { type: input.type, audience: input.audience ?? null, memberCount: allMemberUids.length },
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

  return results;
}

/** Mesaj gönder — `writePolicy` uygulanır (channel=admins, group/dm/community=members). */
export async function sendMessage(
  principal: ConnectPrincipal,
  conversationId: string,
  text: string,
  deps: ConnectDeps,
): Promise<ConnectMessage> {
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Mesaj boş olamaz.");
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
  };
  const newMessageCount = (conversation.messageCount ?? 0) + 1;
  await deps.conversations.saveMessage(conversationId, message);
  await deps.conversations.saveConversation({
    ...conversation,
    lastMessage: { text: trimmed, senderUid: principal.uid, at: now },
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
  return deps.conversations.listMessages(conversationId, limit);
}

/**
 * Okundu işaretle — SADECE zaten üye olunan konuşmalarda anlamlı (üye dokümanı
 * yoksa no-op, bkz. FLEX_CONNECT.md: audience-only okuyucular için Faz 1'de
 * sunucu tarafı okunmamış sayacı tutulmaz, basitlik kararı).
 */
export async function markRead(principal: ConnectPrincipal, conversationId: string, deps: ConnectDeps): Promise<void> {
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  if (!member) return;
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  await deps.conversations.saveMember(conversationId, {
    ...member,
    lastReadAt: nowISO(),
    readMessageCount: conversation?.messageCount ?? member.readMessageCount ?? 0,
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

async function resolveDisplayName(
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
  });

  const targetName = await resolveDisplayName(targetUid, principal.tenantId, deps);
  await logAudit(deps, principal, conversation, "member.add", { targetUid, targetName, metadata: { role }, meta });
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
