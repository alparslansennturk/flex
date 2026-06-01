import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export type ActivityType =
  | "not"
  | "odev_yukleme"
  | "yoklama"
  | "ogrenci_eklendi"
  | "grup_olusturuldu"
  | "odev_verildi"
  | "yorum"
  | "teslim"
  | "odev_silindi"
  | "odev_arsivlendi"
  | "odev_aktif"
  | "odev_guncellendi";

export async function logActivity(type: ActivityType, title: string, description: string): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await addDoc(collection(db, "activity_log"), {
      type, title, description,
      userId: uid,
      createdAt: serverTimestamp(),
    });
  } catch (e) { console.error("[activityLog] hata:", e); }
}
