import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCertificateSettingsRepo } from "@/app/lib/server/certificate-settings-repo.firestore";
import {
  getCertificateSettings,
  updateCertificateSettings,
  type UpdateCertificateSettingsInput,
} from "@/app/lib/domain/services/certificate-settings-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** GET /api/flexos/certificate-settings — sertifika hesaplama ayarını okur (herkes okuyabilir). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const settings = await getCertificateSettings(actorFromCaller(caller), firestoreCertificateSettingsRepo);
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
    const settings = await updateCertificateSettings(actorFromCaller(caller), body, firestoreCertificateSettingsRepo);
    return NextResponse.json(settings);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/certificate-settings PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
