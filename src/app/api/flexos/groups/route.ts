import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import type { Actor } from "@/app/lib/domain/access/types";
import { can, widestScope } from "@/app/lib/domain/access/can";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo, firestoreSectionRepo, firestoreTrackRepo, firestoreBranchRepo, firestoreBranchOfficeRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { createGroup, type CreateGroupInput } from "@/app/lib/domain/services/group-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { cachedRead, invalidateCache } from "@/app/lib/server/read-cache";

/** Groups GET yanıtı ağır (6 koleksiyon) ve aynı mount'ta 3× + ~7 ekranda çağrılıyor.
 *  2026-07-14: en pahalı uç olduğu için (grup/enrollment) 5dk yerine kısa 1dk TTL —
 *  Ana Sayfa'daki art arda çağrıları (aynı mount'ta 3×) keser, gerçek bir değişikliği
 *  en fazla 1dk geciktirir (ki zaten `invalidateCache` + SSE broadcast ile mutasyon
 *  sonrası ANINDA taze gelir, bu sadece "hiç mutasyon olmasa en kötü durum" sınırı). */
const GROUPS_CACHE_TTL_MS = 60_000;

/**
 * POST /api/flexos/groups — yeni grup oluştur (gated `group.create`).
 * Yazım Admin SDK ile yeni `flexos_groups` koleksiyonuna; canlı `groups`'a dokunmaz.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateGroupInput;
  try {
    body = (await req.json()) as CreateGroupInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const group = await createGroup(actor, body, {
      groups: firestoreGroupRepo,
      educations: firestoreEducationRepo,
      sections: firestoreSectionRepo,
      tracks: firestoreTrackRepo,
    });
    invalidateCache(`groups:${actor.tenantId}`); // yeni grup — cache'i anında düşür
    broadcast(actor.tenantId, { type: "groups.changed", id: group.id });
    return NextResponse.json({ id: group.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/groups] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * GET /api/flexos/groups?trainerId=... — grup listesi (kiracıya göre), zenginleştirilmiş.
 * Read-time join: eğitim adı + branş adı (eğitim→branchId) + doluluk (aktif enrollment sayısı).
 * Ham alanlar (code/type/status/educationId/schedule/capacity) korunur (geriye dönük uyumlu).
 *
 * Kapsam: org-scope olmayan aktör (örn. standalone eğitmen) `trainerId` parametresi
 * ne olursa olsun SADECE kendi grubunu görür — başka eğitmenin grubunu/öğrencisini
 * göremez (client'ın gönderdiği trainerId'ye güvenilmez, sunucu kendi uid'ini zorlar).
 */
/**
 * `group.read` yetkisi zaten çağıran tarafından doğrulanmış olmalı (bkz. GET altında
 * ve bootstrap/route.ts). Bootstrap endpoint'i de AYNI fonksiyonu çağırıp tekrar
 * kod yazmadan aynı cache/coalescing'i paylaşır.
 */
