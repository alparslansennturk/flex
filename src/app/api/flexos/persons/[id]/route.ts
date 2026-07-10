import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { adminAuth, adminDb } from "@/app/lib/firebase-admin";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestorePaymentRepo } from "@/app/lib/server/payment-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo } from "@/app/lib/server/catalog-repo.firestore";
import { derivePaymentStatus, derivePaymentRollup } from "@/app/lib/domain/services/payment-service";
import { deletePerson } from "@/app/lib/domain/services/person-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import type { PersonPII } from "@/app/lib/domain/core/person";

/** Kapanan/silinen bir hesabın Auth + öksüz canlı `users/{uid}` izini temizler (best-effort). */
async function cleanupAuthAccount(authUid: string | null): Promise<void> {
  if (!authUid) return;
  try {
    await adminAuth.deleteUser(authUid);
  } catch {
    // zaten silinmiş olabilir
  }
  try {
    await adminDb.collection("users").doc(authUid).delete();
  } catch {
    // doc yoksa sessizce geç
  }
}

/**
 * GET /api/flexos/persons/[id] — Öğrenci detayı (drawer için).
 * Liste ucunda OLMAYAN ağır alanları döndürür: tam PII (TC/adres/doğum) + ödeme
 * planı (taksitler, türetilen durum) + satış/veli özeti. PII ve ödeme alan-bazlı kapılı.
 */
export const GET = withAuth(async (_req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);

  if (!can(actor, "person.read")) {
    return NextResponse.json({ error: "Yetki yok: person.read" }, { status: 403 });
  }

  try {
    const person = await firestorePersonRepo.getById(id, actor.tenantId);
    if (!person) {
      return NextResponse.json({ error: "Kişi bulunamadı." }, { status: 404 });
    }

    const allowPII = can(actor, "person.read.pii");
    const allowPay = can(actor, "payment.read");

    const [sales, payments, educations] = await Promise.all([
      allowPay ? firestoreSaleRepo.listByPerson(id, actor.tenantId) : Promise.resolve([]),
      allowPay ? firestorePaymentRepo.listByPerson(id, actor.tenantId) : Promise.resolve([]),
      allowPay ? firestoreEducationRepo.list(actor.tenantId) : Promise.resolve([]),
    ]);

    const eduName = new Map(educations.map((e) => [e.id, e.name]));
    const today = new Date().toISOString().slice(0, 10);

    // satış özeti (en yeni önce)
    const salesOut = sales
      .slice()
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .map((s) => ({
        id: s.id,
        educationName: s.educationId ? (eduName.get(s.educationId) ?? "—") : "—",
        status: s.status,
        soldPrice: s.soldPrice ?? 0,
        financingFee: s.financingFee ?? 0,
        guardian: s.guardian ?? null,
        date: s.date ?? (s.createdAt ?? "").slice(0, 10),
      }));

    // ödeme planı + türetilen durum (taksit sırasına göre)
    const paymentsOut = payments
      .slice()
      .sort((a, b) => {
        const da = a.dueDate ?? a.paidAt ?? "";
        const db = b.dueDate ?? b.paidAt ?? "";
        return da.localeCompare(db);
      })
      .map((p) => ({
        id: p.id,
        saleId: p.saleId,
        method: p.method,
        amount: p.amount,
        installmentNo: p.installmentNo ?? null,
        installmentTotal: p.installmentTotal ?? null,
        dueDate: p.dueDate ?? null,
        paidAt: p.paidAt ?? null,
        status: derivePaymentStatus(p, today),
      }));

    const totalExpected = sales.reduce((a, s) => a + (s.soldPrice ?? 0) + (s.financingFee ?? 0), 0);
    const totalPaid = payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
    const rollup = payments.length > 0 || totalExpected > 0
      ? derivePaymentRollup(payments, totalExpected, today)
      : null;

    return NextResponse.json({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender ?? "",
      birthDate: person.birthDate ?? "",
      pii: allowPII
        ? {
            phone: person.pii?.phone ?? "",
            email: person.pii?.email ?? "",
            address: person.pii?.address ?? "",
            idNo: person.pii?.idNo ?? "",
            idType: person.pii?.idType ?? "tc",
          }
        : null,
      sales: salesOut,
      payments: paymentsOut,
      totals: { expected: totalExpected, paid: totalPaid, remaining: Math.max(0, totalExpected - totalPaid), rollup },
    });
  } catch (e) {
    console.error("[flexos/persons/[id] GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * PATCH /api/flexos/persons/[id] — Kişi bilgilerini güncelle.
 *
 * Güncellenebilir alanlar:
 *  - firstName, lastName, gender, birthDate (person.write)
 *  - pii: phone, email, address, idType, idNo (person.pii.write)
 */
export const PATCH = withAuth(async (req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);

  if (!can(actor, "person.edit")) {
    return NextResponse.json({ error: "Yetki yok: person.edit" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const updateData: Record<string, unknown> = {};

    // Temel alanlar
    if (typeof body.firstName === "string" && body.firstName.trim()) {
      updateData.firstName = body.firstName.trim();
    }
    if (typeof body.lastName === "string" && body.lastName.trim()) {
      updateData.lastName = body.lastName.trim();
    }
    if (typeof body.gender === "string") {
      updateData.gender = body.gender;
    }
    if (typeof body.birthDate === "string") {
      updateData.birthDate = body.birthDate || null;
    }

    // PII alanları — ayrı yetki
    if (body.pii && typeof body.pii === "object") {
      if (!can(actor, "person.pii.write")) {
        return NextResponse.json({ error: "Yetki yok: person.pii.write" }, { status: 403 });
      }
      const piiInput = body.pii as Partial<PersonPII>;
      const pii: Partial<PersonPII> = {};
      if (typeof piiInput.phone === "string") pii.phone = piiInput.phone.trim();
      if (typeof piiInput.email === "string") pii.email = piiInput.email.trim();
      if (typeof piiInput.address === "string") pii.address = piiInput.address.trim();
      if (typeof piiInput.idType === "string") pii.idType = piiInput.idType as PersonPII["idType"];
      if (typeof piiInput.idNo === "string") pii.idNo = piiInput.idNo.trim();

      // Firestore dot-notation merge (pii alt alanlarını tek tek güncelle, üstünü ezme)
      for (const [k, v] of Object.entries(pii)) {
        updateData[`pii.${k}`] = v;
      }
    }

    updateData.updatedAt = new Date().toISOString();

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    await firestorePersonRepo.update(id, actor.tenantId, updateData);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[flexos/persons PATCH] hata:", e);
    const msg = (e as Error).message;
    if (msg === "Person not found" || msg === "Tenant mismatch") {
      return NextResponse.json({ error: "Kişi bulunamadı." }, { status: 404 });
    }
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * DELETE /api/flexos/persons/[id] — Kişiyi TAMAMEN sil (admin-only, `role.manage`).
 * Satış/ödeme geçmişi varsa reddedilir (`deletePerson` içinde) — sadece dummy/test/
 * yanlışlıkla açılmış, hiçbir finansal/akademik izi olmayan kayıtlar için. Enrollment'lar
 * cascade silinir. Hesabı varsa Firebase Auth + öksüz canlı `users/{uid}` dokümanı da temizlenir.
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);

  try {
    const result = await deletePerson(actor, id, {
      persons: firestorePersonRepo,
      enrollments: firestoreEnrollmentRepo,
      sales: firestoreSaleRepo,
      payments: firestorePaymentRepo,
    });
    await cleanupAuthAccount(result.closedAuthUid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/persons DELETE] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
