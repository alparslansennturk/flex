import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import type { PersonPII } from "@/app/lib/domain/core/person";

/**
 * PATCH /api/flexos/persons/[id] — Kişi bilgilerini güncelle.
 *
 * Güncellenebilir alanlar:
 *  - firstName, lastName, gender, birthDate (person.write)
 *  - pii: phone, email, address, idType, idNo (person.pii.write)
 */
export const PATCH = withAuth(async (req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = actorFromCaller(caller);

  if (!can(actor, "person.write")) {
    return NextResponse.json({ error: "Yetki yok: person.write" }, { status: 403 });
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