export async function fetchGroupsForActor(actor: Actor, requestedTrainerId?: string) {
  const isOrgScope = widestScope(actor, "group.read") === "org";
  // `Group.trainerId` eğitmen kadrosu (`flexos_trainers`) docId'sini taşır, Firebase
  // auth uid'ini DEĞİL (bkz. actor.trainerId yorumu) — self/assigned filtre bu yüzden
  // actor.uid değil actor.trainerId kullanır. DİKKAT (2026-07-11 düzeltmesi): kadroya
  // kaydı olmayan eğitmen için actor.trainerId `undefined` olur — `firestoreGroupRepo.list`
  // `if (trainerId)` ile falsy'de filtreyi TAMAMEN ATLAR (TÜM tenant'ı döner!), undefined
  // BURADA "filtresiz" değil "asla eşleşmeyen sahte id" anlamına gelmeli — org-scope
  // olmayan aktör için asla boş bırakılmaz, gerçek bir kayıt yoksa hiçbir zaman eşleşmeyecek
  // bir sentinel value kullanılır (org-scope aktör için hâlâ gerçekten filtresiz kalabilir,
  // "TÜM tenant" istenen davranış).
  const trainerId = isOrgScope ? requestedTrainerId : (actor.trainerId ?? "__no_trainer_record__");

  // Aynı (tenant, trainerId) için kısa süre cache + eşzamanlı çağrı coalescing — Ana Sayfa'da
  // groups 3× çağrılıyor, ~7 ekranda tekrar; TTL içinde dönüşler Firestore'a hiç gitmez.
  const cacheKey = `groups:${actor.tenantId}:${trainerId ?? "__all__"}`;
  return cachedRead(cacheKey, GROUPS_CACHE_TTL_MS, async () => {
    const [groups, educations, branches, sections, trainers, offices] = await Promise.all([
      firestoreGroupRepo.list(actor.tenantId, trainerId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreBranchRepo.list(actor.tenantId),
      firestoreSectionRepo.list(actor.tenantId),
      firestoreTrainerRepo.list(actor.tenantId),
      firestoreBranchOfficeRepo.list(actor.tenantId),
    ]);
    // 2026-07-12 ACİL kota fix: önceden `firestoreEnrollmentRepo.list(tenantId)` tenant'taki
    // TÜM enrollment'ları okuyordu (grup filtresi yok) — bu uç ~7 farklı ekranda groups/
    // trainers/educations.changed'de yeniden çekiliyor, her çağrı yüzlerce/binlerce gereksiz
    // okumaya mal oluyordu (Firestore kota olayının kök nedeni). Artık SADECE görüntülenen
    // grupların enrollment'ları okunuyor.
    const enrollments = await firestoreEnrollmentRepo.listByGroupIds(groups.map((g) => g.id), actor.tenantId);

    const eduMap = new Map(educations.map((e) => [e.id, e]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const trainerMap = new Map(trainers.map((t) => [t.id, t.name]));
    const officeMap = new Map(offices.map((o) => [o.id, o.name]));

    // Grup başına öğrenci sayısı (doluluk). `active` + `completed` — roster uç noktasıyla
    // (groups/[id]/roster/route.ts) AYNI kural: bir grup "tamamlandı"ya alınıp öğrenciler
    // mezun/completed olunca SADECE `active` sayarsak liste "0 öğrenci" gösterirdi (roster'da
    // hâlâ görünen mezunlar sayılmazdı) — 2026-07-11'de bulunan gerçek tutarsızlık düzeltildi.
    // `cancelled` (sınıftan çıkarılan) hâlâ sayılmıyor, bu doğru.
    const enrolledByGroup = new Map<string, number>();
    for (const enr of enrollments) {
      if (enr.groupId && (enr.status === "active" || enr.status === "completed")) {
        enrolledByGroup.set(enr.groupId, (enrolledByGroup.get(enr.groupId) ?? 0) + 1);
      }
    }

    return groups.map((g) => {
      const edu = g.educationId ? eduMap.get(g.educationId) : undefined;
      const branchName = edu?.branchId ? branchMap.get(edu.branchId)?.name : g.branch;
      const sec = g.sectionId ? sectionMap.get(g.sectionId) : undefined;
      return {
        id: g.id,
        code: g.code,
        type: g.type,
        status: g.status,
        educationId: g.educationId ?? null,
        educationName: edu?.name ?? "",
        certType: edu?.certType ?? "project", // Sınav Bazlı / Proje Bazlı — Sertifika Notu etiketi/mantığı için
        branch: branchName ?? "",
        sectionId: g.sectionId ?? null,
        sectionName: sec?.name ?? "",
        // Bölümlü eğitimde `Education.totalHours` TÜM bölümlerin toplamı (örn. 177 saat) —
        // grubun kendi kurs saati için ÖNCE bölümün kendi `hours`'una (örn. Grafik-2: 96 saat)
        // bakılmalı, section yoksa (structure="single") education toplamına düşülür.
        sectionHours: sec?.hours ?? null,
        educationTotalHours: edu?.totalHours ?? null,
        branchOfficeId: g.branchOfficeId ?? null,
        branchOffice: g.branchOfficeId ? officeMap.get(g.branchOfficeId) ?? "" : "",
        trainerId: g.trainerId ?? "",
        trainerName: g.trainerId ? trainerMap.get(g.trainerId) ?? "" : "",
        schedule: g.schedule,
        capacity: g.capacity ?? 0,
        enrolled: enrolledByGroup.get(g.id) ?? 0,
      };
    });
  });
}

export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);

  if (!can(actor, "group.read")) {
    return NextResponse.json({ error: "Yetki yok: group.read" }, { status: 403 });
  }

  const requestedTrainerId = req.nextUrl.searchParams.get("trainerId") ?? undefined;
  const items = await fetchGroupsForActor(actor, requestedTrainerId);
  return NextResponse.json({ items });
});
