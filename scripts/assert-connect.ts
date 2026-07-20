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
  editMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  setMessageReaction,
  markRead,
  addMember,
  removeMember,
  setPinned,
  updateConversationMeta,
  deleteConversation,
  type ConnectPrincipal,
  type ConnectDeps,
} from "../src/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeConnectRepo(): ConnectRepo {
  const conversations = new Map<string, ConnectConversation>();
  const members = new Map<string, Map<string, ConnectMember>>();
  const messages = new Map<string, Map<string, ConnectMessage>>();
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
      if (!messages.has(conversationId)) messages.set(conversationId, new Map());
      messages.get(conversationId)!.set(message.id, { ...message });
    },
    async getMessage(conversationId, messageId) { return messages.get(conversationId)?.get(messageId) ?? null; },
    async listMessages(conversationId) {
      return [...(messages.get(conversationId)?.values() ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listStarredMessages(uid) {
      const result: { conversationId: string; message: ConnectMessage }[] = [];
      for (const [conversationId, msgMap] of messages) {
        for (const m of msgMap.values()) {
          if (m.starredBy?.includes(uid)) result.push({ conversationId, message: m });
        }
      }
      return result;
    },
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
  const staffC: ConnectPrincipal = { tenantId: TENANT, uid: "staff-c", kind: "staff" };
  const trainer: ConnectPrincipal = { tenantId: TENANT, uid: "trainer-1", kind: "staff", trainerId: "trainer-doc-1" };
  const student: ConnectPrincipal = { tenantId: TENANT, uid: "student-1", kind: "student", personId: "person-1" };
  const student2: ConnectPrincipal = { tenantId: TENANT, uid: "student-2", kind: "student", personId: "person-2" };

  const persons = makePersonRepo([fakePerson("student-1", "person-1"), fakePerson("student-2", "person-2")]);
  const flexosUsers = makeFlexosUserRepo([
    fakeFlexosUser("staff-a", "user-a", ["admin"]),
    fakeFlexosUser("staff-b", "user-b", ["admin"]),
    fakeFlexosUser("staff-c", "user-c", ["admin"]),
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
      notify: async () => {},
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

  // ── "Personel Kanalı" (broadcastToAllStaff) — 2026-07-18 kullanıcı isteği ──
  {
    const d = deps();
    const channel = await createConversation(
      staffA,
      { realm: "staff", type: "channel", name: "Şirket Duyuruları", memberUids: [staffB.uid], broadcastToAllStaff: true },
      d,
    );

    const memberC = await d.conversations.getMember(channel.id, staffC.uid);
    assert("broadcastToAllStaff: seçilmeyen personel de OTOMATİK okuyucu/member olur", memberC !== null);
    assert("broadcastToAllStaff: seçilmeyen personel admins'e GİRMEZ", !channel.admins.includes(staffC.uid));
    assert("broadcastToAllStaff: seçilen Yayıncı (staffB) admins'e girer", channel.admins.includes(staffB.uid));

    await assertRejects(
      "broadcastToAllStaff: seçilmeyen (okuyucu) personel kanala YAZAMAZ — ForbiddenError",
      () => sendMessage(staffC, channel.id, "ben de yazmak istiyorum", d),
      ForbiddenError,
    );

    await sendMessage(staffB, channel.id, "duyuru metni", d);
    const msgs = await listMessages(staffA, channel.id, d);
    assert("broadcastToAllStaff: seçilen Yayıncı gerçekten yazabiliyor", msgs.some((m) => m.text === "duyuru metni"));
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

  // ── Misafir daveti (Faz 2 madde 4, 2026-07-18) — var olan hesap, açıklayıcı etiket ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası 6", memberUids: [] }, d);
    await addMember(trainer, group.id, staffB.uid, "guest", d, undefined, "Yardımcı Eğitmen");
    const guest = await d.conversations.getMember(group.id, staffB.uid);
    assert("addMember: misafir role='guest' ile eklenir", guest?.role === "guest");
    assert("addMember: guestTitle rozet olarak saklanır", guest?.guestTitle === "Yardımcı Eğitmen");
  }

  // ── Dosya ekleri (Faz 2 madde 5, 2026-07-18) — WhatsApp gibi metin BOŞ olabilir ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası 7", memberUids: [student.uid] }, d);
    const attachment = { driveFileId: "drv-1", webViewLink: "https://drive.google.com/file/d/drv-1/view", fileName: "notlar.pdf", fileSize: 12345, mimeType: "application/pdf" };

    await assertRejects(
      "sendMessage: ek YOKKEN boş metin reddedilir — ValidationError",
      () => sendMessage(trainer, group.id, "", d),
      ValidationError,
    );

    const msg = await sendMessage(trainer, group.id, "", d, [attachment]);
    assert("sendMessage: ek VARKEN boş metin kabul edilir (WhatsApp gibi)", msg.text === "" && msg.attachments?.[0]?.driveFileId === "drv-1");

    const conv = await d.conversations.getConversationById(group.id, TENANT);
    assert("sendMessage: sadece ekli mesajda lastMessage önizlemesi dosya adını gösterir", conv?.lastMessage?.text === "📎 notlar.pdf");
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

  // ── Mesaj düzenle/sil — WhatsApp birebir (2026-07-18) ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası 3", memberUids: [student.uid] }, d);
    const msg = await sendMessage(student, group.id, "ilk mesaj", d);

    await assertRejects(
      "editMessage: yazar OLMAYAN düzenleyemez — ForbiddenError",
      () => editMessage(trainer, group.id, msg.id, "başkası düzenledi", d),
      ForbiddenError,
    );
    const edited = await editMessage(student, group.id, msg.id, "düzenlenmiş mesaj", d);
    assert("editMessage: yazar kendi mesajını düzenleyebilir", edited.text === "düzenlenmiş mesaj" && !!edited.editedAt);
    const convAfterEdit = await d.conversations.getConversationById(group.id, TENANT);
    assert("editMessage: son mesaj önizlemesi (lastMessage) de güncellenir", convAfterEdit?.lastMessage?.text === "düzenlenmiş mesaj");

    await assertRejects(
      "deleteMessageForEveryone: yazar OLMAYAN silemez — ForbiddenError",
      () => deleteMessageForEveryone(trainer, group.id, msg.id, d),
      ForbiddenError,
    );
    await deleteMessageForEveryone(student, group.id, msg.id, d);
    const afterDelete = await d.conversations.getMessage(group.id, msg.id);
    assert("deleteMessageForEveryone: text temizlenir + deletedForEveryone=true", afterDelete?.text === "" && afterDelete?.deletedForEveryone === true);
    const convAfterDelete = await d.conversations.getConversationById(group.id, TENANT);
    assert("deleteMessageForEveryone: lastMessage önizlemesi 'Bu mesaj silindi' olur", convAfterDelete?.lastMessage?.text === "Bu mesaj silindi");

    await assertRejects(
      "editMessage: 'herkes için silinmiş' mesaj düzenlenemez — ValidationError",
      () => editMessage(student, group.id, msg.id, "tekrar dene", d),
      ValidationError,
    );
  }

  // ── "Benim için sil" — SADECE çağıranın görünümünden kaybolur ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası 4", memberUids: [student.uid] }, d);
    const msg = await sendMessage(trainer, group.id, "herkese görünen mesaj", d);

    await deleteMessageForMe(student, group.id, msg.id, d);
    const studentView = await listMessages(student, group.id, d);
    const trainerView = await listMessages(trainer, group.id, d);
    assert("deleteMessageForMe: SADECE çağıranın listesinden kaybolur", !studentView.some((m) => m.id === msg.id));
    assert("deleteMessageForMe: diğerleri mesajı NORMAL görmeye devam eder", trainerView.some((m) => m.id === msg.id));
  }

  // ── Reaksiyonlar — WhatsApp tarzı, kişi başına TEK emoji (Faz 2 madde 2, 2026-07-18) ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası 5", memberUids: [student.uid] }, d);
    const msg = await sendMessage(trainer, group.id, "duyuru metni", d);

    await setMessageReaction(student, group.id, msg.id, "👍", d);
    let got = await d.conversations.getMessage(group.id, msg.id);
    assert("setMessageReaction: reaksiyon eklenir", got?.reactions?.[student.uid] === "👍");

    await setMessageReaction(student, group.id, msg.id, "❤️", d);
    got = await d.conversations.getMessage(group.id, msg.id);
    assert("setMessageReaction: farklı emojiye basınca DEĞİŞİR (kişi başına tek emoji)", got?.reactions?.[student.uid] === "❤️");

    await setMessageReaction(student, group.id, msg.id, "❤️", d);
    got = await d.conversations.getMessage(group.id, msg.id);
    assert("setMessageReaction: AYNI emojiye tekrar basınca KALDIRILIR (toggle)", got?.reactions?.[student.uid] === undefined);

    // Audience-only (member dokümanı olmayan) okuyucu da reaksiyon verebilir.
    const bridge = await createConversation(staffA, { realm: "trainer_student", type: "channel", name: "Öğrenci İşleri", memberUids: [], audience: "all_students" }, d);
    const bridgeMsg = await sendMessage(staffA, bridge.id, "duyuru", d);
    await setMessageReaction(student, bridge.id, bridgeMsg.id, "🎉", d);
    const bridgeMsgAfter = await d.conversations.getMessage(bridge.id, bridgeMsg.id);
    assert("setMessageReaction: audience-only okuyucu (member dokümanı yok) da reaksiyon verebilir", bridgeMsgAfter?.reactions?.[student.uid] === "🎉");

    await assertRejects(
      "setMessageReaction: üye OLMADIĞI gruba (okuma yetkisi yok) reaksiyon veremez — ForbiddenError",
      () => setMessageReaction(student2, group.id, msg.id, "😮", d),
      ForbiddenError,
    );

    await deleteMessageForEveryone(trainer, group.id, msg.id, d);
    await assertRejects(
      "setMessageReaction: 'herkes için silinmiş' mesaja reaksiyon verilemez — ValidationError",
      () => setMessageReaction(trainer, group.id, msg.id, "👍", d),
      ValidationError,
    );
  }

  // ── Topluluk akışı — WhatsApp topluluğu ile AYNI mantık (2026-07-18 kullanıcı
  // netleştirmesi): Genel Duyuru'yu SADECE eğitmen yazar, öğrenci okur; bundled
  // gruplara eğitmen ayrı ayrı da yazabilir; gruplar birbirini GÖREMEZ. ──
  {
    const d = deps();
    const groupA = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-1", memberUids: [student.uid] }, d);
    const groupB = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-2", memberUids: [student2.uid] }, d);
    const genelDuyuru = await createConversation(
      trainer,
      { realm: "trainer_student", type: "channel", name: "Grafik Topluluğu — Genel Duyuru", memberUids: [], readerUids: [student.uid, student2.uid] },
      d,
    );

    await assertRejects(
      "Topluluk/Genel Duyuru: öğrenci (readerUids ile eklenen) YAZAMAZ — ForbiddenError",
      () => sendMessage(student, genelDuyuru.id, "ben de yazayım", d),
      ForbiddenError,
    );
    await sendMessage(trainer, genelDuyuru.id, "Herkese duyuru", d);
    const duyuruMsgs = await listMessages(student, genelDuyuru.id, d);
    assert("Topluluk/Genel Duyuru: öğrenci OKUYABİLİR", duyuruMsgs.some((m) => m.text === "Herkese duyuru"));

    await sendMessage(trainer, groupA.id, "Grafik-1'e özel not", d);
    await sendMessage(trainer, groupB.id, "Grafik-2'ye özel not", d);
    assert("Topluluk: eğitmen bundled gruplara AYRI AYRI da yazabilir (Grafik-1)", (await listMessages(trainer, groupA.id, d)).length === 1);
    assert("Topluluk: eğitmen bundled gruplara AYRI AYRI da yazabilir (Grafik-2)", (await listMessages(trainer, groupB.id, d)).length === 1);

    await assertRejects(
      "Topluluk: Grafik-1'deki öğrenci Grafik-2'yi GÖREMEZ/okuyamaz — ForbiddenError",
      () => listMessages(student, groupB.id, d),
      ForbiddenError,
    );
  }

  // ── updateConversationMeta — ad/açıklama/yayıncı düzenleme (2026-07-18, son 2 madde) ──
  {
    const d = deps();
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Sınıf Odası 9", memberUids: [] }, d);

    await assertRejects(
      "updateConversationMeta: admin OLMAYAN düzenleyemez — ForbiddenError",
      () => updateConversationMeta(student, group.id, { name: "Yeni Ad" }, d),
      ForbiddenError,
    );

    const updated = await updateConversationMeta(trainer, group.id, { name: "Yeni Ad", description: "Yeni açıklama" }, d);
    assert("updateConversationMeta: admin ad/açıklama değiştirebilir", updated.name === "Yeni Ad" && updated.description === "Yeni açıklama");

    const persisted = await d.conversations.getConversationById(group.id, TENANT);
    assert("updateConversationMeta: değişiklik kalıcı olarak kaydedilir", persisted?.name === "Yeni Ad");

    await assertRejects(
      "updateConversationMeta: boş ad reddedilir — ValidationError",
      () => updateConversationMeta(trainer, group.id, { name: "   " }, d),
      ValidationError,
    );

    const dm = await createConversation(trainer, { realm: "trainer_student", type: "dm", name: "", memberUids: [student.uid] }, d);
    await assertRejects(
      "updateConversationMeta: DM düzenlenemez — ValidationError",
      () => updateConversationMeta(trainer, dm.id, { name: "X" }, d),
      ValidationError,
    );

    const channel = await createConversation(
      staffA,
      { realm: "staff", type: "channel", name: "Duyurular", memberUids: [staffB.uid] },
      d,
    );
    await assertRejects(
      "updateConversationMeta: staff kanalına öğrenci Yayıncı olarak eklenemez — ForbiddenError",
      () => updateConversationMeta(staffA, channel.id, { adminUids: [staffB.uid, student.uid] }, d),
      ForbiddenError,
    );
    const withNewAdmin = await updateConversationMeta(staffA, channel.id, { adminUids: [staffC.uid] }, d);
    assert(
      "updateConversationMeta: yayıncı listesi güncellenir (owner her zaman kalır)",
      withNewAdmin.admins.includes(staffC.uid) && withNewAdmin.admins.includes(staffA.uid) && !withNewAdmin.admins.includes(staffB.uid),
    );

    const settingsAudit = d.auditEntries.filter((e) => e.action === "conversation.settings.update");
    assert("Audit: ad/açıklama/yayıncı değişikliği conversation.settings.update olarak loglanır", settingsAudit.length >= 2);

    const staffCMember = await d.conversations.getMember(channel.id, staffC.uid);
    assert("updateConversationMeta: yeni Yayıncı için members dokümanı oluşturulur (role=admin, okuyabilir)", staffCMember?.role === "admin");
  }

  // ── updateConversationMeta — Topluluk'a sonradan yeni grup ekleme (2026-07-18, kullanıcı isteği) ──
  {
    const d = deps();
    const groupA = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-1", memberUids: [] }, d);
    const groupB = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-2", memberUids: [] }, d);
    const groupC = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-3 (yeni açılan)", memberUids: [] }, d);
    const otherGroup = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "İlgisiz Grup", memberUids: [] }, d);
    const community = await createConversation(
      trainer,
      { realm: "trainer_student", type: "community", name: "Grafik Topluluğu", memberUids: [], childIds: [groupA.id, groupB.id] },
      d,
    );

    await assertRejects(
      "updateConversationMeta: childIds sadece topluluklarda düzenlenebilir — ValidationError",
      () => updateConversationMeta(trainer, groupA.id, { childIds: [groupA.id, groupB.id] }, d),
      ValidationError,
    );

    const withNewChild = await updateConversationMeta(trainer, community.id, { childIds: [groupA.id, groupB.id, groupC.id] }, d);
    assert("updateConversationMeta: yeni açılan grup topluluğa eklenir", !!withNewChild.childIds?.includes(groupC.id));
    assert("updateConversationMeta: eski gruplar listede kalır", !!withNewChild.childIds?.includes(groupA.id) && !!withNewChild.childIds?.includes(groupB.id));

    await assertRejects(
      "updateConversationMeta: var olmayan bir grup id'si reddedilir — ValidationError",
      () => updateConversationMeta(trainer, community.id, { childIds: ["hic-yok-boyle-bir-id", groupA.id] }, d),
      ValidationError,
    );

    await assertRejects(
      "updateConversationMeta: grup TİPİNDE olmayan bir konuşma topluluğa eklenemez — ValidationError",
      () => updateConversationMeta(trainer, community.id, { childIds: [groupA.id, community.id] }, d),
      ValidationError,
    );

    const childAudit = d.auditEntries.filter((e) => e.action === "community.child_groups.update");
    assert("Audit: topluluk grup listesi değişikliği community.child_groups.update olarak loglanır", childAudit.some((e) => e.conversationId === community.id));

    void otherGroup; // sadece "ilgisiz konuşmayı ekleme" senaryosu için referans, ayrı assertion gerekmiyor
  }

  // ── announcementChannelId — Topluluğa eklenen grubun rosteru GERÇEKTEN Genel
  // Duyuru'ya okuyucu olur (2026-07-18, "sadece childIds listesi yetmez" bulgusu) ──
  {
    const d = deps();
    const groupA = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-1", memberUids: [student.uid] }, d);
    const groupB = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-2", memberUids: [] }, d);
    const groupC = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Grafik-3 (yeni açılan)", memberUids: [student2.uid] }, d);
    const genelDuyuru = await createConversation(
      trainer,
      { realm: "trainer_student", type: "channel", name: "Grafik Topluluğu — Genel Duyuru", memberUids: [], readerUids: [student.uid] },
      d,
    );
    const community = await createConversation(
      trainer,
      { realm: "trainer_student", type: "community", name: "Grafik Topluluğu", memberUids: [], childIds: [groupA.id, groupB.id], announcementChannelId: genelDuyuru.id },
      d,
    );

    assert(
      "announcementChannelId: eklenmeden ÖNCE Grafik-3'ün öğrencisi Genel Duyuru okuyucusu DEĞİL",
      (await d.conversations.getMember(genelDuyuru.id, student2.uid)) === null,
    );

    await updateConversationMeta(trainer, community.id, { childIds: [groupA.id, groupB.id, groupC.id] }, d);

    const newReader = await d.conversations.getMember(genelDuyuru.id, student2.uid);
    assert("announcementChannelId: Grafik-3 eklenince rosteru OTOMATİK Genel Duyuru okuyucusu olur", newReader?.role === "member");
    const genelDuyuruMsgs = await sendMessage(trainer, genelDuyuru.id, "Yeni duyuru", d) && (await listMessages(student2, genelDuyuru.id, d));
    assert("announcementChannelId: yeni eklenen öğrenci Genel Duyuru mesajlarını GERÇEKTEN okuyabiliyor", genelDuyuruMsgs.some((m) => m.text === "Yeni duyuru"));

    const existingReader = await d.conversations.getMember(genelDuyuru.id, student.uid);
    assert("announcementChannelId: zaten okuyucu olan (Grafik-1) tekrar eklenmez/bozulmaz", existingReader?.role === "member");
  }

  // ── deleteConversation — konuşma silme (2026-07-18, kullanıcı isteği: "grup silme kanal silme topluluk silme olmalı") ──
  {
    const d = deps();
    const channel = await createConversation(staffA, { realm: "staff", type: "channel", name: "Silinecek Kanal", memberUids: [] }, d);
    const group = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Silinecek Grup", memberUids: [student.uid] }, d);
    const groupA2 = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Topluluk Alt-1", memberUids: [] }, d);
    const groupB2 = await createConversation(trainer, { realm: "trainer_student", type: "group", name: "Topluluk Alt-2", memberUids: [] }, d);
    const community = await createConversation(
      trainer,
      { realm: "trainer_student", type: "community", name: "Silinecek Topluluk", memberUids: [], childIds: [groupA2.id, groupB2.id] },
      d,
    );
    const dm = await createConversation(staffA, { realm: "staff", type: "dm", name: "", memberUids: [staffB.uid] }, d);
    await updateConversationMeta(staffA, channel.id, { adminUids: [staffC.uid] }, d); // staffC → Yayıncı (admin), owner DEĞİL

    await assertRejects(
      "deleteConversation: admin (owner DEĞİL) silemez — ForbiddenError",
      () => deleteConversation(staffC, channel.id, d),
      ForbiddenError,
    );
    await assertRejects(
      "deleteConversation: DM silinemez — ValidationError",
      () => deleteConversation(staffA, dm.id, d),
      ValidationError,
    );
    await sendMessage(trainer, group.id, "silinmeden önce bir mesaj", d);

    await deleteConversation(staffA, channel.id, d);
    assert("deleteConversation: kanal silinir (getConversationById → null)", (await d.conversations.getConversationById(channel.id, TENANT)) === null);
    assert(
      "Audit: kanal silme channel.delete olarak loglanır",
      d.auditEntries.some((e) => e.action === "channel.delete" && e.conversationId === channel.id),
    );

    await deleteConversation(trainer, group.id, d);
    assert("deleteConversation: grup silinince alt-koleksiyon (members) da temizlenir", (await d.conversations.listMembers(group.id)).length === 0);
    assert("deleteConversation: grup silinince alt-koleksiyon (messages) da temizlenir", (await d.conversations.listMessages(group.id)).length === 0);
    assert(
      "Audit: grup silme group.delete olarak loglanır",
      d.auditEntries.some((e) => e.action === "group.delete" && e.conversationId === group.id),
    );

    await deleteConversation(trainer, community.id, d);
    assert(
      "Audit: topluluk silme community.delete olarak loglanır",
      d.auditEntries.some((e) => e.action === "community.delete" && e.conversationId === community.id),
    );
    assert(
      "deleteConversation: topluluk silinince paketlediği gruplar ETKİLENMEZ",
      (await d.conversations.getConversationById(groupA2.id, TENANT)) !== null && (await d.conversations.getConversationById(groupB2.id, TENANT)) !== null,
    );
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
