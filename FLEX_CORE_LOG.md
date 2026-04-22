# FLEX CORE LOG — INDEX
> "oku" → sadece bu dosya. Detay için: `logs/YYYY-MM.md` veya `FLEX_CORE_LOG_ARCHIVE.md` (fix 1-30).

| # | Tarih | Konu | Dosya |
|---|-------|------|-------|
| 1 | 2026-03 | Arşiv silince puan düşme | `scoring.ts`, `league/page.tsx` |
| 2 | 2026-03 | G2 şablonu → G1 sınıfı XP yarıya | `AssignmentLibrary.tsx`, `DesignParkour.tsx` |
| 3 | 2026-03 | Ödev iptal → XP geri alma | `DesignParkour.tsx` |
| 4 | 2026-03 | Sertifikasyon grup bazlı sıfırlama | `grading/page.tsx` |
| 5 | 2026-03 | Sertifikasyon ödev puanı hesapları | `grading/page.tsx` |
| 6 | 2026-03 | Sertifikasyon öğrenci listesi realtime | `grading/page.tsx` |
| 7 | 2026-03 | Öğrenci transferi eski puan temizleme | `useManagement.ts` |
| 8 | 2026-03 | TypeScript derleme hatası | — |
| 9 | 2026-03 | Öğrenci kartı lig puanı toplam | `league/page.tsx` |
| 10 | 2026-03 | Arşiv silince istatistik sıfırlanması | `scoring.ts` |
| 11 | 2026-03 | Arşiv çoklu oturum birleştirme | — |
| 12 | 2026-03 | DesignParkour addDoc undefined points | `DesignParkour.tsx` |
| 13 | 2026-03 | Kolaj/Kitap görev tamamlama tespiti | `GameScreen.tsx` |
| 14 | 2026-03 | Öğrenci kartı ödev sayısı yükleme | — |
| 15 | 2026-03 | Kolaj isim soyisim aynı satır | — |
| 16 | 2026-03 | DesignParkour geçmiş tarih engeli | `DesignParkour.tsx` |
| 17 | 2026-03 | Kitap kapağı PDF şablon mail | — |
| 18 | 2026-03 | Kitap "Ödevi Tamamla" görünürlük | `BookGameScreen.tsx` |
| 19 | 2026-03 | Kitap carousel drift fix | — |
| 20 | 2026-03 | BookGameScreen redesign | `BookGameScreen.tsx` |
| 21 | 2026-03 | BookGameScreen dark tema | `BookGameScreen.tsx` |
| 22 | 2026-03 | Mail hata yönetimi Brevo API key | — |
| 23 | 2026-03 | Kitap görev otomatik tamamlama | — |
| 24 | 2026-03 | İsim salınım animasyonu | — |
| 25 | 2026-03 | Carousel globals.css rem sorunu | `globals.css` |
| 26 | 2026-03 | Deadline hatırlatma cron | `vercel.json` |
| 27 | 2026-04-03 | Puan sistemi v8 | `scoring.ts`, `league/page.tsx` |
| 28 | 2026-04-03 | Puan sistemi v9 | `scoring.ts`, `league/page.tsx` |
| 29 | 2026-04-07 | Puan sistemi v13 | `scoring.ts` |
| 30 | 2026-04-11 | Aylık puan güncellemesi | `league/page.tsx` |
| 31 | 2026-04-15 | completionRate: deadline gelmemiş hariç | `LeaderboardWidget.tsx`, `league/page.tsx` |
| 32 | 2026-04-15 | Görev oranı `4/5 (+1)` formatı | `league/page.tsx` |
| 33 | 2026-04-15 | Ödevi Bitir: gelecek endDate bugüne çek | `DesignParkour.tsx` |
| 34 | 2026-04-15 | Ödevi İptal: deleteDoc ile tamamen sil | `DesignParkour.tsx` |
| 35 | 2026-04-15 | G1→G2 carry-over grup düzenlemede | `useManagement.ts` |
| 36 | 2026-04-16 | G1+G2 çift sayım — classEntries ayrımı + todayStr revert | `dashboard/league`, `league/page.tsx` |
| 37 | 2026-04-16 | Öğrenci kartı completionRate 1.0 (totalAssigned eksikti) | `StudentDetailModal.tsx` |
| 38 | 2026-04-16 | Carry-over: stale g2StartXP → G1 dinamik hesaplama | `dashboard/league`, `league/page.tsx` |
| 39 | 2026-04-16 | Vercel: /api/league cache sorunu force-dynamic | `api/league/route.ts` |
| 40 | 2026-04-16 | Şablon ikon değişimi aktif kartlara real-time yansıma | `DesignParkour.tsx`, `TasksContent.tsx` |
| 41 | 2026-04-16 | Öğrenci kartı G1 öğrencide Grafik-2 "—" göster | `StudentDetailModal.tsx` |
| 42 | 2026-04-19 | Otomatik kart geçişi: süresi dolan → not ver (gece 00:00) | `api/cron/auto-grade-transition/route.ts`, `vercel.json` |
| 43 | 2026-04-19 | Cron mailleri mailLogs'a kaydedilmedi | `emailService.ts`, `deadline-reminder`, `monthly-winner`, `monthly-winner-preview` |
| 44 | 2026-04-19 | Deadline hatırlatma mail imzası: eğitmen adı | `deadline-reminder/route.ts` |
| 45 | 2026-04-22 | Ödev Test kart grid sabit 330px genişlik (auto-fill) | `assignment-test/page.tsx` |
| 46 | 2026-04-22 | GroupCard branch uppercase kaldırıldı | `GroupCard.tsx` |
| 47 | 2026-04-22 | GroupCard arşiv menüsü (··· dropdown) + onArchive handler | `GroupCard.tsx`, `assignment-test/page.tsx` |
| 48 | 2026-04-22 | Arşive Al onay modalı — turuncu butonlar, 640×480 oranı | `GroupCard.tsx` |
