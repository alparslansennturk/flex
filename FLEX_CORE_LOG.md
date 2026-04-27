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
| 49 | 2026-04-23 | GroupCard Annoyed → Smile ikonu | `GroupCard.tsx` |
| 50 | 2026-04-23 | Grup detay sayfası yeniden tasarım — pembe banner, filtre pill, görev listesi | `[groupId]/page.tsx` |
| 51 | 2026-04-23 | Görev satırı → accordion kart: kapalı/açık, istatistikler, Ödev Detay butonu | `[groupId]/page.tsx` |
| 52 | 2026-04-23 | Ödev detay sayfası: 3 sütun — öğrenci listesi, önizleme, dosyalar+yorumlar+aksiyon | `[groupId]/[assignmentId]/page.tsx` |
| 53 | 2026-04-24 | Ödev detay sayfası yeniden tasarım — 2 panel, avatar, durum grupları, toplu aksiyon, yorum sekmeleri | `[groupId]/[assignmentId]/page.tsx` |
| 54 | 2026-04-24 | Preview sayfası — sidebar yok, iframe önizleme, öğrenci-eğitmen özel yorum thread'i | `[submissionId]/preview/page.tsx` |
| 55 | 2026-04-24 | Firestore güvenlik kuralları: tasks/comments ve submissions/comments alt koleksiyonları | `firestore.rules` |
| 56 | 2026-04-24 | Firestore composite index: submission_files, submission_comments, submission_timeline | `firestore.indexes.json` |
| 57 | 2026-04-24 | Sidebar compact mod iyileştirme: eşik 900px, logo/nav padding azaltma, alt menü py-2 | `Sidebar.tsx` |
| 58 | 2026-04-25 | Ödev detay sol panel: grup başlığı noktalı renk → düz text-primary, öğrenci ismi text-secondary, gruplar arası 16px boşluk | `[groupId]/[assignmentId]/page.tsx` |
| 59 | 2026-04-26 | Öğrenci portal MVP: ödev listesi + detay/upload/yorum sayfaları | `student/[studentId]/page.tsx`, `student/[studentId]/[taskId]/page.tsx` |
| 60 | 2026-04-26 | Submit API: note alanı desteği eklendi (formData → Firestore) | `api/submit/route.ts` |
| 61 | 2026-04-26 | Öğrenci dashboard: Classroom tarzı layout — sidebar, template banner, accordion (eğitmen ile bire bir), duyurular feed | `student/[studentId]/page.tsx`, `StudentSidebar.tsx` |
| 62 | 2026-04-26 | Ödev yükle sayfası: sidebar eklendi, upload alanı büyütüldü, yorum paneli sağda korundu | `student/[studentId]/[taskId]/page.tsx` |
| 63 | 2026-04-26 | Sidebar: Sınıf Ligi widget (grup bazlı sıralama) + /league nav linki | `StudentSidebar.tsx`, `StudentLeagueWidget.tsx` |
| 64 | 2026-04-26 | dev-seed yanıtına studentId + studentPortalUrl eklendi | `api/dev-seed/route.ts` |
| 65 | 2026-04-27 | Firestore rules: users self-read short-circuit (Missing or insufficient permissions fix) | `firestore.rules` |
| 66 | 2026-04-27 | Login redirect: Auth UID → students doc ID (studentDocId alanı via welcome API) | `login/page.tsx`, `api/welcome/route.ts` |
| 67 | 2026-04-27 | students koleksiyonu: `allow read: if isSignedIn()` (StudentLeagueWidget grup sorgusu) | `firestore.rules` |
| 68 | 2026-04-27 | /league route koruması: middleware + matcher güncellendi (artık login zorunlu) | `middleware.ts` |
| 69 | 2026-04-27 | /league sayfası: StudentSidebar + sidebarReady flash önleme | `league/page.tsx` |
| 70 | 2026-04-27 | StudentSidebar yeniden tasarım: avatar/isim kaldırıldı, admin-style Çıkış Yap butonu, aktif nav highlight | `StudentSidebar.tsx` |
| 71 | 2026-04-27 | getStudentTaskSubmission: orderBy kaldırıldı → composite index gerekmez (FAILED_PRECONDITION fix) | `lib/submissions.ts` |
| 72 | 2026-04-27 | Firestore indexes deploy edildi (submissions: studentId+taskId+submittedAt) | `firestore.indexes.json` |
| 73 | 2026-04-27 | [ÇÖZÜLDÜ] Google Drive refresh token — OAuth app publish edildi (Testing→Production), yeni token alındı | `scripts/refresh-google-token.mjs`, `.env.local` |
| 74 | 2026-04-28 | Login sessiz kalma: cookie race condition — getIdToken+getDoc paralel, router.push öncesi cookie set | `login/page.tsx` |
| 75 | 2026-04-28 | Banner image git'e eklendi (public/assets/templates/desgin-studio-templale-01.jpg — untracked'dı) | `public/assets/templates/` |
| 76 | 2026-04-28 | Firestore rules: isStudentOwner + isSubmissionOwner helper'ları — submissions/comments, submission_files, submission_timeline öğrenci okuma izni | `firestore.rules` |
| 77 | 2026-04-28 | Öğrenci yorum gönderme: addDoc'a authorId (auth.currentUser.uid) eklendi — permission denied fix | `student/[studentId]/[taskId]/page.tsx` |
| 78 | 2026-04-28 | Öğrenci görev sayfası: undefined daysLate fix, HistoryRow'a ExternalLink ikonu, auth import | `student/[studentId]/[taskId]/page.tsx` |
| 79 | 2026-04-28 | FilePreview: iframe src /preview URL fix, mimeType ile dosya tipi tespiti, driveFileId thumbnail desteği | `components/assignment-test/FilePreview.tsx` |
| 80 | 2026-04-28 | Eğitmen ödev detay: inline dosya kartı (Drive + İndir butonları), tab "Genel" + öğrenci adı | `dashboard/assignment-test/[groupId]/[assignmentId]/page.tsx` |
