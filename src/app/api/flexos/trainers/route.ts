import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createTrainer, type CreateTrainerInput } from "@/app/lib/domain/services/trainer-service";
import { generateActivationCode } from "@/app/lib/user-validation";
import { buildFlexosActivationEmail } from "@/app/lib/server/flexos-activation-email";
import { sendMail } from "@/app/lib/email";
import type { Trainer } from "@/app/lib/domain/core/trainer";
import type { FlexosUser } from "@/app/lib/domain/core/flexos-user";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

const ACTIVATION_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün — Kullanıcı Ekle ile aynı

/**
 * Eğitmen Ekle'nin yan etkisi: eğitmene giriş hesabı + aktivasyon kodu OTOMATİK sağlanır
 * (kullanıcı kararı 2026-07-10: "eğitmenlerden eklerim, kullanıcılara da otomatik eklenmeli,
 * kod göndermeli — 10 kere iş yapmak istemem"). `/api/flexos/users` POST'taki additive-reuse
 * deseninin birebir aynısı: e-posta zaten bir Auth hesabına/flexos_users kaydına bağlıysa
 * MEVCUT hesap kullanılır, yeni kod/mail gönderilmez (idempotent — tekrar tekrar
 * "Eğitmen Ekle" ile aynı e-posta girilse bile spam yok). Zaten `role:"admin"` claim'i olan
 * bir hesap ASLA "instructor"a düşürülmez (admin zaten üst kümesi — bkz. kullanıcı diyaloğu:
 * "eğitmenlerden kendimi eklersem" endişesi). `role.manage` GEREKMEZ — bu adım zaten
 * `trainer.create` ile yetkilendirilmiş aksiyonun otomatik yan etkisi (ayrı bir yetki kapısı
 * koymak Eğitim Koordinatörü gibi role.manage'i olmayan ama trainer.create'i olan rollerin
 * eğitmen eklemesini kırar). Best-effort: hata olursa eğitmen kaydı BAŞARISIZ SAYILMAZ.
 */
async function provisionTrainerLogin(trainer: Trainer, tenantId: string): Promise<void> {
  const email = trainer.email.trim().toLowerCase();

  const existingFlexosUser = await firestoreFlexosUserRepo.getByEmail(email, tenantId);
  if (existingFlexosUser) {
    if (existingFlexosUser.authUid && existingFlexosUser.authUid !== trainer.authUid) {
      await firestoreTrainerRepo.save({ ...trainer, authUid: existingFlexosUser.authUid });
    }
    return; // zaten bağlı bir hesabı var (Personel veya daha önce eklenmiş eğitmen) — dokunma
  }

  let authUid: string;
  let existingClaims: Record<string, unknown> = {};
  try {
    const existingAuthUser = await adminAuth.getUserByEmail(email);
    authUid = existingAuthUser.uid;
    existingClaims = existingAuthUser.customClaims ?? {};
  } catch {
    const created = await adminAuth.createUser({ email, displayName: trainer.name, emailVerified: false });
    authUid = created.uid;
  }

  if (existingClaims.role !== "admin") {
    await adminAuth.setCustomUserClaims(authUid, { ...existingClaims, role: "instructor" });
  }

  const nameParts = trainer.name.trim().split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts.pop()! : "-";
  const flexosUser: FlexosUser = {
    id: firestoreFlexosUserRepo.nextId(),
    tenantId,
    name: nameParts.join(" ") || trainer.name,
    surname,
    email,
    phone: trainer.phone,
    gender: "unspecified",
    roles: ["egitmen"],
    subes: trainer.branchOffices,
    status: "aktif",
    authUid,
    createdAt: new Date().toISOString(),
    createdBy: trainer.createdBy,
  };
  await firestoreFlexosUserRepo.save(flexosUser);
  await firestoreTrainerRepo.save({ ...trainer, authUid });

  try {
    const code = generateActivationCode();
    const expiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS);
    await adminDb.collection("flexos_codes").add({
      code, flexosUserId: flexosUser.id, tenantId, email: flexosUser.email,
      createdAt: FieldValue.serverTimestamp(), expiresAt, status: "pending",
    });
    const emailTemplate = buildFlexosActivationEmail({
      name: `${flexosUser.name} ${flexosUser.surname}`.trim(), email: flexosUser.email, code, expiresAt,
    });
    await sendMail({ to: flexosUser.email, subject: emailTemplate.subject, html: emailTemplate.html, text: emailTemplate.text });
  } catch (mailErr) {
    console.error("[flexos/trainers POST] Aktivasyon maili gönderilemedi:", mailErr);
  }
}

