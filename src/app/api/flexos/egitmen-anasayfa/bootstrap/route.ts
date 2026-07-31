import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import type { Actor } from "@/app/lib/domain/access/types";
import { can } from "@/app/lib/domain/access/can";
import { fetchGroupsForActor } from "@/app/api/flexos/groups/route";
import { fetchTemplatesForActor } from "@/app/api/flexos/assignment-templates/route";
import { fetchAssignmentsForActor } from "@/app/api/flexos/assignments/route";
import { fetchActivityLogForActor } from "@/app/api/flexos/egitmen-anasayfa/activity-log/route";
import { buildMeInfo } from "@/app/api/flexos/me/route";
import { firestoreHolidayRepo } from "@/app/lib/server/holiday-repo.firestore";
import { getSettings } from "@/app/lib/domain/services/settings-service";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { listSubmissionsForGroup } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError } from "@/app/lib/domain/errors";

/**
 * "Ödev Teslimi" hızlı kart(2026-07-31 kullanıcı isteği) — hangi grup(lar)ın YENİ
 * (henüz incelenmemiş, `status:"submitted"`) teslimi varsa, kartın tıklaması
 * doğrudan o grubun/ödevin teslim inceleme ekranına (`/flexos/odevler/teslim/[groupId]/
 * [assignmentId]`) gitsin diye. `groups` ZATEN aynı bootstrap'te ayrı fetch ediliyor
 * (enriched/cache'li) — burada onu TEKRAR beklemek yerine aynı promise'e zincirleniyor,
 * böylece diğer dallarla (templates/holidays/...) paralelliği bozmuyor (sadece submissions
 * kısmı groups çözüldükten sonra başlıyor, en kötü durumda toplam süre groups+submissions
 * kadar — ki groups zaten cache'li/coalesced).
 */
interface PendingSubmissionGroup { groupId: string; groupCode: string; assignmentId: string; submittedAt: string }
async function fetchPendingSubmissionSummary(
  actor: Actor,
  groups: { id: string; code: string; status: string }[],
  assignments: { id: string }[],
): Promise<PendingSubmissionGroup[]> {
  const activeGroups = groups.filter((g) => g.status === "active");
  // Bir teslim, sahibi ödev SİLİNMİŞ/arşivden düşmüş bir dokümana işaret edebilir
  // (2026-07-31 gerçek bulgu: test verisinde tam bu oldu, "Ödev bulunamadı" hatasına
  // yol açtı) — kartın tıklaması kırık bir sayfaya gitmesin diye SADECE hâlâ var olan
  // ödevlere ait teslimler dikkate alınıyor.
  const validAssignmentIds = new Set(assignments.map((a) => a.id));
  const perGroup = await Promise.all(
    activeGroups.map(async (g): Promise<PendingSubmissionGroup | null> => {
      const items = await listSubmissionsForGroup(actor, g.id, { submissions: firestoreSubmissionRepo });
      const pending = items.filter((s) => s.status === "submitted" && validAssignmentIds.has(s.assignmentId));
      if (pending.length === 0) return null;
      const latest = pending.reduce((a, b) => (a.lastSubmittedAt > b.lastSubmittedAt ? a : b));
      return { groupId: g.id, groupCode: g.code, assignmentId: latest.assignmentId, submittedAt: latest.lastSubmittedAt };
    }),
  );
  return perGroup
    .filter((x): x is PendingSubmissionGroup => x !== null)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/**
 * GET /api/flexos/egitmen-anasayfa/bootstrap — Eğitmen Ana Sayfa'nın ihtiyaç duyduğu
 * groups + assignment-templates + holidays + assignments + me + settings'i TEK istekte
 * döner. 2026-07-14 kota/hız turu: bu 6 uç aynı sayfada 6 ayrı HTTP isteği + 6 ayrı
 * Vercel fonksiyon çağrısı olarak gidiyordu (Frankfurt bölge taşınmasıyla süre zaten
 * ~500ms'ye indi, ama istek sayısını da azaltmak kalıcı/bulletproof çözüm için istendi).
 * Her alt fonksiyon (`fetchGroupsForActor` vb.) ilgili route dosyasından AYNEN import
 * edilip çağrılıyor — kod tekrarı yok, aynı cache/coalescing (groups/templates) korunuyor.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);

  if (!can(actor, "group.read")) {
    return NextResponse.json({ error: "Yetki yok: group.read" }, { status: 403 });
  }
  if (!can(actor, "assignment.read")) {
    return NextResponse.json({ error: "Yetki yok: assignment.read" }, { status: 403 });
  }

  const requestedTrainerId = req.nextUrl.searchParams.get("trainerId") ?? undefined;

  try {
    const groupsPromise = fetchGroupsForActor(actor, requestedTrainerId);
    const assignmentsPromise = fetchAssignmentsForActor(actor);
    // `submission.read` her aktörde garanti değil (capability modeli) — bu dal başarısız
    // olursa TÜM bootstrap'i düşürmesin diye ayrı yakalanıp boş diziye düşülüyor, kartın
    // eski statik "İncele" davranışına geri dönmesi yeterli (bkz. kart tarafındaki fallback).
    const pendingSubmissionsPromise = Promise.all([groupsPromise, assignmentsPromise])
      .then(([groups, assignments]) => fetchPendingSubmissionSummary(actor, groups, assignments))
      .catch(() => [] as PendingSubmissionGroup[]);

    const [groups, templates, holidays, assignments, me, settings, activityLog, pendingSubmissions] = await Promise.all([
      groupsPromise,
      fetchTemplatesForActor(actor),
      firestoreHolidayRepo.list(actor.tenantId),
      assignmentsPromise,
      buildMeInfo(actor),
      getSettings(actor, firestoreSettingsRepo),
      fetchActivityLogForActor(actor, requestedTrainerId),
      pendingSubmissionsPromise,
    ]);
    return NextResponse.json(
      { groups, templates, holidays, assignments, me, settings, activityLog, pendingSubmissions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    console.error("[flexos/egitmen-anasayfa/bootstrap GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
