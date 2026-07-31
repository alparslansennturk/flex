import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEducationRepo, firestoreSectionRepo, firestoreTrackRepo } from "@/app/lib/server/catalog-repo.firestore";
import { syncEducationContent, type SyncContentSectionInput } from "@/app/lib/domain/services/catalog-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * PUT /api/flexos/educations/[id]/content
 * Eğitimin bölüm/track ağacını tamamen değiştirir (delete-all + recreate).
 * Body: { sections: SyncContentSectionInput[] }
 */
export const PUT = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: { sections: SyncContentSectionInput[] };
  try { body = (await req.json()) as { sections: SyncContentSectionInput[] }; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  if (!Array.isArray(body.sections)) {
    return NextResponse.json({ error: "sections dizisi zorunludur." }, { status: 400 });
  }

  try {
    const result = await syncEducationContent(
      await actorFromCaller(caller),
      id,
      body.sections,
      { sections: firestoreSectionRepo, tracks: firestoreTrackRepo, educations: firestoreEducationRepo },
    );
    return NextResponse.json({
      sections: result.sections.map((s) => ({ id: s.id, name: s.name, order: s.order })),
      tracks: result.tracks.map((t) => ({ id: t.id, name: t.name, sectionId: t.sectionId, order: t.order })),
    });
  } catch (e) {
    return apiError(e, "flexos/educations/[id]/content");
  }
});
