// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
import type { ConnectConversation, ConnectMember, ConnectMessage, ConnectRealm } from "../domain/core/connect";
import type { ConnectRepo } from "../domain/repo/connect-repo";

// Ödev/teslim `chats` koleksiyonuna HİÇ dokunmaz — tamamen ayrı, yeni koleksiyon.
const CONVERSATIONS = "connect_conversations";
const MEMBERS = "members";
const MESSAGES = "messages";
const TYPING = "typing";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreConnectRepo: ConnectRepo = {
  nextConversationId() {
    return adminDb.collection(CONVERSATIONS).doc().id;
  },
  nextMessageId() {
    return adminDb.collection(CONVERSATIONS).doc().collection(MESSAGES).doc().id;
  },

  async saveConversation(conversation) {
    await adminDb.collection(CONVERSATIONS).doc(conversation.id).set(clean(conversation));
  },

  async getConversationById(id, tenantId) {
    const snap = await adminDb.collection(CONVERSATIONS).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as ConnectConversation;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async listConversationsByAudience(tenantId, realm, audience) {
    const snap = await adminDb
      .collection(CONVERSATIONS)
      .where("tenantId", "==", tenantId)
      .where("realm", "==", realm)
      .where("audience", "==", audience)
      .get();
    return snap.docs.map((d) => d.data() as ConnectConversation);
  },

  async getConversationsByIds(ids, tenantId) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 30) chunks.push(uniqueIds.slice(i, i + 30));
    const results = await Promise.all(
      chunks.map((chunk) => adminDb.collection(CONVERSATIONS).where(FieldPath.documentId(), "in", chunk).get()),
    );
    return results
      .flatMap((snap) => snap.docs.map((d) => d.data() as ConnectConversation))
      .filter((c) => c.tenantId === tenantId); // kiracı izolasyonu
  },

  async deleteConversation(id, tenantId) {
    const ref = adminDb.collection(CONVERSATIONS).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    if ((snap.data() as ConnectConversation).tenantId !== tenantId) return;
    // `recursiveDelete` — Firestore parent doc silme alt-koleksiyonları (members/
    // messages/typing) OTOMATİK silmez, elle temizlenmezse yetim doküman kalır
    // (2026-07-18, konuşma silme özelliği eklenirken fark edildi).
    await adminDb.recursiveDelete(ref);
  },

  async findBySourceGroupId(tenantId, sourceGroupId) {
    const snap = await adminDb
      .collection(CONVERSATIONS)
      .where("tenantId", "==", tenantId)
      .where("sourceGroupId", "==", sourceGroupId)
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as ConnectConversation);
  },

  async saveMember(conversationId, member) {
    await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(MEMBERS).doc(member.uid).set(clean(member));
  },

  async getMember(conversationId, uid) {
    const snap = await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(MEMBERS).doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as ConnectMember;
  },

  async listMembers(conversationId) {
    const snap = await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(MEMBERS).get();
    return snap.docs.map((d) => d.data() as ConnectMember);
  },

  async deleteMember(conversationId, uid) {
    await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(MEMBERS).doc(uid).delete();
  },

  /**
   * `collectionGroup("members")` — "bana ait konuşmalar" (izolasyonun bel kemiği,
   * bkz. FLEX_CONNECT.md §3). `realm` denormalize edildiği için gerektiğinde
   * çağıran ek defansif filtre uygulayabilir — burada TÜM üyelikler döner,
   * realm filtresi servis katmanında (connect-service.ts) uygulanır.
   */
  async listMembershipsForUid(uid) {
    const snap = await adminDb.collectionGroup(MEMBERS).where("uid", "==", uid).get();
    return snap.docs.map((d) => ({
      conversationId: d.ref.parent.parent!.id,
      member: d.data() as ConnectMember,
    }));
  },

  async saveMessage(conversationId, message) {
    await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(MESSAGES).doc(message.id).set(clean(message));
  },

  async getMessage(conversationId, messageId) {
    const snap = await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(MESSAGES).doc(messageId).get();
    if (!snap.exists) return null;
    return snap.data() as ConnectMessage;
  },

  async listMessages(conversationId, limit) {
    let q = adminDb
      .collection(CONVERSATIONS)
      .doc(conversationId)
      .collection(MESSAGES)
      .orderBy("createdAt", "asc");
    if (limit) q = q.limitToLast(limit);
    const snap = await q.get();
    return snap.docs.map((d) => d.data() as ConnectMessage);
  },

  async setTyping(conversationId, uid, name, at) {
    await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(TYPING).doc(uid).set({ uid, name, at });
  },

  async listTyping(conversationId) {
    const snap = await adminDb.collection(CONVERSATIONS).doc(conversationId).collection(TYPING).get();
    return snap.docs.map((d) => d.data() as { uid: string; name: string; at: string });
  },
};

/** Realm'e göre daraltılmış yardımcı — servis katmanında sık kullanılır. */
export function filterMembershipsByRealm<T extends { member: { realm: ConnectRealm } }>(
  items: T[],
  realm: ConnectRealm,
): T[] {
  return items.filter((i) => i.member.realm === realm);
}
