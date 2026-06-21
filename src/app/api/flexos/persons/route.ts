import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { createPerson, type CreatePersonInput } from "@/app/lib/domain/services/person-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import type { Person } from "@/app/lib/domain/core/person";
import type { Enrollment } from "@/app/lib/domain/core/enrollment";

/**
 * GET /api/flexos/persons — Öğrenci Havuzu listesi.
 * Server-side read-time join: Person + Enrollment + Education + Branch + Group.
 * PII alanları `person.read.pii` yetkisiyle kapılıdır.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);

  if (!can(actor, "person.read")) {
    return NextResponse.json({ error: "Yetki yok: person.read" }, { status: 403 });
  }

  try {
    const [persons, enrollments, educations, branches, groups] = await Promise.all([
      firestorePersonRepo.list(actor.tenantId),
      firestoreEnrollmentRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreBranchRepo.list(actor.tenantId),
      firestoreGroupRepo.list(actor.tenantId),
    ]);

    const eduMap = new Map(educations.map((e) => [e.id, e]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    // enrollment'ları personId'ye göre grupla
    const enrollByPerson = new Map<string, Enrollment[]>();
    for (const enr of enrollments) {
      const list = enrollByPerson.get(enr.personId) ?? [];
      list.push(enr);
      enrollByPerson.set(enr.personId, list);
    }

    const allowPII = can(actor, "person.read.pii");

    const items = persons.map((p: Person) => {
      const enrs = enrollByPerson.get(p.id) ?? [];

      // branş listesi (enrollment → education → branch)
      const branchNames = new Set<string>();
      const groupList: Array<{ label: string; branch: string }> = [];

      for (const enr of enrs) {
        const edu = enr.educationId ? eduMap.get(enr.educationId) : undefined;
        const branch = edu?.branchId ? branchMap.get(edu.branchId) : undefined;
        if (branch) branchNames.add(branch.name);

        if (enr.groupId) {
          const grp = groupMap.get(enr.groupId);
          groupList.push({
            label: grp?.code ? `Grup ${grp.code}` : enr.groupId,
            branch: branch?.name ?? "",
          });
        }
      }

      // enrollment durumundan havuz durumu türet
      const status = derivePoolStatus(p, enrs);

      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        email: allowPII ? (p.pii?.email ?? "") : "",
        phone: allowPII ? (p.pii?.phone ?? "") : "",
        status,
        branches: [...branchNames],
        groups: groupList,
        gender: p.gender ?? "",
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/persons GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** Person status + enrollment'lardan havuz durumu türet. */
function derivePoolStatus(p: Person, enrollments: Enrollment[]): string {
  if (p.status === "prospect") return "beklemede";
  if (p.status === "passive") return "pasif";

  if (enrollments.length === 0) return "grupsuz";

  const hasActive = enrollments.some((e) => e.status === "active");
  const hasFrozen = enrollments.some((e) => e.status === "frozen");
  const allCompleted = enrollments.every((e) => e.status === "completed");
  const hasGroupless = enrollments.some((e) => e.status === "active" && !e.groupId);

  if (hasFrozen) return "donduruldu";
  if (allCompleted) return "mezun";
  if (hasGroupless) return "grupsuz";
  if (hasActive) return "aktif";

  return "beklemede";
}

/**
 * POST /api/flexos/persons — yeni kişi oluştur (gated).
 *
 * Yetki + PII filtreleme service'te (`createPerson`). Bu route sadece:
 *  token → Actor, gövde → input, hata → HTTP kodu.
 * Yazım Admin SDK ile yeni `persons` koleksiyonuna; canlıya dokunmaz.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreatePersonInput;
  try {
    body = (await req.json()) as CreatePersonInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = actorFromCaller(caller);

  try {
    const result = await createPerson(actor, body, firestorePersonRepo);
    return NextResponse.json(
      { id: result.person.id, piiDropped: result.piiDropped },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/persons] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
