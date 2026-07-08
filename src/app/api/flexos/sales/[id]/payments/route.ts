import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestorePaymentRepo } from "@/app/lib/server/payment-repo.firestore";
import { firestoreSaleRepo } from "@/app/lib/server/sale-repo.firestore";
import { derivePaymentStatus, derivePaymentRollup } from "@/app/lib/domain/services/payment-service";

/**
 * GET /api/flexos/sales/[id]/payments — satışa ait tahsilat/taksit listesi.
 * Ödeme durumları (planned/upcoming/overdue/paid) okuma anında türetilir.
 */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id: saleId } = await ctx.params;
  const actor = await actorFromCaller(caller);

  if (!can(actor, "payment.read")) {
    return NextResponse.json({ error: "Yetki yok: payment.read" }, { status: 403 });
  }

  try {
    const sale = await firestoreSaleRepo.getById(saleId, actor.tenantId);
    if (!sale) {
      return NextResponse.json({ error: "Satış bulunamadı." }, { status: 404 });
    }

    const payments = await firestorePaymentRepo.listBySale(saleId, actor.tenantId);
    const today = new Date().toISOString().slice(0, 10);

    const totalExpected = (sale.soldPrice ?? 0) + (sale.financingFee ?? 0);
    const rollup = derivePaymentRollup(payments, totalExpected, today);

    const items = payments
      .sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0) || (a.paidAt ?? "").localeCompare(b.paidAt ?? ""))
      .map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount,
        installmentNo: p.installmentNo ?? null,
        installmentTotal: p.installmentTotal ?? null,
        dueDate: p.dueDate ?? null,
        paidAt: p.paidAt ?? null,
        status: derivePaymentStatus(p, today),
      }));

    return NextResponse.json({
      saleId,
      soldPrice: sale.soldPrice ?? 0,
      financingFee: sale.financingFee ?? 0,
      totalExpected,
      rollup,
      items,
    });
  } catch (e) {
    console.error("[flexos/sales/payments GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
