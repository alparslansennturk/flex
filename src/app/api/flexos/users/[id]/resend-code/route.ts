import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateActivationCode } from "@/app/lib/user-validation";
import { buildFlexosActivationEmail } from "@/app/lib/server/flexos-activation-email";
import { sendMail } from "@/app/lib/email";

const ACTIVATION_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün — POST /users ile aynı

/**
 * POST /api/flexos/users/[id]/resend-code — Aktivasyon kodunu tekrar gönder (admin-only,
 * `role.manage`). 2026-07-10 kullanıcı ihtiyacı: "kod kayboldu, tekrar gönderilmesi
 * gerekebilir." SADECE hâlâ aktive olmamış (Firebase Auth `emailVerified:false`) hesaplar
 * için — zaten aktive olmuş birine yeni kod göndermenin anlamı yok, reddedilir. Eski
 * bekleyen kodlar geçersiz kılınır (aynı anda birden fazla geçerli kod dolaşmasın).
 */
export const POST = withAuth(async (_req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);
  if (!can(actor, "role.manage")) {
    return NextResponse.json({ error: "Yetki yok: role.manage" }, { status: 403 });
  }

  try {
    const user = await firestoreFlexosUserRepo.getById(id, actor.tenantId);
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    if (!user.authUid) return NextResponse.json({ error: "Bu kullanıcının bağlı bir hesabı yok." }, { status: 400 });

    const authUser = await adminAuth.getUser(user.authUid).catch(() => null);
    if (!authUser) return NextResponse.json({ error: "Firebase hesabı bulunamadı." }, { status: 404 });
    if (authUser.emailVerified) {
      return NextResponse.json({ error: "Bu kullanıcı zaten aktive olmuş." }, { status: 400 });
    }

    // Eski bekleyen kodları geçersiz kıl.
    const oldCodes = await adminDb.collection("flexos_codes")
      .where("flexosUserId", "==", id)
      .where("tenantId", "==", actor.tenantId)
      .where("status", "==", "pending")
      .get();
    await Promise.all(oldCodes.docs.map((d) => d.ref.update({ status: "superseded" })));

    const code = generateActivationCode();
    const expiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS);
    await adminDb.collection("flexos_codes").add({
      code, flexosUserId: user.id, tenantId: actor.tenantId, email: user.email,
      createdAt: FieldValue.serverTimestamp(), expiresAt, status: "pending",
    });
    const emailTemplate = buildFlexosActivationEmail({
      name: `${user.name} ${user.surname}`.trim(), email: user.email, code, expiresAt,
    });
    await sendMail({ to: user.email, subject: emailTemplate.subject, html: emailTemplate.html, text: emailTemplate.text });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[flexos/users/:id/resend-code POST] hata:", e);
    return NextResponse.json({ error: "Kod gönderilemedi." }, { status: 500 });
  }
});
