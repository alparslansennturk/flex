import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Realtime Listeners (onSnapshot) StrictMode ile uyumsuz:
  // StrictMode'un effect'leri çift çalıştırması sunucuya add/remove target
  // sinyallerini hızlı sırayla gönderir. Sunucudan in-flight gelen yanıt
  // WatchChangeAggregator'da ca9 assertion'a yol açar.
  // Firebase ekibinin önerisi: reactStrictMode: false (Issue #7638)
  reactStrictMode: false,
  transpilePackages: ["@react-pdf/renderer"],

};

export default nextConfig;
