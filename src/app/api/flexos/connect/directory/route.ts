import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";

/**
 * GET /api/flexos/connect/directory — personel listesi (kanal/grup/dm kurarken
 * üye seçici için). Öğrenci giriş hesapları (`roles:["ogrenci"]` — `flexos_users`
 * personel VE öğrenci girişini AYNI yerde tutar, bkz. `connect-principal.ts`
 * yorumu) HARİÇ TUTULUR — bu liste SADECE staff realm üyeliği için.
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const users = await firestoreFlexosUserRepo.list(principal.tenantId);
  const staff = users.filter((u) => u.authUid && u.status === "aktif" && u.roles.some((r) => r !== "ogrenci"));

  return NextResponse.json({
    items: staff.map((u) => ({ uid: u.authUid, name: `${u.name} ${u.surname}`.trim(), title: u.title })),
  });
});
