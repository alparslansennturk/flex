import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";
import { getSettings, updateSettings, type UpdateSettingsInput } from "@/app/lib/domain/services/settings-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/settings — sistem anahtarlarını okur (standaloneMode dahil). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  try {
    const settings = await getSettings(actor, firestoreSettingsRepo);
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[flexos/settings GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** PATCH /api/flexos/settings — `standaloneMode` switch'ini değiştirir (gated `role.manage`). */
export const PATCH = withAuth(async (req: NextRequest, caller) => {
  let body: UpdateSettingsInput;
  try {
    body = (await req.json()) as UpdateSettingsInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const settings = await updateSettings(actor, body, firestoreSettingsRepo);
    return NextResponse.json(settings);
  } catch (e) {
    return apiError(e, "flexos/settings");
  }
});
