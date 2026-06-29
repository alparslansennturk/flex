import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";

/**
 * GET /api/flexos/persons/lookup?idNo=xxxxx
 * TC/pasaport no ile kişi arar; varsa aktif satış sayısını döndürür.
 * Satış-Yap'ta "Ek Kayıt İndirimi" otomatik uygulaması için kullanılır.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  if (!can(actor, "person.read")) {
    return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
  }

  const idNo = req.nextUrl.searchParams.get("idNo")?.trim();
  if (!idNo || idNo.length < 10) {
    return NextResponse.json({ found: false });
  }

  try {
    const person = await firestorePersonRepo.findByIdNo(idNo, actor.tenantId);
    if (!person) return NextResponse.json({ found: false });

    const allSales = await firestoreSaleRepo.list(actor.tenantId);
    // Tarih filtresi satış-yap'ta kampanya.startDate ile yapılır — burada ham tarihleri dön
    const saleDates = allSales
      .filter((s) => s.personId === person.id && s.status !== "cancelled")
      .map((s) => s.date ?? s.createdAt?.slice(0, 10) ?? "");

    return NextResponse.json({ found: true, personId: person.id, saleDates });
  } catch (e) {
    console.error("[persons/lookup] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
