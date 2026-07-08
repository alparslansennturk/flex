import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSeansRepo } from "@/app/lib/server/seans-repo.firestore";
import type { Seans } from "@/app/lib/domain/eduos/seans";

/** POST /api/flexos/seanslar — seans oluştur. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  let body: { days: number[]; startTime: string; endTime: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  if (!Array.isArray(body.days) || body.days.length === 0) {
    return NextResponse.json({ error: "En az bir gün seçilmeli." }, { status: 400 });
  }
  if (!body.startTime || !body.endTime || body.startTime >= body.endTime) {
    return NextResponse.json({ error: "Geçerli saat aralığı girin." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const seans: Seans = {
    id: firestoreSeansRepo.nextId(),
    tenantId: actor.tenantId,
    days: body.days,
    startTime: body.startTime,
    endTime: body.endTime,
    createdAt: now,
    createdBy: actor.uid,
  };
  await firestoreSeansRepo.save(seans);
  return NextResponse.json({ id: seans.id }, { status: 201 });
});

/** GET /api/flexos/seanslar — seans listesi. */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const items = await firestoreSeansRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});

/** DELETE /api/flexos/seanslar?id=xxx — seans sil. */
export const DELETE = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id parametresi gerekli." }, { status: 400 });
  const ok = await firestoreSeansRepo.delete(id, actor.tenantId);
  if (!ok) return NextResponse.json({ error: "Seans bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true });
});
