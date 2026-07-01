# FlexOS — Mimari (Birleşik Referans)

> **Bu dosya, yeni mimarinin tek kaynağıdır.** Önceki dört ayrı doküman
> (`ARCHITECTURE.md`, `FLEXOS_MIMARI.md`, `FLEXOS_CAPABILITIES.md`, `FLEXOS_MVP_FLOW.md`)
> burada birleştirildi.
>
> - **Bugünkü canlı sistemin** teknik referansı için → `FLEX_CORE_LORE.md`
> - **Gelişim günlüğü** için → `FLEX_CORE_LOG.md`
> - **Bu dosya** = gelecekteki yeniden-inşa tasarımı (henüz kod yazılmadı; tasarım 2026-06-09'da kilitlendi).
>
> Son güncelleme: Haziran 2026

---

## Durum / İlerleme (yeniden-inşa)

> Bu blok **ne yapıldığını** izler (tasarım aşağıda, ilerleme burada).
> Branch: `flexos` · Canlı `main` ETKİLENMİYOR · yeni koleksiyonlar (`persons`/`enrollments`), eskilere yazılmıyor.

### ✅ Admin Kişisel Görünüm Anahtarı (Core/Full) — BİTTİ (2026-07-01)

> Karar Opus ile kilitlendi (2026-07-01), kullanıcıyla ekstra netleştirme sonrası Sonnet kodladı + doğruladı.

**Bağlam — iki AYRI kavram (karıştırma):**
1. **Sistem Sürümü = `standaloneMode`** (mevcut switch, Kullanıcılar sayfası, admin-only). Sistemin geneli + EĞİTMENLERİN yetkisini belirler (`EGITMEN_STANDALONE_EXTRA` = self-service grup/öğrenci ekle aç/kapa). Bir kez ayarlanır, herkesi etkiler. **KALIR, dokunulmaz.**
2. **Admin Kişisel Görünüm Anahtarı (YENİ):** SADECE owner'ın kendi ekranını Core/Full arası çevirir. Sistemi/eğitmenleri ETKİLEMEZ. `standaloneMode`'dan bağımsız. Presentational (güvenlik değil — owner zaten tüm yetkilere sahip, sadece göz karışmasın).

**Neden gerçek/canlı iş (demo değil):** Sistem eğitmen modunda gerçekten canlıya açılacak (önce test). Admin eğitmenleri panelden ekler → tek kullanımlık kod → eğitmen kullanır. Core=Full eksi Satış/Eğitim-OP; eğitmen modülü İKİ üründe de AYNI (hafif değil, aylarca emek — ortak kalp). Tek fark: Core'da eğitmen kendi grup/öğrencisini ekler.

**Görünüm Anahtarı — kesin davranış:**
- **Tetikleme:** gizli klavye kısayolu (Sonnet mantıklı default, örn. ⌘/Ctrl+Shift+M). Üst bar/sidebar'da GÖRÜNÜR kontrol YOK (kullanıcı çirkin buluyor). Sıfır görsel iz.
- **PIN gate:** kısayola basınca ekranda **4 haneli PIN** modalı → doğru PIN → diğer moda geç (Core↔Full). PIN **server-side + hash'li** (client bundle'a gömülmez), küçük verify endpoint'i.
- **PIN değiştirme:** owner için **ayar menüsü** (mevcut PIN doğrula → yeni PIN → hash sakla), yine owner-only.
- **Kime açık:** SADECE owner — `view.toggle` capability'si (yalnız owner hesabında). Başkası tuşa bassa no-op, iz yok. **UID kodun içine GÖMÜLMEZ** — "owner/süper-admin" ayrımı ya da kullanıcıya tekil grant (capability-driven, ileride ortak eklenebilsin).
- **View-state:** kişisel, uid'e bağlı saklanır (localStorage[uid] yeterli). **Varsayılan Full** (kullanıcı kararı 2026-07-01: "default admin olsun, belki sonra değiştiririm"). Kısayol **asimetrik**: Full→Core PIN'siz direkt; Core→Full PIN ister. Full modunda hâlâ owner/admin'sin (server-side yetki değişmez) — Core sadece menüyü sadeleştirir.

**Menü kuralı (tek kaynak, dağınık `if` yok):** öğe görünür ⟺ `can(actor, yetki)` **VE** (öğe core-grubu **VEYA** owner view-state = Full). Eğitmen: satış yetkisi yok → zaten görmez. Owner: view-state enterprise gruplarını (Satış/Aktivite/Kampanya/Eğitim-OP/Kullanıcılar/Eğitmenler) açıp kapatır.

**Mevcut durum (Opus kontrol etti 2026-07-01):**
- ✅ Server-side güvenlik TAM: tüm servisler `can(actor,…)` + `ForbiddenError`. Eğitmen satış servisini çağıramaz (menü gizleme kozmetik değil, server zaten koruyor).
- ⚠️ `FlexSidebar.tsx` statik/mod-kör, tüm menüler her zaman render; 18 sayfa ayrı import.
- ⚠️ `/flexos/layout.tsx` YOK. Modu client'a taşıyan tek yer `kullanicilar/page.tsx` (`/api/flexos/settings` fetch).

**Sonnet uyguladı (2026-07-01):** `view.toggle` capability (`registry.ts`+`packages.ts`, admin paketine — UID hardcode yok) · PIN backend: `domain/core/view-pin.ts` + `repo/view-pin-repo.ts` + `server/view-pin-repo.firestore.ts` (koleksiyon `flexos_view_pins`, doküman id=uid, server-only rules) + `domain/services/view-access-service.ts` (`getViewAccessStatus`/`verifyViewPin`/`setViewPin`, Node `scrypt`+`timingSafeEqual`, hep `view.toggle` gated) · route'lar `GET /api/flexos/me` (capability listesi — menü kararına genel amaçlı temel), `GET /api/flexos/view-access` (hasPin), `POST /api/flexos/view-access/verify`, `POST /api/flexos/view-access/pin` · **layout.tsx yerine FlexSidebar kendi içinde self-contained** (18 sayfayı refactor etmeden `/api/flexos/me` fetch + localStorage[uid] mode + `Ctrl/Cmd+Shift+M` kısayolu + `ViewPinModal.tsx`, hepsi tek dosyada — "tek kaynak" ilkesi korunuyor) · FlexSidebar menü kuralı `canSee(cap, core)` ile bağlandı: core-grup (Ana Sayfa/Öğrenciler/Sınıflar/Yoklamalar/Sertifikasyon) her zaman, enterprise-grup (Eğitim Yönetimi/Satışlar/Eğitmenler/Kullanıcılar/Aktivite Merkezi) sadece Full · PIN kurulum/değişim UI'ı `kullanicilar/page.tsx`'e eklendi (Sistem Modu kartının altı, sadece `view.toggle` sahibi görür — sidebar/topbar'da sıfır görsel iz korundu). **16 yeni assertion** (`scripts/assert-view-access.ts`) + mevcut 24 (standalone-mode) geçti, `tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** gerçek tarayıcıda login+kısayol+PIN akışı (Firebase login gerektirir, bu oturumda yapılmadı) — bir sonraki oturumda manuel doğrulanmalı.

### ✅ Sınıflar — Core/Full paylaşımlı GroupTable+RosterDrawer BİTTİ (2026-07-01)

Eğitmen (Core) "Sınıflarım" ekranı kart-grid'den Full'daki (Operasyon) kaliteye çıkarıldı — kopyala-yapıştır değil, **tek paylaşımlı kod** (`src/app/flexos/siniflar/_shared/`): `groupDisplay.ts` (tipler+STATUS_MAP+initials-avatar yardımcıları), `useGroupCatalog.ts` (Branş→Eğitim→Bölüm cascade + Seans kütüphanesi fetch, `enabled` flag'li), `GroupTable.tsx` (filtre+Liste/Kart toggle+sayfalama+lifecycle: Başlat/Bitir/Sil/Geri Al, `mode="full"|"core"` ile Eğitmen/Şube/doluluk-bar kolonlarını gizler), `RosterDrawer.tsx` (`canManage` prop'uyla Full'da salt-görüntüleme, Core'da öğrenci ekle/çıkar formu — Havuz olmadığı için tek yer burası). Avatar = daire+baş harf (feedback_avatar_style, görsel avatar yok). `siniflar/page.tsx` (Full) ve `EgitmenSiniflarPanel.tsx` (Core) artık ikisi de bu bileşenleri kullanıyor. **Core'daki gerçek eksikler kapatıldı:** Bölüm dropdown'ı (sectioned eğitimde eskiden hiç yoktu) + gerçek Seans picker (`/api/flexos/seanslar`, eskiden elle gün-toggle) + Düzenle (editingId, eskiden hiç yoktu) + lifecycle butonları (eskiden capability var ama UI yoktu). `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 24+14 assertion (standalone-mode + view-access) hâlâ geçiyor (regresyon yok). **Test edilmeyen:** tarayıcıda gerçek kullanım (bu oturumda login yok).

#### Kararlar / Bağlam (2026-07-01, Opus ile — "neden böyle")

Bu bölüm yukarıdaki spec'in stratejik arka planı. İşi kodlamak için spec yeter; bunlar "neden bu yolu seçtik" içindir.

- **Core ayrı bir ticari ürün DEĞİL.** Kullanıcının niyeti: "eğitmen kısmını ticari düşünmüyorum; esas satarsam full paket satarım." Ortada tek kurum var (çalıştığı şirket), full sistemi şimdi benimsemeyecek → "bari eğitmenler kendi kısmını kullansın" diye eğitmen modu açılıyor. Nihai hedef herkes için full sistem.
- **GERÇEK canlı kullanım, demo değil** (önce test süreçleri). Bu yüzden menü gizleme tek başına yetmez — server-side `can()` de kesmeli (zaten kesiyor, doğrulandı).
- **Eğitmen modülü hafif/çöpe atılabilir DEĞİL** — aylarca emek (oyunlaştırılmış tasarım ödevleri, detaylı yoklama, aylık ders raporu, sertifika/ödev notu, öğrenciden ödev toplama). İki üründe de AYNI modül; **Core = Full eksi Satış/Eğitim-OP.** Tek fark: Core'da eğitmen kendi grup/öğrencisini ekler (`EGITMEN_STANDALONE_EXTRA`).
- **`standaloneMode` runtime switch KALIR** (dün kurulan Firestore + cache). Admin-only (Kullanıcılar sayfası), eğitmen çeviremez. Esneklik + gerektiğinde geçiş için doğru mekanizma.
- **REDDEDİLEN yollar:** (a) Gemini/GPT'nin ticari `licenseTier` + faturalandırma-sınırı katmanı → over-engineering, satılmayan ürün için gereksiz. (b) Kuruma-özel env-sabiti / per-install dağıtım → şimdilik gereksiz, runtime esneklik isteniyor. (c) Multi-tenant izolasyon → tek kurum olduğu için gereksiz. **Hepsi "ileride tamamen ticari olursa" diye ERTELENDİ**, şimdi kurulmayacak.

### ✅ Sınıflarım (Core) — canlı UX'e hizalama + kritik yetki-kapsamı açıkları BİTTİ (2026-07-01)

Kullanıcı canlı sistemi (`src/app/components/dashboard/class-management`+`student-management`) inceleyip Core'un davranışını ona göre düzeltmemizi istedi. Yapılanlar:

