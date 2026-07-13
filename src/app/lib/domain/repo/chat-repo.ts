export interface ChatMessage {
  id: string;
  text: string;
  authorUid: string;
  authorType: "trainer" | "student";
  authorName: string;
}

/**
 * Chat deposu — PORT. Mesajlar client'tan DOĞRUDAN Firestore `onSnapshot` ile okunur
 * (firestore.rules: sadece o chat'in `trainerUid`/`studentUid`'i eşleşen kullanıcı okuyabilir,
 * `tasks/{id}/threads/{studentId}/comments` ile AYNI desen) — anlık, polling YOK.
 * Yazma HER ZAMAN bu repo üzerinden (Admin SDK, rules'ta `write: if false`) — mevcut
 * yetki/kayıt/durum kontrolleri (comment-service.ts) korunur, rules'a taşınmaz.
 * Implementasyon: `lib/server/chat-repo.firestore.ts` (`chats/{chatId}/messages`).
 */
export interface ChatRepo {
  /** Ödev+kişi çiftinden deterministik chat id — hem server hem client AYNI hesaplar. */
  chatIdFor(assignmentId: string, personId: string): string;
  /** Chat dokümanı yoksa oluşturur (trainerUid/studentUid — rules bunlarla okuma izni verir). */
  ensureChat(
    chatId: string,
    data: { assignmentId: string; personId: string; trainerUid: string; studentUid: string },
  ): Promise<void>;
  addMessage(
    chatId: string,
    msg: { text: string; authorUid: string; authorType: "trainer" | "student"; authorName: string },
  ): Promise<string>;
  getMessage(chatId: string, messageId: string): Promise<ChatMessage | null>;
  updateMessage(chatId: string, messageId: string, text: string): Promise<void>;
  deleteMessage(chatId: string, messageId: string): Promise<void>;
}
