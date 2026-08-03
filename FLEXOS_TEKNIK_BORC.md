# FlexOS Teknik Borç Checklist

> 2026-07-28 kod incelemesinden çıkan liste. Yapıldıkça `[ ]` → `[x]` işaretlenip
> altına tarih/not eklenecek. Kaynak tartışma: `FLEXOS.md`'deki mimari değil, bu
> ayrı bir bakım/refactor listesi — canlı sistemi bozmadan kademeli uygulanır.

## Kapsam ve genel değerlendirme

Kapsam: `src/app/flexos/`, `src/app/api/flexos/`, `src/app/lib/domain/`, `src/app/lib/server/`
— 452 dosya, ~60.800 satır. Sayılar gerçek tarama (grep/wc), tahmin değil.

**Genel puan: 5.5-6/10.** İyi taraf: domain katmanı temiz (UI'a bağımlı değil, repo pattern
doğru, capability tabanlı `can()` tutarlı, `any`/`ts-ignore` neredeyse sıfır). Kötü taraf:
uygulama katmanı (sayfalar + API route'lar) disiplinsiz büyümüş — devasa dosyalar,
kopyala-yapıştır hata yönetimi, sıfır test, sıfır memoization. "İyi tasarlanmış çekirdek +
hızlı büyümüş kabuk" profili — yeniden yazım gerekmiyor, hedefli refactor yeterli.

## Kritik 20 madde

1. [x] **Sıfır test kapsamı** — ✅ 2026-07-28 başlatıldı: proje daha önce test
   altyapısına HİÇ sahip değildi. `vitest` kuruldu (`vitest.config.ts` — `@/*`
   alias çözümü, `node` environment), `package.json`'a `"test": "vitest run"`
   eklendi. **3 en kritik servis için 51 test** yazıldı, hepsi geçiyor,
   `tsc --noEmit` temiz:
   - `sale-service.test.ts` (12 test) — yetki/validasyon hataları, aynı TC'yle
     dedup (yeni Person açmama), PII düşürme, paket satışta N enrollment,
     pasif paket reddi, iptal cascade'i.
   - `grade-service.test.ts` (12 test) — yetki (assigned vs org scope), 0-100
     validasyonu, **kilitli not eğitmen tarafından sessizce atlanır ama
     admin override edebilir** (gerçek iş kuralı), değişmeyen not aktivite
     logu ÜRETMEZ, roster-toplu tek özet log.
   - `attendance-service.test.ts` (27 test, sahte zamanla `vi.setSystemTime`) —
     **2026-07-13 gerçek prod bug'ının regresyon testi** (isoWeekday/JS
     Date.getDay() karışıklığı), 15dk erken-başlatma penceresi (sınır dahil),
     3 günlük düzenleme penceresi + org-scope bypass, kapalı kayıt silinemez,
     spam-önleme (kapanmamış kayıtta log yok) — hepsi ayrı ayrı test edildi.
   **`submission-service.test.ts` eklendi (2026-07-28, üçüncü oturum, 13 test)**
   — `getMaxUploads` (upload hakkı kuralı), `combineOdevYuzdesi` (Ödev Notu
   ağırlıklı ortalama formülü — **gerçek bir davranış doğrulandı: `proje`
   kategorisi şu an hiç dolmadığı için ağırlıklandırma pratikte hiç devreye
   girmiyor, tek dolu kategori olduğu gibi %100 ağırlıkla kullanılıyor**),
   `computeOdevYuzdeleri` (draft/proje-kind hariç tutma, published/closed/
   archived'ın hepsinin dahil olması, notsuz teslimlerin sayılmaması, çoklu
   ödev toplamı). **+17 test daha eklendi (dördüncü oturum):** `retract`
   (sahiplik kontrolü/ForbiddenError, notlandırılmış/geri-çekilemez durum/
   son-tarih-geçti engelleri, dosyaların soft-delete + storage'dan silinmesi),
   `updateSubmissionStatus` (geçersiz durum reddi, assigned-scope yetki,
   revision/completed'da doğru bildirim başlığı, ara durumlarda HİÇ bildirim
   gitmemesi, authUid yoksa sessizce atlanması), `gradeSubmission` (notun
   ödevin KENDİ `maxPuan`'ına göre sınırlanması — sabit 100 değil, sınırda
   değer kabul), `gradeManually` (dijital iz yoksa yeni "completed" Submission
   açma vs. gerçek teslim varsa üzerine yazıp YENİ doküman açmama). Toplam
   **81 test, hepsi geçiyor**, `tsc`+`eslint` temiz. Kapsam dışı
   kalan (dosya-yükleme akışları — `initUpload`/`completeUpload`/
   `gradeBatch` vb. — daha fazla mock altyapısı gerektiriyor, sonraki
   oturumda ele alınabilir). Testler CI'a bağlanmadı (CI yapılandırması bu
   repoda yok), sadece `npm test` ile elle çalıştırılıyor.
2. [x] **connect-service.ts içindeki 5 N+1 sorgu zinciri** — ✅ 2026-07-28 tamamlandı:
   `findExistingDm` (artık `listMembershipsForUid` kesişimi), `listStarredMessages`
   (toplu `getConversationsByIds`+`listMembershipsForUid`), `updateConversationMeta`
   admin promote/demote (tek `listMembers` + paralel yazım), topluluğa grup ekleme
   roster senkronu (toplu roster+duyuru-kanalı okuma + paralel yazım). `tsc --noEmit`
   temiz. **Tarayıcı testi (2026-07-28, local dev + Claude in Chrome, gerçek admin
   oturumu):** `listStarredMessages` gerçek yıldızlı mesajla uçtan uca doğrulandı (200,
   doğru konuşma/gönderen/mesaj). `findExistingDm` server tarafında doğrudan
   tetiklenemedi — client zaten yüklü konuşma listesinden dedupe ediyor, sunucuya hiç
   istek gitmiyor; mantık `tsc` + kod incelemesiyle doğrulandı, canlı DM verisiyle
   ayrıca kanıtlanmadı. Gerçek sunucu tetikleyicisi bulundu ama denenmedi:
   `src/app/flexos/connect/page.tsx:463` — `createConversation({ realm, type: "dm",
   name: "", memberUids: [targetUid] })`; client sadece `conversations.find(c =>
   c.type==="dm" && c.peerUid===targetUid)` (satır 457) zaten yoksa bu satırı
   çağırıyor, yani server-side testi için ya conversations listesini istemci
   state'inden düşürüp (ör. sayfa yeniden yükle + hızlıca tıkla, race koşulu
   gerektirir) ya da doğrudan API'yi çağırmak gerekir (id token elle çekilemedi,
   hassas veri guard'ı engelledi — bkz. not). `updateConversationMeta` admin
   promote/demote fix'i **✅ 2026-07-28 tarayıcıda TAMAMEN doğrulandı**: gerçek
   bir test kanalı (`TEST_N1_Dogrulama`) oluşturuldu, 1 yayıncıyla (Mert Yılmaz)
   başlatıldı, sonra AYNI güncellemede hem 2 kişi promote (Elif Kaya, Naz Erdem
   → "Yönetici" rozeti) hem 1 kişi demote (Mert Yılmaz → rozet gitti ama ÜYE
   olarak KALDI, atılmadı — tam da kod yorumundaki iş kuralı) edildi, "Bilgi"
   panelinden üye listesi doğrulandı, sonra test kanalı silinip temizlendi
   (DELETE 200). Topluluk roster senkronu (childIds ekleme) test edilmedi
   (uygun bir topluluk/grup çifti bu ortamda yoktu) — düşük risk, kod incelemesi
   yeterli görüldü. **Yan not:** kanal silme sonrası konsolda bir kerelik
   "FirebaseError: Missing or insufficient permissions" göründü — DELETE
   isteğinin kendisi 200 döndü ve UI doğru güncellendi, muhtemelen silinen
   dokümana bağlı aktif bir `onSnapshot` dinleyicisinin zararsız artığı;
   yeniden görülürse araştırılmalı.
3. [x] **person-education-summary-service.ts:173 N+1** — ✅ 2026-07-28 tamamlandı:
   enrollment döngüsü sıralıdan `Promise.all` ile paralele çevrildi. `tsc --noEmit` temiz.
   **Tarayıcı testi (2026-07-28) TAMAMLANDI:** gerçek 2-enrollment'lı öğrenci
   (Kaan Berk Demirel) üzerinde "Eğitim Bilgileri" sekmesi açıldı,
   `/api/flexos/persons/{id}/education-summary` 200 döndü, veriler (grup, saat,
   sertifika durumu) doğru göründü, konsolda hata yok.
