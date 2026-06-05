import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, compactVerify } from "jose";

// Firebase ID token public key endpoint (RS256, Edge-safe)
// createRemoteJWKSet key'leri bellek içinde cache'ler — soğuk başlatma sonrası
// ilk request ~100ms extra; warm instance'larda ihmal edilebilir.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

/**
 * Firebase ID token imzasını RS256 ile doğrular.
 * exp kontrolü YAPILMAZ — Firebase SDK token'ı arka planda yeniler,
 * middleware müdahale ederse yenileme penceresi kaçar.
 * Gerçek exp zorunluluğu API route'larda verifyIdToken() ile sağlanır.
 */
async function verifyFirebaseToken(
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const { payload: rawPayload } = await compactVerify(token, FIREBASE_JWKS);
    return JSON.parse(new TextDecoder().decode(rawPayload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// flex-token cookie: login sonrası client tarafından set edilmeli.
// Örnek (layout veya auth hook'ta):
//   const token = await user.getIdToken();
//   document.cookie = `flex-token=${token}; path=/; max-age=3600; SameSite=Lax`;
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("flex-token")?.value;

  // Token yoksa: korumalı rotalar login'e yönlendirilir, diğerleri geçer
  if (!token) {
    const isProtected =
      pathname.startsWith("/student") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname === "/league" ||
      pathname.startsWith("/league/") ||
      pathname === "/attend";
    if (isProtected) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  // İmza doğrulaması — sahte JWT bu noktada reddedilir
  const payload = await verifyFirebaseToken(token);
  if (!payload) return NextResponse.redirect(new URL("/login", request.url));

  const role = typeof payload.role === "string" ? payload.role : null;

  // ─── Role isolation ───────────────────────────────────────────────────────

  // Öğrenci /dashboard, /admin veya /attend'a gitmeye çalışıyor → öğrenci portala yönlendir
  if (
    role === "student" &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname === "/attend")
  ) {
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
  matcher: [
    "/student/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/league/:path*",
    "/league",
    "/attend",
  ],
};
