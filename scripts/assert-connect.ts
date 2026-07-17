/**
 * Flex Connect — Faz 1 backend assertion'ları. Odak: İZOLASYON (öğrenci `staff`
 * realm'i asla göremez/yazamaz) + writePolicy + realm doğrulaması.
 * npx tsx scripts/assert-connect.ts
 */
import type { ConnectConversation, ConnectMember, ConnectMessage } from "../src/app/lib/domain/core/connect";
import type { ConnectAuditEntry } from "../src/app/lib/domain/core/connect-audit";
import type { ConnectRepo } from "../src/app/lib/domain/repo/connect-repo";
import type { PersonRepo } from "../src/app/lib/domain/repo/person-repo";
import type { FlexosUserRepo } from "../src/app/lib/domain/repo/flexos-user-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { TrainerRepo } from "../src/app/lib/domain/repo/trainer-repo";
import type { Person } from "../src/app/lib/domain/core/person";
import type { FlexosUser } from "../src/app/lib/domain/core/flexos-user";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Trainer } from "../src/app/lib/domain/core/trainer";
import {
  createConversation,
  listConversationsForPrincipal,
  sendMessage,
  listMessages,
  markRead,
  addMember,
  removeMember,
  setPinned,
  type ConnectPrincipal,
  type ConnectDeps,
} from "../src/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeConnectRepo(): ConnectRepo {
  const conversations = new Map<string, ConnectConversation>();
  const members = new Map<string, Map<string, ConnectMember>>();
  const messages = new Map<string, ConnectMessage[]>();
  const typing = new Map<string, Map<string, { uid: string; name: string; at: string }>>();
  let convSeq = 0;
  let msgSeq = 0;

  return {
    nextConversationId: () => `conv-${++convSeq}`,
    nextMessageId: () => `msg-${++msgSeq}`,
    async saveConversation(c) { conversations.set(c.id, { ...c }); },
    async getConversationById(id, tenantId) {
      const c = conversations.get(id);
      return c && c.tenantId === tenantId ? c : null;
    },
    async listConversationsByAudience(tenantId, realm, audience) {
      return Array.from(conversations.values()).filter((c) => c.tenantId === tenantId && c.realm === realm && c.audience === audience);
    },
    async getConversationsByIds(ids, tenantId) {
      return ids.map((id) => conversations.get(id)).filter((c): c is ConnectConversation => !!c && c.tenantId === tenantId);
    },
    async deleteConversation(id) { conversations.delete(id); members.delete(id); messages.delete(id); },
    async findBySourceGroupId(tenantId, sourceGroupId) {
      return [...conversations.values()].find((c) => c.tenantId === tenantId && c.sourceGroupId === sourceGroupId) ?? null;
    },
    async saveMember(conversationId, member) {
      if (!members.has(conversationId)) members.set(conversationId, new Map());
      members.get(conversationId)!.set(member.uid, { ...member });
    },
    async getMember(conversationId, uid) { return members.get(conversationId)?.get(uid) ?? null; },
    async listMembers(conversationId) { return Array.from(members.get(conversationId)?.values() ?? []); },
    async deleteMember(conversationId, uid) { members.get(conversationId)?.delete(uid); },
    async listMembershipsForUid(uid) {
      const result: { conversationId: string; member: ConnectMember }[] = [];
      for (const [conversationId, memberMap] of members) {
        const m = memberMap.get(uid);
        if (m) result.push({ conversationId, member: m });
      }
      return result;
    },
    async saveMessage(conversationId, message) {
      if (!messages.has(conversationId)) messages.set(conversationId, []);
      messages.get(conversationId)!.push({ ...message });
    },
    async listMessages(conversationId) { return [...(messages.get(conversationId) ?? [])]; },
    async setTyping(conversationId, uid, name, at) {
      if (!typing.has(conversationId)) typing.set(conversationId, new Map());
      typing.get(conversationId)!.set(uid, { uid, name, at });
    },
    async listTyping(conversationId) { return Array.from(typing.get(conversationId)?.values() ?? []); },
  };
}

