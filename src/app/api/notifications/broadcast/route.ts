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
  const isAdmin      = role === "admin" || decoded.email === MASTER_UID;
  const isInstructor = role === "instructor";

  if (!isAdmin && !isInstructor) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const { title, preview, audience, actionUrl, groupId } = await req.json() as {
    title?: string;
    preview?: string;
    audience?: "students" | "instructors" | "all" | "group" | "my-groups";
    actionUrl?: string;
    groupId?: string;
  };

  if (!title?.trim())   return NextResponse.json({ error: "Başlık zorunludur." },        { status: 400 });
  if (!preview?.trim()) return NextResponse.json({ error: "Mesaj zorunludur." },          { status: 400 });
  if (title.length > 200)   return NextResponse.json({ error: "Başlık max 200 karakter." }, { status: 400 });
  if (preview.length > 100) return NextResponse.json({ error: "Mesaj max 100 karakter." },  { status: 400 });
  if (audience === "group" && !groupId)
    return NextResponse.json({ error: "Grup seçilmedi." }, { status: 400 });

  // Eğitmenler sadece kendi gruplarına gönderebilir
  if (isInstructor) {
    if (audience === "group") {
      const groupDoc = await adminDb.collection("groups").doc(groupId!).get();
      if (!groupDoc.exists || groupDoc.data()?.instructorId !== decoded.uid)
        return NextResponse.json({ error: "Bu grup size ait değil." }, { status: 403 });
    } else if (audience !== "my-groups") {
      return NextResponse.json({ error: "Eğitmenler sadece kendi gruplarına gönderebilir." }, { status: 403 });
    }
  }

  // ── Hedef kullanıcıları bul ───────────────────────────────────────────────
  let targetUids: string[] = [];

  /** Verilen groupId listesindeki tüm öğrencilerin authUid'lerini döner */
  async function uidsFromGroups(groupIds: string[]): Promise<string[]> {
    const snaps = await Promise.all(
      groupIds.map(gid =>
        adminDb.collection("students").where("groupId", "==", gid).get()
      )
    );
    const authUids = snaps.flatMap(s =>
      s.docs.map(d => d.data().authUid as string | undefined).filter((u): u is string => !!u)
    );
    const unique = [...new Set(authUids)];
    const checks = await Promise.all(unique.map(uid => adminDb.collection("users").doc(uid).get()));
    return checks.filter(d => d.exists).map(d => d.id);
  }

  if (audience === "group" && groupId) {
    targetUids = await uidsFromGroups([groupId]);
    if (!targetUids.length)
      return NextResponse.json({ error: "Bu grupta aktif (giriş yapmış) öğrenci bulunamadı." }, { status: 404 });

  } else if (audience === "my-groups") {
    // Gönderenin kendi grupları
    const myGroupsSnap = await adminDb.collection("groups")
      .where("instructorId", "==", decoded.uid)
      .get();
    const myGroupIds = myGroupsSnap.docs
      .filter(d => d.data().status !== "archived")
      .map(d => d.id);
    if (!myGroupIds.length)
      return NextResponse.json({ error: "Size atanmış aktif grup bulunamadı." }, { status: 404 });
    targetUids = await uidsFromGroups(myGroupIds);
    if (!targetUids.length)
      return NextResponse.json({ error: "Gruplarınızda aktif öğrenci bulunamadı." }, { status: 404 });

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
