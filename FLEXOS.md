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

### ✅ Şablon Yönetimi — Ödev Yönetimi'nin İLK sekmesi, canlı-birebir, BİTTİ (2026-07-06, aynı gün devam)

Kullanıcı düzeltti: bu iş "ileride eklenir" değil, **çekirdek/olmazsa-olmaz** ("şablon ödevin kalbi, olmazsa canlıya alamam") — kademeli/minimal öneri geri çevrildi, doğrudan canlı-birebir tam kapsam istendi. Kullanıcı Claude Design çıktısı verdi (`Ödev Şablonu Yönetimi.dc.html`), `/flexos/odevler/yonetim` sayfasına **İLK sekme** olarak (Şablon Yönetimi → Mevcut Ödevler → Arşiv) portlandı.

- **`AssignmentTemplate.visible?: boolean`** eklendi — Ana Sayfa'daki Ödev Parkuru'nun ghost-slotlarında görünürlüğü kontrol eder. Yeni şablon varsayılan `visible:false` (Şablon Yönetimi'nden manuel onaya kadar Ana Sayfa'da görünmez). `egitmen-anasayfa/page.tsx`'teki `OdevParkuru`'nun ghost-template filtresi artık `t.visible === true` şartını da arıyor (önceden hiç bakmıyordu — bu turdan önce TÜM kullanılmamış şablonlar ghost-slot adayıydı, bug'dı).
- **`updateTemplate`/`deleteTemplate`** (`assignment-service.ts`) yeni — `assertTemplateOwnership` ortak yardımcı: kişisel şablon SADECE sahibi eğitmen (org-scope Op/Admin BİLE erişemez — "sadece kendisi görür/yönetir" kararına sadık), global şablon SADECE org-scope. `PATCH`/`DELETE /api/flexos/assignment-templates/[id]` route'u (`assignments/[id]` ile aynı desen).
- **11 yeni assertion** (`scripts/assert-assignment.ts`, toplam **31**): visible varsayılan false, branch denormalize, kişisel/global sahiplik matrisi (başka eğitmen/org-scope-bile-erişemez/doğru sahip/admin-global), olmayan id, boş başlık. Hepsi yeşil. `tsc`/ESLint/`npm run build` temiz.
- **Sayfa** (`odevler/yonetim/page.tsx`): branş filtresi gerçek katalogdan (`GET /api/flexos/branches`), renkler paylaşımlı `siniflar/_shared/groupDisplay.ts`'teki `BRANS_COLORS`/`BRANS_FALLBACK` (tasarımın kendi sabit 5-branş rengi KULLANILMADI — tutarlılık için mevcut paylaşımlı palet). Tablo: Şablon Adı/Açıklama/Branş/İşlem (görünürlük onay ✓/✕ toggle + düzenle + sil), üstte mavi bilgi kutusu + "N şablon ana sayfada" rozeti, oluştur/düzenle modalı (Tailwind, sayfanın kendi mevcut modal deseniyle tutarlı — paylaşımlı `FlexModal` DEĞİL, bu sayfanın zaten kullandığı ham modal deseni), silme onay modalı.
- **"Ödev Ekle" modalına branş seçici EKLENMEDİ (kullanıcı kararı):** `OdevOlusturModal.tsx`'te "Şablon olarak kaydet" işaretliyken artık şablonun branşı seçili **Grup**'tan (`groups.find(g=>g.id===groupId)?.branch`) otomatik gönderiliyor — Ödev Ekle'de ayrı bir branş alanı yok, sadece Şablon Yönetimi'nin kendi (grupsuz) oluşturma formunda manuel branş seçici var.
- Bkz [[project-sablon-yonetimi]], [[feedback-no-scope-reduction-core]].

**Şablon Yönetimi modalı "Ödev Ekle" ile TAM parite oldu (aynı gün devam):** Kullanıcı: "Ödev oluşturdakinin aynısı olsun" — modal framer-motion + portal'a geçti (`egitmen-anasayfa/OdevOlusturModal.tsx` ile BİREBİR aynı geçiş: backdrop 0.18s fade, panel 0.24s scale/y), alan seti genişledi: Şablon Adı (üst) + Alt Başlık (alt) solda / İkon Seçimi (16 ikon, aynı popup) sağda dikey buton, Ödev Türü (Ödev/Proje) + Branş dropdown tek satırda, Açıklama en altta. **İkon/tür sabitleri paylaşımlı dosyaya çıkarıldı** (`odevler/_shared/assignmentIcons.ts` — `ASSIGNMENT_ICONS`/`ASSIGNMENT_ICON_KEYS`/`ASSIGNMENT_KIND_OPTIONS`), hem Ödev Ekle hem Şablon modalı AYNI kaynaktan besleniyor (tekrar yok). `AssignmentTemplate`'e `subtitle?`/`icon?`/`kind?` eklendi (Assignment'takiyle aynı `AssignmentKind` tipi); `createTemplate`/`updateTemplate` bu alanları kabul ediyor + `kind` doğrulaması (VALID_KINDS). "Ödev Ekle"deki "Şablon olarak kaydet" artık subtitle/icon/kind'i de gönderiyor (önceden sadece title/description/branch gidiyordu — kayıp veri riski kapandı). Tablo satırı artık seçili ikonu + alt başlığı da gösteriyor (önceden hep aynı ClipboardList + sadece title). **16 yeni assertion** (toplam **36**, `scripts/assert-assignment.ts`): subtitle/icon/kind create+update, kind default "normal", geçersiz kind reddi (create+update). `tsc`/ESLint/`npm run build` temiz.

**Modal yükseklik zıplaması düzeltildi + bilgi kutusu kaldırıldı (aynı gün devam):** İkon seçimi popup'ı açılınca modal aniden zıplıyordu — sebep, panel'in `maxHeight`/iç-scroll sınırı olmadan sadece içeriğe göre auto-height olmasıydı (Ödev Ekle'de olduğu gibi `maxHeight:"calc(100dvh-32px)"` + body'de `flex-1 min-h-0 overflow-y-auto` YOKTU). Panel artık `flex flex-col` + `maxHeight` ile sınırlı, header/footer `shrink-0`, body scroll'lu — Ödev Ekle ile birebir aynı davranış. Ayrıca "Onay (✓) butonuna basınca..." açıklama kutusu kullanıcı isteğiyle kaldırıldı (gereksiz bulundu), `visibleTemplateCount` değişkeni de artık kullanılmadığı için silindi.

**Modal yükseklik davranışı TEKRAR düzeltildi — bu sefer sabit (aynı gün devam, kullanıcı: "genişlik ve yükseklik aynen korunmalı, oynamamalı asla"):** Bir önceki `maxHeight` (auto-fit) çözümü yeni bir sorun açtı — ikon seçici popup'ı açılınca panel'in TAMAMI aniden büyüyordu. Hem `OdevOlusturModal.tsx` hem Şablon modalı (`odevler/yonetim/page.tsx`) artık `maxHeight` yerine SABİT `height: min(Npx, calc(100dvh-32px))` kullanıyor (Ödev Ekle 820px, Şablon 760px — önceki 770'in yetersiz çıkmasından ders alınarak bolluk payı arttırıldı). Body'nin zaten var olan `flex-1 min-h-0 overflow-y-auto`'su sayesinde ikon picker açılıp içerik taştığında SADECE body içinde scroll çıkıyor, panelin kendisi asla büyümüyor/küçülmüyor — ikon picker kapalıyken de normal içerik bu sabit yüksekliğin altında kaldığı için scroll hiç görünmüyor. Bkz [[feedback-modal-fixed-dimensions]] (yeni feedback hafızası — genel kural olarak kaydedildi).

**✅ Ödev Kütüphanesi eklendi — Eğitmen Ana Sayfa'nın en büyük eksiği kapandı (aynı gün devam, kullanıcı: "canlıya bak, sağa sola kaydırılabilir scrolling mantığında olan kütüphaneyi istiyorum"):** Daha önce (2026-07-06 erken saatler) "Ana Sayfa'dan Ödev Kütüphanesi kaldırıldı" kararı VERİLMİŞTİ ("muhtemelen Ödev Yönetimi'ne eklenir" varsayımıyla) — kullanıcı bunu geri aldı, canlıdaki `AssignmentLibrary.tsx`'in BİREBİR portu Ödev Parkuru'nun altına eklendi (`egitmen-anasayfa/page.tsx::OdevKutuphanesi`).

- **Yatay kaydırmalı kart listesi** (canlıdaki gibi `overflow-x-auto snap-x`, ~4.3 kart görünür), overflow varsa sol/sağ ok butonları (`ResizeObserver` ile tespit). Kart: gri ikon kutusu (şablonun kendi seçili ikonu) + başlık/alt başlık + branş çipi (renkli, `BRANS_COLORS`) + "Ödevi Başlat" butonu.
- **Kişisel/Global sekme ayrımı KALDIRILDI** (kullanıcı kararı) — `GET /api/flexos/assignment-templates` zaten eğitmenin kendi kişisel + tüm global şablonlarını tek listede döndürüyor (`listTemplates`). Yerine SADECE **branş seçici** var (şablonlarda fiilen bulunan branşlardan türetilir, >1 branş varsa gösterilir — çoklu branşlı eğitmen kütüphaneler arası geçiş yapar).
- **`visible` alanı burada FİLTRE DEĞİL** — Kütüphane HER ZAMAN TÜM şablonları gösterir (canlıdaki gibi); `visible` sadece Ödev Parkuru'nun küçük ghost-slot önizlemesini etkiler. İki ayrı "görünürlük" ekseni: Parkuru=küratörlü küçük önizleme, Kütüphane=tam liste.
- **`OdevOlusturModal`'a `prefill` (`AssignmentPrefill`) desteği eklendi** — Kütüphane'deki "Ödevi Başlat" AYNI modalı şablonun `title/subtitle/description/icon/kind` alanlarıyla ÖN-DOLU açıyor (`templateId` de body'ye eklendi — daha önce hiç gönderilmiyordu, bu da bir eksiklikti). Eğitmen sadece grup+tarih seçip onaylıyor. Prefill'liyken "Şablon olarak kaydet" bölümü GİZLENİYOR (zaten şablondan başlatılıyor, tekrar kaydetmek anlamsız), başlık "Ödevi Başlat" oluyor. Yeni bir "AssignActivateModal" klonu YAZILMADI — mevcut modal genişletildi (kod tekrarı yok).
- `tsc`/ESLint/`npm run build` temiz.

**Branş Havuzu'nda 2'şer kopya çıktı — kök neden bulunup temizlendi (aynı gün):** Kullanıcı Şablon Yönetimi'nin branş dropdown'ında "Grafik Tasarım" ve "Yazılım"ın ikişer kere göründüğünü fark etti. Araştırma: `scripts/seed-flexos-dashboard-demo.mjs` (Satış Dashboard demo verisi için, 2026-07-04'te çalıştırılmış) branş adı çakışmasını KONTROL ETMEDEN her çalıştığında yeni ID ile 8 branş yazıyor (`flexos_branches`) — bunlardan "Grafik Tasarım"/"Yazılım" zaten 2026-06-18'de kullanıcı tarafından Branş Havuzu ekranından GERÇEK olarak eklenmişti, script bunları isim bazında fark etmeden tekrar ekledi ("Sistem Uzmanlığı"/"Dijital Pazarlama" da script'in demo branşlarıydı, gerçek değildi). **4 seed-script branşı silindi** (`createdBy:"seed-script"` filtresiyle) — kullanıcı kararı: bağlı 4 demo eğitim + 39 demo satışın `branchId`'i artık geçersiz kalacak ama dummy veri olduğu için sorun değil ("teste geçince dummyler gidecek zaten"). Script'in kendisi HENÜZ düzeltilmedi (gelecekte tekrar çalıştırılırsa aynı çakışma tekrarlanabilir) — bilinen açık, kullanıcı istemedikçe dokunulmayacak.

**Şablon Yönetimi görsel ince ayarları — birkaç kullanıcı geri bildirim turu (aynı gün, Kütüphane'den ÖNCE oldu ama not buraya toplu düşüldü):**
- **Renk paleti düzeltmesi:** Kullanıcı "hâlâ aynısı değil, renkli ve güzel bir tasarım vermiştim" dedi — kök neden: paylaşımlı `groupDisplay.ts::BRANS_COLORS` İngilizce placeholder isimlerle (`Design/Finance/Software`) yazılmıştı, gerçek branşlarla (`Grafik Tasarım`/`Yazılım`) HİÇ eşleşmiyordu → tüm çipler sessizce gri fallback'e düşüyordu. Kullanıcının verdiği tasarımın KENDİ renk paleti (gerçek isimlerle eşleşen) `BRANS_COLORS`'a taşındı. Aynı hatalı palet 6 başka sayfada da (Eğitmenler/Satış Listesi/Paket-Kampanya Yönetimi/Öğrenci Havuzu) ayrı kopyalanmış halde duruyor — DOKUNULMADI, kullanıcı istemedi. Bkz [[feedback-use-given-design-values]].
- **Düzenle/Sil butonları** tasarımdaki gibi beyaz kenarlıklı kutuya çevrildi (önceden border'sız düz ikondu, hover renkleri de tasarımın tam hex'i değildi).
- **Onay/kaldır ikon-renk mantığı DÜZELTİLDİ** (kullanıcı: "onay tıkı olursa yeşil, x olursa açık kırmızı arka plan" — tasarımın kendi "aksiyon butonu" mantığından farklı, "durum göstergesi" mantığı istendi): `visible:true` → yeşil + Check ikonu, `visible:false` → açık kırmızı (`#FFECEC`/`#F3B0B0`/`#D93636`) + X ikonu.
- **Yeşil "N şablon ana sayfada" rozeti** geri eklendi (açıklama cümlesini kaldırırken yanlışlıkla rozeti de silmiştim) — başlık satırında, branş filtresinin yanında.
- **Satır aksiyonlarında tam-reload kaldırıldı:** onay/düzenle/sil/arşivle gibi TEKİL satır aksiyonlarından sonra koca `loadData()` çağrılıyordu (kullanıcı: "onay tıkına basınca komple liste kayboluyor geliyor, saçma değil mi"). Hem Şablon Yönetimi hem Mevcut Ödevler/Arşiv sekmelerindeki TÜM mutation handler'ları (`saveTplForm`/`toggleTplVisible`/`confirmTplDelete`/`handleSave`/`handleDelete`/`setStatus`/`handleBulkDelete`) artık sadece ilgili satırı yerel state'te güncelliyor, tam reload YOK. Bkz [[feedback-no-full-reload-on-row-action]].
- `tsc`/ESLint/`npm run build` her adımda temiz.

**Ödev Kütüphanesi ince ayarları + Ödev Puanı alanı (aynı gün, Kütüphane'den SONRA):**
- **Kütüphane kartındaki branş çipi RENKSİZ yapıldı** (kullanıcı: "kütüphane kısmı renksiz olsun") — referans görsel (`kütüphane.png`, canlının gerçek ekran görüntüsü) gösterdi ki canlıda branş hiç renklendirilmiyor, sadece düz gri italik metin (branş adı yoksa "Global"). Oyunlaştırılmış (mor "Oyunlaştırılmış" rozeti) FlexOS'ta henüz yok, o özellik gelince eklenecek.
- **`AssignmentTemplate.maxPuan?: number`** eklendi (kullanıcı: "Ödev Ekle'deki Ödev Puanı satırını şablona da ekleyelim") — `createTemplate`/`updateTemplate` kabul ediyor + pozitif doğrulama (VALID pattern, `assignTask` ile aynı), varsayılan 100. Şablon modalına Ödev Ekle ile AYNI Ödev Puanı bloğu (input + 100/150/200/250/300 hızlı seçim) eklendi. `AssignmentPrefill`e de `maxPuan` eklendi — Kütüphane'den "Ödevi Başlat" artık şablonun puanını da taşıyor. **3 yeni assertion** (toplam **39**): maxPuan kaydediliyor/varsayılan/negatif-red (create+update).
- **Modal yüksekliği 760→820px** — Puan satırı eklenince sabit 760px yetersiz kaldı (kullanıcı: "scroll çıktı, sığmaz mı"), Ödev Ekle'nin kanıtlanmış 820 değerine eşitlendi.
- **Küçük ekran kompaktlaştırması** (kullanıcı: "küçük ekranlarda da scroll olmasın") — header/body/footer padding'leri (`py-6.5→py-5`, `px-8→px-7`), body `gap-5→gap-4`, açıklama `rows 5→4` küçültüldü; bu, sabit yüksekliğin dar viewport'larda gerekli içerik miktarına daha rahat sığmasını sağlıyor (garantili sıfır-scroll fiziksel olarak çok kısa pencerelerde mümkün değil, ama pratikte normal küçük ekranlarda artık rahat sığıyor).
- **"Ödev Ver" butonu** (Ödev Parkuru) düz turuncudan (`bg-[#FF8D28]`) "Şablon Oluştur" ile AYNI gradient'e (`linear-gradient(135deg,#FF8D28,#D66500)`) çevrildi — iki oluşturma butonu artık görsel olarak tutarlı.
- `tsc`/ESLint/`npm run build` temiz.

### ✅ Grade domain backend BİTTİ + Sertifika Notu bağlandı (2026-07-06, aynı gün devam)

`domain/education/grade.ts` entity'si zaten vardı (ilk mimari katmanında, hiç dokunulmamıştı) — bu turda **repo → servis → route → assertion** kuruldu (Faz1/2 deseni). Capability'ler (`grade.read/write/finalize/report.read`) zaten registry+packages'ta hazırdı, ekstra iş gerekmedi.

- **`domain/repo/grade-repo.ts`** — port (`save`/`getById`/`listByGroup`; doküman id = enrollmentId, `nextId` yok — upsert).
- **`domain/services/grade-service.ts`** — `saveGrades(actor, {groupId, entries[]}, deps)` (toplu upsert, 0-100 validasyon, `null`=temizle) + `getGradesByGroup(actor, groupId, deps)`. İkisi de `grade.write`/`grade.read` gated, **assigned scope** (eğitmen sadece `Group.trainerId === actor.uid` olan kendi grubu — `attendance-service.ts`'teki desenin aynısı).
- **`server/grade-repo.firestore.ts`** — yeni `flexos_grades` koleksiyonu, server-only rules.
- **Route `/api/flexos/grades`** — `GET ?groupId=` (okuma) + `POST` (body `{groupId, entries}`, toplu kaydet).
- **16 assertion geçti** (`scripts/assert-grade.ts`): admin/kendi-grubuna-atanmış-eğitmen yazabilir; başka-eğitmenin-grubu/satış/operasyon (yalnız `grade.report.read`'i var, `grade.read` YOK)/finans reddedilir; aralık-dışı-not + varolmayan-grup + boş-entries → ValidationError; güncelleme createdAt korur; not temizleme (`null`→`undefined`) çalışır. `tsc`+ESLint+`npm run build` temiz.
- **Sertifika Notu sayfası bağlandı:** grup seçilince `GET /api/flexos/grades?groupId=` ile notlar ön-doluyor (sayfa yenilense de kaybolmuyor), "Taslak Kaydet" artık gerçek `POST`'a yazıyor (saving state + toast). **"Notları Gönder" (finalize) hâlâ "yakında"** — `Enrollment.result` snapshot'lama ayrı iş (`grade.finalize`, kilitleme mantığı), bu turun kapsamı dışında.
- **Ödev Notu da bağlandı (aynı gün devam):** "Notları Kaydet" artık net puanı (puan−ceza) `Grade.assignmentScore`'a `POST /api/flexos/grades` ile yazıyor; ödev tekrar açılınca `GET /api/flexos/grades?groupId=` ile ön-doluyor. **Bilinen kısıt (kasıtlı, dokümante):** `assignmentScore` enrollment başına TEK alan (per-assignment ayrı saklama yok) — bu yüzden en son kaydedilen ödevin net puanı geçerli olur, birden fazla ödev farklı skorları üst üste yazar. Otomatik hesaplama (Submission tamamlanma oranından) gelince bu geçici kısıt kalkacak. Dummy veri fallback'i (`DUMMY_GROUPS`/`dummyRosterFor`/`dummyAssignmentsFor`) KORUNDU — kullanıcı talebi.
- **`CertificateSettings` backend BİTTİ + bağlandı, SONRA İKİ KATMANLI'ya EVRİLDİ (aynı gün devam):** Kullanıcı kararı: standalone/Core modda merkezi Op/Admin yok, o yüzden HER EĞİTMEN kendi sertifika hesaplama kuralını (Ödev notu aç/kapa + ağırlık) belirleyebilmeli; kendi kuralını vermeyen eğitmen tenant varsayılanına düşer.
  - **Model:** `CertificateSettings.trainerId` opsiyonel alan — boşsa **tenant varsayılanı** (doküman id=tenantId, Op/Admin yönetir, `certificate.settings.write` **org scope**), doluysa **eğitmenin KİŞİSEL override'ı** (doküman id=`${tenantId}_${trainerId}`, aynı capability ama **self scope** — yalnız `EGITMEN_STANDALONE_EXTRA`'da, yani SADECE standalone/Core modda; Full/entegre modda eğitmenin bu capability'si hiç yok).
  - **Okuma (`getCertificateSettings`):** `widestScope(actor,"certificate.settings.write")==="self"` ise önce eğitmenin kendi override'ına bakar, yoksa tenant varsayılanına düşer (o da yoksa sabit varsayılan `%70/%30` açık).
  - **Yazma (`updateCertificateSettings`):** scope'a göre dallanır — org (Op/Admin) → tenant varsayılanını yazar; self (standalone eğitmen) → yalnız kendi `trainerId`'li kaydını yazar, diğer eğitmenleri/tenantı ETKİLEMEZ.
  - Route `/api/flexos/certificate-settings` (GET/PATCH) değişmedi — dallanma tamamen serviste. Firestore `flexos_certificate_settings` (server-only rules), repo'ya `getByTrainer` eklendi.
  - **16 assertion geçti** (`scripts/assert-certificate-settings.ts`, standaloneMode true/false + kendi kural/kuralsız/başka-eğitmeni-etkilememe senaryoları dahil). Diğer 12 assertion script'i de (190+ assertion toplam) hâlâ yeşil — `packages.ts` değişikliği regresyon yaratmadı. `tsc`+ESLint+build temiz.
  - **Sertifika Ayarları sayfası:** mount'ta `GET` ile yükler, "Ayarları Kaydet" → `PATCH`; API yanıtında `trainerId` varsa üstte turuncu "Bu senin kişisel ayarın" rozeti, yoksa mavi "Tenant varsayılanı" rozeti gösterir. Full moddaki eğitmen kaydetmeye çalışırsa 403 → açıklayıcı toast ("yalnız Operasyon/Yönetici değiştirebilir").
  - **Sertifika Notu sayfası:** `odevAktif`/`sertifikaPct`'yi hâlâ aynı `GET`'ten okuyor — hangi katmandan geldiği (kendi/tenant) sayfa için şeffaf, sadece doğru sayılar geliyor.
  - Menü görünürlüğü ekstra iş gerektirmedi: Sertifikasyon akordiyonu zaten `grade.finalize` sahibi herkese (eğitmen dahil, her iki modda) açık — kullanıcının "eğitmen menüsünde görünsün" isteği yapısal olarak zaten karşılanıyordu.
- **`certType` (Sınav Bazlı/Proje Bazlı) Sertifika Notu'na bağlandı, SONRA DÜZELTİLDİ (aynı gün devam):** `Education.certType` (katalogda zaten vardı, `eduos/education.ts`) sertifika hesabını KISITLAMAZ. İlk turda "sınav bazlı branşta etiket 'Sınav Notu' olsun" denendi ama kullanıcı DÜZELTTİ: **alan adı HER ZAMAN "Sertifika Notu" kalır** — ayrı bir "Sınav Notu" kavramı YOK ("sınav notu gelir, sertifika notunu OLUŞTURUR"; ileride sınav modülü de aynı `Grade.projectGrade` alanına yazacak). `certType` yalnız **hangi ağırlık bloğunun** kullanılacağını seçer.
  - **`CertificateSettings` İKİ AYRI BLOĞA bölündü** (`project`/`exam`, her biri kendi `{odevAktif, sertifikaPct}`): proje bazlı eğitimlerde ödev notu varsayılan AÇIK (%70/%30), sınav bazlı eğitimlerde (Office gibi) varsayılan KAPALI (%100) — ama kullanıcı kararı: **ikisi de bağımsız açılıp kapatılabilir** (sınav bazlı branşta custom/anlık ödev verilmişse istenirse o da sertifikaya katkı yapabilir; certType hiçbir şeyi hard-gate ETMEZ).
  - `GET /api/flexos/groups` yanıtına `certType` eklendi (mevcut Education join'inden, ekstra sorgu yok). Sertifika Notu sayfası seçili grubun `certType`'ına göre `settings.project`/`settings.exam`'den doğru ağırlığı seçer, etiket sabit "Sertifika Notu" kalır.
  - Sertifika Ayarları sayfası artık **2 sekmeli** (Proje Bazlı / Sınav Bazlı), "Ayarları Kaydet" ikisini birlikte `PATCH` eder (`{project, exam}` body).
  - **21 assertion geçti** (`scripts/assert-certificate-settings.ts`, iki blok + standalone/Full + kendi-kural/kuralsız senaryoları). Toplam 195 assertion (13 script) yeşil. `tsc`+ESLint+build temiz.
- **Ödev Notu per-assignment saklama kısıtı ÇÖZÜLDÜ (aynı gün devam, 2026-07-06):** Kullanıcı kararı — her ödevin kendi puanı var (100/200/300 gibi), bunlar toplanır, `Grade.assignmentScore` (enrollment başına TEK alan, üst üste yazan) TAMAMEN KALDIRILDI.
  - **`Assignment.maxPuan?: number`** eklendi (varsayılan 100 — "özel" ödevler 200/300 olabilir). `assignTask`/`updateAssignment` kabul ediyor (pozitif validasyon).
  - **`Submission.grade`** (zaten vardı, `submission.grade` capability + `PATCH /api/flexos/submissions/[id]/grade` route zaten kuruluydu) artık aralığı `0..assignment.maxPuan` (`gradeSubmission` assignment'ı çekip doğruluyor, sabit 0-100 kaldırıldı) — ödev başına KALICI, üst üste yazmıyor.
  - **`computeOdevYuzdeleri(tenantId, groupId, deps)`** (yeni, `submission-service.ts`) — grup içindeki TÜM yayınlanmış ödevlerin `maxPuan` toplamı (payda) + her kişinin kazandığı `Submission.grade` toplamı (pay), OKUMA ANINDA hesaplanır, HİÇBİR YERE YAZILMAZ. Taslak/arşiv ödevler paydaya girmez. Grupta hiç ödev yoksa `totalMaxPuan=0` → "veri yok", sertifika hesabı Sertifika Notu'na düşer.
  - **`Grade` entity'den `assignmentScore` KALDIRILDI** — artık sadece `projectGrade` (Sertifika/Sınav notu) saklıyor.
  - **`GET /api/flexos/grades`** yanıtına `odev: {totalMaxPuan, earnedByPerson}` eklendi (mevcut `items`'ın yanına) — istemci yüzdeyi kendi türetiyor.
  - **Sertifika Notu sayfası:** Ödev Notu sütunu artık EDİTLENEMEZ — salt-okunur, otomatik hesaplanan `%X` rozeti (input kaldırıldı). Ayar açık ama grupta hiç ödev yoksa (veri yok) toplam hesaba Ödev Notu hiç girmez, sadece Sertifika Notu esas alınır.
  - **Ödev Notu sayfası:** "Notları Kaydet" artık her öğrencinin net puanını (puan−ceza) DOĞRUDAN `Submission.grade`'e yazıyor (`PATCH /submissions/[id]/grade`, `Promise.all` — çoklu istek). Teslimi olmayan öğrenci notlanamaz (Submission dokümanı yok — zaten payda hesabında 0 sayılır, ekstra işlem gerekmez). `MAX_PUAN` artık sabit değil, her ödevin kendi `maxPuan`'ından okunuyor. Dummy veri fallback'i KORUNDU.
  - **30 assertion geçti** (`scripts/assert-submission.ts`: maxPuan sınırı + `computeOdevYuzdeleri` — toplama/boş-grup/taslak-hariç senaryoları). Toplam **202 assertion (13 script)** yeşil. `tsc`+ESLint+build temiz.
- **Ödev Notu'nun İÇ ağırlıklandırması eklendi (aynı gün devam, 2026-07-06):** Kullanıcı kararı — Ödev Notu tek bir havuz değil, `normal` ödevler (%30) ve `proje` ödevler (%70) diye AYRI ağırlıklandırılan iki kategori; bu SABİT iş kuralı, Sertifika Ayarları'ndaki dışsal Sertifika/Ödev ağırlığından (`CertificateSettings.sertifikaPct`) TAMAMEN AYRI bir eksen — ikisi karıştırılmamalı.
  - **`Assignment.kind?: "normal" | "proje"`** eklendi (varsayılan "normal"). `assignTask`/`updateAssignment` kabul ediyor + validasyon.
  - **`computeOdevYuzdeleri`** artık `{normal, proje}` diye iki ayrı kategori döndürüyor (her biri kendi `totalMaxPuan`+`earnedByPerson`'ı ile) — eskiden tek düz `{totalMaxPuan, earnedByPerson}` idi.
  - **`combineOdevYuzdesi(result, personId)`** (yeni, `submission-service.ts`) — `ODEV_TUR_AGIRLIK = {normal:30, proje:70}` ile ağırlıklı nihai yüzdeyi hesaplar. Bir kategori hiç yoksa ağırlık TAMAMEN diğerine kayar (100%); ikisi de yoksa `null` (veri yok, sertifika hesabı Sertifika Notu'na düşer).
  - **Sertifika Notu sayfası:** `odevYuzdesi()` artık aynı ağırlıklı formülü client-side uyguluyor (submission-service.ts'teki sabitle senkron, yorumla işaretli).
  - **Ödev Notu sayfası:** ödev listesinde `proje` türü ödevler mor "Proje" rozetiyle işaretleniyor (görsel ayrım, düşük maliyetli dokunuş).
  - **5 yeni assertion** (`scripts/assert-submission.ts`, toplam 35): kategori ayrımı, tek-kategori-varken-tam-ağırlık, ağırlıklı-karışık-hesap (normal %100 + proje %50 → %65), veri-yok senaryosu. Toplam **207 assertion (13 script)** yeşil. `tsc`+ESLint+build temiz.
- **"Notları Gönder" akışı NETLEŞTİ (henüz KOD YOK, kullanıcı "bunlar sonra" dedi — 2026-07-06):** Bu akış aslında §5.2'de (Sertifika Verme Akışı) zaten tasarlanmıştı, kullanıcı bugün TEYİT etti + bir noktayı YUMUŞATTI:
  - **Ayrı bir "gönder/kilitle" adımı YOK** — eğitmen not girdiği an (Taslak Kaydet), Eğitim Op ZATEN aynı Grade kaydını görüyor (paylaşımlı okuma, ek bir "submit" gerekmiyor). Sertifika Notu ekranı ile Eğitim Op'un göreceği ekran **AYNI** — tek fark Op'ta her öğrenci satırında ekstra **"Sertifika Bastır"** butonu olması.
  - **Not DEĞİŞTİRİLEBİLİR kalır** (eskiden `FrozenResult` docstring'inde "DEĞİŞMEZ" yazıyordu — bu YUMUŞATILDI): sertifika basıldıktan sonra bile elzem durumlarda yetkili kişi (Op/Admin) notu düzeltebilmeli. Sert bir freeze/immutable snapshot YOK.
  - **Sertifika Bastır** → sistem notu görüp `%90` Başarı / `%50` Katılım eşiğine göre otomatik doğru sertifika türünü seçip basar (mevcut Sertifika Notu sayfasındaki durum-chip mantığıyla AYNI eşikler).
  - **Basım anında otomatik mail** öğrenciye gider ("Sertifikanız hazır"); SMS entegrasyonu ve mail şablonu İLERİDE (kullanıcı: "bunlar sonra").
  - **Kod YAZILMADI** — bu sadece tasarım teyidi. Sıradaki iş buysa: `certificate.issue`/`certificate.read` capability'lerini registry+packages'a eklemek (tasarımda zaten var, §3.3 tablo) + Eğitim Op'un "Sertifika Notu" görünümüne (aynı sayfa, yetki bazlı ekstra buton) + basım/mail tetikleme servisi.
- **✅ "Ödev Oluştur" modalı BİTTİ (aynı gün devam, 2026-07-06):** Kullanıcı Claude Design çıktısı verdi (`Ödev Oluştur.dc.html`), Ödev Parkuru'ndaki "+Ödev Ver" butonuna bağlandı (`egitmen-anasayfa/OdevOlusturModal.tsx`).
  - **Alanlar:** İkon seçimi (16 lucide ikon, kozmetik — `Assignment.icon`), Ödev Adı, Alt Başlık (`Assignment.subtitle` — YENİ alan, **Ödev Parkuru kartında da gösteriliyor**, başlığın altında ayrı satır), Ödev Türü (Ödev/Proje → mevcut `kind` alanına bağlı, Ödev Notu iç ağırlıklandırmasını besler), Grup, Bitiş Tarihi, Ödev Puanı (hızlı seçim 100/150/200/250/300 → `maxPuan`), Açıklama, "Şablon olarak kaydet" toggle.
  - **"Şablon olarak kaydet" → KİŞİSEL kütüphane (2026-07-06 kararı, ayrı netleştirme):** "Global kütüphane sadece admine özel" ama bu ERTELENDİ ("sonra yapacağız") — BU turda sadece KİŞİSEL: her eğitmen kendi şablonunu kaydedebilir, sadece kendisi görür. `AssignmentTemplate`'e `scope:"personal"|"global"` + `trainerId` eklendi; `template.manage` capability'si **aynı key, scope'a göre dallanıyor** (self→personal, org/Op-Admin→global, certificate.settings.write ile AYNI desen). `listTemplates` artık scope'a göre filtreliyor (kişisel sadece sahibine, global herkese). **3 yeni assertion** (`assert-assignment.ts`, toplam 20): eğitmen kişisel şablon oluşturabilir, başka eğitmenin kişiselini göremez, global herkese açık kalır.
  - **Geçiş animasyonu:** framer-motion, FlexOS'un paylaşımlı `FlexModal.tsx` ile AYNI değerler (backdrop 0.18s fade, panel 0.24s scale/y cubic-bezier) — canlıdaki `management-components/Modals.tsx` modal deseniyle uyumlu.
  - **Layout — kullanıcı geri bildirimiyle 2 tur revize edildi:** (1) küçük ekranda dikey scroll çıkıyordu → alanlar aynı satırda gruplandı (tür+grup+tarih tek satır), modal genişletildi (880→960px) + kısaltıldı (760→600px). (2) sıralama değişti: Ödev Adı üstte, Alt Başlık altında (aynı sütun), İkon Seçimi sağda uzun/dikey buton (`items-stretch` ile iki input'un toplam yüksekliğine eşit).
  - `tsc`+ESLint+`npm run build` temiz. Toplam **210 assertion (13 script)** yeşil.
  - **Layout — kullanıcıyla ~8 tur revize edildi (aynı gün) — NİHAİ HÂL:** modal `maxWidth:860px`, yükseklik `min(770px, calc(100dvh-32px))` (`100vh` DEĞİL — `dvh` kullanılıyor, tarayıcı chrome'u genişleyip daraldıkça `vh` değişip modalı kaydırıyordu). Her yönde **24px padding** (header/body/footer). Etiketler 12.5px font + `mb-2`, body satır arası boşluk `gap-4` (16px) — "öğe araları çok dar" geri bildirimiyle büyütüldü. Açıklama **sabit `rows={4}`** (flex-grow'lu deneme görsel çakışmaya sebep olmuştu, kaldırıldı). Son satır: **"Ödev Dosyası Yükle" (sol, placeholder) + "Şablon olarak kaydet" (sağda, kompakt toggle kart)** yan yana, dosya yükleme metni sola yaslı.
  - **Backdrop'un KENDİ `overflow-y-auto`'su kaldırıldı** (2026-07-06 düzeltme) — modal zaten `dvh`'ye göre sığacak şekilde sınırlı, backdrop'un scroll'a hiç ihtiyacı yoktu; scrollbar belirip kaybolması (Mac'te "scrollbar'ları hep göster" ayarı açıkken ~15px) küçük bir kayma hissi yaratıyordu. İçerik taşarsa SADECE modalın kendi body'si kayar.
  - **"Ödev Dosyası Yükle" BİLEREK PLACEHOLDER — kullanıcı: "bu kısım sonra olur" (2026-07-06):** Sürükle-bırak + çoklu dosya + otomatik yükleme istendi (Drive'a). Backend YOK — kutu "yakında" toast'ı veriyor. **Kullanıcının belirttiği hedef klasör yapısı (ileride kurulunca uygulanacak):** `Grup Adı > Eğitmen Adı > Ödev Adı`. Kurulacağı zaman muhtemelen `submission-service.ts`'teki `initUpload`/`completeUpload` resumable-session deseninin (Drive entegrasyonu zaten var, `DriveDeps`) ödev-eki için genellenmesi gerekecek — assignmentId henüz yokken (oluşturma anında) upload edilebilmesi için grup+eğitmen bazlı ayrı bir session modeli lazım (Assignment'a değil).
  - **KALAN (küçük):** Ghost kart üzerindeki "Ödev Ver" (şablonu aktive et, `AssignActivateModal` karşılığı) ve "Detay" hâlâ "yakında".

### 🔵 Sertifikasyon — Sertifika Ayarları UI portlandı, ÜÇÜ de tamam ama HİÇBİRİ backend'e bağlı değil (2026-07-06, aynı gün devam)

`/flexos/sertifikasyon/ayarlar` — Claude Design çıktısından (`Sertifika Ayarları.dc.html`) birebir port: "Ödev notu sertifika hesabında kullanılsın" toggle'ı + (açıksa) bağlı Sertifika/Ödev ağırlık slider'ları (toplam hep %100) + hızlı ön ayarlar (%100/%70-30/%60-40/%50-50) + koyu lacivert "Örnek Hesaplama" kartı (80×sertifika + 90×ödev = toplam) + kapalıyken dashed bilgi kutusu. Tamamen local state, "Ayarları Kaydet" "yakında" toast'ı.

**Sertifikasyon menüsü artık 3 sayfa da UI olarak tamam** (Sertifika Notu, Ödev Notu, Sertifika Ayarları) — **hiçbiri gerçek backend'e yazmıyor/okumuyor** (grup/ödev/öğrenci listeleri gerçek, ama notlar/ayarlar local state). Bu ayarlar sayfasındaki toggle, Sertifika Notu'nda kaldırılan switch'in YERİNİ tutacak şekilde tasarlandı (kullanıcı: "sertifika ayarlarına ödev notu aç/kapa ekleyeceğiz, oradan kapatınca buraya da otomatik yansıyacak") — ama bu bağlantı henüz KURULMADI (ikisi de kendi local state'inde, ortak bir kaynağa bağlı değil). Backend kurulunca: tek bir `CertificateSettings` (tenant-level, muhtemelen `odevAktif`+`sertifikaPct`) kaydı hem Ayarlar sayfasını hem Sertifika Notu'nun sütun görünürlüğünü hem Ödev Notu'nun (otomatik puan) hesaplama mantığını beslemeli.

`tsc`/`eslint`/`build` temiz.

### 🔵 Sertifikasyon — Ödev Notu UI portlandı, backend YOK (2026-07-06, aynı gün devam)

Sidebar'a **Ödev Notu** eklendi (Sertifika Notu ile Sertifika Ayarları arasına — kullanıcı sırası: "Sertifika Notu, sonra ödev notu gelecek"). Kullanıcı Claude Design çıktısı verdi (`Ödev Notu Verme.dc.html`), "sayfası hazır, hemen yap" dedi.

- **`/flexos/sertifikasyon/odev-notu`** — 2 görünüm: (1) grup seç → o grubun ödevleri liste halinde (durum özeti: Bekliyor/X-Y puanlandı/Tamamlandı), (2) bir ödeve tıklayınca öğrenci bazlı puanlama tablosu (Teslim Durumu dropdown: Teslim etti/1 hafta gecikmeli/2 hafta+ gecikmeli/Teslim etmedi → gecikme cezası %0/%10/%20/%100, Ödev Puanı input, Net Puan = puan−ceza).
- **Grup/ödev/öğrenci listesi GERÇEK veri** (`GET /api/flexos/groups` + `GET /api/flexos/assignments?groupId=` + roster) — canlıdaki gibi sahte "GRP-01" verisi yok, gerçek Faz1/2 assignment domain'i kullanıldı. Teslim Durumu her öğrenci için gerçek `Submission`'dan ÖN-DOLDURULUYOR (`GET /api/flexos/submissions?assignmentId=` — teslim var mı yok mu → "Teslim etti"/"Teslim etmedi" başlangıç değeri), ama sonrası (dropdown değişimi, puan girişi, kaydetme) sadece local state.
- **`maxPuan` sabit 100** — Assignment entity'sinde henüz puan alanı yok.
- Kullanıcı önemli notu (henüz UYGULANMADI, sadece kayıt): "Ödev notu puanı normalde ELLE girilmeyecek — öğrenci ödevlerini tamamladıysa otomatik hesaplanıp sabitlenecek." Yani bu manuel puanlama ekranı GEÇİCİ/ara adım; asıl hedef Submission tamamlanma oranından otomatik puan üretimi. Backend (Grade domain — zaten `education/grade.ts`'te entity var ama repo/servis yok) kurulunca bu sayfa muhtemelen büyük ölçüde otomatikleşecek ya da sadece istisna/override ekranına dönüşecek.

`tsc`/`eslint`/`build` temiz.

### 🔵 Sertifikasyon — Sertifika Notu UI portlandı, backend YOK (2026-07-06)

Ödev işi kullanıcı kararıyla duraklatıldı ("ödevler burada dursun, sonra devam ederiz") — yeni öncelik: **Sertifikasyon** menüsü (Sertifika Notu + Sertifika Ayarları). Kullanıcı Claude Design çıktısı verdi (`Sertifika Not Verme.dc.html`) ve "UI kısmını en önce yapalım" dedi.

- Sidebar'a **Sertifikasyon** akordiyonu: **Sertifika Notu** (`/flexos/sertifikasyon/not`, kuruldu) + **Sertifika Ayarları** (henüz "yakında" — tasarımı gelecek).
- **Sertifika Notu** — tasarımdan BİREBİR görsel port: sol sabit grup listesi (renkli çubuk + seçili tik), sağda toolbar (grup bilgisi + "Ödev Notu" aç/kapa toggle + ağırlık rozeti `%70/%30` veya `%100`) + öğrenci not tablosu (avatar+isim, Sertifika Notu input, Ödev Notu input — toggle'a göre gizli/görünür, Toplam Not (ağırlıklı hesap, renkli rozet), Durum chip: `≥90` Başarı Sertifikası yeşil / `≥50` Katılım Sertifikası mavi / altı boş).
- **Grup + öğrenci listesi GERÇEK veri** (`GET /api/flexos/groups` + `GET /api/flexos/groups/[id]/roster`) — sahte isim yok.
- **Backend BİLEREK YOK bu turda** — `Grade` domain entity zaten tanımlıydı (`domain/education/grade.ts`, `id=enrollmentId`, `projectGrade`/`assignmentScore`/`components`) ama repo/servis/route hiç kurulmamıştı. Notlar şimdilik SADECE local state'te (`sayfa yenilenince kaybolur`), "Taslak Kaydet"/"Notları Gönder" butonları "yakında" toast'ı veriyor — bir sonraki adım bu domain'i (Faz 1/2 desenindeki gibi: repo+servis+capability-gated route+assertion) kurup bu UI'ı ona bağlamak.

`tsc`/`eslint`/`build` temiz.

### ✅ Şablon havuzu kararı netleşti + Ana Sayfa'dan Ödev Kütüphanesi kaldırıldı (2026-07-06)

Kullanıcı kararı: canlıdaki mevcut şablonlar (özellikle **oyunlaştırılmış olanlar**) global bir **template ödev kütüphanesi** olarak saklanacak; herhangi bir tasarım eğitmeni oradan kendi kütüphanesine **duplicate/kopyala** diyebilecek (`templateKind: "standard"|"system"` + deep-copy tasarımıyla örtüşüyor, [[flexos_odev_faz2_submission_2026_07_05]]). **Ama** bu kütüphane Eğitmen Ana Sayfa'da GÖSTERİLMEYECEK — kullanıcı: "anasayfada alt kütüphane kısmında kişisel ve global olmayacak, hiç bişi yazmayacak... muhtemelen Ödev Yönetimi içine ekleriz."

Buna göre `egitmen-anasayfa/page.tsx`'teki placeholder "Ödev Kütüphanesi" (Kişisel/Global tab'lı) bölümü **tamamen kaldırıldı** — henüz gerçek şablon-duplicate tasarımı kodlanmadığı için (kullanıcı: "kütüphaneyi kaldırsan bile sakın canlıdakilere dokunma" — FlexOS zaten `flexos_assignment_templates` ayrı koleksiyonunu kullanıyor, canlı `templates`'a hiç dokunulmadı/dokunulmuyor). Şablon kütüphanesi ileride muhtemelen Ödev Yönetimi'ne ("Şablon Yönetimi" sekmesi olarak) eklenecek — henüz kod yok, sadece karar.

`tsc`/`eslint`/`build` temiz.

### ✅ Ödev Parkuru (Eğitmen Ana Sayfa) — gerçek veriye bağlandı, GÖRÜNÜM only (2026-07-06)

Kullanıcı: "Ödev Yönetimi'nde neden Yeni Ödev butonu var, orası sadece verilmiş ödevlerin listesi" → doğru, canlıda `TaskManagementPanel`'in Mevcut Ödevler/Arşiv sekmelerinde oluşturma YOK (sadece düzenle/sil/arşivle) — buton kaldırıldı. Gerçek oluşturma noktası **Eğitmen Ana Sayfa**'daki "Ödev Parkuru": sağ üstte turuncu "+Ödev Ver", altında kart grid'i.

Canlıdaki `DesignParkour.tsx` (1070 satır, `dashboard/page.tsx`'te `maxSlots={4} compact`) tam okunup mantığı çözüldü: **3 kart türü, sırayla doldurulur:**
1. Gerçek aktif ödevler (en yeni solda, `createdAt` DESC).
2. Kalan slotlar → kullanılmamış şablonlardan "ghost" kart (GERÇEK isim/açıklama ama soluk/pasif stil — kesikli border, "Pasif" durumu, disabled buton), deterministik karıştırma (id-hash `%7`, her render'da rastgele değişmez).
3. Hâlâ slot kalırsa tamamen boş skeleton placeholder.

Kullanıcı onaylı kademeli kapsam: **bu turda SADECE kart görünümü** — `egitmen-anasayfa/page.tsx`'teki `OdevParkuru()` artık `/api/flexos/assignments` + `/api/flexos/assignment-templates`'ten gerçek veri çekiyor, 3 kart türünü doğru sırada/sayıda render ediyor. **Aksiyonlar (Ödev Ver, Ödevi Başlat, Detay) hâlâ "yakında" toast** — canlıdaki `QuickAssignModal`/`AssignActivateModal`/düzenle-bitir-iptal modalları henüz portlanmadı, ayrı bir iş kalemi. "Ödev Teslimi" hızlı aksiyon kartı da (`href={null}` idi) gerçek sayfaya bağlandı.

`tsc`/`eslint`/`build` temiz.

### ✅ Ödev Verme — Eğitmen tarafı "Ödev Teslimi" + "Ödev Yönetimi" BİTTİ (2026-07-05/06)

Sidebar'a **"Ödevler"** akordiyonu: **Ödev Yönetimi** / **Ödev Teslimi** / **Ödev Değerlendirme** (üçüncüsü henüz "yakında", en sona bırakıldı — notlandırma).

**⚠️ Bu ikisi AYRI ekranlar, karıştırılmamalı** (bir ara yanlışlıkla birleştirilip geri ayrıldı, bkz. aşağıdaki düzeltme notu):
- **Ödev Teslimi** (`/flexos/odevler/teslim`) — canlıdaki 3 kademeli akışın (`dashboard/assignment/page.tsx` → `[groupId]/page.tsx` → `[groupId]/[assignmentId]/page.tsx`) **birebir görsel** portu ("grup kartları falan orada, birebir istiyorum" talebiyle): grup kartları (`GroupCard`, renk paleti/arşivleme modalı BİREBİR) → grubun ödev listesi (accordion, teslim/bekleyen/revize istatistikleri, SALT-OKUNUR — oluşturma/düzenleme YOK burada) → tek ödevin master-detail teslim ekranı (öğrenci listesi + dosyalar + yorum paneli). Kullanıcı kararı: "notlandırma sistemini en son yapacağız — ödev verme/alma canlı çalışsın şimdi" → **grading aksiyonları (Revize İste/Onayla) BİLEREK YOK**, sadece görüntüleme + yorumlaşma.
- **Ödev Yönetimi** (`/flexos/odevler/yonetim`) — canlıdaki `TaskManagementPanel.tsx` (1095 satır, `/dashboard/tasks`, global 5 sekmeli ayarlar sayfası: Şablon Yönetimi/Mevcut Ödevler/Arşiv/Ödev Havuzları/Lig) — **GRUP KARTI DEĞİL, TEK global tablo** (grup sadece bir sütun). Kullanıcı onaylı kademeli kapsam: şimdilik SADECE **Mevcut Ödevler + Arşiv** sekmeleri — global tablo (tüm gruplardaki ödevler tek listede, grup/durum/teslim tarihi sütunlu), "Yeni Ödev" modalında Grup seçimi zorunlu, düzenle/sil/arşivle/aktife-al, arşivde toplu seç+sil. **Şablon Yönetimi + Ödev Havuzları henüz YOK** — kullanıcının oyunlaştırılmış şablonları için önemli olduğu belirtildi ama `templateKind: "standard"|"system"` + duplicate/deep-copy tasarım kararı henüz verilmedi (bkz. [[flexos_odev_faz2_submission_2026_07_05]]), karar netleşince eklenecek. **Lig Yönetimi hiç YOK** (kullanıcı kararı: ayrı/opsiyonel modül). FlexOS'un TEK canonical `assignTask`/`updateAssignment`/`deleteAssignment` servisine bağlı.

**Düzeltme geçmişi (aynı gün, ders çıkarılacak — 3 tur yanlış anlama):** (1) Önce Ödev Yönetimi'ni Ödev Teslimi'nin neredeyse kopyası (grup kartı → CRUD) olarak yaptım → kullanıcı "aynı sayfa" dedi → bunu "birleştir/sil" diye yanlış yorumlayıp Yönetimi SİLDİM. (2) Kullanıcı düzeltti: "canlıya bak, sildin" → geri EKLEDİM ama yine grup-kartı deseniyle (aynı hata). (3) Kullanıcı canlı URL'i verdi (`/dashboard/tasks`) → gerçekten okundu: TaskManagementPanel **HİÇ grup-kartı kullanmıyor**, global tablo. Doğru versiyon böyle kuruldu. **Ders:** kullanıcı bir sayfayı "aynı/yanlış" diye eleştirdiğinde önce canlıdaki GERÇEK karşılığını (URL'i varsa) tekrar oku — varsayımla düzeltme yapma, ikinci kez de yanlış çıkabilir.

**Yeni backend parçası:** `getSubmissionForStaff` (`submission-service.ts`) + `GET /api/flexos/submissions/[id]` — tek bir teslimin dosyalarını+sahibini döner (`submission.read` gated, grup-scope kontrollü). Diğer her şey Faz 1/2/3'te zaten kurulan servis/route'ları reuse ediyor (assignment CRUD, submission listeleme, comment-service).

Artık uçtan uca döngü test edilebilir: Ödev Yönetimi'nde ödev oluştur → Ödev Teslimi'nde/öğrenci `/flexos/student/[personId]` üzerinden yükler → eğitmen Ödev Teslimi'nde teslimi görür + yorum yazar.

`tsc --noEmit` + `eslint` + `npm run build` temiz. `assert-submission.ts` (23), `assert-comment.ts` (20), `assert-assignment.ts` (18) regresyon yok. **Test edilmeyen:** tarayıcıda gerçek veriyle uçtan uca kontrol edilmedi.

### ✅ Ödev Verme — Faz 3 (Öğrenci ekranları) + Yorum/Bildirim domain'i BİTTİ (2026-07-05)

Kullanıcı: "canlıdakini birebir alacaksın görünüm ve işleyiş olarak" — canlıdaki `/student/[studentId]/page.tsx` (651 satır) + `/student/[studentId]/[taskId]/page.tsx` (1038 satır) tam okunup FlexOS'a portlandı: `src/app/flexos/student/[personId]/page.tsx` (dashboard: filtre pilleri, accordion ödev listesi, Duyurular paneli) + `src/app/flexos/student/[personId]/[assignmentId]/page.tsx` (drag-drop + 256KB chunk'lı resumable upload, Teslim Geçmişi, geri çekme, sağda 1:1 yorum paneli). **Bilinçli farklar:** SVG karakter avatarı yerine FlexOS'un her yerdeki initials+gradient dairesi (kullanıcı kararı), Sınıf Ligi widget'ı YOK (ayrı roadmap kalemi), accordion'da ResizeObserver animasyonu yerine düz conditional render (basitleştirme).

**Kullanıcı itirazı üzerine kapsam büyütüldü — yorum/bildirim "can damarı" (Faz 4'ten öne çekildi):** Faz 4'e bırakılması planlanan yorum/duyuru sistemi, kullanıcının "öğrenci yükler, ben yorum yazamazsam ödevin hiç önemi kalmaz" itirazı üzerine ŞİMDİ kuruldu:
- `domain/core/comment.ts` — TEK `Comment` entity: `personId` doluysa 1:1 thread (eğitmen↔öğrenci, submission olmasa bile çalışır — canlıyla aynı), boşsa genel duyuru (gruptaki herkes görür, SADECE eğitmen/op yazar).
- Yeni capability `assignment.comment.write` (egitmen assigned, op/admin org) — öğrencinin kendi thread'ine yazması/düzenlemesi/silmesi ise capability DIŞINDA, Faz 2/3 sahiplik deseniyle aynı (`authorUid`/`person.authUid` eşleşmesi).
- `comment-service.ts`: `postGeneralComment`/`postThreadCommentAsStaff` (gated) + `postThreadCommentAsStudent`/`list*ForStudent` (sahiplik) + `editOwnComment`/`deleteOwnComment` (rol farketmez, SADECE `authorUid` sahipliği — canlının `canAct` mantığıyla aynı) + `listAnnouncementsForStudent` (kişinin aktif olduğu TÜM gruplardaki duyurular, dashboard için).
- **Bildirim/toast — YENİ SİSTEM İCAT EDİLMEDİ:** proje kökünde zaten global `NotificationToastListener` + `Toaster` (sonner) + `users/{uid}/notifications` (canlının `complete-upload` route'unun yazdığı AYNI koleksiyon/kural) çalışıyordu — `lib/server/flexos-notify.ts` sadece bu koleksiyona admin SDK ile doc yazıyor, geri kalan her şey (real-time onSnapshot, toast, okundu işaretleme, `NotificationBell` dropdown) zaten hazırdı. **Ekstra kazanç:** `FlexHeader.tsx`'teki bildirim zili daha önce sadece `toast.info("yakında")` stub'ıydı — gerçek `<NotificationBell/>` ile değiştirildi, artık TÜM FlexOS staff sayfalarında (20+ sayfa) çalışan bir bildirim geçmişi var.
- Yorumlar client'ta **polling** ile tazeleniyor (6sn, sekme arka plandayken durur) — `flexos_comments` için yeni bir Firestore client-rules açılımı YAPILMADI (bkz. `[[flexos_firestore_client_access_pattern]]` hafızası), anlık toast zaten yukarıdaki global sistemden geliyor.
- `EnrollmentRepo.listByPerson` eklendi (kişinin TÜM kayıtlarını bulmak için — önceki `findActive` sadece belirli bir grup+kişi çifti alıyordu); bu interface değişikliği `assert-cancel-sale.ts`/`assert-enrollment-status.ts`/`assert-lesson-exception.ts`/`assert-standalone-mode.ts`'teki fake repo'lara da yansıtıldı.
- Yeni route'lar: `/api/flexos/assignments/[id]/comments`(+`/thread`) (staff), `/api/flexos/student/assignments`(+`/[id]`, `/[id]/comments`, `/[id]/thread`) + `/api/flexos/student/announcements` + `/api/flexos/student/me` (öğrenci, sahiplik-gated), `/api/flexos/comments/[id]` (PATCH/DELETE, ortak sahiplik).
- `scripts/assert-comment.ts` — **20 assertion, hepsi geçti** (staff/öğrenci gating, bildirim tetikleme, çoklu-grup duyuru birleştirme, sahiplik-only edit/delete, org-scope, tenant izolasyonu). `assert-submission.ts` (23) ve `assert-assignment.ts` (18) regresyon olmadan geçmeye devam ediyor.

`tsc --noEmit` + `eslint` + `npm run build` temiz (yeni route'lar + iki öğrenci sayfası dahil). **Test edilmeyen:** tarayıcıda gerçek bir öğrenci hesabıyla uçtan uca doğrulanmadı (bu ortamda giriş yapılamıyor) — sıradaki oturumda gerçek bir öğrenci+eğitmen çifti ile upload→yorum→bildirim akışı canlı kontrol edilmeli. Ayrıca öğrenci "Ayarlar" (ses bildirimi) sayfası portlanmadı (kapsam dışı bırakıldı, istenirse eklenir).

### ✅ Ödev Verme — Faz 2 backend (Submission + Google Drive domain) BİTTİ (2026-07-05)

Faz 1'in üstüne: `Submission`/`SubmissionFile`/`UploadSession` (`src/app/lib/domain/core/submission.ts`). **Canlıdan tasarım farkı:** bir (assignment, kişi) çifti için TEK `Submission` dokümanı yaşar (canlıda her yükleme yeni doküman açıyordu, durum/not 3 dağınık yoldan değişiyordu). Dosya geçmişi `SubmissionFile` versiyonlamasında (`isLatest` bayrağı), `iteration` revizyon sonrası her yeni yüklemede artar.

**Capability'ler (registry.ts + packages.ts):** `submission.read`, `submission.status.write`, `submission.grade` — eğitmen `assigned` (kendi grubu), Operasyon/Admin `org`. Öğrencinin kendi teslimini yükleme/silme/geri çekmesi BİLEREK bu registry'nin dışında — capability yerine basit sahiplik kontrolü (`person.authUid === requesterUid`), canlının öğrenci-tarafı zaten Actor sisteminin tamamen dışında olduğu için (Faz 3 notuyla tutarlı).

**`submission-service.ts`** (TEK canonical servis): `initUpload`/`getSessionForChunk`/`completeUpload`/`deleteFile`/`retract` (öğrenci, sahiplik-gated) + `updateSubmissionStatus`/`gradeSubmission`/`listSubmissionsFor{Assignment,Group}` (eğitmen/op, capability-gated, `assignment-service.ts` ile birebir desen). `getMaxUploads` iş kuralı canlıyla birebir (`completed`→0, `revision`→8, diğer→5).

**Google Drive: `googledrive.ts` DEĞİŞTİRİLMEDEN reuse edildi** — `lib/server/submission-drive.ts` `DriveDeps` portunu (`domain/repo/drive-deps.ts`) gerçek `ensureFolderPath`/`initResumableSession`/`setPublicReadPermission`/`findFileByActualName`/`deleteFromDrive` fonksiyonlarıyla dolduruyor, aynı OAuth2 refresh-token + `GOOGLE_DRIVE_FOLDER_ID` env değişkenleri (.env.local'den, elle uğraşılmadı). FlexOS kendi izole alt-ağacını açıyor: `flexos/{tenantId}/{groupCode}/{personName}/{assignmentTitle}`.

**Route'lar (`/api/flexos/submissions/*`):** `init-resumable-upload`/`upload-chunk`(saf proxy, Firestore'a yazmaz)/`complete-upload`/`delete-file`/`retract` (öğrenci-tarafı, `withAuth` + sahiplik) + `GET /` (liste, `submission.read` gated, assigned-scope `trainerId` filtreli — `assignments/route.ts` deseniyle aynı) + `PATCH [id]/status`, `PATCH [id]/grade` (capability-gated).

Firestore: `flexos_submissions`, `flexos_submission_files`, `flexos_upload_sessions` (canlının `submissions`/`submission_files`/`upload_sessions`'ına dokunulmadı). `PersonRepo`'ya `findByAuthUid` eklendi (öğrenci sahiplik çözümü için).

`scripts/assert-submission.ts` — **23 assertion, hepsi geçti** (sahiplik/yetki gating, dosya boyutu/MIME validasyonu, max-upload limiti, revizyon döngüsü, org-scope bypass, retract iş kuralları, tenant izolasyonu) — gerçek Drive network çağrısı YAPILMADI, fake `DriveDeps` enjekte edildi.

`tsc --noEmit` + `eslint` + `npm run build` temiz (8 yeni route dahil). **UI YOK bu fazda** (Faz 3/4'e bırakıldı, kullanıcı kararı: "Ödev UI ve havuzlarını sonra düşünelim").

**Not — kullanıcıyla konuşulan ama Faz 2'ye dahil edilmeyen konular (sıradaki oturumlarda ele alınacak):**
- **Şablon havuzu yeniden tasarımı:** şu an kişisel + global havuz var; kullanıcının 3 adet oyunlaştırılmış (kura sistemli, özel kodlanmış animasyonlu — örn. kitap kapağı) şablonu var, hiçbir branş kullanmıyor. Karar: `templateKind: "standard" | "system"` ayrımı — `system` şablonlar SADECE kod deploy'uyla eklenir/değişir (UI'dan oluşturulamaz/silinemez), eğitmenler kütüphaneden **duplicate** edip kendi kişisel havuzuna alabilir; duplicate her `system` şablonun kendine özel payload'ını (örn. kitap kapağı listesi) DEEP-COPY ile izole bir kopyaya taşır (her template-tipinin kendi `cloneData` stratejisi gerekir — genel bir clone fonksiyonu yetmez). Henüz kod yazılmadı.
- **Öğrenci portalı:** ayrı ve kapsamlı bir modül olarak FlexOS bitince ele alınacak — ödev görme/gönderme/takip, not görme, talep, yoklama görme, sınav, anket. FlexOS içinde mi dışında mı olacağı henüz kararlaştırılmadı.

### ✅ Ödev Verme — Faz 1 backend (Assignment/Template domain) BİTTİ (2026-07-04, aynı gün devam)

Kullanıcı: eğitmen tarafında Yoklama'dan sonra kalan 2 ciddi alan — Ödev Verme/Alma + Not Girme (Sınıflar Ligi tamamen ayrı/opsiyonel, şimdilik yok). Önce canlıdaki mevcut sistemi bir agent'a inceletmiştik: **ödev oluşturma canlıda 2 bağımsız yoldan** oluyordu (`AssignmentLibrary.tsx` + `DesignParkour.tsx`, ikisi de kendi başına `addDoc`), **submission durum/not güncelleme 3 ayrı yoldan**, eğitmen tarafı dosya yükleme öğrenciden FARKLI endpoint kullanıyordu. **Önemli bulgu: DesignParkour "oyunlaştırılmış" değil** — XP/rozet/streak yok (grep'te çıkmadı), aynı `tasks`/`templates` verisi üzerine sadece farklı bir görsel cilt. Google Drive entegrasyonu (`googledrive.ts`) ise dikkatli yazılmış, kırılganlığı kod değil tek kişisel OAuth hesabı — olduğu gibi korunacak.

**Karar (plan onaylandı):** Bu dağınıklığı FlexOS'a taşımıyoruz — TEK canonical create-servis, TEK submission durum/not servisi. **Faz 1 = Assignment/Template domain, backend-only, Submission/Drive'a HİÇ dokunulmadı** (en riskli parça izole bir sonraki faza bırakıldı ki fake repo ile assert edilebilsin).

**Yapılanlar:**
- `src/app/lib/domain/core/assignment.ts` (Assignment+AssignmentAttachment) + `assignment-template.ts` (AssignmentTemplate) — canlıdaki `tasks`/`templates` karşılığı.
- Capability'ler: `assignment.create/edit/read/delete` + `template.manage` (registry.ts). Paket kablolama: `egitmen` (assigned scope, yoklama/not gibi çekirdek iş — standalone-only DEĞİL), `operasyon`+`admin` (org scope + `template.manage` — kütüphane küratörlüğü sadece Op/Admin, eğitmen sadece okur).
- Repo+Firestore adapter (`flexos_assignments`, `flexos_assignment_templates` — canlının `tasks`/`templates`'ına dokunulmadı).
- `assignment-service.ts`: `assignTask` (grup sahipliği `can(actor,"assignment.create",{groupId,ownerUid:group.trainerId})` ile kontrol — `attendance-service.ts`'teki desenle birebir), `updateAssignment`, `deleteAssignment`, `createTemplate`, `listTemplates`.
- Route'lar: `POST/GET /api/flexos/assignments` (GET'te assigned-scope aktör sunucu tarafında kendi ödevlerine daraltılır — `groups/route.ts`'teki `trainerId` zorlama deseniyle aynı), `PATCH/DELETE /api/flexos/assignments/[id]`, `GET/POST /api/flexos/assignment-templates`.
- `scripts/assert-assignment.ts` — **18 assertion, hepsi geçti** (yetki gating, scope izolasyonu, validasyon, tenant izolasyonu, template küratörlüğü).

`tsc --noEmit` + `eslint` + `npm run build` temiz (yeni 3 route dahil). **UI YOK bu fazda.**

**TAM FAZ PLANI (plan dosyası makineye özel/senkronlanmıyor, o yüzden burada tam kopyası):**

**Faz 2 (SIRADAKİ) — Submission + Google Drive:**
- Domain (outline, henüz yazılmadı): `Submission extends Audit` — `id, tenantId, assignmentId, personId, groupId, status ("pending"|"submitted"|"revision_requested"|"approved"|"rejected"), grade?, gradedAt?, gradedBy?, retractedAt?`. `SubmissionFile extends Audit` — `id, tenantId, submissionId, version, actualFileName, originalFileName, driveFileId, mimeType, fileSize, uploadedBy`. `UploadSession` — `id, tenantId, submissionId, personId, actualFileName, driveSessionUri, status, expiresAt` (canlıdaki 7 günlük TTL/idempotency deseni aynen).
- Yeni capability'ler: `submission.read`, `submission.grade`, `submission.status.write` (assignment.* ile aynı scope mantığı — egitmen assigned, operasyon/admin org).
- Canlının 3 durum/not güncelleme yolu (`PATCH .../status`, ayrı `PATCH .../grade`, dağınık client `updateDoc`) yerine **TEK servis** (`updateSubmissionStatus`/`gradeSubmission`).
- **Google Drive: `googledrive.ts` DEĞİŞTİRİLMEDEN reuse** — dosya zaten `ensureFolderPath(pathSegments, rootFolderId?)` opsiyonel folder-id parametresi alıyor (kod içinde doğrulandı). FlexOS servisi `ensureFolderPath(["flexos", tenantId, groupCode, personName], undefined)` ile kendi izole alt-ağacını açar, dönen folder-id'yi `uploadBufferToFolder`/`initResumableSession`'a verir. `googledrive.ts` dosyasının kendisine HİÇ dokunulmuyor.
- Canlının trainer-side `AttachmentManager`'ının kullandığı (`/api/instructor/init-file-upload`+`complete-file-upload`) ayrı/denetlenmemiş yol PORTLANMIYOR — sadece öğrenci tarafının kanonik akışı (`init-resumable-upload`→`upload-chunk`→`complete-upload`→`delete-file`/`retract`) taşınıyor, eğitmen referans-dosya-ekleme de aynı akışı kullanacak.
- Route'lar (Faz 2'de yazılacak): `/api/flexos/submissions/{init-resumable-upload,upload-chunk,complete-upload,delete-file,retract}` + durum/not güncelleme route'u.
- Assertion script'te Drive gerçek network çağrısı YAPILMAYACAK — fake "drive" dependency inject edilecek (aynı Map-backed repo deseni).

**Faz 3 — Öğrenci tarafı basit ekranlar:** Canlıda `/student/[studentId]/...` capability sisteminin TAMAMEN DIŞINDA, basit "uid = studentId eşleşmesi" kontrolüyle çalışıyor (staff Actor/paket sistemine hiç girmiyor). FlexOS'ta da aynı basit desen — henüz hiç FlexOS-farkında öğrenci route'u YOK (`src/app/student` sıfır FlexOS referansı içeriyor, `src/app/flexos/*` altında öğrenci-yüzü hiç yok), sıfırdan kurulacak. Kullanıcı kararı: "basitçe alsak da olur şu anda" — kapsamlı bir capability entegrasyonuna gerek yok.

**Faz 4 — Eğitmen "Ödev Alma"/not verme UI'ı:** Grading workspace (canlıdaki `[groupId]/[assignmentId]/page.tsx` + `grading/page.tsx`'in TEK canonical birleşimi), yorum thread'leri (`tasks/{id}/comments`, `tasks/{id}/threads/{studentId}/comments` — canlıdaki yapı), bildirim/mail hookup. Canlıda tutarsız olan real-time davranış (bazı sayfa `onSnapshot`, bazısı one-shot fetch) FlexOS'ta HER YERDE tutarlı `onSnapshot` ile kurulacak.

**Kritik referans dosyalar (Faz 2+ için de geçerli):** `src/app/lib/domain/services/attendance-service.ts` (grup-sahipliği kontrol deseni), `src/app/lib/googledrive.ts` (reuse edilecek, değiştirilmeyecek), `scripts/assert-view-access.ts`/`assert-assignment.ts` (assertion iskelet deseni).

Plan dosyası (yerel makinede, senkronlanmıyor): `C:\Users\asent\.claude\plans\graceful-jumping-muffin.md` — yukarıdaki özet onun tam kopyası, ayrıca bakmaya gerek yok.

### ✅ Eğitim Operasyon Dashboard eklendi — Ana Sayfa'nın `education.create` rotası (2026-07-04, aynı gün devam)

Kullanıcı dünkü Claude Design çıktısını (`Eğitim Operasyon Dashboard.dc.html`, demo veri) verdi — "bunu da yaparsak dashboardların çoğu biter (Finans+Genel Müdür hariç)". Satış Dashboard/Eğitmen Ana Sayfa ile aynı desende gerçek uçlara bağlanarak portlandı: **yeni sayfa `src/app/flexos/egitim-operasyon-anasayfa/page.tsx`**.

- **Donut (Açık Eğitim Dağılımı):** aktif (`status==="active"`) grupların branş kırılımı, Recharts `PieChart` (Satış Dashboard'un GÜNCEL Recharts deseniyle aynı, eski conic-gradient CSS değil — yeni sayfa olduğu için doğrudan güncel yaklaşımla kuruldu). `GET /api/flexos/groups`'un zaten sunucu tarafında join'lediği `branch` adı + `enrolled` (aktif kayıt sayısı) kullanıldı, ekstra sorgu gerekmedi.
- **Özet metrik şeridi (4 kart):** Aktif Sınıf/Aktif Öğrenci/Bu Hafta Başlayacak GERÇEK (`groups`'tan hesaplanıyor — `schedule.startDate` bugün+7 gün penceresi). **Sertifika Bekleyen = "—"** (Sertifika domain'i hâlâ kurulmadı, bkz. `certificate_scope` hafızası — dürüst placeholder).
- **Büyük işlem kartları (2):** "Grup Oluştur"→`/flexos/siniflar`, "Yoklama Takibi"→`/flexos/yoklama/al` — ikisi de gerçek route.
- **Hızlı işlemler (3):** Sertifikasyon/Anketler/Bildirim Merkezi — hiçbirinin backend'i yok, "yakında" toast (tasarımın kendisinde de `href="#"` — placeholder olduğu zaten belliydi).
- **Yaklaşan Sınıflar:** henüz başlamamış (`planned`/`enrolling`) + `schedule.startDate` bugünden ileride olan gruplar, tarihe göre artan sıralı, "X gün sonra" — GERÇEK. Branş renk paleti donut ile tutarlı (`branchColor` map, aynı `DONUT_PALETTE` index'i).
- **Eğitim Operasyon Akışı:** ⚠️ **bilinçli basitleştirme** — tasarımda 6 farklı olay tipi vardı (yoklama tamamlandı/sertifika/talep/sınıf açıldı/anket/bildirim) ama bunların çoğunun (sertifika/anket/bildirim/sınıf-açıldı-event-log/yoklama-tamamlandı-aggregate) backend'de karşılığı YOK. Panel şu an **aynı `GET /api/flexos/activities` akışını** (Satış Dashboard'un Canlı Aktivite Akışı ile birebir aynı endpoint — `activity.read` zaten Operasyon paketinde de var, CRM/talep sistemi department-agnostic) gösteriyor — uydurma ikon/tip yok, dürüst ama şimdilik Satış-ağırlıklı bir feed. Gerçek çok-domainli bir "operasyon olay logu" ileride ayrı bir iş kalemi.

**Routing — `FlexSidebar.tsx` "Ana Sayfa" dallanmasına yeni kol eklendi:** `role.manage`→admin anasayfa (değişmedi) → **YENİ:** `education.create` (Operasyon paketine özgü — `packages.ts`'te satış/eğitmen'de hiç yok, standalone eğitmende de yok, admin zaten üstteki dalda yakalanıyor) → Eğitim Operasyon Dashboard → `sale.create`→Satış Dashboard (değişmedi) → yoksa Eğitmen Ana Sayfa (değişmedi). Mevcut 3 rotaya dokunulmadı, sadece aralarına 1 kol eklendi.

`tsc --noEmit`, `eslint`, `npm run build` (tüm route'lar dahil `/flexos/egitim-operasyon-anasayfa`) temiz. **Test edilmeyen:** tarayıcıda gerçek bir Operasyon hesabıyla doğrulanmadı (bu ortamda giriş yapılamıyor) — sıradaki oturumda bir Operasyon kullanıcısıyla kontrol edilmeli, özellikle donut/Yaklaşan Sınıflar'ın az veri durumunda (Satış Dashboard'daki "az branş" gerilme sorunu burada da çıkabilir, henüz o düzeltme uygulanmadı).

### ✅ Paylaşımlı `FlexHeader`+`Footer` TÜM FlexOS sayfalarına yayıldı (2026-07-04, aynı gün devam)

Satış Dashboard + Eğitmen Ana Sayfa'da onaylanan `FlexHeader`/`Footer mini` deseni ("güzel olursa diğer sayfalara da yaparız" — 2026-07-03 notu) kullanıcı onayıyla kalan **21 sayfaya** yayıldı: Eğitim Yönetimi (katalog/Ekle/Ayarlar/Tatil/Branşlar/Seanslar), Sınıflar (Full + Core `EgitmenSiniflarPanel`), Öğrenci Havuzu, Eğitmenler, Kullanıcılar (liste/Ekle/Düzenle), Satışlar (Liste/Paket/Kampanya/Satış-Yap), Aktivite Merkezi, Randevu Takvimi (placeholder), Ana Sayfa (admin placeholder), Yoklama Detay+Raporu (header-only). Artık **sadece 2 sayfada eski desen kalmıyor** (bkz. aşağıdaki bilinçli istisna).

**`FlexHeader.tsx`'e yeni `left` prop'u eklendi:** breadcrumb/geri-butonu olan sayfalar (Eğitim Ekle, Eğitim Ayarları alt-sayfaları, Kullanıcı Ekle/Düzenle, Yoklama Detay) için sol tarafı (icon+title+subtitle bloğu) TAMAMEN özel içerikle değiştirir — sağdaki bildirim+avatar bloğu (isim fetch+cache dahil) hep aynı kalır. `subtitle` prop'u da opsiyonel yapıldı (`left` kullanan sayfalarda gereksiz).

**Bilinçli istisna — Yoklama Al (`/flexos/yoklama/al`) dokunulmadı:** bu sayfa kasıtlı olarak FlexSidebar'sız/bağımsız (2026-07-02 kararı — "ders başladıktan sonra yanlışlıkla başka sayfaya geçip yoklamayı yarım bırakmasın", sidebar menüden yeni sekmede açılıyor). FlexHeader/Footer eklemek bu tasarım kararını bozardı.

**Yoklama Detay + Yoklama Raporu — sadece HEADER, Footer YOK:** ikisi de `position:absolute inset-0` kayan panel deseni kullanıyor (`overflow:hidden` sabit-viewport), Footer'ın doğal bir yeri yok — sadece üst header (bell/avatar/isim) `FlexHeader`'a taşındı, sayfa içindeki tekrarlı isim-fetch kodu da temizlendi (artık `FlexHeader` kendi içinde tek kaynaktan çekiyor).

**🔧 Düzeltme — Yoklama Detay/Raporu içerik genişliği header'la eşitlendi (aynı gün devam):** Kullanıcı fark etti: FlexHeader 1920 genişliğinde ama içerik (`AttendanceCore`/`AttendanceDetailList` paylaşımlı bileşenleri, Yoklama Al'ın eski topBar'ıyla eşleşecek şekilde 1300/1440/1620 sabitti) dar kalıyordu. **Risk:** bu iki bileşen Yoklama Al'da da kullanılıyor, Al'ın kendi topBar'ı hâlâ 1300/1440/1620 (kasıtlı, dokunulmadı) — o yüzden bileşenlerin genişliğini direkt 1920'e sabitlemek Al'da YENİ bir uyumsuzluk yaratırdı. **Çözüm:** her iki bileşene opsiyonel `containerClassName` prop'u eklendi (varsayılan = eski 1300/1440/1620 string'i, Yoklama Al hiç değişmedi), Yoklama Detay + Yoklama Raporu'ndaki tüm çağrılar (`AttendanceDetailList`, `AttendanceCore` mode="detail" — 2 yerde: sağdan kayan grup detayı + Rapor'un iç içe 3. paneli) `"...max-w-[1920px] mx-auto px-9..."` ile override ediyor. Yoklama Raporu'nun kendi sayfa-içi Panel 1 div'i de (paylaşımlı bileşen değil, doğrudan page.tsx'te) aynı şekilde 1920'e çekildi. Panel 2 (split view) zaten `flex` tam-genişlik kullanıyordu, dokunulmadı.

`tsc`+`npm run build` temiz (tüm route'lar dahil).

**Yan ürün — kod temizliği:** Header değişince artık çağrılmayan `soon()`/bildirim-toast fonksiyonları (kullanılmayan değişken kalmasın diye) ilgili dosyalardan silindi (Eğitim Yönetimi, Eğitim Ekle, Seanslar, Öğrenci Havuzu).

`tsc --noEmit` ve `npm run build` (tüm route'lar dahil) temiz; `eslint src/app/flexos` **21 problem sayısı değişik olmadı** (23 pre-existing warning/error, hepsi bu işten önce de vardı — stash ile doğrulandı, hiçbiri bu değişiklikle eklenmedi). **Test edilmeyen:** tarayıcıda toplu olarak gezilmedi — sıradaki oturumda görsel bir tur (özellikle breadcrumb'lı `left` sayfaları: Eğitim Ekle, Kullanıcı Ekle/Düzenle, Yoklama Detay) faydalı olur.

### ✅ Satış Dashboard — donut+kota grafikleri Recharts'a taşındı, senkron giriş animasyonu (2026-07-04)

Kullanıcı iki grafiği de (donut'un conic-gradient CSS halkası, kota'nın elle-SVG burn-up eğrisi) **animasyonlu Recharts** bileşenleriyle değiştirmek istedi. Uzun bir iterasyon turu sonrası kilitlenen hâl:

- **Donut → `PieChart`/`Pie`/`Cell`.** Legend/skala/"Diğer" popup mantığı (2026-07-03'te kilitlenen) HİÇ değişmedi, sadece halkanın kendisi Recharts'a taşındı (`donut` useMemo'ya `pieData` eklendi).
- **Kota kartı** birkaç görsel dener (burn-up → basit iki-çubuk → son karar) sonrası: gerçek günlük kümülatif TL eğrisi, **Tremor'un "Revenue by month" örneğinin görsel tarifi ödünç alındı** (açık gri yatay grid, ince çerçeve, sade eksen) — **Tremor'un kendi 989 satırlık bileşeni KURULMADI**, sadece stil taklit edildi (yeni paket/dosya yok). `SATIS_KOTASI_HEDEF_TL` 500.000→1.500.000 (seed'in gerçek hacmine yakın).
- **Kritik ders — giriş animasyonu senkronu:** Ayrı Recharts animasyonları (`isAnimationActive`/`onAnimationStart`) birbirinden bağımsız zamanlayıcı olduğu için senkron başlamıyordu. Çözüm: TEK paylaşımlı `revealProgress` (0→1, `useAnimProgress` hook) — donut'un açısı VE kota'nın clip-path'i aynı değerden besleniyor, Recharts'ın kendi animasyonları kapatıldı (`isAnimationActive={false}`). Detaylı tuzaklar (hidden-clock erken bitme, YAxis autoscale titremesi, clip-path vs değer-ölçekleme) → hafıza: `flexos_satis_dashboard_charts_2026_07_04.md`.
- **Yan ürün:** `appointments`/`activities` route'larındaki N+1 sorgu (kişi başına ayrı `getById`) → `sales/route.ts`'teki desenle aynı tek `list()`+Map join'ine çevrildi.

`tsc`+ESLint temiz, `npm run build` başarılı, tarayıcıda kullanıcı tarafından doğrulandı ("oldu ok").

### ✅ Satış Dashboard — donut "az branş" düzeltmesi (2026-07-03, aynı gün devam)

Kullanıcı 4K'da fark etti: tek branş satılmışken (`donutTopCount=1`) legend kartı `flex:1` ile kalan tüm yatay alanı dolduruyor, garip gerilmiş bir kart oluşuyordu. Merkezleme (`justifyContent:center`) alternatifi konuşuldu ama "sağda koca boşluk kalır" itirazıyla elendi — kullanıcı kararı: **kart grid'i her zaman en az 4 kart (2×2) göstersin**, satışı olmayan branşlar kataloğun geri kalanından **soluk yer tutucu** olarak eklensin (hangi branşlar olduğu önemli değil), satışı olan kart(lar) normal/aktif kalsın.

**Uygulanan:** `donut` useMemo artık `branches` (yeni `GET /api/flexos/branches` fetch'i, `loadAll`'a eklendi) parametresine bağlı. Gerçek satışı olan branş sayısı (`top.length`) 1-3 arasındaysa, kataloğun satışı olmayan geri kalanından `DONUT_MIN_CARDS=4`'e tamamlanacak kadarı `muted:true` ile legend'e eklenir (conic-gradient/`stops` etkilenmez — sadece kart listesine ekleniyor). Mevcut `donutTopCount`/`donutScale`/grid-column mantığı zaten legend uzunluğuna bağlı olduğu için ekstra kod gerekmedi — 4 karta tamamlanınca grid otomatik 2 sütuna (2 üst 2 alt) geçiyor. Muted kart stili: kesikli border, gri renk çubuğu, "—"/"satış yok" metni, soluk yazı rengi.

**Bilinçli kapsam dışı:** 0 satış durumu (mevcut "Bu ay henüz satış kaydı yok." boş-durum metni) değiştirilmedi — sadece 1-3 gerçek branş varken devreye giriyor. 6'dan fazla branş satılmışsa mevcut "Diğer" butonu davranışı aynen korunuyor.

**🔧 Düzeltme — kataloğun kendisi 4'ten az branş içerince (aynı gün devam):** İlk versiyon sadece gerçek katalogdan (`GET /branches`) dolduruyordu; test ortamında katalogda toplam 3 farklı branş vardı (`Yazılım` — biri gerçek biri eski demo-seed duplicate'i, `Grafik Tasarım`), bu yüzden 4'e değil 2'ye tamamlanıyordu (kod bug'ı değil, veri eksikliği). **Kullanıcı kararı: "şimdilik fake koy, branş havuzunu doldurunca oradan çekeriz."** `DONUT_DUMMY_BRANCHES` (6 sabit isim, seed script'teki branş adlarıyla aynı) eklendi — önce katalogdan doldurulur, hâlâ `DONUT_MIN_CARDS`e ulaşmadıysa dummy isimlerden tamamlanır. Katalog büyüdükçe `catalogFillers` listesi otomatik büyüyüp dummy'lerin yerini alır (kod tarafında ek iş gerekmez, sadece branş eklenmesi yeterli) — **geçici, branş havuzu dolunca kaldırılabilir/otomatik devre dışı kalır.**

`tsc`+ESLint temiz. **Test edilmeyen:** tarayıcıda doğrulanmadı (özellikle 1 branş senaryosunda 3 soluk kartın görünümü) — sıradaki oturumda/şimdi kontrol edilmeli.

### ✅ Paylaşımlı `FlexHeader` + canlı `Footer` (mini) FlexOS'a kazandırıldı (2026-07-03, aynı gün devam)

Kullanıcı fark etti: FlexOS sayfalarında hiç footer yoktu; canlıda `src/app/components/layout/Footer.tsx` var (`mini` prop'lu — küçük/ince versiyon + sosyal medyalı tam versiyon TEK bileşende, `mini` ile seçiliyor). **Kullanıcı kararı: student tarafı hariç HER YERDE `mini` versiyon.** Aynı oturumda ikinci bir eksik de netleşti: her FlexOS sayfası kendi header JSX'ini kopyala-yapıştır tutuyordu (Yoklama Raporu/Detay'da bir desen, Satış Dashboard'da farklı bir desen, isim bazı sayfalarda statik hardcoded) — **kullanıcı: "sidebar gibi dinamik tek bileşenden olsun, bir yerde değişince hepsinde değişsin."**

**Yapılan:**
- **`src/app/flexos/_components/FlexHeader.tsx`** (yeni, FlexSidebar ile aynı "tek kaynak" deseni) — sticky header, opsiyonel ikon kutusu, `greeting` modu ("Hoş Geldin, {isim} 😊") veya sabit `title`, `subtitle`, `roleLabel` (örn. "Yönetici · Satış"), `maxWidth`. İsim `users/{uid}` Firestore'dan çekilir (Yoklama Raporu'ndaki dinamik-isim deseniyle birebir) + FlexSidebar'daki `capsCache` deseniyle aynı modül-seviyeli `nameCache` (sayfa değişince yeniden fetch/flaş yok). Bildirim zili + kullanıcı avatarı (initials+gradient) dahil.
- **Satış Dashboard'a bağlandı:** kendi inline header'ı (statik "Alparslan Şentürk" hardcoded'du — bilinmeyen bir eksiklikti, bu iş yan ürün olarak düzeltti) kaldırıldı, `<FlexHeader greeting subtitle="..." roleLabel="Yönetici · Satış" />` ile değiştirildi.
- **`<Footer mini />`** canlıdan doğrudan import edilip (`@/app/components/layout/Footer`, yeni bir wrapper YOK — zaten tek kaynak) sayfanın en altına eklendi. `main` artık `flex flex-col` + içerik grid'i `flex:1` (footer içindeki `mt-auto` ile birlikte kısa içerikte de en alta yapışıyor, uzun içerikte scroll'un sonunda görünüyor — canlıdaki davranışla aynı).
- **Sıradaki (kullanıcı onayı bekliyor):** "güzel olursa diğer FlexOS sayfalarına da yaparız" — bu iki bileşen (FlexHeader+Footer mini) henüz sadece Satış Dashboard'da. Diğer sayfalar (Yoklama Al/Detay/Rapor, Eğitim Yönetimi, Öğrenci Havuzu, Sınıflar, Eğitmenler, Kullanıcılar, Aktivite Merkezi) hâlâ kendi eski header desenlerini kullanıyor, footer'sız.

`tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/satislar/dashboard` derlendi). **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 3 düzeltme daha (aynı gün devam, kullanıcı fark etti):**
1. **Sidebar logosu sahteydi:** Claude Design'ın taklit ettiği 4 renkli kare ikon + ayrı "flex" metni, gerçek marka logosu değildi. `FlexSidebar.tsx` artık canlıdaki gerçek `<FlexLogo variant="white"/>` (`@/app/components/ui/FlexLogo`, `/assets/flex-logo-white.svg`) kullanıyor — kullanıcı boyut değişmesin dedi, önceki logo alanının yüksekliğiyle (~38px) eşleşecek `width={138}` verildi (SVG oranı ~3.6:1). `S.logoBox` stili (artık kullanılmıyor) silindi. **Footer zaten gerçek logoyu kullanıyordu** (`Footer.tsx` içinde `<FlexLogo width={64}/>`) — ek iş gerekmedi.
2. **Selamlama metni yanlıştı:** "Hoş Geldin, {isim} {soyisim} 😊" — canlıda (`Header.tsx`) SADECE ilk isim (`user?.name?.split(' ')[0]`). `FlexHeader.tsx`'e `firstName = displayName.split(" ")[0]` eklendi, greeting bunu kullanıyor (sağdaki kullanıcı bloğundaki tam isim değişmedi, o ayrı).
3. **Font ağırlığı çok kalındı:** `fontWeight:800` yerine canlıdaki (`Header.tsx` `h1`) birebir değeri `fontWeight:630, letterSpacing:"-0.022em"` kullanılıyor.

`tsc`+ESLint temiz, `npm run build` başarılı.

**🔧 4. düzeltme — header/içerik/footer sol-sağ kenar hizası (kullanıcı ekran görüntüsü attı):** Sidebar/logo/greeting/donut hepsi onaylandı, tek sorun kalmıştı: `FlexHeader` sabit `maxWidth:1560px` inline style kullanıyordu, canlı `Footer.tsx` ise Tailwind'in responsive `w-[94%] mx-auto max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[2000px]` sınıflarını — 4K/geniş ekranda (`2xl` kırılımı) ikisi farklı genişliğe çıkıp header'daki başlık/avatar ile footer'daki logo/telif hizası kayıyordu. **Fix:** `FlexHeader.tsx`'ten `FLEX_CONTENT_WIDTH_CLASS` sabiti export edildi (Footer'ın sınıfıyla BİREBİR aynı string, kasıtlı kopya) — hem `FlexHeader`'ın iç sarmalayıcısı hem Satış Dashboard'un içerik grid'i artık bu sınıfı kullanıyor (eski `maxWidth`/`margin:"0 auto"` inline stilleri kaldırıldı). `FlexHeader`'ın `maxWidth` prop'u da kaldırıldı (artık gereksiz). **Diğer sayfalara FlexHeader/Footer taşınırken bu sabit otomatik olarak hizayı koruyacak** — ekstra iş gerekmez.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** düzeltme sonrası tarayıcıda tekrar doğrulanmadı.

**🔧 5. düzeltme — genişlik standardı diğer FlexOS sayfalarıyla eşitlendi:** Kullanıcı büyük ekranda fark etti: bir önceki düzeltme (Footer'ın kendi `2xl:max-w-[2000px]` Tailwind sınıfı) Satış Dashboard'u diğer FlexOS sayfalarından (Eğitim Yönetimi, Sınıflar, Eğitmenler, Satış Yap — hepsi sabit `maxWidth:1920`) daha geniş yapıyordu. **Karar: sayfa genişliği FlexOS'un mevcut standardına (1920) uysun, Footer'ın kendi genişliğiyle piksel-piksel eşleşmesi ikincil.** `FlexHeader`'daki `FLEX_CONTENT_WIDTH_CLASS` (Tailwind) kaldırıldı, yerine `FLEX_CONTENT_MAX_WIDTH=1920` sabiti + `maxWidth` prop'u (varsayılan bu sabit) geri geldi — hem `FlexHeader`'ın iç sarmalayıcısı hem Satış Dashboard'un içerik grid'i artık diğer sayfalarla BİREBİR aynı `maxWidth:1920, margin:"0 auto", padding:"..36px.."` deseninde.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 6. düzeltme — Footer de header/avatar ile hizalandı:** Genişlik standardı 1920'e sabitlendi ama Footer hâlâ canlının kendi `w-[94%] ... 2xl:max-w-[2000px]` sınıfını kullanıyordu (kenarlar hizasız kaldı). Canlı `Footer.tsx`'i BOZMADAN çözüldü: yeni opsiyonel `containerClassName` prop'u eklendi (verilmezse eski sınıf aynen kalır — mevcut ~15 canlı çağıran ETKİLENMEDİ). Satış Dashboard artık `<Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />` geçiyor — `FLEX_CONTENT_MAX_WIDTH` (1920) ile piksel-piksel aynı kutu + `px-9`=36px (header'ın `padding:"20px 36px"`'ıyla aynı iç boşluk). **Not:** Tailwind JIT className'i build-time statik taradığı için `containerClassName` sabit yazılmalı, `FLEX_CONTENT_MAX_WIDTH` değişirse elle senkronlanmalı (dinamik interpolasyon çalışmaz) — koda yorum olarak düşüldü.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı — bu son hizalama turu için bir ekran görüntüsü daha gerekiyor.

### ✅ Satış Dashboard — Satış Kotası kartı eklendi (2026-07-03, aynı gün devam)

Kullanıcı bir görsel referans attı (`chart.png`, "Hedef İlerleme" tasarımı — kümülatif çizgi grafik + Gerçekleşen/Hedef/Tamamlanma/Kalan/Dününe göre istatistikleri). Önce donutun yanına (3. sütun) eklemek konuşuldu ama Aktivite Akışı'nın sağ sütunda 2 satır kapladığı fark edilince (kullanıcının "ilginç durum" öngörüsü doğru çıktı — donut satırına 3. sütun eklemek Aktivite Akışı ile çakışıyordu) kullanıcı vazgeçti: **donut 4 kartlı kaldı (bir önceki 6-kart denemesi tamamen geri alındı, `isWideDonut`/matchMedia kodu silindi), Satış Kotası bunun yerine aksiyon kartları satırına (Satış Yap/Satış Listesi'nin yanına) 3. kart olarak eklendi** — bu satır zaten sadece col1 (geniş sütun) içinde kendi 2-sütunlu alt-grid'i olduğu için sağ sütundaki Randevular/Aktivite Akışı'yla hiç çakışmıyor, temiz çözüm.

**Uygulanan:** `SATIS_KOTASI_HEDEF=30` (gerçek kota/hedef backend'i yok, sabit placeholder) + `kota` useMemo (bu ayki `monthActive` satışlardan günlük/kümülatif seri — gün-gün satış sayısı toplanarak "Gerçekleşen", `Math.max(0,hedef-gerçekleşen)` "Kalan", bugünün günlük artışı "Dününe göre"). `SatisKotasiCard` — Satış Yap/Satış Listesi ile aynı kart iskeleti (ikon kutusu+başlık üstte), altında Gerçekleşen/Hedef + %Tamamlanma rozeti + küçük SVG alan-grafiği (elle çizilmiş `viewBox` tabanlı polyline/path, recharts kullanılmadı — dosyanın geri kalanıyla tutarlı, donut da aynı şekilde elle SVG/conic-gradient) + alt satırda Kalan/Dününe göre. Aksiyon kartları grid'i `"1fr 1fr"`→`"1fr 1fr 1fr"`.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı — özellikle 3'lü satırın küçük ekranda (~1440px) ne kadar sıkışacağı (kullanıcıyla önceden konuşulan risk, "Satış Yap" kartının açıklama metni dar kalabilir) kontrol edilmeli. **Açık:** gerçek kota/hedef değeri (şu an sabit 30) ileride ayarlanabilir/backend'e bağlanabilir bir alan olmalı — henüz o iş yapılmadı.

**🔧 Düzeltme — küçük ekranda 3'lü satır "dik" duruyordu (aynı gün devam):** Kullanıcı: "~1440'ta kartlar fazla dik, sadece küçük ekranlarda yükseklik azalsın, büyük ekranlarda aynı kalsın." `ACTION_ROW_COMPACT_BREAKPOINT="(max-width:1600px)"` + `isCompactRow` state (donuttaki `isWideDonut` ile aynı titremesiz lazy-initializer deseni). Altında: 3 kartın da padding'i 22→16, başlık altı boşluk 14→10, buton üstü boşluk 14→10/12→8; **Satış Yap kartının açıklama metni compact modda tamamen kaldırıldı** (zaten önceden flag'lenen "dar ekranda sıkışabilir" riskini de kapatıyor); Satış Kotası'nın grafik yüksekliği 52→40. 1600px üstünde hiçbir şey değişmiyor.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — "Satış Yap" kartı boş kalmıştı (aynı gün devam):** Kullanıcı fark etti: bir önceki adımda compact modda kaldırılan açıklama metni kartı "boş" hissettiriyordu, Satış Listesi'nin yanında bilgi yoğunluğu dengesiz duruyordu. Açıklama metni geri getirildi (artık compact modda da her zaman görünür) + altına gerçek veriden küçük bir rozet eklendi: **"Bu ay {monthActive.length} satış tamamladın"** (turuncu pill, kartın kendi renk temasıyla uyumlu) — sahte veri değil, zaten hesaplanan `monthActive.length`.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — "Bu ay X satış" rozeti yerine "en son satış" bilgi kutusu (aynı gün devam):** Kullanıcı: "Bu ay 15 satış yaptın yazısı yetmiyor, büyük ekranda sıkıntılı — orta kısımda bilgilendirici bir yazı olsun, örn. 'En son 12 dakika önce Zeynep Şen için Yazılım branşında satış yapıldı.'" "Bu hafta en hızlı kapanan branş" fikri de önerildi ama bu sayfada "kapanma hızı" (lead→satış süresi) diye bir veri yok — uydurmamak için elenip sadece **gerçek** veriden türeyen "en son satış" fikri uygulandı. Turuncu rozet kaldırıldı, yerine ince kesikli çerçeveli soluk kutu (`recentActive[0]` — zaten hesaplı en son aktif satış — `"En son {relTime} önce {studentName} için {branchName} branşında satış yapıldı."`, boş durumda "Henüz satış kaydı yok."). Kutu `flex:1` ile kartın ortasını dolduruyor (büyük ekran boşluğu sorunu da çözülüyor). **Küçük ekranda (`isCompactRow`) yazılar küçülüyor, kaldırılmıyor** (kullanıcı: "küçük ekranda yazıları ufalt ama [kaldırma]") — açıklama metni 13→11.5px, bilgi kutusu 12.5→11px.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — tek metne indirildi + büyük ekranda kutuyu dolduracak şekilde (aynı gün devam):** Kullanıcı: "2 tane yazı olunca kötü durmuş" — jenerik açıklama metni ("Öğrenci bilgisi, eğitim ve ödeme adımlarıyla...") kaldırıldı, sadece "en son satış" bilgi kutusu kaldı (ikon+başlık zaten amacı anlatıyor, tek net mesaj). Kullanıcı: "ok ama orayı biraz doldurması lazım büyük ekranlarda" — kutu `flex:1` + `display:flex, alignItems:center` (metin dikey ortalanıyor, kutu kartın kalan tüm boşluğunu dolduruyor) + büyük ekranda daha büyük padding (16px) ve font (14px, öncekinden 12.5'ten büyütüldü) — küçük ekranda (`isCompactRow`) hâlâ daha kompakt (10px padding, 11.5px font).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🐛 Gerçek bug — metin `display:flex` altında birbirine girmişti (aynı gün devam, tarayıcıda DOĞRULANDI):** Kullanıcı ekran görüntüsünde harflerin üst üste bindiğini bildirdi. Kök neden: kutunun kendisi `display:"flex"` idi ve içindeki JSX Fragment (`"En son " <b>X</b> " önce " <b>Y</b> ...`) birden fazla ayrı text-node/`<b>` kardeşten oluşuyordu — flex container altında her biri AYRI flex-item olur (flex-wrap varsayılan `nowrap`), normal satır-içi metin akışı/wrap'i BOZULUR. **Fix:** tüm metin tek bir `<span>` içine alındı (kutu hâlâ `display:flex,alignItems:center` ile dikey ortalıyor ama artık TEK flex-item — span — var, içindeki metin normal inline akışla wrap oluyor). Ayrıca kullanıcı "turuncu zemin olmasın" dedi — cream/tan renk paleti (`#FFFBF6`/`#F0DCC4`) kaldırıldı, sayfanın kendi nötr rengine (`#F7F8FA`/`#EEF0F3`, `SummaryRow` ile aynı) çevrildi. Kullanıcı: "Şimdi düzelmiş... son hali daha iyi."

`tsc`+ESLint temiz, `npm run build` başarılı.

### ✅ Satış Dashboard — Satış Kotası TL'ye çevrildi + 3 küçük iyileştirme (2026-07-03, aynı gün devam)

Kullanıcının 3 ayrı isteği:
1. **Satış Kotası kart-içeriği TL bazlı dummy veriye çevrildi:** üstte "15/30 hedef" (sayı) yerine **"Hedef Satış: 500.000 TL"** + **"%50 Tamamlanma Oranı"** rozeti; altta sol tarafta iki satır yığılı — **"Yapılan Satış: 250.000 TL"** + **"Kalan: 250.000 TL"**; sağdaki "Dününe göre" AYNI kaldı (kullanıcı: "en sağdaki tamam"). `SATIS_KOTASI_HEDEF_TL=500000`/`SATIS_KOTASI_YAPILAN_TL=250000` sabitleri (dummy, gerçek kota backend'i yok) — `kalanTl`/`tamamlanmaOrani` bunlardan hesaplanıyor (tutarlı: 250k+250k=500k, %50). **Grafiğin kendisi hâlâ gerçek veriden** (bu ayki günlük satış sayısı, kümülatif) — TL hedefinden bağımsız kendi ölçeğinde (`Math.max(...cumulative,1)`), aksi halde 500.000'lik eksende sayı-bazlı çizgi düz görünürdü.
2. **Bugünkü Randevular — büyük ekranda 5 randevu görünür oldu:** `APPT_VISIBLE_ROWS_NARROW=4`(≤1600px)/`APPT_VISIBLE_ROWS_WIDE=5`(>1600px), aynı `isCompactRow` breakpoint'i (aksiyon kartı satırıyla paylaşılan). Seed script'e (`scripts/seed-flexos-dashboard-demo.mjs`) 2 randevu daha eklendi (5→7) — hem küçük hem büyük ekran senaryosunu (4 görünür/3 scroll, 5 görünür/2 scroll) test edecek kadar.
3. **"Aktif Satışlar" → "En Son Satışlar"** başlık değişikliği (havuz zaten en son 3 aktif satışı gösteriyordu, isim buna göre düzeltildi).

`tsc`+ESLint temiz, `npm run build` başarılı, seed script syntax doğrulandı (`node --check`). **Test edilmeyen:** tarayıcıda doğrulanmadı — seed script'i `--clean` ile tekrar çalıştırıp yeni 7 randevuyu görmek gerekiyor.

**🔧 Düzeltme — sağ sütun büyük ekranda genişletildi (aynı gün devam):** Kullanıcı: "Aktiviteler/Randevu sütununu büyük ekranda biraz genişletelim, böylece üst (donut+aksiyon) alanının yayılması azalır." Dış grid `gridTemplateColumns` artık `isCompactRow` (≤1600px) ise `"1fr 340px"`, değilse `"1fr 420px"` — aynı breakpoint aksiyon kartı satırı ve Bugünkü Randevular ile paylaşılıyor, tek bir yerde tanımlıydı (340px başka hiçbir yerde hardcode değildi), değişiklik tek satır.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — Satış Kotası grafiği düz çizgiydi, referans görsel gibi eğri olmalıydı + etiket (aynı gün devam):** Kullanıcı `chart.png` referansındaki gibi yumuşak eğri bekliyordu, benim ilk implementasyonum düz çizgi segmentleriydi (`M...L...L...`). **Fix:** yeni `smoothLinePath()` yardımcı fonksiyonu — nokta dizisini Catmull-Rom spline'dan kübik Bezier'e çeviriyor (tension 1/6, standart yumuşatma tekniği), `SatisKotasiCard`'ın çizgi/alan path'i artık bunu kullanıyor. Ayrıca "Kalan" etiketi **"Kalan Satış"** oldu (Yapılan Satış'la aynı isimlendirme deseni).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

### ✅ Satış Dashboard — donut responsive 4/6 kart (2026-07-03, aynı gün devam — SONRADAN GERİ ALINDI, bkz. yukarı)

Kullanıcı fark etti: sayfa genişliği 1920'e çıkınca (bir önceki düzeltme) donut yanındaki legend kartları yine gerilmeye başladı (aynı kök sorun, yeni genişlikte tekrar ortaya çıktı). Kullanıcı fikri: geniş ekranda (≥1920px) boşluk bırakmak yerine **6 kart (3 üst 3 alt)** göster, dar ekranda (ör. 1440px) **4 kart (2 üst 2 alt)** kalsın — donuta dokunulmadan.

**Uygulanan:** `DONUT_MIN_CARDS_NARROW=4`/`DONUT_MIN_CARDS_WIDE=6` + `window.matchMedia("(min-width: 1920px)")` tabanlı `isWideDonut` state. **Titreme yok:** `useState`'in lazy initializer'ı ilk render'da `window` zaten var olduğu için (`typeof window !== "undefined"` kontrolüyle) doğru değeri okuyor — bu sayfa zaten `authed===null` iken hiçbir şey render etmediğinden (auth+veri yüklenene kadar donut hiç DOM'a girmiyor) SSR/hydration uyuşmazlığı da yok, "önce 4 sonra 6'ya sıçrama" hiç olmuyor (kullanıcı talebi: "sayfa tam yüklenmeden açma yapma"). `donut` useMemo artık `isWideDonut`'a bağlı (minCards parametrik) + legend grid'i `donutCols` (`donutTopCount<=2→1, isWideDonut→3, değilse→2`) ile `repeat(N,1fr)`. `DONUT_TOP_N=6` zaten sabit olduğu için `donutScale` formülü değişmedi (6 kartta otomatik 1.0 skalaya iniyor, aynen 6-gerçek-branş senaryosundaki gibi).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda farklı pencere genişliklerinde (özellikle 1920 sınırında resize) doğrulanmadı.

### ✅ Eğitmen Ana Sayfa — canlı `dashboard/page.tsx`'ten UI portu BİTTİ (2026-07-03, aynı gün devam)

Kullanıcı: "canlıdaki eğitmen dashboard'u birebir FlexOS'a al." Canlıda ayrı bir "eğitmen dashboard" yok — `src/app/dashboard/page.tsx` admin+eğitmen ortak tek sayfa (rol ayrımı içeride permission kontrolüyle). Yapı: Sidebar+Header+Footer + lacivert özet banner (Sınıf/Öğrenci/Ödev sayısı, canlı) + 3'lü hızlı aksiyon kartı (Hızlı Yoklama/Ödev Teslimi/Sertifikasyon) + Aktivite Akışı paneli (`activity_log`) + **Ödev Parkuru** (`DesignParkour`, 1070 satır) + **Ödev Kütüphanesi** (`AssignmentLibrary`, 330 satır).

**Kapsam netleştirmesi (kullanıcı onayladı):** Ödev Parkuru/Kütüphanesi'nin GERÇEK verisi (`tasks`/`templates` koleksiyonları, `useUser()`/`PERMISSIONS`/`activityLog`/beş ayrı modal — QuickAssignModal/AssignActivateModal/CompleteConfirmModal/CancelConfirmModal/TaskEditModal) canlının kendi altyapısına bağlı; FlexOS'ta "Ödev" domain'i **hiç kurulmadı** (kullanıcı: "ödevler başlı başına konuşmamız gereken bir süreç"). Karar: **UI'ı birebir portla, veri katmanını FlexOS'ta karşılığı olanlarla gerçek yap, olmayanlarla dürüst boş/placeholder bırak** — sahte veri uydurulmadı.

**Yeni sayfa `src/app/flexos/egitmen-anasayfa/page.tsx`** (önceki içi-boş placeholder'ın yerine geçti):
- **Banner:** Sınıf/Öğrenci sayısı GERÇEK (`GET /api/flexos/groups` status=active count + `GET /api/flexos/persons` — ikisi de zaten trainer'a scope'lu, ekstra kod gerekmedi). Ödev sayısı "—" (domain yok).
- **Hızlı Yoklama kartı — pulse mantığı GERÇEK veriyle portlandı:** canlının regex tabanlı `session` string parse'ı (`parseWeekDaysHome`/`parseSessionTimeHome`) YERİNE FlexOS'un zaten yapısal `Group.schedule` alanı (`days:number[]`, `startTime`/`endTime`) kullanıldı — daha temiz, regex'e gerek kalmadı. `ATTEND_BEFORE_MIN=15`/`ATTEND_AFTER_MIN=180` canlıyla birebir aynı. Adaya düşen gruplar için `GET /api/flexos/attendance?groupId=&date=` ile "bugün alındı mı" kontrolü (canlının tek `design_attendance where date==` bulk sorgusu FlexOS'ta yok, grup-grup dönülüyor — tipik eğitmen 1-3 grup olduğu için sorun değil). Tatil kontrolü `GET /api/flexos/holidays` (zaten var, yoklama modülünden). Dismiss localStorage anahtarı `flexos_attend_dismissed_{tarih}` (canlıdakinden ayrı namespace).
- **Ödev Teslimi / Sertifikasyon kartları:** statik meta ("Ödev domain'i yakında" / "Yakında"), tıklanınca toast — Sertifikasyon zaten sidebar'da da `go(null)`→"yakında" (FlexSidebar.tsx:328), tutarlı.
- **Aktivite Akışı paneli:** görsel kabuk birebir ama veri yok (FlexOS'ta eğitmenin sınıf-aktivite log'u — canlının `activity_log`'u — henüz karşılığı yok; FlexOS'taki `activities` koleksiyonu Satış/CRM'e ait, farklı bir şey) → sabit "Henüz aktivite yok" boş-durum.
- **Ödev Parkuru:** başlık+"Ödev Ver" butonu (toast) + her zaman 4× `PlaceholderParkourCard` (canlının kendi boş-durum kartı — gerçek şablon/task olmayınca zaten bu görünüyor, birebir aynı CSS/opacity/dashed-border).
- **Ödev Kütüphanesi:** başlık+Kişisel/Global sekmeleri (yerel state, işlevsel) + her ikisinde de canlıdaki "Henüz kişisel/global şablonunuz yok." boş-durum kutusu.
- Header/Footer Satış Dashboard'daki paylaşımlı `FlexHeader`(greeting, canlının birebir metni "Bugün atölyende neler oluyor? İşte son durum.", roleLabel="Eğitmen") + `Footer mini` (aynı `containerClassName` hizalama deseni) — kod tekrarı yok.

`tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/egitmen-anasayfa` derlendi). **Test edilmeyen:** tarayıcıda doğrulanmadı (özellikle Hızlı Yoklama pulse mantığı gerçek bir grupla denenmeli — trainerId'ye atanmış aktif grup + bugünkü seans saatiyle). **Sıradaki (ayrı konuşma, kullanıcı onayı bekliyor):** Ödev domain'i (tasks/templates FlexOS backend'i) kurulunca bu sayfadaki placeholder'lar gerçek `DesignParkour`/`AssignmentLibrary` mantığıyla değiştirilecek.

### ✅ Satış Dashboard BİTTİ (2026-07-03)

Claude Design çıktısı (`Satış Dashboard.dc.html`, demo veri) gerçek uçlara bağlanarak `flexos/satislar/dashboard/page.tsx`'e portlandı. **Donut** (bu ayki aktif satışların branş dağılımı, `/api/flexos/sales`'ten türetilir) + **hızlı aksiyon kartları** (Satış Yap / Satış Listesi, ikincisinde Bu Ay Ciro/Satış Adedi/İptal özeti) + **Aktif Satışlar havuzu** (son 3 aktif satış) + **Bugünkü Randevular** + **Canlı Aktivite Akışı** (son 30 aktivite). **Ödeme durumu rozeti YOK** (2026-06-29 kararına uyumlu — sadece Finans modülünde olacak). **Yeni backend uçları:** `GET /api/flexos/appointments` (tüm randevular, kişi adı join'li, `appointment.read` gated) + `GET /api/flexos/activities` (son 30 aktivite, kişi adı join'li, `activity.read` gated) — ikisi için de `ActivityRepo`/`AppointmentRepo` portlarına `list(tenantId)` eklendi + firestore adapter'lara implementasyon.

**Routing düzeltmesi (kullanıcı geri bildirimi):** Satış Dashboard Satışlar akordiyonunda bir alt-menü DEĞİL — "Ana Sayfa" nav öğesinin **sale.create paketine düşen hedefi** (Ana Sayfa zaten role'e göre farklı sayfaya gidiyordu: `role.manage` → admin anasayfa, yoksa → eğitmen anasayfa; şimdi 3. dal eklendi). `FlexSidebar`'daki tek "Ana Sayfa" öğesi artık `role.manage` → `/flexos/anasayfa` · `sale.create` (ve role.manage YOK) → `/flexos/satislar/dashboard` · yoksa → `/flexos/egitmen-anasayfa`. Sayfa kendi `FlexSidebar active="ana"` geçiyor (Satışlar akordiyonuna eklenen link geri alındı). `tsc`+ESLint temiz, `npm run build` başarılı (route listede `○ /flexos/satislar/dashboard`).

**Demo veri:** `scripts/seed-flexos-dashboard-demo.mjs` — yalnız yeni FlexOS koleksiyonlarına yazar (branş/eğitim/persons/sales/cases/activities/appointments, `seedTag` ile temizlenebilir). 8 branşlık dengesiz dağılım (Yazılım %30 → Robotik ve Kodlama %2) + bugün için 5 randevu (Case+Activity+Appointment üçlüsü, gerçek domain akışına uygun). Satış tarihleri HER ZAMAN bu ayın 1'i ile bugün arasında üretilir (ay başında -19 gün gibi sabit ofsetler geçen aya taşıp "bu ay" filtresinden düşüyordu — bulunan gerçek bug). `--n=<sayı>` flag'i ile sadece ilk N branş seed'lenir (donut'un az-branşlı davranışını test etmek için, örn. `--clean --n=1`).

**Donut/legend responsive davranışı (kullanıcıyla iteratif kilitlendi 2026-07-03):**
- Legend **top-6 + "Diğer"** kuralı: `DONUT_TOP_N=6`, en çok satan 6 branş ayrı kart, gerisi tek "Diğer"e toplanır (`DONUT_OTHER_COLOR` gri).
- "Diğer" kartı ortalanan/ölçeklenen alanın **DIŞINDA** — karta `position:relative` + "Diğer" `position:absolute` (sağ-alt köşe, `right:24 bottom:32`), hover'da (`.sd-other-legend:hover .sd-other-tip`, CSS-only) İngilizce/Robotik gibi alt-branşları `%· kayıt` detayıyla listeleyen bir tooltip popup açılır.
- **Donut çemberi HER ZAMAN sabit boyut** (216px, inset 50) — kullanıcı kararı: donut'a dokunulmayacak, SADECE branş kartları ölçeklenecek.
- **Kart ölçeği (`donutScale`)** branş sayısına göre kademeli: 1 branşta `1.25x`, 6'da `1.0x` (`Math.max(1, 1.25 - (n-1)*0.05)`), font/padding/gap hep buna bağlı.
- **Grid sütun kuralı:** 1-2 branşta **tek sütun** (alt alta, büyük kart/kartlar) · 3+ branşta **2 sütun** (yan yana; tek sayıda kalırsa son satır yanı boş — kabul edilen davranış).
- Legend alanı `alignSelf:"center"` ile donut çemberiyle aynı satırda dikey ortalanır (veri sayısından bağımsız, sabit piksel offset YOK).
- Bugünkü Randevular kartında da benzer "tahmin değil hesap" dersi: her randevu satırı **sabit `APPT_ROW_HEIGHT=56`**, kapsayıcı `maxHeight` bundan + `APPT_ROW_GAP`/`APPT_VISIBLE_ROWS=4` ile **matematiksel** hesaplanıyor (rastgele piksel denemesi yerine) — 5. randevu üstte `APPT_LIST_PAD=24` padding + net kesim ile TAM gizleniyor, altta ayrı (scroll dışı) 24px spacer var.
- **Ders (feedback):** kart/alan boyutlandırmalarında rastgele piksel tahmini yerine sabit birim + formül kullanmak, kullanıcıyla defalarca "tahminle olmaz" turu dönmekten daha hızlı sonuç veriyor.

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

**Sonnet uyguladı (2026-07-01):** `view.toggle` capability (`registry.ts`+`packages.ts`, admin paketine — UID hardcode yok) · PIN backend: `domain/core/view-pin.ts` + `repo/view-pin-repo.ts` + `server/view-pin-repo.firestore.ts` (koleksiyon `flexos_view_pins`, doküman id=uid, server-only rules) + `domain/services/view-access-service.ts` (`getViewAccessStatus`/`verifyViewPin`/`setViewPin`, Node `scrypt`+`timingSafeEqual`, hep `view.toggle` gated) · route'lar `GET /api/flexos/me` (capability listesi — menü kararına genel amaçlı temel), `GET /api/flexos/view-access` (hasPin), `POST /api/flexos/view-access/verify`, `POST /api/flexos/view-access/pin` · **layout.tsx yerine FlexSidebar kendi içinde self-contained** (18 sayfayı refactor etmeden `/api/flexos/me` fetch + localStorage[uid] mode + `Ctrl/Cmd+Shift+M` kısayolu + `ViewPinModal.tsx`, hepsi tek dosyada — "tek kaynak" ilkesi korunuyor) · FlexSidebar menü kuralı `canSee(cap, core)` ile bağlandı: core-grup (Ana Sayfa/Öğrenciler/Sınıflar/Yoklamalar/Sertifikasyon) her zaman, enterprise-grup (Eğitim Yönetimi/Satışlar/Eğitmenler/Kullanıcılar/Aktivite Merkezi) sadece Full · PIN kurulum/değişim UI'ı `kullanicilar/page.tsx`'e eklendi (Sistem Modu kartının altı, sadece `view.toggle` sahibi görür — sidebar/topbar'da sıfır görsel iz korundu). **16 yeni assertion** (`scripts/assert-view-access.ts`) + mevcut 24 (standalone-mode) geçti, `tsc`+ESLint temiz, `npm run build` başarılı. **✅ Tarayıcıda test edildi (2026-07-02):** kullanıcı login + kısayol + PIN akışını çalıştırdı — Core moduna geçince sol menü sadeleşiyor (enterprise grupları gizleniyor), beklendiği gibi.

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

### ✅ Full versiyonda eğitmen v2 — capability-gated "benim gruplarım" görünümü BİTTİ (2026-07-02)

Full'da eğitmen ana sisteme bağlı, kendisi grup/öğrenci EKLEMİYOR (bunu Core modda yapıyor — doğrulandı, Core'daki Grup Ekle/Öğrenci Ekle akışı uçtan uca tamam, tek düzeltme: `EgitmenSiniflarPanel.tsx:576`'daki yanıltıcı "Grup seçimi opsiyonel" yardım metni silindi, kod zaten grubu zorunlu kılıyordu).

**Full'da bulunan boşluk:** Eğitmen `standaloneMode=false` iken admin'in birebir aynı Sınıflar/Öğrenciler sayfalarını görüyordu; ekleme/düzenleme butonları `standaloneMode`'a göre değil gerçek capability'e göre gizlenmiyordu (veri zaten API'de scope'luydu — bkz. yukarıdaki "kritik yetki açıkları" fix'i — ama UI hâlâ "tüm sistem" hissi veriyordu).

**Çözüm:** `src/app/flexos/_components/useCapabilities.ts` — `GET /api/flexos/me`'yi bir kere çeken, modül-seviyeli cache'li paylaşımlı hook (FlexSidebar'daki `capsCache` deseninin sayfa-seviyeli hali). `GroupTable.tsx`'e `canManage?: boolean` prop'u eklendi (default `true`, Core'daki mevcut kullanım etkilenmedi) — `false` iken liste görünümündeki Başlat/Bitir/Düzenle/Sil/Geri-al aksiyon hücresi `—` ile değişiyor. `siniflar/page.tsx`: `canManageGroups = caps.has("group.create")` — "Grup Ekle" butonu ve `GroupTable canManage` buna bağlandı. `ogrenciler/havuz/page.tsx`: `canAssignGroup = caps.has("group.assign_student")` → "Gruba Ata" satır aksiyonu, `canEditPerson = caps.has("person.edit")` → öğrenci detayındaki "Düzenle" butonu gate edildi. Eğitmen Full'da (`EGITMEN_CORE` paketi: sadece `group.create` yok, `group.assign_student` yok, `person.edit` yok) artık bu aksiyonları hiç görmüyor; admin/operasyon/satış (kendi paketlerinde bu capability'ler var) değişiklik görmüyor. `tsc`+ESLint temiz, `npm run build` başarılı (tüm route'lar derlendi, regresyon yok).

**Test edilmeyen:** Gerçek eğitmen hesabıyla Full'da tarayıcı testi (bu oturumda login yapılmadı) — sıradaki oturumda doğrulanmalı.

### ✅ Görünüm Anahtarı artık GERÇEK yetki düşürüyor (sadece owner'a özel) BİTTİ (2026-07-02)

Kullanıcı `Cmd+Shift+M`'i test ederken fark etti: Core moda geçince yetkisi hâlâ tam admin'di (kozmetik — sadece sidebar sadeleşiyordu). İstediği: Core moddayken **gerçekten eğitmen gibi** olmak (grup ekleyemesin, PII göremesin, başka eğitmenin öğrencisini göremesin) — ama SADECE kendi hesabında, başka hiçbir admin/eğitmen hesabında bu özellik var olmasın.

**Mimari değişiklik:**
- `view.toggle` capability'si **admin paketinden çıkarıldı** (`packages.ts`) — artık paket-seviyeli değil, `actor.ts`'e eklenen `extraGrants` (tekil/uid'e özel grant) mekanizmasıyla veriliyor.
- `src/app/lib/server/auth-actor.ts`: **tek bir sabit** `VIEW_TOGGLE_OWNER_EMAIL = "alparslan.sennturk@gmail.com"` — kod tabanında BAŞKA HİÇBİR YERDE uid/email hardcode yok. `packagesForCaller()`: bu email + Core moddaysa paket `["egitmen"]` döner (yoksa her zaman `["admin"]`); `actorFromCaller()`: bu email'e her zaman `view.toggle` grant'i ekler (paket ne olursa olsun — Core'dayken bile Full'a dönebilsin diye).
- Mod artık **sunucuda da kalıcı** (önceden sadece localStorage'da kozmetikti): yeni `flexos_view_modes/{uid}` koleksiyonu (server-only) + `ViewModeRepo` port/adapter + `setViewMode()` servis fonksiyonu + `POST /api/flexos/view-access/mode` route. `auth-actor.ts`'te `standaloneMode` ile aynı desende in-process TTL cache (10sn, fire-and-forget refresh, soğuk başlangıçta güvenli varsayılan `"full"`).
- `resolvePackages(["egitmen"], {standaloneMode})` zaten var olan mekanizmayı kullanıyor — sistem Full modundaysa (`standaloneMode=false`) owner Core'a geçince gerçek bir eğitmenle **birebir aynı** `EGITMEN_CORE` kısıtlarına düşüyor (grup/öğrenci ekleyemez, PII yazamaz), sistem Core modundaysa `EGITMEN_STANDALONE_EXTRA` da eklenir — özel kod yok, mevcut standaloneMode dalı olduğu gibi devrede.
- `FlexSidebar.tsx`: kısayol artık modu hem localStorage'a hem sunucuya yazıyor (`persistModeAndReload`), sonra **sayfayı yeniliyor** — böylece hem sidebar hem her sayfanın kendi `useCapabilities()` cache'i taze `/api/flexos/me` sonucunu okur (stale-cache riski yok).
- `scripts/assert-view-access.ts` yeni mimariye göre güncellendi (admin artık `view.toggle`'ı owner-simülasyonlu tekil grant'le alıyor, "sıradan admin paket-seviyeli view.toggle YOK" assertion'ı eklendi) — **15 assertion geçti** (+1 yeni). Tüm mevcut assertion'lar (24+7+12) regresyon olmadan geçti. `tsc`+ESLint temiz, `npm run build` başarılı.

**Kabul edilen sınırlama:** Şu an owner'ın uid'ine `trainerId` olarak atanmış gerçek grup yok — Core moda geçince Sınıflar boş görünecek ("size atanmış grup yok"), kullanıcı bunu kabul etti (sistem yeni kuruluyor, ileride gerçek gruplar atanınca dolacak).

**Test edilmeyen:** Gerçek tarayıcıda `Cmd+Shift+M` ile Core'a geçip API çağrılarının (`GET /groups`, `/persons` vb.) gerçekten `egitmen` kısıtlarıyla döndüğü doğrulanmadı (bu oturumda login yok) — sıradaki oturumda doğrulanmalı. Ayrıca `flexos_view_modes` cache TTL'i (10sn) nedeniyle mod değişimi ilk birkaç saniye gecikmeli yansıyabilir (mevcut `standaloneMode` cache'iyle aynı bilinen davranış).

**🔧 Düzeltme (2026-07-02, aynı oturum devamı):** Kullanıcı test ederken 2 şey netleşti:
1. **Mimari teyidi (doğru kurulmuş, değişiklik gerekmedi):** İki ayrı kavram karışmasın diye açıkça test edildi — `flexos_settings.standaloneMode` (Sistem Modu, Kullanıcılar sayfası, sistem geneli Full↔Core) ile `flexos_view_modes/{uid}` (kişisel görünüm, `Cmd+Shift+M`, SADECE owner) birbirine hiç dokunmuyor. Kısayol asla sistem modunu değiştirmiyor — sadece owner'ın kendi paketini (`admin`↔`egitmen`) değiştiriyor, eğitmen kısıtları mevcut sistem moduna göre otomatik şekilleniyor (`resolvePackages` zaten `standaloneMode`'u parametre alıyor). Sistem Full↔Core geçişi HER ZAMAN sadece Kullanıcılar'daki buton ile olur — doğrulandı, kod zaten böyle.
2. **Gerçek bug bulundu ve düzeltildi:** Kısayolla mod değiştirip sayfa yenilenince sidebar/sayfa aksiyonları (ör. Sınıflar'daki "Grup Ekle") bazen eski yetkiyle kalıyordu, manuel yenileme ya da menüye girip çıkınca düzeliyordu. Neden: `auth-actor.ts`'teki mod cache'i (`standaloneMode` ile aynı TTL deseni, 10sn) mod Firestore'a yazıldıktan sonra hemen yenilenmiyordu — bir sonraki normal istek TTL'i geçene kadar eski değeri döndürüyordu. **Çözüm:** yeni `primeViewModeCache(mode)` — `POST /api/flexos/view-access/mode` route'u `setViewMode()` başarılı olduğu anda bu instance'ın cache'ini TTL beklemeden senkron günceller (client zaten `window.location.reload()` çağırıyordu — asıl sorun sunucudaki gecikmeydi). `tsc`+ESLint temiz, 15+24 assertion geçti, `npm run build` başarılı.

**🔒 Kapsam düzeltmesi (aynı oturum, kullanıcı fark etti):** "Öğrenciler" (Havuz) sayfası admin/satış/operasyon işi — eğitmen bunu ne Full'da ne Core sistem modunda görmeli, kendi öğrencilerini Core'daki Sınıflarım → "Öğrencilerim" bölümünden ekliyor/görüyor zaten (ayrı, doğru akış). Eskiden `FlexSidebar`'da "Öğrenciler" linki `canSee("person.read", true)` ile gösteriliyordu — `person.read` eğitmen paketinde de olduğu için (hem Core hem Full) eğitmen bu linki görüyordu (link'e tıklayınca API zaten kendi grubuna scope'lu veri döndürüyordu — güvenlik açığı değildi, ama yanlış sayfaydı/UX tutarsızlığıydı). Düzeltme: gate `canSee("sale.read", false)` oldu — `sale.read` eğitmen paketinde (ne Core ne Full/standalone-extra) hiç yok, sadece satış/operasyon/admin'de var; `false` (enterprise-grup) ile owner'ın kişisel Core görünümünde de gizleniyor (mode=core iken owner zaten egitmen paketine düşüyor, aynı kural otomatik uygulanıyor). `tsc`+ESLint temiz, `npm run build` başarılı.

**✅ Real-time gecikme kökten kapatıldı + doğrulandı (2026-07-02, aynı oturum):** Kullanıcı local dev'de test ederken mod değişiminin bazen gecikmeli/ters yansıdığını bildirdi ("admin iken grup ekleyemiyorum, eğitmen iken ekleyebiliyorum" gibi kafa karıştırıcı anlar dahil). Kök neden ikiliydi: (1) `primeViewModeCache` henüz eklenmemişken TTL cache gecikmesi (bir önceki maddede düzeltildi), (2) gerçek bir yarış durumu — eski/geride kalmış bir arka plan Firestore okuması (`refreshViewModeCache`), yeni yazılan doğru değerin üzerine geç gelip eskiyi yazabiliyordu. **İkinci fix:** `refreshViewModeCache` artık okumaya başladığı anın zaman damgasını tutuyor (`requestStartedAt`) ve sonuç geldiğinde `viewModeLoadedAt` bu zamandan daha yeniyse (yani araya `primeViewModeCache` veya başka bir refresh girmişse) sonucu ATLIYOR — böylece geç gelen eski okuma asla daha taze bir değerin üzerine yazamaz. Kullanıcı bu fix sonrası "Grup Ekle" doğru çalıştı ama "Eğitim Yönetimi" hâlâ otomatik `window.location.reload()` sonrası eski (admin) haliyle görünmeye devam etti — sadece elle Cmd+R basınca düzeliyordu. Kök neden farklıydı: `fetch("/api/flexos/me")` çağrıları `cache` opsiyonu belirtmiyordu, tarayıcı otomatik reload sonrası isteği **HTTP cache'ten** (birkaç yüz ms önceki eski cevap) sunuyordu; sunucu da yanıtta `Cache-Control` header'ı vermiyordu. **Fix:** hem `FlexSidebar.tsx` hem `useCapabilities.ts`'teki `/api/flexos/me` çağrılarına `cache: "no-store"` eklendi, route'un kendisi de `Cache-Control: no-store` header'ıyla dönüyor (savunma amaçlı, çift taraflı). `tsc`+ESLint temiz, `npm run build` başarılı. **Bu spesifik cache fix'i kullanıcı tarafından henüz tarayıcıda doğrulanmadı** (bir önceki maddedeki TTL/race fix'i doğrulandı, bu üçüncü kök neden ondan hemen sonra bulundu) — sıradaki oturumda/testte kontrol edilmeli. Ayrıca doğrulandı: `education.create`/`branch.create` eğitmen paketinde (Core dahil, sistem Full iken) hiç yok → "Eğitim Yönetimi" akordiyonu (Eğitimler+Eğitim Ayarları) eğitmen görünümünde artık doğru şekilde tamamen gizli; `group.read`/`grade.write`/`grade.finalize` her zaman eğitmen paketinde → Sınıflar/Yoklamalar/Sertifikasyon her iki sistem modunda da görünür — kod zaten böyle kuruluydu, ek değişiklik gerekmedi. `tsc`+ESLint temiz, 15+24 assertion geçti, `npm run build` başarılı.

**Kökten çözüm — TTL/periyodik yenileme tamamen kaldırıldı (aynı gün, devam):** `no-store` fix'i Full→Core yönünü düzeltti ama Core→Full (PIN'li) yönünde aynı sınıf sorun (sol menü/yetki gecikmeli geliyor, başka sayfaya girip çıkınca düzeliyor) + `GET /api/flexos/persons` (Öğrenciler listesi geçiş anında geçici BOŞ geliyordu — aynı kök neden: actor geçiş anında yanlışlıkla `egitmen`e, yani "atanmış grubum yok"a düşüp boş liste dönüyordu) devam etti. **Gerçek kök neden:** `standaloneMode` deseninden kopyalanan 10sn'lik arka plan TTL yenilemesi mimari olarak yanlış modeldi — `standaloneMode` BİRDEN FAZLA admin'in farklı tarayıcılardan değiştirebileceği bir ayar olduğu için periyodik yoklama (polling) gerekiyor; ama görünüm modu SADECE TEK kullanıcıya özel ve SADECE TEK bir kod yolundan (`POST /view-access/mode`) değişiyor — periyodik yeniden okuma hiç gerekmiyordu, sadece yarış riski katıyordu (eski bir arka plan okuması yeni yazılan doğru değerin üzerine geç gelip yazabiliyordu). **Yeni model:** `cachedViewMode` SADECE (1) soğuk başlangıçta bir kez Firestore'dan yüklenir (`loadViewModeOnColdStart`, `viewModeColdStartDone` bayrağıyla tek seferlik) VEYA (2) `primeViewModeCache()` ile senkron güncellenir (her mod değişiminde `POST /mode` route'u tarafından çağrılır) — periyodik TTL yeniden kontrolü tamamen kaldırıldı, tek doğruluk kaynağı artık `primeViewModeCache`. `tsc`+ESLint temiz, 15+24+7 assertion geçti, `npm run build` başarılı. **Test edilmeyen:** bu son kökten-çözüm kullanıcı tarafından henüz tarayıcıda doğrulanmadı (art arda çok sayıda bug bulunup düzeltildiği için bu oturumda zaman kalmadı) — sıradaki oturumda Core↔Full geçişleri (özellikle PIN'li Core→Full yönü) ve Öğrenciler listesinin her geçişte anında doğru geldiği tekrar test edilmeli.

**✅ "Yanlış sayfada kalma" sorunu → geçici Ana Sayfa'larla çözüldü (aynı gün, devam):** Kullanıcı test ederken iki gerçek UX sorunu bulundu: (1) Kullanıcılar sayfasındayken eğitmen moduna geçince sayfa `role.manage` isteyen veri çekmeye devam edip 403+çirkin "fetch failed" hatası veriyordu; (2) Öğrenciler (Havuz) sayfasındayken mod değişince sayfa aynı URL'de kalıyor, dışarı çıkıp geri girene kadar düzelmiyordu. **Kök neden:** `persistModeAndReload` sadece `window.location.reload()` yapıyordu — mod değişse de kullanıcı capability'si olmayan bir sayfada kalabiliyordu. **Çözüm:** iki geçici (içi boş) placeholder sayfa eklendi — `/flexos/anasayfa` (admin/Full) ve `/flexos/egitmen-anasayfa` (eğitmen/Core), ikisi de hiçbir capability-gated veri çekmiyor (asla 403 vermez, sadece auth ister). `persistModeAndReload` artık `reload()` yerine ilgili moda uygun ana sayfaya **navigate** ediyor (`window.location.href`) — bu hem UX sorununu çözüyor hem de yeni URL'e gidildiği için önceki tüm cache/staleness sınıfı sorunları da bypass ediyor (aynı URL'e tekrar istek değil, hiç yapılmamış taze istek). Sidebar'daki "Ana Sayfa" linki de artık işlevsel (`role.manage` varsa admin ana sayfa, yoksa eğitmen ana sayfa) — eskiden "yakında" toast'ı gösteriyordu. **Ürün kararı (kullanıcı):** owner Core'a geçince bilerek EĞİTMENİN ana sayfasını görüyor (kendi admin ana sayfasını değil) — "eğitmenin dashboard'unu deneyimlemek istiyorum" niyetiyle. Satış/Operasyon için ayrı dashboard'lar ileride ayrı iş kalemi. `tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/anasayfa` + `/flexos/egitmen-anasayfa` derlendi). **Test edilmeyen:** tarayıcıda doğrulanmadı, sıradaki oturumda kontrol edilmeli.

### 📋 Yoklama v2 + Finans Modülü — Kararlar (2026-07-02, henüz kod YAZILMADI)

> Kullanıcı Claude Design'da dashboard tasarımı yaptırıyor; paralelde "önce dashboard mı, önce modül taşıma mı" tartışıldı. **Karar: dashboard blocker değil** — dashboard altındaki modüllerin (yoklama/ödev/sertifika) verisini özetler, modüller yokken dashboard'a gerçek içerik konamaz. Sıra: **önce yoklama backend'i**, dashboard paralelde tasarlanabilir ama modül verisine bağlanması en sona kalır.

**Canlıdaki yoklama altyapısı değerlendirmesi (kod+log incelendi):** `AttendancePanel.tsx` (2001 satır) + `attendance-report/page.tsx` (1017 satır) + cron (`auto-close-attendance`). Son kod dokunuşu 2026-06-12 (`957f06b`), o zamandan beri stabil. İş kuralları OLGUN ve defalarca bug-fix'lenmiş (3 gün düzenleme penceresi, 6 saat auto-close, zaman kilidi admin muafiyeti, race condition fix'leri, banner durumları, takvim min/max) — **bunlar yeniden yazılmayacak, referans alınıp portlanacak.** Veri modeli (`design_attendance/{groupId}_{tarih}`, eski `groups`/`students`'a bağlı) taşınamaz — `flexos_attendance` + `Enrollment`/`flexos_groups` üstünde sıfırdan kurulacak (kaçınılmaz, yeni mimari).

**Kullanıcı kararları — yoklama v2 kuralları:**
- **UI aynen taşınır, TEK fark: avatar.** Görsel/illüstrasyon avatar YOK → kurumsal standart **daire + baş harf (gradient)** ([[avatar-stili]] ile aynı kural).
- **Görünürlük üç ayrı sayfa/kitle:**
  - **Yoklama Al + Yoklama Detay** → eğitmen görür, kendi grubunda **3 gün içinde düzenleyebilir** (canlıdaki `withinEditWindow` mantığı aynen).
  - **Yoklama Raporu** → **eğitmende YOK.** Sadece **Eğitim Op** (sınıf durumu + kaç saat yoklama alındı takibi; eğitmenin yetkisi olmayan girişi eğitmen talebiyle yapar/düzenler) ve **Finans** (ay sonu hakediş = yoklama saati × `Trainer.hourlyRate`, zaten `flexos_trainers`'ta var).
- **Veri modeli — en kritik kural:** Person tek kimlik (hem müşteri hem öğrenci); ödeme/enrollment/yoklama arkada ayrı tutulur ama **Öğrenci Kartı'nda TEK ekranda birleşir** (yoklama dahil). [[project-student-card-hub]]'daki Enrollment-bazlı sekme modeliyle (eğitim seçici → alt sekmeler) birebir örtüşüyor — yoklama o sekmelerden biri olacak.
- **İleride (şimdi kapsam dışı, vizyon notu):** Sistem devamsızlık paternini otomatik tespit edip Eğitim Op'u uyaracak ("bu öğrenci bir süredir gelmiyor"). Backend tasarımı buna kapıyı kapatmayacak (entry'ler tarih+durum bazlı sorgulanabilir kalacak) ama şimdi inşa edilmeyecek.

**Finans — YENİ 5. capability paketi (KARAR):** `satis|operasyon|egitmen|admin` → **+`finans`**. Gerekçe: Op'tan ayrı iş/kişi, finansal veri (hakediş/ödeme durumu) Op'a gereksiz sızmasın; paket eklemek mimari olarak ucuz (sadece registry+grant listesi). **Kapsam (kullanıcı):**
1. Ay sonu eğitmen hakediş hesabı (yoklama saati × `hourlyRate`).
2. Tahsilat takibi — ödemesi geciken/yaklaşan öğrencileri görür (zaten [[fatura-billing-modeli]]'nde tanımlıydı).
3. "Ödeme alındı" işaretleme (tık).
4. Ödeme hiç gelmezse **Eğitim Op'a bilgi verir.**
5. Gerekirse öğrenciyi **manuel beklemeye alır** — YENİ bir otomasyon değil, [[project-status-model]]'deki mevcut "askıya alma manuel" mekanizmasının finans tarafından da tetiklenebilir hale gelmesi.

**✅ Yoklama backend BİTTİ (2026-07-02, aynı gün devam):** `domain/core/attendance.ts` (`Attendance`: `id="{groupId}_{date}"`, `entries: Record<personId, {hours, online?}>`, `attendanceClosed`) + `domain/repo/attendance-repo.ts` (port) + `server/attendance-repo.firestore.ts` (`flexos_attendance` koleksiyonu) + `domain/services/attendance-service.ts`:
- `startLesson(actor, {groupId, date}, deps)` — gated `attendance.write`; grubun ders günü (`schedule.days`) + tarih aralığı (`startDate`/`endDate`) doğrular; mevcut kaydın üzerine ASLA yazmaz (canlıdaki `handleStartLesson` güvencesi).
- `saveAttendance(actor, {groupId, date, entries, close?}, deps)` — gated; **org-scope aktör (Op/Finans/Admin) 3 gün penceresini HER ZAMAN bypass eder** (`widestScope(actor,"attendance.write")==="org"`, canlıdaki "admin/yönetici muafiyeti" ile birebir ama capability-driven, `if(role===x)` yok); assigned-scope (standart eğitmen) sadece kendi grubunda ve `isWithinEditWindow(date)` (3 gün, `date`'ten hesaplanır — `closedAt`'tan DEĞİL, canlı kuralı aynen) içinde.
- 3 yeni capability: `attendance.write` (yazma/scope'lu), `attendance.read` (okuma/scope'lu), `attendance.report.read` (yellow+audited, scopable:false — Yoklama Raporu).
- **Paket dağılımı (2026-07-02 kararına birebir):** `egitmen` → `attendance.write`+`attendance.read` (assigned) SADECE — `attendance.report.read` BİLEREK YOK (Yoklama Raporu eğitmende hiç görünmez). `operasyon`+`admin` → üçü de org-scope. **YENİ 5. paket `finans`** (`packages.ts`, `PackageName` genişledi) → `attendance.report.read` + `trainer.rate.read` (hakediş: saat×hourlyRate) + `payment.create/read` + `sale.read` + `person.read` — **`attendance.write` BİLEREK YOK** (Finans tek tek kayıt yazamaz, sadece rapor okur). Not: `person.status.suspend` (manuel beklemeye alma) henüz registry'de yok — Finans'ın bu aksiyonu ileride netleşecek (billing modülü işi, şimdi kapsam dışı).
- Route'lar: `POST /api/flexos/attendance` (başlat), `GET /api/flexos/attendance?groupId=&date=` (tek kayıt+`withinEditWindow` bayrağı) veya `?groupId=&month=` (liste), `PATCH /api/flexos/attendance/[id]` (kaydet/kapat/yeniden aç — body `{groupId,date,entries,close?}`, id gövdeyle uyuşmazsa 400), `GET /api/flexos/attendance/report` (Op+Finans+Admin, gated `attendance.report.read`, groupId/trainerId/month filtreli, join'li — hakediş HESAPLAMASI burada YOK, sadece ham+join'li veri).
- Firestore rules: `flexos_attendance` server-only.
- **18 yeni assertion** (`scripts/assert-attendance.ts`) + mevcut 24+15+7+12 regresyonsuz geçti (toplam 76). `tsc`+ESLint temiz, `npm run build` başarılı (3 yeni route derlendi).
- **HENÜZ YOK (bilerek, sıradaki iş):** UI (Yoklama Al/Detay/Raporu sayfaları — canlıdaki `AttendancePanel.tsx` referans alınıp portlanacak, avatar hariç aynı), auto-close cron (canlıdaki `auto-close-attendance` benzeri — şimdilik `close` manuel), hakediş hesaplama servisi (Finans modülü, saat×hourlyRate), Öğrenci Kartı'na yoklama entegrasyonu ([[project-student-card-hub]]).

**🔧 Netleştirme (2026-07-02, aynı gün devam):** "Yoklama Raporu eğitmende YOK" kuralı **SADECE Full sistem için**. **Core (standalone) modda eğitmenin Yoklama Raporu görüp göremeyeceği HENÜZ KARARLAŞTIRILMADI** — ileride ayrıca karara bağlanacak. Core'da yoklamanın amacı farklı: eğitmen **kendi aylık/senelik ders saati toplamını** görsün ("bu ay/bu sene kaç saat ders verdim") — Op/Finans'ın çapraz-grup `attendance.report.read` raporundan AYRI, kişisel bir özet ihtiyacı. Muhtemelen eğitmenin zaten sahip olduğu `attendance.read` (kendi grupları) üzerinden, `attendance.report.read` açmadan karşılanabilir — henüz endpoint/UI yok, UI aşamasında karar verilecek.

**✅ Yoklama UI — AŞAMA 1 BİTTİ (2026-07-02, aynı gün devam):** `src/app/flexos/yoklama/_shared/AttendanceCore.tsx` (motor bileşen, Yoklama Al + Yoklama Detay ortak, canlıdaki `AttendancePanel.tsx`'ten portlandı) + `src/app/flexos/yoklama/al/page.tsx` (`/flexos/yoklama/al` — BİLEREK FlexSidebar'sız bağımsız sayfa, kendi başlık çubuğu, canlıdaki `/attend` deseni: framer-motion slide ile Yoklama Al↔Detay). Sidebar'daki "Yoklamalar" linki artık gerçek `attendance.write` capability'sine bağlı VE **yeni sekmede açılıyor** (`window.open`, 2026-07-02 kullanıcı kararı — ders başladıktan sonra yanlışlıkla başka sayfaya geçip yarım bırakmasın).
- **Kapsam kararı (kullanıcı, 2026-07-02): "kodun aynı olması önemli değil, UI aynı olmalı."** Aynı Tailwind sınıfları (globals.css `@theme` token'ları paylaşımlı, canlı/FlexOS aynı repo) — banner durumları, 3 gün kilidi, zaman penceresi (15dk önce–6sa sonra), Sınıf Geneli quick-mark, saat/online girişi, lacivert özet bar (Toplam/Yapılan/Kalan Ders başlıkları hep görünür — veri kısmı "—" placeholder, Başlangıç/Bitim gerçek veri) BİREBİR. TEK GÖRSEL FARK: avatarlar (illüstrasyon/foto YOK, `initials`/`avatarStyle` — `siniflar/_shared/groupDisplay.ts` ortak).
- **🐛 Canlıdaki bug DÜZELTİLDİ:** `setHours`/`markAllHours` artık online değerini `prev[personId]?.online ?? person.isOnlineStudent ?? false` ile seed ediyor — canlıda saat girilince kalıcı online öğrencinin işareti `false`'a düşüyordu (sadece `prev`'e bakılıyordu, `isOnlineStudent`'a hiç değil). `Person.isOnlineStudent` alanı eklendi + roster route'una dahil edildi.
- **`deleteAttendance` servis + `DELETE /api/flexos/attendance/[id]`** eklendi ("İptal"/"Temizle" — sadece kapatılmamış kayıtlarda).
- **AŞAMA 1'de BİLEREK ERTELENEN** (kullanıcı onayıyla): aylık planlanan/yapılan ders sayısı + kurs ilerleme donut'u (course-progress), öğrenci detay modalı (devam donut'u), auto-close cron (şimdilik "Dersi Bitir" manuel).
- **20 assertion'a çıktı** (`deleteAttendance` eklendi), `tsc`+ESLint temiz, `npm run build` başarılı.

**✅ "Ders Olmadı" (Ders İstisnası) — UI EKLENDİ, işlevsellik Aşama 2'de (2026-07-02):** Sebep seçim modalı (Eğitmen/Öğrenci/Teknik/Diğer + kapsam — org-scope'a görünür + not), kırmızı istisna banner'ı, ilgili UI kapıları (Sınıf Geneli/öğrenci listesi/alt buton) canlıdan birebir portlandı. **Kayıt SADECE yerel state** (`exceptions` map, sayfa yenilenince kaybolur) — backend persist (`lesson_exceptions` eşdeğeri, öğrenci-kaynaklı otomatik devamsızlık yazımı) Aşama 2'de.

**✅ AŞAMA 2 — İLK ADIM: Senelik Tatiller BİTTİ (2026-07-02, aynı gün devam):** Kullanıcı canlıdaki `GroupBranchPanel.tsx` "Tatiller & İptaller" bölümünü örnek gösterdi. Tam backend: `domain/core/holiday.ts` + repo port + `server/holiday-repo.firestore.ts` (`flexos_holidays` koleksiyonu, canlıdaki `holidays`'e dokunmaz) + `domain/services/holiday-service.ts` (create/update/delete, gated YENİ `holiday.manage` capability, operasyon+admin) + `POST/GET /api/flexos/holidays` + `PATCH/DELETE /api/flexos/holidays/[id]` (GET herkese açık — yoklama takvimi dahil herkesin okuması gerekiyor, sadece yazma kapılı) + Firestore rules. **UI:** `/flexos/egitim-yonetimi/ayarlar/tatil` (ekle/düzenle/sil, ad+başlangıç/bitiş tarih), Eğitim Ayarları hub'daki "Senelik Tatiller" kartı artık bu sayfaya bağlı (`to: null` placeholder kaldırıldı). **Yoklamaya bağlandı:** `AttendanceCore.tsx` artık `GET /api/flexos/holidays`'i okuyup tarih aralığını `Set<string>`'e açıyor — takvimde işaretleniyor (`DayCalendarPopover holidayDates`), o günlerde ders bloklanıyor (`isActiveForDate`/`overlayMessage`/sidebar grup listesi dot'u hepsi tatil-farkında). 9 yeni assertion (`scripts/assert-holiday.ts`). `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 24+15+7+12+20=78 assertion regresyonsuz (toplam 87).

**✅ AŞAMA 2 — 2. ve 3. adım: Kurs ilerleme altyapısı + Ders İstisnası backend'i BİTTİ (2026-07-02, aynı gün devam):** Kullanıcı: "aylık planlanan ders sayısı altyapısı yapılabilir, grup tanımlamak şart değil (Grafik-2 detayları belli olunca gerçek olur); ders istisnası backend'ine engel yok."
- **Lacivert bar gerçek veri:** `AttendanceCore.tsx` artık seçili grubun `educationId`'sinden `GET /api/flexos/educations/[id]` ile `totalHours` çekiyor + `GET /api/flexos/attendance?groupId=` (ay filtresiz → tüm zamanlı) ile gerçek "yapılan ders" sayısını hesaplıyor. **Toplam Ders** `Education.totalHours` boşsa (katalogda henüz tanımlanmadıysa, ör. Grafik-2) "—" kalır — alan doldurulunca otomatik gerçek sayı çıkar, ekstra kod gerekmez. **Yapılan Ders** her zaman gerçek (tüm-zamanlı kapatılmış/dolu kayıt sayısı × sessionHours). **Kalan Ders** = Toplam − Yapılan (Toplam yoksa "—"). Yeni backend/route YOK — mevcut `Education.totalHours` alanı ve mevcut `/attendance` endpoint'i yeniden kullanıldı.
- **Ders İstisnası backend'i TAM BAĞLANDI:** `domain/core/lesson-exception.ts` (`LessonException`: `id="system_{date}"|"{groupId}_{date}"`, `scope`, `reason`, `countsAsLesson`) + repo port + `server/lesson-exception-repo.firestore.ts` (`flexos_lesson_exceptions`) + `domain/services/lesson-exception-service.ts` (`saveLessonException`/`deleteLessonException`/`getLessonException`, gated `attendance.write` — `scope="system"` SADECE org-scope, canlıdaki `isAdmin()` kapısı) + `POST/GET /api/flexos/lesson-exceptions` + `DELETE /api/flexos/lesson-exceptions/[id]` + Firestore rules. **Öğrenci-kaynaklı istisna** (`reason="student"`, ders sayılır) → kayıt yoksa gruptaki TÜM aktif enrollment'lara otomatik devamsızlık yazar (kapatılmış `Attendance`, `createdByException:true`); istisna silinince bu kayıt da silinir (canlıdaki `createdByException` mantığı birebir). `AttendanceCore.tsx`'teki yerel `exceptions` map kaldırıldı, artık API'den yükleniyor/kaydediliyor.
- **28 yeni assertion** (10 lesson-exception, önceki 20 attendance zaten `deleteAttendance` içeriyordu) — mevcut 78 regresyonsuz geçti (toplam 97: 24+15+7+12+20+9+10). `tsc`+ESLint temiz, `npm run build` başarılı.

**✅ Yoklama Raporu UI BİTTİ (2026-07-02, aynı gün devam):** Backend zaten vardı (`GET /api/flexos/attendance/report`), sadece sayfa eksikti — kullanıcı "en mantıklısı bu" dedi, öncelik sırasını netleştirdi (Rapor → Hakediş → aylık stat kartları → auto-close cron → Core "kendi ders saatim"). `/flexos/yoklama/rapor` — gated `attendance.report.read` (Op+Finans+Admin, eğitmende YOK), FlexSidebar'a "Yoklama Raporu" linki eklendi (`IC.barChart`, `active="yoklama-raporu"` — mevcut eğitmen-facing "Yoklamalar" linkinden AYRI, farklı capability). İki bölüm: **(1) Eğitmen Bazlı Özet** — seçili ayda eğitmen başına ders sayısı+toplam saat (client-side aggregate, Finans'ın hakediş hesabı için ham girdi — çarpım/hourlyRate henüz YOK, ayrı iş) **(2) Kayıtlar** — tarih/grup/eğitim/eğitmen/saat/öğrenci/durum tablosu (Op'un sınıf takibi için). Filtreler: ay (varsayılan bu ay)/grup/eğitmen. Yeni backend YOK — sadece görüntüleme. `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 97 assertion regresyonsuz (bu iş assertion gerektirmedi, saf UI).

**🔧 DÜZELTME — Yoklama Raporu doğru portlandı + sidebar 3 alt menüye kavuştu (2026-07-02, aynı gün devam):** Kullanıcı ilk "Yoklama Raporu UI" denemesini (kendi tasarımım) reddetti: **"kafana göre yoklama raporu yapma, canlıda bir yoklama raporu var, oradan alacaksın birebir."** Gerçek dosya `src/app/dashboard/attendance-report/page.tsx` (1017 satır, `AttendanceSummaryPage`, admin-only) — LORE'daki eski isimlendirme yanıltıcıydı (dosya adı "attendance-report" ama içeriği tam "Yoklama Raporu"). Birebir portlandı: **3 panel, hepsi TEMBEL YÜKLENİR** (kullanıcı vurgusu — onlarca eğitmen yoklama girince her şeyi baştan çekmemek): (1) eğitmen bazlı tablo (Planlanan/Verdi/İptal/**Toplam Ders**[=hakediş kaynağı]/tamamlama%) + branş/grup/eğitmen filtre + grup-kodu arama (sadece eşleşen ≤5 grubun geçmişi çekilir) + tarih aralığı + özet stat kartları; (2) split view — sol eğitmenin grupları, sağ SEÇİLEN grubun TAM geçmişi (`GET /api/flexos/attendance?groupId=`, SADECE tıklanınca); (3) seçilen günün detayı (`AttendanceCore` salt-okunur, SADECE tıklanınca). Veri modeli çevirisi: canlının holiday-aware `estimatedEndDate` hesaplaması yerine FlexOS'un zaten var olan `Group.schedule.endDate` alanı kullanıldı (daha basit, aynı sonuç). **Backend eklemeleri:** `LessonExceptionRepo.list()` + `GET /api/flexos/lesson-exceptions` artık list-mode destekliyor (groupId/date yoksa `attendance.report.read` gated, `from`/`to` filtreli — cancelled/studentCancelled aggregate için); `GET /api/flexos/attendance/report`'a `from`/`to` + `createdByException` alanı eklendi. `AttendanceCore.tsx`'e `initialDate` prop'u eklendi (Panel 3'ün belirli bir tarihte açılması için).
- **Yeni sayfa `/flexos/yoklama/detay`** — canlıdaki `/dashboard/attendance` karşılığı (grup önceden seçili değil, `AttendanceCore mode="detail"` doğrudan).
- **Sidebar düzeltmesi:** "Yoklamalar" artık **akordiyon ana başlık** (Eğitim Yönetimi/Aktivite Merkezi ile aynı desen) → **Yoklama Al + Yoklama Detay** (`attendance.write`, eğitmen dahil, yeni sekmede açılır) + **Yoklama Raporu** (`attendance.report.read`, SADECE Op/Finans/Admin — eğitmende YOK, normal navigasyon). Önceki hatalı yapı (flat "Yoklamalar" + ayrı flat "Yoklama Raporu" item'ı) kaldırıldı.
- `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 97 assertion regresyonsuz (bu iş yeni assertion gerektirmedi, saf UI+küçük backend genişlemeleri).

**✅ Yoklama Raporu cila + Görünüm Anahtarı kısayol serüveni (2026-07-02, aynı gün devam, tarayıcıda DOĞRULANDI):**
- Rapor tablosu: başlıklar `uppercase` CSS (Türkçe karakter uyumlu) + "Verdi"→"Verilen".
- Rapor'a diğer FlexOS sayfalarıyla aynı header eklendi (ikon kutusu solda, zil+kullanıcı sağda) — isim DİNAMİK (`users/{uid}`, statik "Alparslan Şentürk" değil, Yoklama Al'daki fix'le aynı desen). İkonlar lucide-react'e çevrildi (`TrendingUp`/`Clock`/`CheckCircle2`/`XCircle`, canlıyla aynı renkler) — placeholder emoji kaldırıldı.
- Header genişliği içerikle hizalandı (sabit `maxWidth:1920` yerine panellerle aynı Tailwind breakpoint'leri) + panel içindeki tekrarlayan "Yoklama Raporu" başlığı kaldırıldı (header'da zaten var, kalabalık azaldı).
- **Sidebar: Yoklama Detay artık yeni sekmede açılmıyor** — sadece Yoklama Al yeni sekmede (kullanıcı düzeltmesi, sadece Al'ın "yarım kalmasın" koruması gerekiyordu).
- **Görünüm Anahtarı kısayolu 3 kez değişti, sonunda bulunup çözüldü:** `Ctrl+Shift+M` (Chrome'un profil değiştirme kısayoluyla çakışıyordu, tarayıcı seviyesinde yakalanıyor) → `Ctrl+Shift+K` (görünürde çalışmadı, "hiç hareket yok") → **teşhis logu eklenip kök neden bulundu: hem `QuickSearch.tsx`'in kendi `Ctrl+K`'sı Shift/Alt'a bakmadan tetikleniyordu (düzeltildi: artık sadece SAF Ctrl+K'de açılıyor) HEM DE gerçek "k" tuşu tarayıcıya hiç ulaşmıyordu (muhtemelen arka planda çalışan başka bir uygulamanın global kısayolu — Grammarly/1Password/Notion/overlay türü).** Kullanıcı `Ctrl+Alt+M`'yi istedi → **tarayıcıda test edildi, ÇALIŞIYOR** ("bu oldu bak"). Teşhis logu temizlendi. Tüm UI metinleri (`kullanicilar/page.tsx` PIN açıklaması, `anasayfa`/`egitmen-anasayfa` doc yorumları) güncel kısayola göre güncellendi.
- `tsc`+ESLint temiz, `npm run build` başarılı, 97 assertion regresyonsuz her adımda.

**Durum:** Yoklama Aşama-1 (UI) + Aşama-2'nin büyük kısmı (Tatil günleri, kurs ilerleme altyapısı, Ders İstisnası backend'i, Yoklama Raporu doğru portlanmış hali, sidebar 3-alt-menü, Görünüm Anahtarı kısayolu) BİTTİ VE **Görünüm Anahtarı tarayıcıda doğrulandı** (`Ctrl+Alt+M`, gerçekten mod değiştiriyor). **Aşama-2'den HENÜZ YOK (öncelik sırasına göre):** Hakediş hesaplama (Finans, saat×hourlyRate — Rapor sayfasındaki eğitmen özeti üzerine kurulacak), aylık (bu-ay-özel) planlanan/yapılan stat kartları + course-progress donut (canlıdaki "detailed" mod büyük kartı — Yoklama Al/Detay'da, Rapor'da DEĞİL), auto-close cron, Core'da eğitmenin "kendi ders saatim" görünümü (tasarım kararı bekliyor). Öğrenci detay modalı düşük öncelik (kullanıcı zaten canlıda yapmıştı). **Yoklama Al/Detay/Rapor'un kendisi (asıl akış — grup seç/ders başlat/saat gir/kaydet/kapat, drill-down rapor) bu oturumda tarayıcıda UÇTAN UCA test edilmedi** — sadece Görünüm Anahtarı kısayolu doğrulandı. Sıradaki oturumda mutlaka gerçek bir yoklama alınıp denenmeli. Detaylı not: Claude memory `project_attendance_v2_rules.md`.

**✅ "Yoklama Detay" gerçek landing sayfasına kavuştu — canlıdan doğru portlandı (2026-07-02, aynı gün devam, Mac):** Kullanıcı fark etti: `/flexos/yoklama/detay` aslında `/flexos/yoklama/al`'ın (Yoklama Al) neredeyse birebir aynısıydı — çünkü ikisi de sadece `AttendanceCore`'u farklı `mode` prop'uyla render ediyordu. Ama canlıda "Yoklama Detay" tamamen AYRI ve çok daha zengin bir sayfa: `AttendanceDetailContent.tsx` (710 satır, `src/app/components/dashboard/attendance/`, host route `/dashboard/attendance-detail`) — stat kartları (Planlanan/Verilen/İptal/Toplam Ders saat), 24 aylık ay seçici, eğitmen/branş/grup filtreleri, grup kodu arama (tarih aralığıyla, eşleşen ≤5 grubun tüm geçmişi), grup listesi + Bu Ay İlerleme + Kurs İlerleme progress bar'ları; bir gruba "Detay" tıklanınca ancak o zaman tekil grup oturum listesi açılıyor. Bu katman FlexOS'a hiç taşınmamıştı.

**Port edildi:** `src/app/flexos/yoklama/_shared/AttendanceDetailList.tsx` (yeni) — aynı desen ("kodun aynı olması önemli değil, UI aynı olmalı", aynı Tailwind sınıfları) ama veri katmanı Firestore-direct `onSnapshot` yerine FlexOS REST API'leri: `GET /branches`, `/trainers` (sadece `attendance.report.read` sahipleri — Op/Finans/Admin), `/holidays`, `/educations` (totalHours map), `/groups` (zaten actor-scope'lu — eğitmen sadece kendi gruplarını görür, ekstra kod gerekmedi), ve her filtreli grup için TEK `GET /attendance?groupId=X` çağrısı (tüm-zamanlı kayıt, hem aylık hem all-time istatistik AYNI payload'dan türetiliyor — canlının 2-sorgulu deseninden daha verimli). **İptal istatistiği** (`lesson_exceptions` aggregate) SADECE `attendance.report.read` sahipleri için çalışır (o uç eğitmende yok, tenor gated) — eğitmen görünümünde "İptal" her zaman "—" kalır, geri kalan tüm istatistikler (Planlanan/Verilen/Toplam/İlerleme) eğitmen için de tam çalışır (kendi gruplarıyla sınırlı). Instructor filtresi de aynı capability'yle gate'lendi (`isOrgWide`).

**`/flexos/yoklama/detay/page.tsx` yeniden yazıldı:** artık `/flexos/yoklama/al`'daki AYNI framer-motion slide deseni — sol panelde `AttendanceDetailList` (landing), bir grupta "Detay"a tıklanınca sağdan `AttendanceCore mode="detail" preSelectedGroupId initialDate` slide-in (route değişimi değil, `onBackToAttend` ile geri dönülüyor — `AttendanceCore`'un zaten var olan generic "geri" callback'i, Al sayfasındakiyle aynı prop). Grup durumu (Aktif/Kapalı sekmesi) FlexOS domain status'una göre eşlendi (`status==="completed"|"archived"|"cancelled"` → kapalı).

`tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/yoklama/detay` derlendi), mevcut 97 assertion regresyonsuz (bu iş saf UI+API-tüketimi, yeni assertion gerektirmedi — mevcut attendance/holiday/lesson-exception endpoint'leri olduğu gibi kullanıldı). **Test edilmeyen:** tarayıcıda uçtan uca doğrulanmadı (grup listesi/istatistikler/arama/detay slide-in) — sıradaki oturumda kontrol edilmeli.

**🔧 2 düzeltme daha (aynı gün devam, kullanıcı fark etti):**
1. **Sidebar+header eksikti:** İlk portta `/flexos/yoklama/detay` yanlışlıkla Yoklama Al'ın BAĞIMSIZ sayfa desenini (FlexSidebar yok, mini topbar) kopyalamıştı. Ama canlı kaynağı (`src/app/dashboard/attendance-detail/page.tsx`) tekrar kontrol edilince görüldü: Yoklama Detay standalone DEĞİL, normal `Sidebar`+`Header` içinde çalışıyor (sadece Yoklama Al standalone — "ders başlarken dikkat dağılmasın" amacıyla BİLEREK öyle). Sayfa Yoklama Raporu'nun (zaten doğru yapılmış) `FlexSidebar active="yoklama-detay"` + aynı header deseniyle (ikon kutusu+başlık solda, zil+kullanıcı sağda) yeniden yazıldı.
2. **Duplicate başlık:** `AttendanceDetailList` kendi içinde de "Yoklama Detay" h1'i çiziyordu — artık sayfa header'ında olduğu için içerideki tekrar kaldırıldı (Yoklama Raporu'nda daha önce yapılan aynı düzeltme). İçeride sadece filtre bağlamı (varsa eğitmen/branş adı) + ay seçici kaldı.

`tsc`+ESLint temiz, `npm run build` başarılı.

**✅ "Detail" mod tam donatıldı — canlıdaki 3-stat+donut bloğu portlandı (aynı gün devam):** Kullanıcı bir gruba "Detay" tıklayınca canlıda gördüğü katmanın (aylık Planlanan/Yapılan/Kalan 3 stat kartı + sağda kurs ilerleme donut'u + en son yapılan dersin salt-okunur açılıp "Düzenle" ile açılması) FlexOS'ta eksik olduğunu belirtti — bu, AŞAMA 1'de bilerek ertelenmiş bir kalemdi (`AttendanceCore.tsx` doc yorumunda not düşülmüştü), şimdi yapıldı. Derin inceleme (agent, `AttendancePanel.tsx` satır 1320-1538) doğruladı: canlıda `mode==="simple"` sadece lacivert özet bar gösterir, `mode==="detailed"` (varsayılan) ise bar YERİNE 3 stat kartı + donut gösterir — iki blok birbirini DIŞLAR, üst üste değil.

**Port edilen:** `AttendanceCore.tsx`'e `mode==="simple"` ⟺ mevcut lacivert bar (değişmedi), `mode==="detail"` ⟺ yeni blok: 3 stat kartı (Bu Ay Planlanan/Yapılan/Kalan Toplam Ders — `countWeekdaysInMonth` yeni yerel helper + `holidayDates` + `schedule.startDate/endDate`, `AttendanceDetailList.tsx`'teki aynı mantığın küçük bir kopyası) + kurs ilerleme donut'u (custom SVG `stroke-dasharray`/`stroke-dashoffset`, CSS transition'lı — framer-motion'a gerek kalmadı, `courseTotalHours`/`courseDoneHours`/`courseRemainingHours` zaten hesaplanıyordu, sadece görselleştirilmedi) + İptal ders sayısı (SADECE `attendance.report.read` sahipleri, `lesson-exceptions` aggregate'ten — eğitmende gizli, tıpkı `AttendanceDetailList`'teki gibi). Veri kaynağı: mevcut `allTimeDoneCount` state'i `allTimeRecords` (tam kayıt dizisi) olarak genişletildi, aylık/tüm-zamanlı sayılar AYNI payload'dan `useMemo` ile türetiliyor (ekstra network isteği yok, sadece İptal için ayrı bir org-scope-only çağrı var).

**Bilerek ertelenen (kullanıcı bunları sormadı, kapsam dışı bırakıldı):** `groupMode` (Aktif/Kapalı grup listesi filtresi — Yoklama Al'dan gelen slide-in ile Yoklama Detay listesinden gelen arasındaki canlıdaki tek gerçek fark buydu, donut'un kendisi değil) ve `filterMonth`/3-aylık geçmiş tam-kilit mantığı FlexOS'a henüz taşınmadı — agent raporu bunları da net olarak işaretledi, ihtiyaç olursa hızlıca eklenebilir.

`tsc`+ESLint temiz (1 küçük `exhaustive-deps` uyarısı da giderildi — `selectedWeekDays` artık `useMemo`'lu), `npm run build` başarılı, mevcut 20 (attendance) + 10 (lesson-exception) assertion regresyonsuz.

**🔧 Donut boyut/tasarım düzeltmesi (kullanıcı canlıdan ekran görüntüsü attı, aynı gün devam):** İlk versiyon çok küçüktü (64px) ve legend donut'un ALTINDA tek satır metin halindeydi — canlıda donut büyük (~110px), ortada BÜYÜK saat sayısı (iki satır: sayı + "saat"), legend SAĞINDA 2×2 renkli-nokta grid (Toplam/Yapılan/Kalan/İptal, her biri kendi rengiyle: mavi/yeşil/turuncu/kırmızı). 3 stat kartına da ikon kutuları eklendi (mavi/yeşil/turuncu, canlıdaki gibi) + alt metin "(X ders)" yerine canlıdaki gibi "X gün". %100 tamamlanan kurslarda halka rengi yeşile dönüyor (canlıdaki gibi). **Bir grupta donut hiç görünmüyor** gözlemi muhtemelen o grubun `Education.totalHours` alanının katalogda henüz boş olmasından (var olan tasarım: totalHours yoksa donut/Kalan alanı gösterilmez, "—" mantığı) — kod bug'ı değil, veri eksikliği olabilir; ilk açılışta kısa bir yüklenme gecikmesi de olası (fetch async).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı, sıradaki oturumda kontrol edilmeli.

**✅ Tahminle uğraşmayı bırakıp CANLI KAYNAK BİREBİR portlandı (kullanıcı: "canlıdaki sayfayı aynen copy paste edemiyor musun, kodları var zaten"):** Ekran görüntüsünden tahmin etmek yerine `AttendancePanel.tsx` satır 1320-1538'i (gerçek "detailed" mod bloğu) doğrudan okuyup class'ı class'ına, satırı satırına FlexOS'a taşıdım. Gerçek yapı tahminimden hayli farklıymış:
- **Grup bilgi kartı ayrı, üstte, tam genişlik** — yeşil nokta + kod + "X saat/ders" rozeti solda, ay rozeti sağda, altında "Başlangıç Tarihi: ... | Tahmini Bitiş: ..." — bunu hiç yapmamıştım (sadece küçük bir breadcrumb vardı).
- **Layout: sol sütun (grup kartı üstte + 3 stat kartı altta, `flex flex-col gap-3`) | sağ sütun (donut kartı, `items-stretch` ile SOL sütunla AYNI toplam yüksekliğe geriliyor — "dikey/yüksek" görünümün sebebi buydu, benim donut kartım ayrı/kısa bir satırdaydı).
- **Donut:** SVG boyutu 130×130 (viewBox 164×164, r=58, strokeWidth=24 — benim kullandığım 110px/tek renkti), **gradient** dolgu (`linearGradient`, %100 tamamlanınca koyu yeşil→açık yeşil, değilse lacivert→açık mavi — ben düz tek renk kullanmıştım), merkez metin mutlak konumlu (`top:68,left:65`) iki satır (büyük sayı + "saat"), legend donut kartının İÇİNDE ALTINDA (ben ayrı yandaydı).
- **3 stat kartı ikonları:** Timer (mavi), CheckCheck (yeşil), CalendarClock (turuncu) — `lucide-react`'e eklendi (Clock/CheckCircle2/CalendarCheck kullanmıştım, yanlış ikonlardı).
- **"İptal Edilen" legend'i HER ZAMAN görünür** (canlıda org-scope ayrımı yok) — benim `isOrgScope` şartını kaldırdım, artık her zaman gösteriliyor (değer eğitmende hâlâ sadece org-scope aggregate fetch edildiğinde doğru geliyor, bilinen küçük sınırlama).
- Geri (`Yoklama Al`) linki artık detail bloğunun İÇİNDE, sağa yaslı, üstte (`flex justify-end pb-3`) — ayrı bir üst satır değil.

`tsc`+ESLint temiz, `npm run build` başarılı, mevcut 20+10 assertion regresyonsuz. **Test edilmeyen:** tarayıcıda doğrulanmadı — sıradaki oturumda mutlaka kontrol edilmeli (bu iş 3 tur ekran-görüntüsü-karşılaştırmalı düzeltme gerektirdi, dördüncü turda gerçek kaynağı okumak çok daha hızlı ve doğru sonuç verdi — **ders: görsel port işlerinde tahmin yerine baştan gerçek kaynağı okumalı**).

**🐛 Gerçek race condition fix — "ilk açılışta donut yok, gruptan gruba geçince geliyor" (aynı gün devam):** Kullanıcı doğru tespit etti: `courseTotalHours`'ı çeken effect `[selectedGroupId]`'e bağlıydı ama içeride `selectedGroup?.educationId` (yani `groups` dizisinden `.find()`) okuyordu. `preSelectedGroupId` ile sayfa ilk açıldığında bu effect `groups` henüz yüklenmeden çalışıyor → `educationId` o an `undefined` geliyor → `courseTotalHours` `null` kalıyor (donut hiç render edilmiyor) → `groups` sonradan yüklense de effect'i tetikleyen dep değişmediği için bir daha ASLA düzelmiyordu. Başka gruba geçince `selectedGroupId` değiştiği için effect tekrar çalışıyor, o an `groups` zaten yüklenmiş oluyor → doğru geliyor; aynı gruba dönünce de `selectedGroupId` yine değiştiği için (id değişimi A→B→A hepsi tetikler) düzeliyordu — kullanıcının gözlemlediği tam olarak bu. **Fix:** effect dependency'sine `selectedGroup?.educationId` eklendi — `groups` yüklenip `educationId` `undefined`'dan gerçek değere dönünce effect otomatik tekrar tetikleniyor, gruba geçmeye gerek kalmadan ilk açılışta doğru sonuç geliyor.

`tsc`+ESLint temiz (uyarı da gitti), `npm run build` başarılı, 20 assertion regresyonsuz.

**🔧 Yanlış "geri" butonu — canlı kaynak (`Header.tsx` `onBack`) tekrar incelendi (aynı gün devam):** `/flexos/yoklama/detay/page.tsx` grup detayına HER ZAMAN `onBackToAttend` geçiyordu → `AttendanceCore` içinde "← Yoklama Al" linki gösteriyordu. Ama kullanıcı doğrudan Yoklama Detay listesinden bir gruba girince "Yoklama Al"a dönmek anlamsız (oradan hiç gelinmedi) — canlıda da (`dashboard/attendance-detail/page.tsx`) bu call site `onBackToAttend`/`onBack` geçmiyor, bunun yerine PAGE-LEVEL `Header`'ın kendi `onBack` prop'u (sol üstte ok butonu, ikon kutusunun solunda) listeye dönüyor. **Fix:** `AttendanceCore`'a artık `onBackToAttend` geçilmiyor (o linki hiç render etmiyor), bunun yerine `/flexos/yoklama/detay/page.tsx`'in kendi header'ına canlıdaki `Header.tsx` deseniyle birebir aynı bir geri oku eklendi (`ArrowLeft`, sadece `showDetail=true` iken görünür, ikon kutusunun solunda, başlığı sağa iter) — `setShowDetail(false)` ile listeye döner. **Yoklama Al sayfası DEĞİŞMEDİ** — orada `onBackToAttend` hâlâ doğru şekilde "← Yoklama Al" gösteriyor (oradan girilen detay için mantıklı).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

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
