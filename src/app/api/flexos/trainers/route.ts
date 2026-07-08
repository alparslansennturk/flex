import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createTrainer, type CreateTrainerInput } from "@/app/lib/domain/services/trainer-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

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
    const [trainers, groups, educations, enrollments] = await Promise.all([
      firestoreTrainerRepo.list(actor.tenantId),
      firestoreGroupRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreEnrollmentRepo.list(actor.tenantId),
    ]);

    const eduMap = new Map(educations.map((e) => [e.id, e]));

    // grup başına aktif kayıt (doluluk)
    const enrolledByGroup = new Map<string, number>();
    for (const enr of enrollments) {
      if (enr.groupId && enr.status === "active") {
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
