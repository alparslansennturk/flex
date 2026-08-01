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

async function markBuffer(size, background, contentRatio) {
  const contentSize = Math.round(size * contentRatio);
  const mark = await sharp(tmpSvgPath, { density: 72 * (contentSize / 46.91) })
    .resize(contentSize, contentSize)
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

const WHITE = "#FFFFFF";

// 2026-08-02: kullanıcı bir PNG'yi elle .icns'e çevirip macOS'ta kurulu PWA
// ikonu olarak denedi ve bu doğru göründü — o dosyadan ölçülen gerçek içerik
// oranı %79.7 (512px tuvalde 408px mark) idi, önceki %90/%85'ten belirgin
// daha fazla boşluklu. macOS Dock zaten squircle+gölge uyguluyor; kenara
// yakın içerik "taşmış/kırpılmış" görünüyordu. İkisini de %80'e çektik.
//
// "any": OS kendi köşe yuvarlatmasını (squircle/rounded-square) UYGULAR ama tuvali
// KIRPMAZ — o yüzden zemin opak olmalı (şeffaf olursa masaüstünde/dock'ta logo
// "havada" görünür, kart gibi durmaz — YouTube/Slack gibi gerçek app ikonlarında
// zemin her zaman dolu).
const ANY_CONTENT_RATIO = 0.8;

// "maskable": spec GEREĞİ zemin opak OLMAK ZORUNDA — OS tuvalin tamamını alıp kendi
// şekline (daire/squircle) göre KIRPAR; zemin şeffaf bırakılırsa kırpılan şekil ile
// içerik arasında kalan alan BOŞLUK/DELİK olarak görünür. Spec'in önerdiği "safe
// zone" zaten tuvalin ortasındaki %80 çaplı daire — %80 hem spec'e hem kullanıcının
// doğrulanmış icns'ine uyuyor (önceki %85'te köşeler agresif maskelerde kırpılıyordu).
const MASKABLE_CONTENT_RATIO = 0.8;

async function makeAny(size, filename) {
  await writeFileSync(resolve(OUT_DIR, filename), await markBuffer(size, WHITE, ANY_CONTENT_RATIO));
  console.log(`✓ ${filename} (${size}x${size}, beyaz zemin, %${ANY_CONTENT_RATIO * 100} içerik)`);
}

async function makeMaskable(size, filename) {
  await writeFileSync(resolve(OUT_DIR, filename), await markBuffer(size, WHITE, MASKABLE_CONTENT_RATIO));
  console.log(`✓ ${filename} (${size}x${size}, maskable, beyaz zemin, %${MASKABLE_CONTENT_RATIO * 100} içerik)`);
}

await makeAny(192, "flexos-192.png");
await makeAny(512, "flexos-512.png");
await makeMaskable(192, "flexos-maskable-192.png");
await makeMaskable(512, "flexos-maskable-512.png");
// Safari "Dock'a Ekle" — apple-touch-icon şeffaflık desteklemez, zaten beyaz zeminliydi.
await writeFileSync(resolve(OUT_DIR, "flexos-apple-touch-icon.png"), await markBuffer(180, WHITE, ANY_CONTENT_RATIO));
console.log("✓ flexos-apple-touch-icon.png (180x180, beyaz zemin)");

// Tarayıcı sekmesi favicon'u — 16/32/48px, tek .ico dosyasında (Next.js App Router
// `src/app/favicon.ico` özel dosya konvansiyonu, otomatik algılanır).
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const faviconSizes = await Promise.all(
  [16, 32, 48].map((s) => markBuffer(s, TRANSPARENT, ANY_CONTENT_RATIO)),
);
const icoBuffer = await toIco(faviconSizes);
writeFileSync(resolve("src/app/favicon.ico"), icoBuffer);
console.log("✓ src/app/favicon.ico (16/32/48px)");

rmSync(tmpSvgPath);