/**
 * GET /api/flexos/trainers — eğitmen listesi (kiracıya göre).
 * Read-time join: atanmış gruplar (Group.trainerId == trainer.id) + eğitim adı + doluluk.
 * `hourlyRate` (ücret) yalnız `trainer.rate.read` yetkisiyle döner, yoksa null (maskeli).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "trainer.read")) {
    return NextResponse.json({ error: "Yetki yok: trainer.read" }, { status: 403 });
  }

  try {
    const [trainers, groups, educations] = await Promise.all([
      firestoreTrainerRepo.list(actor.tenantId),
      firestoreGroupRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
    ]);
    // 2026-07-12 ACİL kota fix (bkz. groups/route.ts'teki aynı fix): tenant-genelinde
    // sınırsız enrollment okuması yerine SADECE görüntülenen grupların enrollment'ları.
    const enrollments = await firestoreEnrollmentRepo.listByGroupIds(groups.map((g) => g.id), actor.tenantId);

    const eduMap = new Map(educations.map((e) => [e.id, e]));

    // Grup başına öğrenci sayısı — groups/route.ts ile AYNI kural (active+completed),
    // bkz. oradaki 2026-07-11 tutarlılık notu.
    const enrolledByGroup = new Map<string, number>();
    for (const enr of enrollments) {
      if (enr.groupId && (enr.status === "active" || enr.status === "completed")) {
        enrolledByGroup.set(enr.groupId, (enrolledByGroup.get(enr.groupId) ?? 0) + 1);
      }
    }

    // trainerId → atanmış gruplar
    const groupsByTrainer = new Map<string, Array<{ kod: string; egitim: string; ogrenci: number }>>();
    for (const g of groups) {
      if (!g.trainerId) continue;
      const list = groupsByTrainer.get(g.trainerId) ?? [];
      list.push({
        kod: g.code,
        egitim: g.educationId ? eduMap.get(g.educationId)?.name ?? "" : "",
        ogrenci: enrolledByGroup.get(g.id) ?? 0,
      });
      groupsByTrainer.set(g.trainerId, list);
    }

    const allowRate = can(actor, "trainer.rate.read");

    const items = trainers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      phone: t.phone ?? "",
      subes: t.branchOffices ?? [],
      status: t.status,
      comp: t.competencies ?? {},
      ucret: allowRate ? (t.hourlyRate ?? null) : null,
      rateLocked: !allowRate, // UI: ücret yetkisi yok mu
      musaitlik: t.availability ?? [],
      notes: t.notes ?? [],
      groups: groupsByTrainer.get(t.id) ?? [],
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/trainers GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * POST /api/flexos/trainers — yeni eğitmen oluştur (gated `trainer.create`).
 * Ücret yalnız `trainer.rate.write` varsa yazılır (serviste filtrelenir).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateTrainerInput;
  try {
    body = (await req.json()) as CreateTrainerInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const result = await createTrainer(actor, body, firestoreTrainerRepo);
    try {
      await provisionTrainerLogin(result.trainer, actor.tenantId);
    } catch (loginErr) {
      console.error("[flexos/trainers POST] giriş hesabı sağlanamadı:", loginErr);
    }
    broadcast(actor.tenantId, { type: "trainers.changed", id: result.trainer.id });
    return NextResponse.json({ id: result.trainer.id, rateDropped: result.rateDropped }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/trainers POST] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
