/**
 * withAuth — Next.js App Router route handler auth wrapper
 *
 * Kullanım:
 *   export const POST = withAuth(handler, { roles: ["admin", "instructor"] });
 *   export const POST = withAuth(handler, { allowAdminSecret: true });
 *
 * Handler signature:
 *   async function handler(req, caller, ctx) { ... }
 *   caller: { uid, email, role, isAdmin }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";

export interface Caller {
  uid:     string;
  email:   string;
  role:    string;
  isAdmin: boolean;
}

interface WithAuthOptions {
  /** Gerekli roller — caller.role bunlardan biri olmalı (isAdmin her zaman geçer) */
  roles?: string[];
  /** x-admin-secret header ile sistem erişimine izin ver (cron, migration vb.) */
  allowAdminSecret?: boolean;
}

const SUPER_ADMIN_EMAIL = "flexos.platform@gmail.com";

export function withAuth<C = { params: Promise<Record<string, string>> }>(
  handler: (req: NextRequest, caller: Caller, ctx: C) => Promise<NextResponse>,
  options: WithAuthOptions = {}
) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    // ── x-admin-secret bypass (cron / migration / server-to-server) ──────────
    if (options.allowAdminSecret) {
      const secret = req.headers.get("x-admin-secret");
      if (secret) {
        if (secret !== process.env.ADMIN_SECRET) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const systemCaller: Caller = { uid: "system", email: "", role: "admin", isAdmin: true };
        return handler(req, systemCaller, ctx);
      }
    }

    // ── Bearer token ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token gerekli." }, { status: 401 });
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "Geçersiz veya süresi dolmuş token." }, { status: 401 });
    }

    const role    = (decoded.role as string) ?? "";
    const isAdmin = role === "admin" || decoded.email === SUPER_ADMIN_EMAIL;

    // ── Rol kontrolü ──────────────────────────────────────────────────────────
    if (options.roles && options.roles.length > 0) {
      const allowed = isAdmin || options.roles.includes(role);
      if (!allowed) {
        return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
      }
    }

    const caller: Caller = { uid: decoded.uid, email: decoded.email ?? "", role, isAdmin };
    return handler(req, caller, ctx);
  };
}
