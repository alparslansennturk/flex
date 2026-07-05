import { adminDb } from "../firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * `users/{uid}/notifications` altına doc yazar — canlıdaki `complete-upload`
 * route'unun kullandığı AYNI koleksiyon/şekil (`NotificationPayload`, zaten var olan
 * `NotificationBell`/`NotificationRealtimeService` rules'u/UI'ı bunu okuyor,
 * FlexOS için yeni bir koleksiyon/rules AÇILMADI). Non-fatal — bildirim
 * başarısız olsa da asıl işlemi (yorum/teslim) engellemez.
 */
export async function notifyUser(
  uid: string,
  input: {
    type: "message" | "announcement" | "assignment" | "system";
    entityId: string;
    senderId: string;
    title: string;
    preview: string;
    actionUrl: string;
  },
): Promise<void> {
  if (!uid) return;
  try {
    await adminDb.collection("users").doc(uid).collection("notifications").add({
      ...input,
      createdAt: FieldValue.serverTimestamp(),
      isRead: false,
      isArchived: false,
    });
  } catch (e) {
    console.error("[flexos-notify] bildirim yazılamadı (non-fatal):", e);
  }
}
