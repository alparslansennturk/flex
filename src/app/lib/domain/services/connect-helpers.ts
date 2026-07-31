import type { ISODateTime } from "../base";
import type {
  ConnectConversation,
  ConnectMember,
  ConnectMessage,
  ConnectRealm,
} from "../core/connect";
import type { ConnectAuditAction, ConnectAuditEntry, ConnectRequestMeta } from "../core/connect-audit";
import type { Group } from "../core/group";
import { ForbiddenError, ValidationError } from "../errors";
import type { ConnectDeps, ConnectPrincipal } from "./connect-types";

export const MAX_MESSAGE_LEN = 4000;

export const ISTANBUL_TZ = "Europe/Istanbul";

export function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export function auditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * "X kişi gruba eklendi" sistem mesajı (2026-07-20, WhatsApp'taki gibi) — normal
 * mesajlarla AYNI `messages` alt-koleksiyonuna yazılır (okunmamış sayısı/sıralama
 * bozulmasın diye `messageCount` de AYNI şekilde artırılır). SADECE `type==="group"`
 * konuşmalarda çağrılır (`createConversation` roster seed'i + `addMember`).
 */
export async function insertSystemMessage(
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

/** Sunucunun İstanbul yerel saatine göre "şu an kaç dakika" hesabı — `attendance-
 * service.ts::istanbulNow` ile AYNI desen (Vercel runtime UTC varsayar, `Intl.
 * DateTimeFormat`'a açıkça timeZone verilir). */
export function istanbulMinutesOfDay(): number {
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
export function isAfterHoursStudentToTrainerDm(principal: ConnectPrincipal, conversation: ConnectConversation): boolean {
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

export async function assertMembersMatchRealm(
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
export async function logAudit(
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

/**
 * Öğrencinin AKTİF/tamamlanmış kayıtlarından bağımsız olarak (client'a güvenmeden)
 * hesaplanan "kendi eğitmenleri" kümesi — `targetUid` bunlardan biri mi diye
 * doğrulanır. `/api/flexos/student/connect/trainer-directory` İLE AYNI hesap,
 * ama bu servis fonksiyonu kendi başına, dizine güvenmeden yeniden hesaplar.
 */
export async function isStudentsOwnTrainer(
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
export async function findExistingDm(
  principal: ConnectPrincipal,
  targetUid: string,
  deps: ConnectDeps,
): Promise<ConnectConversation | null> {
  // Önceden her DM için ayrı `getMember` çağrısı vardı (N+1) — principal'ın kaç DM'i
  // varsa o kadar sıralı okuma. `listMembershipsForUid` targetUid için de zaten var,
  // tek ek çağrıyla (paralel) hedefin üyesi olduğu konuşma ID'leri kesişim alınarak bulunur.
  const [memberships, targetMemberships] = await Promise.all([
    deps.conversations.listMembershipsForUid(principal.uid),
    deps.conversations.listMembershipsForUid(targetUid),
  ]);
  if (memberships.length === 0) return null;
  const targetConvIds = new Set(targetMemberships.map((m) => m.conversationId));
  const sharedIds = memberships.map((m) => m.conversationId).filter((id) => targetConvIds.has(id));
  if (sharedIds.length === 0) return null;
  const convs = await deps.conversations.getConversationsByIds(sharedIds, principal.tenantId);
  return convs.find((c) => c.type === "dm") ?? null;
}

export function assertCanRead(conversation: ConnectConversation, member: ConnectMember | null): void {
  const audienceOpen = conversation.realm === "trainer_student" && conversation.audience === "all_students";
  if (!member && !audienceOpen) throw new ForbiddenError("connect.conversation.read");
}

export function assertCanWrite(conversation: ConnectConversation, principalUid: string, member: ConnectMember | null): void {
  if (conversation.writePolicy === "admins") {
    if (!conversation.admins.includes(principalUid)) throw new ForbiddenError("connect.message.write");
    return;
  }
  if (!member) throw new ForbiddenError("connect.message.write");
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
