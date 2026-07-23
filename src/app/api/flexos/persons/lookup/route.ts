import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo } from "@/app/lib/server/catalog-repo.firestore";

const STATUS_LABEL: Record<string, string> = {
  active: "Devam Ediyor",
  on_hold: "Beklemede",
  passive: "Pasif",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
};

/**
 * GET /api/flexos/persons/lookup?idNo=xxxxx
 * TC/pasaport no ile kişi arar; varsa aktif satış sayısını VE mevcut eğitim
 * kayıtlarını döndürür. Satış-Yap'ta hem "Ek Kayıt İndirimi" otomatik
 * uygulaması hem de satıcıya "bu kişi zaten kayıtlı" bilgisini göstermek
 * için kullanılır (2026-07-23, kullanıcı isteği).
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
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

    const [allSales, personEnrollments, educations] = await Promise.all([
      firestoreSaleRepo.list(actor.tenantId),
      firestoreEnrollmentRepo.listByPerson(person.id, actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
    ]);
    // Tarih filtresi satış-yap'ta kampanya.startDate ile yapılır — burada ham tarihleri dön
    const saleDates = allSales
      .filter((s) => s.personId === person.id && s.status !== "cancelled")
      .map((s) => s.date ?? s.createdAt?.slice(0, 10) ?? "");

    const educationNameById = new Map(educations.map((e) => [e.id, e.name]));
    const enrollments = personEnrollments
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        educationName: (e.educationId && educationNameById.get(e.educationId)) || "Bilinmeyen eğitim",
        statusLabel: STATUS_LABEL[e.status] ?? e.status,
      }));

    return NextResponse.json({ found: true, personId: person.id, name: `${person.firstName} ${person.lastName}`.trim(), saleDates, enrollments });
  } catch (e) {
    console.error("[persons/lookup] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
