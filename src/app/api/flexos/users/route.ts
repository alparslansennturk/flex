import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { firestoreRoleDefRepo } from "@/app/lib/server/role-def-repo.firestore";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateActivationCode } from "@/app/lib/user-validation";
import { buildFlexosActivationEmail } from "@/app/lib/server/flexos-activation-email";
import { sendMail } from "@/app/lib/email";
import {
  createFlexosUser,
  type CreateFlexosUserInput,
} from "@/app/lib/domain/services/flexos-user-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

const ACTIVATION_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün — canlıyla aynı

/** GET /api/flexos/users — Kullanıcı listesi */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "role.manage")) {
    return NextResponse.json({ error: "Yetki yok: role.manage" }, { status: 403 });
  }

  try {
    const users = await firestoreFlexosUserRepo.list(actor.tenantId);
    const items = users.map((u) => ({
      id: u.id,
      name: u.name,
      surname: u.surname,
      email: u.email,
      phone: u.phone ?? "",
      gender: u.gender,
      birthDate: u.birthDate ?? null,
      title: u.title ?? "",
      roles: u.roles,
      subes: u.subes,
      permOverrides: u.permOverrides ?? {},
      status: u.status,
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/users GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * POST /api/flexos/users — Yeni kullanıcı oluştur.
 * Firestore doc'un yanında GERÇEK bir Firebase Auth hesabı da açar (2026-07-08 öncesi
 * sadece Firestore doc yazılıyordu, kullanıcı hiç login olamıyordu). Hesap açılınca
 * `flexos_codes`'a bir aktivasyon kodu yazılır ve mail OTOMATİK gönderilir — canlıdaki
 * gibi ayrı bir "kodu gönder" adımı yok (kullanıcı kararı: "ben asla göndermiyorum,
 * otomatik gidiyor zaten"; manuel tekrar-gönder sadece sorunlu durumlar için ayrı bir iş).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateFlexosUserInput;
  try {
    body = (await req.json()) as CreateFlexosUserInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  // Firestore tarafında zaten var mı — Firebase Auth hesabı açmadan ÖNCE kontrol
  // edilir, aksi halde çakışma durumunda öksüz (orphan) bir Auth hesabı kalır.
  const email = body.email?.trim().toLowerCase();
  if (email) {
    const existing = await firestoreFlexosUserRepo.getByEmail(email, actor.tenantId);
    if (existing) return NextResponse.json({ error: "Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var." }, { status: 400 });
  }

  let authUid: string;
  try {
    const displayName = [body.name?.trim(), body.surname?.trim()].filter(Boolean).join(" ");
    const created = await adminAuth.createUser({ email, displayName: displayName || undefined, emailVerified: false });
    authUid = created.uid;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Bu e-posta adresiyle zaten bir hesap var." }, { status: 400 });
    }
    console.error("[flexos/users POST] Firebase Auth hesabı oluşturulamadı:", e);
    return NextResponse.json({ error: "Hesap oluşturulamadı." }, { status: 500 });
  }

  try {
    const user = await createFlexosUser(actor, { ...body, authUid }, firestoreFlexosUserRepo, firestoreRoleDefRepo);

    // Aktivasyon kodu + otomatik mail — hata olsa da kullanıcı oluşturma başarısız sayılmaz
    // (admin ileride manuel "tekrar gönder" ile telafi edebilir — ayrı, henüz yapılmamış iş).
    try {
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
    } catch (mailErr) {
      console.error("[flexos/users POST] Aktivasyon maili gönderilemedi:", mailErr);
    }

    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (e) {
    // Firestore tarafı başarısız oldu — az önce açılan Auth hesabını geri al (öksüz bırakma).
    await adminAuth.deleteUser(authUid).catch(() => {});
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/users POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