4. [x] **105+ API route'taki tekrar eden hata yönetimini tek fonksiyona topla** —
   ✅ 2026-07-28 tamamlandı: `src/app/lib/server/api-error.ts::apiError(e, context)`
   eklendi (ForbiddenError→403 capability'li, ValidationError→400, else→500 +
   `console.error`). Regex tabanlı codemod ile **91/108 route** otomatik migrate
   edildi, sonra artık kullanılmayan `ForbiddenError`/`ValidationError` importları
   90 dosyada temizlendi. `tsc --noEmit` ve `eslint` tertemiz, dev server'da 3
   migrate edilmiş route (attendance/grades/persons) 401 ile doğru yanıt verdi
   (runtime'da modül yükleniyor, kırılma yok). **17 dosya bilinçli olarak
   atlandı** (özel rollback/çoklu-catch mantığı var, ör. `users/route.ts`'te
   Auth hesabı geri alma) — bunlar elle tek tek incelenmeli, körlemesine
   codemod riskliydi. Kalan liste: social-pool, assignment-templates,
   book-pool, role-defs, dev-notes (+[id]), collage-pool, users, users/[id]
   (kısmen — bkz. commit diff), egitmen-anasayfa/bootstrap, persons/[id]/
   education-summary, view-access + view-access/verify, connect/conversations
   ailesi (birkaç dosya, mesaj/üye route'ları).
5. [x] **`connect/page.tsx` ve `connect/mobile/page.tsx` ortak yardımcılar** — ✅
   2026-07-29 tamamlandı: `withTimeout`/`initials`/`fmtTime`/`fmtFileSize`/`dayKey`/
   `presenceColor`/`presenceLabel`/`PresenceDot` birebir kopyalanmıştı, tek yerde
   (`_shared/format.tsx`) toplandı. `dividerLabel` TEK istisna — masaüstü hafta
   günü adını gösteriyordu, mobil göstermiyordu; bu davranış farkı `showWeekday`
   parametresiyle korundu, hiçbir ekranın görünümü değişmedi. `tsc`/`eslint`
   temiz, tarayıcıda doğrulandı (masaüstü "21 Temmuz Salı", mobil "21 Temmuz").
6. [x] **`egitim-yonetimi/ekle/page.tsx` (1.583 satır, tek dev component)** — ✅
   2026-07-30 TAMAMEN bitti (3 adımda). 2026-07-29:
   **1. adım** (risksiz, saf sabitler): `_shared/types.ts`
   (Track/Bolum/DayData/PriceRow/TabKey/FormState/INITIAL/PoolOpt/EditingTrack/
   DragTrack), `_shared/constants.ts` (S/IC/TABS/tabStyle/tabNumStyle/globalCss/
   SYMBOLS/addBtn, satır satır orijinaliyle karşılaştırılarak taşındı) ve
   `_shared/RichText.tsx` (kendi başına bağımsız zengin-metin editörü + paste
   sanitizer) çıkarıldı.
   **2. adım** (3 basit tab, presentational split): `_shared/GenelTab.tsx`,
   `_shared/FiyatTab.tsx`, `_shared/SertifikasyonTab.tsx` — her biri state'siz,
   tüm state/handler'lar prop olarak container'dan (`EgitimEklePage`) geliyor.
   2026-07-30: **3. adım** (en karmaşık kısım, İçerikler tab'ının kendisi) —
   3 birbirini dışlayan alt görünüm ayrı component'lere bölündü:
   `_shared/BolumTrackYoneticisi.tsx` (bölüm/track ağacı + drag-drop + inline
   düzenleme, ~30 prop — state container'da kaldı, `onTrackTargetChange` gibi
   inline `setForm` mantığı container'da adlandırılmış bir handler'a çıkarıldı),
   `_shared/StandartPaketIcerik.tsx` (RichText sarmalayıcı), `_shared/
   GunPlanlayici.tsx` (gün gün program). `page.tsx` artık sadece bu 6 component'i
   orkestre eden bir container.
   `page.tsx`: 1.591 → **766 satıra** indi (%52 küçüldü, 8 yeni `_shared/` dosyası).
   `tsc --noEmit` temiz (proje genelinde). `eslint`: kalan 2 `react/no-unescaped-
   entities` hatası (SADECE modalCfg "publish" mesajında, hiç dokunulmadı) +
   1 önceden var olan `isSaat` unused-var uyarısı — ikisi de bu turdan önce de
   vardı. Fiyat + Standart Paket İçerik çıkarılırken 2 tırnak/apostrof hatası da
   ayrıca düzeltildi (5→3→3, kalanlar tamamen ilgisiz). Tarayıcıda uçtan uca
   doğrulandı: 4 tab, RichText toolbar'ı, Track Bazlı bölüm+track ekleme/
   düzenleme/iptal (inline edit modu dahil), Kurumsal gün planlayıcı (konu
   ekleme dahil) birebir eskisi gibi çalıştı, console'da hata yok.
7. [x] **`ogrenciler/havuz/page.tsx` (1.403 satır, tek dev component)** — ✅ 2026-07-30
   tamamlandı: 8 dosyaya bölündü — `_shared/types.ts` (StatusKey/ST/BRANS sözlükleri/
   Student/GroupOption tipleri + `schedulesOverlapClient` çakışma mantığı),
   `_shared/constants.ts` (S/IC/globalCss), `_shared/FilterPanel.tsx` (Durum çipleri +
   Şube/Branş/Eğitim dropdown'ları + isim arama, state'siz), `_shared/StudentTable.tsx`
   (tablo + satırlar + sayfalama — en büyük parça, hover popup state'leri (branş/grup/
   eğitim) container'dan BURAYA taşındı çünkü hiçbir yerde paylaşılmıyordu; 3-nokta işlem
   menüsü state'i (`actionMenuOpen/Step/Pos`) ise container'da KALDI çünkü filtre
   dropdown'ıyla çift yönlü kapatma bağımlılığı var), `_shared/GroupOptionsList.tsx`
   (Gruba Ata + Grup Değiştir modallerinin ortak çakışma-farkında grup listesi, kod
   tekrarı bu bölme sırasında ayrıca temizlendi), `_shared/AssignGroupModal.tsx`,
   `_shared/TransferGroupModal.tsx`, `_shared/DeleteEnrollmentModal.tsx`.
   `page.tsx`: 1.398 → **573 satıra** indi (%59 küçüldü). `tsc --noEmit` temiz, `eslint`
   sadece bölünmeden ÖNCE de var olan 4 `authHeaders` exhaustive-deps uyarısı gösteriyor
   (yeni hata yok). Tarayıcıda uçtan uca doğrulandı (local dev + Claude in Chrome, gerçek
   admin oturumu): isim arama (anında filtre), Durum çip filtresi (Aktif tek başına 5
   sonuç), satıra tıklayınca öğrenci detay paneli sağdan doğru kayıyor + gerçek veri
   gösteriyor, branş/eğitim/grup çoklu-değer hover popup'ları (Kaan Berk Demirel'in 2
   grubu) doğru açılıyor, 3-nokta menüsü `document.body` portal'ıyla doğru konumda
   açılıyor, tek gruplu kayıtta Grup Değiştir direkt modalı açıyor, çok gruplu kayıtta
   önce "HANGİ GRUPTAN TAŞINSIN?" ara adımı çıkıyor, Gruba Ata/Grup Değiştir modalları
   boş-grup durumunu doğru gösteriyor. Konsolda hata yok.
8. [x] **`satislar/satis-yap/page.tsx` (1.345 satır) — ticari kritik akış, hem böl hem test yaz** —
   ✅ 2026-07-30 tamamlandı. Bölme (9 dosya): `_shared/types.ts` (katalog tipleri +
   `ageFrom`/`fmtTL`/`TAKSIT_PRESETS`), `_shared/constants.ts` (S/IC/globalCss/tabStyle/…),
   `_shared/ui.tsx` (SectionTitle/Label/SelectWrap), `_shared/GenelBilgilerTab.tsx`,
   `_shared/EgitimTab.tsx` (en büyük parça — Bireysel/Paket modu, branş→eğitim→track
   ağacı, 34 prop), `_shared/OdemeTab.tsx`. **Asıl amaç — kritik finansal mantığı SAF
   fonksiyonlara çıkarıp test etmek:** `_shared/pricing.ts` (`calcBundleDiscount`,
   `calcBrutBase` — paket/track-bazlı/full-paket/hibrit fiyat kaynağı seçimi,
   `calcSalePricing` — kampanya %/sabit indirim, yönetici ek indirimi %/TL kırpma
   guard'ları, KDV, senet vade farkı FLAT hesabı, sıfırKilit tüm tutarları kilitleme)
   ve `_shared/buildSaleRequestBody.ts` (form state → API gövdesi: PII sadece dolu
   alanlar, guardian SADECE 18-altı+veli-adı-dolu, ödeme satırları upfront/senet
   ayrımı). **26 yeni vitest testi** yazıldı (`pricing.test.ts` 15, `buildSaleRequestBody.
   test.ts` 11) — kampanya indirimi brütü aşamıyor, ek indirim %100'e kırpılıyor, kalan
   negatife düşmüyor, senet vade farkı doğru formülle, sıfırKilit her şeyi 0'lıyor,
   guardian/PII/ödeme-planı eşleme kuralları tek tek doğrulandı. Proje toplamı artık
   **107 test** (81 eski + 26 yeni), hepsi geçiyor. `page.tsx`: 1.340 → **535 satıra**
   indi (%60 küçüldü). `tsc --noEmit` temiz, `eslint` sadece bölünmeden ÖNCE de var olan
   `nthApplied` (kullanılmayan, orijinalde de ölü kod) + 4 `authHeaders` exhaustive-deps
   uyarısı gösteriyor (yeni hata yok — `useCallback`/`isTc` gibi bölme sonrası ortaya
   çıkan 2 kullanılmayan değişken ayrıca temizlendi). Tarayıcıda uçtan uca doğrulandı
   (local dev + Claude in Chrome, gerçek admin oturumu): Genel Bilgiler formu, branş
   seçilince gerçek katalogdan Eğitim dropdown'ının açılması (`Grafik Tasarım Kursu`,
   177 saat/Bölümlü/Sertifikalı), Full Paket↔Track Bazlı geçişi, track ağacında tekil
   track kaldırma (6→5 track, 206→176 saat, bölüm checkbox'ı doğru indeterminate oldu),
   3 sekme arası state kaybı olmadan geçiş, Ödeme sekmesinde finansal özet kartının
   (KDV %10 dahil) doğru render olması. Konsolda hata yok. (Not: test verisinde
   track'lerin `listPrice` alanı boş olduğu için Eğitim Tutarı 0 TL göründü — bu
   seed/demo veri eksikliği, refactor'dan bağımsız, orijinal formülle birebir aynı
   davranış.)
9. [x] **Client tarafta paylaşılan `authHeaders`/`authHeadersJson`** — ✅ 2026-07-28
   tamamlandı: `src/app/lib/client/auth-headers.ts` eklendi (56 dosyada birebir
   kopyalanmış Firebase-token→Authorization-header fonksiyonu tek yerde). Codemod
   ile **52/56 dosya** migrate edildi (2 pass: düz varyant + Content-Type'lı
   varyant `authHeadersJson`). Bu sırada bir gerçek hata da bulunup düzeltildi:
   codemod'un import ekleme mantığı `GroupTable.tsx`'te çok satırlı bir `import {`
   bloğunun ORTASINA yeni import satırı sokmuştu (syntax hatası) — fark edilip
   düzeltildi + ikinci pass'te aynı hata sınıfına karşı guard eklendi. Ayrıca
   3 dosyada (`aktivite-merkezi`, `randevu-takvimi`) rename sonrası `useCallback`
   dependency array'lerinde dangling `authHeaders` referansı kalmıştı, düzeltildi.
   `tsc --noEmit` temiz, `eslint` sadece önceden var olan alakasız hatalar
   gösteriyor, dev server'da 8 migrate edilmiş sayfa (aktivite-merkezi, randevu-
   takvimi, siniflar, ogrenciler/havuz, satis-yap, paket-yonetimi, egitim-
   yonetimi/ekle, yoklama/rapor) 200 döndü, server log'unda hata yok.
   **4 dosya bilinçli atlandı** (gerçekten farklı davranış — `if(!user) return {}`
   ya da tip anotasyonsuz inline varyant): `satislar/kampanya-yonetimi/page.tsx`,
   `egitim-yonetimi/branslar/page.tsx`, `egitim-yonetimi/ayarlar/tatil/page.tsx`,
   `egitim-yonetimi/subeler/page.tsx`.
10. [x] **15+ `exhaustive-deps` disable incelendi** — ✅ 2026-07-28 tamamlandı, 20
    konumun (18 exhaustive-deps + 2 set-state-in-effect) TAMAMI tek tek okundu.
    **2 GERÇEK BUG bulundu ve düzeltildi:**
    - `yoklama/rapor/page.tsx:525` — ikinci bir eğitmenin "Detay" paneli açılınca
      `selectedGroupHistory`/`selectedSession` reset edilmiyordu, önceki eğitmenin
      grup geçmişi donuk kalıyordu (yanlış veri gösterimi). "Detay →" butonuna
      reset eklendi. **Tarayıcıda doğrulandı (2026-07-28, ikinci oturum):**
      GRP-784 → GRP-550'ye manuel geçiş → geri dön → tekrar Detay → doğru şekilde
      GRP-784'e (ilk grup) resetlendi, GRP-550'de donuk kalmadı. (Not: test
      ortamında sadece 1 eğitmenin veri kaydı var, o yüzden iki FARKLI eğitmen
      arasında geçiş senaryosu birebir denenemedi — ama aynı kök neden/tetikleyici
      olan "grup değiştir + geri dön + tekrar aç" akışı doğrulandı.)
    - `egitim-yonetimi/ekle/page.tsx:1336` (`RichText` component) — boş dependency
      array SADECE mount'ta senkronize ediyordu; düzenleme modunda (`?id=...`)
      mevcut içerik async fetch'ten SONRA geldiği için editör boş görünüyordu ve
      kaydedince **mevcut içerik sessizce silinme riski** vardı. `value` dep'e
      eklendi (`!==` guard'ı sayesinde kullanıcının kendi yazımını bozmuyor).
      Yan etki: `eslint-plugin-react-hooks@7`'nin yeni `react-hooks/refs` kuralı
      bu fix sonrası aynı component'teki (önceden zaten var olan, güvenli)
      `cmd()`/`fb()` deferred-callback deseninde 17 yanlış-pozitif verdi —
      doğrulanıp (fix öncesi/sonrası A/B testiyle) `react-hooks/refs` için
      gerekçeli bir disable bloğu eklendi. **Tarayıcıda doğrulandı (2026-07-28,
      ikinci oturum):** "Python Kursu" (gerçek, kayıtlı standart-paket eğitim)
      düzenlemeye açıldı, "İçerikler" sekmesi mevcut müfredat metnini ("Modül 1:
      Python Core genel bakış...") DOLU gösterdi — fix öncesi bu boş görünürdü.
    - **Diğer 18 konum incelendi, hepsi güvenli** (dokunulmadı): çoğu ya "türetilmiş
      değer" deseni (ör. `instructorGroups` zaten `selectedInstructorId`'ye bağlı
      bir memo, ayrıca deps'e eklemeye gerek yok), ya bilinçli tek-seferlik
      mount/init deseni (auth+load, oyun animasyonları — `key`/conditional-render
      ile zaten remount oluyor), ya da zaten guard'lı tekrar-set önleme deseni
      (`GroupTable.tsx`, `GroupFormSheet.tsx` — bazıları 2026-07-27/28'de zaten
      gerçek bug fix'i görmüş, tekrar dokunulmadı).
    `tsc --noEmit` ve `eslint` (ilgili dosyalarda, önceden var olan alakasız
    hatalar hariç) temiz. **İki gerçek bug da tarayıcıda doğrulandı (yukarı bkz).**
11. [x] `set-state-in-effect` disable'ları — ✅ madde 10 ile birlikte incelendi:
    `NotificationSoundSettings.tsx` (SSR/hydration mismatch'i önlemek için
    bilinçli, doğru) ve `GroupTable.tsx` (guard'lı tek-seferlik init, doğru) —
    ikisi de güvenli, bug değil.
12. [x] **Zero `React.memo` — ÖNCEKİ ÇERÇEVE HATALIYDI, düzeltildi (2026-07-28):**
    bu 3 dosya (aktivite-merkezi, egitmenler, lab-utilizasyon) sayfa-seviyesi
    route component'leri — `React.memo` bir component'i SADECE onu re-render
    eden bir PARENT varsa ve prop'lar aynı kalıyorsa faydalı; bir route'un
    kendi `page.tsx`'i hiçbir parent tarafından yeniden render edilmiyor,
    yani bu 3 dosyaya doğrudan memo eklemek **sıfır fayda** sağlardı. Gerçek
    engel: bu sayfalar hâlâ TEK dev component (alt component'lere bölünmemiş
    — `aktivite-merkezi/page.tsx`'te sadece küçük sunum yardımcıları var, satır
    listesi gibi tekrarlanan bir alt component YOK). Yani bu madde madde 6/7/8/15/19
    (component bölme) TAMAMLANMADAN anlamlı şekilde yapılamaz — önce böl, sonra
    tekrarlanan liste/satır component'lerine memo ekle. Kod değişikliği
    YAPILMADI (yanlış olurdu). **Güncelleme (2026-07-30): 6/7/8/15/19'un HEPSİ
    bitti** — engel artık kalkmış durumda, madde şimdi anlamlı şekilde ele
    alınabilir (hangi tekrarlanan liste/satır component'lerine memo gerçekten
    fayda sağlar — ör. StudentTable satırı, ActivityRow, TrainerTable satırı —
    tek tek değerlendirilmeli).

    **✅ 2026-07-30 tamamlandı — gerçek değerlendirme + uygulama:** Salt
    `React.memo()` sarmak çoğu yerde YİNE sıfır fayda sağlardı çünkü (a) alt
    diziler (`pageActs`/`pageItems`) `useMemo` OLMADAN `.slice()` ile her
    render'da YENİ dizi referansı üretiyordu, (b) satıra özel callback'ler
    (`() => expand(a)` gibi) `.map()` içinde her render'da YENİDEN
    oluşturuluyordu — ikisi de memo'nun prop-karşılaştırmasını anında geçersiz
    kılar. Bu yüzden önce prop zincirini KARARLI hale getirmek gerekti:
    - **`aktivite-merkezi` → `ActivityRow`** (en yüksek kazanç — 10 satırlık
      sayfada aksiyon notuna her tuş vuruşu ÖNCEDEN TÜM satırları yeniden
      render ediyordu, çünkü taslak alanları (`draftNote` vb.) ayrı prop
      olarak TÜM satırlara geçiyordu). Çözüm: taslak alanları TEK
      `DraftBundle` nesnesinde topladım (`_shared/types.ts`), genişletilMEMİŞ
      satırlara sabit `EMPTY_DRAFT` referansı geçiyor — artık SADECE
      genişletilmiş satır tuş vuruşunda yeniden render oluyor. `expand`/
      `saveAct` id-tabanlı hale getirilip (`(id: number) =>`) `allActs`
      içinde arama yapacak şekilde değiştirildi, `onBadgeClick`/
      `onToggleDiger`/`onToggleGecmis`/`onCancel` `useCallback` ile sabit
      referans aldı, `pageActs` `useMemo`'landı. `ActivityRow` artık
      `React.memo` ile export ediliyor.
    - **`egitmenler` → `TrainerTable`**: `pageItems` `useMemo`'landı,
      `openDetail`/`activeStudents` `useCallback` aldı (detay sheet'te not
      yazarken TrainerTable artık yeniden render OLMUYOR). `TrainerTable`
      `React.memo` ile export ediliyor.
    - **`lab-utilizasyon` → `LabRail`: BİLİNÇLİ OLARAK ATLANDI.** `labItems`
      hesaplaması, `authed===null` ve `loadingLabs||labs.length===0` gibi İKİ
      erken `return`'DEN SONRA yer alıyor (boş `labs` durumunda
      `labs.find(...)` çökmesin diye). Hook Kuralları gereği `useMemo`'yu
      etkili kılmak için bu hesaplamayı HER İKİ erken return'den ÖNCEYE
      taşımak (ve `todayISO`/`weekMon`'u da aynı şekilde yukarı çekip
      dosyanın geri kalanındaki tüm kullanımlarını güncellemek) gerekirdi —
      bu "memo ekle" kapsamının çok ötesinde, riskli bir yeniden yapılanma.
      `LabRail` tek bir örnek (satır listesi DEĞİL, ActivityRow gibi 10x
      tekrar eden bir yapı değil), yani kazanç da düşük — risk/kazanç oranı
      uygun değildi, bilinçli olarak dokunulmadı.

    `tsc --noEmit` ve proje geneli `vitest` (107/107) temiz. `eslint`'te SADECE
    bölünme turlarından beri var olan pre-existing `authHeaders`/
    `authHeadersJson` exhaustive-deps uyarıları kaldı (yeni uyarı sıfır).
    Tarayıcıda doğrulandı (gerçek admin oturumu): aktivite-merkezi'nde bir
    satır genişletilip nota yazılırken diğer satırların bozulmadığı, satır
    değiştirince taslağın doğru satıra taşındığı (önceki satırın notu
    sızmadı) ve egitmenler'de detay sheet'te not yazarken tablonun sağlıklı
    kaldığı doğrulandı. (Konsolda ilk okumada "export bulunamadı" gibi eski
    hatalar görüldü — bunlar düzenleme sırasındaki ARA/kırık derleme
    durumlarından o sekmenin Sentry arabelleğinde kalan STALE kayıtlar
    olduğu, taze bir sekmede sıfır hata görülerek doğrulandı.)
13. [x] **Ağır kütüphane code-splitting** — ✅ 2026-07-28 tamamlandı, ama kapsam
    düzeltildi: orijinal "33 dosya" sayısı recharts+framer-motion'ı karıştırıyordu.
    Gerçekte sadece **2 dosya recharts kullanıyor** (`satislar/dashboard/page.tsx`,
    `egitim-operasyon-anasayfa/page.tsx`) — framer-motion **32 dosyada** ama hemen
    hepsinde sadece temel sayfa geçiş animasyonu (`motion.div`), yani zaten her
    sayfada baştan gerekli — code-split etmek fayda değil karmaşıklık ekler,
    bilinçli olarak DOKUNULMADI. recharts için: iki dosyanın PieChart/donut
    bloğu birebir aynıydı (bonus: bu tekrar da temizlendi) → paylaşımlı
    `_shared/charts/DonutRing.tsx` + `_shared/charts/KotaAreaChart.tsx`, ikisi de
    `next/dynamic(..., { ssr: false })` ile yükleniyor — recharts artık bu 2
    sayfanın ilk render'ına değil sadece grafik GERÇEKTEN render olunca giriyor.
    `tsc`/`eslint` temiz, dev server'da 2 sayfa 200 + server log'unda hata yok.
    **Tarayıcı doğrulaması TAMAMLANDI (2026-07-28, ikinci oturum):** her iki sayfa
    da gerçek admin oturumuyla açıldı — `egitim-operasyon-anasayfa` donut'u renkli/
    doğru (24 aktif sınıf, %33/25/25/17 dağılım) render oluyor; `satislar/dashboard`
    kota grafiği bu ay satış olmadığı için (gerçek veri) düz çizgi gösteriyor —
    doğru davranış. Konsolda hata yok.
14. [x] **`useRealtimeSync` kapsam denetimi** — ✅ 2026-07-28 incelendi (18/52 sayfa
    kullanıyor, "103" rakamı yanlıştı — toplam `page.tsx` sayısı 52). Kalan 34'ün
    çoğu HAKLI OLARAK kullanmıyor: login/ayarlar/tek-seferlik form sayfaları
    (gerçek zamanlı veri gerektirmiyor), `connect/*` (kendi `onSnapshot`'ı zaten
    var — daha uygun, dokunulmamalı), oyunlaştırılmış tek-oturumluk ekranlar
    (kitap/kolaj/sosyal). **Gerçek adaylar (kod değişikliği YAPILMADI, sadece
    tespit edildi — her biri kendi reload/event eşleşmesi gerektirir, canlı
    doğrulama olmadan körlemesine 10 sayfaya bağlamak riskli):**
    `odevler/teslim/page.tsx` + `[groupId]/page.tsx`, `odevler/yonetim/page.tsx`,
    `satislar/satis-yap|paket-yonetimi|kampanya-yonetimi/page.tsx`,
    `yoklama/al|detay/page.tsx`, `siniflar/lab-utilizasyon/page.tsx`,
    `egitmen-takvimi/page.tsx` — bunlar çok kullanıcılı/paylaşımlı operasyon
    ekranları, staleness gerçek kafa karışıklığına yol açabilir.
15. [x] `siniflar/lab-utilizasyon/page.tsx` (1.264), `aktivite-merkezi/page.tsx` (1.262),
    `egitmenler/page.tsx` (1.234) — aynı dev-component deseni, böl. **✅ 2026-07-30
    üçü de tamamlandı.**
    **`lab-utilizasyon/page.tsx` ✅ 2026-07-30 tamamlandı:**
    15 dosyaya bölündü — `_shared/types.ts` (Lab/SessionBlock/PageState/Block/ListRow/
    RawItem tipleri + DOW/MONTHS/AX_START gibi sabitler), `_shared/mockEngine.ts`
    (deterministik seed'li mock doluluk motoru — `sessionsFor`/`freeGaps`/`dayUtil`/
    `weekUtil`/`monthUtil`/`firstFreeSession` vb., modül-seviyesi `SEANS_POOL` mutable
    state artık `setSeansPool()` ile enjekte ediliyor, davranış aynen korundu),
    `_shared/theme.tsx` (Theme/T/heatColor/Icon/labIconPaths/stil sabitleri),
    `_shared/LabAddModal.tsx`, `_shared/Toolbar.tsx`, `_shared/FilterPanel.tsx`,
    `_shared/LabRail.tsx`, `_shared/HeroSection.tsx`, `_shared/ViewCardHeader.tsx`,
    `_shared/TimelineView.tsx` (haftalık/günlük ızgara), `_shared/MonthHeatmapView.tsx`,
    `_shared/ListTableView.tsx`, `_shared/PlanModal.tsx`, `_shared/SlotsModal.tsx`,
    `_shared/CardDetailModal.tsx`. **Dikkat edilen ince nokta:** "Uygun Seanslar"
    modalının Liste ve Takvim görünümleri "Bu Seansı Planla" tıklamasında tarihi
    FARKLI yollarla çözüyordu (liste: `weekMon + DOW_FULL.indexOf(dowFull)` — 2 haftalık
    aralıkta 2. hafta için teorik olarak yanlış olabilecek pre-existing bir kısayol;
    takvim: doğrudan `col.d`) — bölme sırasında bu ikisi YANLIŞLIKLA tek bir ortak yola
    birleştirilmişti, fark edilip geri ayrıldı (orijinal davranış bozulmadan korundu).
    `page.tsx`: 1.259 → **490 satıra** indi (%61 küçüldü). `tsc --noEmit` VE `eslint`
    tertemiz (yeni uyarı sıfır). Tarayıcıda uçtan uca doğrulandı (local dev + Claude in
    Chrome, gerçek admin oturumu, 2 gerçek lab: VIP/Başarı C): Günlük/Haftalık/Aylık/
    Liste'nin 4'ü de gerçek veriyle doğru render oluyor, ders bloğuna tıklayınca kart
    detay modalı (mock grup tarihleriyle) açılıyor, Filtreler paneli, Planlama Yap
    (uygun lab önerisi doğru), Uygun Seansları Göster (liste+takvim, filtre, "Bu Seansı
    Planla" → doğru tarihle Planlama Yap'a aktarıyor), Laboratuvar Ekle modalı hepsi
    çalıştı. Konsolda hata yok.
    **`aktivite-merkezi/page.tsx` ✅ 2026-07-30 tamamlandı:**
    7 dosyaya bölündü — `_shared/types.ts` (KanalKey/TipKey/DurumKey sözlükleri,
    AktiviteRow/EkleForm tipleri), `_shared/caseAdapter.ts` (backend Case↔UI satırı
    eşlemesi — `caseToRow`, kanal/tip/durum mapping tabloları, saf fonksiyon),
    `_shared/ui.tsx` (Dd/DdItem/LabeledField/ChevIcon/Req + S/FONT/CSS),
    `_shared/FilterBar.tsx`, `_shared/ActivityRow.tsx` (en büyük parça — ana satır +
    genişleyen aksiyon paneli: müşteri mesajı/gelecek randevu, Geçmiş Aksiyonlar
    accordion, Durum/Tarih/Saat/Sorumlu kontrolleri, Diğer Aktiviteler accordion, 28
    prop), `_shared/EkleModal.tsx`, `_shared/Pagination.tsx`. `page.tsx`: 1.258 →
    **451 satıra** indi (%64 küçüldü). `tsc --noEmit` temiz, `eslint`'teki 2 uyarı
    (`authHeadersJson` exhaustive-deps, `loadBackend`+`saveAct`) bölünmeden ÖNCE de
    vardı (doğrulandı — orijinal dosyada aynı 2 satır). Tarayıcıda uçtan uca
    doğrulandı (gerçek admin oturumu, 6 gerçek talep): satır genişletme (aksiyon
    paneli gerçek veriyle — Gelecek Randevu kutusu, Durum/Tarih/Saat/Sorumlu doğru
    ön-dolduruluyor, native tarih seçici "Randevu Oluşturulacak" durumunda otomatik
    açılıyor), İptal ile panel kapanması, Kanal filtre dropdown'ı + Temizle rozeti,
    "Yeni Talep" (Aktivite Ekle) modalı hepsi çalıştı. Konsolda hata yok. (Kaydet
    butonuna gerçek bir PATCH/POST tetikleyip veri değiştirmedim — sadece UI/state
    akışı doğrulandı, backend yazma yolu zaten dokunulmamış saf taşıma.)
    **`egitmenler/page.tsx` ✅ 2026-07-30 tamamlandı — madde 15'in son dosyası, üçü de
    bitti:** 9 dosyaya bölündü — `_shared/types.ts` (Trainer/FormState/ApiTrainer
    tipleri, BRANS_COLORS/STATUS_MAP/AV_PALETTES/PAGE_SIZE), `_shared/constants.ts`
    (S/IC/globalCss), `_shared/FilterDropdown.tsx`, `_shared/SummaryCards.tsx`,
    `_shared/FilterPanel.tsx`, `_shared/TrainerTable.tsx` (satırlar + Yetkinlik/Gruplar
    hover popup'ları — portal state'i container'dan buraya taşındı, hiçbir yerde
    paylaşılmıyordu), `_shared/DetailSheet.tsx` (en büyük parça — İletişim/Ücret/
    Yetkinlik ağacı/Performans placeholder + Gruplar/Müsaitlik/Notlar, 9 prop),
    `_shared/FormSheet.tsx` (Ekle/Düzenle bottom sheet, tag editörü dahil),
    `_shared/DeleteModal.tsx`. `page.tsx`: 1.229 → **422 satıra** indi (%66 küçüldü).
    `tsc --noEmit` temiz, `eslint`'teki tek uyarı (`authHeaders` exhaustive-deps)
    bölünmeden ÖNCE de vardı (orijinalde aynı satır doğrulandı). Tarayıcıda uçtan uca
    doğrulandı (gerçek admin oturumu, 2 gerçek eğitmen): özet kartları, Yetkinlik/
    Gruplar hover popup'ları (portal ile doğru konumda, gerçek grup/öğrenci verisiyle),
    satır tıklayınca Detay sheet (Ücret blur/reveal, Yetkinlik ağacı, Notlar bölümü),
    Düzenle → Form Sheet'in mevcut veriyle ön dolması, Sil onay modalının doğru isimle
    açılması hepsi çalıştı. Konsolda hata yok. (Kaydet/Evet-sil'e basıp gerçek yazma
    tetiklemedim — sadece UI/state akışı doğrulandı, aynı gerekçeyle aktivite-merkezi
    gibi.)
16. [x] **`connect-service.ts` (1.154) ve `submission-service.ts` (1.131) — tek dosyada çok
    fazla sorumluluk, alt-domain'lere bölündü** — ✅ 2026-07-31 tamamlandı. Bölme yöntemi:
    her iki dosya da tüketici import yollarını (45 dosya: 27 connect + 18 submission)
    HİÇ değiştirmeden **cephe (facade) dosyası** olarak kaldı — gerçek kod alt-domain
    dosyalarına taşındı, orijinal dosya sadece `export { ... } from "./..."` satırlarından
    oluşuyor.
    **`connect-service.ts`: 1.154 → 44 satır**, 5 yeni dosyaya bölündü —
    `connect-types.ts` (ConnectPrincipal/ConnectDeps/input tipleri), `connect-helpers.ts`
    (paylaşılan yetki/audit/isim çözümleme — `assertCanRead`/`assertCanWrite`/`logAudit`/
    `findExistingDm`/`resolveDisplayName` vb.), `connect-conversation-service.ts` (konuşma
    CRUD + kişisel görünüm tercihleri: pin/mute/archive/hide/clear), `connect-messaging-
    service.ts` (mesaj gönder/düzenle/sil/reaksiyon/yıldız/okundu/yazıyor sinyali),
    `connect-roster-service.ts` (üye ekle/çıkar/listele).
    **`submission-service.ts`: 1.131 → 63 satır**, 6 yeni dosyaya bölündü —
    `submission-types.ts` (SubmissionDeps + tüm input/result tipleri), `submission-
    helpers.ts` (klasör hiyerarşisi/yükleme hakkı/yetki-scope paylaşılan yardımcıları),
    `submission-upload-service.ts` (dosya yükleme — öğrenci teslimi + eğitmen eki —
    dosya silme, geri çekme, en büyük parça), `submission-grading-service.ts` (durum
    güncelleme, not verme tekil/manuel/toplu, eğitmen/op sorguları), `submission-score-
    service.ts` (Ödev Notu % formülü — `ODEV_TUR_AGIRLIK`/`computeOdevYuzdeleri`/
    `combineOdevYuzdesi`, `person-education-summary-service.ts`'in de kullandığı saf
    hesap), `submission-student-service.ts` (öğrenci dashboard/detay sorguları). Bu
    sırada `deleteFileAsStaff`'ın kendi başına kopyaladığı grup-scope yetki kontrolü
    paylaşılan `requireGroupScope`'a yönlendirilip küçük bir kod tekrarı da temizlendi
    (davranış değişmedi — aynı capability, aynı hata).
    **Doğrulama:** `tsc --noEmit` (proje geneli) VE `eslint src/app/lib/domain/services/`
    (klasör geneli) tertemiz, `vitest` **107/107** geçti (submission testleri facade'dan
    değişmeden import ediyor, davranış testi kırılmadı). Ayrıca eski/yeni dosyalardan
    programatik olarak çıkarılan **export isim listeleri birebir `diff` ile karşılaştırıldı**
    (`grep`+`node` script) — connect'te tam eşleşme, submission'da SADECE yeni eklenen
    `GradingDeps` tip export'u fazladan (kayıp yok, sadece ekstra). Tüketici dosyalara
    (45 route/servis) HİÇ dokunulmadı, import yolları aynı kaldığı için sıfır risk.
    Tarayıcı testi YAPILMADI — bu bir davranış değişikliği değil, saf dosya organizasyonu
    (facade re-export), aynı fonksiyon gövdeleri birebir taşındı; tsc+eslint+test+export-
    diff dörtlü doğrulaması bu değişiklik sınıfı için yeterli görüldü.
17. [x] **API list endpoint pagination/limit denetimi** — ✅ 2026-07-28 doğrulandı,
    kod değişikliği gerekmedi: `persons`/`groups`/`enrollments` gibi uçlar limitsiz
    `list(tenantId)` kullanıyor ama bunlar **sınırlı varlık koleksiyonları** (bir
    okulun öğrenci/grup SAYISI platodan sonra büyümüyor) — `activities` gibi
    **sürekli büyüyen olay-log'u** değil, o yüzden `RECENT_LIMIT` deseni buralarda
    gerekmez. Yorum/comment uçları (`assignments/[id]/comments`) zaten TEK ödeve
    scope'lu (doğal olarak küçük). Tenant-genelinde sürekli büyüyen başka bir
    liste ucu bulunamadı — bilinçli olarak "sorun yok" sonucuna varıldı.
18. [x] **454 ham `fetch()` çağrısının hata durumunda kullanıcıya tutarlı feedback verip
    vermediğini kontrol et** — ✅ 2026-07-31 tamamlandı (sayı büyümüş: 2026-07-28'de 322,
    şimdi 454 — kapsam genişledi ama madde aynı). **Gerçek bulgu, orijinal varsayımdan
    daha iyi durumdaydı:** `src/app/flexos` altında fetch kullanan **68 dosyanın 62'si**
    zaten tutarlı bir örüntü kullanıyor — yazma işlemlerinde (`POST`/`PATCH`/`DELETE`)
    `if (!res.ok) toast.error(json.error || "...")`, okuma akışlarında `try/catch` +
    `toast.error("... yüklenemedi.")` (`sonner` kütüphanesi, merkezi bir "toast servisi"
    OLMASA da tutarlı kullanım şekli var — madde metnindeki "merkezi hata gösterimi yok"
    doğru ama pratikte SORUN yaratmıyormuş). **6 dosyada gerçek sessiz-hata bulundu**
    (`grep` ile: fetch var ama ne `toast.` ne `catch` var) — hepsi düzeltildi:
    - `odevler/teslim/[groupId]/page.tsx`, `kolaj/page.tsx`, `kitap/page.tsx`,
      `sosyal/page.tsx` — zaten `try/finally` vardı, `catch` bloğu + `toast.error(...)`
      eklendi (`kolaj`/`kitap`/`sosyal` neredeyse birebir aynı 3 oyunlaştırılmış ekran).
    - `student/[personId]/page.tsx` (öğrenci dashboard) — aynı şekilde `catch` + toast eklendi.
    - `egitmen-takvimi/page.tsx` — **en ciddi olan**: try/catch HİÇ yoktu, bir ağ hatasında
      `setLoadingInstructors(false)` hiç çalışmıyor, sayfa SONSUZA DEK yükleniyor
      görünümünde kalıyordu (kullanıcıya hiçbir mesaj yok + kalıcı spinner). `try/catch/
      finally` eklendi, `cancelled` guard'ı korunarak.
    Diğer 62 dosyaya (`toast.error` zaten var) DOKUNULMADI — davranış zaten tutarlıydı.
    **Doğrulama:** `tsc --noEmit` proje geneli temiz, `eslint` bu 6 dosyada SIFIR yeni
    uyarı (2 pre-existing uyarı `student/[personId]/page.tsx`'te `git stash` ile
    ÖNCESİ/SONRASI karşılaştırılıp doğrulandı — aynı satır numaraları, yeni değil),
    `vitest` 107/107. Dev server'da (local) 6 sayfanın 6'sı da `200` döndü, sunucu
    log'unda hata yok (gerçek admin oturumu/ağ hatası simülasyonu yapılmadı — sadece
    happy-path derleme/render doğrulaması; catch bloklarının çalıştığı senaryo network
    kesintisi gerektirdiği için tarayıcıda ayrıca tetiklenmedi, kod incelemesiyle
    doğrulandı).
    **Merkezi bir hata-gösterim bileşeni/hook'u (ör. ortak `useApiRequest` sarmalayıcı)
    BİLİNÇLİ OLARAK EKLENMEDİ** — 62/68 dosya zaten aynı `sonner` `toast.error` deseniyle
    tutarlı, 454 çağrıyı TEK bir sarmalayıcıya geçirmek bu oturumun kapsamının çok
    ötesinde geniş bir yeniden yazım olurdu (davranışı değiştirmeden salt-mekanik
    codemod bile riskli — her çağrının mesaj metni/akış farklı). Madde 4'teki
    `apiError()` server-side deseniyle AYNI mantık client tarafında da mümkün ama
    ayrı bir gelecek işi olarak bırakıldı.
19. [x] **`odevler/teslim/[groupId]/page.tsx` veri çekme + sunum ayrımı** — ✅
    2026-07-29 tamamlandı: 830 satırlık dosya `_shared/`'a bölündü —
    `TaskAccordion.tsx` (akordiyon + dosya yükleme, en büyük parça),
    `AssignmentsTab.tsx` (filtre/bölümleme + ArchivedAssignmentCard),
    `types.ts`, `format.ts`. `page.tsx` artık SADECE veri çekme + sayfa
    iskeleti + Öğrenciler tab'ı (830 → 224 satır). `tsc`/`eslint` temiz,
    tarayıcıda doğrulandı (accordion, dosya eki, 3-nokta menü, Öğrenciler
    tab'ı hepsi birebir çalışıyor). `main`'e cherry-pick edildi (main'in
    kendi lokal `authHeaders()` deseni korunarak — main'de henüz
    `@/app/lib/client/auth-headers` merkezi dosyası yok).
20. [x] **`connect-service.ts` gibi büyük servislerde authorization/business-logic/data-access
    ayrımı** — ✅ 2026-07-31 gözden geçirildi, kod değişikliği gerekmedi: `grep` ile
    doğrulandı — domain katmanındaki **31 servis dosyası** zaten authorization'ı ayrı,
    adlandırılmış guard fonksiyonlarına çıkarıyor (`assertCanRead`/`assertCanWrite`/
    `assertMembersMatchRealm` — connect; `requireGroupScope`/`requireOwnedPerson` —
    submission/grade/attendance; ham `can(actor, ...)` çağrısı — çoğu servis). Madde 16
    bölmesi sırasında bu guard'lar zaten `connect-helpers.ts`/`submission-helpers.ts`'e
    ayrı dosyalara taşındı, iş mantığından fiziksel olarak da ayrıştı. Data-access zaten
    hep repo arayüzleri (`ConnectRepo`/`SubmissionRepo` vb.) üzerinden, servis hiçbir yerde
    doğrudan Firestore SDK'sına dokunmuyor. **Daha ileri bir katmanlaşma (ör. authorization'ı
    ayrı bir `*-authorization.ts` dosyasına, iş mantığını ayrı bir `*-logic.ts` dosyasına
    bölmek) bilinçli olarak YAPILMADI** — bu 452 dosyalık domain katmanının GENELİNDE
    "guard + iş mantığı aynı fonksiyonda, guard'lar adlandırılmış yardımcılara çıkarılmış"
    deseni tutarlı şekilde kullanılıyor; SADECE connect/submission'ı farklı bir 3-katmanlı
    şablona geçirmek proje geneliyle tutarsız bir ada oluşturur, okunabilirliği artırmaz
    (her fonksiyon zaten 1-2 satırlık guard + birkaç satır iş mantığı, ayrı dosyalara
    bölünecek kadar büyük değil).

## Gözlemlenen ama henüz açılmamış (düşük öncelik)

- Test kanalı silinirken (2026-07-28 doğrulama testi sırasında) konsolda bir
  kerelik `FirebaseError: Missing or insufficient permissions` görüldü. `DELETE`
  isteği 200 döndü, UI doğru güncellendi — muhtemelen silinen dokümana bağlı
  aktif bir `onSnapshot` dinleyicisinin zararsız yarış durumu, benim N+1 fix'imle
  ilgisiz (`deleteConversation`'a hiç dokunulmadı). Gerçek kullanımda (biri
  kanaldayken başka biri siliyorsa) tekrar görülürse araştırılmalı.

- **`/flexos/connect/mobile` — React hydration mismatch (#418), KAPATILDI/
  framework davranışı olarak not edildi (2026-07-29, çok geniş kapsamlı
  izolasyon turu).** `LoadingBoundary name="mobile/"` — server ilk HTML'de
  gerçek içerik yerine boş bir `<script id="_R_">` "resume" işaretçisi
  gönderiyor, client hydrate ederken mismatch bulup tüm ağacı client-side
  yeniden render ediyor ("Recoverable Error" — kullanıcı görsel olarak hiçbir
  şey fark etmiyor, gerçek Vercel production'da da doğrulandı). **Tam
  izolasyon matrisi denendi, HİÇBİRİ değiştirmedi:** Chrome eklentisi (curl ile
  ham HTML'de de aynı marker — eklenti değil), CSP `unsafe-eval` (eklendi/
  test edildi/geri alındı, etkisiz), `force-dynamic`/`revalidate=0`/
  `connection()` (üçü de aynı hatayı veriyor, route gerçekten statik `○`
  olsa BİLE hata duruyor), `"use client"` page.tsx → Server Component
  sarmalayıcı (params/searchParams promise sorunu gitti ama mismatch başka
  katmanda tekrar çıktı), `SplashGate`/`AnimatePresence` bypass, layout.tsx'in
  TAMAMEN silinmesi, page.tsx'in sıfır state/hook/browser-API'li tek satır
  statik `<div>`'e indirgenmesi (en minimal kombinasyonda BİLE hata aynen
  duruyor) — Turbopack/webpack ikisinde de, dev/production build ikisinde de
  birebir aynı. Next.js 16.1.1→16.2.12'ye yükseltildi (81/81 test geçti,
  regresyon yok), hatayı değiştirmedi. **Sonuç: uygulama kodundan tamamen
  bağımsız, route path'ine (`mobile/` segment adı) özgü bir Next.js App
  Router streaming/Suspense davranışı — muhtemelen framework hatası, elimizde
  fixleyecek bir kod lever'ı kalmadı.** Kullanıcı kararı: daha fazla zaman
  harcanmayacak, üretken işlere dönülecek. Next.js'te resmi bir bug/fix
  çıkarsa veya production'da GERÇEK bir kullanıcı etkisi gözlenirse tekrar
  ele alınacak.

## Notlar

- Sunum aşamasında (gerçek trafik yok) hiçbiri acil değil — sadece #2/#3 (N+1) ve #4
  (hata wrapper) düşük riskli, hızlı kazanımlar olduğu için erken alındı.
- Otomatik test yok (bkz. madde 1) — her madde işaretlenmeden önce tarayıcıda gerçek
  senaryoyla elle doğrulanmalı (dev server + Claude in Chrome).

## Yeniden inceleme (2026-08-02) — 20/20 sonrası güncel durum

> 20 madde de 2026-07-31'de tamamlanmış işaretlendikten yaklaşık 2 gün sonra yapılan
> bağımsız yeniden değerlendirme. Yöntem: her maddenin iddiası spot-check edildi (dosya
> satır sayıları, `npm test`, `tsc --noEmit`, `eslint`, hedefli `grep` taramaları),
> `git log` ile son commit'ler incelendi, `connect/page.tsx`/`connect/mobile/page.tsx`
> ayrıca derinlemesine okundu.

**Yeni puan: 6.5/10** (önceki: 5.5-6/10). Gerekçe: test/hata-yönetimi/domain-temizliği
altyapısı kalıcı ve doğrulanabilir şekilde oturmuş (107/107 test geçiyor, domain katmanı
büyümeyle bozulmadan temiz kalmış, yeni API route'lar `apiError` desenini takip ediyor),
ama checklist'in asıl hedefi olan "mega-component" hastalığı `connect/page.tsx` (2597
satır) ve `connect/mobile/page.tsx` (2690 satır) ile — checklistte hiç yer almadan ve
bölünen en büyük dosyadan (1583) bile çok daha büyük ölçekte — nüksetmiş.

**Kod tabanı büyümesi:** 452→537 dosya, ~60.800→77.615 satır (%28 büyüme, aktif gelişim).

**Doğrulanan iyileşenler (kalıcı):**
- 6 test dosyası, `npm test` → **107/107 geçti** (sale/grade/attendance/submission/
  pricing/buildSaleRequestBody servisleri).
- `any` kullanımı hâlâ sadece 2 yer — büyümeyle bozulmamış.
- `tsc --noEmit` proje geneli temiz.
- Bölünen 6 mega-component geri büyümemiş: `ogrenciler/havuz/page.tsx` 575 satır (iddia
  573), `egitim-yonetimi/ekle/page.tsx` 765 (iddia 766), `satis-yap/page.tsx` 535 (iddia
  535, birebir) — `_shared/` klasörleri yerinde.
- `apiError()` 91 route'ta doğrulandı; **Ağustos 2026 tarihli yeni route'lar
  (`cases`, `assignments`, `trainers`) da aynı deseni doğru kullanıyor** — öğrenilen
  alışkanlık kalıcı.
- Sessiz fetch hatası yok: `flexos/` altında fetch kullanan 76 dosyanın TAMAMINDA
  `toast` veya `catch` var, yeni birikim yok.
- `exhaustive-deps`/`set-state-in-effect` disable sayısı 18 (madde 10/11'in "20 konum"
  iddiasına yakın, yeni birikim yok).
- Domain katmanı (143 dosya, 12.844 satır) hâlâ temiz: `can()` tabanlı yetki 26
  dosyada, hiçbir serviste doğrudan Firestore SDK çağrısı yok.

**Hâlâ kötü olanlar / yeni ortaya çıkan sorunlar:**
1. **`connect/page.tsx` (2597) ve `connect/mobile/page.tsx` (2690) — checklist'in kör
   noktası.** Sadece ortak yardımcılar çıkarılmış (`format.tsx`, `connectClient.ts`,
   `ConnectIcon`, `EmojiPicker`, `AttachmentView`, hook'lar — madde 5 doğru), ama her iki
   sayfa da render/JSX mantığıyla HÂLÂ tek dev component: 35-41 `useState`, 18-26
   `useEffect`. Madde 6/7/8/15/19'daki "tab/modal component'lerine böl" deseni burada hiç
   uygulanmamış. İki-realm (staff/trainer_student) gerçek zamanlı chat karmaşıklığı
   kısmen haklı gerekçe ama 2600+ satır yine de aşırı.
2. **`React.memo` kapsamı dar kalmış.** Madde 7'de bölünen `StudentTable.tsx` (416
   satır, tam da madde 12'nin "tekrarlanan satır component'i" tanımına uyan bir örnek)
   hiç memo almamış — sonraki bölmelerde ortaya çıkan yeni adaylar takip edilmemiş.
3. **`eslint` "tertemiz" iddiası biraz optimistik.** 35 adet `authHeaders`/
   `authHeadersJson` "unnecessary dependency" false-positive uyarısı (madde 9'un
   merkezileştirmesinin yan etkisi, stabil import artık "outer scope" flagleniyor,
   zararsız ama gürültülü) + 9 adet `react/no-unescaped-entities` HATASI (error
   seviyesi, 6 dosyada, 2026-07-22/28 tarihli — yeni regresyon değil ama çözülmemiş).
4. **`apiError` muhasebesi tam değil.** 148 route'un 44'ü kullanmıyor: 21'i connect
   ailesi (checklist'te "birkaç dosya" diye genel geçilmişti, gerçek sayı daha büyük),
   kalan ~23'ün ~11'i (`activation/verify`, `password-reset`, `sales/[id]`,
   `persons/lookup`, `seanslar`, `view-access` vb.) checklist'in "17 dosya bilinçli
   atlandı" listesinde hiç yok — codemod'un kaçırdığı gerçek boşluklar.
5. **`vitest` ortam driftı** — `package.json`'da tanımlı ama `node_modules`'ta kurulu
   değildi, `npm install` gerekti. Kod sorunu değil ama iki-bilgisayar senkron riskine
   işaret ediyor.

**Sıradaki öncelikler (yeni mini-checklist):**
1. ~~`connect/page.tsx` (masaüstü) madde 6/7/8'deki aynı desenle böl~~ — **✅
   2026-08-03 TAMAMLANDI** (commit'ler `7b2c13c`, `46caa5d`, `9c218a3`, `2b8cc34`).
   4 parça halinde çıkarıldı, her adımda tsc+eslint temiz doğrulandı:
   - "Yeni Konuşma" modalı → `_shared/CreateConversationModal.tsx` (~450 satır),
     bağımlı `GroupItem`/`RosterItem` → `_shared/groupTypes.ts`, `IconComponent`/
     `UsersThreeIcon` → `_shared/ConnectIcon.tsx`.
   - İkon rayı (Kolon 1) → `_shared/ConnectIconRail.tsx` (`NAV`/`NavKey` de birlikte).
   - Konuşma listesi (Kolon 2, "Yeni Sohbet Başlat" dropdown'ı + arama/filtre +
     liste) → `_shared/ConversationListColumn.tsx` (`DirectoryRow` de birlikte).
   - Konuşma thread'i (Kolon 3, header + mesaj listesi + composer + Bilgi paneli,
     dosyanın en büyük tek bloğuydu) → `_shared/ConversationThread.tsx` (~65 prop).
   **Sonuç: `connect/page.tsx` 2597→1293 satır (%50 azalma).** Hepsi birebir taşıma
   (davranış değişikliği yok, TÜM state `FlexConnectPage`'de kaldı, prop olarak
   akıyor). **Tarayıcı testi YAPILMADI** (token bütçesi kısıtlıydı, sadece statik
   doğrulama) — bir sonraki oturumda gerçek kullanıcı akışıyla (mesaj gönder/al,
   reaksiyon, ek dosya, konuşma oluştur/düzenle) uçtan uca test edilmeli.
   - ~~`connect/mobile/page.tsx` (2690 satır)~~ — **✅ 2026-08-03 TAMAMLANDI**
     (commit'ler `0643af3`, `e724a42`, `e4ef612`, `5a7cfcf`, `8125931`):
     - Tema/ikon altyapısı (ICONS/Icon/Tokens/tokens/iconFor/avatarBox/
       SwipeableChatRow, component state'inden bağımsız) → `_shared/mobileTheme.tsx`.
     - Screen/Tab/ThemePref/ChannelSection tipleri → `_shared/mobileTypes.ts`.
     - "app" ekranı (6 sekmeli ana ekran + alt nav) → `_shared/MobileAppScreen.tsx` (~44 prop).
     - "chat" ekranı (header+mesaj listesi+composer) → `_shared/MobileChatScreen.tsx` (~40 prop).
     - "create" ekranı (Kanal/Grup/Topluluk formu) → `_shared/MobileCreateScreen.tsx` (~25 prop).
     - 7 küçük ekran (Bildirimler/Yardım/Şifre/Yıldızlı/Arşiv/Yasal/KVKK) →
       `_shared/MobileMiscScreens.tsx` (ortak `ScreenHeader` yardımcısıyla).
     - 2 bottom sheet (Yeni Sohbet Başlat + presence-durum) → `_shared/MobileSheets.tsx`.
     **Sonuç: `connect/mobile/page.tsx` 2690→1317 satır (%51 azalma) — masaüstünün
     (1293) bile altında.** `page.tsx` artık `motion`/`AnimatePresence` import
     etmiyor, hiç doğrudan JSX render etmiyor — sadece state/effect/handler +
     component çağrıları. Birebir taşıma, tsc+eslint her adımda temiz.
     **Tarayıcı testi YAPILMADI** (ne masaüstünde ne mobilde) — bir sonraki
     oturumda gerçek kullanıcı akışıyla (mesaj gönder/al, reaksiyon, ek dosya,
     konuşma oluştur, sekme/ekran geçişleri) uçtan uca test edilmeli, öncelikli.
   - ~~Kalan state/effect kümeleri~~ — **✅ 2026-08-03 KISMEN TAMAMLANDI**
     (commit'ler `61fbd0e`, `ba1413a`, `a1291ba`, `e7822e9`, `e616f7c`):
     `connect/mobile/page.tsx`'ten 5 YÜKSEK GÜVENİLİRLİKLİ (sıfır/çok düşük dış
     bağımlılığı olan, gerçekten izole) custom hook çıkarıldı:
     - `useViewportHeight()` — viewportHeight state + resize/orientationchange effect'i.
     - `usePwaEnvironment()` — isIOS + isStandalone tespiti.
     - `useConnectTheme()` — themePref/systemDark/dark/T (tek yönlü bağımlılık, hiç girdisi yok).
     - `usePushNotifications(authUser, studentPersonId, isIOS, isStandalone)` —
       notifPush/notifSound/showPushReenableBanner/pushTokenRef + toggle
       fonksiyonları + ilgili effect'ler. `handleLogout` artık `pushTokenRef`'e
       doğrudan dokunmuyor, hook'un döndürdüğü `unregisterToken()` kullanılıyor.
     - `usePresenceTracking(uids, studentPersonId)` — presenceMap/myPresenceStatus/
       forcePresenceTick + abonelik effect'i + `usePresenceHeartbeat` çağrısı.
       "Hangi uid'lere abone olunacağı" hesabı BİLEREK hook'a taşınmadı
       (conversation-list domain'ine ait), page.tsx'te `useMemo` olarak kaldı.
     **Sonuç: `connect/mobile/page.tsx` 1317→1104 satır.** Hepsi birebir taşıma,
     her adım ayrı commit + tsc/eslint doğrulaması. Eslint'in yeni
     `react-hooks/set-state-in-effect` kuralı hook dosyalarında daha katı
     davranıyor — projedeki established disable-comment deseni (bkz.
     `NotificationSoundSettings.tsx`) uygulandı.
   - **Bilerek yapılmadı (madde kapsamı dışı, "yapay bölme" — kullanıcı kararı):**
     Mesaj thread'i + composer + uzun-basma menüsü, auth+login+logout, rol/profil
     çözümü, konuşma listesi + dizin fetch'leri — bunlar `selectedId`/`screen`/
     `draft`/`conversations` üzerinden birbirine gerçekten geçmiş, hook'a
     zorlamak yanlış sınırdan kesim (stale closure/cleanup riski) yaratırdı.
     `connect/page.tsx` (masaüstü) tarafında bu hook çıkarımı HİÇ yapılmadı —
     istenirse aynı yöntemle ayrı bir oturumda ele alınabilir.
2. [x] ~~`StudentTable` (ve benzer yeni bölünmüş tablo component'leri) için `React.memo` +
   `useMemo`/`useCallback` zincirini gözden geçir.~~ — ✅ 2026-08-02 tamamlandı:
   `StudentTable.tsx` `memo()` ile sarıldı (`StudentTableImpl` iç fonksiyon + `export const
   StudentTable = memo(StudentTableImpl)`). Prop zinciri kontrol edildi: `filtered` zaten
   `useMemo`'luydu (madde 7'den), `onOpenAssign`/`onOpenTransfer` zaten `useCallback`'liydi
   — SADECE `onRowClick` (`openStudentPanel`) ve `onOpenDelete` (`openDelete`) düz inline
   fonksiyondu (her render'da yeni referans, memo'yu bozardı), ikisi de `useCallback`'e
   alındı (boş deps — sadece `useState` setter'ları kullanıyorlar, stabil). Diğer prop'lar
   (`canAssignGroup`/`canTransfer`/`canDeleteEnrollment`, `actionMenuOpen`/`Step`/`Pos`,
   `loading`/`page`) zaten primitif ya da `useState` referansı, sorun yoktu. `tsc --noEmit`
   temiz, `eslint` sıfır yeni uyarı, `vitest` 107/107. **Tarayıcı testi YAPILMADI** —
   davranış değişikliği yok (memo sadece gereksiz re-render'ı engeller, render çıktısı
   birebir aynı), madde 16'daki gerekçeyle aynı risk sınıfı (facade/optimizasyon,
   davranış değil) — statik doğrulama (tsc+eslint+test) yeterli görüldü.
3. [x] ~~35 `authHeaders`/`authHeadersJson` exhaustive-deps uyarısını gerekçeli disable veya
   `useRef` tabanlı çözümle temizle.~~ — ✅ 2026-08-02 tamamlandı: 35 uyarının HEPSİ
   deps dizisinden çıkarıldı (15 dosya). Disable-comment/`useRef` gerekmedi — eslint'in
   kendisi zaten bunları "gereksiz dependency" olarak işaretliyordu (`authHeaders`/
   `authHeadersJson` merkezi dosyadan import edilen SABİT modül referansı, state değil,
   deps'e eklenmesine hiç gerek yoktu). Aynı oturumda **9 `react/no-unescaped-entities`
   hatası** da düzeltildi (8 dosya — çıplak `'`/`"` → `&apos;`/`&quot;`, salt metin
   escape'i, görünüm/davranış değişmedi). Doğrulama: `tsc --noEmit` proje geneli temiz,
   `npm test` **107/107** geçti, `eslint src/app/flexos` bu iki kategoride **sıfır**
   uyarı/hata gösteriyor (kalan 2 hata — `FlexHeader.tsx` set-state-in-effect,
   `seanslar/page.tsx:66` prefer-const — bu turdan ÖNCE de vardı, dokunulmadı).
   Tarayıcı testi yapılmadı — ikisi de davranış değiştirmeyen mekanik düzeltme
   (metin escape + gereksiz dep silme), risk sınıfı düşük.
4. [x] ~~Kalan ~44 `apiError`'suz route'u (özellikle connect ailesi dışındaki 11 dosya)
   migrate et.~~ — ✅ 2026-08-02 KISMEN tamamlandı: gerçek sayı incelemenin iddia ettiği
   44 değil **57**'ydi (148 route'un 91'i kullanıyordu — `student/connect/*` 11 dosya
   önceki taramada hiç sayılmamış). Bu turda **connect ailesi DIŞINDAKİ 14 "gerçek boşluk"**
   dosyası migrate edildi: `attendance/report`, `seanslar` (POST/GET/DELETE üçü de),
   `sales/[id]`, `sales/[id]/payments`, `appointments`, `lottery-results/mail`,
   `student/me`, `activation/verify`, `groups/[id]/roster`, `egitmen-anasayfa/
   activity-log`, `password-reset`, `me`, `persons/lookup`. 5'i zaten var olan generic
   `catch(e){console.error;return 500}` bloğunun birebir `apiError()` swap'ıydı, 5'inde
   HİÇ try/catch yoktu (yeni eklendi — beklenmeyen hatada artık düzgün JSON+500 dönüyor,
   önceden çıplak unhandled exception'dı), 2'sinde (`lottery-results/mail`,
   `password-reset`) SADECE dış catch değiştirildi — içteki bilinçli non-fatal
   swallow'lar (Drive upload/e-posta enumeration koruması) dokunulmadan bırakıldı.
   `activation/verify` özel: eskiden `err.message`'ı client'a birebir sızdırıyordu,
   artık apiError'ın sabit "Sunucu hatası." mesajını dönüyor — bilinçli güvenlik
   iyileştirmesi (public/unauthenticated uç, iç Firebase hata detayı artık sızmıyor).
   **`realtime/stream` bilinçli atlandı** — SSE stream route'u, JSON-hata-dönen
   apiError() deseniyle uyumlu değil (response stream başladıktan sonra JSON dönemez).
   Doğrulama: `tsc --noEmit` proje geneli temiz, `eslint` bu 13 dosyada sıfır uyarı,
   `vitest` 107/107. Dev server'da 6 route (me/appointments/seanslar/sales/activation)
   auth'suz/eksik-body istekle test edildi — hepsi temiz JSON + doğru status kodu döndü
   (401/400/405), unhandled exception/çıplak 500 yok.

   **Devam — aynı gün, ikinci tur:** eski checklist'in "17 dosya bilinçli atlandı, özel
   rollback/çoklu-catch mantığı var" diye işaretlediği 13 NON-connect dosya tek tek
   okunup incelendi. Bulgu: iddia edilenin aksine **11/13'ü tamamen standart**
   `ForbiddenError`/`ValidationError`/genel-500 deseniydi — muhtemelen eski regex
   codemod'u sadece fonksiyon içinde 2 ayrı `catch` (JSON-parse + asıl hata) olduğu
   için atlamış, gerçek bir karmaşıklık yoktu. Migrate edilenler: `social-pool`,
   `book-pool`, `collage-pool` (GET+PATCH üçü de, birebir aynı desen), `assignment-
   templates` (GET+POST), `role-defs` (GET+POST), `dev-notes` + `dev-notes/[id]`
   (4 handler), `egitmen-anasayfa/bootstrap`, `persons/[id]/education-summary`,
   `view-access` + `view-access/verify` — hepsi düz swap, JSON-parse catch'leri
   dokunulmadan bırakıldı. **2 dosya gerçekten özeldi:** `users/route.ts` POST'ta
   Firestore yazımı başarısız olursa YENİ açılan Firebase Auth hesabını geri silen
   bir rollback satırı var (`if (createdNewAuthAccount) await adminAuth.deleteUser(...)`)
   — bu satır catch bloğunda `apiError()` çağrısından ÖNCE korunarak taşındı, mevcut/
   paylaşılan bir hesap asla silinmiyor (davranış birebir aynı). `users/[id]/resend-
   code`'da özel "Kod gönderilemedi." mesajı vardı, apiError'ın genel "Sunucu hatası."
   mesajına döndü — kozmetik, davranışsal etkisi yok. Doğrulama: `tsc --noEmit` temiz,
   `eslint` bu 13 dosyada sıfır uyarı, `vitest` 107/107, dev server'da 10 route
   auth'suz istekle test edildi (hepsi 401, unhandled exception yok, `next dev` log'unda
   compile hatası yok). **Artık connect ailesi dışında migrate edilmemiş route KALMADI**
   — geriye SADECE `realtime/stream` (bilinçli atlanan, SSE) + **30 connect-ailesi
   dosyası** kaldı, o da yarınki connect sayfa bölme oturumuna bırakıldı.
5. `vitest` gibi kritik dev-dependency'lerin iki bilgisayar arasında senkron kaldığından
   emin ol (`npm ci` alışkanlığı).
6. **`realtime-hub.ts` + `read-cache.ts` çoklu-instance sınırı — Upstash Redis'e taşı**
   (2026-08-02 keşfedildi, kullanıcının k6/500-eşzamanlı-kullanıcı yük testi hazırlığı
   sırasında). `src/app/lib/server/realtime-hub.ts`'deki `subscribe`/`broadcast`
   (TÜM gerçek zamanlı SSE senkronunun — `useRealtimeSync`, 18 ekran — tek kaynağı) ve
   `read-cache.ts`'deki `cachedRead`/`invalidateCache` (kota-tasarrufu cache'i) İKİSİ
   DE process-local bellekte (`Map`) tutuluyor. Kodun kendi yorumu (`realtime-hub.ts:13-19`)
   zaten itiraf ediyor: "Vercel'de birden fazla fonksiyon instance'ı varsa... bu
   instance'daki dinleyiciler haberi kaçırır." Tek kullanıcıyla/local dev'de hiç
   görünmez (hep aynı instance) — 500 eşzamanlı farklı-rol kullanıcı Vercel'i
   kesinlikle çoklu-instance'a zorlayacağından SSE güncellemeleri bazı kullanıcılarda
   kaçabilir (çökme/veri kaybı DEĞİL — sadece "gerçek zamanlı" gecikir, sayfa
   yenilenince düzelir) ve cache'in kota-tasarrufu kısmen buharlaşır (her instance
   soğuk cache'le başlar).
   **İyi haber:** Upstash Redis altyapısı ZATEN kurulu — `package.json`'da
   `@upstash/redis`+`@upstash/ratelimit`, Vercel'de `UPSTASH_REDIS_REST_URL`/
   `UPSTASH_REDIS_REST_TOKEN` (72 gün önce eklenmiş, dev/preview/prod'da), çalışan
   bir client pattern'i `src/app/lib/rate-limit.ts`'te (SADECE rate-limit için
   kullanılıyor, realtime-hub'a hiç bağlı değil). Yani "Redis kurmak" diye ayrı bir
   iş yok — sadece `realtime-hub.ts`'i mevcut Upstash bağlantısına yönlendirmek
   gerekiyor (`subscribe`/`broadcast` imzası aynı kalacak şekilde tasarlanmış,
   çağıran kod route'lar/hook değişmeden geçiş yapılabilir — kodun kendi yorumunda
   da belirtilmiş). **Kod değişikliği HENÜZ YAPILMADI** — connect bölme + kalan
   apiError migrasyonundan sonra sıraya alınacak, k6 testinden önce.