function fakePerson(authUid: string, id: string): Person {
  return {
    id, tenantId: TENANT, firstName: "Öğrenci", lastName: id, status: "active", consentKVKK: true, authUid,
    createdAt: new Date().toISOString(), createdBy: "seed",
  };
}
function fakeFlexosUser(authUid: string, id: string, roles: string[]): FlexosUser {
  return {
    id, tenantId: TENANT, name: "Personel", surname: id, email: `${id}@test.com`, gender: "unspecified",
    roles, subes: [], status: "aktif", authUid,
    createdAt: new Date().toISOString(), createdBy: "seed",
  };
}

function makePersonRepo(seed: Person[]): PersonRepo {
  const map = new Map(seed.map((p) => [p.id, p]));
  return {
    nextId: () => `person-${map.size + 1}`,
    async save(p) { map.set(p.id, { ...p }); },
    async getById(id, tid) { const p = map.get(id); return p && p.tenantId === tid ? p : null; },
    async getByIds(ids, tid) { return ids.map((id) => map.get(id)).filter((p): p is Person => !!p && p.tenantId === tid); },
    async findByIdNo() { return null; },
    async findByAuthUid(authUid, tid) { return [...map.values()].find((p) => p.tenantId === tid && p.authUid === authUid) ?? null; },
    async getByAuthUids(authUids, tid) { return [...map.values()].filter((p) => p.tenantId === tid && authUids.includes(p.authUid ?? "")); },
    async list(tid) { return [...map.values()].filter((p) => p.tenantId === tid); },
    async update(id, tid, data) { const p = map.get(id); if (p && p.tenantId === tid) map.set(id, { ...p, ...data }); },
    async clearAuthUid(id, tid) { const p = map.get(id); if (p && p.tenantId === tid) map.set(id, { ...p, authUid: undefined }); },
    async delete(id, tid) { const p = map.get(id); if (p && p.tenantId === tid) map.delete(id); },
  };
}

function makeGroupRepo(seed: Group[]): GroupRepo {
  const map = new Map(seed.map((g) => [g.id, g]));
  return {
    nextId: () => `group-${map.size + 1}`,
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) { const g = map.get(id); return g && g.tenantId === tid ? g : null; },
    async list(tid, trainerId) { return [...map.values()].filter((g) => g.tenantId === tid && (!trainerId || g.trainerId === trainerId)); },
    async delete(id) { map.delete(id); },
  };
}

function makeEnrollmentRepo(seed: Enrollment[]): EnrollmentRepo {
  const map = new Map(seed.map((e) => [e.id, e]));
  return {
    nextId: () => `enr-${map.size + 1}`,
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async findActive(personId, groupId, tid) {
      return [...map.values()].find((e) => e.tenantId === tid && e.personId === personId && e.groupId === groupId && e.status === "active") ?? null;
    },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
    async listByGroup(groupId, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId === groupId); },
    async listByGroupIds(groupIds, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId && groupIds.includes(e.groupId)); },
    async listBySale(saleId, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.saleId === saleId); },
    async listByPerson(personId, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.personId === personId); },
    async delete(id) { map.delete(id); },
  };
}

function makeTrainerRepo(seed: Trainer[]): TrainerRepo {
  const map = new Map(seed.map((t) => [t.id, t]));
  return {
    nextId: () => `trainer-${map.size + 1}`,
    async save(t) { map.set(t.id, { ...t }); },
    async getById(id, tid) { const t = map.get(id); return t && t.tenantId === tid ? t : null; },
    async list(tid) { return [...map.values()].filter((t) => t.tenantId === tid); },
    async delete(id) { map.delete(id); },
    async findByAuthUid(authUid, tid) { return [...map.values()].find((t) => t.tenantId === tid && t.authUid === authUid) ?? null; },
  };
}

