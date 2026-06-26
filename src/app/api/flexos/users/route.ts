import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import {
  createFlexosUser,
  type CreateFlexosUserInput,
} from "@/app/lib/domain/services/flexos-user-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** GET /api/flexos/users — Kullanıcı listesi */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  if (!can(actor, "role.manage")) {
    return NextResponse.json({ error: "Yetki yok: role.manage" }, { status: 403 });
  }

  try {
    const users = await firestoreFlexosUserRepo.list(actor.tenantId);
    const items = users.map((u) => ({
      id: u.id,
      name: u.name,
      surname: u.surname,
      email: u.email,
      phone: u.phone ?? "",
      gender: u.gender,
      birthDate: u.birthDate ?? null,
      title: u.title ?? "",
      roles: u.roles,
      subes: u.subes,
      permOverrides: u.permOverrides ?? {},
      status: u.status,
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[flexos/users GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** POST /api/flexos/users — Yeni kullanıcı oluştur */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateFlexosUserInput;
  try {
    body = (await req.json()) as CreateFlexosUserInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = actorFromCaller(caller);

  try {
    const user = await createFlexosUser(actor, body, firestoreFlexosUserRepo);
    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/users POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
