import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { firestoreRoleDefRepo } from "@/app/lib/server/role-def-repo.firestore";
import { firestoreBranchOfficeRepo } from "@/app/lib/server/catalog-repo.firestore";
import { adminAuth } from "@/app/lib/firebase-admin";
import {
  updateFlexosUser,
  deleteFlexosUser,
  type UpdateFlexosUserInput,
} from "@/app/lib/domain/services/flexos-user-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/flexos/users/[id] — Tek kullanıcı getir */
export const GET = withAuth<Ctx>(async (_req: NextRequest, caller, ctx) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  const actor = await actorFromCaller(caller);
  if (!can(actor, "role.manage")) {
    return NextResponse.json({ error: "Yetki yok: role.manage" }, { status: 403 });
  }

  try {
    const user = await firestoreFlexosUserRepo.getById(id, actor.tenantId);
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    const office = user.officeId ? await firestoreBranchOfficeRepo.getById(user.officeId, actor.tenantId) : null;
    return NextResponse.json({
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      phone: user.phone ?? "",
      gender: user.gender,
      birthDate: user.birthDate ?? "",
      title: user.title ?? "",
      roles: user.roles,
      subes: user.subes,
      officeId: user.officeId ?? null,
      officeName: office?.name ?? "",
      permOverrides: user.permOverrides ?? {},
      status: user.status,
      createdAt: user.createdAt,
    });
  } catch (e) {
    console.error("[flexos/users/:id GET]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** PATCH /api/flexos/users/[id] — Kullanıcı güncelle */
export const PATCH = withAuth<Ctx>(async (req: NextRequest, caller, ctx) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateFlexosUserInput;
  try {
    body = (await req.json()) as UpdateFlexosUserInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const user = await updateFlexosUser((await actorFromCaller(caller)), id, body, firestoreFlexosUserRepo, firestoreRoleDefRepo);
    return NextResponse.json({ id: user.id });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/users/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** DELETE /api/flexos/users/[id] — Kullanıcı sil (Firestore doc + gerçek Firebase hesabı). */
export const DELETE = withAuth<Ctx>(async (_req: NextRequest, caller, ctx) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    const deleted = await deleteFlexosUser((await actorFromCaller(caller)), id, firestoreFlexosUserRepo);
    if (deleted.authUid) {
      await adminAuth.deleteUser(deleted.authUid).catch((e) => {
        console.error("[flexos/users/:id DELETE] Firebase hesabı silinemedi:", e);
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/users/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
