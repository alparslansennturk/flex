import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCertificateSettingsRepo } from "@/app/lib/server/certificate-settings-repo.firestore";
import {
  getCertificateSettings,
  updateCertificateSettings,
  type UpdateCertificateSettingsInput,
} from "@/app/lib/domain/services/certificate-settings-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/certificate-settings — sertifika hesaplama ayarını okur (herkes okuyabilir). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const settings = await getCertificateSettings((await actorFromCaller(caller)), firestoreCertificateSettingsRepo);
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[flexos/certificate-settings GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** PATCH /api/flexos/certificate-settings — ayarı günceller (gated `certificate.settings.write`). */
export const PATCH = withAuth(async (req: NextRequest, caller) => {
  let body: UpdateCertificateSettingsInput;
  try {
    body = (await req.json()) as UpdateCertificateSettingsInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    const settings = await updateCertificateSettings(actor, body, firestoreCertificateSettingsRepo);
    broadcast(actor.tenantId, { type: "settings.changed" });
    return NextResponse.json(settings);
  } catch (e) {
    return apiError(e, "flexos/certificate-settings");
  }
});
