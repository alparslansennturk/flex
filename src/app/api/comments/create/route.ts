import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(str: string): string {
  return str
    .replace(/<[^>]*>/g, "")          // HTML tag strip
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

// ── POST /api/comments/create ─────────────────────────────────────────────────
// Body: { taskId, studentId, text, authorName, idempotencyKey? }
// Auth: Bearer {idToken}

export async function POST(req: NextRequest) {

  // ── Step 1: Auth header ──────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  // ── Step 2: Verify token ─────────────────────────────────────────────────
  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // ── Step 3: Debug log ────────────────────────────────────────────────────
  console.log("[comments/create] auth:", {
    uid:          decoded.uid,
    role:         decoded.role,
    studentDocId: decoded.studentDocId,
  });

  // ── Step 4: Validate input ───────────────────────────────────────────────
  let body: { taskId?: string; studentId?: string; text?: string; authorName?: string; idempotencyKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId, studentId, idempotencyKey } = body;
  const rawText       = body.text ?? "";
  const rawAuthorName = body.authorName ?? "";

  if (!taskId || typeof taskId !== "string")
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  if (!studentId || typeof studentId !== "string")
    return NextResponse.json({ error: "studentId required" }, { status: 400 });

  const text = rawText.trim();
  if (!text)
    return NextResponse.json({ error: "text cannot be empty" }, { status: 400 });
  if (text.length > 1000)
    return NextResponse.json({ error: "text max 1000 characters" }, { status: 400 });

  // ── Step 5: XSS sanitize ─────────────────────────────────────────────────
  const safeText       = sanitize(text);
  const safeAuthorName = sanitize(rawAuthorName);

  // ── Step 6: Resolve role (token birincil, DB sadece fallback) ───────────────
  const uid = decoded.uid;
  const tokenRole = decoded.role as string | undefined;

  // Sadece token'da role yoksa DB'ye git
  let role = tokenRole ?? "";
  let userData: Record<string, unknown> = {};
  if (!tokenRole) {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    userData = userDoc.exists ? (userDoc.data() as Record<string, unknown>) : {};
    role = (userData.role as string) || (userData.roles as string[])?.[0] || "";
  }

  const isTeacher = role === "instructor" || role === "admin";
  const isStudent = role === "student";

  console.log("[comments/create] role resolved:", { tokenRole, resolved: role });

  // ── Step 7: Authorization ────────────────────────────────────────────────
  if (isStudent) {
    // 1. Claims birincil
    let resolvedDocId = decoded.studentDocId as string | undefined;
    let ownerSource = "token";

    // 2. users doc fallback (sadece claims'te yoksa DB'ye git)
    if (!resolvedDocId) {
      if (!userData.studentDocId) {
        const userDoc = await adminDb.collection("users").doc(uid).get();
        userData = userDoc.exists ? (userDoc.data() as Record<string, unknown>) : {};
      }
      if (userData.studentDocId) {
        resolvedDocId = userData.studentDocId as string;
        ownerSource = "users_doc";
      }
    }

    // 3. students koleksiyon query fallback (authUid ile)
    if (!resolvedDocId) {
      const snap = await adminDb.collection("students")
        .where("authUid", "==", uid)
        .limit(1)
        .get();
      if (!snap.empty) {
        resolvedDocId = snap.docs[0].id;
        ownerSource = "students_query";
      }
    }

    if (!resolvedDocId) {
      console.log("[comments/create] FORBIDDEN — student identity could not be resolved for uid:", uid);
      return NextResponse.json({ error: "Student identity not found" }, { status: 403 });
    }
    if (resolvedDocId !== studentId) {
      // Claims/DB stale olabilir (grup değişimi, yeniden aktivasyon vb.)
      // Son kontrol: students/{studentId}.authUid doğrudan eşleşiyor mu?
      const targetDoc = await adminDb.collection("students").doc(studentId).get();
      if (!targetDoc.exists || targetDoc.data()?.authUid !== uid) {
        console.log("[comments/create] FORBIDDEN — studentDocId mismatch:", { resolvedDocId, studentId, uid });
        return NextResponse.json({ error: "Forbidden: not your thread" }, { status: 403 });
      }
      console.log("[comments/create] Authorization: OWNER via direct authUid check (claims stale)", { studentId, uid });
    } else {
      console.log("[comments/create] Authorization: OWNER", { source: ownerSource });
    }

  } else if (isTeacher) {
    // Eğitmen/admin role tabanlı erişim — memberships koleksiyonunda kayıt gerekmez
    console.log("[comments/create] Authorization: TEACHER — role-based access granted:", { uid, role });

  } else {
    console.log("[comments/create] FORBIDDEN — unknown role:", role);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Step 8: Idempotency ──────────────────────────────────────────────────
  const threadRef = adminDb
    .collection("tasks").doc(taskId)
    .collection("threads").doc(studentId)
    .collection("comments");

  if (idempotencyKey) {
    const existing = await threadRef
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log("[comments/create] Idempotency hit — returning existing comment");
      return NextResponse.json({ success: true, commentId: existing.docs[0].id, duplicate: true });
    }
  }

  // ── Step 9: Write via Admin SDK ──────────────────────────────────────────
  const commentRef = await threadRef.add({
    authorId:   uid,
    authorType: isTeacher ? "teacher" : "student",
    authorName: safeAuthorName,
    text:       safeText,
    createdAt:  FieldValue.serverTimestamp(),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });

  console.log("[comments/create] Written:", commentRef.id);

  // ── Step 10: Bildirim tetikleyiciler ─────────────────────────────────────
  (async () => {
    try {
      if (isTeacher) {
        // Eğitmen yorumu → öğrenciye bildirim
        const studentDoc = await adminDb.collection("students").doc(studentId).get();
        const studentAuthUid = studentDoc.data()?.authUid as string | undefined;
        if (!studentAuthUid) return;

        const userDoc = await adminDb.collection("users").doc(studentAuthUid).get();
        const activeTaskId = userDoc.data()?.activeTaskId as string | undefined;
        const isOnPage = activeTaskId === taskId;

        // Her yorum için unique ID — overwrite değil yeni doc → toast her seferinde tetiklenir
        await adminDb
          .collection("users").doc(studentAuthUid)
          .collection("notifications").doc()
          .set({
            type:      "message",
            entityId:  taskId,
            senderId:  uid,
            title:     "Yeni mesajınız var",
            preview:   "Eğitmeniniz size özel bir mesaj bıraktı. Görmek için tıklayın.",
            actionUrl: `/student/${studentId}/${taskId}`,
            createdAt: FieldValue.serverTimestamp(),
            isRead:    isOnPage,
            isArchived: false,
          });

        console.log(`[comments/create] Bildirim → ${studentAuthUid}, isRead: ${isOnPage}`);

      } else if (isStudent) {
        // Öğrenci yorumu → sadece o grubun eğitmenine bildirim
        const studentDoc = await adminDb.collection("students").doc(studentId).get();
        const sData = studentDoc.data();
        const studentName = sData
          ? `${sData.name ?? ""} ${sData.surname ?? ""}`.trim() || "Bir öğrenci"
          : "Bir öğrenci";
        const sGroupId = sData?.groupId as string | undefined;
        if (!sGroupId) return;

        const groupDoc = await adminDb.collection("groups").doc(sGroupId).get();
        const instructorId = groupDoc.data()?.instructorId as string | undefined;
        if (!instructorId) return;

        const preview = safeText.length > 80 ? safeText.slice(0, 80) + "…" : safeText;

        // Eğitmen o an bu thread'i açık mı bakıyor?
        const instrDoc = await adminDb.collection("users").doc(instructorId).get();
        const activeThreadKey = instrDoc.data()?.activeThreadKey as string | undefined;
        const isOnThread = activeThreadKey === `${taskId}_${studentId}`;

        // Her yorum için unique ID — her yorum ayrı toast tetikler
        await adminDb
          .collection("users").doc(instructorId)
          .collection("notifications").doc()
          .set({
            type:      "message",
            entityId:  taskId,
            senderId:  uid,
            title:     `${studentName} yorum yaptı`,
            preview,
            actionUrl: `/dashboard/assignment-test/${sGroupId}/${taskId}`,
            createdAt: FieldValue.serverTimestamp(),
            isRead:    isOnThread,
            isArchived: false,
          });

        console.log(`[comments/create] Öğrenci bildirimi → ${instructorId}`);
      }
    } catch (err) {
      console.error("[comments/create] Bildirim hatası:", err);
    }
  })();

  return NextResponse.json({ success: true, commentId: commentRef.id });
}
