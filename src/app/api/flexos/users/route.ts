import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller, VIEW_TOGGLE_OWNER_EMAIL } from "@/app/lib/server/auth-actor";
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
    // Gerçek sistem sahibi (2026-07-10 kullanıcı kararı: "beni genel müdür falan listede
    // göremesin, kendime görünmek istiyorum sadece") — kendi kaydı SADECE kendi görüntülerken
    // listede kalır, başka hiçbir role.manage sahibine görünmez.
    const visibleUsers = users.filter((u) => u.email !== VIEW_TOGGLE_OWNER_EMAIL || caller.email === VIEW_TOGGLE_OWNER_EMAIL);

    // Aktivasyon durumu — "Beklemede" (kod henüz kullanılmadı) `status` alanından (istihdam
    // aktif/pasif toggle'ı) AYRI bir kavram (2026-07-10 kullanıcı: "hâlâ kod girmemişse
    // beklemede durur"). `flexos_users.status` oluşturulduğu anda hep "aktif" yazılıyor —
    // gerçek aktivasyon sinyali Firebase Auth'un kendi `emailVerified`'ı (`activation/verify`
    // SADECE kod doğru girilince `emailVerified:true` yapıyor, persons route'taki
    // accountStatus türetmesiyle AYNI desen).
    const pendingByUserId = new Set<string>();
    const withAuthUid = visibleUsers.filter((u) => u.authUid);
    if (withAuthUid.length > 0) {
      const uids = withAuthUid.map((u) => u.authUid!);
      const authUsersResult = await adminAuth.getUsers(uids.map((uid) => ({ uid }))).catch(() => ({ users: [] }));
      const verifiedByUid = new Map(authUsersResult.users.map((au) => [au.uid, au.emailVerified]));
      for (const u of withAuthUid) {
        if (verifiedByUid.get(u.authUid!) === false) pendingByUserId.add(u.id);
      }
    }

    const items = visibleUsers.map((u) => ({
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
      pendingActivation: pendingByUserId.has(u.id),
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
 *
 * E-posta ZATEN bir Firebase Auth hesabına sahipse (aynı proje canlı sistemle paylaşılıyor —
 * kişi canlıda öğrenci/eğitmen olabilir) yeni hesap açmaya çalışıp reddedilmek yerine MEVCUT
 * uid yeniden kullanılır (2026-07-10 fix — gerçek testte ortaya çıktı: ofis personelinin
 * e-postası canlıda zaten kayıtlıysa oluşturma tamamen tıkanıyordu).
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
  let createdNewAuthAccount = false;
  try {
    const displayName = [body.name?.trim(), body.surname?.trim()].filter(Boolean).join(" ");
    const created = await adminAuth.createUser({ email, displayName: displayName || undefined, emailVerified: false });
    authUid = created.uid;
    createdNewAuthAccount = true;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code !== "auth/email-already-exists") {
      console.error("[flexos/users POST] Firebase Auth hesabı oluşturulamadı:", e);
      return NextResponse.json({ error: "Hesap oluşturulamadı." }, { status: 500 });
    }
    // E-posta zaten bir Firebase Auth hesabına sahip — aynı proje canlı sistemle
    // PAYLAŞILIYOR (öğrenci/eğitmen hesabı olabilir). Additive tasarım: yeni hesap
    // açmaya çalışıp reddedilmek yerine MEVCUT uid'i yeniden kullan (instructor
    // backfill'deki presedanla aynı mantık — bkz FLEXOS.md). Zaten başka bir
    // flexos_users kaydına bağlıysa (aynı kişi iki kez eklenmeye çalışılıyor) reddet.
    const existingAuthUser = await adminAuth.getUserByEmail(email!);
    const alreadyLinked = await firestoreFlexosUserRepo.findByAuthUid(existingAuthUser.uid, actor.tenantId);
    if (alreadyLinked) {
      return NextResponse.json({ error: "Bu e-posta zaten bir FlexOS kullanıcısına bağlı." }, { status: 400 });
    }
    authUid = existingAuthUser.uid;
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
    // Firestore tarafı başarısız oldu — SADECE biz yeni açtıysak Auth hesabını geri al
    // (öksüz bırakma). Mevcut (canlı/başka) bir hesabı yeniden kullandıysak ASLA silme —
    // o bize ait değil.
    if (createdNewAuthAccount) await adminAuth.deleteUser(authUid).catch(() => {});
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