- **Sidebar flaş düzeltildi:** `FlexSidebar` sayfa değişince yeniden mount oluyordu, capability listesi her seferinde boştan yükleniyordu → menü "boşalıp doluyordu". Modül-seviyeli `capsCache` eklendi (ilk yüklemede fetch, sonra cache'ten oku).
- **Sistem Modu switch'ine onay modalı** eklendi (Kullanıcılar sayfası) — tek tıkla değişmiyor, "Evet/Vazgeç" onayı şart (FlexModal deseni).
- **Kullanıcılar sayfası header'ı** diğer sayfalarla (mavi ikon, container genişliği) hizalandı.
- **Core UI canlıya göre yeniden kuruldu:** Grup Ekle formu bottom-sheet'ten **akordiyona** çevrildi (sayfa içi açılıp kapanıyor, modal değil); grup kartı sol ikonu branş-rengi yerine **paylaşımlı avatar paleti** (initials+gradient, `avatarStyle`); Core'da **Liste görünümü kaldırıldı** (sadece Kart); grup filtre barı Full'un 4 durumundan (Açılacak/Aktif/Tamamlandı/İptal) canlıdaki gibi **Aktif/Arşiv** ikilisine indirildi; grup kartına tıklayınca artık sağdan drawer AÇILMIYOR — aşağıdaki **Öğrencilerim** tablosu o gruba filtreleniyor ("Mevcut Grup: X" / "Tüm Öğrenciler" toggle, canlıdaki "Mevcut Sınıf" davranışı); üst buton "+ Grup Ekle" olarak yeniden adlandırıldı.
- **Öğrencilerim bölümü tamamlandı:** Öğrenci Havuzu tablo görseliyle (avatar/badge/tableCard stilleri) ama Core'a özel sade kolonlar; 15/sayfa + sayfalama; Aktif/Mezun tab; sağ üstte **Öğrenci Ekle** (bottom-sheet, Grup opsiyonel — **AÇIK SORUN**, aşağı bak); satır aksiyonları canlıdaki gibi **Düzenle/Mezun Et/Aktife Al/Sil** (onay modalli). Backend: `setEnrollmentStatus` yeni servis (`enrollment-service.ts`, completed/cancelled/active geçişleri, grupsuz kayıtlarda da çalışır) + `PATCH /api/flexos/enrollments/[id]` artık `{status}` body'sini de kabul ediyor. 7 yeni assertion (`scripts/assert-enrollment-status.ts`).
- **🔒 KRİTİK yetki-kapsamı açıkları bulundu ve kapatıldı** (kullanıcı sordu: "diğer eğitmen diğer eğitmenin öğrencisini görebilir mi?" — cevap evetti, düzeltildi):
  - `GET /api/flexos/persons` — org-scope olmayan aktör (eğitmen) artık SADECE kendi grubundaki öğrencileri görür (önceden TÜM okulu görüyordu — gerçek sızıntıydı). `primaryEnrollmentId` + `groups[].groupId` alanları eklendi (Core'un satır aksiyonları + grup filtresi için).
  - `GET /api/flexos/groups` — `trainerId` query param'ı client'tan geliyordu, sunucu doğrulamıyordu (biri boş bırakınca/başka uid yazınca her şeyi görebilirdi). Artık `group.read` yetkisi kontrol ediliyor + org-scope olmayan aktör için `trainerId` sunucu tarafında `actor.uid`'e sabitleniyor.
  - `GET /api/flexos/groups/[id]/roster` — hedef grup hiç kontrol edilmiyordu (herhangi bir groupId ile herhangi bir roster çekilebiliyordu). Artık grup çekilip `group.trainerId === actor.uid` (veya org-scope) doğrulanıyor.
  - **AÇIK KALAN (düşük risk, ertelendi):** `PATCH /api/flexos/persons/[id]` (Düzenle) hâlâ hedef-bazlı sahiplik kontrolü yapmıyor — id'ler tahmin edilemez olduğu için pratik risk düşük, ama tam kapsam için sıradaki iş.
- `tsc`+ESLint temiz, `npm run build` başarılı, tüm assertion'lar (24+14+7) geçiyor.

**✅ BİTTİ (2026-07-01, sonraki turda):** Core'da "Öğrenci Ekle" formunda Grup seçimi **zorunlu** yapıldı ("Grupsuz — sonra atarım" seçeneği kaldırıldı; boş bırakılırsa "Grup seçimi zorunludur" uyarısı). Enrollment artık koşulsuz oluşturuluyor (eskiden `if (sGroupId)` şartlıydı). Düzenleme modunda Grup alanı zaten yoktu, değişmedi.

**✅ BİTTİ — Eğitim Ayarları artık Core'da da erişilir:** Kullanıcı sordu: eğitmen kendi grubunu açarken Branş/Eğitim seçmesi gerekiyor ama bunları oluşturma yetkisi (`branch.create`/`education.create`) sadece admin/operasyon'da — peki admin, Core görünümündeyken (Görünüm Anahtarı) bunu nasıl kurar? Çözüm: `FlexSidebar`'daki "Eğitim Yönetimi" akordiyonu ikiye ayrıldı — **"Eğitimler"** (katalog CRUD/Eğitim Ekle) Full-only kaldı, **"Eğitim Ayarları"** (Branş Havuzu + Tatil + Sertifika + Sözleşme, `/flexos/egitim-yonetimi/ayarlar`) artık **hem Core hem Full'da görünüyor** (`canSee("branch.create", true)` — core=true). Veri zaten baştan beri ortaktı (`flexos_branches` tek koleksiyon); değişen sadece sidebar görünürlük kuralı. Gerçek eğitmen hesapları `branch.create` yetkisine sahip olmadığı için onlara yine hiç görünmez — sadece admin/operasyon paketi görür.
- `tsc`+ESLint temiz, `npm run build` başarılı.

---

- [x] Mimari 4 dosyadan tek `FLEXOS.md`'ye birleştirildi (2026-06-15)
- [x] **Tip katmanı yazıldı** — `src/app/lib/domain/` (`core/`: Person, Enrollment, Group, PersonNote · `education/`: Grade · `eduos/` dikiş: Education, **Track**, Sale, Payment) · `tsc` temiz · canlıya dokunmadı
- [x] **Hiyerarşi netleşti** — Branş → Eğitim (Grafik-1) → **Track** (Temel Photoshop, satılabilir, eski "Modül") → Grup. `Module` tipi silindi, `Group.trackId` + `Enrollment.trackScope` eklendi
- [x] **Yetki omurgası yazıldı** — `src/app/lib/domain/access/` (capability registry ~22 + `Scope`/`Sensitivity`/`Actor` tipleri + 4 paket Satış/Op/Eğitmen/Admin + `can()`/`hasCapability()`/`widestScope()`). `person.pii.write` eklendi; eğitmen paketinde PII YOK. `tsc` temiz
- [x] **Person backend yazıldı** — `domain/repo/person-repo.ts` (port) + `domain/services/person-service.ts` (`createPerson`, gated: PII'ı `can()` ile sunucuda siler) + `server/person-repo.firestore.ts` (Firestore adapter, yeni `persons` koleksiyonu) + `domain/errors.ts`. 7 assertion doğrulama geçti (eğitmen PII silindi / satış korundu / yetkisiz reddedildi). `tsc` temiz
- [x] **API route + auth köprüsü yazıldı** — `POST /api/flexos/persons` (`withAuth` → `actorFromCaller`: eski rol→paket, tek kiracı "default") → `createPerson`; hata→HTTP (403/400/500). `server/auth-actor.ts`. Firestore rules: `persons`/`enrollments` server-only (`if false`, Admin SDK). Actor köprüsü doğrulandı (admin pii.write var / eğitmen yok). `tsc` temiz
- [x] **Enrollment service + çoklu-grup fix** — `domain/services/enrollment-service.ts` (`createEnrollment`, gated; aynı kişi FARKLI gruplara SERBEST = eski çoklu-grup bug'ı yapısal çözüldü, aynı grupta çift kayıt engelli) + `domain/repo/enrollment-repo.ts` (port, `findActive`) + `server/enrollment-repo.firestore.ts`. Eğitmen paketi **genişletildi** (group.create/edit/assign_student/activate — standalone Classroom için). 5 assertion geçti, `tsc` temiz
- [x] **Öğrenci-ekle TAM callable** — `POST /api/flexos/persons` + `POST /api/flexos/enrollments`. `groupIds` token claim'i Actor'a bağlandı (`with-auth.ts` Caller.groupIds) → assigned scope gerçek: eğitmen kendi grubuna kayıt yapar, başkasınınkine YAPAMAZ. Doğrulandı
- [x] **Grup backend** — `domain/services/group-service.ts` (`createGroup`, gated `group.create`, validation) + repo port + `server/group-repo.firestore.ts` (yeni `flexos_groups` koleksiyonu — canlı `groups` çakışmasın) + `POST /api/flexos/groups` + Firestore rules. 6 assertion geçti, `tsc` temiz
### ✅ Tamamlanan (write-side backend, hepsi gated + doğrulandı, ~26 assertion)
- **Öğrenci ekle:** `POST /api/flexos/persons` (PII gated) + `POST /api/flexos/enrollments` (çoklu-grup, scope) → BİTTİ (callable). Sadece UI eksik.
- **Grup ekle (temel):** `POST /api/flexos/groups` → grup oluşturma BİTTİ (callable). Sadece UI + katalog eksik.

### ⏳ SIRADAKİ İŞLER
- [x] **Katalog backend (Branş/Eğitim/Track)** — `domain/services/catalog-service.ts` (createBranch/Education/Track, gated) + `eduos/branch.ts` + `repo/catalog-repo.ts` + `server/catalog-repo.firestore.ts` (flexos_branches/educations/tracks) + 3 route (`/api/flexos/{branches,educations,tracks}`) + capability'ler (branch/education/track.create → operasyon+admin) + rules. `tsc` temiz
- [x] **Okuma/liste uçları** — `GET /api/flexos/{branches,educations?branchId,tracks?educationId,groups?trainerId}` (kiracı filtreli, repo `list`). `tsc` temiz
- [x] **Referans bütünlüğü** — servisler artık deps-bag alır: `createGroup(actor, input, {groups, educations?, tracks?})` verilen educationId/trackId katalogda var mı + track o eğitime mi bağlı (tutarlılık) doğrular; katalog repo verilmezse atlar (standalone). `createEnrollment(actor, input, {enrollments, persons, groups})` personId+groupId aynı kiracıda gerçekten var mı doğrular. Route'lar firestore repo'larını enjekte eder. 9 assertion geçti (jiti), `tsc` temiz
- [x] **Eğitim Yönetimi katalog SAYFASI (ilk UI)** — `src/app/flexos/egitim-yonetimi/page.tsx` (route `/flexos/egitim-yonetimi`). Claude Design tasarımı React'e portlandı (kaynak `_design/egitim-yonetimi`). Liste = **Eğitimler** (Track değil; Track eğitimin alt parçası, "Eğitim Ekle"de tanımlanacak). Branş filtresi + tablo gerçek GET'ten; fiyat (`listPrice`)/durum (`onSale`→Satışta/Taslak) bağlı. Font Inter, `authStateReady()` korumalı. Commit 023a38f, PUSH EDİLDİ.
  - **Placeholder (Education tipinde alan YOK → "Eğitim Ekle"de eklenecek):** Toplam Saat, Teslim Modu (online/in_person), Tip (bireysel/kurumsal). Page'de opsiyonel alan olarak okunuyor, dolunca otomatik görünür.
  - **Henüz bağlanmadı (şimdilik "yakında" toast):** Eğitim Ekle, satır düzenle/sil, toplu sil, sidebar menü linkleri.
  - **AÇIK SORU (ileride):** Track'ler bu listede ayrıca görünecek mi? (kullanıcı "sonra konuşuruz" dedi)
- [x] **"Eğitim Ekle" formu (UI + yerel etkileşim) bitti** — `src/app/flexos/egitim-yonetimi/ekle/page.tsx` (route `/flexos/egitim-yonetimi/ekle`). Tasarım `_design/egitim-ekle` (`Eğitim Ekle.dc.html`) React'e birebir portlandı, katalogla aynı desen (inline S/IC, Inter, authStateReady). **4 sekme tam çalışır (yerel state):** Genel Bilgiler · İçerikler (saat→bölüm&track ağacı / gün→gün planlayıcı) · Fiyat (havuz + KDV→net matrah) · Sertifikasyon (kurumsal statik / bireysel dinamik) + Satışa Başlat barı + sekme bazlı Kaydet. Katalogdaki "Eğitim Ekle" butonu buraya bağlandı. `tsc` temiz.
  - **Branş seçici eklendi (2026-06-17):** Genel sekmesinde Eğitim Adı'nın ÜSTÜNE "Branş" dropdown'ı kondu (`bransId` state). Şimdilik BOŞ (sadece "Branş seçin…" placeholder). KARAR: branş buradan eklenmez; merkezî listeden (`GET /api/flexos/branches`) çağrılıp seçilir. Backend bağlanınca dropdown gerçek branşlarla dolacak.
  - ~~HENÜZ BACKEND YOK~~ → **BAĞLANDI (2026-06-18).**
- [x] **HİYERARŞİ + WIRING + FAZ-1 DÜZENLE BİTTİ (2026-06-18)** — **Branş → Eğitim → Bölüm(Section) → Track** (4 seviye KESİN). Bölüm = YENİ entity `eduos/section.ts` (kendi grup/yoklama/sertifika + satılabilir); Track = granül, Bölüm grubu İÇİNDE işlenir; çapraz kullanım (AutoCAD→Photoshop) `enrollment.trackScope` ile (katalog ağacı tek-evli). Domain: `Education.audience(individual/corporate)`+`structure(single/sectioned)`+`outline`, `Track.sectionId`, `Group.sectionId`, `updateEducation`. Capability `section.create`+`education.edit`. Backend: `createSection`, POST/GET `/sections`, GET+PATCH `/educations/[id]`, referans bütünlüğü. UI: **Branş Havuzu** (`/egitim-yonetimi/branslar`) + **Eğitim Ayarları hub** (`/ayarlar`: Branş/Tatil/Sertifika/Sözleşme) + paylaşımlı **FlexSidebar** (akordiyon, framer-motion) + **FlexModal**. **Eğitim Ekle DB'ye yazıyor:** branş dropdown=GET; Kaydet=Taslak(POST onSale:false)+Track Bazlı'da sections/tracks POST; Satışa Başlat(onSale:true PATCH/POST)↔Satışı Kapat; modal onayı; yayın validasyonu (branş+ad+içerik+ana fiyat eksikse kilit, durum çubuğu eksikleri listeler). **İçerikler matrisi:** Bireysel+Standart=RichText düz-metin / Bireysel+Track=bölüm&track ağacı (üstte oto "Eğitim Adı · toplam saat") / Kurumsal=gün planlayıcı; Süre tipi Eğitim Tipi'nden türetilir (Bireysel=Saat, Kurumsal=Gün). **Faz-1 Düzenle:** katalog satır/✏️ tıkla→`/ekle?id=`→`prefillForm` (GET edu+sections+tracks, server→local id remap); scalar alanlar PATCH ile persist. NOT: görsel sonra Claude Design'da elden geçirilecek (sayfalar işlevsel/sade).
- [x] **Faz-2 Düzenle (içerik yapısı) BİTTİ (2026-06-19)** — Düzenleme modunda bölüm/track değişiklikleri artık DB'ye persist ediliyor. Strateji: **delete-all + recreate** (`syncEducationContent`). Repo: `SectionRepo.deleteByEducation` + `TrackRepo.deleteByEducation`. Firestore: batch delete. Servis: `syncEducationContent(actor, educationId, sections[], deps)` — mevcut bölüm/track'leri siler, yeni ağacı oluşturur (capability: `education.edit`). Route: `PUT /api/flexos/educations/[id]/content` (body `{ sections: [...] }` full tree). UI: edit modunda Kaydet → scalar PATCH + content PUT (Track Bazlı ise). 6 assertion geçti, `tsc` temiz.
- [x] **"Satış Yap" sayfası — UI + KATALOĞA BAĞLI (2026-06-19, iş "A" bitti)** — Sidebar'a **Satışlar** akordiyonu (`FlexSidebar`: `satis-yap`/`satis-liste` navkey) + alt linkler (Satış Yap → `/flexos/satislar/satis-yap`, Satış Listesi → yakında). Sayfa `src/app/flexos/satislar/satis-yap/page.tsx`, tasarım `_design/Satış Yap.dc.html` portu, Inter/authStateReady/FlexSidebar deseni. **2 sekme** (Genel Bilgiler · Eğitim; "Ödeme" kilitli). **Eğitim sekmesi GERÇEK KATALOĞA BAĞLI:** branş/eğitim `GET /api/flexos/{branches,educations?branchId}`, eğitim seçilince `GET /api/flexos/{sections,tracks}?educationId` → bölüm→track ağacı (sectionId grupla, order sırala). **Satış Modeli** = `education.structure`: `sectioned` → "Track Bazlı" açık (bölüm+track tek tek seçilir, **lacivert checkbox**, parent/child toggle, canlı saat sayacı); `single` → "Full Paket" kilitli. Statik COURSE_CATALOG/paket kavramı kaldırıldı (katalogda paket entity yok). **Genel sekmesi:** Ad/Soyad **ayrı** (`Person.firstName/lastName`); 18 altı → framer-motion açılır/kapanır **Veli Sözleşmesi** kartı (Veli Adı tek alan + TC). KARARLAR: [[18 yaş altı veli modeli]] (Person=öğrenci→listede, veli=Sale alanı) + [[fatura/billing modeli]] (Sale'de fatura tarafı bloğu). UI düzeltmeleri: footer padding 32px eşit, scroll jitter `scrollbar-gutter: stable`. `tsc` temiz. **BACKEND YAZMA YOK:** "Devam Et" sekme değiştirir; satış DB'ye düşmüyor.
- [x] **"Öğrenci Havuzu" sayfası — UI (2026-06-20, demo veriyle)** — Sidebar'a **Öğrenciler** akordiyonu (`FlexSidebar`: `ogrenci-havuzu`/`kayitli-ogrenciler`/`mezunlar` navkey; Satışlar↔Sınıflar arası) + alt linkler (Öğrenci Havuzu → `/flexos/ogrenciler/havuz`, Kayıtlı Öğrenciler + Mezunlar → yakında). Sayfa `src/app/flexos/ogrenciler/havuz/page.tsx`, tasarım `_design/Öğrenci Havuzu.dc.html` portu, Inter/authStateReady/FlexSidebar deseni. **Filtre paneli:** 7 durum checkbox (pending→Filtrele'de uygula deseni), Şube + Branş dropdown, Temizle. **Tablo:** Ad/Email/Telefon/Durum/Şube/Branş/Grup + İşlem; branş hover popup (+N rozeti); sayfalama; boş durum. **Grup kolonu = branş gibi (KULLANICI KARARI):** 0→*Atanmadı* · 1→grup ismi çipi · 2+→`N Grup`+sayı rozeti, hover'da grup isimleri (branşıyla) popup, detayda hepsi. **MİMARİ ONAY:** Havuz = enrollment listesi + filtre; satış yapılınca createSale→Person+Enrollment buraya düşer ([[öğrenci-havuzu-tasarımı]]). `tsc` temiz. **DEMO VERİYLE (24 öğrenci):** gerçek veri ayağı sıradaki etap. **MODEL BOŞLUKLARI (wiring'de):** (1) "Şube" (Kadıköy/Pendik…) domain'de YOK — Person/Tenant'a eklenecek/eşlenecek; (2) 7 zengin durum (beklemede/grupsuz/tekrar/donduruldu…) domain `PersonStatus`=3 (prospect/active/passive) — enrollment/ödeme durumundan türetilecek; (3) `GET /api/flexos/persons` (enrollment→grup→bölüm→eğitim→branş read-time join) HENÜZ YOK.
- [x] **`createSale` backend BİTTİ (2026-06-21)** — Sale tipi güncellendi: `Guardian` (veli ad+TC, 18 altı) + `BillingParty` (fatura tarafı) + `educationId` (tek) + `trackIds` (track bazlı seçim). `sale.create`+`sale.read` capability → registry + satis/operasyon/admin paketleri. `sale-repo.ts` port + `sale-repo.firestore.ts` adapter (`flexos_sales` koleksiyonu). **`sale-service.ts` orchestrator:** tek `createSale` çağrısıyla Person(active) + Sale + Enrollment(grupsuz, havuzda) oluşur; PII gating, yetki kontrolü, veli/fatura alanları. `POST /api/flexos/sales` route. Firestore rules eklendi. **20 assertion geçti** (satış/admin/op başarılı, eğitmen reddedildi, track bazlı, guardian, validasyonlar). `tsc` temiz.
- [x] **Satış Yap UI bağlandı + `GET /api/flexos/persons` BİTTİ (2026-06-21)** — "Satış Yap" formu `POST /api/flexos/sales`'e bağlandı (Kaydet butonu, validasyon, saving state, başarıda havuza yönlendir). `GET /api/flexos/persons` yazıldı: server-side read-time join (Person+Enrollment+Education+Branch+Group), PII gating (`person.read.pii`), enrollment'dan havuz durumu türetme (aktif/grupsuz/beklemede/donduruldu/mezun/pasif). PersonRepo+EnrollmentRepo'ya `list()` eklendi. `tsc` temiz.
  - **⚠️ DÜZELTME (2026-06-22):** Bu girişte "Öğrenci Havuzu gerçek API'ye bağlandı" deniyordu ama **commit'lenmemiş/uygulanmamış** — havuz sayfası commit geçmişinde HEP demo veriydi (`DEMO.map`→`DUMMY`). Gerçek bağlama 2026-06-22'de yapıldı (aşağıdaki girişe bak).
- [x] **Sınıflar — "Grup Ekle" sayfası BİTTİ (2026-06-21)** — `src/app/flexos/siniflar/page.tsx` (route `/flexos/siniflar`), Claude Design `Sınıf Ekle.dc.html` portlandı. Sidebar'a **Sınıflar** akordiyonu (Grup Ekle/Tüm Gruplar/Seans Takvimi). **Form:** Eğitim Formatı segmented (Grup/Özel Ders/Kurumsal — kurumsal uyarı notu + form gizle), 3-kolon grid (Şube/Branş/Eğitim/**koşullu Bölüm**/Grup Kodu/Başlangıç/Eğitmen), seans custom popup, ders saati/toplam saat/kontenjan. **Bölüm dropdown koşullu:** eğitim `sectioned` ise GET sections → Bölüm görünür; `single` ise gizli. **Branş/Eğitim/Bölüm gerçek katalog API'ye bağlı.** POST `/api/flexos/groups` ile kayıt. **Grup Listesi:** demo veri, Liste/Kart görünüm toggle, durum filtresi (Tümü/Açılacak/Aktif/Mezun), doluluk barı, sayfalama, düzenle/sil + silme onay modalı. **Uppercase kaldırıldı.** `tsc` temiz.
- [x] **GRUBA ATA + HAVUZ GERÇEK VERİ + SINIFLAR GERÇEK LİSTE + LIFECYCLE PERSIST BİTTİ (2026-06-22)** — Uçtan uca zincir **satış → havuz (grupsuz) → Gruba Ata → grupta görünür** tıklanarak çalışıyor.
  - **A · Gruba Ata backend:** `assignToGroup` servisi (`enrollment-service.ts`) — grupsuz aktif kaydı gruba yerleştirir, gated `group.assign_student`; zaten-gruplu/aktif-değil/çift-kayıt/grup-var-mı kontrolleri; `educationId` grup'tan denormalize. `EnrollmentRepo.getById` (port+firestore). `PATCH /api/flexos/enrollments/[id]` (body `{ groupId }`). `GET /persons` → grupsuz öğrencinin `assignableEnrollmentId`'si dışa veriliyor. Eğitmen şartı YOK (grupta eğitmen opsiyonel/dummy). **12 assertion geçti.**
  - **C8 · Gruba Ata UI + havuz gerçek veri:** `ogrenciler/havuz/page.tsx` artık `GET /api/flexos/persons`'tan yükleniyor (DUMMY kaldırıldı). "Gruba Ata" butonu (eskiden `soon` toast'ı) → grup seçme modal'ı (`GET /groups`+`/educations`, kod+eğitim adıyla) → `PATCH` → başarıda liste yenilenir (grupsuz→aktif). Demo 24 öğrenci gitti; veri görmek için satış yapılmış olmalı.
  - **B5 · Sınıflar listesi gerçek veri:** `GET /api/flexos/groups` zenginleştirildi (eğitim adı + branş join + **doluluk**=aktif enrollment sayısı; ham alanlar korundu). `siniflar/page.tsx` demo 16 grup kaldırıldı, listeyi `GET /groups`'tan çekiyor; durum eşlemesi (planned/enrolling→Açılacak, active→Aktif, completed→Mezun, archived/cancelled→İptal), ISO→TR tarih, grup id `number`→`string`, grup oluşturunca liste auto-refresh.
  - **Lifecycle persist:** `updateGroupStatus` servisi + `PATCH /api/flexos/groups/[id]` (gated `group.edit`). Sınıflar'daki Başlat/Bitir/İptal/Geri Al artık DB'ye yazıyor (**10 assertion**). `tsc`+ESLint temiz.
  - ~~**MODEL BOŞLUKLARI:** Seans saati saklanmıyor / Grup Sil client-only~~ → **İKİSİ DE ÇÖZÜLDÜ (2026-06-22 PC):** seans saati `GroupSchedule.startTime/endTime` olarak persist + listede gösteriliyor; Grup Sil backend hazır.
