import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendMail } from "@/app/lib/email";
import { buildActivationEmail } from "@/app/lib/user-validation";

export async function POST(req: NextRequest) {
  // ── Admin only (x-admin-secret) ─────────────────────────────────────────
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    userIds?: unknown;
    testMode?: unknown;
    confirm?:  unknown;
  };

  const { userIds, testMode = false, confirm } = body;

  // ── confirm: true zorunlu ───────────────────────────────────────────────
  if (confirm !== true)
    return NextResponse.json({ error: "confirm: true zorunludur." }, { status: 400 });

  // ── userIds kontrolü ────────────────────────────────────────────────────
  if (userIds !== "all-pending" && (!Array.isArray(userIds) || userIds.length === 0))
    return NextResponse.json({ error: "userIds: string[] veya 'all-pending' olmalıdır." }, { status: 400 });

  // ── Kodları getir ────────────────────────────────────────────────────────
  let codesSnap;
  if (userIds === "all-pending") {
    codesSnap = await adminDb.collection("codes").where("status", "==", "pending").get();
  } else {
    // Firestore "in" max 30 ID — büyük listeler için bölünmeli
    const ids = userIds as string[];
    if (ids.length > 30)
      return NextResponse.json({ error: "Tek seferinde en fazla 30 kullanıcıya gönderilebilir." }, { status: 400 });
    codesSnap = await adminDb.collection("codes")
      .where("userId", "in", ids)
      .where("status",  "==", "pending")
      .get();
  }

  if (codesSnap.empty)
    return NextResponse.json({ error: "Gönderilecek bekleyen aktivasyon kodu bulunamadı." }, { status: 404 });

  let sent = 0;
  let failed = 0;
  const emailedUsers: string[] = [];
  const errors:       string[] = [];

  for (const codeDoc of codesSnap.docs) {
    const codeData = codeDoc.data();

    // Süresi dolmuş kod atla
    const expiresAt: Date = codeData.expiresAt?.toDate?.() ?? new Date(0);
    if (expiresAt < new Date()) {
      errors.push(`${codeData.email}: kod süresi dolmuş`);
      failed++;
      continue;
    }

    // Kullanıcı bilgilerini al
    const userSnap = await adminDb.collection("users").doc(codeData.userId).get();
    if (!userSnap.exists) {
      errors.push(`${codeData.userId}: kullanıcı bulunamadı`);
      failed++;
      continue;
    }
    const user = userSnap.data()!;

    const emailTemplate = buildActivationEmail({
      name:      user.name as string,
      email:     codeData.email as string,
      code:      codeData.code  as string,
      expiresAt,
    });

    // testMode: gerçek alıcı yerine sender adresine gönder
    const recipient = testMode === true
      ? (process.env.BREVO_SENDER_EMAIL ?? codeData.email)
      : codeData.email;

    const result = await sendMail({
      to:      recipient as string,
      subject: emailTemplate.subject,
      html:    emailTemplate.html,
      text:    emailTemplate.text,
    });

    const logEntry = {
      to:        recipient,
      userId:    codeData.userId,
      subject:   emailTemplate.subject,
      type:      "activation_code",
      status:    result.success ? "success" : "failed",
      messageId: result.messageId ?? null,
      error:     result.error    ?? null,
      testMode:  testMode === true,
      createdAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("mailLogs").add(logEntry);

    if (result.success) {
      await codeDoc.ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp() });
      await adminDb.collection("users").doc(codeData.userId).update({ status: "code_sent" });
      emailedUsers.push(codeData.email as string);
      sent++;
    } else {
      errors.push(`${codeData.email}: ${result.error}`);
      failed++;
    }
  }

  return NextResponse.json({
    success:      true,
    sent,
    failed,
    emailedUsers,
    errors:       errors.length > 0 ? errors : undefined,
    message:      `${sent} aktivasyon kodu gönderildi.`,
  });
}
