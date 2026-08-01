/**
 * generate-pwa-icons.mjs — FlexOS'un site geneli PWA manifest'i VE tarayıcı sekmesi
 * favicon'u için ikonları `public/assets/flex-logo.svg`'deki (170.5x46.91 viewBox)
 * sol kare "mark" kısmından (4 renkli yuvarlatılmış kare, "flex" yazısı OLMADAN)
 * üretir — bu, sidebar/login'de de kullanılan gerçek marka işareti.
 * (`Mobile-Desktop-Icon.svg` bu iş için YANLIŞ kaynaktı — o Connect'in konuşma
 * balonu ikonu, `connect-icon-*.png` ile birebir aynı.)
 *
 * 2026-08-02 kullanıcı bulgusu: `src/app/favicon.ico` hiç değiştirilmemişti,
 * hâlâ Next.js/Vercel'in varsayılan şablon ikonuydu (siyah daire + beyaz üçgen) —
 * bu script artık ONU da (aynı kaynaktan) üretiyor.
 *
 * Tek seferlik script — `node scripts/generate-pwa-icons.mjs`.
 */
import sharp from "sharp";
import toIco from "to-ico";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";

const OUT_DIR = resolve("public/icons");
mkdirSync(OUT_DIR, { recursive: true });

// Kaynak SVG'nin viewBox'ını sadece kare mark'ı (170.5x46.91'in ilk 46.91'i) kapsayacak
// şekilde daraltıp geçici bir dosyaya yazıyoruz — vektör tabanlı kırpma, raster kırpmadan
// daha net.
const original = readFileSync(resolve("public/assets/flex-logo.svg"), "utf8");
const cropped = original.replace(
  'viewBox="0 0 170.5 46.91"',
  'viewBox="0 0 46.91 46.91"',
);
const tmpSvgPath = resolve(OUT_DIR, "_tmp-mark.svg");
writeFileSync(tmpSvgPath, cropped);

// Mark, 2026-08-02 kullanıcı isteği öncesi tuvali kenara kadar dolduruyordu
// ("çok büyük duruyor") — artık %75 içerik + boşluk, ortalanmış.
const ICON_CONTENT_RATIO = 0.75;

async function markBuffer(size, background) {
  const contentSize = Math.round(size * ICON_CONTENT_RATIO);
  const mark = await sharp(tmpSvgPath, { density: 72 * (contentSize / 46.91) })
    .resize(contentSize, contentSize)
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// 2026-08-02 kullanıcı bulgusu: "any" ikonlar şeffaf zeminliydi — macOS/Chrome'un
// PWA .app paketi oluştururken şeffaf kenarları otomatik kırpıp içeriği yeniden
// tuvale sığdırdığı (böylece bizim eklediğimiz %75 boşluğu "yediği") görülüyor.
// Opak (beyaz) zemin kırpılamaz, boşluk garanti kalır — favicon.ico BUNDAN
// ETKİLENMİYOR (ayrı mekanizma), o hâlâ şeffaf.
async function makeAny(size, filename) {
  await writeFileSync(resolve(OUT_DIR, filename), await markBuffer(size, "#FFFFFF"));
  console.log(`✓ ${filename} (${size}x${size}, beyaz zemin, %${ICON_CONTENT_RATIO * 100} içerik)`);
}

// Maskable: OS ikon maskesi (daire/yuvarlak kare) kenarları kesebileceği için içerik
// ortada ~%75'lik güvenli alanda kalmalı — beyaz zemine biraz küçültülmüş mark
// bindiriliyor.
async function makeMaskable(size, filename) {
  await writeFileSync(resolve(OUT_DIR, filename), await markBuffer(size, "#FFFFFF"));
  console.log(`✓ ${filename} (${size}x${size}, maskable, beyaz zemin)`);
}

await makeAny(192, "flexos-192.png");
await makeAny(512, "flexos-512.png");
await makeMaskable(192, "flexos-maskable-192.png");
await makeMaskable(512, "flexos-maskable-512.png");
// Safari "Dock'a Ekle" — apple-touch-icon şeffaflık desteklemez, beyaz zemin şart.
await makeMaskable(180, "flexos-apple-touch-icon.png");

// Tarayıcı sekmesi favicon'u — 16/32/48px, tek .ico dosyasında (Next.js App Router
// `src/app/favicon.ico` özel dosya konvansiyonu, otomatik algılanır).
const faviconSizes = await Promise.all([16, 32, 48].map((s) => markBuffer(s, TRANSPARENT)));
const icoBuffer = await toIco(faviconSizes);
writeFileSync(resolve("src/app/favicon.ico"), icoBuffer);
console.log("✓ src/app/favicon.ico (16/32/48px)");

rmSync(tmpSvgPath);
