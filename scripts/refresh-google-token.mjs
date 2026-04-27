/**
 * Google Drive OAuth2 Refresh Token yenileme scripti.
 * Kullanım: node scripts/refresh-google-token.mjs
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

// .env.local oku
const envContent = fs.readFileSync(envPath, "utf-8");
const clientId     = envContent.match(/^GOOGLE_CLIENT_ID=(.+)$/m)?.[1]?.trim();
const clientSecret = envContent.match(/^GOOGLE_CLIENT_SECRET=(.+)$/m)?.[1]?.trim();

if (!clientId || !clientSecret) {
  console.error("HATA: GOOGLE_CLIENT_ID veya GOOGLE_CLIENT_SECRET .env.local'de bulunamadı.");
  process.exit(1);
}

const PORT = 4000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/drive.file",
    access_type:   "offline",
    prompt:        "consent",
  });

console.log("\n=== Google Drive OAuth2 Token Yenileme ===\n");
console.log("Tarayıcıda açılıyor...");
console.log("URL:", authUrl, "\n");

// Tarayıcıyı aç (Windows)
try {
  execSync(`start "" "${authUrl}"`);
} catch {
  console.log("Tarayıcı otomatik açılamadı. Yukarıdaki URL'yi manuel olarak açın.");
}

// Geçici HTTP sunucusu — callback'i yakala
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`<h2>Hata: ${error}</h2><p>Pencereyi kapatabilirsiniz.</p>`);
    console.error("OAuth hatası:", error);
    server.close();
    return;
  }

  if (!code) {
    res.end("<h2>Kod alınamadı.</h2>");
    return;
  }

  // Kodu refresh token ile değiştir
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const data = await tokenRes.json();

    if (!data.refresh_token) {
      res.end(`<h2>Refresh token alınamadı.</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
      console.error("Token yanıtı:", data);
      server.close();
      return;
    }

    // .env.local'i güncelle
    const newEnv = envContent.replace(
      /^GOOGLE_REFRESH_TOKEN=.+$/m,
      `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`
    );
    fs.writeFileSync(envPath, newEnv, "utf-8");

    res.end("<h2>Başarılı! Yeni refresh token .env.local'e kaydedildi.</h2><p>Bu pencereyi kapatabilirsiniz.</p>");
    console.log("\nYeni refresh token .env.local'e kaydedildi.");
    console.log("Token:", data.refresh_token.substring(0, 20) + "...");
    server.close();
    process.exit(0);

  } catch (err) {
    res.end(`<h2>Hata</h2><pre>${err.message}</pre>`);
    console.error(err);
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`Sunucu dinliyor: http://localhost:${PORT}`);
  console.log("Google hesabına giriş yapıp izin verdikten sonra otomatik tamamlanacak.\n");
});
