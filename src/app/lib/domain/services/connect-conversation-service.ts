import type { ConnectConversation, ConnectMember } from "../core/connect";
import type { ConnectAuditAction, ConnectRequestMeta } from "../core/connect-audit";
import { ForbiddenError, ValidationError } from "../errors";
import {
  assertCanRead,
  assertMembersMatchRealm,
  findExistingDm,
  insertSystemMessage,
  isStudentsOwnTrainer,
  logAudit,
  nowISO,
  resolveUidKind,
} from "./connect-helpers";
import type { ConnectDeps, ConnectPrincipal, CreateConversationInput, UpdateConversationMetaInput } from "./connect-types";

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
  const readerKinds = await assertMembersMatchRealm(readerUids, input.realm, principal.tenantId, deps);

  const writePolicy = input.type === "channel" ? (input.writePolicy ?? "admins") : "members";
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
        kind: readerKinds.get(uid),
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

/**
 * "Sohbeti Temizle" (2026-07-25, kullanıcı isteği — "sadece bende") — WhatsApp'taki
 * "Sohbeti Temizle" gibi SADECE BENDE mesaj geçmişini gizler, konuşmanın kendisi
 * listede/normal görünümde KALIR (bkz. `ConnectMember.clearedAt` yorumu).
 * `hideConversationForMe`'nin aksine `type==="dm"` veya personel kısıtı YOK —
 * yıkıcı olmayan kişisel bir görünüm tercihi, herkes her konuşma tipini
 * temizleyebilir.
 */
export async function clearConversationForMe(
  principal: ConnectPrincipal,
  conversationId: string,
  deps: ConnectDeps,
): Promise<void> {
  const conversation = await deps.conversations.getConversationById(conversationId, principal.tenantId);
  if (!conversation) throw new ValidationError("Konuşma bulunamadı.");
  const member = await deps.conversations.getMember(conversationId, principal.uid);
  if (!member) throw new ValidationError("Bu konuşmanın üyesi değilsin.");
  await deps.conversations.saveMember(conversationId, { ...member, clearedAt: nowISO() });
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
  // `input.adminUids` işlenirken çözülür, aşağıdaki (aynı koşullu, ayrı) ikinci
  // blokta terfi eden ama HENÜZ üye dokümanı olmayan uid'lere `kind` yazmak için
  // tekrar sorgulamadan kullanılır (bkz. `assertMembersMatchRealm`).
  let adminKinds: Map<string, "staff" | "student"> = new Map();

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
    adminKinds = await assertMembersMatchRealm(nextAdmins, conversation.realm, principal.tenantId, deps);
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
    // Önceden terfi/görevden alma edilen HER uid için ayrı `getMember` vardı (N+1) —
    // tüm üye listesi zaten AYNI konuşma için tek `listMembers` çağrısıyla gelebiliyor,
    // sonrasında sadece bellekte Map lookup + paralel yazım yapılıyor.
    const allMembers = await deps.conversations.listMembers(conversationId);
    const memberByUid = new Map(allMembers.map((m) => [m.uid, m]));

    const toPromote = updated.admins.filter((uid) => !oldAdmins.has(uid));
    const toDemote = conversation.admins.filter((uid) => !newAdmins.has(uid) && uid !== conversation.ownerUid);

    await Promise.all([
      ...toPromote.map((uid) => {
        const existing = memberByUid.get(uid);
        return deps.conversations.saveMember(conversationId, {
          ...(existing ?? { uid, realm: conversation.realm, kind: adminKinds.get(uid), joinedAt: nowISO() }),
          role: "admin",
        });
      }),
      ...toDemote.map((uid) => {
        const existing = memberByUid.get(uid);
        if (existing && existing.role === "admin") {
          return deps.conversations.saveMember(conversationId, { ...existing, role: "member" });
        }
        return Promise.resolve();
      }),
    ]);
  }

  // Topluluğa YENİ eklenen grubun rosteru, bağlı "Genel Duyuru" kanalına GERÇEKTEN
  // okuyucu olarak eklenir (2026-07-18, kullanıcı isteği — sadece `childIds` listesi
  // güncellemek yeterli değil, aksi halde yeni grubun öğrencileri duyuruyu hiç
  // görmez). `announcementChannelId` yoksa (eski topluluklar) sessizce atlanır —
  // childIds yine de güncellenir, sadece otomatik köprü kurulamaz.
  if (input.childIds !== undefined && conversation.announcementChannelId) {
    const announcementChannelId = conversation.announcementChannelId;
    const oldChildren = new Set(conversation.childIds ?? []);
    const newlyAdded = updated.childIds!.filter((id) => !oldChildren.has(id));
    if (newlyAdded.length > 0) {
      // Önceden her yeni grubun HER öğrencisi için ayrı `getMember` + koşullu `saveMember`
      // vardı (N+1) — 30 kişilik bir sınıf eklendiğinde 30+ sıralı okuma/yazma demekti.
      // Rosterler ve duyuru kanalının mevcut üyeleri paralel/tek çağrıyla çekilip, sadece
      // GERÇEKTEN eksik olan üyeler için paralel yazım yapılıyor.
      const [rosters, announcementMembers] = await Promise.all([
        Promise.all(newlyAdded.map((groupConvId) => deps.conversations.listMembers(groupConvId))),
        deps.conversations.listMembers(announcementChannelId),
      ]);
      const existingUids = new Set(announcementMembers.map((m) => m.uid));
      const rosterKindByUid = new Map(rosters.flat().map((m) => [m.uid, m.kind]));
      const newUids = [...new Set(rosters.flat().map((m) => m.uid))].filter((uid) => !existingUids.has(uid));
      // Roster üyelerinin `kind`'ı genelde zaten kendi dokümanında var (backfill/
      // yeni-yazım) — eksikse (ör. henüz backfill edilmemiş eski doküman) tek tek
      // çözülür, tahmin edilmez.
      const resolvedKindByUid = new Map(
        await Promise.all(
          newUids
            .filter((uid) => !rosterKindByUid.get(uid))
            .map(async (uid) => [uid, await resolveUidKind(uid, principal.tenantId, deps)] as const),
        ),
      );
      await Promise.all(
        newUids.map((uid) => {
          const resolved = resolvedKindByUid.get(uid);
          const kind = rosterKindByUid.get(uid) ?? (resolved === "unknown" ? undefined : resolved);
          return deps.conversations.saveMember(announcementChannelId, {
            uid,
            realm: "trainer_student",
            role: "member",
            kind,
            joinedAt: nowISO(),
          });
        }),
      );
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
