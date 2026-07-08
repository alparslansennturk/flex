import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import type { Guardian } from "@/app/lib/domain/eduos/sale";

/**
 * PATCH /api/flexos/sales/[id] — Satış üzerindeki sözleşme alanlarını güncelle.
 *
 * Şimdilik yalnız VELİ (18 altı sözleşme tarafı). Veli, Person değil Sale'e bağlıdır
 * ([[project-minor-guardian-model]]); öğrenci detay drawer'ından düzenlenir.
 * Gating: `person.pii.write` (veli TC'si PII niteliğinde; satış/op/admin var, eğitmen YOK).
 *
 * NOT: satış İPTALİ buradan DEĞİL — o Satış Listesi'nde ayrı bir akış (soft cascade).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await actorFromCaller(caller);

  if (!can(actor, "person.pii.write")) {
    return NextResponse.json({ error: "Yetki yok: person.pii.write" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const sale = await firestoreSaleRepo.getById(id, actor.tenantId);
    if (!sale) {
      return NextResponse.json({ error: "Satış bulunamadı." }, { status: 404 });
    }

    let changed = false;

    if (body.guardian && typeof body.guardian === "object") {
      const g = body.guardian as Partial<Guardian>;
      const name = typeof g.name === "string" ? g.name.trim() : "";
      if (name) {
        const guardian: Guardian = { name };
        if (typeof g.idNo === "string" && g.idNo.trim()) guardian.idNo = g.idNo.trim();
        sale.guardian = guardian;
        changed = true;
      } else {
        // boş ad → veli kaydını kaldır
        delete sale.guardian;
        changed = true;
      }
    }

    if (!changed) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    sale.updatedAt = new Date().toISOString();
    sale.updatedBy = actor.uid;
    await firestoreSaleRepo.save(sale); // set = tam yazım (merge edilmiş obje)

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[flexos/sales/[id] PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
