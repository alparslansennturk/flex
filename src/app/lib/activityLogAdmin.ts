import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function logActivityAdmin(
  type: string,
  title: string,
  description: string,
  userId: string,
): Promise<void> {
  try {
    await adminDb.collection("activity_log").add({
      type, title, description, userId,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (_) {}
}
