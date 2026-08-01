import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { firestoreCaseRepo } from "@/app/lib/server/case-repo.firestore";
import { firestoreActivityRepo } from "@/app/lib/server/activity-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { firestoreBranchOfficeRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createCase, type CreateCaseInput } from "@/app/lib/domain/services/case-service";
import type { CaseChannel, CaseType } from "@/app/lib/domain/crm/case";
import type { Person } from "@/app/lib/domain/core/person";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/**
 * GET /api/flexos/cases — tüm talepler (kişi bilgisi join'li).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "case.read")) {
    return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
  }

  const cases = await firestoreCaseRepo.list(actor.tenantId);

  const personIds = [...new Set(cases.map((c) => c.personId))];
  const persons = await Promise.all(
    personIds.map((id) => firestorePersonRepo.getById(id, actor.tenantId)),
  );
  const personMap = new Map(persons.filter(Boolean).map((p) => [p!.id, p!]));
  const showPII = can(actor, "person.read.pii");

  // Şube filtresi için (Aktivite Merkezi'nin varsayılan "kendi şubem" görünümü) — talebin
  // kendi şubesi yok, sorumlu personelin (`assignedToUid`) şubesinden türetilir. Atanmamış
  // talep (assignedToUid yok) → officeName null, her şube filtresinde görünmeye devam eder.
  const assignedUids = [...new Set(cases.map((c) => c.assignedToUid).filter((u): u is string => !!u))];
  const assignedUsers = await Promise.all(
    assignedUids.map((uid) => firestoreFlexosUserRepo.findByAuthUid(uid, actor.tenantId)),
  );
  const officeIdByUid = new Map<string, string>(
    assignedUsers
      .filter((u): u is NonNullable<typeof u> => !!u && !!u.officeId)
      .map((u) => [u.authUid!, u.officeId!]),
  );
  const officeIds = [...new Set(officeIdByUid.values())];
  const offices = await Promise.all(officeIds.map((id) => firestoreBranchOfficeRepo.getById(id, actor.tenantId)));
  const officeNameById = new Map(offices.filter(Boolean).map((o) => [o!.id, o!.name]));

  // Liste satırı için her talebin İLK (müşteri mesajı) + SON (özet/sonraki-aksiyon) aktivitesi.
  const activityLists = await Promise.all(
    cases.map((c) => firestoreActivityRepo.listByCase(c.id, actor.tenantId)),
  );
  type Act = (typeof activityLists)[number][number];
  const logMap = new Map<string, Act[]>();
  cases.forEach((c, i) => {
    const list = [...activityLists[i]].sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    );
    if (list.length) logMap.set(c.id, list);
  });

  const items = cases.map((c) => {
    const person = personMap.get(c.personId);
    const log = logMap.get(c.id) ?? [];
    const first = log[0];
    const last = log[log.length - 1];
    const officeId = c.assignedToUid ? officeIdByUid.get(c.assignedToUid) : undefined;
    return {
      ...c,
      personName: person ? `${person.firstName} ${person.lastName}` : "—",
      personPhone: showPII ? (person?.pii?.phone ?? null) : null,
      personEmail: showPII ? (person?.pii?.email ?? null) : null,
      officeName: officeId ? (officeNameById.get(officeId) ?? null) : null,
      firstActivityNote: first?.note ?? null,  // müşteri mesajı (ilk temas)
      lastActivityNote: last?.note ?? null,
      lastActivityType: last?.type ?? null,
      nextActionType: last?.nextActionType ?? null,
      nextActionDate: last?.nextActionDate ?? null,
      // Tam aktivite geçmişi (kronolojik) — panelde "Geçmiş Aksiyonlar".
      activityLog: log.map((x) => ({
        note: x.note ?? null,
        type: x.type,
        createdAt: x.createdAt,
        nextActionType: x.nextActionType ?? null,
      })),
    };
  });

  return NextResponse.json({ items });
});

interface PostBody {
  /** Varolan kişi id'si (öncelikli). */
  personId?: string;
  /** Yeni kişi verileri — personId yoksa kullanılır. */
  personData?: {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    idNo?: string;
  };
  channel: CaseChannel;
  type: CaseType;
  note?: string;
  assignedToUid?: string;
  assignedToName?: string;
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * POST /api/flexos/cases — yeni talep.
 * personId veya personData (TC ile dedup → yoksa prospect Person) gerekir.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    let resolvedPersonId = body.personId;

    if (!resolvedPersonId) {
      if (!can(actor, "person.create")) throw new ForbiddenError("person.create");

      const pd = body.personData;
      if (!pd?.firstName || !pd?.lastName) {
        throw new ValidationError("Kişi adı ve soyadı zorunludur.");
      }

      // TC ile dedup dene
      let existing: Person | null = null;
      if (pd.idNo) {
        existing = await firestorePersonRepo.findByIdNo(pd.idNo, actor.tenantId);
      }

      if (existing) {
        resolvedPersonId = existing.id;
      } else {
        // Prospect Person oluştur
        const ts = nowISO();
        const prospect: Person = {
          id: firestorePersonRepo.nextId(),
          tenantId: actor.tenantId,
          firstName: pd.firstName.trim(),
          lastName: pd.lastName.trim(),
          status: "prospect",
          consentKVKK: false,
          pii: pd.phone || pd.idNo || pd.email ? {
            phone: pd.phone,
            email: pd.email,
            idNo: pd.idNo,
          } : undefined,
          createdAt: ts,
          createdBy: actor.uid,
        };
        await firestorePersonRepo.save(prospect);
        resolvedPersonId = prospect.id;
      }
    }

    const input: CreateCaseInput = {
      personId: resolvedPersonId!,
      channel: body.channel,
      type: body.type,
      note: body.note,
      assignedToUid: body.assignedToUid,
      assignedToName: body.assignedToName,
    };

    const result = await createCase(actor, input, {
      cases: firestoreCaseRepo,
      activities: firestoreActivityRepo,
    });

    broadcast(actor.tenantId, { type: "activities.changed", id: result.case.id });
    return NextResponse.json({ id: result.case.id, activityId: result.activity.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/cases");
  }
});
