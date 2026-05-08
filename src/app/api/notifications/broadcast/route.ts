import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const MASTER_UID = "flexos.platform@gmail.com";
const CHUNK_SIZE = 400;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 401 });

  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 401 });
  }

  const role = decoded.role as string | undefined;
  if (role !== "admin" && decoded.email !== MASTER_UID) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const { title, preview, audience, actionUrl, groupId } = await req.json() as {
    title?: string;
    preview?: string;
    audience?: "students" | "instructors" | "all" | "group";
    actionUrl?: string;
    groupId?: string;
  };

  if (!title?.trim())   return NextResponse.json({ error: "Başlık zorunludur." },        { status: 400 });
  if (!preview?.trim()) return NextResponse.json({ error: "Mesaj zorunludur." },          { status: 400 });
  if (title.length > 200)   return NextResponse.json({ error: "Başlık max 200 karakter." }, { status: 400 });
  if (preview.length > 100) return NextResponse.json({ error: "Mesaj max 100 karakter." },  { status: 400 });
  if (audience === "group" && !groupId)
    return NextResponse.json({ error: "Grup seçilmedi." }, { status: 400 });

  // ── Hedef kullanıcıları bul ───────────────────────────────────────────────
  let targetUids: string[] = [];

  if (audience === "group" && groupId) {
    // Grubun öğrencilerini students koleksiyonundan çek
    const studentsSnap = await adminDb.collection("students")
      .where("groupId", "==", groupId)
      .get();

    const authUids = studentsSnap.docs
      .map(d => d.data().authUid as string | undefined)
      .filter((uid): uid is string => !!uid);

    if (!authUids.length)
      return NextResponse.json({ error: "Bu grupta aktif (giriş yapmış) öğrenci bulunamadı." }, { status: 404 });

    // Sadece users koleksiyonunda gerçekten var olan UID'leri kullan
    const userChecks = await Promise.all(
      authUids.map(uid => adminDb.collection("users").doc(uid).get())
    );
    targetUids = userChecks.filter(d => d.exists).map(d => d.id);

  } else {
    const usersSnap = await adminDb.collection("users").get();
    targetUids = usersSnap.docs
      .filter(d => {
        const data = d.data();
        if (data.email === MASTER_UID) return false;
        const r = (data.role as string) || (data.roles as string[])?.[0] || "";
        if (audience === "students")    return r === "student";
        if (audience === "instructors") return r === "instructor" || r === "admin";
        return true; // "all"
      })
      .map(d => d.id);
  }

  if (!targetUids.length)
    return NextResponse.json({ error: "Hedef kullanıcı bulunamadı." }, { status: 404 });

  // ── Batch yazma ───────────────────────────────────────────────────────────
  const eventId = `sys_${Date.now()}`;
  const notifData = {
    type:       "system",
    entityId:   eventId,
    senderId:   decoded.uid,
    title:      title.trim(),
    preview:    preview.trim(),
    actionUrl:  actionUrl?.trim() || "/",
    createdAt:  FieldValue.serverTimestamp(),
    isRead:     false,
    isArchived: false,
  };

  let written = 0;
  for (let i = 0; i < targetUids.length; i += CHUNK_SIZE) {
    const chunk = targetUids.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();
    for (const uid of chunk) {
      const ref = adminDb
        .collection("users").doc(uid)
        .collection("notifications").doc(`${eventId}_${uid}`);
      batch.set(ref, notifData);
    }
    await batch.commit();
    written += chunk.length;
  }

  return NextResponse.json({ success: true, sent: written });
}
