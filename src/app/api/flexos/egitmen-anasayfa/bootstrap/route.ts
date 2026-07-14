import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { fetchGroupsForActor } from "@/app/api/flexos/groups/route";
import { fetchTemplatesForActor } from "@/app/api/flexos/assignment-templates/route";
import { fetchAssignmentsForActor } from "@/app/api/flexos/assignments/route";
import { buildMeInfo } from "@/app/api/flexos/me/route";
import { firestoreHolidayRepo } from "@/app/lib/server/holiday-repo.firestore";
import { getSettings } from "@/app/lib/domain/services/settings-service";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";
import { ForbiddenError } from "@/app/lib/domain/errors";

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
    const [groups, templates, holidays, assignments, me, settings] = await Promise.all([
      fetchGroupsForActor(actor, requestedTrainerId),
      fetchTemplatesForActor(actor),
      firestoreHolidayRepo.list(actor.tenantId),
      fetchAssignmentsForActor(actor),
      buildMeInfo(actor),
      getSettings(actor, firestoreSettingsRepo),
    ]);
    return NextResponse.json(
      { groups, templates, holidays, assignments, me, settings },
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
