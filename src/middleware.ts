import { NextRequest, NextResponse } from "next/server";

// Edge-safe JWT payload decode (signature verification API routes'ta yapılır)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// flex-token cookie: login sonrası client tarafından set edilmeli.
// Örnek (layout veya auth hook'ta):
//   const token = await user.getIdToken();
//   document.cookie = `flex-token=${token}; path=/; max-age=3600; SameSite=Lax`;
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("flex-token")?.value;

  // Token yoksa: korumalı rotalar login'e yönlendirilir, diğerleri geçer
  if (!token) {
    const isProtected =
      pathname.startsWith("/student") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname === "/league" ||
      pathname.startsWith("/league/");
    if (isProtected) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  const payload = decodeJwtPayload(token);
  if (!payload) return NextResponse.redirect(new URL("/login", request.url));

  const role = typeof payload.role === "string" ? payload.role : null;
  const exp  = typeof payload.exp  === "number" ? payload.exp  : null;

  // Süresi dolmuş token → login'e yönlendir, cookie temizle
  if (exp && Math.floor(Date.now() / 1000) > exp) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("flex-token");
    return res;
  }

  // ─── Role isolation ───────────────────────────────────────────────────────

  // Öğrenci /dashboard veya /admin'e gitmeye çalışıyor → öğrenci portala yönlendir
  if (role === "student" && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    return NextResponse.redirect(new URL("/student", request.url));
  }

  // Eğitmen/admin /student/*'a gitmeye çalışıyor → dashboard'a yönlendir
  if (pathname.startsWith("/student") && role && role !== "student") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // /admin/*: sadece admin role
  if (pathname.startsWith("/admin") && role && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/dashboard/:path*", "/admin/:path*", "/league/:path*", "/league"],
};
