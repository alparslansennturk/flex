/**
 * generate-pwa-icons.mjs — FlexOS'un site geneli PWA manifest'i için ikonları
 * `public/assets/flex-logo.svg`'deki (170.5x46.91 viewBox) sol kare "mark" kısmından
 * (4 renkli yuvarlatılmış kare, "flex" yazısı OLMADAN) üretir — bu, sidebar/login'de
 * de kullanılan gerçek marka işareti. (`Mobile-Desktop-Icon.svg` bu iş için YANLIŞ
 * kaynaktı — o Connect'in konuşma balonu ikonu, `connect-icon-*.png` ile birebir aynı.)
 *
 * Tek seferlik script — `node scripts/generate-pwa-icons.mjs`.
 */
import sharp from "sharp";
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

async function makeAny(size, filename) {
  await sharp(tmpSvgPath, { density: 72 * (size / 46.91) })
    .resize(size, size)
    .png()
    .toFile(resolve(OUT_DIR, filename));
  console.log(`✓ ${filename} (${size}x${size}, transparent)`);
}

// Maskable: OS ikon maskesi (daire/yuvarlak kare) kenarları kesebileceği için içerik
// ortada ~%80'lik güvenli alanda kalmalı — beyaz zemine biraz küçültülmüş mark
// bindiriliyor.
async function makeMaskable(size, filename) {
  const contentSize = Math.round(size * 0.72);
  const mark = await sharp(tmpSvgPath, { density: 72 * (contentSize / 46.91) })
    .resize(contentSize, contentSize)
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#FFFFFF" },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(resolve(OUT_DIR, filename));
  console.log(`✓ ${filename} (${size}x${size}, maskable, beyaz zemin)`);
}

await makeAny(192, "flexos-192.png");
await makeAny(512, "flexos-512.png");
await makeMaskable(192, "flexos-maskable-192.png");
await makeMaskable(512, "flexos-maskable-512.png");
// Safari "Dock'a Ekle" — apple-touch-icon şeffaflık desteklemez, beyaz zemin şart.
await makeMaskable(180, "flexos-apple-touch-icon.png");

rmSync(tmpSvgPath);
