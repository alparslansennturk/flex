import { NextRequest, NextResponse } from "next/server";

/**
 * 2026-07-13 CANLIYA ALMA: eski sistem (dashboard/student/admin/league/attend)
 * fiziksel olarak SİLİNMEDİ (kullanıcı kararı: 1 ay yedek tutulup sonra silinecek)
 * ama artık hiçbir gerçek trafiğe açık değil — hepsi köke (`/`) yönlendirilir.
 * `/` (`src/app/page.tsx`) auth durumuna göre ya `/flexos/giris`'e ya da
 * `resolveFlexosLanding` ile doğru FlexOS sayfasına gönderir (rol bazlı: eğitmen/
 * eğitim-op/satış/öğrenci — hepsi zaten FlexOS'a taşınmış durumda).
 * Önceki JWT-imza-doğrulama + rol-izolasyon mantığı bu yüzden gereksiz kaldı,
 * kaldırıldı (basit blanket-redirect yeterli).
 */
const DEAD_OLD_ROUTE_PREFIXES = ["/dashboard", "/student", "/admin", "/league", "/attend"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDeadRoute = DEAD_OLD_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isDeadRoute) return NextResponse.redirect(new URL("/", request.url));
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