function makeFlexosUserRepo(seed: FlexosUser[]): FlexosUserRepo {
  const map = new Map(seed.map((u) => [u.id, u]));
  return {
    nextId: () => `user-${map.size + 1}`,
    async save(u) { map.set(u.id, { ...u }); },
    async getById(id, tid) { const u = map.get(id); return u && u.tenantId === tid ? u : null; },
    async getByEmail(email, tid) { return [...map.values()].find((u) => u.tenantId === tid && u.email === email) ?? null; },
    async findByAuthUid(authUid, tid) { return [...map.values()].find((u) => u.tenantId === tid && u.authUid === authUid) ?? null; },
    async getByAuthUids(authUids, tid) { return [...map.values()].filter((u) => u.tenantId === tid && authUids.includes(u.authUid ?? "")); },
    async list(tid) { return [...map.values()].filter((u) => u.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}
async function assertRejects(label: string, fn: () => Promise<unknown>, errType: typeof ForbiddenError | typeof ValidationError) {
  try {
    await fn();
    assert(label, false);
  } catch (e) {
    assert(label, e instanceof errType);
  }
}

async function main() {
  console.log("\n=== Flex Connect — Faz 1 Assertions ===\n");

  // ── Aktörler ──
  const staffA: ConnectPrincipal = { tenantId: TENANT, uid: "staff-a", kind: "staff" };
  const staffB: ConnectPrincipal = { tenantId: TENANT, uid: "staff-b", kind: "staff" };
  const trainer: ConnectPrincipal = { tenantId: TENANT, uid: "trainer-1", kind: "staff", trainerId: "trainer-doc-1" };
  const student: ConnectPrincipal = { tenantId: TENANT, uid: "student-1", kind: "student", personId: "person-1" };
  const student2: ConnectPrincipal = { tenantId: TENANT, uid: "student-2", kind: "student", personId: "person-2" };

  const persons = makePersonRepo([fakePerson("student-1", "person-1"), fakePerson("student-2", "person-2")]);
  const flexosUsers = makeFlexosUserRepo([
    fakeFlexosUser("staff-a", "user-a", ["admin"]),
    fakeFlexosUser("staff-b", "user-b", ["admin"]),
    fakeFlexosUser("trainer-1", "user-trainer", ["egitmen"]),
  ]);

  // person-1 (student-1) trainer-doc-1'in group-1'ine kayıtlı → "kendi eğitmenine
  // DM" istisnasını test etmek için (trainer-doc-1'in authUid'i trainer-1).
  const groups = makeGroupRepo([
    { id: "group-1", tenantId: TENANT, code: "GRP-1", status: "active", type: "standart", trainerId: "trainer-doc-1", schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 2 }, createdAt: new Date().toISOString(), createdBy: "seed" },
  ]);
  const enrollments = makeEnrollmentRepo([
    { id: "enr-1", tenantId: TENANT, personId: "person-1", groupId: "group-1", status: "active", createdAt: new Date().toISOString(), createdBy: "seed" },
  ]);
  const trainers = makeTrainerRepo([
    { id: "trainer-doc-1", tenantId: TENANT, name: "Trainer One", email: "trainer1@test.com", branchOffices: [], status: "aktif", competencies: {}, authUid: "trainer-1", createdAt: new Date().toISOString(), createdBy: "seed" },
  ]);

  function deps(): ConnectDeps & { auditEntries: ConnectAuditEntry[] } {
    const auditEntries: ConnectAuditEntry[] = [];
    return {
      conversations: makeConnectRepo(),
      persons,
      flexosUsers,
      auditLog: { async create(e) { auditEntries.push(e); } },
      auditEntries,
      enrollments,
      groups,
      trainers,
    };
  }

  // ── createConversation: realm/tip doğrulaması ──
  await assertRejects(
    "createConversation: öğrenci oluşturamaz — ForbiddenError",
    () => createConversation(student, { realm: "trainer_student", type: "group", name: "X", memberUids: [] }, deps()),
    ForbiddenError,
  );

  await assertRejects(
    "createConversation: staff realm'e öğrenci uid eklenemez — ForbiddenError",
    () => createConversation(staffA, { realm: "staff", type: "group", name: "İş Grubu", memberUids: ["student-1"] }, deps()),
    ForbiddenError,
  );

  await assertRejects(
    "createConversation: bilinmeyen uid — ValidationError",
    () => createConversation(staffA, { realm: "staff", type: "group", name: "X", memberUids: ["hayalet-uid"] }, deps()),
    ValidationError,
  );

  await assertRejects(
    "createConversation: dm tam 1 hedef gerektirir — ValidationError",
    () => createConversation(staffA, { realm: "staff", type: "dm", name: "", memberUids: ["staff-b", "staff-a"] }, deps()),
    ValidationError,
  );

  await assertRejects(
    "createConversation: audience sadece trainer_student'ta — ValidationError",
    () => createConversation(staffA, { realm: "staff", type: "channel", name: "X", memberUids: [], audience: "all_students" }, deps()),
    ValidationError,
  );

  // ── İZOLASYON: öğrenci staff realm'i asla göremez ──
  {
    const d = deps();
    const staffChannel = await createConversation(staffA, { realm: "staff", type: "channel", name: "Kurum İçi", memberUids: [staffB.uid] }, d);
    const staffGroup = await createConversation(staffA, { realm: "staff", type: "group", name: "İş Grubu", memberUids: [staffB.uid] }, d);

    const studentView = await listConversationsForPrincipal(student, d);
    assert(
      "İZOLASYON: öğrenci listConversationsForPrincipal'da staff kanal/grup GÖREMEZ",
      !studentView.some((v) => v.conversation.id === staffChannel.id || v.conversation.id === staffGroup.id),
    );

    await assertRejects(
      "İZOLASYON: öğrenci staff kanalın mesajlarını okuyamaz — ForbiddenError",
      () => listMessages(student, staffChannel.id, d),
      ForbiddenError,
    );
    await assertRejects(
      "İZOLASYON: öğrenci staff kanala yazamaz — ForbiddenError",
      () => sendMessage(student, staffChannel.id, "merhaba", d),
      ForbiddenError,
    );
  }

  // ── Audience köprüsü: öğrenci üye olmadan okur, yazamaz ──
  {
    const d = deps();
    const bridge = await createConversation(
      staffA,
      { realm: "trainer_student", type: "channel", name: "Öğrenci İşleri", memberUids: [], audience: "all_students" },
      d,
    );
    await sendMessage(staffA, bridge.id, "Duyuru: ödev tarihi uzatıldı.", d);

    const studentView = await listConversationsForPrincipal(student, d);
    assert("Audience köprüsü: öğrenci üye OLMADAN listede görür", studentView.some((v) => v.conversation.id === bridge.id));

    const msgs = await listMessages(student, bridge.id, d);
    assert("Audience köprüsü: öğrenci mesajları okuyabilir", msgs.length === 1 && msgs[0].text.includes("uzatıldı"));

    await assertRejects(
      "Audience köprüsü: öğrenci (admin değil) yazamaz — ForbiddenError",
      () => sendMessage(student, bridge.id, "ben de yazayım", d),
      ForbiddenError,
    );
  }

  // ── writePolicy: group/dm sadece üye yazar ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası", memberUids: [student.uid] }, d);

    await sendMessage(student, group.id, "Merhaba hocam", d);
    const msgs = await listMessages(trainer, group.id, d);
    assert("Grup: üye (öğrenci) yazabilir, eğitmen okuyabilir", msgs.length === 1);

    await assertRejects(
      "Grup: üye OLMAYAN öğrenci yazamaz — ForbiddenError",
      () => sendMessage(student2, group.id, "ben de varım", d),
      ForbiddenError,
    );
  }

  // ── addMember / removeMember yetkisi ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası 2", memberUids: [] }, d);

    await assertRejects(
      "addMember: owner/admin olmayan ekleyemez — ForbiddenError",
      () => addMember(student, group.id, student2.uid, "member", d),
      ForbiddenError,
    );

    await addMember(trainer, group.id, student.uid, "member", d);
    const afterAdd = await listMessages(student, group.id, d); // erişebiliyor mu kontrolü (boş liste dönerse hata atmaz)
    assert("addMember: eklenen öğrenci artık konuşmayı okuyabilir", Array.isArray(afterAdd));

    const staffOnlyConv = await createConversation(staffA, { realm: "staff", type: "group", name: "İş", memberUids: [] }, d);
    await assertRejects(
      "addMember: staff realm'e öğrenci eklenemez — ForbiddenError",
      () => addMember(staffA, staffOnlyConv.id, student.uid, "member", d),
      ForbiddenError,
    );

    await assertRejects(
      "removeMember: sahibi çıkarılamaz — ValidationError",
      () => removeMember(trainer, group.id, trainer.uid, d),
      ValidationError,
    );

    await removeMember(trainer, group.id, student.uid, d);
    const member = await d.conversations.getMember(group.id, student.uid);
    assert("removeMember: başarılı çıkarma sonrası üyelik yok", member === null);
  }

  // ── markRead: üye değilse no-op (hata atmaz) ──
  {
    const d = deps();
    const bridge = await createConversation(staffA, { realm: "trainer_student", type: "channel", name: "Kurum Duyuruları", memberUids: [], audience: "all_students" }, d);
    await markRead(student, bridge.id, d); // üye değil, ama hata atmamalı
    assert("markRead: üye olmayan (audience-only) okuyucu için no-op, hata yok", true);
  }

  // ── Audit Log: yönetimsel işlemler loglanır, mesaj gönderme loglanmaz ──
  {
    const d = deps();
    const channel = await createConversation(staffA, { realm: "staff", type: "channel", name: "Duyurular", memberUids: [] }, d);
    const group = await createConversation(staffA, { realm: "staff", type: "group", name: "Ekip", memberUids: [] }, d);
    const bridge = await createConversation(
      staffA,
      { realm: "trainer_student", type: "channel", name: "Öğrenci İşleri", memberUids: [], audience: "all_students" },
      d,
    );
    const dm = await createConversation(staffA, { realm: "staff", type: "dm", name: "", memberUids: [staffB.uid] }, d);

    assert(
      "Audit: kanal oluşturma loglanır (channel.create)",
      d.auditEntries.some((e) => e.action === "channel.create" && e.conversationId === channel.id),
    );
    assert(
      "Audit: grup oluşturma loglanır (group.create)",
      d.auditEntries.some((e) => e.action === "group.create" && e.conversationId === group.id),
    );
    assert(
      "Audit: audience kanalı oluşturma ayrı action ile loglanır (audience_channel.create)",
      d.auditEntries.some((e) => e.action === "audience_channel.create" && e.conversationId === bridge.id),
    );
    assert("Audit: DM oluşturma loglanmaz (kapsam dışı)", !d.auditEntries.some((e) => e.conversationId === dm.id));

    await addMember(staffA, group.id, staffB.uid, "member", d);
    assert(
      "Audit: üye ekleme loglanır (member.add) + targetUid doğru",
      d.auditEntries.some((e) => e.action === "member.add" && e.conversationId === group.id && e.targetUid === staffB.uid),
    );

    await removeMember(staffA, group.id, staffB.uid, d);
    assert(
      "Audit: üye çıkarma loglanır (member.remove) + targetUid doğru",
      d.auditEntries.some((e) => e.action === "member.remove" && e.conversationId === group.id && e.targetUid === staffB.uid),
    );

    const beforeMsgAudit = d.auditEntries.length;
    await sendMessage(staffA, group.id, "merhaba", d);
    assert("Audit: normal mesaj gönderme LOGLANMAZ", d.auditEntries.length === beforeMsgAudit);

    assert(
      "Audit: her kayıtta actorUid/actorName/tenantId/realm/createdAt dolu",
      d.auditEntries.every((e) => e.actorUid && e.actorName && e.tenantId === TENANT && e.realm && e.createdAt),
    );
  }

  // ── Favoriler/sabitleme: kişisel tercih, audit'e YAZILMAZ ──
  {
    const d = deps();
    const channel = await createConversation(staffA, { realm: "staff", type: "channel", name: "Duyurular", memberUids: [] }, d);
    const bridge = await createConversation(
      staffA,
      { realm: "trainer_student", type: "channel", name: "Öğrenci İşleri", memberUids: [], audience: "all_students" },
      d,
    );

    await setPinned(staffA, channel.id, true, d);
    const member = await d.conversations.getMember(channel.id, staffA.uid);
    assert("setPinned: üye kendi sabitleme tercihini ayarlayabilir", member?.pinned === true);

    await setPinned(staffA, channel.id, false, d);
    const memberAfter = await d.conversations.getMember(channel.id, staffA.uid);
    assert("setPinned: sabitlemeyi kaldırma çalışır", memberAfter?.pinned === false);

    await setPinned(student, bridge.id, true, d); // üye değil (audience-only) — no-op
    assert(
      "setPinned: üye olmayan (audience-only) okuyucu için no-op, hata yok",
      (await d.conversations.getMember(bridge.id, student.uid)) === null,
    );

    assert("Audit: sabitleme kişisel tercih olduğu için loglanmaz", !d.auditEntries.some((e) => e.conversationId === channel.id && e.action.includes("pin")));
  }

  // ── Öğrenci "kendi eğitmenine DM" istisnası (2026-07-18) ──
  {
    const d = deps();
    await assertRejects(
      "createConversation: öğrenci hâlâ kanal/grup oluşturamaz — ForbiddenError",
      () => createConversation(student, { realm: "trainer_student", type: "channel", name: "X", memberUids: [] }, d),
      ForbiddenError,
    );
    await assertRejects(
      "createConversation: öğrenci KENDİ eğitmeni OLMAYAN birine DM açamaz — ForbiddenError",
      () => createConversation(student2, { realm: "trainer_student", type: "dm", name: "", memberUids: ["trainer-1"] }, d),
      ForbiddenError,
    );

    const dm = await createConversation(student, { realm: "trainer_student", type: "dm", name: "", memberUids: ["trainer-1"] }, d);
    assert("createConversation: öğrenci KENDİ eğitmenine DM açabilir", dm.realm === "trainer_student" && dm.type === "dm");

    const dmAgain = await createConversation(student, { realm: "trainer_student", type: "dm", name: "", memberUids: ["trainer-1"] }, d);
    assert("createConversation: aynı DM tekrar tıklanınca ÇOĞALMAZ (dedup)", dmAgain.id === dm.id);

    const fromTrainerSide = await createConversation(trainer, { realm: "trainer_student", type: "dm", name: "", memberUids: ["student-1"] }, d);
    assert("createConversation: DM dedup İKİ yönlü de çalışır (eğitmen tarafından da aynı konuşma)", fromTrainerSide.id === dm.id);
  }

  // ── Sınıf odası dedup (sourceGroupId) ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası", memberUids: [], sourceGroupId: "group-1" }, d);
    const again = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası (tekrar)", memberUids: [], sourceGroupId: "group-1" }, d);
    assert("createConversation: aynı sourceGroupId için ikinci 'sınıf odası' ÇOĞALMAZ", again.id === group.id);
  }

  // ── Tenant izolasyonu ──
  {
    const d = deps();
    const conv = await createConversation(staffA, { realm: "staff", type: "group", name: "X", memberUids: [] }, d);
    const crossTenant = await d.conversations.getConversationById(conv.id, "other-tenant");
    assert("Tenant izolasyonu: farklı tenant'tan getConversationById → null", crossTenant === null);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
