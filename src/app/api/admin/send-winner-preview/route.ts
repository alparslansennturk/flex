import { NextResponse } from "next/server";
import { sendMail } from "@/app/lib/email";

// Görsel 1200×1200, email genişliği 560px → ölçek: 560/1200 = 0.467
// Glass card orijinal konumu: left:510 top:280 w:585 h:595
// 560px'teki karşılıkları (+32px sağ, +12px aşağı kaydırma):
//   left  ≈ 238+32 = 270px
//   top   ≈ 131+12 = 143px
//   width ≈ 273px
//   height≈ 278px
//   right edge spacer ≈ 560 - 270 - 273 = 17px

const IMAGE_URL =
  "https://flex-one-iota.vercel.app/assets/illustrations/monthly-winner/winner-01.jpg";

export async function POST() {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthLabel = prevMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  const firstName = "Alparslan";
  const score     = 284;

  // Renk sabitleri
  const DARK  = "#09172A"; // base-primary-950
  const WHITE = "#ffffff";
  const EB   = "font-weight:800";
  const BOLD = "font-weight:700";
  const MED  = "font-weight:500";
  const BASE = `font-family:'Baloo 2',Arial,sans-serif;color:${DARK};line-height:1.4`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @font-face {
      font-family: 'Baloo 2';
      font-style: normal;
      font-weight: 500;
      src: url('https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdjEyppo_leP6HcMqzQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Baloo 2';
      font-style: normal;
      font-weight: 600;
      src: url('https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdjEyppo_leP6HcMqzQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Baloo 2';
      font-style: normal;
      font-weight: 700;
      src: url('https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdj9yppo_leP6HcMqzQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Baloo 2';
      font-style: normal;
      font-weight: 800;
      src: url('https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdiayppo_leP6HcMqzQ.woff2') format('woff2');
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'Baloo 2',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:16px;overflow:hidden;
              box-shadow:0 2px 16px rgba(0,0,0,0.07)">

  <!--
    ── HERO BLOK: Görsel arka planda, metin glass card üzerinde ──
    table background → tüm email client'larda çalışır
    background-size:cover → modern client'larda görseli tam kaplar
  -->
  <tr>
    <td valign="top" style="padding:0;border-radius:16px 16px 0 0;overflow:hidden">

      <table width="560" height="560" cellpadding="0" cellspacing="0"
             background="${IMAGE_URL}"
             style="background-image:url('${IMAGE_URL}');background-size:cover;background-position:center center;
                    width:560px;height:560px;border-radius:16px 16px 0 0">

        <!-- Üst boşluk: glass card'ın başlangıcına kadar (143px) -->
        <tr><td colspan="3" height="143"></td></tr>

        <!-- Orta satır: [kupa alanı] [glass card metin] [sağ kenar] -->
        <tr valign="middle">

          <!-- Sol: kupa/element alanı (302px boş bırak) -->
          <td width="302" height="278"></td>

          <!-- Glass card metin alanı (241px) -->
          <td width="241" valign="middle"
              style="padding:0 18px 0 12px;vertical-align:middle">

            <!-- Başlık: Bold 18px -->
            <p style="margin:0 0 4px 0;${BASE};${BOLD};font-size:18px">
              Tebrikler ${firstName},
            </p>

            <!-- Puan satırı: Medium + ExtraBold puan kısmı -->
            <p style="margin:0 0 2px 0;${BASE};${MED};font-size:13px">
              ${monthLabel} ayında
              <span style="${EB}"> ${score} puan</span>
              ile ay,<br>birincisi oldun.
            </p>

            <!-- Harika bir performans: ExtraBold -->
            <p style="margin:0 0 2px 0;${BASE};${EB};font-size:13px">
              Harika bir performans...
            </p>

            <!-- Devam metni: Medium -->
            <p style="margin:0 0 10px 0;${BASE};${MED};font-size:13px">
              Bu başarı seni beklenenden daha<br>
              ileri götürecek.<br>
              Aynen devam :)
            </p>

            <!-- Logo -->
            <p style="margin:0;font-size:12px;${BOLD}">
              <span style="color:${DARK}">tasarım</span><span style="color:${WHITE}">atölyesi</span>
            </p>

          </td>

          <!-- Sağ kenar boşluğu -->
          <td width="17"></td>
        </tr>

        <!-- Alt boşluk -->
        <tr><td colspan="3" height="139"></td></tr>

      </table>
    </td>
  </tr>

  <!-- CTA Butonu -->
  <tr>
    <td style="padding:28px 40px 24px;text-align:center">
      <a href="https://flex-one-iota.vercel.app/dashboard/league"
         style="display:inline-block;background:#FF5C00;color:#fff;
                text-decoration:none;font-family:'Baloo 2',Arial,sans-serif;
                font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px">
        Sıralamayı Gör →
      </a>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#fafafa;border-top:1px solid #f0f0f0;
               padding:16px 40px;text-align:center">
      <p style="margin:0;font-size:12px;color:#bbbbbb;line-height:1.6;
                font-family:'Baloo 2',Arial,sans-serif">
        Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const result = await sendMail({
    to: "alparslan.sennturk@gmail.com",
    subject: `🏆 ${monthLabel} Birincisi Sensin! — Şablon Önizlemesi`,
    html,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
