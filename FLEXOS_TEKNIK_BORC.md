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
6. [ ] `egitim-yonetimi/ekle/page.tsx` (1.583 satır, tek dev component) — alt component'lere böl.
7. [ ] `ogrenciler/havuz/page.tsx` (1.403 satır, tek dev component) — böl.
8. [ ] `satislar/satis-yap/page.tsx` (1.345 satır) — ticari kritik akış, hem böl hem test yaz.
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
12. [ ] **Zero `React.memo` — ÖNCEKİ ÇERÇEVE HATALIYDI, düzeltildi (2026-07-28):**
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
    YAPILMADI (yanlış olurdu), sıra madde 15/19'a bağlı.
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
15. [ ] `siniflar/lab-utilizasyon/page.tsx` (1.264), `aktivite-merkezi/page.tsx` (1.262),
    `egitmenler/page.tsx` (1.234) — aynı dev-component deseni, böl.
16. [ ] `connect-service.ts` (1.118) ve `submission-service.ts` (1.105) — tek dosyada çok
    fazla sorumluluk, alt-domain'lere (messaging/presence/roster gibi) bölünmeli.
17. [x] **API list endpoint pagination/limit denetimi** — ✅ 2026-07-28 doğrulandı,
    kod değişikliği gerekmedi: `persons`/`groups`/`enrollments` gibi uçlar limitsiz
    `list(tenantId)` kullanıyor ama bunlar **sınırlı varlık koleksiyonları** (bir
    okulun öğrenci/grup SAYISI platodan sonra büyümüyor) — `activities` gibi
    **sürekli büyüyen olay-log'u** değil, o yüzden `RECENT_LIMIT` deseni buralarda
    gerekmez. Yorum/comment uçları (`assignments/[id]/comments`) zaten TEK ödeve
    scope'lu (doğal olarak küçük). Tenant-genelinde sürekli büyüyen başka bir
    liste ucu bulunamadı — bilinçli olarak "sorun yok" sonucuna varıldı.
18. [ ] 322 ham `fetch()` çağrısının hata durumunda kullanıcıya tutarlı feedback verip
    vermediğini kontrol et — merkezi bir hata gösterimi yok.
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
20. [ ] `connect-service.ts` gibi büyük servislerde authorization/business-logic/data-access
    ayrımını gözden geçir.

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
