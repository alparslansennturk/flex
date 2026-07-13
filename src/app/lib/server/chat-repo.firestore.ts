// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ChatRepo } from "../domain/repo/chat-repo";

// Canlı/eski sistemde `chats` koleksiyonu YOK — çakışma riski taşımaz. Client bu
// koleksiyonu (ve `messages` alt koleksiyonunu) DOĞRUDAN `onSnapshot` ile okur
// (firestore.rules: trainerUid/studentUid eşleşmesi) — yazma HER ZAMAN buradan.
const COLLECTION = "chats";

export const firestoreChatRepo: ChatRepo = {
  chatIdFor(assignmentId, personId) {
    return `${assignmentId}_${personId}`;
  },

  async ensureChat(chatId, data) {
    const ref = adminDb.collection(COLLECTION).doc(chatId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ ...data, createdAt: FieldValue.serverTimestamp() });
    }
  },

  async addMessage(chatId, msg) {
    const ref = await adminDb.collection(COLLECTION).doc(chatId).collection("messages").add({
      ...msg,
      createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  },

  async getMessage(chatId, messageId) {
    const snap = await adminDb.collection(COLLECTION).doc(chatId).collection("messages").doc(messageId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      id: snap.id,
      text: data.text ?? "",
      authorUid: data.authorUid ?? "",
      authorType: data.authorType ?? "student",
      authorName: data.authorName ?? "",
    };
  },

  async updateMessage(chatId, messageId, text) {
    await adminDb.collection(COLLECTION).doc(chatId).collection("messages").doc(messageId).update({
      text,
      editedAt: FieldValue.serverTimestamp(),
    });
  },

  async deleteMessage(chatId, messageId) {
    await adminDb.collection(COLLECTION).doc(chatId).collection("messages").doc(messageId).delete();
  },
};
