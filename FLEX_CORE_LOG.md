# FLEX CORE LOG — INDEX
> "oku" → sadece bu dosya. Detay için: `logs/YYYY-MM.md` veya `FLEX_CORE_LOG_ARCHIVE.md` (fix 1-99).

| # | Tarih | Konu | Dosya |
|---|-------|------|-------|
| 100 | 2026-04-29 | Google Drive klasör yapısı: lazy /groups/group_{id}/students|instructors/ — getAccessToken, initResumableSession targetFolderId | `googledrive-folder.ts` (NEW), `googledrive.ts`, `init-resumable-upload/route.ts` |
| 101 | 2026-04-29 | Drive dosya isimlendirme: UUID → 01-dosya.pdf (Firestore sayacı + fallback) | `googledrive.ts`, `init-resumable-upload/route.ts`, `complete-upload/route.ts` |
| 102 | 2026-04-29 | Çoklu dosya yükleme: 5 başlangıç / 8 revizyon limiti, UI kayboluş fix | `student/[studentId]/[taskId]/page.tsx` |
| 103 | 2026-04-29 | Unique öğrenci sayısı submission stats, deadline sıralaması, accordion easing | `assignment-test/[groupId]/page.tsx`, `student/[studentId]/page.tsx` |
| 104 | 2026-04-29 | Firestore rules: getUserData() null-safe | `firestore.rules` |
| 105 | 2026-04-29 | Drive arşiv/geri al: group klasörünü Gruplar↔Arşiv arasında taşır | `api/groups/drive-folder/route.ts` (NEW), `hooks/useManagement.ts` |
| 106 | 2026-04-29 | Drive klasör isimlendirme: Eğitmenler→Eğitmen, eğitmen adı alt klasörü | `lib/googledrive-folder.ts` |
| 107 | 2026-04-29 | Drive migrasyon scripti: --init-all, --migrate, --dry-run | `scripts/migrate-drive-folders.mjs` (NEW) |
| 108 | 2026-04-30 | Ödev bazlı Drive klasör yapısı + kolaj PDF Drive yükleme (taskName 5. seviye) | `lib/googledrive-folder.ts`, `lib/googledrive.ts`, `send-kolaj/route.ts` |
| 109 | 2026-04-29 | AssignActivateModal + DesignParkour cancel try/catch — loader sıkışması fix | `AssignActivateModal.tsx`, `DesignParkour.tsx` |
| 110 | 2026-04-29 | Firestore isInstructor JWT token fallback: request.auth.token.role birincil | `firestore.rules` |
| 111 | 2026-04-29 | Firestore rules JWT-öncelikli yeniden yapılandırma: isAdmin/isInstructor token birincil | `firestore.rules` |
| 112 | 2026-04-29 | Login oturumu 1 saat → 30 gün: onIdTokenChanged cookie yenileme | `UserContext.tsx`, `login/page.tsx` |
| 113 | 2026-04-29 | Deadline hatırlatma maili: 2 gün + 1 gün → sadece 1 gün kala | `api/cron/deadline-reminder/route.ts` |
| 114 | 2026-04-29 | Firestore composite index deploy: submission_comments + submission_timeline | `firestore.indexes.json` |
| 115 | 2026-04-30 | Kolaj havuzu emoji temizleme: ItemForm'a × butonu | `pool/CollagePoolPanel.tsx` |
| 116 | 2026-04-30 | Mail log eksiklikleri: send-kolaj/kitap/sosyal'a saveMailLog + name+groupCode alanları | `emailService.ts`, `send-kolaj/route.ts`, `send-kitap/route.ts`, `send-sosyal/route.ts` |
| 117 | 2026-04-30 | Canlı test: kolaj kura, PDF mail, Drive klasör — sistem doğrulandı | — |
| 118 | 2026-04-30 | Lig A-Z butonu kaldırıldı (puan sıfırda zaten A-Z) | `league/page.tsx` |
| 119 | 2026-04-30 | Aylık cron çift mail fix: monthly-winner-preview Firestore duplicate koruması | `api/cron/monthly-winner-preview/route.ts`, `vercel.json` |
| 120 | 2026-05-01 | Öğrenci yorum sessiz kalma: catch eksikti; auth.currentUser null kontrolü + hata mesajı | `student/[studentId]/[taskId]/page.tsx` |
| 121 | 2026-05-01 | Firestore rules: isStudentOwner users doc fallback (authUid eksik öğrenciler) | `firestore.rules` |
| 122 | 2026-05-01 | adminAuth export: firebase-admin.ts'e getAuth eklendi | `lib/firebase-admin.ts` |
| 123 | 2026-05-01 | /api/student/sync: students.authUid eksikse users.studentDocId üzerinden düzeltir | `api/student/sync/route.ts` (NEW) |
| 124 | 2026-05-01 | Login + aktivasyon: sync endpoint çağrısı; aktivasyonda eksik cookie set | `login/page.tsx` |
| 125 | 2026-05-01 | Sayfa açılışında authUid sync + listenerKey: listener'ları yeniden başlatır | `student/[studentId]/[taskId]/page.tsx` |
| 126 | 2026-05-01 | Firestore rules threads: read'e role=='student' fallback, write'a authorId==currentUid() | `firestore.rules` |
| 127 | 2026-05-01 | Server-side comment write: /api/comments/create — token verify, student ownership, teacher group membership, idempotency, XSS | `api/comments/create/route.ts` (NEW) |
| 128 | 2026-05-01 | sendThreadComment helper: CLAIMS_STALE → force refresh + 1 retry, aynı idempotencyKey | `lib/sendThreadComment.ts` (NEW) |
| 129 | 2026-05-01 | welcome API: setCustomUserClaims'e studentDocId eklendi | `api/welcome/route.ts` |
| 130 | 2026-05-01 | 3 sayfada sendComment → API'ye taşındı; Firestore thread create: false | `student/[taskId]/page.tsx`, `[assignmentId]/page.tsx`, `preview/page.tsx`, `firestore.rules` |
| 131 | 2026-05-01 | CLAIMS_STALE kalıcı fix: comments/create 3 kademeli fallback (token→users_doc→students_query); sync'te users doc + setCustomUserClaims; login'de sync await + getIdToken(true) redirect öncesi | `api/comments/create/route.ts`, `api/student/sync/route.ts`, `login/page.tsx` |
| 132 | 2026-05-01 | Aylık lig cron zamanlaması: winner 1→5, preview son gün→4; effectiveDate endDate-only (geç not girişi artık ay sınıflandırmasını etkilemiyor); ilk etki Haziran 4/5 | `vercel.json`, `.github/workflows/monthly-winner.yml`, `.github/workflows/monthly-winner-preview.yml`, `api/cron/monthly-winner/route.ts`, `api/cron/monthly-winner-preview/route.ts` |