- [x] **ŞUBE Aşama-1 (göster+kaydet, scope-hazır) BİTTİ (2026-06-22)** — Şube = fiziksel ofis (≠ branş). Paylaşımlı sabit liste **stabil id'lerle** `src/app/lib/branch-offices.ts` (kadikoy/pendik/umraniye/besiktas/sirinevler + `officeName()`). Sınıflar formu → `Group.branchOfficeId`'ye yazıyor; `GET /groups` `branchOfficeId`+`branchOffice` döndürüyor → Sınıflar listesinde şube görünür. `GET /persons` → `subeler[]` öğrencinin **gruplarından türetilir**; havuz şube filtresi çalışır (grupsuz öğrencide şube boş — satışa şube eklenmedi, istenirse +10dk). **YETKİ FİLTRESİ YOK** (Aşama-2): `can()` branch scope + `Actor.branchIds` zaten hazır (`access/can.ts:40-43`), enforcement "Kullanıcılar" ekranıyla gelecek ([[project-sube-scope]]). İsim ayrımı: şube=`branchOffice`/`officeId`, branş=`branch`. `tsc`+ESLint temiz.
- [x] **Grup Sil backend BİTTİ (2026-06-22, PC)** — `group.delete` capability (operasyon/egitmen/admin) + `deleteGroup` servisi (**aktif kayıtlı grup silinmez** güvenliği; iptal/transfer engel değil) + `DELETE /api/flexos/groups/[id]` + `GroupRepo.delete` + `EnrollmentRepo.listByGroup` (roster için de kullanılacak). Sınıflar `confirmDelete` API'ye bağlandı (UI butonu zaten yalnız boş+açılacak grupta görünüyor). **7 assertion**, `tsc`+ESLint temiz.
- [x] **Seans saati persist BİTTİ (2026-06-22 PC)** — `GroupSchedule.startTime/endTime` eklendi; `createGroup` persist ediyor (form zaten gönderiyordu), `GET /groups` döndürüyor, Sınıflar listesi seans saatini gösteriyor (yoksa ders saatine düşer). `tsc`+ESLint temiz.
- [x] **Roster (sınıf listesi, salt görüntüleme) BİTTİ (2026-06-22 PC)** — `GET /api/flexos/groups/[id]/roster` (enrollment listByGroup→person join, PII gated, sadece aktif kayıt) + Sınıflar'da sağ açılır panel (gruba tıkla / kart "Öğrenciler" → öğrenci listesi: ad, e-posta/tel, atanma tarihi; boş/yükleniyor durumları). **Aktar/çıkar YOK** (grup değişimi=yeni satış kararı bekliyor — [[project-group-change-sale]]). `tsc`+ESLint temiz.
- [x] **EĞİTMEN BACKEND + UI WIRING BİTTİ (2026-06-23)** — Eğitmen kadrosu sıfırdan, Group/Person dikey kesitiyle aynı desende. **Domain:** `core/trainer.ts` (Trainer: name/email/phone/branchOffices/status/competencies/**hourlyRate**/availability/notes; ücret = **saatlik/ders saati başına**, aylık tutar ileride yoklama×hourlyRate ile finansta) + `repo/trainer-repo.ts` port + `services/trainer-service.ts` (`createTrainer`/`updateTrainer`/`deleteTrainer`, gated). **Ücret = PII deseni:** `hourlyRate` yalnız `trainer.rate.write` varsa yazılır (yoksa düşürülür, `rateDropped`), `trainer.rate.read` yoksa GET'te `null` maskeli. **Capability'ler:** trainer.create/read/edit/delete/rate.read/rate.write → operasyon+admin tümü; **egitmen yalnız `trainer.read`** (ücret YOK). **Server:** `trainer-repo.firestore.ts` (yeni `flexos_trainers` koleksiyonu) + Firestore rules server-only. **Route'lar:** `POST`/`GET /api/flexos/trainers` (GET = grup join: Group.trainerId==trainer.id → kod/eğitim adı/doluluk + ücret maskeleme) · `PATCH`/`DELETE /api/flexos/trainers/[id]`. **19 assertion geçti** (yetki, ücret gating create+update, validasyon, kiracı izolasyonu, silme). **UI bağlandı:** `egitmenler/page.tsx` demo veri (`buildDemoTrainers`) KALDIRILDI → `GET /api/flexos/trainers`; Ekle/Düzenle formu POST/PATCH, silme DELETE, hepsi başarıda `loadTrainers()` refetch + saving/loading durumları. Trainer.id UI sıralı index (palet), `docId` = Firestore id (API). `tsc`+ESLint temiz. ~~AÇIK: Not ekle/sabitle client-only~~ → **2026-06-29'da persist edildi** (`UpdateTrainerInput.notes` + PATCH bağlandı; `addNote`/`togglePin` artık Firestore'a yazıyor). ~~Eğitmen silme grup engeli yok~~ → **2026-06-29'da eklendi** (`deleteTrainer` GroupRepo deps alıyor; planned/enrolling/active/postponed grubu olan eğitmen silinemez). **KALAN AÇIK:** müsaitlik düzenleme UI yok (entity destekliyor).
- [x] **SATIŞ "ÖDEME" SEKMESİ — FAZ-1 (UI) BİTTİ (2026-06-24)** — `satislar/satis-yap/page.tsx` artık **3 sekme** (Genel · Eğitim · **Ödeme**; eski kilit kaldırıldı). Tasarım `_design`/handoff `Satış Yap.dc.html` Ödeme sekmesi React'e portlandı. **Finansal özet:** Brüt (gerçek katalog `listPrice`'ından türetilir — track bazlıda seçili track toplamı, sectioned full'da education.listPrice ?? Σ section.listPrice, single'da education.listPrice) → Kampanya indirimi (statik %20/%15/%10 map) → Yönetici/satışçı ek indirimi (**%/TL toggle**, segSm) → **NET**. **Ödeme girişi:** çok satırlı (Nakit/Kredi Kartı/Havale-EFT/Senet + Alınan Tutar + Taksit Sayısı; taksit yalnız KK/Senet'te açık), satır ekle/sil, canlı **Toplam/Ödenen/Kalan** şeridi (kalan=0 → yeşil). **"Tekrar Öğrencisi / Sınıf Değişimi" → 0 TL kilit** (brüt 0, indirim+ödeme inputları disabled). Footer 3 adımlı (Geri ödeme→eğitim, "Satışı Tamamla"). **Kaydet:** `onSave` body'sine **`soldPrice: net`** eklendi → `POST /api/flexos/sales` (createSale `soldPrice` zaten destekliyordu). `tsc`+ESLint temiz. **FAZ-2 (EKSİK):** Payment persist YOK — `payment.ts` hâlâ sadece TİP; ödeme/taksit satırları DB'ye yazılmıyor (PaymentRepo + `flexos_payments` + createSale wiring gerekecek). Kampanya hâlâ statik (katalogda kampanya/bundle entity yok).
- [x] **KAPSAM NETLEŞTİ — yol haritası revize (2026-06-24, kullanıcı kararı; aşağıdaki eski SIRADAKİ önceliklerini EZER):**
  1. **Öğrenci yüzeyi TEK = Öğrenci Havuzu** — ayrı "Kayıtlı Öğrenciler"/"Mezunlar" sayfaları İPTAL; havuz statü filtreleriyle (aktif/grupsuz/beklemede/mezun/**iptal**) tek yüzey + güçlü search; iptal/mezun öğrenci de havuzda görünür, iletişim korunur → remarketing/kampanya. ([[project-student-pool]])
  2. **Faturalandırma YOK** (Logo/muhasebe değiliz) — finans yardımı yalnız: **tahsilat takibi + "ödemesi gelecek/geçen öğrenci" hatırlatması** + **eğitmen aylık hakediş = yoklama × hourlyRate**. `Sale.billing` dormant; vergi/fatura makinesi yok → eski 2026-06-19 fatura kararı GERİ ALINDI. ([[project-invoicing-billing]])
  - **2b. STATÜ MODELİ (2026-06-24, ⚠️ açık madde ÇÖZÜLDÜ):** Öğrenci durumu ≠ ödeme durumu — **iki AYRI eksen.** Öğrenci: Aktif/Beklemede/Pasif/Mezun/İptal. Ödeme (TÜRETİLİR, saklanmaz): Planlandı/Yaklaşıyor/Gecikti/Kısmi Ödendi/Tamamlandı. **Satışta öğrenci direkt Aktif** (`createSale` zaten doğru; tasarım footer "Beklemede" yazısı YANLIŞ→Aktif). Tarih geçince sistem sadece "Gecikti" UYARIR, otomatik beklemeye ALMAZ; Beklemede = operasyon MANUEL (yoklamada görünmeye devam eder). "2 ay erteleme" = sadece `dueDate` düzenle. Durum muhtemelen Enrollment'ta (Person rollup) — ONAY BEKLİYOR. Tam model → [[project-status-model]].
  3. **Kullanıcı/rol/yetki sıfırdan** = şart, onaylandı (yetki motoru hazır; eksik = flexos_users + UI + kullanıcı→Actor). ([[project-sube-scope]])
  4. **Satış Listesi = yüksek öncelik** — ay/2ay/yıl toplam satış raporu (`soldPrice` agregasyon) + **satış iptali buradan**: iptal **SOFT** (`Sale.status` active|cancelled +cancelledAt/by/reason, silme DEĞİL = audit+remarketing); cascade → gruba atanmışsa enrollment non-active (roster sadece aktif gösterdiği için sınıftan otomatik düşer), havuzdaysa "iptal" statü; Person/Enrollment SİLİNMEZ, havuzda "İptal" filtresinde görünür. ([[project-sales-list-cancel]])
  5. **Eğitmen v2 = SEÇİCİ yeniden yazım** — canlıdan alınabilenler AYNEN; **🔒 ASLA BOZMA: Google Drive yükleme + OAuth token (yeniden token YOK), ödev sistemi, Brave**; Not/Sınıflar Ligi/Sertifika not-ver canlıdan copy; **🔨 asıl inşa = Yoklama** (hakediş entegrasyon noktası). ([[project-trainer-rebuild]])
  - **REVİZE ÖNCELİK SIRASI:** (1) Ödeme FAZ-2 (ödeme planı + tahsilat + türetilen ödeme durumu + Gecikti uyarısı + hatırlatma) → (2) Satış Listesi + iptal(cascade) + rapor → (3) Kullanıcı/rol/yetki → (4) Eğitmen v2.
- [x] **STATÜ MODELİ UYGULANDI — Enrollment.status hizalandı (2026-06-24):** `EnrollmentStatus` = `active`/`on_hold`/`passive`/`completed`/`cancelled` (Türkçe etiket: Aktif/Beklemede/Pasif/Mezun/İptal; `frozen`+`transferred` kaldırıldı). `GET /persons` `derivePoolStatus` artık **enrollment-merkezli** (Person.status'tan değil; rollup aktif[grupsuz öne]>beklemede>mezun>pasif>iptal). **"Satışı Tamamla" → öğrenci Aktif** (createSale zaten `active` yazıyor, ek kod gerekmedi). `tsc`+ESLint temiz, COMMIT BEKLİYOR. **`on_hold`=Beklemede:** yalnız op MANUEL alır; **gruptan çıkarılmaz** (`groupId` korunur), **yoklamada görünür** (aktif sayılmaz). **⚠️ FAZ-2 takip:** roster/yoklama şu an `active`-only filtreliyor → `on_hold`'u DAHİL etmeli (Eğitmen v2'de). Tam model [[project-status-model]].
- [x] **ÖDEME FAZ-2 BACKEND BİTTİ + DOĞRULANDI (2026-06-24, 30 assertion):** Tahsilat/taksit Firestore'a iniyor. **Domain:** `eduos/payment.ts` genişletildi (Payment: method[cash/card/transfer/senet]/amount/installmentNo/installmentTotal/dueDate/paidAt; durum SAKLANMAZ) + `Sale.financingFee` (senet vade farkı = ayrı gelir). **Servis `payment-service.ts`:** `buildPayments` (peşin satırları→paidAt dolu; senet→**kalana** [net−peşin] FLAT vade farkı: `vade farkı=kalan×aylık%×N`, eşit taksit, aylık dueDate, son taksit yuvarlama yutar) + `derivePaymentStatus`/`derivePaymentRollup` (Planlandı/Yaklaşıyor[≤7gün]/Gecikti/Kısmi/Tamamlandı — okuma anında, `totalExpected=soldPrice+financingFee`'ye karşı) + `addMonths` (ay-sonu kıstırma). **Repo:** `payment-repo.ts` port + `payment-repo.firestore.ts` (`flexos_payments`, batch saveMany, eşitlik-only sorgu=index'siz). **Capability:** `payment.create/read` → satış/op/admin (eğitmen YOK — para görmez). **createSale wiring:** `input.payment` (peşin+senet) → Payment dokümanları üretip yazar, `financingFee`'yi Sale'e koyar, gated `payment.create`; route `firestorePaymentRepo` enjekte (`POST /sales` → paymentCount+financingFee döndürür). Firestore rules `flexos_payments` server-only. `tsc`+ESLint temiz, COMMIT BEKLİYOR. **EKSİK (FAZ-2b = UI):** (1) Satış formu henüz `payment` göndermiyor (peşin satırları=odemeSatirlari map + **senet vade farkı % inputu eklenecek**); (2) tahsilat okuma ucu (`GET /sales/[id]/payments` veya persons'a ödeme durumu) + havuz/satış-listesinde ödeme durumu rozeti. Model [[project-invoicing-billing]] (senet formülü) + [[project-status-model]].
- [x] **ÖĞRENCİ HAVUZU DETAY DRAWER — sekmeli + PII düzenleme + read-only ödeme + eğitim seçici BİTTİ (2026-06-25):** Drawer grup-ekleme **bottom-sheet** desenine geçti (`fx-sheet`/`fx-sheet-ov`, framer-motion slide-up, **50vh**, sidebar açıkta). **2 sekme:** **Bilgiler** (düzenlenebilir: ad/soyad/**telefon[formatlı]**/e-posta/**TC/doğum tarihi/adres**/cinsiyet + **veli** [varsa; Sale alanı]) · **Ödeme & Satış** (**SALT GÖRÜNTÜLEME**: Toplam/Ödenen/Kalan + rollup rozeti + ödeme planı taksit tablosu). **"Satın aldığı eğitimler" SELECTOR** (tek eğitim→**disabled**, 2+→**aktif**; her eğitim=enrollment; seçilen eğitime göre ödeme süzülür → [[project-student-card-hub]]). **Backend:** `GET /api/flexos/persons/[id]` (detay: tam PII + satışlar + ödeme planı, alan-bazlı kapılı) + `PATCH /api/flexos/sales/[id]` (veli, gated `person.pii.write`). **🐛 BUG FIX:** PATCH /persons/[id] `person.write` istiyordu (registry'de YOK → herkese 403, düzenleme hiç çalışmıyordu) → **`person.edit`**. **Test verisi:** `scripts/seed-flexos-test-student.mjs` ("Zeynep Test", 2 eğitim + 6 ödeme satırı [peşin+senet, gecikti/yaklaşıyor/planlı] + veli; `--clean` siler). **Ayrıca:** Eğitim Ekle "Satışa Başlat" butonu → **Grup Ekle turuncusu** (`#FF8D28→#D66500`); glow/shimmer animasyonları + ölü kod kaldırıldı. tsc+ESLint temiz (ekle'de 2 pre-existing lint hariç).
- **DURUM DÜZELTME (2026-06-25):** **Ödeme FAZ-2 esasen BİTTİ** — satış formu `payment` (peşin+senet) gönderiyor (`satis-yap` satır 343-369 → `flexos_payments` persist); eski "satış formu payment göndermiyor" notu **GEÇERSİZ**. Havuz listesinde ödeme rozeti YAPILMAYACAK (karar 2026-06-29); ödeme yalnız Finans modülünde.
- [x] **SATIŞ İPTALİ — soft + cascade BİTTİ (2026-06-26):** `sale.cancel` capability (red, audited) → registry + satis/operasyon/admin paketleri (eğitmen YOK). **Domain:** `Sale.cancelledAt/cancelledBy/cancelReason` alanları. **Servis:** `cancelSale(actor, {saleId, reason?}, deps)` — Sale→cancelled + bağlı TÜM enrollment'ları→cancelled cascade; zaten iptal olan enrollment atlanır; Person/Enrollment SİLİNMEZ (audit/remarketing). `EnrollmentRepo.listBySale` eklendi (port+firestore). **Route:** `POST /api/flexos/sales/[id]/cancel` (body `{reason?}`). **UI:** Satış Listesi'ne "İşlem" kolonu + "İptal Et" butonu (yalnız aktif satışlarda) + **iptal onay modalı** (uyarı notu + opsiyonel sebep textarea + "Satışı İptal Et" / "Vazgeç"). Başarıda liste yenilenir, toast. **12 assertion geçti** (admin/satis/op başarılı, eğitmen reddedildi, zaten-iptal/varolmayan ValidationError, çoklu-enrollment cascade [2/3 iptal — 1 zaten iptal atlandı], sebepsiz iptal OK). `tsc` temiz.
- [x] **KULLANICILAR CRUD BİTTİ (2026-06-27):** `flexos_users` koleksiyonu + tam CRUD backend (POST/GET/PATCH/DELETE `/api/flexos/users`) + domain (FlexosUser tipi, 6 rol, repo, servis) + UI (liste [personel/öğrenci sekmeleri] + ekle + düzenle + sil + durum toggle) + `role.manage` capability (admin-only) + sidebar linki. **Commit:** 08bedb7 + 51164e9.
- [x] **AKTİVİTE MERKEZİ BACKEND BİTTİ (2026-06-29)** — CRM/Talep altyapısı sıfırdan. **Domain (crm/):** `case.ts` (Talep: channel/type/status/activityCount/outcome) + `activity.ts` (Aktivite: tip/note/nextAction/appointmentId) + `appointment.ts` (Randevu: ayrı koleksiyon, takvim modülü migration'sız bağlanacak). **Repo portları:** `case-repo.ts` (listOpenByPerson dedup için) + `activity-repo.ts` (listByCase) + `appointment-repo.ts`. **Capability:** `case.create/read/edit`, `activity.create/read`, `appointment.create/read` → registry + satis/admin tümü, operasyon okur. **Servis `case-service.ts`:** `createCase` (dedup: açık talep varsa hata — aynı kişi aktif listede ~1 kez, kapalı talep→yeni talep açılabilir), `addActivity` (talep güncelle/activityCount++/lastActivityAt; randevu→status=randevu_olusturuldu; closeCase→outcome), `updateCase`. **Firestore:** `flexos_cases`+`flexos_activities`+`flexos_appointments` koleksiyonları; 3 adapter. **Route'lar:** `GET/POST /api/flexos/cases` (POST: personId veya personData[TC dedup→prospect Person otomatik] kabul eder; GET: personName join) + `GET/PATCH /api/flexos/cases/[id]` (tekil+aktivite timeline) + `POST /api/flexos/activities` (aktivite ekle+randevu+kapat). `tsc` temiz. **UI BEKLENIYOR** (Claude Design çıktısı gelince port edilecek).
- [ ] **SIRADAKİ** — **Yetki katmanı geçişi** (flexos_users rolleri → Actor mapping: `auth-actor.ts`'de FlexOS rollerinden paket çözümü + `authUid` Firebase Auth kullanıcı oluşturma + öğrenci sekmesi backend bağlama — canlı öncesi şart [[project-sube-scope]]) · **Şube Aşama-2** (kullanıcıya şube ata → `Actor.branchIds`, liste uçlarını şubeye göre süz) · **Finans modülü** (tahsilat takibi + ödeme durumu görüntüleme + gecikme uyarısı + eğitmen hakediş; ödeme rozeti havuz listesinde DEĞİL, yalnız Finans'ta — [[project-invoicing-billing]]) · Kurumsal **Firmalar** ([[kurumsal-modul-firmalar]]) · Katalogda bireysel/kurumsal **ayrı gruplu liste** · Canlı trainer rebuild ([[project-trainer-rebuild]]).
- [ ] **PLANLANAN — Öğrenci Profili tam-sayfa hub (karar 2026-06-25):** Öğrenci kartı ileride `/flexos/ogrenciler/[id]` TAM SAYFA olacak; havuzdaki 50vh drawer hızlı bakış/temel düzenleme için kalır ("Tüm profili aç →" linki). **Model: her eğitim = bir Enrollment kaydı** (1 Person → N Enrollment, her biri kendi grup/yoklama/not/sertifika/**o satışın ödemesi** + kendi status'ü; öğrenci Grafik'te Mezun, Web'de Aktif olabilir — [[project-status-model]] ile uyumlu). **UI kuralı:** üst sekmeler **Bilgiler (kimlik, GLOBAL — seçiciden bağımsız)** + **Eğitimler**; Eğitimler sekmesinde "satın aldığı eğitimler" **seçici** = enrollment listesi → **tek eğitimde DISABLED, 2+ eğitimde AKTİF** (seçilen eğitime geçilir, alt sekmeler [Genel/Yoklama/Notlar/Ödeme/Sertifika] o enrollment bağlamıyla dolar). Kimlik (ad/TC/tel/adres/veli) global; sadece eğitim-bağlamlı veri seçince değişir. Bonus: bugünkü "Ödeme & Satış" sekmesi (şu an tüm satışları topluyor) bu modelde eğitim-bazlı olur. **Asıl değer yoklama/not domaini gelince** çıkar → o etapta kurulacak ([[project-trainer-rebuild]], [[project-student-pool]]).
- [ ] **(eski, artık BİTTİ 2026-06-18)** Eğitim Ekle eksikleri + backend'e bağla:
  1. **"Bölüm" kavramı kararı** — form hiyerarşisi Eğitim→**Bölüm**→Track ama domain Branş→Eğitim→Track (Bölüm YOK). Üç ihtimal: (a) Bölüm = sadece UI gruplama, DB'ye yazılmaz Track'ler düz Education altına (en hızlı, domain değişmez); (b) Bölüm = Eğitim, üst "Eğitim Adı" = şemsiye/paket; (c) Bölüm = yeni 4. seviye entity (en çok iş). Kullanıcı henüz seçmedi — wiring'den önce karar şart.
  2. **Branş dropdown'ını gerçek veriye bağla** (`GET /api/flexos/branches`).
  3. **Education tipini büyüt** — audience (bireysel/kurumsal — ayrı havuz için şart), deliveryMode, durationType (saat/gün), gunSayisi, contractType, description, salesModel.
  4. **Gün-bazlı içerik** (günler+konular) domain karşılığı yok → nereye yazılacak kararı.
  5. Form→DTO map + `POST /api/flexos/educations` + Track (çift seviye fiyat, commit 1ef8e56). Sonra katalog listesi otomatik dolar. NİHAİ HEDEF: gerçek eğitimleri girmeye başlamak.
- [ ] **Katalog işlevsellik bekleyenler (kullanıcı kararları 2026-06-17):**
  - **Kurumsal ≠ Bireysel ayrı gelir havuzu** → kataloğta kurumsal/bireysel eğitimleri **ayrı liste veya ayrı filtre** ile göster (AYRI SAYFA DEĞİL — aynı "Eğitim Ekle" ekranından eklenir, sadece listeleme/filtre ayrışır). Sebep: gelirler ileride ayrı havuzda toplanacak.
  - **Sözleşme yönetimi (ileride)** → "Sözleşme Tipi" şu an statik option listesi; ileride kendi sözleşme metinlerimizi ekleyeceğimiz bir alan/modül olacak. Şu an elde gerçek sözleşme yok, ertelendi.
- [ ] Öğrenci ekle + Grup ekle UI (backend hazır, hızlı bağlanır)
- [ ] Havuz görünümü (enrollment listesi + grupsuz/gruplu filtre) + "gruba yerleştir"
- [ ] Backfill (`students`→`persons`, `groups`→`flexos_groups`, tek yönlü)

---

## İçindekiler

1. [Vizyon, Felsefe ve Modül Haritası](#1-vizyon-felsefe-ve-modül-haritası)
2. [Veri Modeli ve Mimari Katmanlar](#2-veri-modeli-ve-mimari-katmanlar)
3. [Capability & Yetki Modeli](#3-capability--yetki-modeli)
4. [MVP Çekirdek Akış (Blueprint)](#4-mvp-çekirdek-akış-blueprint)
5. [Süreç Sorumlulukları, Öğrenci Kartı ve Güvenlik](#5-süreç-sorumlulukları-öğrenci-kartı-ve-güvenlik)
6. [Yol Haritası ve İnşa Sırası](#6-yol-haritası-ve-inşa-sırası)

---

# 1. Vizyon, Felsefe ve Modül Haritası

## Temel Felsefe

Flex, bir eğitim kurumunun tüm işlemlerini yapacağı bir **işletim sistemidir**.

**Öğrenci merkezli sistem.** Öğrenci gruba, eğitime veya satışa bağlı düşünülmez.
Öğrenci sistemin ana varlığıdır. Satışlar, ürünler, eğitimler, gruplar ve sertifikalar öğrenci etrafında şekillenir.

```
Kişi (Öğrenci)
↓
Satış
↓
Ürün / Paket
↓
Eğitim Kayıtları (Enrollment)
↓
Gruplar
↓
Eğitim Süreci (Yoklama / Not / Sertifika)
```

### Kök Felsefe — Person ≠ Enrollment

**Person (insan) ≠ Enrollment (gruptaki katılım).** Sınıfa özel her şey (devam, not, ödev, sertifika) Enrollment'ta tutulur. Aynı insan birden çok gruba (eş zamanlı dahil) katılabilir → **1 Person + N Enrollment**. Mevcut sistemde `students` aslında bir üyelik kaydı; bu yüzden "aynı insan için çok doküman", "aynı mail", "eş zamanlı grup" sorunları çıkıyor. Çözüm: kişiyi üyelikten ayır.

**"Eğitime göre öğrenci, kuruma göre müşteri"** — bu bir tip değil, bakış açısı. Aynı kişi satış için müşteri, eğitmen için öğrenci.

## Platform Vizyonu (Monorepo)

**Flex**, tasarım eğitim ekosistemi için çok uygulamalı bir platform. Şu an tek Next.js repo içinde yaşıyor; ileride Turborepo monorepo'ya bölünebilir.

```
flex-platform/
  packages/shared/     → ortak tipler, Firebase config, bildirim tipleri
  apps/
    trainer/   ← ŞU AN BURADAYIZ — eğitmen + admin + öğrenci aynı repoda
    portal/    → yeni öğrenci portalı (ileride)
    ops/       → Eğitim Operasyon (ileride)
    crm/       → Satış (ileride)
    connect/   → Teams benzeri iletişim (ileride)
```

**Flex-Trainer tamamlanma kriteri:** Yoklama modülü ✅ + Sertifikasyon akışı (devam ediyor).

> **Deployment notu:** Bugün tek root, tek Next.js uygulaması; modüller route bazlı ayrılır.
> Separate repo veya Turborepo bugün **gerekmez** — auth, veri ve UI ortak, ekip küçük, overhead gereksiz.
> Monorepo'ya bölme ancak uygulamalar gerçekten ayrıştığında yapılır.

## Mevcut Durum (Geçici)

Eğitim Operasyonu ve Satış modülleri henüz geliştirilmediği için grup yönetimi **geçici olarak** eğitmen tarafında yapılmaktadır.

Eğitmen şu an: grup oluşturuyor · öğrenci ekliyor · yoklama alıyor · proje notu giriyor.

Bu yapı geçicidir. Uzun vadede **eğitmen grup yönetemez**; bu sorumluluk Eğitim Operasyonu'na geçecektir.

## Modül Haritası

```
flex/
├── trainer/       ← Eğitmen Paneli (mevcut, neredeyse tamamlandı)
├── operation/     ← Eğitim Operasyonu (sıradaki büyük modül)
├── sales/         ← Satış
├── finance/       ← Muhasebe
└── shared/        ← Ortak sistemler (öğrenci, bildirim, sertifika, arama)
```

| Modül | Alt süreçler |
|-------|--------------|
| **Trainer** (Eğitmen) | dashboard · attendance · projects · students* · certificates · grading |
| **Operation** (Eğitim Op) | groups · planning · schedules · trainers · certificates |
| **Sales** (Satış) | leads · sales · products · enrollments |
| **Finance** (Muhasebe) | payments · contracts · collections |
| **Shared** (Ortak) | students · notifications · quick-search · certificates |

\* `trainer/students` geçicidir, ileride `operation`'a geçer.

## Önemli Prensip — Veri Tekrarı Yok

Yanlış: `trainer/students` + `operation/students` + `sales/students` (aynı veri üç yerde).
Doğru: **`shared/students`** — tek kaynak, tüm modüller buraya erişir.

Rol klasörleri **ekran ve süreç** ayrımı içindir. Veri yapıları ve ortak sistemler **shared** altındadır.

```
Trainer / Operation / Sales / Finance   = süreç
Students / Quick Search / Notifications / Certificates   = ortak veri & servis
```

---

# 2. Veri Modeli ve Mimari Katmanlar

> **Durum:** Tasarım/tartışma kilitlendi (2026-06-09). Kod yazılmadı.

## 2.1 Ayrılabilirlik Kısıtı (en kritik mimari kural)

Eğitmen tarafı ileride **"Flex Classroom"** olarak ayrı ticari ürün çıkabilmeli. Bu yüzden iki katman:

| Katman | İçerik | Bağımlılık |
|--------|--------|------------|
| **Core (Classroom)** | Person, Enrollment, Group, Module + eğitim verisi (yoklama/not/ödev/sertifika sonucu) | Kendi kendine yeter, üst katmanı **bilmez** |
| **FlexOS (üst katman)** | Education (ürün), Sale, Payment, Account (firma), Quota, Branş, Şube, gelir raporu | Core'u besler, Core'a bağımlı |

**Demir kural:** Bağımlılık tek yönlü → `FlexOS → Core`. Core, FlexOS'tan import etmez.
Üst katmandan gelen tüm alanlar Core'da **opsiyonel/nullable** (`Enrollment.saleId?`, `Person.accountId?`).
Klasör: `lib/domain/core` ve `lib/domain/eduos`.

**İki kapı:** Enrollment iki yoldan doğabilir:
1. **Eğitmen quick-add (Core):** satış YOK, grup+öğrenci manuel. Standalone Classroom böyle çalışır.
2. **Satış (FlexOS):** Sale → Person + Enrollment.

## 2.2 Hiyerarşi

```
ŞUBE (lokasyon: Kadıköy/Şirinevler/Pendik — satış ekibi buraya bağlı)
BRANŞ (disiplin/genel ad: Grafik Tasarım, Yazılım)
   └─ EĞİTİM (branşa ait eğitim: Grafik-1, Grafik-2, Python)
        └─ TRACK (eğitimin AYRI SATILABİLİR parçası: Temel Photoshop, Temel Illustrator — fiyat/satış burada; eski "Modül"ün yeri)
             └─ GRUP / SINIF (eğitmen, takvim, kontenjan, type)
                  ├─ Attendance (Yoklama)
                  ├─ Grades (Not / XP)
                  └─ Certificate (Sertifika sonucu)
```

- **Şube ≠ Branş.** Şube = fiziksel lokasyon + satış ekibi. Branş = disiplin. Gelir raporu ikisini de ister → Sale her ikisini taşır (şube doğrudan, branş eğitim üzerinden).
- **Eğitim = branşa ait eğitim (Grafik-1, Grafik-2); Track = eğitimin satılan parçası (Temel Photoshop).** (2026-06-15 netleşti.) Track, eski "Modül"ün yerini alır — artık ayrı satılabilir. Fiyat/satış **Track** seviyesinde. Paket = birden çok Track'in (veya tüm eğitimin) tek total fiyatla satılması.
- **Grup = somut sınıf.** Branş + Eğitim + Track seçilerek tanımlanır (eğitmen, takvim, kontenjan, type).
- **Track'ler "Eğitim Ekle" modülünün İçerik sekmesinde tanımlanır** (add-to-list: track adı+içerik gir → Ekle → listeye eklenir). **Çift seviye fiyat:** tüm eğitim fiyatı (`Education.listPrice`) AYRI + her track fiyatı (`Track.listPrice`) AYRI. Track tek başına satılabilir; `Track.sellable` toggle ile "track satışını kapat". Satış liste fiyatını görür, kampanya (% indirim) liste üzerinden uygulanır → `Sale.soldPrice`.

### Ortak Track (cross-education)
Bir Track farklı eğitimlerin öğrencilerine **ortak sınıfta** verilebilir. Örnek: AutoCAD/sosyal medya öğrencisi "Temel Photoshop" track'ini mevcut Grafik-1 grubunun ilgili haftalarına katılarak alır (ayrı sınıf açılmaz). Track bitince mezun edilir, yoklaması kilitlenir.

## 2.3 Varlıklar ve Alanlar

> Katman etiketi: **(Core)** = Classroom çekirdeği, **(FlexOS)** = üst katman.

### Person (Core) — merkez, kalıcı
`id, kimlik{tip: tc|pasaport|yabancı, no}, ad, soyad, telefon, email, cinsiyet, adres`
- **Kimlik = benzersiz anahtar.** Herkesin bir belgesi var (TC yoksa pasaport/yabancı kimlik).
- Sert benzersiz kısıt yerine: ekleme sırasında email/tel/kimlik ile **yumuşak eşleştirme** → "bu kişi zaten var olabilir, mevcut olanı mı kullanıyorsun?" insan onayı. Mail = yardımcı sinyal, sert kilit değil.
- **Grup/eğitim verisi YOK** (o Enrollment'ta).
- Sistemden **silinmez.** Öğrenci kurumun en değerli verisidir: birden fazla eğitim alabilir, birden fazla paket satın alabilir, farklı yıllarda geri dönebilir; geçmiş eğitimleri/grupları/sertifikaları korunur. (KVKK silme talebi → anonimleştir, eğitim geçmişi kalır.)

### Enrollment (Core) — kişinin bir GRUPTAKİ katılımı (kritik köprü)
Sistemin kritik köprü varlığı: Sale ile Group arasındaki bağ.

`id, personId, educationId, groupId?, trackScope?, başlangıçTarihi, bitişTarihi?, durum, saleId?`

```
Enrollment {
  personId
  saleId?           ← Core'da opsiyonel (standalone Classroom'da boş; FlexOS'ta zorunlu)
  educationId       ← paketteki hangi eğitim
  groupId?          ← hangi gruba yerleşti (boş = grupsuz havuzda bekliyor)
  trackScope?       ← boş = grubun eğitiminin tüm track'leri; dolu = sadece o Track(ler)
  durum             ← aktif | dondurulmuş | mezun | tamamlandı | transfer | tekrar | bıraktı
  transferHistory[] ← grup değişiklik geçmişi

  // ── Donmuş sonuç (sınıf bitince yazılır, kalıcı) ──
  result {
    finalNot          ← eğitmenin notundan hesaplanan nihai not
    projeNot
    odevPuani
    groupCode         ← hangi sınıfta alındı (denormalize)
    module            ← hangi modül/eğitim
    branch
    donem             ← hangi dönem/yıl
  }
  certificate {
    durum             ← bekliyor | hak_kazandı | kalamadı | verildi
    tip               ← Katılım | Başarı | MEB
    kod               ← belge no (verilince)
    verilisTarihi
  }
}
```

- **Yoklama / not / ödev** grup seviyesinde tutulur (mevcut sistem: `design_attendance` grup bazlı, `gradedTasks` classId bazlı — **DEĞİŞMİYOR**).
- **Not + Sertifika sonucu Enrollment'ta DONAR.** Eğitmenin girdiği not, sınıf bitince (modül finalize / mezuniyet) nihai nota hesaplanır ve **o anda enrollment'a snapshot'lanır** — sonradan ödev/ağırlık değişse veya grup silinse bile **değişmez**. Sertifika dondurulmuş bir gerçektir, her açılışta yeniden hesaplanmaz.
- **Her eğitim ayrı saklanır.** Bir Person birden çok Enrollment taşır; her birinin notu, sertifikası ve sınıf bilgisi ayrı ayrı durur. Aynı kişinin Grafik-1 notu ile Grafik-2 notu bağımsızdır.
- **Sertifika verilmesi kurumun işidir, eğitmenin değil.** Eğitmen yalnızca notu besler (`certificate.durum = hak_kazandı`). Basım/dağıtım Eğitim Operasyonu'nda ayrı adımdır (bkz. §5 Sertifika Akışı).

> Bugünkü sistem notu canlı hesaplayıp `projectGrades`'e yazıyor; donmuş per-enrollment sonuç + sertifika alanları **sıfırdan inşada** eklenecek. 1. etapta sertifika üretilmez ama şema baştan bu alanları taşır.

### Group / Sınıf (Core)
`id, educationId, instructorId, takvim, kontenjan, type, şubeId, durum`
- `type`: standart | özel_ders | kurumsal (teslim formatı).
- `instructorId`: gruba atanan eğitmen. Öğrenci gruba girince bu eğitmenin altına düşer.
- **Gruplar geçicidir.** İsimler değiştirilmez, yeni grup oluşturulur; öğrenciler eski gruptan seçilerek yeni gruba aktarılır → geçmiş yoklama/not/sertifika korunur.

**Grup yaşam döngüsü:**
```
Planlandı → Kayıt Alıyor → Aktif → Ertelendi → Tamamlandı → Sertifika Sürecinde → Arşiv
```

### Module (Core)
`id, educationId, ad, sıra, saat`

### Education / Eğitim (FlexOS) — satılan ürün
`id, ad, branşId, listeFiyatı, kdv, satışaAçık, modules[], sertifikaTanımı`
- `listeFiyatı`: ürün fiyatı (+KDV otomatik). Değişince satış ekranı görür.
- `sertifikaTanımı`: hangi sertifika (Katılım/Başarı/MEB) + koşullar (min devam %, min not, MEB belge bilgisi). **Şu an yanlış yerde** (`users/{instructorId}.certSettings`) → buraya taşınacak.
- Paket = bundle-tipi Education (içinde N education referansı, tek total fiyat).
- Ödeme **ürün seviyesinde** tutulur, devam **eğitim seviyesinde** tutulur. Tek eğitim satışı da, paket satışı da desteklenir.

### Sale / İşlem (FlexOS) — enrollment hareket defteri
`id, tip, customerType, personId, accountId?, educationId(ler), satışFiyatı, salespersonId, şubeId, tarih`
- `tip`: yeni_satış | transfer | tekrar | yerleştirme.
- **Her öğrenci hareketi bir Sale ile başlar — tutar 0 TL olsa bile** (Bilge Adam deseni: güvenlik/denetim, tek giriş kapısı, headcount-gelir tutarlılığı). Transfer/tekrar = çoğu 0 TL.
- `satışFiyatı`: kampanya/indirim sonrası **fiilen satılan** tutar. Gelir raporu bundan çıkar (≠ liste fiyatı).
- `customerType`: bireysel | kurumsal. Özel ders = bireyselin içinde bir tip (Grup.type).
- Paket satışı → 1 Sale → N Enrollment.

### Account / Müşteri (FlexOS) — kurumsal
`id, firmaAdı, yetkili, telefon, ...` → 1 firma N Person.
- Bireyselde ödeyen = kişinin kendisi (ayrı Account yok).
- **Kurumsal en baştan ayrı:** ayrı panel, ayrı firma/yetkili verisi, ayrı gelir (rapor istenirse birleştirilir).

### Payment (FlexOS)
Taksit/tahsilat. `tutar, taksit, durum`. (1. etap dışı, alan hazır.)

### Quota (FlexOS)
**Gelir bazlı** (örn "ay 200k"). Satışçı bazlı + genel.

## 2.4 Akışlar

### Bireysel satış → grup → eğitmen (1. ETAP HEDEFİ)
```
1. SATIŞ      Satışçı eğitim seçer + kişi (yeni/mevcut)
              → Person + Sale + Enrollment(groupId boş, durum=havuzda)
2. GRUBA EKLE Eğitim op havuzdaki enrollment'ı uygun gruba atar
              → groupId set, durum=aktif
3. EĞİTMEN    Grup zaten bir eğitmene ait (Group.instructorId)
              → öğrenci o eğitmenin altına düşer
```

### Ortak Track / dış öğrenci (Ahmet AutoCAD → Temel Photoshop)
Eğitim op uygun (yeni başlayan) Grafik-1 grubu bulur → Ahmet'i yerleştirir (ek satış veya 0 TL transfer) → Track bitince mezun eder → yoklama kilitlenir, enrollment kapanır. `trackScope = "Temel Photoshop"`.

### Transfer / tekrar
Eski enrollment'ı kapatan + yeni enrollment açan 0 TL'lik Sale (tip=transfer/tekrar). Eski veri (yoklama/not/sertifika) silinmez — eski grubun anahtarıyla ayrı kayıtlarda durur.

## 2.5 Non-Functional Kriterler ("1 sene sonra da çalışsın")

1. **Veri şişmesi:** Person dokümanı küçük; yoklama/not/ödev Enrollment'ın alt-koleksiyonlarında ayrı dokümanlar. Doküman-içi sınırsız array/map YOK (mevcut `gradedTasks` map'i bu hatanın örneği). "Tek alanda gör" = okuma-zamanı birleştirme, tek dev doküman değil.
2. **Firestore ölçek/maliyet:** Bu ölçekte (yüzler–binler öğrenci, yıllar) yeterli. Sınır boyut değil okuma-sayısı. Full-collection `onSnapshot` YOK → `where`+`limit`+sayfalama. Raporlamada aggregation sorgusu veya aylık rollup dokümanı (şube+branş+ay → toplam). İndeks: şube, branş, tarih.
3. **Security:** Veriyi concern'e göre ayrı koleksiyonlara böl (satış/ödeme/eğitim). Rules modelle BİRLİKTE tasarlanır. Person/Enrollment ayrımı güvenliği kolaylaştırır (öğrenci kendi enrollment'ı, eğitmen kendi grubunun enrollment'ları, finans ödeme).

---

# 3. Capability & Yetki Modeli

> Departman-agnostik domain ve atomik yetki (capability) referansı.
> Yetki sisteminin, modüler mimarinin ve AI entegrasyonunun temelidir.
> Yeni bir modül/ekran/eylem eklerken önce buraya bakılır, capability buradan türetilir.

## 3.1 Tasarım İlkeleri

**1. Capability = bir domain üzerinde atomik eylem.** Departmana değil, işe bağlı.
Kodda asla `if (role === "satış")` yok; her zaman `can("student.create")`.

**2. İsimlendirme:** `domain.action` veya `domain.subdomain.action` — küçük harf, nokta ayraç, fiil sonda. Örn: `attendance.write`, `certificate.issue`, `person.note.read`.

**3. Scope ayrı bir eksen — capability'yi şişirmez.** Her yetki *grant*'i bir kapsam taşır:

| Scope | Anlamı | Tipik |
|-------|--------|-------|
| `self` | Sadece kendi kaydı | Öğrenci portalı |
| `assigned` | Atanmış grup/öğrenci | Eğitmen |
| `branch` | Şube geneli | Şube müdürü |
| `org` | Tüm kurum | Admin / Operasyon |

`attendance.write @assigned` (eğitmen) ile `attendance.write @org` (operasyon) **aynı capability, farklı scope**.

**4. Rol/Departman = capability+scope paketinin isimlendirilmiş hali.** Veride sabit değil, düzenlenebilir. "Eğitmen", "Satış", "Kıdemli Eğitmen" hepsi birer paket. Departman→yetki eşleşmesi kuruma göre değişir; bu yüzden sabitlenmez.

**5. Hassasiyet seviyesi** her capability'nin metadata'sı — audit, ekstra onay ve AI gating'i belirler:
- 🟢 **Normal**
- 🟡 **Hassas** — PII/scope kritik, audit'lenir
- 🔴 **Kritik** — geri alınamaz / maliyetli / hukuki → zorunlu audit + insan onayı

**6. Capability Registry şeması** (kayıt başına):

```ts
{
  key: string;            // "assignment.cancel"
  domain: string;         // "assignment"
  label: string;          // "Ödevi İptal Et"  (TR — AI grounding)
  description: string;    // ne yaptığı (TR)
  sensitivity: "green" | "yellow" | "red";
  write: boolean;         // okuma mı yazma mı (audit + AI güvenliği)
  scopable: boolean;      // scope ekseni uygulanır mı
  audited: boolean;       // audit log'a düşer mi
}
```

Bu tek şema 4 şeyi birden besler: **yetki UI'ı · middleware · audit log · AI tool yüzeyi.**

## 3.2 Domain Haritası

| # | Domain | Rol |
|---|--------|-----|
| 1 | `person` (Öğrenci/Kişi) | Merkezi varlık |
| 2 | `enrollment` (Eğitim Kaydı) | Köprü |
| 3 | `group` (Grup) | Süreç kabı |
| 4 | `attendance` (Yoklama) | Eğitim süreci |
| 5 | `grade` (Not) | Eğitim süreci |
| 6 | `assignment` (Ödev/Çekiliş) | Eğitim süreci |
| 7 | `certificate` (Sertifika) | Çıktı |
| 8 | `task` (Görev — operasyonel) | İş akışı |
| 9 | `notification` (Bildirim) | Kanal |
| 10 | `sms` / `email` (İletişim) | Kanal |
| 11 | `system` (user/role/audit/import) | Çapraz |

> **Kapsam dışı (sonraki tur):** `sale`, `payment`, `contract` — Satış/Finans domain'leri. Eğitim Operasyonu'na geçmeden ele alınmayacak.

## 3.3 Capability Tabloları

### 1. `person` — Öğrenci / Kişi
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `person.create` | Yeni kişi kaydı aç | 🟡 | – |
| `person.read` | Temel bilgi (ad, durum, grup) | 🟢 | ✓ |
| `person.read.pii` | TC, telefon, e-posta, adres | 🟡 | ✓ |
| `person.edit` | Temel bilgileri düzenle | 🟡 | ✓ |
| `person.deactivate` | Pasife al (mezun/ayrıldı) | 🟢 | ✓ |
| `person.anonymize` | KVKK silme → anonimleştir | 🔴 | – |
| `person.merge` | Çift kayıtları birleştir (legacy dedup) | 🔴 | – |
| `person.note.read` | Eğitmen notlarını gör (blur açma) | 🟡 | ✓ |
| `person.note.write` | Eğitmen notu ekle/düzenle | 🟢 | ✓ |
| `person.history.read` | Grup/enrollment geçmişi | 🟢 | ✓ |
| `person.consent.manage` | KVKK rıza durumu | 🔴 | – |
| `person.export` | Liste/kişi verisi dışa aktar | 🟡 | ✓ |
| `person.search` | Ctrl+K global arama | 🟢 | ✓ |

### 2. `enrollment` — Eğitim Kaydı (köprü)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `enrollment.create` | Kişiyi bir eğitime kaydet | 🟡 | – |
| `enrollment.read` | Kayıt + donmuş sonucu gör | 🟢 | ✓ |
| `enrollment.edit` | Kayıt alanlarını düzenle | 🟡 | ✓ |
| `enrollment.transfer` | Grup değiştir (geçmiş korunur) | 🟡 | ✓ |
| `enrollment.freeze` | Dondur | 🟢 | ✓ |
| `enrollment.resume` | Dondurulmuşu aktif et | 🟢 | ✓ |
| `enrollment.complete` | Mezuniyet → **sonucu DONDUR** | 🔴 | ✓ |
| `enrollment.cancel` | Kaydı iptal et | 🟡 | ✓ |

### 3. `group` — Grup
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `group.create` | Grup oluştur | 🟢 | ✓ |
| `group.read` | Grup detayı | 🟢 | ✓ |
| `group.edit` | İsim/branş/seans düzenle | 🟢 | ✓ |
| `group.archive` | Arşive al | 🟡 | ✓ |
| `group.delete` | Kalıcı sil | 🔴 | ✓ |
| `group.assign_student` | Öğrenci yerleştir | 🟡 | ✓ |
| `group.remove_student` | Öğrenci çıkar | 🟡 | ✓ |
| `group.assign_trainer` | Eğitmen ata | 🟡 | ✓ |
| `group.activate` | Planlandı → Aktif (yoklama açılır) | 🟡 | ✓ |
| `group.postpone` | Ertele | 🟢 | ✓ |
| `group.complete` | Tamamlandı'ya al | 🟡 | ✓ |
| `group.schedule.edit` | Takvim/tatil yönetimi | 🟢 | ✓ |
| `group.league.toggle` | Lig sistemini aç/kapat | 🟢 | ✓ |

### 4. `attendance` — Yoklama
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `attendance.read` | Yoklama kayıtlarını gör | 🟢 | ✓ |
| `attendance.start` | Dersi başlat | 🟢 | ✓ |
| `attendance.write` | Yoklama al/işaretle | 🟢 | ✓ |
| `attendance.close` | Dersi bitir/kapat | 🟢 | ✓ |
| `attendance.edit_past` | Geçmiş yoklama düzelt (zaman-kilidi aşımı) | 🟡 | ✓ |
| `attendance.report.read` | Yoklama raporları | 🟢 | ✓ |
| `attendance.export` | Rapor dışa aktar | 🟡 | ✓ |

### 5. `grade` — Not
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `grade.read` | Notları gör | 🟢 | ✓ |
| `grade.write` | Proje notu / XP gir | 🟢 | ✓ |
| `grade.settings.edit` | Ağırlıklar, certSettings | 🟡 | ✓ |
| `grade.finalize` | Modülü bitir → **not donar** | 🔴 | ✓ |
| `grade.report.read` | Not raporları | 🟢 | ✓ |

### 6. `assignment` — Ödev (Çekiliş + Teslim)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `assignment.create` | Ödev tanımla/ata | 🟢 | ✓ |
| `assignment.read` | Ödev/arşiv gör | 🟢 | ✓ |
| `assignment.edit` | Ödev düzenle | 🟢 | ✓ |
| `assignment.draw` | Çekiliş yap | 🟢 | ✓ |
| `assignment.cancel` | Ödevi iptal et (cascade) | 🟡 | ✓ |
| `assignment.archive.delete` | Arşiv kaydını kalıcı sil | 🔴 | ✓ |
| `assignment.pool.manage` | Havuz (marka/kitap/kategori) tanımları | 🟡 | – |
| `assignment.submission.read` | Öğrenci teslimlerini gör | 🟢 | ✓ |
| `assignment.submission.grade` | Teslimi puanla | 🟢 | ✓ |

### 7. `certificate` — Sertifika
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `certificate.eligibility.read` | Hak ediş hesabını gör | 🟢 | ✓ |
| `certificate.read` | Sertifika durumu/kaydı | 🟢 | ✓ |
| `certificate.issue` | **Bastır → durum=verildi** (kurum yetkisi) | 🔴 | – |
| `certificate.revoke` | Sertifikayı iptal et | 🔴 | – |
| `certificate.template.manage` | Şablon/MEB bilgileri | 🟡 | – |
| `certificate.export` | PDF üret | 🟡 | ✓ |

> Mimari kuralı: **eğitmende `certificate.*` yazma yok**, sadece `grade.*`.
> Hak ediş `grade.finalize` ile beslenir, basım `certificate.issue` ile kurumda.

### 8. `task` — Görev (operasyonel iş akışı)
> Öğrenci ödevinden (`assignment`) farklı: personele atanan iç işler — "şu öğrenciyi ara", talep/şikayet, grup açma talebi.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `task.create` | Görev oluştur | 🟢 | ✓ |
| `task.read` | Görevleri gör | 🟢 | ✓ |
| `task.assign` | Birine/departmana ata | 🟢 | ✓ |
| `task.update` | Durum/içerik güncelle | 🟢 | ✓ |
| `task.complete` | Tamamla | 🟢 | ✓ |
| `task.delete` | Sil | 🟡 | ✓ |
| `task.comment` | Yorum ekle | 🟢 | ✓ |

### 9. `notification` — Bildirim (uygulama içi)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `notification.read` | Kendi bildirimlerini gör | 🟢 | `self` |
| `notification.send` | Tekil/grup bildirimi gönder | 🟢 | ✓ |
| `notification.broadcast` | Toplu bildirim | 🟡 | – |
| `notification.template.manage` | Şablon yönetimi | 🟡 | – |

### 10. `sms` / `email` — İletişim Kanalları
> Kanal = maliyet/hukuk taşır. Toplu gönderim ayrı ve kritik.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `sms.send` | Tekil SMS | 🟡 | ✓ |
| `sms.bulk_send` | Toplu SMS (maliyet) | 🔴 | – |
| `email.send` | Tekil e-posta (ödev maili vb.) | 🟢 | ✓ |
| `email.bulk_send` | Toplu e-posta | 🟡 | – |
| `messaging.template.manage` | SMS/e-posta şablonları | 🟡 | – |
| `messaging.log.read` | Gönderim logları | 🟡 | ✓ |

### 11. `system` — Çapraz / Yönetim
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `user.create` | Personel hesabı aç | 🟡 | ✓ |
| `user.edit` | Personel düzenle | 🟡 | ✓ |
| `user.deactivate` | Personeli pasife al | 🟡 | ✓ |
| `role.manage` | **Capability paketlerini düzenle** (meta yetki) | 🔴 | – |
| `capability.grant` | Kişiye tekil yetki ver/al | 🔴 | – |
| `audit.read` | Audit log oku | 🟡 | ✓ |
| `settings.platform.manage` | Platform ayarları | 🔴 | – |
| `import.run` | Legacy/veri içe aktarım | 🔴 | – |

### Kabaca Sayılar
~75 atomik capability · 11 domain · 4 scope · 3 hassasiyet seviyesi. Bundan **sınırsız rol** türetilir:
- Eğitmen ≈ 12 capability `@assigned`
- Operasyon ≈ 40 capability `@org`
- Satış ≈ `enrollment` + `person` + (sonra `sale`) paketi
- Admin ≈ tümü `@org`

## 3.4 AI-Ready Foundations

> Hedef: ileride AI-destekli, **kimsede olmayan** bir yapı. Farkı yaratan AI modeli değil,
> **her eylemin AI tarafından adreslenebilir olması.** Bunu bugün ucuza kurulan bir omurga sağlar.
> AI bugün yazılmaz; sadece kemikleri AI-hazır yapılır.

### Omurga: Action (Komut) Katmanı
Her mutasyon tek bir isimli, doğrulanan, capability-korumalı sunucu fonksiyonundan geçer:

```
İnsan UI ─┐
          ├─► executeAction("assignment.cancel", { taskId }, actor)
AI ajanı ─┘        → can(actor, capability, scope)?
                   → validate(args)
                   → write
                   → emitEvent(actor, capability, entity, before/after)
```

İnsan da AI de **aynı kapıdan** geçer: aynı yetki kontrolü, aynı doğrulama, aynı audit.
AI eklendiğinde yeni iş mantığı yazılmaz — ajan var olan action'ları çağırır.
**Yan fayda:** dağınık client yazımının yol açtığı veri-kaybı bug sınıfı (bkz. `FLEX_CORE_LOG` §187–188 çekiliş bug'ları) yapısal olarak biter. Yani AI-hazırlık ile kod kalitesi aynı yatırımdır.

### Bugün ucuza kurulacak 6 temel
| # | Karar | Bugün | AI'da getirisi |
|---|-------|-------|----------------|
| 1 | **Capability registry** (bu bölüm) | Düşük | AI tool yüzeyi + güvenlik bayrakları hazır |
| 2 | **Action katmanı** — yazımlar tek kapıdan | Orta (kademeli) | AI insanla aynı yolu kullanır |
| 3 | **Event/Audit stream** — her action yapısal olay üretir (actor, capability, entity, öncesi/sonrası, zaman) | Düşük | AI'nın hafızası + bağlamı; KVKK audit |
| 4 | **Actor tipi** — `human \| system \| ai` | Çok düşük | AI birinci sınıf aktör, kendi grant'i + audit'i |
| 5 | **Türkçe capability açıklamaları** | Sıfır (yazıldı) | "Şu öğrenciye sertifika bastır" → `certificate.issue` grounding'i |
| 6 | **Temiz/denormalize read model** — Person-merkezli donmuş gerçekler | Karar verildi | AI temiz fact'ler üzerinden doğru muhakeme (RAG zemini) |

3 ve 4'ü sonradan eklemek acı, bugün eklemek bir alan + bir helper.

### Güvenlik declarative gelir
AI'nın neye dokunabileceği registry metadata'sından türetilir:
- **🔴 kritik + `write`** → AI **kendi başına yapamaz**: sadece taslak hazırlar, insan onayı şart (`sms.bulk_send`, `certificate.issue`, `enrollment.complete`, `group.delete`)
- **`read` capability'leri** → AI scope'a göre sorgular ("550'nin devamsızlık raporunu çıkar")
- **🟢/🟡 + `write`** → onaylı/loglu otomasyon ("yeni ödev maili gönder")
- **`audited: true`** olan her AI eylemi audit log'a `actor.type = ai` olarak düşer

### Tangible senaryolar (hepsi omurgayla çalışır)
- *"550'nin durumunu özetle"* → read capability + event stream
- *"Devamsızlığı artan öğrencileri bul, velilerine SMS taslağı hazırla"* → read + `sms.send` (🔴 taslak → insan onayı)
- *"Bu öğrenci sertifikayı hak etti mi?"* → `certificate.eligibility.read`
- **Proaktif:** AI örüntü fark eder → personele `task.create` açar (actor: ai)
- *"Grafik-2 grubunu aktif yap"* → `group.activate`

### Şimdi YAPMA
- AI modeli, chatbot, embedding, RAG — erken, pahalı, değişken.
- "AI" diye ayrı modül. AI ayrı bir şey değil; **omurganın bir tüketicisi.**

Sadece omurgayı (action + event + actor + capability) disiplinle kur; gerisi geldiğinde kendiliğinden oturur.

## 3.5 Core / Vertical Pack Katmanlaması

> Hedef: model ileride eğitim dışı sektörlere de uyarlanabilsin. Kural: **soyutlamayı inşa etme, sınırı çiz.**
> Bugün eğitimi mükemmel yap; dikişleri doğru yere koy ki başka sektöre geçiş bir refactor olsun, rewrite değil.

```
core/                    ← sektör-bağımsız (değişmez)
  person · engagement · org-unit · task
  notification · messaging · audit · user/role/capability · import
  [executeAction + emitEvent + actor + registry mekanizması]

packs/
  education/             ← eğitime özel (çıkarılabilir/değiştirilebilir)
    attendance · grade · certificate · assignment · league
    + terminoloji + varsayılan rol paketleri
  fitness/   (gelecek)   ← membership · session · checkin · workout
  clinic/    (gelecek)   ← appointment · treatment · prescription
```

**Hangi domain nerede:**

| Core (generic) | Education Pack (özel) |
|----------------|------------------------|
| `person`, `task`, `notification`, `sms/email`, `audit`, `user/role/capability`, `import` | `attendance`, `grade`, `certificate`, `assignment`, `league` |
| `engagement` (generic köprü) | |
| `org-unit` (generic kap; eğitim "group" adını verir) | |

**3 mekanizma (yarı-hazır):**
1. **Registry açık/genişletilebilir.** Core kendi capability'lerini kayıtlar; pack *ek* domain+capability register eder. Registry veri, hardcode değil. Yeni sektör = yeni tanım + handler + ekran; core'a dokunmadan.
2. **Generic varlık + tipli uzantı.** `person` generic; "kişinin bağlı olduğu şey" generic `engagement` — `type` ve payload sektöre göre değişir (Eğitim: enrollment→group · Klinik: appointment→treatment · Spor: membership→class). **Donmuş-sonuç deseni generalleşir:** "engagement outcome snapshot" (eğitimde not/sertifika, sürücü kursunda sınav sonucu).
3. **Terminoloji sözlüğü.** Aynı `person` → "Öğrenci/Hasta/Üye/Müvekkil". Vertical config domain→etiket eşler. Çok ucuz, aynı kodu N sektöre koşturur.

**Bugün yapılacak (disiplin, ucuz):** Core'a eğitim kelimesi sokma (`person` içinde "öğrenci/branş/modül" geçmesin); eğitime özel domain'leri ayrı katmanda tut; registry'yi veri-driven tut; plugin altyapısı **kurma**, sadece katman sınırını koru.

**Strateji:** En kolay ilk genişleme eğitim-komşusu sektörler (sürücü/müzik/dil kursu, spor/PT) — `attendance + certificate + grade` pack'ini neredeyse aynen kullanır.

## 3.6 Ticari / Multi-Tenant Mimari

> Hedef: FlexOS satılabilir bir SaaS. Bu, **tek yeni yapısal eksen** ekler: `tenant` (müşteri kurum).
> `actor.type` ve `audit` ile aynı kategoride — **bugün bir alan, sonra retrofit cehennemi.**

**Tenant ekseni:** Her entity, her capability grant, her action, her event bir `tenantId` taşır. Onsuz asla sorgu atılmaz; security rules tenant izolasyonunu zorunlu kılar.

**İki katmanlı yetki** (capability işini aynen tekrar kullanır):
```
Tenant Entitlement   →  müşteri NE satın aldı (Education pack + AI add-on)
        ×                → bu tenant şu capability'leri KULLANABİLİR
User Grant           →  tenant içinde kullanıcıya NE atandı
        ×
Scope                →  self / assigned / branch / org

Etkin yetki = Entitlement ∩ Grant ∩ Scope
```

- **Entitlement** = lisans/paket (satıcı belirler): "Bu tenant Education pack aldı, AI add-on almadı."
- **Grant** = tenant kendi içinde dağıtır (müşteri yönetir): `role.manage` + `capability.grant` müşteriye açık ürün özelliği olur.
- **AI** = bir entitlement bayrağı — paralı katman, tenant bazında aç/kapa.

**Zamanlama — kaçırma:** `tenantId`, öğrenci/grup veri modeli **sıfırdan yazılırken** basılacak (Person≠Enrollment ile aynı tur). Boş sistemde bedava, dolu sistemde korkunç.

**Tuzak (en büyüğü):** Çok-tenant SaaS'ı mutlu kullanan ilk müşteri olmadan kurmak ölümcül.
> **Tenant-zero = kendi kurumun.** Onun için inşa et, ama tenant izolasyonuyla — böylece **müşteri #2 bir config olur, fork değil.** Billing/provisioning/self-serve → müşteri #2 kapıdayken.

---

# 4. MVP Çekirdek Akış (Blueprint)

> Hedef: temel akışı uçtan uca çalıştırmak. Satış kayıt açar → öğrenci oluşur →
> grup oluşturulur/atanır → eğitmen kendi öğrencilerini görür → not girer → operasyon takip eder.
> AI ve ileri otomasyon **kapsam dışı**; sadece mimari dikişler (tenantId, Person≠Enrollment, donmuş sonuç) bırakılır.

## 4.1 Kapsam — bu 4 domain
`person` (öğrenci) · `group` (grup) · `enrollment` (öğrenci–grup ilişkisi) · `grade` (not).
Attendance, certificate, assignment, sale **bu turda değil** (akış için gerekmiyor).

**En kritik kural:** Person grup/not taşımaz. Grup ve not ilişkisi `enrollment`'ta yaşar.
Bu, hem "eğitmen sadece kendi öğrencilerini görür"ü hem "aynı kişi farklı yıllarda geri döner"i çözer.

## 4.2 Veri Modeli (hedef Firestore şema)

> Tüm dokümanlar `tenantId` taşır (multi-tenant dikişi — boşken bedava, sonra korkunç).
> Bugünkü `students`/`groups` koleksiyonlarının yeniden-yazımıdır; eski alanlar migrasyonla taşınır.

### `persons/{personId}` — Öğrenci/Kişi (merkez, kalıcı)
```
tenantId
firstName, lastName
pii: { tcNo?, phone?, email? }
status: "prospect" | "active" | "passive"
consentKVKK: boolean
authUid?                  // öğrenci portalı için (varsa)
createdAt, createdBy
// ⛔ groupId YOK · grade YOK — bunlar enrollment'ta
```

### `groups/{groupId}` — Grup (süreç kabı; generic "org-unit"un eğitim adı)
```
tenantId
code                      // "550"
branch                    // "grafik"
module                    // "GRAFIK_1"
status: "planned" | "enrolling" | "active" | "postponed" | "completed" | "archived"
trainerId                 // atanmış eğitmen (uid)
schedule: { startDate, days[], sessionHours, endDate? }
createdAt, createdBy
```

### `enrollments/{enrollmentId}` — KÖPRÜ (Person ↔ Group), akışın kalbi
```
tenantId
personId                  // FK → persons
groupId                   // FK → groups (güncel grup)
saleId?                   // FK → sale (sonra; şimdilik opsiyonel)
status: "active" | "frozen" | "completed" | "transferred" | "cancelled"
enrolledAt, enrolledBy
transferHistory: [{ fromGroupId, toGroupId, at, by }]

// ── Donmuş sonuç — modül/mezuniyet bitince yazılır, DEĞİŞMEZ ──
result?: {
  finalGrade, projectGrade, assignmentScore,
  groupCode, module, branch, term,
  finalizedAt
}
```

### `grades/{enrollmentId}` — Canlı not (enrollment'a bağlı, donmadan önce mutable)
```
tenantId
enrollmentId, personId, groupId   // sorgu kolaylığı için denormalize
projectGrade
assignmentScore                   // çekiliş ödev XP'sinden (sonra)
components: { ... }
updatedAt, updatedBy
// grade.finalize → hesaplanır, enrollment.result'a snapshot'lanır, orası kilitlenir
```

**Kaynak-of-truth ayrımı:** Canlı not `grades`'te düzenlenir; **resmi sonuç** `enrollment.result`'ta donar. Ödev ağırlığı sonradan değişse veya grup silinse bile `result` değişmez.

## 4.3 Uçtan Uca Akış → Capability Eşlemesi

| # | Adım | Eylem (capability) | Kim (grant) |
|---|------|--------------------|-------------|
| 1 | Satış öğrenci kaydı oluşturur | `person.create` | Satış **veya** Operasyon* |
| 2 | Öğrenci sistemde oluşur (havuza düşer) | (1'in sonucu) + `person.search` | — |
| 3a | Yeni grup oluşturulur | `group.create`, `group.assign_trainer`, `group.activate` | Operasyon |
| 3b | Öğrenci gruba atanır | `enrollment.create` (groupId set) / `group.assign_student` | Operasyon |
| 4 | Eğitmen kendi öğrencilerini görür | `person.read @assigned` + `enrollment.read @assigned` + `group.read @assigned` | Eğitmen |
| 5 | Eğitmen not girer | `grade.read @assigned`, `grade.write @assigned`, `grade.finalize @assigned` | Eğitmen |
| 6 | Operasyon süreci takip eder | `enrollment.read @org`, `group.read @org`, `grade.report.read @org` | Operasyon |

\* **Modülerliğin kanıtı:** Adım 1'i kim yapar sabit değil — kanonik akışta Satış, sizin kurumda Operasyon. **Aynı `person.create` capability'si, farklı grant.** Kodda `if (role==="satış")` yok; sadece kimin pakette `person.create` olduğu değişir.

## 4.4 "Eğitmen kendi öğrencilerini görür" — kilit mekanizma

```
JWT claim:  { groupIds: ["550", "598"] }      // eğitmenin atanmış grupları

query enrollments
  where tenantId == myTenant
  where groupId in myGroupIds
  where status == "active"
→ personId listesi
→ join persons (read @assigned)
```

Bu yüzden Person'da `groupId` tutmuyoruz: bir kişi birden çok enrollment taşıyabilir, eğitmen yalnızca **kendi grubundaki enrollment** üzerinden o kişiyi görür. Scope `assigned` = `groupIds` claim'i.

## 4.5 Minimum Capability Listesi (sadece bu akış)

| Domain | Capability | Hassas |
|--------|-----------|--------|
| person | `person.create` · `person.read` · `person.read.pii` · `person.edit` · `person.search` | 🟡/🟢 |
| enrollment | `enrollment.create` · `enrollment.read` · `enrollment.transfer` | 🟡 |
| group | `group.create` · `group.read` · `group.edit` · `group.assign_student` · `group.assign_trainer` · `group.activate` | 🟢/🟡 |
| grade | `grade.read` · `grade.write` · `grade.finalize` · `grade.report.read` | 🟢/🔴 |
| system | `role.manage` · `capability.grant` (paketleri kurmak için, admin) | 🔴 |

~18 capability. Attendance/certificate/assignment bu akışta yok.

## 4.6 Modül Sınırları (capability paketleri)

> Paket = isimlendirilmiş capability+scope seti. Departman değil, paket.

- **Satış paketi:** `person.create`, `person.read`, `person.read.pii`, `person.edit`, `person.search`, `enrollment.create` — scope `@org` (veya `@branch`).
- **Operasyon paketi:** `group.*`, `enrollment.*`, `group.assign_trainer`, `group.activate`, tüm read'ler `@org`, `grade.report.read @org`.
- **Eğitmen paketi:** `person.read @assigned`, `enrollment.read @assigned`, `group.read @assigned`, `grade.read/write @assigned`, `grade.finalize @assigned`.
- **Admin paketi:** Tümü `@org` + `role.manage`, `capability.grant`.

> Açık karar: `grade.finalize` (not donar) eğitmende mi operasyonda mı? MVP'de **eğitmen @assigned** (bugünkü "Modülü Bitir" davranışı). İleride operasyona alınabilir — sadece grant değişir.

## 4.7 Bugün bırakılan dikişler (AI/gelecek için ucuz)

1. **`tenantId` her dokümanda** + her sorguda + security rules zorunlu.
2. **Mutasyonlar service fonksiyonlarında**, bileşen içine saçılmaz (çekiliş bug sınıfının kökü buydu — `FLEX_CORE_LOG` §187-188). İleride bunlar `executeAction` olur.
3. **`enrollment.result` donmuş snapshot** deseni baştan şemada.
4. **`can(capability, scope)` helper'ı** — başta basit rol→paket eşlemesiyle dolu olsa bile, çağrı noktaları registry'ye hazır.

> Bu dördü dışında AI/otomasyon/multi-vertical mekanizması **kurulmaz**. Sadece çekirdek akış koşar.

---

# 5. Süreç Sorumlulukları, Öğrenci Kartı ve Güvenlik

## 5.1 Modüller Arası Sorumluluk Dağılımı

### Eğitim Operasyonu — İşin Beyni
- Branş, eğitim, grup tanımlar
- Grup tarihlerini ve takvimini belirler
- Eğitmen ataması yapar
- Grubu "Aktif" statüsüne alır → eğitmene yoklama açılır
- Öğrenci taleplerini ve şikayetleri yönetir
- Sertifika süreçlerini yönetir; sertifika basılınca SMS + e-posta otomatik gönderilir

### Satış
- Açılacak grupları ve ürün kataloğunu görür
- Ürün / paket satışı yapar
- Öğrenciyi sisteme kaydeder → havuza düşer
- Havuzdan ilgili gruba yerleştirir

### Eğitmen — Sadece Eğitim
- Grup oluşturamaz, düzenleyemez · öğrenci satışı yapamaz
- Sadece: ders verir, yoklama alır, proje notu girer, eğitmen notu ekler
- Atanmış grupları görür, öğrenciler zaten yerleştirilmiş gelir

## 5.2 Sertifika Verme Akışı (Eğitim Operasyonu)

Hedef: kurumu rahatlatan, uçtan uca otomatik akış. Eğitmen yalnızca notu besler; gerisini sistem + Eğitim Op tek ekrandan yürütür.

```
1. Eğitmen notu verir
        ↓
2. Sistem sertifika notunu hesaplar (proje + ödev ağırlıkları)
   → nota göre hak edilen sertifika türü belirlenir: Başarı | Katılım
        ↓
3. Eğitim Op ekranı — sınıfın "Sertifika Not" listesi
   Her öğrenci satırında: not + hak kazandığı sertifika türü + [Sertifika Bastır]
        ↓
4. [Sertifika Bastır] → otomatik yazıcıdan basılır
   + aynı anda öğrenciye mail/SMS: "Sertifikanız hazır, gelip alabilirsiniz."
        ↓
5. İl dışı / gelemiyorsa → dijital PDF kopyası öğrenciye gönderilir
        ↓
6. enrollment.certificate.durum = verildi + kod + verilisTarihi (kalıcı)
```

- **Sertifika türü karara bağlı:** Eğitim tanımındaki koşullar (min devam %, min not) öğrencinin notuyla kıyaslanır → Başarı mı Katılım mı otomatik belirlenir. Eğitim Op onaylar, sistem türü önerir.
- **Kanal:** Fiziksel basım (yazıcı) **varsayılan**; PDF **opsiyonel/uzaktan** alternatif. İkisi de aynı butondan tetiklenir, durum `verildi`ye döner.
- **Otomatik bildirim:** Basım anında mail + SMS tetiklenir (mevcut `send-*` + bildirim altyapısı pattern'i).

> Tümü Eğitim Operasyonu modülünde, sıfırdan inşada gelecek. Eğitmen tarafında **hiçbir sertifika butonu olmayacak** — sadece not girişi.

## 5.3 Rol + Yetki Modeli (geçiş / bugünkü)

> Hedef model §3'te (capability + scope). Aşağısı bugünkü/geçiş yaklaşımı.

Sadece role kontrolü yetmez. Role + Permission modeli kullanılır.

```
user {
  role: "trainer"
  permissions: ["attendance.read", "attendance.write", "students.read"]
}
```

Middleware ikisini birden kontrol eder: `hasRole("trainer") && hasPermission("attendance.write")`.

**Neden:** İleride şu varyasyonlar çıkacak — Admin · Şube Müdürü · Kıdemli Eğitmen · Eğitmen · Stajyer Eğitmen · Satış+Eğitmen (çift yetki). Bir elemana ek yetki tıkla verilip alınabilmelidir (örn. eğitmene `sales` permission → satış modülü açılır).

### Route Koruması (Middleware)
```
/trainer/*    → role: trainer | admin
/operation/*  → role: operation | admin
/sales/*      → role: sales | admin | permission: sales
/finance/*    → role: finance | admin | permission: finance
```

## 5.4 Öğrenci Kartı

Sistemin merkezidir. **Tek kart** vardır, role göre görünen sekmeler değişir.

| Sekme | Eğitmen | Operasyon | Satış | Muhasebe |
|-------|---------|-----------|-------|----------|
| Eğitim Durumu | ✓ (default) | ✓ | | |
| Lig | ✓ | | | |
| Eğitimler / Gruplar | | ✓ | ✓ | |
| Sertifikalar | ✓ | ✓ | | |
| Eğitmen Notları | ✓ | | | |
| Ödemeler / Sözleşme | | | | ✓ |

- **Eğitmen Notları:** Varsayılan blur. Butona basınca görünür (öğrenci yanında ekran açılabilir).
- **shared altındadır.** Her modülden açılabilir, Ctrl+K ile erişilebilir.

### Ctrl+K — Global Arama
Tüm modüllerin merkezi erişim noktası: `Ctrl+K → "Ege" yaz → Öğrenci Kartı açılır`. Role göre filtrelenir (eğitmen sadece kendi öğrencilerini görür). Shared altında.

## 5.5 Oyunlaştırma (Lig Sistemi)
Kaldırılmayacak. Korunacak. **Opsiyonel.** Eğitmen sınıf ligini açarsa anlam kazanır; öğrenci kartında ayrı "Lig" sekmesi. Default sekme "Eğitim Durumu".

## 5.6 Güvenlik

### Firestore Rules — Katman Katman
```
Trainer    → sadece kendi atanmış groupId'lerine ait dökümanlar
Operation  → tüm gruplar, enrollment'lar
Sales      → products, groups (read) | persons, sales (write)
Finance    → payment dökümanları, contracts
```

### PII & KVKK
- Öğrenci adı, telefon, e-posta hassas veridir; KVKK rızası kayıt altına alınır
- Veri erişim logu tutulur
- **"Öğrenci silinmez"** — silme talebi gelirse kişisel veri anonimleştirilir, eğitim geçmişi korunur

### Audit Log
Her kritik işlem izlenebilir: `Kim → Ne yaptı → Hangi kayıtta → Ne zaman`.
Not girme, sertifika basma, ödeme kaydı, öğrenci transferi, grup statü değişikliği — hepsi loglanır.

### JWT Claims
```
{ role: "trainer", permissions: ["sales"], groupIds: ["550", "598"] }
```
API route'lar claim'e göre izin verir. Client-side kontrole güvenilmez.

### Deployment Stratejisi
Tek root, tek Next.js uygulaması; modüller route bazlı ayrılır.
- `main` → `flex.vercel.app` — stable, eğitmen kullanır
- `dev` → `flex-dev.vercel.app` — geliştirme, ayrı Firebase projesi

---

# 6. Yol Haritası ve İnşa Sırası

## 6.1 İnşa Sırası (veri modeli yeniden-inşa)

1. **Core tiplerini kilitle** (Person, Enrollment, Group, Module) + FlexOS tipleri (Education, Sale, Branş, Şube) — **+ `tenantId` aynı turda.**
2. **Backfill:** mevcut `students` → Person + Enrollment (groupId'den) + `group_history`'den geçmiş enrollment'lar. **Hiçbir şey silinmez.**
3. **İlk dikey dilim:** bireysel satış → gruba ekleme → eğitmene atama (1. etap).
4. Yazım + liste + yoklama + grading sorgularını enrollment-aware repoint.
5. `student.groupId` bağımlılığını kaldır.
6. EduOps (eğitim/grup tanımı) → Satış → Kurumsal → Finans/rapor.

> **Sıra notu:** Ayrılabilirlik kısıtı yüzünden eğitmen tarafının Core'a taşınması, sales'ten ÖNCE — Core'un standalone yettiğini kanıtlamak için.

## 6.2 Capability/Action Omurgası — Sonraki Adımlar

1. `Capability`, `Scope`, `Sensitivity`, `Actor` (+ `tenantId`) TypeScript tipleri + sabit capability listesi (registry iskeleti).
2. `executeAction()` çekirdeği + `emitEvent()` audit helper'ı (önce 1-2 domain'de pilot) — tenantId + actor baştan dahil.
3. Veri modeli yeniden yazımı: Person≠Enrollment **+ tenantId** aynı turda.
4. Core / Education-pack katman sınırının kodda kurulması (eğitim domain'leri ayrı).
5. İki katmanlı yetki: entitlement (tenant) × grant (user) × scope.
6. Rol paketlerinin tanımı (Eğitmen / Operasyon / Satış / Admin → capability+scope setleri).
7. Mevcut hardcoded kontrollerin (`PERMISSIONS.MANAGEMENT_PANEL`, `role === instructor`) registry'ye taşınması.

## 6.3 MVP — Yarın İlk Adım

1. `persons` / `groups` / `enrollments` / `grades` koleksiyon şemalarını + `tenantId`'yi sabitle.
2. `can(capability, scope)` helper'ı + 4 paketi (Satış/Operasyon/Eğitmen/Admin) tanımla.
3. Akışın 1→6 adımını en kısa yoldan uçtan uca koştur (UI minimal, mantık service'te).
4. Çalışınca → Eğitim Operasyonu modülüne geç.

## 6.4 Modül Geliştirme Sırası (büyük resim)

1. **Eğitmen Paneli** — neredeyse tamamlandı (not girme, StudentDetailModal, yönetim paneli, profil ayarları)
2. **Eğitim Operasyonu** — sıradaki büyük modül (rol+permission genişletme, grup yaşam döngüsü, eğitmen atama, grup başlatma → yoklama aktivasyonu)
3. **Satış** — sonraki modül
4. **Finance** — sonraki modül
5. **Öğrenci Portalı** — en sona (Eğitim Operasyonu olmadan eksik kalır)

## 6.5 Kapsam Dışı (1. etap) — alanlar şemada hazır, mantık sonra

Payment/taksit, kurumsal Account, paket çoklu-enrollment, kota takibi, gelir raporlama, sertifika üretimi. Hepsinin alanı şemada baştan var ("temeli sağlam at"), mantığı sonraki etaplarda dolar.
