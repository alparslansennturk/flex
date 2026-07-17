import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";

/**
 * GET /api/flexos/groups/[id]/roster — grubun öğrenci listesi (sınıf listesi).
 * enrollment(listByGroup) → person join. PII alanları `person.read.pii` ile kapılı.
 * `active` (mevcut sınıf mevcudu) + `completed` (modülü bitmiş ama sertifika/ödev
 * notu hâlâ görüntülenmesi/düzenlenmesi gereken geçmiş kayıt) döner.
 *
 * Kapsam: hedef grup verilerek kontrol edilir — standalone eğitmen SADECE kendi
 * grubunun roster'ını çekebilir (`can()`'ın `ownerMatches` sahiplik kontrolü —
 * `Group.trainerId` uid DEĞİL eğitmen kadrosu docId'si, bkz. access/can.ts).
 */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  const actor = await actorFromCaller(caller);
  const group = await firestoreGroupRepo.getById(id, actor.tenantId);
  if (!group) return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });

  if (!can(actor, "person.read", { groupId: id, ownerUid: group.trainerId })) {
    return NextResponse.json({ error: "Yetki yok: person.read" }, { status: 403 });
  }

  try {
    const [enrollments, persons] = await Promise.all([
      firestoreEnrollmentRepo.listByGroup(id, actor.tenantId),
      firestorePersonRepo.list(actor.tenantId),
    ]);

    const personMap = new Map(persons.map((p) => [p.id, p]));
    const allowPII = can(actor, "person.read.pii");

    const items = enrollments
      .filter((e) => e.status === "active" || e.status === "completed")
      .map((e) => {
        const p = personMap.get(e.personId);
        return {
          enrollmentId: e.id,
          personId: e.personId,
          name: p ? `${p.firstName} ${p.lastName}` : e.personId,
          email: allowPII ? (p?.pii?.email ?? "") : "",
          phone: allowPII ? (p?.pii?.phone ?? "") : "",
          isOnlineStudent: p?.isOnlineStudent ?? false,
          // Flex Connect üye ekleme — konuşma üyeliği Firebase Auth uid'i taşır
          // (`ConnectMember.uid`), `personId` (Firestore doc id) DEĞİL.
          authUid: p?.authUid ?? null,
          assignedAt: e.createdAt,
          status: e.status,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/groups/:id/roster GET]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
