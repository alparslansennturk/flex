import type { NextConfig } from "next";

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js hydration + inline styles için unsafe-inline gerekli
  "script-src 'self' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  // Google Drive görselleri + blob/data (PDF üretimi)
  "img-src 'self' data: blob: https://*.googleusercontent.com https://drive.google.com https://*.google.com https://*.gstatic.com",
  // Fontlar next/font ile local serve ediliyor
  "font-src 'self'",
  // Firebase, Firestore, Google APIs, Vercel Toolbar
  [
    "connect-src 'self'",
    "https://*.googleapis.com",
    "https://*.firebase.com",
    "https://*.firebaseapp.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://*.vercel.com",
    "wss://*.vercel.com",
    "https://vercel.live",
    "wss://vercel.live",
  ].join(" "),
  // Google Drive iframe önizleme
  "frame-src 'self' https://drive.google.com https://docs.google.com https://accounts.google.com",
  // @react-pdf/renderer web worker
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
  },
  {
    // HTTPS zorunlu — 1 yıl, subdomainler dahil
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    // Bu sitenin başka sitelerin iframe'ine girmesini engelle
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Tarayıcı dosya tipini tahmin etmesin
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Başka siteye giderken URL sızdırma
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Kamera/mikrofon/konum izni yok
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Firebase Realtime Listeners (onSnapshot) StrictMode ile uyumsuz:
  // StrictMode'un effect'leri çift çalıştırması sunucuya add/remove target
  // sinyallerini hızlı sırayla gönderir. Sunucudan in-flight gelen yanıt
  // WatchChangeAggregator'da ca9 assertion'a yol açar.
  // Firebase ekibinin önerisi: reactStrictMode: false (Issue #7638)
  reactStrictMode: false,
  transpilePackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
