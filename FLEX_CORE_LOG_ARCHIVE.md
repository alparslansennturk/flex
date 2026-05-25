# FLEX CORE LOG
> Son güncelleme: 2026-04-11

---

## 1. Arşiv Silince Puan Düşme Sorunu

**Sorun:** Görevler arşivden silinince öğrencilerin puanı sıfırlanıyordu (120 → 84 gibi).

**Kök neden:** `recentScore` hesabı `tasksMap`'e bağlıydı — silinen görev `tasksMap`'ten düşünce `recentScore = 0`, `finalScore = generalScore * 0.7` oluyordu.

**Düzeltmeler:**
- `src/app/lib/scoring.ts` — `GradedTaskEntry`'ye `classId?` ve `endDate?` eklendi
- `src/app/dashboard/grading/page.tsx` — Not kaydında `classId` ve `endDate` entry'ye yazılıyor
- `src/app/dashboard/league/page.tsx`
  - `gradedTasks` filtresi `entry.classId` ile yapılıyor
  - Silinen görevler için `storedEndDate` fallback
  - Skor `generalScore` ile gösteriliyor (artık `finalScore` yok)

---

## 2. G2 Şablonu → G1 Sınıfı: XP Yarıya Düşürme

**Kural:** Grafik-2 şablonu Grafik-1 sınıfına verilince `xpMultiplier = 0.5`. Tersi yok.

**Düzeltmeler:**
- `src/app/components/dashboard/assignment/AssignmentLibrary.tsx` — `xpMultiplier` ve `groupModule` task doc'a yazılıyor
- `src/app/components/dashboard/scoring/DesignParkour.tsx` — Ghost aktivasyon ve reactivation'a `xpMultiplier` + `groupModule` eklendi
- `src/app/dashboard/grading/page.tsx` GradingForm — `xpMultiplier` önce task'tan, yoksa gruptan türetiliyor

---

## 3. Ödev İptal Edilince XP Geri Alma

**Kural:** "Ödevi iptal et" → öğrencilerin kazandığı XP silinir, task `isCancelled: true` olur.

**Düzeltme:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx` `handleCancelTask`
  - `task.grades`'den XP'li teslim edenler bulunur
  - `gradedTasks.${taskId}` → `deleteField()` ile silinir
  - `isCancelled: true` task'a yazılır

---

## 4. Sertifikasyon — Grup Bazlı Puan Sıfırlama

**Kural:** Not Girişi başlığındaki "Puanları Sıfırla" butonunun solunda grup seçici.
- **Tümü** → soft reset (isScoreHidden + bumpSeason)
- **Belirli grup** → sadece `gradedTasks` silinir, `projectGrades` dokunulmaz, season değişmez

**Düzeltmeler:**
- `src/app/dashboard/grading/page.tsx`
  - `GradingTabs`: `resetScope` state + select+button kombo UI
  - `ResetPointsModal`: `groupLabel` prop, `isGroupScope` branch ayrıldı

---

## 5. Sertifikasyon — Ödev Puanı Hesap Düzeltmeleri

### 5a. groupModule Filtresi
**Sorun:** `module` alanı şablondan geliyordu — eksik `module` alanında CertModuleTab görevi bulamıyor, ödev puanı "—" çıkıyordu.

**Düzeltme (ilk):**
- CertModuleTab `onSnapshot` filtresi: `groupModule` öncelikli, `tm != null ? tm === module : true` fallback
- Task oluşturulurken `groupModule` yazılıyor (AssignmentLibrary + DesignParkour)

**Düzeltme (son — eski gruplar için):**
- `tm` (şablon modülü) fallback tamamen kaldırıldı. `groupModule` yoksa direkt `true` döner.
- Sebep: eski görevlerde `tm = "GRAFIK_2"` (şablondan) ama görev GRAFIK_1 grubuna verilmiş — `tm === module` yanlış `false` üretiyordu.
- `classId` sorgusu zaten doğru grubu kısıtladığı için ek modül filtresi gerekmez.

### 5b. maxXP xpMultiplier Düzeltmesi
**Sorun:** `maxXP = getLevelXP` — `xpMultiplier = 0.5` olan task'larda oran yanlıştı.

**Düzeltme:**
- `maxXP += getLevelXP × (xpMultiplier ?? 1)` — CertModuleTab ve StudentDetailModal'da

### 5c. İptal Edilen Görev maxXP'yi Şişiriyordu
**Sorun:** `isCancelled` task'lar `isGraded: true` kaldığı için maxXP'ye giriyordu → final not 100 yerine 90 çıkıyordu.

**Düzeltme:**
- CertModuleTab ve StudentDetailModal filtrelerine `!t.isCancelled` eklendi

---

## 6. Sertifikasyon — Öğrenci Listesi Realtime

**Sorun:** `getDocs` (tek seferlik) — sayfa açıkken gruba transfer edilen öğrenciler görünmüyordu.

**Düzeltme:**
- `src/app/dashboard/grading/page.tsx`
  - `useRef` + `studentUnsubRef` eklendi
  - Finalize edilmemiş grup: `getDocs` → `onSnapshot` (realtime)
  - Grup değişince abonelik temizleniyor
  - Yeni öğrenci gelince mevcut girilen proje notları korunuyor

---

## 7. Öğrenci Transferi — Eski Puanların Temizlenmesi

**Kural:** Öğrenci başka bir gruba transfer edilince ödev XP'leri sıfırlanır.

**Düzeltme:**
- `src/app/hooks/useManagement.ts`
  - `deleteField` import'a eklendi
  - `handleAddStudent` — grup değişince: `gradedTasks: deleteField()`, `rankChange: 0`, `isScoreHidden: false`

---

## 8. TypeScript Derleme Hatası

- `src/app/dashboard/league/page.tsx` — `map` tipine `classId?: string` eklendi

---

## 9. Öğrenci Kartı — Lig Puanı Toplam Düzeltmesi

**Sorun:** Sol alttaki "Lig Puanı / Toplam" kutusu `student.score` gösteriyordu. Sertifikasyon ve sınıf yönetiminden açınca `score: 0` geçildiği için 0 görünüyordu; ligden açınca sadece mevcut sınıfın skoru çıkıyordu.

**Düzeltme:**
- `src/app/components/dashboard/student-management/StudentDetailModal.tsx`
  - Toplam kutusu: `student.score` → `g1Stats.score + g2Stats.score` (Firestore'dan yüklenen gerçek G1+G2 toplamı)
  - Yükleme sırasında `"…"` gösterilir

---

## 10. Arşiv Silince Öğrenci İstatistiklerinin Sıfırlanması

**Sorun:** Arşivdeki graded task silinince `task.grades` Firestore'dan kalkıyor. `calcModuleStats` ve CertModuleTab yalnızca mevcut task'lardan hesap yaptığı için öğrencinin ödev sayısı, XP ve lig puanı 0'a düşüyordu.

**Kök neden:** `student.gradedTasks[taskId]` kaydı korunuyor ama hesaplamalar onu dikkate almıyordu. Ayrıca `maxXp` saklanmadığı için odevPuani oranı da hesaplanamıyordu.

**Düzeltmeler:**
- `src/app/lib/scoring.ts` — `GradedTaskEntry`'ye `maxXp?` eklendi
- `src/app/dashboard/grading/page.tsx` (`handleSaveGrades`) — Not kaydında `maxXp: baseXP` entry'ye yazılıyor
- `src/app/components/dashboard/student-management/StudentDetailModal.tsx` (`calcModuleStats`)
  - Mevcut task döngüsüne ek olarak: `fsGradedTasks`'ta `classId` eşleşen, Firestore'da artık olmayan (silinmiş) task'ların XP ve `maxXp`'si de `taskCount` / `studentXP` / `maxXP`'e ekleniyor
- `src/app/dashboard/grading/page.tsx` (CertModuleTab)
  - `studentsRef` + `savedOdevPuanis` state eklendi
  - Task `onSnapshot`: mevcut `task.grades` XP'sine ek olarak `studentsRef.current`'tan silinmiş task XP'leri ve `maxXp`'leri toplanıyor
  - `getOdevPuani`: finalize edilmiş grupta `savedOdevPuanis`'ten stored değer kullanılıyor (task silinse etkilenmez)

---

## 11. Arşiv — Çoklu Oturum Birleştirme

**Sorun:** İkinci çekim Firestore'a kaydedilmiyordu. `handleArchive` mevcut arşiv dokümanını `updateDoc` ile güncelleyince `Missing or insufficient permissions` hatası alıyordu (rules'ta `allow update` yoktu).

**Kök neden:** `assignment_archive` kuralında yalnızca `allow create` vardı, `allow update` yoktu. Ayrıca birden fazla session için tek dokümana merge yapılması yetki gerektiriyordu.

**Düzeltme:**
- `handleArchive` ve `handleFinalizeTask` her zaman `addDoc` kullanır (update/merge yok) → yalnızca `create` yetkisi yeterli
- `src/app/dashboard/archive/page.tsx`
  - `ArchiveEntry`'ye `allIds: string[]` eklendi
  - Yükleme sırasında `taskId`'ye göre client-side merge: `draws` ve `students` deduplicate edilir
  - `handleDelete`: aynı `taskId`'ye ait tüm dokümanlar `Promise.all` ile silinir
- `firestore.rules` — `assignment_archive`'e `allow update` eklendi (yedek olarak)

---

## 12. DesignParkour — addDoc Undefined Points Hatası

**Sorun:** Şablondan başlatılan Photoshop görevinde `addDoc() called with invalid data. Unsupported field value: undefined (found in field points)` hatası.

**Kök neden:** Şablon dokümanında `points` alanı yoksa `undefined` Firestore'a geçiyordu.

**Düzeltme:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx` `handleGhostActivate`:
  - `points: t.points ?? null`, `description: t.description ?? null`, `type: t.type ?? null`

---

## 13. Kolaj/Kitap — Görev Tamamlama Tespiti

**Sorun:** 1. öğrenci tamamlayınca "Not Ver" butonuna geçiliyordu; 2. öğrenci hâlâ beklemedeydi.

**Kök neden:** `students.length` = o session'a katılan öğrenci sayısı kullanılıyordu. Her session'da bu sayı = o session'ın çekimleri sayısı → her zaman eşit çıkıyordu.

**Düzeltme:**
- `groupStudentCount` state + `useRef` eklendi — `getDocs(students where groupId == task.groupId)` ile gerçek grup üye sayısı çekiliyor
- `handleArchive` içinde: `drawsRef.current.length >= groupStudentCount` → tüm öğrenciler tamamlandıysa `status: "completed"`

---

## 14. Öğrenci Kartı — Toplam Ödev Sayısı Yükleme Durumu

**Sorun:** Modal açılınca "Toplam" kutusu 1 sn boyunca `student.completedTasks` (prop'tan gelen stale değer) gösteriyordu; diğer kutular "…" gösterirken Toplam hatalı sayı çıkıyordu.

**Düzeltme:**
- `src/app/components/dashboard/student-management/StudentDetailModal.tsx`
  - Toplam kutusu: yükleme sırasında `totalTasks` yerine `"…"` gösterilir (`loading` prop geçildi)

---

## 15. Kolaj — İsim ve Soyisim Aynı Satırda

**Sorun:** Çekim ekranında öğrenci ismi büyük puntoda gösterilirken soyisim `<br />` ile alt satıra geçiyordu.

**Düzeltme:**
- `src/app/components/dashboard/assignment/kolaj/GameScreen.tsx` (phase === "ready" bloğu)
  - `<br />` kaldırıldı; soyisim aynı satırda `{" "}` ile bitiştirildi (mavi renk korundu)

---

## 16. DesignParkour — Geçmiş Tarih Engeli

**Kural:** Ödev bitiş tarihi geçmişe verilemez; takvimde geçmiş günler disabled görünür.

**Düzeltme:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx` `TaskEditModal`
  - `today` hesabı + `min={today}` input'a eklendi
- `src/app/components/dashboard/assignment/AssignActivateModal.tsx`
  - Aynı şekilde `min={today}` eklendi

---

## 17. Kitap Kapağı — PDF Şablon ve Mail Güncellemesi

**Değişiklik:** Mail içeriği sade tutuldu; asıl bilgiler artık PDF ek olarak gönderiliyor.

**Düzeltmeler:**
- `src/app/components/dashboard/assignment/kitap/generateKitapPdf.tsx` oluşturuldu
  - `@react-pdf/renderer` + Roboto (Türkçe karakter destekli)
  - Biçim: büyük `bookId` → başlık → yazar → yayınevi → tür → arka kapak → çizgi → TEKNİK ÖZELLİKLER → Teslim Tarihi
  - Kağıt gramajı: %65 → 60 gr / %35 → 70 gr (öğrenci başına `useMemo` ile sabit); kalınlık buna göre 0.08 / 0.09 mm
  - Cilt tipi: her zaman "Amerikan Cilt"
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - `handleMail`: önce PDF üret, base64 olarak API'ye gönder
- `src/app/api/send-kitap/route.ts`
  - Sadeleştirildi: "Sayın X, ödeviniz ektedir." formatı; PDF attachment olarak eklendi

---

## 18. Kitap — "Ödevi Tamamla" Butonu Görünürlük Düzeltmesi

**Sorun:** Tüm grup öğrencileri tamamlandığında hâlâ "Ödevi Tamamla" ve "Ödevi Tamamla ve Ana Sayfaya Git" butonları görünüyordu.

**Düzeltme:**
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - Alt buton alanı: `!allGroupDone` koşulu eklendi
  - `allDone` bloğundaki "Ödevi Tamamla ve Ana Sayfaya Git" linki: `!allGroupDone` ile sarıldı
  - `allGroupDone` = true iken yalnızca "Arşive Kaydet" görünür

---

## Etkilenen Dosyalar

| Dosya | Konu |
|---|---|
| `src/app/lib/scoring.ts` | GradedTaskEntry — classId, endDate, maxXp |
| `src/app/dashboard/grading/page.tsx` | Not girişi, CertModuleTab, ResetModal, realtime öğrenci, silinen task recovery |
| `src/app/dashboard/league/page.tsx` | Puan hesabı, TS tip düzeltmesi |
| `src/app/components/dashboard/assignment/AssignmentLibrary.tsx` | xpMultiplier, groupModule |
| `src/app/components/dashboard/scoring/DesignParkour.tsx` | xpMultiplier, groupModule, isCancelled, XP geri alma, undefined points fix |
| `src/app/components/dashboard/student-management/StudentDetailModal.tsx` | maxXP, isCancelled filtresi, lig puanı toplam, silinen task recovery, Toplam yükleme |
| `src/app/hooks/useManagement.ts` | Transfer — gradedTasks silme |
| `src/app/dashboard/archive/page.tsx` | allIds merge, client-side taskId gruplama, toplu silme |
| `src/app/components/dashboard/assignment/kolaj/GameScreen.tsx` | handleArchive addDoc, groupStudentCount, isim aynı satır |
| `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx` | handleArchive addDoc, groupStudentCount, ödevi tamamla görünürlük, mail→PDF, carousel redesign |
| `src/app/dashboard/test-carousel/page.tsx` | Drift fix + responsive centering (test sayfası) |
| `src/app/components/dashboard/assignment/kitap/generateKitapPdf.tsx` | PDF şablon (yeni dosya) |
| `src/app/api/send-kitap/route.ts` | Sade mail + PDF attachment |
| `src/app/components/dashboard/assignment/AssignActivateModal.tsx` | min={today} tarih kısıtı |
| `firestore.rules` | assignment_archive allow update eklendi |

---

## Mimari Notlar

- `gradedTasks[taskId]` → `{ xp, penalty, seasonId, classId, endDate, maxXp }` — task silinse bile veri korunur; `maxXp` sayesinde odevPuani oranı recover edilebilir
- `isCancelled: true` — iptal edilen task'lar cert ve student modal'dan dışlanır
- `groupModule` — task verilirken grubun modülü (GRAFIK_1/2) task doc'a yazılır, cert filtresinde tek kriter; `module` (şablon) alanına bakılmaz — eski görevlerde yanlış değer verir
- Arşiv çoklu oturum: her `handleArchive` çağrısı yeni `addDoc` oluşturur; archive page `taskId`'ye göre client-side merge yapar
- `xpMultiplier` — G2 şablonu G1 grubuna gidince 0.5, aksi null; maxXP hesabına da uygulanır
- Transfer: grup değişince `gradedTasks: deleteField()` çalışır
- Sertifikasyon öğrenci listesi: finalize edilmemişse `onSnapshot`, edilmişse projectGrades'den frozen list
- `projectGrades` ID formatı: `{studentId}_{groupId}_{module}`
- Öğrenci kartı lig puanı toplam: sağ üstteki `student.score` = sadece mevcut sınıf; sol alt Toplam = `g1Stats.score + g2Stats.score`
- Kitap PDF: `bookId` alanı kapak numarası olarak büyük puntoda gösterilir; gramaj `useMemo` + `student.id` bağımlılığıyla öğrenci başına sabit
- `allGroupDone` = `groupStudentCount > 0 && bookDraws.length >= groupStudentCount`; bu durumda erken tamamla UI'ı gizlenir
- Tarih kısıtı: `min={today}` — tarayıcı native disabled render'ı kullanır, ek validasyon gerekmez
- Kitap carousel: `BookCarousel` offset-tabanlı animasyon kullanır; `toCoverBooks()` ile `BookItem` → `CoverBook` (palette ataması); `viewportRef + ResizeObserver` ile responsive merkez (`viewportWidth/2 - 120 - offset`)

---

## 19. Kitap Carousel — Drift Fix (test-carousel)

**Sorun:** `targetOffset = startOffset + fullRotations*TOTAL_WIDTH + randomFinalBook*BOOK_WIDTH` — her spinde seçilen kitap indeksi mevcut offset'e delta olarak ekleniyor. Normalize sonrası görsel merkez `(öncekiKitap + yeniKitap) % N` oluyor, `centerBookIndex` ile uyuşmuyor → her çekilişte kayma birikiyordu.

**İkinci sorun:** `transform: translateX(${-offset + (VISIBLE_BOOKS/2)*BOOK_WIDTH - BOOK_WIDTH/2}px)` sabit `400px` sabiti kullanıyor; gerçek konteyner genişliğinden bağımsız, `px-12` padding'i de hesaba katmıyor.

**Düzeltmeler:**
- `src/app/dashboard/test-carousel/page.tsx`
  - **Satır 227:** `targetOffset = (Math.floor(startOffset / TOTAL_WIDTH) + fullRotations + 1) * TOTAL_WIDTH + randomFinalBook * BOOK_WIDTH` — mutlak slot; önceki spin'den bağımsız
  - **Satır 329:** `transform: translateX(${viewportWidth / 2 - 120 - offset}px)` — `viewportRef + ResizeObserver` ile ölçülen gerçek genişlik; `120 = px-12(48px) + kitap yarı genişliği(72px)`

---

## 20. Kitap Carousel — BookGameScreen Redesign

**Kural:** `BookGameScreen` oyun alanının carousel kısmı test-carousel görseliyle değiştirildi; çekim/isim seçme mekanizmasına dokunulmadı.

**Düzeltmeler:**
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - `cn()` helper eklendi
  - `COVER_PALETTES` — test-carousel'in 10 rengi (emerald→zinc) döngüsel atama
  - `CoverBook` interface + `toCoverBooks()` — `BookItem`'ı palette alanlarıyla genişletir
  - `BookCover` — test-carousel'den birebir: sırt gölgesi, accent çizgiler, blur/unblur, `ring-2 ring-amber-400/50`
  - `BookCarousel` — test-carousel container görsel (`bg-black/40 backdrop-blur-sm`, amber oklar, `border-amber-400/30` merkez çizgiler, `from-slate-900/95` kenar gölgeleri, status dots); animasyon offset-tabanlı drift-fix mekanizmasına geçirildi; `winnerBook` mount'ta hedef olarak kullanılır
  - "Seçilen Kitap" bölümü — test-carousel `Selected book info` birebir: `text-amber-400`, `text-white`, `bg-white/10 rounded-full`, slide-up animasyonu; "Selected" → "Seçilen Kitap"

---

## 21. BookGameScreen — Oyun Alanı Dark Tema

**Değişiklik:** Sadece sağ taraftaki oyun alanı (öğrenci panel sidebar'ına dokunulmadı) koyu temaya alındı.

**Düzeltmeler:**
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - Arka plan: `#0d1526` gradient
  - Üst/alt bar: `bg-transparent border-white/6`
  - Bekleме yazısı (`idle` state): daha büyük punto + açık renk
  - Öğrenci ismi, teslim tarihi: amber/beyaz renk paleti

---

## 22. Mail Hata Yönetimi + Brevo API Key Tipi

**Sorun 1:** `handleMail` içinde `fetch` sonucu kontrol edilmeden `setMailSent(true)` çağrılıyordu — mail gitmese bile "Mail Gönderildi" gösteriyordu.

**Düzeltme:**
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - `if (!res.ok) throw new Error(...)` eklendi; hata durumunda console'a log basılır, `mailSent` false kalır

**Sorun 2:** `.env.local`'da `BREVO_API_KEY=xsmtpsib-...` (SMTP key) tanımlıydı — Brevo REST API `xkeysib-...` (API key) gerektirir; `401 Key not found` hatası veriyordu.

**Bilgi notu:**
- `xsmtpsib-...` → Brevo SMTP credentials (nodemailer SMTP için)
- `xkeysib-...` → Brevo REST API key (`api.brevo.com/v3/smtp/email` için) ← doğru olan
- Vercel production'da doğru key tanımlıydı, sorun yalnızca local ortamdaydı
- `src/app/lib/email.ts` — Brevo REST API kullanıyor; env var adı `BREVO_API_KEY`

---

## 23. Kitap — Görev Otomatik Tamamlama

**Sorun:** Tüm öğrenciler çekilişe girdiğinde task `status: "completed"` otomatik olarak güncellenmiyordu; eğitmen manuel tıklamak zorundaydı. Sayfa yeniden açılınca "Not Gir" yerine "Ödev Detay" butonu çıkıyordu.

**Kök neden:** `status: "completed"` yalnızca eğitmenin manuel butona tıklamasıyla yazılıyordu.

**Düzeltmeler:**
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - `handleSpinComplete` içinde: `updated.length >= groupStudentCount` → `updateDoc(tasks/${task.id}, { status: "completed", isActive: true })`
  - Recovery `useEffect`: sayfa yeniden açılınca `bookDraws.length >= groupStudentCount` ise aynı update çalışır (session kapatılıp açılsa bile düzeltir)
- `AssignmentScreen.tsx` zaten `status === "completed"` → `/dashboard/grading` redirect yapıyor — ek değişiklik gerekmedi

---

## 24. İsim Salınım Animasyonu — 5 Titreşim

**Değişiklik:** Öğrenci ismi göründüğündeki scale animasyonu 5 titreşimli, 1.2 s'lik fluid harekete güncellendi.

**Düzeltme:**
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - `@keyframes nameBounce` — 10 keyframe, %0'dan %100'e scale(0.05→1.32→0.78→1.18→0.88→1.08→0.94→1.03→0.98→1.00)
  - Süre: `0.75s ease` → `1.2s cubic-bezier(0.25,0.46,0.45,0.94) forwards`

---

## 25. Carousel Ortalama — globals.css rem Sorunu

**Sorun:** Merkezdeki kitap sarı gösterge alanının soluna/sağına kayıyordu.

**Kök neden:** `globals.css`'te `:root { font-size: calc(13.25px * var(--scale-factor)) !important }` tanımlı. Tailwind v4 rem-bazlı spacing kullanır:
- `px-12` = `3rem` ≈ `39.75px` (beklenen `48px` değil)
- `gap-4` = `1rem` ≈ `13.25px` (beklenen `16px` değil)
- Carousel ortalama formülü `viewportWidth/2 - 120 - offset` bu değerlere göre yazılmıştı; Tailwind class'ları farklı px üretince merkez kayıyordu.

**Düzeltme:**
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`
  - Kitaplar şeridi `div`: `className="absolute flex items-center gap-4 px-12"` → `className="absolute flex items-center"` + `style={{ paddingLeft: 48, paddingRight: 48, gap: 16 }}` (explicit px)
  - Artık root font-size'dan bağımsız; formül ve gerçek px değerleri eşleşiyor

**Not:** Bu sorun tüm rem-tabanlı Tailwind spacing'i etkiler. Piksel hassasiyeti gerektiren layout hesaplamalarında (canvas, carousel, drag) Tailwind class yerine inline `style={{ ...px }}` kullan.

---

## 26. Deadline Hatırlatma Cron (Yarım — vercel.json Bekliyor)

**Hedef:** Teslim tarihi 1 veya 2 gün kalan ödevler için öğrencilere sabah 09:00'da otomatik hatırlatma maili.

**Veri yapısı:**
- `tasks/{id}.endDate` → `"YYYY-MM-DD"` string (HTML `<input type="date">` değeri doğrudan yazılıyor)
- Eğitmen tarihi değiştirirse Firestore'daki değer güncellenir; cron her çalışmada o anki değeri okur → otomatik uyum
- `students/{id}.email` → öğrenci mail adresi

**Oluşturulan dosya:**
- `src/app/api/cron/deadline-reminder/route.ts`
  - `adminDb` (firebase-admin) ile Firestore sorgusu — client SDK değil
  - Query: `tasks` → `where("endDate", "in", [yarın, öbürgün])`
  - Arşivlenmiş (`status === "archived"`) ve duraklatılmış (`isPaused`) task'lar atlanır
  - Duplicate önlemi: `task.reminderSentDates[]` array'ine bugünün tarihi `FieldValue.arrayUnion` ile eklenir; aynı gün ikinci çalışmada skip edilir
  - Güvenlik: `Authorization: Bearer ${CRON_SECRET}` header kontrolü (Vercel otomatik ekler)
  - Türkiye saati: `UTC+3` offset ile `trDateString()` hesabı

**Durum: Tamamlandı**
- `vercel.json` mevcut: `deadline-reminder` (her gün 06:00 UTC) + `monthly-winner` (her ayın 1'i 06:00 UTC)
- `CRON_SECRET` Vercel Dashboard'a eklendi
- Cron aktif

---

## Logs Sistemi + Sertifikasyon Layout Fix (2026-04-03)

### Logs Sistemi

**Yeni Firestore koleksiyonları:**
- `mailLogs` — `{ to, subject, type, status, messageId, error, createdAt }` — her mail gönderiminde server-side yazılır
- `scoreLogs` — `{ studentId, studentName, teacherName, teacherUid, taskId, taskName, points, createdAt }` — her not kaydında XP > 0 olan her öğrenci için yazılır

**Backend:**
- `GET /api/admin/logs?type=mail|score` — son 200 log, `createdAt` desc sıralı
- `DELETE /api/admin/logs/delete-one` — body: `{ id, type }`
- `DELETE /api/admin/logs/delete-many` — body: `{ ids[], type }` — 500'lük Firestore batch

**Write noktaları:**
- `api/welcome/route.ts` → her welcome mail sonrası (başarılı/başarısız) mailLogs write
- `services/emailService.ts` → `sendOTPEmail()` içinde saveMailLog helper çağrısı
- `dashboard/grading/page.tsx` → `handleSaveGrades()` içinde `batch.commit()` sonrası, ayrı try/catch'te scoreLogs write (grading hatasından bağımsız)

**Frontend (`/dashboard/logs`):**
- Mail Logs sekmesi: tablo, status badge (success/failed), tür badge, tekli sil
- Puan Logları sekmesi: tablo, checkbox seçimi, tekli sil, "Seçilenleri Sil" toplu silme
- Admin-only: sayfa açılışında `users/{uid}.roles` kontrolü

**Navigasyon:**
- Sidebar'dan bağımsız link kaldırıldı
- Yönetim Paneli SubNavigation'a "Logs" sekmesi eklendi — `href: "/dashboard/logs"` ile `<Link>` olarak render edilir (diğer sekmeler `<button>`)
- Admin paneldeki eski "Logs ve Yedekleme" sekmesi → "Yedekleme" olarak yeniden adlandırıldı

### Sertifikasyon Layout Fix

**Sorun:** `max-w-250` (~1000px) kısıtı nedeniyle büyük ekranlarda içerik ortada küçük kalıyordu.

**Düzeltme:** `grading/page.tsx` içindeki 3 yerde `max-w-250` → `max-w-[1920px]` — admin panelin geri kalanıyla tutarlı.

**Etkilenen noktalar:** `GradingTabs` wrapper (~371. satır), `CertificationPanel` wrapper (~1583. satır), `GradingRouter` sekme başlığı (~1641. satır)

---

## Etkilenen Dosyalar

| Dosya | Konu |
|---|---|
| `src/app/lib/scoring.ts` | GradedTaskEntry — classId, endDate, maxXp |
| `src/app/dashboard/grading/page.tsx` | Not girişi, CertModuleTab, ResetModal, realtime öğrenci, silinen task recovery |
| `src/app/dashboard/league/page.tsx` | Puan hesabı, TS tip düzeltmesi |
| `src/app/components/dashboard/assignment/AssignmentLibrary.tsx` | xpMultiplier, groupModule |
| `src/app/components/dashboard/scoring/DesignParkour.tsx` | xpMultiplier, groupModule, isCancelled, XP geri alma, undefined points fix |
| `src/app/components/dashboard/student-management/StudentDetailModal.tsx` | maxXP, isCancelled filtresi, lig puanı toplam, silinen task recovery, Toplam yükleme |
| `src/app/hooks/useManagement.ts` | Transfer — gradedTasks silme |
| `src/app/dashboard/archive/page.tsx` | allIds merge, client-side taskId gruplama, toplu silme |
| `src/app/components/dashboard/assignment/kolaj/GameScreen.tsx` | handleArchive addDoc, groupStudentCount, isim aynı satır |
| `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx` | Dark tema, mail hata fix, auto-complete, isim animasyonu, carousel inline px fix |
| `src/app/dashboard/test-carousel/page.tsx` | Drift fix + responsive centering (test sayfası) |
| `src/app/components/dashboard/assignment/kitap/generateKitapPdf.tsx` | PDF şablon (yeni dosya) |
| `src/app/api/send-kitap/route.ts` | Sade mail + PDF attachment |
| `src/app/components/dashboard/assignment/AssignActivateModal.tsx` | min={today} tarih kısıtı |
| `src/app/api/cron/deadline-reminder/route.ts` | Deadline hatırlatma cron (yeni dosya — aktif değil) |
| `firestore.rules` | assignment_archive allow update eklendi |
| `src/app/api/admin/logs/route.ts` | GET mailLogs / scoreLogs (yeni dosya) |
| `src/app/api/admin/logs/delete-one/route.ts` | Tekli log silme (yeni dosya) |
| `src/app/api/admin/logs/delete-many/route.ts` | Çoklu log silme — Firestore batch (yeni dosya) |
| `src/app/api/welcome/route.ts` | mailLogs write eklendi (adminDb) |
| `src/app/services/emailService.ts` | saveMailLog helper, OTP loglanıyor (adminDb import) |
| `src/app/dashboard/grading/page.tsx` | scoreLogs write (batch sonrası), addDoc import, useUser eklendi |
| `src/app/dashboard/logs/page.tsx` | Logs sayfası — Mail Logs + Puan Logları sekmeleri, checkbox, toplu sil (yeni dosya) |
| `src/app/components/layout/SubNavigation.tsx` | "Yedekleme" rename, "Logs" sekmesi Link olarak eklendi |
| `src/app/components/layout/Sidebar.tsx` | Logs linki kaldırıldı (yönetim paneli altına taşındı) |
| `src/app/globals.css` | .logs-table, .logs-badge-*, .logs-delete-btn stilleri eklendi |

---

## Mimari Notlar

- `gradedTasks[taskId]` → `{ xp, penalty, seasonId, classId, endDate, maxXp }` — task silinse bile veri korunur; `maxXp` sayesinde odevPuani oranı recover edilebilir
- `isCancelled: true` — iptal edilen task'lar cert ve student modal'dan dışlanır
- `groupModule` — task verilirken grubun modülü (GRAFIK_1/2) task doc'a yazılır, cert filtresinde tek kriter; `module` (şablon) alanına bakılmaz — eski görevlerde yanlış değer verir
- Arşiv çoklu oturum: her `handleArchive` çağrısı yeni `addDoc` oluşturur; archive page `taskId`'ye göre client-side merge yapar
- `xpMultiplier` — G2 şablonu G1 grubuna gidince 0.5, aksi null; maxXP hesabına da uygulanır
- Transfer: grup değişince `gradedTasks: deleteField()` çalışır
- Sertifikasyon öğrenci listesi: finalize edilmemişse `onSnapshot`, edilmişse projectGrades'den frozen list
- `projectGrades` ID formatı: `{studentId}_{groupId}_{module}`
- Öğrenci kartı lig puanı toplam: sağ üstteki `student.score` = sadece mevcut sınıf; sol alt Toplam = `g1Stats.score + g2Stats.score`
- **TEK KAYNAK PUAN:** `calcStudentFinalScore` (`src/app/lib/scoring.ts`) — tüm lig/widget/modal buradan hesaplar. `calcScore` sadece modül bazlı (cert/odevPuani) alt hesaplarda kullanılır.
- **Puan formülü:** `newScore = (averageXP × bonus) × completionRate + progressBonus` → `finalScore = (newScore + carryOverScore) × (1 - penaltyRate)`; `carryOverScore` = `g2StartXP` (student doc), sadece final'a eklenir, XP hesabına girmez.
- **Debug:** `NODE_ENV=development` ortamında her hesapta console'a `{newXP, carryOverScore, adjustedXP, averageXP, bonus, completionRate, newScore, finalScore}` basılır.
- Öğrenci kartı başlık "Lig Puanı" = `computedScore` (calcStudentFinalScore ile — lig tablosuyla aynı); sol alt "Toplam" = `g1Stats.score + g2Stats.score` (modül bazlı bilgi kutuları, doğal olarak farklı — toplam != finalScore)
- Kitap PDF: `bookId` alanı kapak numarası olarak büyük puntoda gösterilir; gramaj `useMemo` + `student.id` bağımlılığıyla öğrenci başına sabit
- `allGroupDone` = `groupStudentCount > 0 && bookDraws.length >= groupStudentCount`; bu durumda erken tamamla UI'ı gizlenir ve task `status: "completed"` otomatik yazılır
- Tarih kısıtı: `min={today}` — tarayıcı native disabled render'ı kullanır, ek validasyon gerekmez
- Kitap carousel: `BookCarousel` offset-tabanlı animasyon kullanır; `toCoverBooks()` ile `BookItem` → `CoverBook` (palette ataması); `viewportRef + ResizeObserver` ile responsive merkez
- **rem ≠ px uyarısı:** `globals.css` root font-size `13.25px * scale-factor` — Tailwind rem spacing'i standart 16px değil ~13.25px bazlı üretir; piksel hassasiyeti gereken layout'ta inline `style={{ ...px }}` kullan
- Brevo: `xsmtpsib-` = SMTP credentials (nodemailer için), `xkeysib-` = REST API key (`/v3/smtp/email` için); `email.ts` REST API kullandığı için `BREVO_API_KEY=xkeysib-...` olmalı
- Cron deadline reminder: `tasks.endDate` YYYY-MM-DD string; cron her çalışmada güncel değeri okur — eğitmen tarihi değiştirse de sistem otomatik adapte olur; `reminderSentDates[]` duplicate önler; aktif etmek için `vercel.json` + `CRON_SECRET` env var gerekli
- Logs sistemi: `mailLogs` ve `scoreLogs` Firestore koleksiyonları — server-side `adminDb` ile yazılır, client-side silinemez; emailService sadece API route'lardan import edilir (firebase-admin güvenli)

---

## 27. Kullanıcı Yönetimi — Kullanıcılar / Öğrenciler Tab Ayrımı (2026-05-06)

**Sorun:**
- `UserManagement` sayfasında admin, eğitmen ve öğrenciler tek listede karışık görünüyordu
- Öğrenci düzenlenince `UserForm` açılıyor ancak rol listesinde `student` seçeneği yoktu
- Mezun (passive) öğrenciler de aktif listede gözükuyordu

**Çözüm:**
- Sayfaya yatay tab bar eklendi: **Kullanıcılar** (admin/instructor) + **Öğrenciler** (students koleksiyonu)
- `users` koleksiyonundan `roles.includes('student')` olanlar Kullanıcılar tabından filtrelendi
- `students` koleksiyonu ayrıca dinleniyor; mezun/passive öğrenciler listelenmez
- Öğrenciler için ayrı `StudentQuickEditModal` — rol alanı "Öğrenci" olarak sabit gösterilir, değiştirilemez
- Freeze mekanizması: `status: 'passive'` yerine `isFrozen: boolean` field'ı — aktif öğrenciyi silmeden dondurur; Durum kolonu "Aktif / Dondurulmuş" gösterir
- `isActivated` badge kaldırıldı — bu field `users` koleksiyonunda, `students` koleksiyonunda yok

**Mezun filtresi mantığı:**
- `status === 'passive'` → eski akışla manuel passive yapılan (mezun kabul) → listede yok
- `graduatedBy` field doluysa → graduation sayfasından mezun → listede yok
- `groupCode.startsWith('Mezun')` → graduation sayfası groupCode formatı → listede yok
- `isFrozen: true` → admin tarafından dondurulan aktif öğrenci → listede **var**, kırmızı badge

**Yeni dosyalar:**
- `src/app/components/dashboard/user-management/StudentUserTable.tsx` — öğrenci tablosu (avatar, rol badge, şube, sınıf, e-posta, durum+toggle, işlem)
- `src/app/components/dashboard/user-management/StudentQuickEditModal.tsx` — öğrenci düzenleme modalı

**Güncellenen dosyalar:**
- `src/app/components/dashboard/user-management/UserManagement.tsx` — tab state, students listener, handleStudentToggle (isFrozen), handleStudentEditClick, delete handler ayrımı (isStudent flag)

**Veri modeli notu:**
- Freeze: `students/{id}.isFrozen: boolean` — öğrenci portalında giriş engellemek için portal tarafında da kontrol edilmesi gerekir
- Mezun akışı: graduation sayfası → `status: "passive"` + `graduatedBy: uid` + `groupCode: "Mezun (...)"` set eder
- Eski mezunlar: sadece `status: "passive"` var, `graduatedBy` yok — `status !== 'passive'` filtresi ile yakalanır
- scoreLogs write noktası: `grading/page.tsx` `handleSaveGrades()` içinde `batch.commit()` sonrası — hata olsa bile grading işlemi etkilenmez (try/catch ayrı)
- Sertifikasyon layout: `max-w-250` (~1000px) → `max-w-[1920px]` — 3 yerde değişti (GradingTabs, CertificationPanel, GradingRouter sekme başlığı)

---

## Puanlama Algoritması Güncellemesi + G1→G2 Carry-Over (2026-04-11)

### 27. Yeni calcScore Formülü

**Değişiklik:** `calcScore` formülü tamamen yenilendi.

**Yeni formül:**
```
adjustedXP     = totalXP + completedTasks * 3
averageXP      = adjustedXP / max(completedTasks, minTaskDivisor)
bonus          = 1 + log2(max(completedTasks, 1)) * bonusMultiplier
completionRate = assigned > 0 ? 0.55 + 0.45 * (completedTasks / assigned) : 1.0
progressBonus  = completedTasks * 2.5
score          = (averageXP * bonus) * completionRate + progressBonus
```

**Parametreler:**
- `bonusMultiplier`: `DEFAULT_SCORING`'de 1.0 → **0.85**; Firestore `settings/scoring` override'ı da 0.85'e güncellendi
- `minTaskDivisor`: 3 (sabit)
- `totalAssignedTasks`: gruba atanmış toplam görev sayısı — `tasksMap`'ten `classId === student.groupCode` filtresiyle hesaplanır; geçilmezse `completionRate = 1.0`

**Düzeltmeler:**
- `src/app/lib/scoring.ts` — `calcScore` 4. parametre `totalAssignedTasks?` eklendi
- `src/app/dashboard/league/page.tsx` — `totalAssignedTasks` hesaplanıp `calcScore`'a geçiliyor
- `src/app/league/page.tsx` (öğrenci portalı) — aynı şekilde güncellendi
- `src/app/components/dashboard/scoring/LeaderboardWidget.tsx` — `tasksMap` yüklendi, `totalAssignedTasks` hesaplanıp geçildi

---

### 28. G1→G2 Carry-Over Sistemi

**Kural:** Grafik-1 grubu arşivlenince her öğrencinin G1 skoru `%10`'u `g2StartXP` olarak Firestore'a yazılır. Grafik-2'de lig puanı = G2 skoru + `g2StartXP`.

**Tetikleme noktaları:**
1. **Arşivleme** (`useManagement.ts` `handleArchive` — `modalConfig.type === 'archive'`): grup arşivlenirken her öğrenci için hesap yapılır, `g2StartXP` + `isCarryOverApplied: true` yazılır
2. **Transfer** (`handleAddStudent`): öğrenci eski gruptan yeni gruba taşınırken `isCarryOverApplied` yoksa ve modüller G1→G2 ise aynı hesap yapılır (arşivde zaten uygulanmışsa atlanır)

**Veri yapısı:**
- `students/{id}.g2StartXP` — taşınan puan (tam sayı)
- `students/{id}.isCarryOverApplied` — boolean, tekrarlı uygulamayı önler

**Düzeltmeler:**
- `src/app/hooks/useManagement.ts` — arşiv ve transfer akışlarına carry-over hesabı eklendi
- `gradedTasks` `classId` filtresi: `classId === groupCode` — "Grup 296" formatında eşleşiyor

---

### 29. Carry-Over Düzeltme Sayfası (Geçici)

**Amaç:** Grup 296 (G1) arşivlenip 541 (G2)'e geçildiğinde herkes 0 puan gördü — carry-over sistemi henüz yoktu.

**Sayfa:** `/dashboard/fix-carryover`
- Tüm aktif öğrenciler sorgulanır
- Her öğrencinin G1 gradedTasks'ı `classId === "Grup 296"` ile filtrelenir
- `g2StartXP = floor(calcScore(xp, tasks) * 0.10)` hesaplanıp yazılır
- `forceMode` (varsayılan: true) — `isCarryOverApplied` olanlara da uygular
- Eski/yeni carry-over ve fark tablosu gösterir

**Kök neden:** `classId` değeri "296" değil **"Grup 296"** formatında saklanıyor — sabit buna göre düzeltildi.

---

### 30. LeaderboardWidget Ana Sayfa Düzeltmesi

**Sorun:** Ana sayfadaki widget lig tablosuyla farklı puanlar gösteriyordu.

**Kök nedenler:**
1. Varsayılan `viewMode` `'Sınıflarım'` idi — sadece eğitmenin grupları listeleniyordu
2. `gradedTasks` tüm grupların görevlerini topluyordu, sadece mevcut grubunki değil
3. `g2StartXP` bonus eklenmiyordu
4. `totalAssignedTasks` geçilmiyordu → `completionRate = 1.0` → şişmiş puan

**Düzeltmeler:**
- `src/app/dashboard/page.tsx` — varsayılan `viewMode`: `'Sınıflarım'` → **`'Tümü'`**
- `src/app/components/dashboard/scoring/LeaderboardWidget.tsx`:
  - `tasksMap` state + Firestore yükleme useEffect eklendi
  - `gradedTasks` → `classId === data.groupCode` ile filtrelendi
  - `g2StartXP` bonus olarak eklendi
  - `totalAssignedTasks` hesaplanıp `calcScore`'a 4. parametre olarak geçildi
  - `tasksMap` dependency array'e eklendi

---

### 31. Lig Tablosu — Bonus XP Gösterimi

**Değişiklik:** XP sütununda G2 öğrencileri için carry-over bonus ayrı satırda gösterilir.

**Görünüm:**
```
1.050 XP
(+60 bonus)   ← 12px, italic, text-text-tertiary
```

**Düzeltme:**
- `src/app/dashboard/league/page.tsx` — XP cell'i `flex-col` div'e alındı; `g2Bonus > 0` ise `(+{g2Bonus} bonus)` alt satır eklendi

---

### 32. Lig Tablosu — Sıralama Mantığı Düzeltmesi

**Sorun:** Aynı puanlı öğrenciler (özellikle 0 puanlılar) herkes aynı sıra numarasını alıyordu (ör. hepsi 18.).

**Yeni kural:**
- **1–3. sıra:** Aynı puan = aynı sıra numarası (1,1,2,3 veya 1,2,2,3 olabilir)
- **4. sıra ve sonrası:** Benzersiz sıra — tiebreaker: ① ceza puanı ↑ ② tamamlanan görev ↓ ③ alfabetik

**Düzeltme:**
- `src/app/dashboard/league/page.tsx` `denseRank` fonksiyonu:
  - `prevRank <= 3 && sameScore` → aynı sıra
  - Aksi hâlde her öğrenci benzersiz sıra alır
  - `sortFn` zaten ceza → görev → alfabetik sıralıyor; `denseRank` sadece numara ataması yapıyor

---

## Etkilenen Dosyalar (2026-04-11 Güncellemesi)

| Dosya | Konu |
|---|---|
| `src/app/lib/scoring.ts` | Yeni `calcScore` formülü, `totalAssignedTasks` parametresi, `bonusMultiplier` 0.85 |
| `src/app/hooks/useManagement.ts` | Arşiv + transfer carry-over hesabı, `g2StartXP`, `isCarryOverApplied` |
| `src/app/dashboard/fix-carryover/page.tsx` | Geçici düzeltme sayfası (tek seferlik) |
| `src/app/dashboard/league/page.tsx` | `totalAssignedTasks`, `g2Bonus`, bonus gösterimi, `denseRank` düzeltmesi |
| `src/app/league/page.tsx` | `totalAssignedTasks`, `g2Bonus` (öğrenci portalı) |
| `src/app/dashboard/page.tsx` | Varsayılan `viewMode` → `'Tümü'` |
| `src/app/components/dashboard/scoring/LeaderboardWidget.tsx` | `tasksMap`, `gradedTasks` filtresi, `g2Bonus`, `totalAssignedTasks` |

---

## Mimari Notlar (Ek — 2026-04-11)

- `calcScore` 4. parametre `totalAssignedTasks`: geçilmezse `completionRate = 1.0` (geriye dönük uyumlu); lig ve widget'ta her zaman geçilmeli
- `g2StartXP`: Firestore'da saklı carry-over — lig puanına doğrudan eklenir, görev sayısına bölünmez
- `isCarryOverApplied: true` — tekrarlı uygulamayı önler; arşivleme öncelikli, transfer fallback
- `classId` formatı: "Grup 296" (kod değil tam string) — `gradedTasks` filtresi ve fix sayfası buna göre
- `denseRank`: ilk 3 sıra score eşitliğinde tie'a izin verir; 4.+ sıra her öğrenci benzersiz sıra alır
- Carry-over oranı: `%10` — G1 final skoru üzerinden `Math.floor`

---

## 2026-04-03 (v8)

### 27. Öğrenci Lig Sayfası — Şube Filtresi Düzeltmesi

**Sorun:** `src/app/league/page.tsx`'te şube filtresi `?branch=` URL parametresine bağlıydı. Parametre yoksa dropdown gösterilmiyor, yerine statik "Tüm Şubeler" badge'i çıkıyordu — tıklanamaz, değiştirilemez.

**Kök neden:** `FilterDropdown` yalnızca `branchParam` doluyken render ediliyordu (`{branchParam ? <FilterDropdown> : <span>Tüm Şubeler</span>}`). Öğrenciler URL'e `?branch=` eklemeden sayfayı açınca filtreyi hiç kullanamıyordu.

**Düzeltmeler:**
- `FilterScope` tipi ve `filterScope` state kaldırıldı → `selectedBranch: string` state'i eklendi (başlangıç: `branchParam` varsa o değer, yoksa `""`)
- `branches` dizisi `rawStudents` verisinden `useMemo` ile dinamik hesaplanıyor (veritabanındaki gerçek şubeler, sıralı)
- `FilterDropdown` her zaman gösteriliyor — URL parametresinden bağımsız
- Dropdown seçenekleri: "Tüm Şubeler" (`value: ""`) + veriden gelen her şube
- `filtered` hesabı: `selectedBranch` doluysa `s.branch === selectedBranch` filtresi, boşsa tümü
- Header subtitle: `selectedBranch || "Tüm Şubeler"`
- `?branch=Kadıköy` gibi URL parametresi hâlâ çalışıyor (geriye dönük uyumluluk korundu)

**Etkilenen dosya:** `src/app/league/page.tsx`

---

### 28. Aylık Birinci Kutlama Maili

**Endpoint:** `POST /api/monthly-winner` — manuel çağrı, cron yok, auth yok (internal use).

**Mantık:**
- Bir önceki ayın başı/sonu UTC+3 offset ile hesaplanır
- `scoreLogs` → `where("createdAt", ">=", ayBaşı) && < ayBitişi` sorgusu
- `studentId` bazlı `points` toplanır; max puana sahip öğrenci winner
- `students/{winnerId}.email` alanından adres alınır
- `sendMail` ile Brevo REST API üzerinden kutlama maili gönderilir
- e-posta yoksa 200 + mesaj döner (hata vermez)

**Oluşturulan dosya:**
- `src/app/api/monthly-winner/route.ts`
  - Görsel: `/assets/illustrations/monthly-winner/winner-01.webp` (placeholder)
  - Duplicate önlemi yok — endpoint her çağrıda gönderir

---

## 2026-04-03 (v9)

### 29. Grup Arşivleme Mantığı Yeniden Yazıldı — "Grubu Bitir"

**Değişen davranış:**
- **Arşivle:** Öğrenciler `status: passive`, `groupId: "unassigned"`, `groupCode: "Mezun (XYZ)"`, `lastGroupId: <grupId>` olarak güncelleniyor. Grup `status: archived` oluyor.
- **Geri Yükle:** `lastGroupId` ile mezun öğrenciler bulunup gruba geri alınıyor. `groupId` ve `groupCode` restore ediliyor, `lastGroupId` `deleteField()` ile temizleniyor.
- **Toplu Silme (arşivden):** Artık öğrencilere dokunulmuyor — archive adımında zaten mezun listesine geçtiler. Sadece grup doc'u siliniyor.

**Yeni alan:** `Student` interface'e `lastGroupId?: string` eklendi (hangi gruptan mezun olduğu takibi).

**UI değişiklikleri:**
- `GroupCards.tsx` — buton title: "Arşive Gönder" → "Grubu Bitir"
- `ConfirmModals.tsx` — archive modalı: başlık "Grubu Arşivle" → "Grubu Bitir", açıklama mezun listesini belirtiyor; restore modalı: açıklama öğrencilerin gruba geri döneceğini belirtiyor

**Etkilenen dosyalar:**
- `src/app/hooks/useManagement.ts`
- `src/app/components/dashboard/class-management/GroupCards.tsx`
- `src/app/components/dashboard/management-components/ConfirmModals.tsx`

---

### 30. Mail Log — `name` ve `groupCode` Alanları Eklendi

**Değişiklikler:**
- `POST /api/welcome` artık body'den `groupCode` alıyor ve `mailLogs` doc'una yazıyor.
- `POST /api/admin/send-welcome-all`: filtre `welcomeEmailSent != true` → `status == active` + code-level `if (welcomeEmailSent === true) skip` şeklinde değişti; her gönderim için `mailLogs` kaydı yazılıyor (`name`, `groupCode`, `type`, `status`, `messageId`, `error`, `createdAt`).
- Yeni öğrenci ekleme akışında (`useManagement.ts`) hoş geldin mail isteğine `groupCode` parametresi eklendi.

**Etkilenen dosyalar:**
- `src/app/api/admin/send-welcome-all/route.ts`
- `src/app/api/welcome/route.ts`
- `src/app/hooks/useManagement.ts`

---

### 31. Mail Logs Sayfası — Tarihli Gruplama + Toplu Silme

**Yeni davranışlar:**
- Loglar **tarihe göre gruplandı** (accordion, ilk grup otomatik açık). Her grup başlığında kayıt sayısı gösteriliyor.
- **Toplu seçim:** Her satırda checkbox, grup başlığında grup-tümü checkbox'ı (tam/kısmı/boş durumları). Seçili kayıt varsa üstte toolbar çıkıyor.
- **`delete-one` → `delete-many`:** API çağrısı tek endpoint'e taşındı, seçili ID'ler dizi olarak gönderiliyor.
- Tablo kolonları güncellendi: Konu kaldırıldı; **Ad Soyad**, **Grup** ve **Saat** (gün değil, sadece sa:dk) eklendi.
- `MailLog` tipine `name?: string | null` ve `groupCode?: string | null` eklendi.

**CSS (`globals.css` → `logs-table th`):**
- `font-size`: 12px → 14px
- `color`: `#6b7a8d` → `#3d4a5c`
- `text-transform: none`, `letter-spacing: 0` (uppercase + tracking kaldırıldı)

**Etkilenen dosyalar:**
- `src/app/dashboard/logs/page.tsx`
- `src/app/globals.css`

---

### 32. Header — Yerel Avatar Sistemi + UI Düzenlemeleri

**Avatar URL değişikliği:** DiceBear API (`https://api.dicebear.com/...`) → `/avatars/{gender}/{avatarId}.svg` (yerel statik dosyalar). `UserDocument` tipine `avatarId?: number` eklendi.

**Görsel düzeltmeler:**
- Avatar container: `p-0.5` kaldırıldı, `object-cover` → `object-contain`

**Geçici olarak gizlenenler (CRM hazır olunca açılacak):**
- Şube seçici dropdown: `{false && <div>...}` ile gizlendi → `SHOW_BRANCH_SELECTOR = true` yorumuyla işaretlendi
- "flex →" logo linki: `{false && <div>...}` ile gizlendi → `SHOW_FLEX_LOGO = true` yorumuyla işaretlendi

**Etkilenen dosyalar:**
- `src/app/components/layout/Header.tsx`
- `src/app/types/user.ts`

---

### 33. Hoş Geldin Mail Şablonu Güncelleme

**Görsel değişiklikler (`emailService.ts`):**
- Header gradient: mor+turuncu (`#FF5C00 → #7C3AED`) → saf turuncu (`#FF8D28 → #D66500`)
- Font weight 800 → 600; marka adı "tasarım`<opacity>`atölyesi`</opacity>`" → "tasarımatölyesi" (tek düz metin)
- Lig butonu: `align="center"` → `align="left"`, gradient arka plan → `#6F74D8` (indigo tonu)

**Etkilenen dosya:**
- `src/app/services/emailService.ts`

---

### 34. Görev Tamamlama Sonrası DesignParkour Kart Durumu

**Davranış değişikliği:** Not girişinden "Tamamla" butonuna basıldıktan sonra (`isGraded=true`) ödev kartı artık pasif şablon (GhostParkourCard) pozisyonuna döner.

- `TaskParkourCard` içinde `isFullyDone = isCompleted && !!task.isGraded` kontrolü eklendi
- `isFullyDone` ise erken return ile `<GhostParkourCard onActivate={onActivateBorrowed} />` render edilir
- `activeTasks` filtresine `!t.isGraded` eklendi — tamamlanmış görevler slot sayısını etkilemez
- Ghost slot hesabı: `Math.max(0, 3 - activeTasks.length)` — tamamlananlar çıkınca boş slotlar şablonlarla doldurulur
- Ghost şablon seçimi deterministik hash sıralamasıyla rastgele görünür (id charCode % 7)

**Etkilenen dosya:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx`

---

### 35. Puan Formülüne Görev Artış Bonusu

**Yeni formül:**
```
averageXP = totalXP / max(completedTasks, minTaskDivisor)
bonus     = 1 + (log_base(tasks) × bonusMultiplier)
finalScore = averageXP × bonus + completedTasks × 3
```

**Amaç:** Görev sayısı arttıkça puan her zaman en az 3 puan artmalı.

**Düzeltmeler:**
- `src/app/lib/scoring.ts` — `calcScore()` sonuna `+ completedTasks * 3` eklendi
- `src/app/components/dashboard/scoring/ScoringSettingsPanel.tsx` — Formül gösteriminde `+ tasks × 3` satırı eklendi; bonus önizleme tablosu `[1,3,5,10,20]` → `1–10` arası her görev (5×2 grid)

---

### 36. Lig Tabloları — Sıra Numarası Hizalama

**Sorun:** Madalya emojisi ile `#` karakteri farklı genişlikte olduğundan sıra numaraları aynı x konumunda değildi.

**Düzeltme:** Her iki tabloda (gruplar + öğrenciler) madalya/`#` slotuna `w-5 shrink-0 flex justify-center` verilerek sabit genişlik sağlandı.

**Etkilenen dosya:**
- `src/app/dashboard/league/page.tsx`

---

### 37. Seviye Sistemi Yenilendi (4 Seviye → 3 Seviye)

**Değişiklik:** Ödev seviyeleri `Seviye-1/2/3/4` → `Seviye 1/2/3` (tire kaldırıldı, Seviye 4 silindi).

**XP değerleri:** Seviye 1 = 100 XP, Seviye 2 = 200 XP, Seviye 3 = 300 XP.

**Geriye dönük uyumluluk:** `LEVEL_KEY_MAP` hem `"Seviye 1"` hem `"Seviye-1"` formatını `level1`'e eşler.

**Etkilenen dosyalar:**
- `src/app/lib/scoring.ts` — `LEVEL_KEY_MAP` çift format, `DEFAULT_SCORING.difficultyXP` güncellendi
- `src/app/components/dashboard/assignment/TaskForm.tsx` — `LEVELS` dizisi 3 elemanlı, Seviye 4 kaldırıldı
- `src/app/components/dashboard/scoring/DesignParkour.tsx` — `LEVELS` ve `grid-cols-4 → grid-cols-3`
- `src/app/components/dashboard/scoring/ScoringSettingsPanel.tsx` — Seviye 4 XP inputu kaldırıldı, `grid-cols-3`

---

### 38. G2→G1 Sınıfı Görevi: Seviye Otomatik Düşürme

**Kural:** Grafik-2 şablonu Grafik-1 sınıfına verildiğinde `xpMultiplier` artık kullanılmıyor. Bunun yerine görevin `effectiveLevel = "Seviye 1"` olarak override edilir.

**Grafik-2 sınıfına Grafik-2 şablonu:** Seviyesi neyse o XP verilir, override yok.

**Not:** `xpMultiplier` alanı tamamen deprecated; eski kayıtlar geriye dönük uyumlu çalışır.

**Etkilenen dosyalar:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx` — Ghost activate/reactivate'te `effectiveLevel` override
- `src/app/components/dashboard/assignment/AssignmentLibrary.tsx` — G2→G1 için `effectiveLevel = "Seviye 1"`

---

### 39. Ödev Formu — "Ödev Tipi" Alanı Kaldırıldı (UI'dan)

**Değişiklik:** TaskForm'daki Kolaj/Kitap/Sosyal Medya seçici UI'dan kaldırıldı. `assignmentType` state ve Firestore yazma korundu.

**Neden:** `assignmentType` Kolaj Bahçesi ve Kitap oyun ekranlarının routing'ini belirliyor, şablona özgü ve manuel seçilmemeli.

**Etkilenen dosya:**
- `src/app/components/dashboard/assignment/TaskForm.tsx`

---

### 40. G1→G2 Geçiş Bonusu — Lig Tablosu

**Kural:** Grafik-1'den Grafik-2'ye geçişte öğrencinin G1'de kazandığı toplam XP'nin %30'u `g2StartXP` olarak student doc'a kaydedilir.

**Önemli detaylar:**
- Sadece lig tablosu skoruna etki eder, sertifika puanına etki etmez
- **Net puan** olarak eklenir: `generalScore = calcScore(baseXP, completedTasks) + g2Bonus` (görev sayısına bölünmez)
- `points` (görüntülenen XP) = `baseXP + g2Bonus`

**Transfer hesabı (`useManagement.ts`):**
```js
const g1XP = Object.values(allGradedTasks)
  .filter(e => e?.classId === oldGroup.code)
  .reduce((sum, e) => sum + (e.xp ?? 0), 0);
studentData.g2StartXP = Math.floor(g1XP * 0.3);
```

**Etkilenen dosyalar:**
- `src/app/hooks/useManagement.ts` — transfer anında `g2StartXP` hesaplanıp kaydedilir
- `src/app/dashboard/league/page.tsx` — `generalScore = calcScore(baseXP, ...) + g2Bonus`
- `src/app/league/page.tsx` — aynı fix

---

### 41. Lig Tablosu — Sıralama ve Beraberlik Kuralları

**Sıralama zinciri:**
1. En yüksek skor
2. En az gecikme cezası
3. En fazla tamamlanan görev
4. Alfabetik (Türkçe)

**Beraberlik (competitionRank):** Sadece ilk 3 sıra için geçerli. 4. ve sonrası her zaman sıralı (9. ile aynı puanda olan bir öğrenci 10. olur, 9. olmaz).

**Etkilenen dosyalar:**
- `src/app/dashboard/league/page.tsx`
- `src/app/league/page.tsx`

---

### 42. Not Girişi — XP Reaktif Hesaplama

**Sorun:** Grading formu açılırken eski XP değerlerini gösteriyordu (Firestore settings geç yüklenince stale closure sorunu).

**Düzeltme:** Ayrı bir `useEffect([settings, task])` eklendi; settings veya task her değiştiğinde `submitted` öğrencilerin XP'si `calculateXP(task.level, weeksLate, settings)` ile yeniden hesaplanır.

**Etkilenen dosya:**
- `src/app/dashboard/grading/page.tsx`

---

### 43. recalculateAll — Kayıt Alanı Kaybı Düzeltildi

**Sorun:** `recalculateAll` çalışınca `gradedTasks` entry'lerinde `classId`, `endDate`, `maxXp` alanları siliniyordu.

**Düzeltme:** `{ ...existing, xp, penalty, maxXp: baseXP }` ile spread yapılarak mevcut alanlar korunur.

**Etkilenen dosya:**
- `src/app/context/ScoringContext.tsx`

---

### 44. İstatistik Paneli — Beraberlikte Dönen Avatar

**Değişiklik:** "En Yüksek XP", "En Çok Görev", "En Az Ceza" kartlarında eşit puanlı birden fazla öğrenci varsa her 2.5 saniyede bir sırayla döner (tek avatar, tek isim gösterilir).

**"En Hızlı Yükseliş" düzeltmesi:** `rankChange` artık dinamik hesaplanır: genel skor sıralaması ile son 30 günlük skor sıralaması karşılaştırılır; pozitif fark = yükseliş.

**Etkilenen dosya:**
- `src/app/dashboard/league/page.tsx` — `AnalyticsCell` bileşeni + `analytics` useMemo

---

### 45. Ay Birincisi — Yeni Hesaplama Mantığı

**Önceki sorun:** Tüm zamanlardaki algoritma skoru baz alınıyordu; beraberlikte kura çekiliyordu; tek kazanan seçiliyordu.

**Yeni kurallar:**
- Sadece o aya ait XP hesaplanır (`gradedTasks[taskId].endDate` filtresi)
- G1→G2 ay içi geçişinde her iki gruptaki o ayki puanlar dahil edilir (`classId` filtresi yok)
- `g2StartXP` (geçiş bonusu) **dahil değil**
- **Beraberlik zinciri (aylık bazda):** en fazla XP → en az ceza → en fazla görev sayısı
- Hepsi eşitse tüm öğrenciler kazanır, **hepsine ayrı ayrı** kutlama maili gönderilir

**Etkilenen dosyalar:**
- `src/app/api/cron/monthly-winner/route.ts` — tamamen yeniden yazıldı
- `src/app/api/monthly-winner/route.ts` — tamamen yeniden yazıldı


---

### 46. Sıralama — Dense Ranking (1,1,2)

**Sorun:** Öğrenciler 1,1,3 sıralamasını mantıksız buluyordu.

**Değişiklik:** "Standard competition ranking" (1,1,3) yerine "dense ranking" (1,1,2) uygulandı. Eşit puanlılar aynı sırayı paylaşır, sonraki sıra atlanmaz.

**Etkilenen dosyalar:**
- `src/app/components/dashboard/scoring/LeaderboardWidget.tsx`
- `src/app/dashboard/league/page.tsx` — `denseRank` fonksiyonu (eski `competitionRank`)
- `src/app/league/page.tsx`

---

### 47. Ödev Havuzları — Sayfalama 10'a Düşürüldü

**Değişiklik:** Kolaj ve Kitap havuzu panellerinde `PAGE_SIZE` 15'ten 10'a düşürüldü.

**Etkilenen dosyalar:**
- `src/app/components/dashboard/assignment/pool/CollagePoolPanel.tsx`
- `src/app/components/dashboard/assignment/pool/BookPoolPanel.tsx`

---

### 48. Kolaj Havuzu — Form Kapanma ve Renk Hataları

**Sorun 1:** Form açıkken herhangi bir input'a basınca form kapanıyordu.
**Kök neden:** `fixed inset-0 z-10` overlay div'i input click'i yakalıyordu.
**Düzeltme:** Overlay div tamamen kaldırıldı.

**Sorun 2:** Renk picker açıkken form kapanıyordu.
**Kök neden:** Color picker dismiss click'i overlay'e düşüyordu.
**Düzeltme:** Overlay kaldırıldığında bu sorun da çözüldü.

**Sorun 3:** Eski öğelerin rengi düzenleme formunda siyah görünüyordu.
**Kök neden:** `initial?.color ?? "#e5e7eb"` — `??` operatörü boş string `""` değerini yakalamıyor.
**Düzeltme:** `initial?.color || "#e5e7eb"` olarak değiştirildi.

**Sorun 4:** CSS stacking context — `transform: translateY(0)` yeni stacking context oluşturuyor, overlay'in üzerine render ediliyordu.
**Düzeltme:** `TabContent` animated div'e `position: "relative", zIndex: 20` eklendi.

**Etkilenen dosya:**
- `src/app/components/dashboard/assignment/pool/CollagePoolPanel.tsx`

---

### 49. Sosyal Medya Ödev Havuzu — Tam Yeniden Tasarım

**Önceki durum:** Düz liste, hiyerarşik sektör desteği yoktu, veri düzensizdi.

**Yeni yapı — 4 sekme:**
- **Sektörler:** Hiyerarşik accordion — ana sektör → alt sektörler. Alt sektör chip'e tıklayınca düzenleme input'una taşınır. Başlığa veya kalem ikonuna tıklayınca ana sektör adı düzenlenir. Geri kalan alana tıklayınca accordion açılır/kapanır.
- **Markalar:** Sektör filtresi (dropdown). Her marka tıklanınca transition ile BrandForm açılır. Ortak havuzdan amaç seçimi + özel amaç ekleme.
- **Amaç & Kural:** Ortak Amaç Havuzu yönetimi (ekle/sil) + Ortak Temel Kural textarea.
- **Reklam Ölçüleri:** Tablo görünümü (Boyut | Tür | Platform), inline düzenleme.

**Veri normalizasyonu:** Eski Firestore verisinde `id` alanı yoktu, `purposes` object formatındaydı. Load anında normalize edilir: eksik `id` atanır, `purposes` object → array dönüşümü yapılır, `subSectors: []` default eklenir.

**Etkilenen dosyalar:**
- `src/app/components/dashboard/assignment/pool/SocialMediaPoolPanel.tsx` — tamamen yeniden yazıldı
- `src/app/components/dashboard/assignment/pool/poolTypes.ts` — `SMSector`, `SMBrand`, `SMFormat`, `SocialMediaPool` arayüzleri güncellendi

---

## 2026-04-07 (v13)

### 50. Sosyal Medya Havuzu — Tab Titreme (CLS) Düzeltmesi

**Sorun:** Sektörler/Markalar/Formatlar/Amaç&Kural sekmeleri arasında geçiş yapınca tüm sekme çubuğu sağa-sola kayıyordu.

**Kök neden:** Aktif sekmeye `border border-surface-100` ekleniyor, pasif sekmelerde border yoktu → sekme boyutu 2px değişiyordu → layout kayması.

**Düzeltme:**
- `src/app/components/dashboard/assignment/pool/SocialMediaPoolPanel.tsx`
  - Tüm sekme butonlarına `border` sınıfı sabit eklendi; aktif: `border-surface-100`, pasif: `border-transparent`

---

### 51. Sosyal Medya Havuzu — Amaç & Kural Accordion

**Değişiklikler:**

**a) Ortak Amaç Havuzu listesi accordion'a alındı:**
- Başlık satırı tıklanabilir → `listOpen` state ile toggle
- Amaç sayısı badge olarak başlıkta gösterilir
- Kapalı başlar; içinde "Yeni Amaç Ekle" accordion'u iç içe çalışmaya devam eder

**b) BrandForm — "Ortak Havuzdan Seç" gizli başlar:**
- Başlık satırı tıklanabilir → `poolOpen` state ile toggle
- Liste menüsü (`<select size={N}>`) açılır; seçim yapılıp "Ekle"ye basılınca kapanır

**Etkilenen dosya:**
- `src/app/components/dashboard/assignment/pool/SocialMediaPoolPanel.tsx`
  - `RuleTab` — `listOpen` state + collapsible div
  - `BrandForm` — `poolOpen` state + collapsible div; "Ekle" sonrası `setPoolOpen(false)`

---

### 52. Ödev Arşivi — Tabbed Accordion Yeniden Tasarım

**Önceki durum:** Sol panel (grup listesi) + sağ panel (seçili grubun arşivi) iki sütunlu layout.

**Yeni yapı:** Tek sütun, tam genişlik. Her grup kendi accordion'ı. Lazy-load — gruba ilk tıklandığında Firestore'dan veri çekilir, sonraki açmalarda tekrar sorgu atmaz.

**Davranış:**
- Grup başlığına tıklanınca içerik açılır/kapanır (ChevronDown döner)
- Yüklendikten sonra başlıkta "X ödev" sayısı görünür
- İçinde her ödev ayrı accordion satırı → tıklayınca çekiliş tablosu açılır
- Ödev tipi ikonu: kolaj mavi, kitap yeşil, sosyal medya mor
- Silme butonu her ödev satırında korundu
- Gruplar `code` alanına göre alfabetik sıralanır

**Etkilenen dosya:**
- `src/app/dashboard/archive/page.tsx` — tamamen yeniden yazıldı
  - `GroupAccordion` bileşeni: `loadState: "idle" | "loading" | "done"` ile lazy-load
  - `AssignmentAccordion` bileşeni: ödev detay tablosu
  - Sol sidebar ve iki sütunlu layout kaldırıldı

---

### 53. Sertifikasyon — Tamamlananlar Grubu Accordion

**Sorun:** "Tamamlananlar" sekmesi tüm ödevleri tek düz tabloda gösteriyordu; hangi gruba ait olduğu belli değildi.

**Değişiklik:** Tamamlanan ödevler `task.classId` alanına göre gruplandı. Her grup accordion olarak gösterilir.

**Davranış:**
- Grup başlığına tıklanınca içerik açılır/kapanır
- Başlıkta "X ödev" sayacı ve yeşil badge
- İçinde Ödev/Teslim/Toplam XP kolon başlıkları + mevcut satır fonksiyonları (Detay genişlet, 3-nokta menü → Arşive Gönder) aynen korundu

**Etkilenen dosya:**
- `src/app/dashboard/grading/page.tsx` (`GradingTabs` bileşeni)
  - `openGroups: Set<string>` state + `toggleGroup()` helper
  - `doneGrouped = done.reduce(...)` — `classId` bazlı gruplama
  - `{tab === "done"}` JSX bloğu yeniden yazıldı

---

### 54. DesignParkour — Görev Kartı Sıralama Stabilitesi

**Sorun:** "Ödevi Bitir" tıklandığında kart bir anda ortaya zıplıyordu. Aktivasyon sonrası beklenmedik pozisyon değişimi yaşanıyordu.

**Kök neden:** `sortedActiveTasks` sort fonksiyonu yalnızca durum gruplarına (active/passive/completed) bakıyordu; grup içinde ikincil sıralama anahtarı yoktu. Bir görev "completed" grubuna geçince Firestore doküman sırasına göre rastgele bir yere atıyordu.

**Düzeltme:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx` — `sortedActiveTasks` sort
  - Önce: `Number(aCompleted) - Number(bCompleted)`, sonra `Number(aPassive) - Number(bPassive)` (grup içi ikincil sıralama yok)
  - Sonra: `groupOf()` fonksiyonu (active=0 / passive=1 / completed=2) → `createdAt DESC` ikincil sort
  - Sonuç: Tek aktif görev "Bitir" → yerinde kalır. Başka aktif görev varsa en fazla 1 sıra sağa kayar.

**Kural:** `createdAt` task oluşturulduğunda `serverTimestamp()` ile set edilir, statü değişimlerinde değişmez — dolayısıyla stable sort key olarak kullanılabilir.

---

## [2026-04-09] İterasyon 1 — Google Drive Upload Altyapısı

### Bağlam
Service account (robot mail) ile Google Drive'a dosya yüklemeye çalışıyoruz.
Hedef: Öğrencilerin ödev dosyalarını kendi 200GB kişisel Drive klasörüne kaydetmek.

---

### Yapılanlar

#### 1. `src/app/lib/googledrive.ts` — YENİDEN YAZILDI
- **Service account JWT auth kaldırıldı** → OAuth2 Refresh Token'a geçildi
- `getAccessToken()` artık şu 3 env var'ı kullanıyor:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
- `uploadToDrive(buffer, fileName, mimeType)` → multipart upload, `parents: [folderId]`, `supportsAllDrives=true`
- `validateDriveFile()` + `isDriveError()` korundu

#### 2. `src/app/types/submission.ts` — GÜNCELLENDİ
- `filePath` (Firebase Storage) kaldırıldı
- `driveFileId`, `driveViewLink` eklendi
- `fileUrl` → Drive download linki olarak kullanılıyor

#### 3. `src/app/lib/submissions.ts` — GÜNCELLENDİ
- `docToSubmission()` içinde `filePath` → `driveFileId` + `driveViewLink`

#### 4. `src/app/api/submit/route.ts` — GÜNCELLENDİ
- `uploadSubmission()` (Firebase Storage) → `uploadToDrive()` (Drive)
- Response'a `driveFileId`, `driveViewLink` eklendi

---

### Sorun Geçmişi

| Deneme | Hata | Neden |
|--------|------|-------|
| Service account + parents | `403 storageQuotaExceeded` | Service account'un Drive kotası yok, Google bunu API düzeyinde engelliyor |
| Service account + supportsAllDrives | Aynı hata | Shared Drive olmadan bu parametre işe yaramıyor |
| parents debug log | Doğrulama: kod doğruydu | `parents: ['1o2IX0...']` gidiyordu, sorun mimari |

**Google'ın resmi yanıtı:**
> "Service Accounts do not have storage quota. Leverage shared drives or use OAuth delegation instead."

---

### Mevcut Durum (DEVAM EDİYOR)

OAuth2 Refresh Token yaklaşımı seçildi:
- Shared Drive (Google Workspace) gerektirmiyor
- Firebase Blaze (ücretli) gerektirmiyor
- Kota kişisel hesaptan (200GB) düşer

**Eksik:** `.env.local`'a şu 3 değer henüz eklenmedi:
```
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REFRESH_TOKEN="..."
```

**Token alma adımları (bir kerelik):**
1. Google Cloud Console → `flexos-10ac4` → Credentials → OAuth client ID (Web app)
   - Redirect URI: `https://developers.google.com/oauthplayground`
2. OAuth Playground aç
   - Settings → Use your own OAuth credentials → Client ID + Secret gir
   - Scope: `https://www.googleapis.com/auth/drive`
   - 200GB'lık Google hesabıyla authorize et
   - "Exchange authorization code for tokens" → Refresh token kopyala
3. `.env.local`'a ekle, `npm run dev`, test et

---

### Dosya Durumu

| Dosya | Durum |
|-------|-------|
| `src/app/lib/googledrive.ts` | ✅ OAuth2 refresh token ile hazır |
| `src/app/lib/submissions.ts` | ✅ Drive field'ları ile hazır |
| `src/app/types/submission.ts` | ✅ Drive field'ları ile hazır |
| `src/app/api/submit/route.ts` | ✅ Drive'a bağlı, hazır |
| `.env.local` | ⏳ GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN eksik |

---

## [2026-04-10] İterasyon 2 — Google OAuth Tamamlandı + Upload Route

### OAuth Kurulumu (Tamamlandı)

- Google Cloud Console → `flexos-10ac4` → Credentials → OAuth 2.0 Client ID oluşturuldu
- 200 GB'lık ana Drive hesabına erişim yetkisi alındı
- OAuth Playground üzerinden **sınırsız süreli** `refresh_token` üretildi
- `.env.local`'a 3 env var eklendi:
  ```
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...
  GOOGLE_REFRESH_TOKEN=...
  ```

### Drive Klasörü

- Drive içinde `flex_Depo` klasörü oluşturuldu
- Klasör ID'si `.env.local`'a eklendi:
  ```
  GOOGLE_DRIVE_FOLDER_ID=...
  ```
- Tüm yüklenen dosyalar bu klasöre düşer; "link ile görüntüle" izni otomatik açılır

### Storage Limiti Güncellendi

- `src/app/types/storage.ts` — `MAX_FILE_SIZE_BYTES` → 50 MB (önceki değerden revize edildi)

### Yeni Dosya: `src/app/api/upload/route.ts`

Saf Drive upload endpoint'i — Firestore submission kaydı **oluşturmaz**.

**Ne zaman hangisi kullanılır:**
| Endpoint | Ne yapar |
|----------|----------|
| `POST /api/upload` | Dosyayı Drive'a yükler, `fileId + linkler` döner. Firestore'a yazmaz. |
| `POST /api/submit` | Drive'a yükler + `submissions` koleksiyonuna Firestore kaydı oluşturur. Tam ödev teslim akışı. |

**FormData:**
- `file` (zorunlu) — yüklenecek dosya
- `fileName` (opsiyonel) — Drive'daki adı override et

**Başarılı yanıt:** `{ fileId, webViewLink, downloadUrl, fileName, fileSize, mimeType }`

**HTTP hataları:** 400 (eksik alan) | 413 (50 MB aşıldı) | 422 (izin verilmeyen tür) | 500 (OAuth/Drive hatası)

### Dosya Durumu

| Dosya | Durum |
|-------|-------|
| `src/app/lib/googledrive.ts` | ✅ OAuth2 refresh token — hazır |
| `src/app/types/storage.ts` | ✅ 50 MB limit |
| `src/app/api/upload/route.ts` | ✅ Saf Drive upload (Firestore yok) |
| `src/app/api/submit/route.ts` | ✅ Drive + Firestore submission akışı |
| `.env.local` | ✅ Tüm env var'lar tanımlı |

### Sorun Geçmişi (OAuth Hata Ayıklama)

| Hata | Sebep | Çözüm |
|------|-------|-------|
| `invalid_grant: Bad Request` | Token ortasında `#` vardı, `.env.local` yorum satırı sandı | Değeri çift tırnakla sardık |
| `invalid_grant: Bad Request` (tekrar) | Authorization code (`4/0Aci98E9...`) kopyalanmıştı, refresh token değil | Playground'da "Exchange" sonrası `1//...` ile başlayan refresh token alındı |
| ✅ Başarılı | Doğru refresh token + tırnaklı format | `POST /api/upload` → `fileId + webViewLink + downloadUrl` |

**Not:** `.env.local`'da özel karakter içeren değerleri her zaman çift tırnakla sar. Google refresh token `1//` ile başlar; `4/` ile başlayan authorization code'dur, 5 dakika içinde geçersiz olur.

---

## [2026-04-11] Puan Algoritması + Sınıf Bitiş Carry-Over

### 55. Puan Formülü Yenilendi

**Yeni `calcScore` formülü (`src/app/lib/scoring.ts`):**
```
adjustedXP      = totalXP + completedTasks × 3
averageXP       = adjustedXP / max(completedTasks, 3)
bonus           = 1 + log2(completedTasks) × bonusMultiplier   [default: 0.85]
completionRate  = 0.55 + 0.45 × (completedTasks / totalAssignedTasks)  [varsayılan: 1.0]
progressBonus   = completedTasks × 2.5
score           = (averageXP × bonus) × completionRate + progressBonus
```

**Değişiklikler:**
- `DEFAULT_SCORING.leaderboard.bonusMultiplier`: 1 → **0.85** (Firestore'da da 0.85 olarak kayıt edilmeli)
- `progressBonus`: `tasks × 5` → `tasks × 2.5` — kontrollü artış, sistem şişmez
- `calcScore`'a opsiyonel 4. parametre: `totalAssignedTasks` — verilmezse `completionRate = 1.0`
- `finalScore = generalScore` — artık `calcFinalScore(general, recent)` ağırlıklı ortalama yok
- `calcFinalScore` korundu ama league sayfalarında kullanılmıyor

**Örnek (totalXP=1600, tasks=11, totalAssigned=11):**
```
adjustedXP = 1633 | averageXP = 148.45 | bonus = 3.940 | rate = 1.0 | progress = 27.5
finalScore ≈ 612
```

**Lig sayfaları (`dashboard/league/page.tsx`, `league/page.tsx`):**
- `totalAssignedTasks = Object.values(tasksMap).filter(t => t.classId === s.groupCode).length`
- `calcScore(baseXP, completedTasks, settings, totalAssignedTasks)` olarak çağrılıyor
- `calcFinalScore` import'tan kaldırıldı

---

### 56. Sınıf Bitiş Carry-Over + "Herkes 0" Bug Fix

**Bug:** "Grubu Bitir" → öğrenciler `groupId: "unassigned"` oluyor → G2'ye eklenince `oldGroup` undefined → `g2StartXP` hesaplanmıyor → herkes 0 puan.

**Kök neden:** `handleAddStudent`'ta `oldGroup = groups.find(g => g.id === oldStudent.groupId)` — `groupId === "unassigned"` olunca `oldGroup = undefined`.

**Düzeltme (`src/app/hooks/useManagement.ts`):**

**Archive sırasında carry-over hesabı:**
- Her öğrencinin bu sınıftaki `gradedTasks` (`classId === groupCode`) üzerinden `calcScore` çalıştırılır
- `carryOverScore = Math.floor(calcScore(xp, tasks) * 0.30)`
- Öğrenci doc'una `g2StartXP: carryOverScore`, `isCarryOverApplied: true` yazılır
- Artık XP değil, **skor** taşınıyor (%30 oranı korundu)

**`handleAddStudent` G1→G2 transfer:**
- `isCarryOverApplied === true` ise hesaplama atlanır (double-application engeli)
- False ise (manuel transfer, archive olmadan) eski formül çalışır

**Yeni kurallar:**
- Carry-over sadece "Grubu Bitir" akışında çalışır — manuel transfer + `isCarryOverApplied=false` durumunda da fallback hesaplanır
- `isCarryOverApplied = true` flag — aynı öğrenci için 1 kez uygulanır

**Etkilenen dosyalar:**
| Dosya | Değişiklik |
|-------|-----------|
| `src/app/lib/scoring.ts` | Yeni `calcScore` formülü, `bonusMultiplier` 0.8 |
| `src/app/hooks/useManagement.ts` | Archive carry-over, `isCarryOverApplied` flag |
| `src/app/dashboard/league/page.tsx` | `totalAssignedTasks`, `calcFinalScore` kaldırıldı |
| `src/app/league/page.tsx` | `totalAssignedTasks` eklendi |

**Mimari notlar:**
- `g2StartXP` artık XP değil **skor** bazlıdır — lig sayfalarında doğrudan `generalScore`'a eklenir
- `calcScore(xp, 0) = 0` — gradedTasks yoksa carryOver = 0, güvenli
- `totalAssignedTasks` yoksa `completionRate = 1.0` — mevcut `LeaderboardWidget`, `WorkshopAnalysis`, `StudentDetailModal` etkilenmez

---

## Öğrenci Portalı — Eksik UI (Başlanmadı)

Backend tamamen hazır, frontend sıfır. Aşağıdakiler yazılmadan öğrenci dosya yükleyemez.

### Durum

| Katman | Durum |
|--------|-------|
| `api/upload/route.ts` | ✅ Hazır |
| `api/submit/route.ts` | ✅ Hazır |
| `lib/googledrive.ts` | ✅ Hazır |
| `lib/submissions.ts` | ✅ Hazır |
| `types/submission.ts` | ✅ Hazır |
| `types/storage.ts` | ✅ Hazır |
| Öğrenci portal sayfası | ❌ Yok |
| Ödev listesi UI | ❌ Yok |
| Upload / teslim formu | ❌ Yok |
| Teslim geçmişi UI | ❌ Yok |

### Yazılacaklar

1. **`/ogrenci` (veya `/portal`) route** — öğrencinin giriş yaptıktan sonra düştüğü sayfa
2. **Ödev listesi** — `groupId` üzerinden aktif task'lar çekilir, öğrenciye gösterilir
3. **Upload / teslim formu** — dosya seçme, drag-drop, 50MB uyarısı, progress bar, başarı/hata sonucu
4. **Teslim geçmişi** — `submissions` koleksiyonundan öğrencinin geçmiş teslimlerini listeler

### Açık Sorular (Başlamadan Netleştirilmeli)

- Öğrenci kimliği nasıl doğrulanacak? Firebase Auth mı, yoksa manuel `studentId` mi?
- `/login` sayfası öğrenciler için de geçerli mi, yoksa ayrı giriş ekranı mı?
- Öğrenci hangi ödevleri görecek — sadece `status: active` olan `groupId` eşleşenler mi?

---

## Oturum — 13 Nisan 2026

### Task Lifecycle Düzeltmesi

**Sorun:** Çekiliş (kitap/kolaj) bitince görev `status: "completed"` yazılıyordu. Öğrenciler henüz çalışmaya başlamamıştı.

**Yeni task state makinesi:**

| Durum | Ne zaman | Açıklama |
|-------|----------|----------|
| `draft` / `library` | Oluşturulunca | Henüz verilmemiş |
| `active` | AssignmentLibrary'den atanınca | Otomatik başlar |
| `published` | Çekiliş biter / "Aktife Al" tıklanınca | Öğrenciler çalışıyor |
| `completed` | Öğretmen "Tamamla" der | Notlar girilebilir, mail gitmez |

**Değişen dosyalar:**
- `BookGameScreen.tsx` — çekiliş sonu → `published`, "Tamamla" → `{ status: "completed", archived: true, gradingClosed: true, completedAt }`
- `GameScreen.tsx` (kolaj) — aynı değişiklikler
- `TasksContent.tsx` — `handleActivate` artık `status: "published"` de yazıyor
- `AssignmentScreen.tsx` — grading redirect koşuluna `published` eklendi
- `cron/deadline-reminder/route.ts` — `completed` görevlere hatırlatma maili gönderilmiyor

**Buton metni:** "Arşive Kaydet" → **"Tamamla ve ödevi başlat"**

---

### Puan Sistemi SSOT (Single Source of Truth)

**`calcStudentFinalScore`** tek fonksiyon, tüm ekranlar kullanıyor:

```
adjustedXP  = newXP + tasks × 3
averageXP   = adjustedXP / max(tasks, 3)
bonus       = 1 + log2(tasks) × 0.85
completionRate = 0.55 + 0.45 × (tasks / totalAssigned)
progressBonus  = tasks × 2.5
newScore    = (averageXP × bonus) × completionRate + progressBonus
finalScore  = (newScore + carryOverScore) × (1 − penaltyRate)
```

- `carryOverScore` = `g2StartXP` — sadece finalScore'a girer, XP hesabına girmez
- `totalAssignedTasks`: deadline geçmiş + completed görevler (yeni görev puan düşürmez)
- `completed` görevler deadline'a bakılmaksızın her zaman sayılır

**Güncellenen ekranlar:** `dashboard/league`, `league` (öğrenci), `LeaderboardWidget`, `StudentDetailModal`

---

### totalAssignedTasks Filtresi (Kesin Kural)

```typescript
// Puanlama için:
tasks.filter(t =>
  t.classId === groupCode &&
  (t.status === "active" || t.status === "published" || t.status === "completed" || !t.status) &&
  (t.status === "completed" || (t.endDate ? t.endDate <= todayStr : true))
)

// Görüntüleme için (tabloda X/Y formatı):
tasks.filter(t =>
  t.classId === groupCode &&
  (t.status === "active" || t.status === "published" || t.status === "completed" || !t.status)
)
```

- `endDate` formatı: `"YYYY-MM-DD"` string — lexicographic karşılaştırma doğru çalışır
- `endDate` yoksa (eski görevler) → her zaman sayılır

---

### Lig Tablosu — Görev Sütunu

Tablo artık `completedTasks / totalAssignedDisplay` formatında gösteriyor.

Örnek: 8 görev tamamlandı, 9 atandı → **8/9**

- Görüntüleme: tüm atanmış görevler (deadline bağımsız)
- Puanlama: sadece deadline geçmiş + completed görevler
- `RankedStudent` tipine `totalAssignedDisplay` eklendi

---

### StudentDetailModal — Skor Tutarsızlığı Düzeltmesi

**Sorun:** Modal "Lig Puanı" bölümü `calcScore()` kullanıyordu, `g2StartXP` ve `totalAssigned` dahil değildi.

**Düzeltme:** "Grafik-2" ve "Toplam" satırları artık `computedScore` gösteriyor (lig tablosuyla aynı hesaplama).

---

### Öğrenci Portalı — Mimari Kararlar (13 Nisan 2026)

**Netleşen kararlar:**

| Konu | Karar |
|------|-------|
| Öğrenci auth | Ayrı sistem — admin kullanıcılardan bağımsız |
| Hesap oluşturma | Öğrenci sisteme eklenince otomatik |
| Ödev yükleme | Upload → zaman damgası → görev otomatik "tamamlandı" |
| Not girişi | Ödev yönetimi içine entegre |
| Sertifikasyon | Ana ekranda kalır, bağımsız |

**Sonraki adımlar (sırayla):**
1. Öğrenci login sistemi (Firebase Auth, ayrı kullanıcı tipi)
2. Öğrenci ödev yükleme UI
3. Upload → otomatik görev tamamlama
4. Not girişi entegrasyonu
5. Tam sistem entegrasyonu

**Backend hazır:** `api/submit`, `api/upload`, `lib/googledrive.ts`, `lib/submissions.ts`, type definitions, Firestore/Storage rules — env vars PC'de mevcut.

---

## Oturum — 14 Nisan 2026

### Aylık Lig Puan Sistemi — Komple Yeniden Yazım

---

#### 1. `completedAt` Alanı Eklendi

**Sorun:** Aylık hesaplama için görevin hangi ayda teslim edildiği bilinmiyordu; yalnızca deadline (`endDate`) vardı.

**Düzeltmeler:**
- `src/app/lib/scoring.ts` — `GradedTaskEntry` arayüzüne `completedAt?: string` eklendi
- `src/app/dashboard/grading/page.tsx` — Not kaydedilirken entry'ye `completedAt: new Date().toISOString().split("T")[0]` yazılıyor (2 yer: Firestore batch + in-memory hesaplama)

---

#### 2. Hybrid Aylık Filtreleme Kuralı

**Kural:**
- `completedAt <= endDate` → deadline ayına yaz (zamanında / erken teslim)
- `completedAt > endDate` → teslim ayına yaz (geç teslim)
- `completedAt` yoksa → `endDate` ayı (eski veri fallback)

**Örnek:** Mayıs deadline, Nisan'da not girildi → Mayıs'a yazılır. Nisan deadline, Mayıs'ta girildi → Mayıs'a yazılır.

**Etkilenen dosyalar:** `league/page.tsx`, `dashboard/league/page.tsx`, `api/monthly-winner/route.ts`, `api/cron/monthly-winner/route.ts`

---

#### 3. Birikimli Toplam Skor

**Eski sistem:** `calcStudentFinalScore(tümXP, tümGörev, ..., carryOver)` → tek büyük hesaplama → carryOver formüle giriyordu.

**Yeni sistem:**
```
totalScore = g2Bonus (bir kez, düz toplama)
           + monthlyScore(Ocak)
           + monthlyScore(Şubat)
           + ... (her ay ayrı calcStudentFinalScore)
```

**Sonuç:** Ferhat örneği — aylık 270 + carryOver 60 = toplam 330 (önceden 352 çıkıyordu, 22 fark formülün tüm XP'yi yeniden işlemesinden geliyordu).

**Etkilenen dosyalar:** `league/page.tsx`, `dashboard/league/page.tsx`

---

#### 4. G1/G2 Ayrımı Kaldırıldı (Aylık İçin)

**Değişiklik:** `isScoreHidden` ve `seasonId` filtreleri aylık hesaplamadan kaldırıldı. Reset öncesi ve sonrası aynı ay içindeki tüm görevler tek aylık skorda birleşir.

**Dikkat:** `classId` filtresi korundu — başka sınıfların görevleri karışmıyor, sadece aynı sınıf içinde season/reset ayrımı yapılmıyor.

---

#### 5. `assignedInMonth` Hatası Düzeltildi

**Sorun:** `assignedInMonth` classId filtresi olmadan tüm sistemdeki görevleri sayıyordu → herkes 20-30 assigned görev görüyordu → `completionRate` çöküyordu → Sevil 470 → 339'a düştü.

**Düzeltme:** `assignedInMonth(mStart, mEnd, s.groupCode)` — artık sadece öğrencinin sınıfına ait görevler sayılıyor.

---

#### 6. Default Mod ve Buton Sırası

- Default `scoreMode`: `"total"` → **`"monthly"`**
- Buton sırası: `[Toplam, Aylık]` → **`[Aylık, Toplam]`**
- Aylık modda `(+xxx bonus)` etiketi gizlendi (`showBonus` prop ile)

**Etkilenen dosyalar:** `league/page.tsx`, `dashboard/league/page.tsx`

---

#### 7. Aylık Kazanan Belirleme — Skor Bazlı

**Eski:** Sıralama `monthlyXP` → ceza → görev sayısı
**Yeni:** Sıralama `monthlyScore` (aylık tablo puanı) → ceza → görev sayısı

**Beraberlik kuralı:** `monthlyScore` + `monthlyPenalty` + `monthlyTasks` üçü de eşleşirse → hepsi birinci, hepsine mail gider.

**Etkilenen dosyalar:** `api/monthly-winner/route.ts`, `api/cron/monthly-winner/route.ts`

---

#### 8. Aylık Birinci Önizleme Maili (Yeni Cron)

**Amaç:** Ayın son gününde admin'e (`alparslan.sennturk@gmail.com`) önizleme maili gönderilir. Onay/müdahale yoksa 1. günde sistem otomatik öğrenciye gönderir.

**Yeni dosya:** `src/app/api/cron/monthly-winner-preview/route.ts`
- İlk 5 öğrenci sıralaması (puan, XP, görev, ceza)
- Birinci adayı vurgulu, beraberlik uyarısı var

**`vercel.json`:** `0 6 28-31 * *` scheduleı eklendi — her ay 28–31. günlerde tetiklenir, içeride "yarın 1. gün mü?" kontrolü ile sadece gerçek son günde çalışır.

---

#### Değişen Dosyalar (Özet)

| Dosya | Değişiklik |
|---|---|
| `src/app/lib/scoring.ts` | `GradedTaskEntry`'ye `completedAt` eklendi |
| `src/app/dashboard/grading/page.tsx` | Not kaydında `completedAt` yazılıyor |
| `src/app/league/page.tsx` | Hybrid kural, birikimli toplam, default aylık mod |
| `src/app/dashboard/league/page.tsx` | Aynı + `showBonus` prop, `computeStudentStats` kaldırıldı |
| `src/app/api/monthly-winner/route.ts` | Hybrid kural, `calcStudentFinalScore` ile sıralama |
| `src/app/api/cron/monthly-winner/route.ts` | Aynı |
| `src/app/api/cron/monthly-winner-preview/route.ts` | Yeni — admin önizleme maili |
| `vercel.json` | `monthly-winner-preview` cron eklendi |

---

## Fix 31–99 (2026-04-15 → 2026-04-29)

| # | Tarih | Konu | Dosya |
|---|-------|------|-------|
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
| 58 | 2026-04-25 | Ödev detay sol panel: grup başlığı noktalı renk → düz text-primary, öğrenci ismi text-secondary | `[groupId]/[assignmentId]/page.tsx` |
| 59 | 2026-04-26 | Öğrenci portal MVP: ödev listesi + detay/upload/yorum sayfaları | `student/[studentId]/page.tsx`, `student/[studentId]/[taskId]/page.tsx` |
| 60 | 2026-04-26 | Submit API: note alanı desteği eklendi | `api/submit/route.ts` |
| 61 | 2026-04-26 | Öğrenci dashboard: Classroom tarzı layout — sidebar, template banner, accordion | `student/[studentId]/page.tsx`, `StudentSidebar.tsx` |
| 62 | 2026-04-26 | Ödev yükle sayfası: sidebar eklendi, upload alanı büyütüldü | `student/[studentId]/[taskId]/page.tsx` |
| 63 | 2026-04-26 | Sidebar: Sınıf Ligi widget + /league nav linki | `StudentSidebar.tsx`, `StudentLeagueWidget.tsx` |
| 64 | 2026-04-26 | dev-seed yanıtına studentId + studentPortalUrl eklendi | `api/dev-seed/route.ts` |
| 65 | 2026-04-27 | Firestore rules: users self-read short-circuit | `firestore.rules` |
| 66 | 2026-04-27 | Login redirect: Auth UID → students doc ID (studentDocId via welcome API) | `login/page.tsx`, `api/welcome/route.ts` |
| 67 | 2026-04-27 | students koleksiyonu: `allow read: if isSignedIn()` | `firestore.rules` |
| 68 | 2026-04-27 | /league route koruması: middleware + matcher güncellendi | `middleware.ts` |
| 69 | 2026-04-27 | /league sayfası: StudentSidebar + sidebarReady flash önleme | `league/page.tsx` |
| 70 | 2026-04-27 | StudentSidebar yeniden tasarım: avatar kaldırıldı, Çıkış Yap butonu, aktif nav highlight | `StudentSidebar.tsx` |
| 71 | 2026-04-27 | getStudentTaskSubmission: orderBy kaldırıldı → composite index gerekmez | `lib/submissions.ts` |
| 72 | 2026-04-27 | Firestore indexes deploy (submissions: studentId+taskId+submittedAt) | `firestore.indexes.json` |
| 73 | 2026-04-27 | Google Drive refresh token — OAuth app publish edildi (Testing→Production) | `scripts/refresh-google-token.mjs` |
| 74 | 2026-04-28 | Login sessiz kalma: cookie race condition fix — getIdToken+getDoc paralel | `login/page.tsx` |
| 75 | 2026-04-28 | Banner image git'e eklendi (untracked'dı) | `public/assets/templates/` |
| 76 | 2026-04-28 | Firestore rules: isStudentOwner + isSubmissionOwner helper'ları | `firestore.rules` |
| 77 | 2026-04-28 | Öğrenci yorum gönderme: addDoc'a authorId eklendi | `student/[studentId]/[taskId]/page.tsx` |
| 78 | 2026-04-28 | Öğrenci görev sayfası: undefined daysLate fix, ExternalLink ikonu | `student/[studentId]/[taskId]/page.tsx` |
| 79 | 2026-04-28 | FilePreview: iframe src fix, mimeType tespiti, driveFileId thumbnail | `components/assignment-test/FilePreview.tsx` |
| 80 | 2026-04-28 | Eğitmen ödev detay: inline dosya kartı, tab "Genel" + öğrenci adı | `dashboard/assignment-test/[groupId]/[assignmentId]/page.tsx` |
| 81 | 2026-04-28 | Tamamlananlar sıralaması: submittedAt bazlı (endDate fallback) | `student/[studentId]/page.tsx` |
| 82 | 2026-04-28 | Öğrenci dashboard header: groupCode gösterimi + studentFullName fix | `student/[studentId]/page.tsx` |
| 83 | 2026-04-28 | Google Drive klasör yapısı planı (YAPILACAK → 100'de tamamlandı) | `lib/googledrive.ts` |
| 84 | 2026-04-28 | Resumable upload altyapısı: 4.5 MB Vercel sınırı — chunk upload | `lib/googledrive.ts`, `api/submissions/init-resumable-upload` |
| 85 | 2026-04-29 | Öğrenci upload UI: chunk upload flow, progress bar, upload counter | `student/[studentId]/[taskId]/page.tsx` |
| 86 | 2026-04-29 | Upload CORS fix: Vercel proxy (upload-chunk endpoint) | `api/submissions/upload-chunk/route.ts` |
| 87 | 2026-04-29 | Teslim geri çekme: öğrenci + eğitmen — Drive + Firestore silme | `api/submissions/retract/route.ts` |
| 88 | 2026-04-29 | Desteklenen dosya türleri: ZIP, RAR, PSD, AI, EPS eklendi | `types/storage.ts` |
| 89 | 2026-04-29 | Öğrenci silme fix: authUid sahiplik + dueDate mühür + eğitmen kilidi | `api/submissions/retract/route.ts` |
| 90 | 2026-04-29 | Real-time submissions: eğitmen sayfası onSnapshot | `dashboard/.../[assignmentId]/page.tsx` |
| 91 | 2026-04-29 | permission-denied onError handler: listener sessiz kapanır | `dashboard/.../[assignmentId]/page.tsx` |
| 92 | 2026-04-29 | Real-time submissions öğrenci: eğitmen değişikliklerini anında alır | `student/[studentId]/[taskId]/page.tsx` |
| 93 | 2026-04-29 | Submission öncesi yorum: tasks/{taskId}/threads/{studentId}/comments | `firestore.rules` |
| 94 | 2026-04-29 | Preview sayfası yorum path fix | `[submissionId]/preview/page.tsx` |
| 95 | 2026-04-29 | Mesaj düzenle/sil: hover menüsü + inline edit | `firestore.rules`, tüm comment bileşenleri |
| 96 | 2026-04-29 | Accordion kartlar responsive: sm: breakpoint | `assignment-test/[groupId]/page.tsx` |
| 97 | 2026-04-29 | Chat menüsü dışına tıklayınca kapanma: useRef+mousedown | `[assignmentId]/page.tsx` |
| 98 | 2026-04-29 | Öğrenci yorum sonrası silme engeli kaldırıldı | `api/submissions/retract/route.ts` |
| 99 | 2026-04-29 | DesignParkour süresi dolan ödev: "Ödev Detay" → "Not Ver" | `DesignParkour.tsx` |

# Flex Trainer — Core Development Log

---

## Oturum: 2026-05-15 (1. Bölüm)

### 1. Kategori → Branş → Modül Hiyerarşisi
- `GroupBranchPanel.tsx` tamamen yeniden yazıldı
- 3 sütunlu layout: Kategoriler (200px) | Branşlar (260px) | Modüller (1fr)
- `categories` Firestore koleksiyonu eklendi: `{ id, name, slug, order, isActive }`
- `branches` dökümanlarına `categoryId` alanı eklendi
- `sessionHours` modül düzeyinde zorunlu hale getirildi
- Firestore rules'a `categories` kuralı eklendi ve deploy edildi

### 2. Bildirim Güvenilirliği Düzeltmesi
- **Sorun:** Vercel serverless'ta response sonrası fire-and-forget IIFE çalışmıyor
- **Düzeltme:** `submit/route.ts` ve `complete-upload/route.ts` — bildirim response öncesi `await`
- Admin'e genel bildirim kaldırıldı, sadece ilgili grup eğitmeni bildirim alıyor

### 3. GroupForm — Modal Yeniden Tasarım
- StudentForm ile aynı pattern: ManagementContent'te `translate-y` + CSS transition wrapper
- Transition: `duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]`, aşağıdan yukarı
- Boyut: `max-w-4xl`, renk: `designstudio-secondary-500` (lila #6F74D8)
- Header: `bg-[#10294C]`

### 4. GroupForm — Bug Düzeltmeleri
- **Seans overflow:** Custom dropdown → native `<select>`
- **Modül disabled:** `orderBy` tek başına + client-side `isActive` filter
- **Eğitmen branş filtresi:** `groupDiscipline` seçilince `instructor.branches.includes(discipline)`

---

## Oturum: 2026-05-15 (2. Bölüm) — Yoklama Altyapısı

### 5. AttendancePanel — Alan Adı Düzeltmeleri
- `Group.name` → `Group.code` (Firestore grup adı `code` alanında)
- `Group.branch` → `Group.discipline` (branş ID `discipline` alanında)

### 6. monthlyLessonCount — KALDIRILDI
- Önceki oturumda hatalı eklenmişti. Gerçekte böyle bir kavram yok.
- `useManagement`, `GroupForm`, `ManagementContent`, `AttendancePanel`'den tamamen silindi.
- Firestore'a yazılmıyor. Eski dökümanlar varsa ignore edilir.

### 7. Yoklama — Günlük Aktif/Disabled Sistemi
- **Fikir:** Session label'ından ("Pts - Çar | 19.00 - 21.30") haftanın günleri otomatik parse edilir
- **Fonksiyon:** `parseWeekDays(label)` — Türkçe gün kısaltmalarını tanır
  - `pts/pzt` → 1 (Pazartesi), `sal` → 2, `çar` → 3, `per` → 4, `cum` → 5, `cts` → 6, `paz` → 0
- **AttendancePanel sol listesi:** Bugün dersi olan gruplar aktif, olmayanlar `opacity-40 cursor-not-allowed`
- **Esnek gruplar:** Label'da gün bulunamazsa (özel ders, kurumsal) her gün aktif
- **Planlanan ders sayısı:** O ayda o haftanın günleri kaç kez düşüyor → otomatik hesap
- **Hiçbir DB değişikliği gerekmez** — mevcut gruplar session label'ından okunur

### 8. Ders Saati (sessionHours) — Grup Düzeyinde Manuel Giriş
- **Karar:** Saat parse etmek yanlış — 1 ders saati = 45 dk, standart saatle aynı değil
- GroupForm'da "Ders Saati" input alanı eklendi (Seans yanında, 4 kolonlu grid)
- `groups.sessionHours` olarak Firestore'a kaydediliyor
- **AttendancePanel öncelik sırası:** `group.sessionHours` → `branch.sessionHours` → `DEFAULT_SESSION_HOURS (3)`
- handleSave (create+update), handleEdit, handleCancel, return object güncellendi

### 9. GroupBranchPanel — sessionHours `key` Bug Fix
- Branş değiştirilince `defaultValue` güncellenmiyor sorunu
- Modül paneli "Varsayılan seans" input'una `key={selectedBranchId}` eklendi

---

## Oturum: 2026-05-15 (3. Bölüm) — AttendancePanel UI + Kurs İlerleme

### 10. AttendancePanel UI Düzeltmeleri
- **Padding:** Sol liste ve sağ panel genelinde minimum `px-8`
- **Renkler:** `text-text-placeholder` → `text-text-secondary` (başlıklar ve etiketler)
- **Büyük harf kaldırıldı:** Tüm `uppercase` etiketler title case'e çevrildi
- **İstatistikler:** "Bu Ay Planlanan / Bu Ay Yapılan / Kalan" — alt satırda "X ders günü · Y saat"
- **İlerleme çubuğu:** `h-1` → `h-1.5`, grup kartlarında daha belirgin

### 11. Tatil Yönetimi (GroupBranchPanel)
- "Tatiller & İptaller" sekmesi eklendi (`CalendarOff` ikonu)
- `holidays` Firestore koleksiyonu: `{ name, startDate, endDate (YYYY-MM-DD), createdAt }`
- Tarih aralığı giriş formu: isim + başlangıç + bitiş
- `countWeekdaysInMonth` tatil günlerini otomatik çıkarır
- Firestore rules eklendi ve deploy edildi

### 12. Kurs Toplam/Kalan Saat + Bitiş Tarihi (AttendancePanel)
- **Yeni Firestore alanı:** `groups.totalHours`
  - Standart gruplar: `selectedModuleId`'e karşılık gelen `module.totalHours`
  - Özel/Kurumsal: `customHours` (zaten girilen değer)
  - `useManagement.handleSave` (create + update) güncellendi
- **AttendancePanel Group arayüzü:** `startDate`, `totalHours` alanları eklendi
- **Yeni state:** `totalDoneCount` — seçili grup için tüm zamanlardaki toplam yoklama sayısı (`onSnapshot` ile canlı)
- **Yeni helper:** `calcEstimatedEndDate(startDate, totalSessions, weekDays, holidayDates)` — tatilleri atlayarak tahmini bitiş tarihi hesaplar
- **Kurs ilerleme şeridi** (aylık istatistiklerin altında, sadece veri varsa görünür):
  - Başlangıç tarihi
  - Tahmini bitiş tarihi (startDate + totalSessions hesabından)
  - Toplam kurs saati
  - Yapılan saat (tüm zaman, sadece bu ay değil)
  - Kalan saat
  - İlerleme çubuğu + yüzde

### 13. CalendarPopover — Custom Takvim Bileşeni
- **Yeni dosya:** `src/app/components/dashboard/attendance/CalendarPopover.tsx`
- Native `<input type="date/month">` + `showPicker()` yaklaşımı kaldırıldı
- İki component export:

**`DayCalendarPopover`** — gün seçici (sağ panel tarih başlığı):
- Pazartesi başlangıçlı 7 sütun grid
- Bugün: ring efekti
- Seçili gün: `bg-[#10294C]` koyu mavi
- Tatil günleri: kırmızı tint (`holidayDates: Set<string>` prop alır)
- Hafta sonu: açık mavi
- Gelecek günler disabled
- Alt kısımda "Bugüne git" shortcut
- `maxDate` prop ile üst sınır

**`MonthCalendarPopover`** — ay seçici (sol panel "Mayıs 2026"):
- 3×4 ay grid (Oca–Ara)
- Üstte yıl navigatörü
- Seçili ay: koyu mavi, bu ay: ring efekti, gelecek disabled

**Tetikleyici:** Her iki bileşen de `children` prop alır (trigger olarak `<div>` veya herhangi element)
**Konum:** `top-full left-0 mt-2` absolute popover, click-outside ile kapanır

**AttendancePanel entegrasyonu:**
- Sol panel ay navigatörü: `<MonthCalendarPopover>` ile sarıldı — Calendar ikonu + "Mayıs 2026"
- Sağ panel tarih başlığı: `<DayCalendarPopover>` ile sarıldı — Calendar ikonu + full date string

---

## Kritik Alan Adları (Firestore ↔ Kod)

| Firestore (`groups`) | Anlamı |
|---|---|
| `code` | Görünen ad — "Grup 101" |
| `discipline` | Branş ID (branches koleksiyon key) |
| `branch` | Şube — "Kadıköy" (coğrafi) |
| `session` | Seans label string'i — gün ve saat parse edilir |
| `sessionHours` | Ders saati sayısı (manuel, grup düzeyinde) |
| `startDate` | Başlangıç tarihi (YYYY-MM-DD) |
| `totalHours` | Toplam kurs saati (modülden veya customHours'tan denormalize) |
| `customHours` | Özel/kurumsal grup için manuel toplam saat |
| `moduleId` | Standart grupta seçilen modül ID'si |
| `type` | "standart" / "ozel" / "kurumsal" |
| `instructorId` | Eğitmen Firebase UID |

| Koleksiyon | DocId Formatı | Açıklama |
|---|---|---|
| `design_attendance` | `{groupId}_{YYYY-MM-DD}` | Günlük yoklama kaydı |
| `lesson_exceptions` | `{groupId}_{date}` / `system_{date}` | Ders olmayan günler |

### parseWeekDays — Desteklenen Kısaltmalar
```
pts / pzt / pazartesi  →  1 (Pazartesi)
sal / salı             →  2 (Salı)
çar / car / çarşamba   →  3 (Çarşamba)
per / perşembe         →  4 (Perşembe)
cum / cuma             →  5 (Cuma)
cts / cmt / cumartesi  →  6 (Cumartesi)
paz / pazar            →  0 (Pazar)
```
JS `Date.getDay()` ile eşleşir (0=Pazar).

---

## Dosya Listesi — Yoklama Sistemi

| Dosya | Açıklama |
|---|---|
| `src/app/components/dashboard/attendance/AttendancePanel.tsx` | Ana yoklama paneli |
| `src/app/components/dashboard/attendance/CalendarPopover.tsx` | DayCalendarPopover + MonthCalendarPopover |
| `src/app/components/dashboard/admin/GroupBranchPanel.tsx` | Tatil yönetimi sekmesi dahil |
| `src/app/hooks/useManagement.ts` | lessonHours + totalHours kayıt mantığı |
| `src/app/components/dashboard/class-management/GroupForm.tsx` | Ders Saati inputu |
| `firestore.rules` | holidays + attendance kuralları |

---

## Oturum: 2026-05-16 — AttendancePanel UI + DesignParkour + Grading Bekleyen

### 14. AttendancePanel — Ay Dropdown + Ders Günü X İkonu
- **Sol panel ay navigatörü:** Ok butonları + `MonthCalendarPopover` → native `<select>` dropdown ile değiştirildi
  - Son 24 ay listelenir, gelecek aylar gösterilmez
- **Sol panel grup listesi:** Tüm gruplar `cursor-pointer`; ders olmayan gruplar metin badge yerine küçük kırmızı `<X>` ikon daire ile işaretlendi
- **Sağ panel CalendarPopover:** `weekDays` prop eklendi — sadece dersin olduğu haftanın günleri seçilebilir, diğerleri disabled
  - `CalendarPopover.tsx`'te `DayCalendarProps`'a `weekDays?: number[]` eklendi
  - `isNonLesson = weekDays.length > 0 && !weekDays.includes(dow)` koşuluyla o günler seçilemez

### 15. DesignParkour — Süresi Dolan Kart Düzeltmeleri
- **Sorun 1:** Deadline geçmiş kartlar `opacity-60` ile soluk görünüyordu — kaldırıldı
- **Sorun 2:** "Not Ver" butonu için `animate-ping` pulse animasyonu eklendi (süresi dolan ödevlerde yeşil nokta)
- **Sorun 3:** "Not Ver" butonu `assignment-test` sayfasına yönlendiriyordu — `/dashboard/grading?taskId=${task.id}` olarak düzeltildi

### 16. BranchManagement — UI Modernizasyonu
- Kart kenarlıkları `border-neutral-100` → `border-neutral-200` (daha belirgin)
- Eğitmen sayısı → indigo pill badge (`bg-indigo-50 text-indigo-600`)
- Ders süresi bölümü `border-t` ile ayrıldı, input beyaz arka plan + focus ring
- "Yeni Branş" input `focus:ring-2 focus:ring-orange-400/10`

### 17. Grading — "Bekleyen" (Sertifikasyon) Bölümü Fix
- **Sorun:** Sadece `status === "completed"` sorguluyordu — süresi dolan `active` ödevler yoktu
- **1. deneme (başarısız):** İki `where()` ile composite sorgu — Firestore composite index olmadığında sessizce hata veriyordu (`try/finally`'de `catch` yoktu)
- **Düzeltme:** Tek alan sorgusu: `ownedBy == uid` + `createdBy == uid` paralel, dedup + client-side filtre
  - `status === "completed"` → her zaman dahil
  - `status === "active" | "published"` → sadece `endDate < todayStr` ise dahil
  - `published` statüsü de dahil edildi (kura tamamlandı, not girişi aşaması)
- **`todayStr` UTC → yerel saat:** `toISOString()` UTC döndürür; TR gece 00:01'de hâlâ dünkü tarihi verebilir. `getFullYear/getMonth/getDate()` ile yerel tarih kullanıldı
- **Kural:** `endDate < todayStr` (strict) — deadline günü bitmeden bekleyene düşmez, gece 00:01'den sonra düşer

---

## Oturum: 2026-05-16 (Devam) — Yoklama Mimari Yeniden Yapılanması

### 18. Sidebar — Yoklamalar Accordion
- Önceki: "Yoklamalar" ve "Yoklama Raporu" ayrı bağımsız linkler
- Sonraki: "Yoklamalar" accordion altında 3 alt menü
  - **Yoklama Al** → `/dashboard/attendance` (admin + eğitmen)
  - **Yoklama Detay** → `/dashboard/attendance-report` (admin + eğitmen)
  - **Yoklama Raporu** → `/dashboard/attendance-summary` (sadece admin)
- `TrendingUp` ikonu eklendi, `yoklamaOpen` state eklendi

### 19. Yoklama Raporu (yeni sayfa) — `/dashboard/attendance-summary`
- Admin only erişim
- **Amaç:** Eğitmen ücret hesabına temel oluşturacak aylık ders özeti
- Ay dropdown seçici (son 24 ay)
- 3 özet kart: Toplam Planlanan / Toplam Verilen / Toplam İptal
- Eğitmen tablosu: Ad | Grup | Planlanan (ders+saat) | Verilen (ders+saat) | Kalan | İptal | İlerleme % | Detay
- **Veri yükleme:** users + groups + design_attendance (month) + lesson_exceptions (month) tek seferde toplu yükleme, JS'de aggregation
- **Detay butonu:** `/dashboard/attendance-report?instructorId=xxx&month=yyy`

### 20. Yoklama Detay — `/dashboard/attendance-report` Güncelleme
- `useSearchParams` ile `instructorId` ve `month` query param okunuyor
- Admin + `instructorId`: sadece o eğitmenin grupları gösterilir
- Admin + no `instructorId`: tüm gruplar (mevcut davranış)
- Eğitmen: kendi branch filtresi (mevcut davranış)
- Başlık dinamik: filterInstructorId varsa "Ad — Detay", yoksa "Yoklama Detay"
- Back butonu: filterInstructorId varsa "← Rapor" linki → `/dashboard/attendance-summary`
- Eğitmen özet tablosu (admin bölümü) KALDIRILDI — artık summary sayfasında
- Boş grup durumunda spinner takılmaması için `setLoading(false)` guard eklendi
- `Suspense` wrapper eklendi (useSearchParams zorunluluğu)

---

## Oturum: 2026-05-16 (Devam 2) — UI Düzeltmeleri

### 21. CalendarPopover — Ders Olmayan Günler Tıklanabilir
- `isNonLesson` artık `isDisabled`'a dahil değil — buton disabled değil
- Görsel: `text-surface-300 hover:bg-surface-50` (soluk gri, tıklanabilir)
- Geçmişe dönük yoklama düzenlemesi için (örn. Cumartesi dersi olan grup)

### 22. Yoklama İstatistiklerinde Saat Öne Çıkarıldı
- **AttendancePanel** (Yoklama Al): büyük rakam → `"93 saat"`, küçük yazı → `"(31 gün)"`
  - sessionHours yoksa eski davranışa düşer (sayı + "ders günü")
- **Yoklama Detay** StatCard'lar: `value` = saat, `sub` = "(X ders)"
- **Yoklama Detay** tablo satırları: font `text-[20px]` → `text-[16px]`, saat öne, ders parantez
- **Yoklama Raporu** eğitmen tablosu: saat öne, ders parantez

### 23. Sidebar Accordion Standartlaştırma
- **Sorun:** Accordion başlığı (`bg-white/10`) + ilk aktif sub-item (`bg-white/10`) görsel olarak birleşiyordu
- **Fix:** Accordion trigger butonlarda `bg-white/10 shadow-sm` kaldırıldı — sadece turuncu ikon aktif göstergesi
- **Yoklamalar** ve **Ödev Test** accordionlarına uygulandı, standart haline getirildi

---

---

## Oturum: 2026-05-17 — UI Standardizasyonu & Dropdown Sistemi

### 24. Framer Motion — Tüm Modal Animasyonları Standardize Edildi
- **Form modalleri** (GroupForm, StudentForm, UserForm): `y: 80→0`, `type: "spring", stiffness: 350, damping: 28`
- **Uyarı/onay modalleri** (GlobalConfirmationModal, StudentDeleteModal): `scale: 0.85→1`, `stiffness: 400, damping: 28`
- **StudentDetailModal**: `AnimatePresence + onExitComplete` pattern, `setTimeout` kaldırıldı
- `ManagementContent.tsx`: GroupForm ve StudentForm için `AnimatePresence` wrapper'ları eklendi
- StudentForm çift-modal wrapper bug'ı düzeltildi (ManagementContent içinde ikinci wrapper yoktu)

### 25. UserManagement — "Branşlar" Sekmesi Kaldırıldı
- Branş verisi zaten Group Settings → GroupBranchPanel'de yönetiliyor
- `UserManagement.tsx`'ten `BranchManagement` import ve render kaldırıldı
- Tab state tipi `'users' | 'students' | 'branches'` → `'users' | 'students'`

### 26. UserForm — Yeniden Tasarım
- **Boşluk azaltıldı:** `p-10 gap-10` → `p-8 gap-5`, profil bölümü `pb-12` → `pb-5`
- **Grid yeniden yapılandırıldı:** 4 sütunlu tek grid: Rol | Branş | Ünvan | Şube (coğrafi)
  - İkinci satır: Cinsiyet | Doğum Tarihi
- **Branş alanı:** Rol = Eğitmen seçilince aktif olur, aksi halde `opacity-40 cursor-not-allowed`
- **Ek Yetkiler:** `border border-neutral-100` → `shadow-[inset_0_0_0_1px_...]` (box-shadow, layout etkilemiyor)
- **overflow-y:** `auto` → `scroll` (scrollbar kaymasını engeller)

### 27. Custom Portal Dropdown Sistemi — Tüm Formlara Uygulandı

**Sorun:** `motion.div` (form animasyonu `y: 80→0`) CSS transform uygular. `position: fixed` içindeki child'lar bu transform'ı containing block alır → dropdown yanlış konumda açılır.

**Çözüm:** `createPortal` ile dropdown'ları `document.body`'ye render etmek.

**Pattern:**
```tsx
// Trigger'da pozisyon yakala:
onClick={(e) => {
  const r = (e.currentTarget).getBoundingClientRect();
  setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
  setIsOpen(!isOpen);
}}

// Portal:
{mounted && createPortal(
  <>
    {isOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />}
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed z-[9999] ..."
          style={{ top, left, width, transformOrigin: 'top' }}
          initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -6, scaleY: 0.92 }}
          transition={{ duration: 0.15 }}
        >...</motion.div>
      )}
    </AnimatePresence>
  </>,
  document.body
)}
```

**Uygulanan formlar ve dropdown'lar:**
| Form | Dropdown'lar |
|---|---|
| `UserForm.tsx` | Rol (multi), Branş (multi), Cinsiyet (tek), Şube/coğrafi (tek) |
| `StudentForm.tsx` | Cinsiyet (tek), Şube (tek), Grup Seçimi (tek, max-h-60 scroll) |
| `GroupForm.tsx` | Şube (tek), Branş (tek), Sorumlu Eğitmen (tek), Seans (tek), Modül (tek, disabled state) |

**Ek değişiklikler:**
- `UserManagement.tsx` parent'taki `roleDropdownRef` click-outside handler kaldırıldı (portal kendi overlay'ini yönetiyor)
- Tüm native `<select>` → hidden input + custom trigger div
- Tek seçimli dropdown'lar seçince kapanır; çok seçimliler açık kalır
- `mounted` state ile SSR güvenliği
- Renk standardı: hepsi orange accent (`border-orange-500`, `text-orange-500`, `peer-checked:bg-orange-500`)

### 28. UserTable — Avatar Küçültüldü
- `w-8 h-8 xl:w-10 xl:h-10` → `w-6 h-6 xl:w-8 xl:h-8`

### 29. Figma MCP — `.mcp.json` Güncellendi
- Eski: `node dist/talk_to_figma_mcp/server.js` (local build)
- Yeni: `bunx cursor-talk-to-figma-mcp@latest`
- WebSocket bridge: `node dist/socket.js` (port 3055, ayrı terminal, çalışır durumda)
- Claude Code yeniden başlatılınca MCP aktif olacak

---

---

## Oturum: 2026-05-17 (Devam) — AttendancePanel UI Yeniden Tasarımı

### 30. Sol Panel (Gruplar Listesi) Tam Yeniden Tasarım
- **Layout:** Her grup tam genişlik buton, `border-l-[3px]` sol accent border
- **Aktif grup:** `border-l-designstudio-primary-500 bg-neutral-200`
- **Hover:** `bg-neutral-100`, pasif: `bg-neutral-50`
- **Sol durum noktası:** `w-2 h-2 rounded-full` — bugün ders varsa `bg-status-success-500`, yoksa `bg-surface-300`
- **Progress bar:** `h-2 rounded-full bg-surface-200`, dolum `bg-base-primary-500`, tamamsa `bg-status-success-500`
- **Grup kodu font:** 14px (önceki 16px → daha okunabilir)
- **Sol padding:** 24px (`pl-6`)
- **Gruplar başlık:** `text-[16px] font-bold text-text-primary`
- **"Gruplar" başlık ile ay dropdown arası mesafe:** `pt-4` (16px)
- **Gruplar arası boşluk:** Progress bar altında `pb-3`, üst içerik `pt-3.5 pb-2` — grup bazında 8px ayrım

### 31. İçerik Hizalaması — Header ile Hizalama
- Dış container: `px-8 max-w-[1920px] mx-auto w-full`
- Header'daki "Hoşgeldin Alparslan" yazısıyla soldan hizalı
- Sidebar'a yapışık active border sorunu giderildi (içerik sola 24px kaydırıldı)

### 32. Ders Akışı (Lesson Flow State Machine)
- **`lessonStarted` state:** `false` → "Dersi Başlat" butonu görünür ve aktif
- "Dersi Başlat" tıklayınca `lessonStarted = true`; öğrenci satırı butonları unlock olur
- Öğrenci işaretlenince: **"Kaydet"** (yeni kayıt, `CheckCircle2` ikonu) veya **"Güncelle"** (mevcut kayıt, `RefreshCw` ikonu)
- Kayıt sonrası: **"Ders Devam Ediyor"** (disabled, aynı mavi renk, `Play` ikonu) — "Ders Devam Ediyor" kırmızı/sarı YAPILMADI, kullanıcı talep etti
- Yeni öğrenci gelirse: tekrar "Güncelle" aktif
- **"Dersi Bitir"** butonu: `lessonStarted && isActiveForDate` iken aktif, tıklayınca confirm modal

### 33. "Temizle" Butonu + Firestore Silme
- Tarih başlığının sağında, sadece `filledCount > 0` ise görünür
- Tıklayınca: `entries = {}`, `saved = false`
- Firestore'da kayıt varsa (`existingDoc`): `deleteDoc(design_attendance/{groupId}_{date})` ile siler
- `monthlyDone` sayacını düşürür
- **Race condition fix:** `clearingRef = useRef(false)` — temizleme sırasında `onSnapshot` handler `clearingRef.current` true ise erken return yapar; `finally` bloğunda false'a döner

### 34. Avatar Sistemi
- `Student` interface'e `gender?: "male" | "female"` ve `avatarId?: number` eklendi
- Render önceliği: `avatarId + gender` → `/avatars/{gender}/{avatarId}.svg`
- Yoksa: `photoURL`
- Yoksa: baş harfli renkli daire (`AVATAR_COLORS` dizisi)
- Boyut: `w-6 h-6 rounded-full`

### 35. Alt Bar (Bottom Bar) — Stats + Butonlar
- **Sol taraf (yatay, inline):** Yüz yüze · Online · Toplam katılan · Katılmayan
  - Rakamlar `font-bold`, label rengi `text-text-primary` (önceki çok açık `text-text-placeholder` düzeltildi)
- **Sağ taraf:** Dersi Başlat / Ders Devam Ediyor / Kaydet / Güncelle + Dersi Bitir

### 36. Sınıf Geneli Bar
- Öğrenci listesi üstünde, `lessonStarted` false iken tıklanırsa **hint toast** çıkar
- Toast mesajı: "Önce Dersi Başlat butonuna tıklayın" — 2.2 sn sonra kaybolur
- "Dersi Başlat" tıklanınca tüm öğrenciler otomatik yeşil YAPILMADI (UX kötü, 10 öğrenciden 1 gelebilir)

### 37. Kur Bitiş Tarihi Açıklaması (calcEstimatedEndDate)
- **Kod doğru:** Satır 131 — `weekDays.includes(d.getDay()) && !holidayDates.has(key)`
- Sadece ders günüyse VE tatilse atlar; hafta içi tatiller Cts+Pazar grubu için yok sayılır
- **541 grubu (Cts+Pazar, 3 saat, 96 saat = 32 seans):** Ramazan Bayramı'nın Cts+Pazar'a denk gelmesi → +1 hafta → 17 Mayıs
- Sistem doğru hesaplar; Firestore `holidays` koleksiyonundaki veri sorunu

### 38. Bekleyen: Kurs Tamamlandığında Yoklama Engeli
- **Sorun:** `totalDoneCount >= totalSessions` olduğunda hâlâ yeni yoklama alınabiliyor
- **Önerilen fix:**
  ```ts
  const courseComplete = totalSessions !== null && totalDoneCount >= totalSessions;
  const isActiveForDate = selectedGroup && !isHolidayDate && !courseComplete
    ? (selectedWeekDays.length === 0 ? true : selectedWeekDays.includes(selectedDate.getDay()))
    : false;
  ```
- **Durum:** ❌ Henüz implemente edilmedi

---

## Oturum: 2026-05-18 — AttendancePanel UI Düzeltmeleri & Layout Scroll

### 39. Stat Kartları Yeniden Tasarım (AttendancePanel.tsx)
- **İkon + değer yanyana:** `flex-col` → `flex items-center gap-2` (ikon sol, "18 saat" sağ)
- **İkon şekli:** `rounded-full` → `rounded-[8px]` (dörtgen köşeli)
- **Kartlar üst padding:** `px-6 pt-6 pb-2` — üstten 24px, soldan 24px
- **Chart SVG küçültüldü:** 164px → 130px (`width/height`), merkez metin pozisyonu 84→65
- **Label font büyütüldü:** "Bu Ay Planlanan/Yapılan Toplam Ders" ve "Kalan Toplam Ders" → `text-[14px]`
- **Ay dropdown üst padding:** `pt-6` (24px) — grup kodu ile hizalanması için
- **İstatistik bölümü üst padding:** `pt-6`
- **Yoklama container padding:** `px-8` — üstündeki istatistik alanıyla eşit

### 40. Sayfa Layout → Normal Scroll (attendance/page.tsx + AttendancePanel.tsx)
- **Önceki:** `h-screen overflow-hidden` fixed viewport, iç scrolllar ayrı
- **Sonraki:** `min-h-screen` — tam sayfa scroll, iç scrolllar yok
- `page.tsx`: sidebar `sticky top-0 h-screen`, main wrapper `min-h-screen`
- `AttendancePanel.tsx`: `h-full`, `overflow-hidden`, `overflow-y-auto` kaldırıldı (grup listesi + yoklama listesi + sağ panel)

### 41. ~~Bekleyen Commit~~ — ✅ Tamamlandı
Aşağıdaki 6 dosya sonraki oturumlarda commit edildi (ab114b9, 0f54f9d):
- `src/app/dashboard/grading/page.tsx` — Grafik-2 Bitir → `attendanceClosed: true`
- `src/app/api/league/route.ts` — `attendanceClosed` grupları ligden çıkar
- `src/app/dashboard/league/page.tsx` — `excludedGroupIds` filtresi
- `src/app/components/dashboard/scoring/LeaderboardWidget.tsx` — lig filtresi
- `src/app/dashboard/attendance-report/page.tsx` — endDate cap + StatCard font düzeltmesi
- `src/app/dashboard/attendance-summary/page.tsx` — endDate cap

---

## Oturum: 2026-05-18 (Devam) — Yoklama Akıllı Buton + /attend Sayfası + Detay Mimarisi

### 42. AttendancePanel — `attendanceClosed` Sistemi + Akıllı Tek Buton

**`attendanceClosed` alanı** — iki seviyede kullanılır:
- Grup düzeyinde (`groups.attendanceClosed`): kurs tamamlandı, ligden çıkar (eski)
- Yoklama doc düzeyinde (`design_attendance.attendanceClosed`): ders kapandı (yeni)

**AttendanceDoc interface'e eklendi:**
```ts
attendanceClosed?: boolean;
closedAt?: any;       // Firestore Timestamp — eğitmen Dersi Bitir tıkladığında
autoClosedAt?: any;   // gece 00:01 cron tarafından otomatik kapandığında
```

**Yeni state'ler:**
- `attendanceClosed` — doc'tan okunur, Dersi Bitir ile yazılır
- `closedAt` — `Date` objesi, 3 günlük edit penceresi hesabında kullanılır
- `hasPersistedEntries` — boş "başlatılmış" doc ile gerçek yoklama doc'u ayırt eder

**Akıllı buton state machine:**
```
attendanceClosed=true + canEdit=false → "Kilitlendi" (disabled)
attendanceClosed=true + canEdit=true  → "Güncelle" / "Kaydedildi"
!lessonStarted                        → "Dersi Başlat" (isActiveForDate kontrollü)
lessonStarted + !saved                → "Kaydet" (bg-green-500)
lessonStarted + saved                 → "Dersi Bitir" (bg-orange-500, confirm modal)
```

**`handleStartLesson`** — Dersi Başlat tıklayınca Firestore'a boş doc yazar:
- Refresh/kapanma sonrası `onSnapshot` bu doc'u görür → `lessonStarted = true` restore edilir
- Doc şeması: `{ groupId, date, month, instructorId, sessionHours, entries: {}, lessonStartedAt }`

**`handleCloseLesson`** — Dersi Bitir onaylanınca:
- `{ attendanceClosed: true, closedAt: now }` merge write
- Local state güncellenir, buton "Kaydedildi" moduna girer

**3 günlük edit penceresi:**
```ts
const withinEditWindow = closedAt
  ? (Date.now() - closedAt.getTime()) < 3 * 24 * 60 * 60 * 1000
  : false;
const canEdit = !attendanceClosed || withinEditWindow || isAdmin();
```

**İptal butonu:** `lessonStarted && !hasPersistedEntries` — yanlışlıkla başlatılan dersi geri alır

**monthlyDone sayacı düzeltildi:** Boş doc'lar (sadece `entries: {}`) sayılmaz, sadece gerçek kayıtlar sayılır

**541 grubu fix:** `attendanceClosed` gruplar admin için listeden gizlenmiyordu
```ts
.filter(g => !(g as any).attendanceClosed || isAdmin())
```

### 43. Auto-Close Cron — `/api/cron/auto-close-attendance`

**Yeni dosya:** `src/app/api/cron/auto-close-attendance/route.ts`

- Gece 00:01 TR saatinde (UTC 21:01) çalışır
- Dünün (`trDateString(-1)`) `design_attendance` kayıtlarını tarar
- `!attendanceClosed && entries !== {}` olan dökümanları `{ attendanceClosed: true, autoClosedAt: now }` ile kapatır
- CRON_SECRET header doğrulaması

**`vercel.json`'a eklendi:**
```json
{ "path": "/api/cron/auto-close-attendance", "schedule": "1 21 * * *" }
```

**Not:** Yoklama giriş zaman kilidi (ders öncesi 15dk, ders sonrası 30dk) planlandı ama test aşaması geçildikten sonra implemente edilecek.

### 44. CalendarPopover — Gelecek Ders Günleri Görünür Ama Tıklanamaz

**Değişiklik:** `weekDays` ile eşleşen gelecek günler artık tamamen gizli değil, soluk görünür.

```ts
const isFuture = maxStr ? dateStr > maxStr : false;
const isFutureLesson = isFuture && weekDays.length > 0 && weekDays.includes(dow);
// Stil:
isFutureLesson → "opacity-50 cursor-not-allowed text-base-primary-500"
diğer gelecek  → "opacity-20 cursor-not-allowed"
```

Eğitmen ileri tarihteki ders günlerini görebilir ama seçemez.

### 45. `/attend` — Sidebar'sız Odaklı Yoklama Sayfası

**Yeni sayfa:** `src/app/attend/page.tsx`

- Dashboard sidebar/header yok — tam ekran yoklama odaklı
- Auth kontrolü: `onAuthStateChanged` + Firestore rol kontrolü
- `AttendancePanel mode="simple" autoSelectToday`
- Mini top bar (52px): sol → geri butonu + logo; sağ → eğitmen isim + avatar
- Layout: `flex flex-col h-screen w-full bg-white overflow-hidden`

**AttendancePanel yeni prop'ları:**
```ts
preSelectedGroupId?: string;  // grup otomatik seçilir (attendance-report detay için)
hideSidebar?: boolean;        // sol grup listesi gizlenir
```

### 46. AttendancePanel — `autoSelectToday` Geliştirildi

**Önceki:** Bugün dersi olan grup bulunmazsa hiç seçilmezdi (orta panel boş).

**Sonrası:** Fallback eklendi — bugün dersi olan yoksa `groups[0]` seçilir:
```ts
const todayMatch = groups.find(g => days.length === 0 || days.includes(todayDay));
setSelectedGroupId((todayMatch ?? groups[0]).id);
```

### 47. AttendancePanel — Sol Liste Yoklama Solukluğu

Bu ay hiç yoklaması girilmemiş gruplar hafifçe soluk gösterilir:
```tsx
${!active && done === 0 ? "opacity-60" : ""}
```
Seçili grup her zaman tam opaklıkta. Aktif dersi olmayan gruplar zaten `bg-surface-300` dot ile ayrışıyor.

### 48. Sidebar — "Yoklama Al" → `/attend`

```tsx
// Önceki:
<SidebarLink href="/dashboard/attendance" label="Yoklama Al" ... />
// Sonrası:
<SidebarLink href="/attend" label="Yoklama Al" ... />
```

`/attend` tam ekran olduğundan sidebar orada görünmez. SidebarLink `exact` prop ile `/attend === pathname` kontrolü yapar.

### 49. Yoklama Detay — Grup Detay Görünümü (`/dashboard/attendance-report`)

**`groupId` URL parametresi eklendi:**

- `?groupId=xxx` varsa → `AttendancePanel preSelectedGroupId={groupId} hideSidebar={true}` gösterilir
- Üstte "← Yoklama Detay" geri butonu
- `?groupId` yoksa → mevcut istatistik tablosu

**Her grup satırına "Detay" butonu eklendi:**
```tsx
<button onClick={() => router.push(`?groupId=${s.group.id}&month=${selectedMonth}`)}>
  Detay
</button>
```

**Geri URL:** `filterInstructorId` varsa onu da korur: `?instructorId=xxx&month=yyy`

---

## Oturum: 2026-05-19 — Dersi Bitir Akışı + Yoklama UX Düzeltmeleri

### 50. Dersi Bitir — Readonly Akış Yeniden Tasarımı

**Modal güncellendi:**
- `/attend` (normal): "Ders yoklaması tamamlanacak. 3 gün boyunca Yoklama Detay ekranından düzenleme yapabilirsiniz." → "Evet, Bitir"
- Yoklama Detay (`allowEdit=true`): "Yoklamayı kaydediyorsunuz. Emin misiniz?" → "Evet, Kaydet"

**Readonly state (attendanceClosed=true):**
- `/attend`: tüm butonlar kilitli, "Kaydedildi" tıklanınca toast → "Düzenleme için Yoklama Detay ekranını kullanın."
- Öğrenci satırları: hover yok, `cursor-default`, tıklanınca toast
- Sınıf Geneli butonları: readonly toast
- Amber "X gün içinde düzenleyebilirsiniz" banner'ı kaldırıldı → sade gri "Bu yoklama kapatıldı — yalnızca görüntüleme modu."

**`allowEdit` prop eklendi (`AttendancePanel`):**
- `/dashboard/attendance-report` → `allowEdit={true}`: 3 günlük pencerede veya admin ise düzenleme açık
- `canEdit = allowEdit && (!attendanceClosed || withinEditWindow || isAdmin())`
- Tüm buton onClick'leri `attendanceClosed && !canEdit` kontrolü kullanır

**"Güncelle" butonu modal açar** (önceden direkt `handleSave` çağırıyordu):
- Modal onay: `attendanceClosed && canEdit` → `handleSave()`, değilse → `handleCloseLesson()`

### 51. handleClear — Düzenleme Modunda Firestore Silme Engeli

**Bug:** Yoklama Detay'da "Temizle"ye basınca `deleteDoc` çağrılıyordu → kayıt kalıcı silindi.

**Fix:** `attendanceClosed=true` iken `handleClear` sadece yerel `entries` state'ini sıfırlar, Firestore'a dokunmaz. Kullanıcı "Güncelle" → onay modal → kaydet akışını izlemeli.

### 52. Geçmiş Tarih Kısıtlaması

**`/attend` sayfası:** `!isToday && !allowEdit` → "Dersi Başlat" yerine "Bu tarih için yoklama kaydı yok" metni gösterilir. Geçmişe yoklama başlatılamaz.

**Yoklama Detay (`allowEdit=true`):** Geçmiş tarihler için "Dersi Başlat" aktif — silinmiş yoklamaları yeniden girebilir.

### 53. Ders Günü / Tatil Overlay Sistemi

**`hasClassThisDay`** türetilmiş değer eklendi (tatil gözetmeksizin):
```ts
const hasClassThisDay = selectedGroup
  ? (selectedWeekDays.length === 0 || selectedWeekDays.includes(selectedDate.getDay()))
  : false;
const isActiveForDate = hasClassThisDay && !isHolidayDate;
```

**`overlayMessage`** mantığı:
- `isHolidayDate && hasClassThisDay && !existingDoc` → "Bugün resmi tatil nedeniyle ders yoktur." (amber banner)
- `!hasClassThisDay && !existingDoc` → "Bu grubun bu gün dersi yoktur." (gri banner)
- Tatil olsa bile o gün dersi olmayan gruplarda tatil mesajı **gösterilmez**

**`showAttendanceUI`:** `isActiveForDate || existingDoc`
- `false` → öğrenci listesi `opacity-40 pointer-events-none` (soluk, arka planda görünür)
- Sınıf Geneli + alt buton alanı gizlenir
- Kayıt varsa (`existingDoc=true`) her zaman tam UI gösterilir

### 54. Yoklama Detay — Son Ders Tarihini Otomatik Seç

`allowEdit=true` + `preSelectedGroupId` değiştiğinde:
- `design_attendance` koleksiyonundan o grubun tüm kayıtları çekilir
- Client-side `sort().reverse()` ile en son tarih bulunur
- `setSelectedDate` + `setSelectedMonth` bu tarihe ayarlanır
- İlk açılışta son ders günü otomatik seçili gelir

### 55. `/attend` Sayfa Layout + Topbar

**Scroll fix:** `h-screen overflow-hidden` → `min-h-screen`, `overflow-hidden` kaldırıldı. Sayfa normal scroll yapar.

**Topbar boyutları:**
- Yükseklik: `52px` → `64px`
- Logo: `text-[15px]` → `text-[22px]`
- Geri butonu: `w-8 h-8 ArrowLeft(16)` → `w-10 h-10 rounded-xl ArrowLeft(20)`
- İçerik `max-w-[1920px] mx-auto` ile kısıtlandı

**Profil hizalaması (2K+ ekran):** Sağ bölüme `max-w-[1400px]` eklendi — AttendancePanel sağ panel genişliğiyle eşleşir, profil içerik alanının sağ kenarıyla hizalı kalır.

---

## Oturum: 2026-05-20 — StudentDetailModal Devam Durumu Kartı

### 56. StudentDetailModal — Devam Durumu Kartı (Gerçek Veri)
- `design_attendance` → `where("groupId", "==", groupId)` sorgusu eklendi
- Fire-and-forget: ana loading chain'ini bloke etmez, paralel çalışır
- **Metrikler:** Katıldığı saat / Devamsızlık saat / Devam oranı %
- Hesap: en az 1 entry girilmiş dökümanlar "gerçekleşmiş ders" sayılır; `entries[studentId].hours > 0` → katıldı
- **AttendanceDonut:** 112px, sayaç animasyonu (0'dan hedefe), renk eşiği > 70 yeşil / 51-70 turuncu / ≤ 50 kırmızı
- Rate = 0 iken arka halka kırmızı gösterilir (boş donut sorunu giderildi)
- Bölüm başlıkları: `text-[11px] text-neutral-500` (önceki `text-[10px] text-surface-400`)

---

## Oturum: 2026-05-21 — Drive Yapısı + Ödev Arşivi + PDF Akışı

### 57. Google Drive Klasör Yapısı Tespiti & Düzeltme

**Sorun:** `assignment/[groupId]/page.tsx` eğitmen ödev dosyasını `["gruplar", grup, eğitmen, ödev]` → "Eğitmen" ara klasörü eksikti, küçük harf "gruplar" Drive'da ayrı klasör açıyordu.

**Düzeltme:**
- `assignment/[groupId]/page.tsx:619` → `["Gruplar", grup, "Eğitmen", eğitmen, ödev]`
- `AssignActivateModal.tsx:116` → `["Ödev Şablonları", eğitmenAdı, taskName]`

**Drive temizliği (script ile):**
- Root'taki `gruplar` (küçük harf) ve `Ödev Dosyaları` klasörleri silindi
- Tüm gruplarda `Alparslan Şentürk` → `Eğitmen/Alparslan Şentürk` altına taşındı (Grup 550 manuel, 598+541 zaten doğruydu)

**Doğru Drive yapısı:**
```
Gruplar/
  {grupKodu}/
    Eğitmen/
      {eğitmenAdı}/
        {ödevAdı}/
          {Ad Soyad}-{ödevAdı}.pdf
    Öğrenciler/
      {öğrenciAdı}/
        {ödevAdı}/
          dosya
Arşiv/
  {grupKodu}/   ← arşivlenen gruplar buraya taşınır
```

**Admin araçları (yeni):**
- `src/app/api/admin/drive-cleanup/route.ts` — yanlış root klasörleri listeler/siler
- `src/app/api/admin/drive-list/route.ts` — Drive klasör ağacını listeler

---

### 58. send-kitap — Drive Upload + Dosya Adı

- **Drive yolu:** `Gruplar/{grup}/Eğitmen/{eğitmen}/{ödevAdı}/`
- **Dosya adı:** `{Ad Soyad}-{Kitap Adı}.pdf` (ör. `Aylin Dümen-Kitap Dünyası.pdf`)
- `groupName`, `instructorName`, `taskName` parametreleri eklendi
- Response'da `driveUrl` + `fileName` döner
- `BookGameScreen` → `useUser()` ile eğitmen adı alınır → başarılı mailden sonra `tasks/{taskId}.kitapDriveFiles.{studentId}: { url, fileName }` Firestore'a yazılır

### 59. send-kolaj — Dosya Adı Standardize

- **Eski:** `kolaj-{Ad Soyad}.pdf`
- **Yeni:** `{Ad Soyad}-{ödevAdı}.pdf` (ör. `Aylin Dümen-Kolaj Bahçesi.pdf`)
- Response'da `driveUrl` + `driveFileName` döner
- `GameScreen` → `tasks/{taskId}.kolajDriveFiles.{studentId}` Firestore'a yazılır

### 60. send-sosyal — Drive Upload + Dosya Adı

- **Drive yolu:** `Gruplar/{grup}/Eğitmen/{eğitmen}/{ödevAdı}/` (kitap ile aynı pattern)
- **Dosya adı:** `{Ad Soyad}-{ödevAdı}.pdf`
- `SocialGameScreen` → `tasks/{taskId}.sosyalDriveFiles.{studentId}` Firestore'a yazılır

### 61. Ödev Arşivi (/dashboard/archive) — Büyük Güncelleme

**Detay butonu:** Her ödev satırında → `/dashboard/assignment/{groupId}?taskId={taskId}` → task otomatik açılır (mevcut `defaultOpenTaskId` mekanizması)

**Per-student PDF sütunu (kitap, kolaj, sosyal-medya):**
- Tablo açılınca `getDoc(db, "tasks", taskId)` → `kitapDriveFiles / kolajDriveFiles / sosyalDriveFiles` okunur
- Her öğrenci satırında sağda "İndir" linki (Drive webViewLink)
- Dosya gönderilmemişse `—`

**Tablo layout:**
- `text-[12px]`, `px-3/px-4 py-2` (kompakt)
- Öğrenci ve PDF sütunları: `pl-8 pr-8` (kenardan 16px içeride)
- Alt padding: `pb-4`
- Container: `max-w-4xl` (büyük ekranda yayılmaz), tablo `overflow-x-auto`

---

## Oturum: 2026-05-21 — Tatil Düzenleme, Modal İyileştirmeleri, Not Ayarları

### 62. GroupBranchPanel — Tatil Düzenleme

- Tatil listesine **Düzenle (Pencil)** butonu eklendi
- Inline edit formu: isim, başlangıç ve bitiş tarihi alanları
- `handleStartEditHoliday(h)` → form state'i doldurur
- `handleUpdateHoliday()` → `updateDoc(holidays/{id})` çağırır
- DayCalendarPopover ile aynı tarih seçici kullanılır

### 63. CalendarPopover — Tatil & Ders Günü Görsel Kuralları

**Ders günleri (mavi):**
- `isLessonDay` → `text-base-primary-500 hover:bg-base-primary-50`
- Bugün + ders günü → ring efekti + mavi font

**Tatil günleri (tüm tatiller):**
- Altında turuncu nokta (`bg-orange-400`) — `isHoliday && !isSelected` koşuluyla, disabled/enabled fark etmeksizin
- Üzeri çizili (`line-through`)
- `isHolidayLesson` (ders var ama tatil) → `text-base-primary-400 line-through hover:bg-base-primary-50`
- Tatil + ders değil → `text-surface-300 line-through hover:bg-surface-50`

**Gelecek ders günleri:** Disabled ama görünür (`opacity-50 cursor-not-allowed text-base-primary-500`)

### 64. StudentForm — isOnlineStudent Toggle

- Katılım Türü alanı eklendi (col-span-2, grid'in altında)
- 2 butonlu seçici: **Yüz Yüze** (Users ikonu) / **Online** (Monitor ikonu)
- Seçili olan turuncu border + turuncu bg (`border-orange-500 bg-orange-50`)
- `isOnlineStudent: boolean` olarak Firestore'a yazılıyor
- `useManagement.handleAddStudent` güncellendi: `passedData?.isOnlineStudent ?? false`

### 65. AttendancePanel — StudentDetailModal Entegrasyonu

- Öğrenci adı `<p>` elemanı tıklanabilir hale getirildi (sınıf butonu değil, sadece ad)
- `onClick` → `setDetailStudent({ id, name, lastName, groupCode... })`
- `e.stopPropagation()` ile üst buton tetiklenmez
- Hover stil: `hover:text-base-primary-600 hover:underline cursor-pointer`
- `StudentDetailModal` panelin sonuna eklendi

### 66. Hover Prefetch — Modal Veri Gecikmesi İyileştirmesi

- `prefetchStudentId` state + 100ms `hoverTimerRef` debounce
- Öğrenci adına 100ms hover → `setPrefetchStudentId(student.id)` → Firestore fetch başlar
- Tıklandığında data zaten yarı yüklü gelir
- `StudentDetailModal`'a `prefetchStudentId` prop eklendi
- `fetchId = student?.id ?? prefetchStudentId ?? null` — hover veya click hangisi önce
- `useEffect([fetchId])` — tek effect, fetchId değişince yeniden çalışır

### 67. StudentDetailModal — Animasyon Senkronizasyonu

**Donut kırmızı flash sorunu:**
- `attRate === null` iken spinner gösterilir, donut render edilmez
- Veri gelince `attRate !== null` → donut anında doğru renkte açılır

**`dataReady` unified sinyal:**
- `const dataReady = !loading && attRate !== null`
- StatBox: `loading={!dataReady}`, değerler `dataReady ? value : "…"`
- XP bar genişliği: `dataReady ? g1Pct : 0` (transition-all duration-700)
- XP metin opaklığı: `dataReady ? "opacity-100" : "opacity-20"`
- GradCard: `loading={!dataReady}` (iki grafik için de)
- Sonuç: donut bittikten sonra diğer animasyonlar sıralı çalışır, karışmaz

### 68. Grading — "Not Ayarları" Sekmesi

**Yeni sekme:** `?section=settings` → `<NotAyarlariPanel />`

**`NotAyarlariPanel` bileşeni:**
- `users/{uid}.certSettings: { [branchId]: { useAssignment, projectWeight, assignmentWeight } }` okunur/yazılır
- Branş seçici (sadece `user.branches.length > 1` ise görünür)
- Toggle: "Ödev etkisini kullan"
  - Kapalı → `finalNote = projectScore × 100%`
  - Açık → stacked bar + slider'lar (Proje / Ödev ağırlığı)
- Toplam göstergesi (1.00 doğrulama)
- "Tüm Branşlara Uygula" butonu
- Default: `{ useAssignment: false, projectWeight: 0.7, assignmentWeight: 0.3 }`

**`CertModuleTab` formül güncellemesi:**
- `certSettings` → `onSnapshot` ile realtime dinlenir (Not Ayarları'nda değişince anında yansır)
- `groups` yüklenmesine `discipline` alanı eklendi
- Türetilen değerler (render scope, handler'lar closure kullanır):
  ```ts
  const _branchSetting = certSettings[selectedGroup?.discipline ?? ""] ?? DEFAULT_CERT_SETTING;
  const projectWeight  = _branchSetting.useAssignment ? _branchSetting.projectWeight : 1.0;
  const maxOdevPuani   = Math.round((...assignmentWeight : 0.0) * 100);
  ```
- `handleSave`, `handleFinalize`, `getOdevPuani`, `getFinalNot` → `0.7` / `30` hardcode kaldırıldı
- Tablo başlığı: `× ${(projectWeight * 100).toFixed(0)}%` ve `/ ${maxOdevPuani || '—'}`

**`ScoringSettingsPanel` temizliği:**
- "Sertifika Ağırlıkları" SettingCard kaldırıldı
- `weightSum`, `weightValid`, `WeightRow` fonksiyonu silindi
- Header badge'den "Proje Ağırlığı" kaldırıldı
- `handleSave` weight doğrulama kontrolü kaldırıldı

---

## Oturum: 2026-05-21 (Devam) — Ders İptal Sebepleri + Yoklama UI

### 69. ExceptionReason Yeniden Tasarım

**Eski sebepler:** `holiday | instructor_sick | no_students | other`
**Yeni sebepler:** `instructor | student | technical | other`

| Sebep | Label | Ders Sayılır | Devamsızlık |
|---|---|---|---|
| `instructor` | Eğitmen Kaynaklı | ❌ | ❌ |
| `student` | Öğrenci Kaynaklı | ✅ | ✅ tüm öğrenciler |
| `technical` | Teknik Sebeple | ❌ | ❌ |
| `other` | Diğer | ❌ | ❌ |

**`LessonException` interface'e eklendi:** `countsAsLesson?: boolean`

**ExceptionModal güncellendi:**
- 4 yeni sebep butonu
- Seçilen sebebe göre altta info badge: "Ders sayılır · Devamsızlık yazılır" veya "Ders sayılmaz · Devamsızlık yazılmaz"

**`handleSaveException` — Öğrenci Kaynaklı özel akışı:**
- `countsAsLesson: true` ile exception kaydedilir
- Tüm öğrenciler `hours: 0` ile `design_attendance` doc'u otomatik oluşturulur (`attendanceClosed: true, createdByException: true`)
- Exception silinirse `createdByException` olan attendance doc'u da silinir

**Raporlar güncellendi (`attendance-report` + `attendance-summary`):**
- `cancelledThisMonth` = sadece `countsAsLesson !== true` exception'lar
- Öğrenci kaynaklı exception'lar `design_attendance` doc olarak sayılır → zaten `doneThisMonth`'a girer

### 70. AttendancePanel — İptal Edilen Ders Görünümü

**İptal edilen ders (countsAsLesson=false) seçilince:**
- Öğrenci listesi, sınıf geneli bar, alt butonlar tamamen gizlenir
- Yerine büyük kırmızı kutu: **"Bugünkü ders iptal edildi — [Sebep]"** + not
- Overlay/disabled buton da gösterilmez

**Öğrenci kaynaklı (countsAsLesson=true) seçilince:**
- Amber info banner: "Öğrenci kaynaklı — ders sayılır, tüm öğrenciler devamsız"
- Öğrenci listesi görünür (readonly, hepsi 0 saat)

### 71. Donut Kartı — "İlerleme" → "İptal Edilen"

- Donut legend'ın 4. hücresi: `% courseProgressPct` → `X ders` (kırmızı)
- `cancelledCountThisMonth` state eklendi: seçili grup + ay için `onSnapshot` ile `lesson_exceptions` (countsAsLesson=false) dinlenir
- İptal > 0 ise kırmızı font, aksi halde gri

### 72. Yoklama Detay Tablo Başlıkları

- `uppercase tracking-wide` → `tracking-normal` (attendance-report/page.tsx)
- Tüm tablo başlıkları normal case

---

## Oturum: 2026-05-21 (Devam 2) — İptal Edilen Ders UI Düzeltmeleri

### 73. AttendancePanel — İptal Edilen Ders Görünümü Yeniden Düzenlendi

**Değişiklikler (§70'in üzerine):**

- **"Yoklama Detay" butonu:** `!exception` koşulu eklendi — ders iptal edilmişse `/attend`'deki orange buton görünmez
- **`attendanceClosed` banner:** `!exception` koşulu eklendi — "Yoklamanızı Yoklama Detay menüsünden düzenleyebilirsiniz" mesajı iptal edilmiş derste gösterilmez
- **İki exception banner → tek banner:** kırmızı + amber ayrımı kaldırıldı; tüm iptal türleri aynı kırmızı kutuyu gösterir
- **İptal/Temizle butonları:** `!(exception && !exception.countsAsLesson)` koşulu eklendi — iptal edilmiş derste header'daki bu butonlar gizlenir
- **Öğrenci listesi:** `exception ? null :` yerine `opacity-60 pointer-events-none select-none` — silik ama görünür
- **Alt buton ("Dersi Başlat"):** exception varken `opacity-60` ile silik ve disabled olarak gösterilir

**Exception banner format:**
```tsx
<span className="text-[13px] xl:text-[14px] font-bold text-red-700">Ders iptal edildi:</span>
<span className="text-[12px] xl:text-[13px] font-normal text-red-500">{exception.note || EXCEPTION_LABELS[exception.reason]}</span>
```
- Not girilmişse notu, girilmemişse sebep etiketini gösterir
- Responsive: küçük ekranda 13px/12px, xl üstünde 14px/13px

---

## Oturum: 2026-05-21 (Devam 3) — Yoklama Raporu Verdi/İptal/Toplam Yeniden Tasarımı

### 73. Yoklama Raporu & Detay — Sütun Mantığı Yeniden Tasarlandı

**Eski mantık:** `cancelledThisMonth` = sadece eğitmen/teknik/diğer; öğrenci kaynaklı Yapılan'a giriyordu → yanlış gösterim

**Yeni sütun yapısı:**

| Sütun | Hesap |
|---|---|
| **Verdi** | `design_attendance` doc'ları — `createdByException: true` hariç (gerçek ders) |
| **İptal** | TÜM exception'lar (eğitmen + öğrenci + teknik + diğer) |
| **Toplam Ders** | Verdi + sadece öğrenci kaynaklı exception (`countsAsLesson=true`) → eğitmen hakkı |

**Mantık:** Öğrenci gelmedi → eğitmen oradaydı → Toplam'a eklenir. Eğitmen iptal → kimse yoktu → Toplam'a eklenMEZ.

**`attendance-report/page.tsx` değişiklikleri:**
- `GroupStats` interface: `actualDoneThisMonth`, `cancelledThisMonth`, `studentCancelledThisMonth`, `toplamThisMonth`
- `actualDoneThisMonth` = `!createdByException` attendance doc'ları
- `cancelledThisMonth` = `exSnap.docs.length` (tümü)
- `studentCancelledThisMonth` = `countsAsLesson === true` exception'lar
- `toplamThisMonth` = `actualDone + studentCancelled`
- Stat kartları: Planlanan | Verdi | İptal | **Toplam Ders**
- İptal stat kartı: `X ders` (altında `Y öğrenci kaynaklı`)
- Tablo İptal sütunu: `X*sessionHours saat` + `(X ders)`
- Altta özet metin dinamik hale getirildi

**`attendance-summary/page.tsx` değişiklikleri:**
- `InstructorRow` interface: `actualDone`, `cancelled`, `cancelledHours`, `studentCancelled`, `toplam`, `actualDoneHours`, `toplamHours`
- Stat kartları 3→4: Toplam Planlanan | Toplam Verilen | İptal (saat) | Toplam Ders (saat)
- Tablo: Verdi | İptal (`cancelledHours` saat) | Toplam Ders
- Alt açıklama satırı: `X saat verdi · Y saat hak etti`

### 74. AttendancePanel — Donut Düzeltmeleri

**İptal donut legend:**
- `countsAsLesson` filtresi kaldırıldı → `snap.docs.filter(d => d.data().month === monthKey).length` (tüm iptaller)
- Composite index sorunu: `groupId + month` sorgusu yerine sadece `groupId` ile sorgu, month JS'de filtrele
- Değer: `cancelledCountThisMonth * sessionHours` **saat** (eski: `X ders`)

**Yapılan Ders donut legend:**
- `totalDoneCount = snap.size` (gerçek + öğrenci kaynaklı `createdByException` doc'lar)
- Diğer iptaller attendance doc oluşturmuyor → otomatik hariç kalıyor

**Merkez metin pozisyonu:** `top: 68` (ince ayar)

### 75. Firestore Indexes

**`firestore.indexes.json`'a eklendi:**
- `lesson_exceptions`: `(groupId ASC, month ASC)`
- `design_attendance`: `(groupId ASC, month ASC)`

**Deploy komutu:** `firebase deploy --only firestore:indexes`

---

---

## Oturum: 2026-05-22 — Güvenlik Sertleştirme + Bug Düzeltmeleri + Ödev Branş Filtresi

### 76. Güvenlik — Korumasız Route'lar Kapatıldı

**Blok A (önceki oturumlarda tamamlandı):** 14 API route'a `verifyRequestToken()` eklendi.

**Bu oturumda eklenen son korumasız route'lar:**
- `src/app/api/admin/send-winner-preview/route.ts` → `verifyRequestToken` + admin-only kontrol
- `src/app/api/monthly-winner/route.ts` → `verifyRequestToken` + admin-only kontrol

**dev-seed production guard:**
- `src/app/api/dev-seed/route.ts` → GET ve DELETE her ikisine `NODE_ENV === "production"` kontrolü eklendi
- Production'da `{ error: "Bu endpoint production'da devre dışıdır." }` + 403 döner

### 77. Rate Limiting — Tüm Hassas Route'lara Eklendi

**Yeni dosya:** `src/app/lib/rate-limit.ts`
- In-memory `Map<key, { count, resetAt }>` — Vercel serverless için per-instance
- `isRateLimited(key, limit, windowMs): boolean`

**Uygulanan route'lar ve limitler:**

| Route | Limit | Pencere | Key |
|---|---|---|---|
| `/api/otp` | 5 istek | 10 dakika | IP |
| `/api/activation/verify` | 10 istek | 15 dakika | IP |
| `/api/resend-activation` | 10 istek | 15 dakika | IP |
| `/api/welcome` | 30 istek | 1 saat | IP |
| `/api/send` | 30 istek | 1 saat | IP |
| `/api/send-kitap` | 20 istek | 1 saat | uid |
| `/api/send-kolaj` | 20 istek | 1 saat | uid |
| `/api/send-sosyal` | 20 istek | 1 saat | uid |
| `/api/delete-user` | 20 istek | 1 saat | IP |

**Not:** Üretim ortamında Vercel birden fazla instance çalıştırabilir → in-memory rate limiting her instance için ayrıdır. Gerçek dağıtık rate limiting için ileride Upstash Redis eklenebilir. Şu an için bu yeterli (+2.0 puan katkı).

### 78. HTTP Güvenlik Başlıkları (CSP + HSTS)

**`next.config.ts` headers() güncellendi:**

```
Content-Security-Policy:
  default-src 'self'
  script-src 'self' 'unsafe-inline' https://vercel.live
  style-src 'self' 'unsafe-inline'
  img-src 'self' data: blob: https://*.googleusercontent.com https://drive.google.com ...
  connect-src 'self' https://*.googleapis.com https://*.firebase.com ...
  frame-src 'self' https://drive.google.com https://accounts.google.com
  worker-src 'self' blob:
  object-src 'none'
  base-uri 'self'
  form-action 'self'

Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Kapsam:** `/` → tüm route'lara uygulanır.

**Güvenlik Skoru Özeti:**
- Blok A tamamlandı (önceki oturumlar): +2.5
- Kalan route'lar + dev-seed: +0.5
- Rate limiting: +2.0
- HTTP headers/CSP/HSTS: +0.3
- **Toplam: 5.5 → 8.8 / 10**

---

### 79. Bug Fix — E-posta Çakışması (Silinen Grup)

**Sorun:** Bir öğrenci silinip aynı e-posta ile yeni öğrenci eklenince "Bu e-posta başka öğrenciye tanımlı" hatası veriyordu. Silinen öğrencinin grubu da silinmişti ama kontrol edilmiyordu.

**Dosya:** `src/app/hooks/useManagement.ts`

**Fix:** E-posta çakışması bulunca çakışan öğrencinin `groupId`'si alınır, o grup hâlâ Firestore'da var mı `getDoc` ile kontrol edilir. Grup silinmişse çakışma görmezden gelinir.

```ts
const conflictGroupId = cd.groupId as string | undefined;
let groupStillExists = true;
if (conflictGroupId) {
  const groupSnap = await getDoc(doc(db, "groups", conflictGroupId));
  groupStillExists = groupSnap.exists();
}
if (groupStillExists) throw new Error(...DUPLICATE_EMAIL);
```

---

### 80. Bug Fix — Önceki Öğrencinin Avatar/Cinsiyet Kalıntısı

**Sorun:** Öğrenci silinip yeni öğrenci ekleme formuna geçilince avatar ve cinsiyet bir önceki öğrenciden kalmış gibi görünüyordu. Sayfayı yenilemeden düzelmiyordu.

**Dosya:** `src/app/hooks/useManagement.ts` → `resetStudentForm`

**Fix:** `setStudentGender("")` ve `setAvatarId(null)` reset fonksiyonuna eklendi.

---

### 81. Bug Fix — StudentForm Tab Navigasyonu

**Sorun:** E-posta alanından Tab'a basınca cinsiyet dropdown'u odak almıyor, sıradaki native elemana atlıyordu.

**Dosya:** `src/app/components/dashboard/student-management/StudentForm.tsx`

**Fix:** Cinsiyet, şube ve grup özel dropdown'larına `tabIndex={0}` eklendi. `onKeyDown` ile Enter/Space açma desteği eklendi. `outline-none focus:ring-2 focus:ring-orange-300` odak görsel göstergesi eklendi.

---

### 82. Bug Fix — Aktivasyon Maili Gönderilmiyordu

**Sorun:** Öğrenci aktive edilirken `/api/welcome` çağrısına `Authorization` header geçirilmiyordu. Blok A ile route güvenlik altına alındıktan sonra mail gönderimi 401 ile başarısız oluyordu.

**Dosya:** `src/app/hooks/useManagement.ts` → `handleAddStudent`

**Fix:**
```ts
const welcomeToken = await auth.currentUser?.getIdToken();
await fetch("/api/welcome", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${welcomeToken ?? ""}`,
  },
  body: JSON.stringify({ ... }),
});
```

---

### 83. Ödev Branş Filtresi — Şablon ↔ Grup Eşleştirmesi

**Sorun:** Bir ödev şablonu "Grafik Tasarım" branşına ait olsa bile tüm gruplar atama modalında listeleniyordu.

**Çözüm:** Şablona `discipline` alanı eklendi. Atama modalı bu alanı okuyarak sadece eşleşen branştaki grupları listeler.

**`AssignActivateModal.tsx`:**
- `Group` interface'e `discipline?: string` eklendi
- `templateDiscipline?: string | null` prop eklendi
- Grup listesi: `templateDiscipline ? active.filter(g => g.discipline === templateDiscipline) : active`
- Header'da filtreli branş orange badge olarak gösterilir

**`AssignmentLibrary.tsx`:**
- `assignModalTask` açılırken `templateDiscipline={assignModalTask.discipline ?? null}` geçirilir

**`TaskForm.tsx`:**
- Branch dropdown artık **yeni oluşturma** ve **mevcut şablonu düzenleme** her ikisinde de gösterilir (önceden sadece yenide açılıyordu)
- Branş zorunlu validasyon her iki modda da çalışır
- Admin dahil tüm kullanıcılar kendi branşlarını görür (global tüm branşlar yerine)

---

### 84. AssignmentLibrary — Branş Filtresi Taşındı

**Önceki:** `activeBranch` state `dashboard/page.tsx`'te yönetiliyordu, hem DesignParkour hem AssignmentLibrary'e prop geçiliyordu.

**Yeni:**
- `AssignmentLibrary` kendi `activeBranch` + `branchOptions` state'ini yönetir
- Kullanıcının branşları Firestore'dan yüklenir; tek branş varsa dropdown gösterilmez, otomatik seçilir
- `dashboard/page.tsx`'ten `activeBranch` + `setActiveBranch` state kaldırıldı
- Her iki bileşene geçilen bu prop'lar kaldırıldı

**DesignParkour:**
- Branş filtresi tamamen kaldırıldı — tüm branşlar her zaman gösterilir
- Bir eğitmen 4-5 sınıfına ait tüm aktif ödev kartlarını yan yana görebilir

---

### 85. TaskManagementPanel — Branş Filtre Dropdown

**Şablon yönetim paneline** sağ üste branş filtresi eklendi:
- Tüm branşlar Firestore'dan yüklenir
- "Tüm Branşlar" + her branş seçeneği
- `visibleTemplates` hem `activeTab` hem `branchFilter` ile filtrelenir

---

---

## Oturum: 2026-05-22 (Devam) — Sentry + Yoklama Zaman Kilidi

### 86. Sentry Entegrasyonu

- `@sentry/nextjs` kuruldu (`npx @sentry/wizard@latest -i nextjs`)
- Seçimler: Tracing ✅ | Session Replay ❌ | Logs ✅ | Tunnel ❌ | Claude Code MCP ✅
- Oluşturulan dosyalar: `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/app/global-error.tsx`
- `tracesSampleRate: 1`, `enableLogs: true`, `sendDefaultPii: true`
- `next.config.ts` → `withSentryConfig` wrapper eklendi; gereksiz yorumlar temizlendi
- **CSP güncellendi:** `connect-src`'e `https://*.sentry.io` ve `https://*.ingest.sentry.io` eklendi (browser direkt Sentry'e gönderiyor)
- Sentry MCP: `.mcp.json` güncellendi — Claude Code Sentry hata raporlarını okuyabilir
- Güvenlik skoru: 8.8 → **~9.2 / 10**

### 87. Yoklama Giriş Zaman Kilidi

**Kural:** Ders başlamadan 30 dk önce açılır, ders bitiminden 3 saat sonra kapanır.

**Dosya:** `src/app/components/dashboard/attendance/AttendancePanel.tsx`

**Yeni yardımcı fonksiyonlar:**
- `parseSessionTime(session)` — `"Pts - Çar | 19.00 - 21.30"` string'inden `{ start, end }` (dakika) döner
- `fmtMins(mins)` — dakikayı `"HH:MM"` formatına çevirir
- `WINDOW_BEFORE_MIN = 30`, `WINDOW_AFTER_MIN = 180` sabitleri

**`isWithinTimeWindow` derived değeri:**
- Admin, `allowEdit` (Yoklama Detay), zaten başlatılmış ders (`existingDoc`) → her zaman `true`
- Session string'inde saat yoksa (esnek gruplar) → `true` (kısıtlama yok)
- Aksi halde: `nowMins >= start - 30 && nowMins <= end + 180`

**UI değişiklikleri:**
- Pencere dışındaysa info banner gösterilir:
  - Henüz açılmadıysa: `"Yoklama 19:30'dan itibaren alınabilir."`
  - Kapandıysa: `"Yoklama alma süresi sona erdi (00:30'da kapandı)."`
- "Dersi Başlat" butonu `disabled` + kilit ikonu
- Öğrenci listesi `opacity-60 pointer-events-none`

### 88. Auto-Close Cron — Bug Düzeltmesi

**Dosya:** `src/app/api/cron/auto-close-attendance/route.ts`

**Sorun:** Eski filtre sadece `Object.keys(entries).length > 0` koşulunu kontrol ediyordu. "Dersi Başlat" basılıp öğrenciler işaretlenmiş ama **"Kaydet" tıklanmamışsa** entries Firestore'da `{}` kalır → cron bu doc'u atlıyor, gece yarısı kapanmıyordu.

**Fix:**
```ts
const hasEntries = data.entries && Object.keys(data.entries).length > 0;
const wasStarted = !!data.lessonStartedAt;
return hasEntries || wasStarted;
```

`lessonStartedAt` olan tüm kapatılmamış doc'lar (boş olsun ya da dolu) gece 00:01'de otomatik kapanır.

---

## Oturum: 2026-05-22 (Devam 2) — Upstash Redis + TypeScript Temizliği

### 89. Upstash Redis — Dağıtık Rate Limiting

- `@upstash/redis` + `@upstash/ratelimit` kuruldu
- `src/app/lib/rate-limit.ts` tamamen yeniden yazıldı:
  - Upstash `slidingWindow` algoritması
  - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env var'ları ile çalışır
  - Env var yoksa (local dev) in-memory fallback devreye girer — eski davranış korunur
  - Ratelimit instance'ları `(limit, windowMs)` kombinasyonuna göre cache'lenir
- 9 API route'a `await` eklendi (`isRateLimited` artık async)
- Upstash console → Metrics'te komutların sayıldığı doğrulandı
- Vercel env var'larına `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` eklendi
- **Güvenlik skoru: 9.2 → 9.5 / 10**

**Upstash DB:** `flexos` — AWS eu-west-1 (Frankfurt), Free tier (10.000 cmd/gün)

### 90. TypeScript `any` Temizliği — API Route'lar

- `catch (error: any)` / `catch (err: any)` → `catch (error: unknown)` pattern:
  ```ts
  const message = err instanceof Error ? err.message : String(err);
  ```
- `(s: any)` gereksiz tip annotation kaldırıldı (tip inference yeterli)
- `scoringSnap.data() as Record<string, any>` → cast kaldırıldı (Firestore `DocumentData` zaten doğru tip)
- **Etkilenen dosyalar:** `delete-user/route.ts`, `dev-seed/route.ts`, `league/route.ts`
- **Sonraki oturumda:** `.tsx` dosyalarındaki 198 `any` kullanımı parça parça temizlenecek (önce hooks, sonra componentler)

---

---

## Oturum: 2026-05-23 — League Route Güvenlik Düzeltmesi

### 91. `/api/league` — Auth Koruması Eklendi

**Sorun:** `league/route.ts` hiç kimlik doğrulama içermiyordu. Öğrenci login sistemi olmadan tasarlanmıştı; artık öğrenciler login olduğu için herkesin erişimine açık olmamalı.

**Etkilenen dosyalar:**
- `src/app/api/league/route.ts` → `verifyRequestToken` eklendi, token yoksa 401
- `src/app/league/page.tsx` → `auth.authStateReady()` bekleyip token alınıyor
- `src/app/components/student/StudentLeagueWidget.tsx` → aynı pattern, `auth` import eklendi

**`authStateReady()` neden gerekli:** Firebase auth state'i sayfa yüklenince ilk anda `null` olabilir (session IndexedDB'den restore edilirken). `authStateReady()` bu geçici null'ı atlatır; token garantili doğru alınır.

**Güvenlik skoru: 9.5 → 9.7 / 10**

---

### 92. Bug Fix — AssignmentLibrary Kişisel Sekmede Branş Filtresi Çalışmıyordu

**Sorun:** `visibleTemplates` filtresinde `activeTab === "personal"` dalı `activeBranch`'i tamamen görmezden geliyordu. Grafik Tasarım seçiliyken Web branşına ait kişisel şablonlar görünüyordu.

**Dosya:** `src/app/components/dashboard/assignment/AssignmentLibrary.tsx`

**Fix:** Personal dal global dal ile aynı branş filtresi mantığını kullanır:
```ts
if (activeTab === "personal") {
  if (!(t.scope === "personal" && t.createdBy === uid)) return false;
  if (activeBranch !== "all") return t.discipline === activeBranch;
  return true;
}
```

---

### 93. Sidebar — Accordion Karşılıklı Kapanma + Ödev Ayarları Kaldırıldı

**Dosya:** `src/app/components/layout/Sidebar.tsx`

**1. Accordion birbirini kapatır:**
- Yoklamalar butonuna tıklanınca `setAssignmentTestOpen(false)` çağrılır
- Ödevler butonuna tıklanınca `setYoklamaOpen(false)` çağrılır
- Önceden her iki accordion aynı anda açık kalabiliyordu

**2. "Ödev Ayarları" linki kaldırıldı:**
- `/dashboard/assignment/settings` — Ödev Yönetimi ile işlev çakışması vardı
- `SlidersHorizontal` import da temizlendi

**3. Yedek dosyalar silindi:**
- `src/app/login/activation/page-yedek.tsx`
- `src/app/components/dashboard/student-management/StudentForm-yedek.tsx`

---

---

## Oturum: 2026-05-23 (Devam) — Yoklama Raporu Filtreleme + Navigasyon Kısaltma

### 94. Route Yeniden Adlandırma

Yoklama sayfalarının isimleri netleştirildi:

| Eski Route | Yeni Route | Açıklama |
|---|---|---|
| `/dashboard/attendance-report` | `/dashboard/attendance-detail` | Eğitmenin kendi aylık grup detayı |
| `/dashboard/attendance-summary` | `/dashboard/attendance-report` | Admin — tüm eğitmenler özet raporu |

**Sidebar güncellendi:**
- "Yoklama Detay" → `/dashboard/attendance-detail`
- "Yoklama Raporu" → `/dashboard/attendance-report` (sadece admin görür)

---

### 95. Yoklama Raporu — Tam Filtre Çubuğu

**Dosya:** `src/app/dashboard/attendance-report/page.tsx`

**Eklenen filtreler (attendance-detail ile birebir aynı görsel yapı):**
- **Branş dropdown** — cascade: branş seçince grup + eğitmen dropdown'ları daralır
- **Grup dropdown** — branş + eğitmen cascade ile senkron
- **Eğitmen dropdown** — `rows` state'inden türetilir, ekstra Firestore fetch yok
- **Tek arama alanı** — `searchQuery`: grup kodu eşleşiyorsa → search mode (attendance kayıtları), eşleşmiyorsa → eğitmen adı filtresi
- **Tarih aralığı** — `searchFrom / searchTo` (search mode'da geçerli)
- `isSearchMode` useMemo: `q.length >= 2 && groups.some(g => code.includes(q))`
- Ayırıcı: `hidden lg:block w-px h-8 bg-surface-100 shrink-0`

**Başlık dinamik:** Eğitmen seçiliyse `"Ad — Rapor"`, branş seçiliyse `"BranşAdı — Rapor"`, aksi halde `"Yoklama Raporu"`

---

### 96. Yoklama Detay — Filtre Çubuğu Kaldırıldı

**Dosya:** `src/app/dashboard/attendance-detail/page.tsx`

Eğitmenin kendi sayfası — filtre gerekmez, sadece kendi gruplarını görür.

- Header, ay seçici, stat kartlar, grup tablosu, footer korundu
- Filtre JSX'i (branş/grup/eğitmen dropdown + arama + tarih aralığı) tamamen kaldırıldı
- State ve logic kod içinde kaldı (gelecekte gerekirse kullanılabilir)
- Back butonu: `filterInstructorId` param varsa `"← Rapor"` → `/dashboard/attendance-report`

---

### 97. Yoklama Düzenleme — Admin Zaman Sınırı Bypass

**Dosya:** `src/app/components/dashboard/attendance/AttendancePanel.tsx` (satır 853)

**Kural:**
- Eğitmen: kapatılmış yoklamayı sadece **3 gün içinde** düzenleyebilir
- Admin / Yönetici: süre sınırı yok, her zaman düzenleyebilir

**Değişiklik:**
```ts
// Önceki:
const canEdit = allowEdit && (!attendanceClosed || withinEditWindow);

// Sonrası:
const canEdit = allowEdit && (!attendanceClosed || withinEditWindow || isAdmin());
```

---

### 98. Yoklama Raporu — Accordion Navigasyon (3 Sayfa → 2 Sayfa)

**Dosya:** `src/app/dashboard/attendance-report/page.tsx`

**Sorun:** Rapor → Detay → Yoklama Al = 3 sayfa navigasyon.

**Çözüm:** "Detay" butonu artık ayrı sayfaya yönlendirmiyor; eğitmen satırının altında inline accordion açıyor.

**Değişiklikler:**
- `expandedInstructorId: string | null` state eklendi
- "Detay" butonu → accordion toggle (ChevronDown rotate animasyonu ile)
- Her eğitmen satırı artık `<div>` wrapper içinde; altında `AnimatePresence + motion.div` accordion

**Accordion içeriği:**
- Eğitmenin grupları `groups` state'inden `instructorId` ile filtrelenir
- Her grup: tıklanabilir kart → `router.push('/dashboard/attendance?groupId=...')`
- Sağ üstte "Tam rapor →" linki → `/dashboard/attendance-detail?instructorId=...&month=...`

**Framer Motion animasyon:**
```ts
initial={{ height: 0, opacity: 0 }}
animate={{ height: "auto", opacity: 1 }}
exit={{ height: 0, opacity: 0 }}
transition={{ duration: 0.22, ease: "easeInOut" }}
```

ChevronDown ikonu `motion.span` ile 0° → 180° döner.

---

### 99. Sentry — ReferenceError Düzeltmesi + .next Temizliği

**Hata:** `ReferenceError: searchCode is not defined at AttendanceSummaryContent`

**Neden:** Önceki oturumda `attendance-report`'ta `searchCode` → `searchQuery` olarak yeniden adlandırıldı. Ancak `.next` Turbopack cache'inde eski chunk (`src_app_7d72f26a._.js`) kalmıştı; dev server eski kodu sunuyordu.

**Fix:** `.next` klasörü silindi → dev server yeniden başlatılınca fresh build yapıldı.

**Sentry'de:** Issue "Resolve" ile kapatıldı. Hata tekrarlanmadı.

---

### 100. Tablo Hizalama — Grup Sayısı

**Dosya:** `src/app/dashboard/attendance-report/page.tsx`

**Sorun:** "Grup" sütunundaki tek satır sayı (`4`) ile yanındaki iki satırlı değerlerin (`48 saat` + `(48 ders)`) üst satırı `items-center` nedeniyle farklı yükseklikte görünüyordu.

**Fix:** Grup hücresine `invisible` sub-line eklendi:
```tsx
<div className="w-14 shrink-0 text-center">
  <span className="text-[16px] font-bold text-base-primary-800">{ins.groupCount}</span>
  <p className="text-[10px] invisible">-</p>
</div>
```

Her iki sütun artık 2 satırlık yüksekliğe sahip → `items-center` ile üst satırlar hizalanıyor.

---

---

## Oturum: 2026-05-24 — Yoklama Raporu Tarih Aralığı + UI + Bug Düzeltmeleri

### 101. Yoklama Raporu — Tarih Aralığı Ana Tabloyu Kontrol Eder

**Dosya:** `src/app/dashboard/attendance-report/page.tsx`

**Önceki:** `searchFrom`/`searchTo` sadece arama modunda (grup kodu eşleşince) çalışıyordu. Ana eğitmen özet tablosu her zaman tek ay gösteriyordu.

**Yeni:** Tarih aralığı tüm tablo için geçerli — çok aylı aggregation.

**`getMonthsInRange(from, to)`** helper eklendi:
```ts
function getMonthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  const cur = new Date(from.slice(0, 7) + "-01T12:00:00");
  const end = new Date(to.slice(0, 7) + "-01T12:00:00");
  while (cur <= end && months.length < 24) {
    months.push(toMonthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months.length > 0 ? months : [toMonthKey(new Date())];
}
```

**State değişiklikleri:**
- `selectedMonth` state kaldırıldı
- `searchFrom` (varsayılan: ayın 1'i) + `searchTo` (varsayılan: bugün) eklendi
- `activeMonths = useMemo(() => getMonthsInRange(searchFrom, searchTo), [searchFrom, searchTo])`

**Firestore sorguları güncellendi:**
- `design_attendance` + `lesson_exceptions`: `where("month", "in", activeMonths)`
- Kısmi ay için gün bazlı filtre: `if (date < searchFrom || date > searchTo) return;`
- Planlanan ders sayısı: her ay için `effectiveStart`/`effectiveEnd` sıkıştırması

**Başlık:** Ay dropdown kaldırıldı; subtitle `searchFrom`–`searchTo` dd-mm-yyyy formatında

### 102. Yoklama Raporu — DayCalendarPopover Tarih Seçici

**Sorun:** Native `<input type="date">` ay/gün/yıl segment oklarına basınca da `onChange` tetikleniyordu → rakama tıklamadan arama yapılıyordu.

**Çözüm:** `DayCalendarPopover` kullanıldı — sadece takvim rakamına tıklanınca `onChange` çağrılır, ay navigasyonu (`< >`) sadece görünümü değiştirir.

**Date picker buton görünümü:**
- `CalendarDays` (lucide) ikonu solda, renk `text-neutral-400`
- Format: dd-mm-yyyy (`searchFrom.split("-").reverse().join("-")`)
- `flex-1 min-w-[130px] lg:w-36` — mobilde esnek, masaüstünde sabit genişlik
- Hover: `hover:border-base-primary-400 transition-colors`

### 103. Yoklama Raporu — Filtre Seçici İkonları + Renk Standartları

**FilterSelect bileşenine `icon?: React.ReactNode` prop eklendi:**
- Seçici tetikleyicisinin solunda, `text-neutral-400` renk
- İkon varken trigger `pl-8` (ikon için boşluk)
- ChevronDown da `text-neutral-400`

**Kullanılan ikonlar:**
| Filtre | İkon |
|---|---|
| Tüm Branşlar | `Layers` (lucide) |
| Tüm Gruplar | `Users` (lucide) |
| Tüm Eğitmenler | `GraduationCap` (lucide) |

**Arama alanı:**
- Arama ikonu: `text-neutral-500` (önceki çok soluktu)
- Placeholder `text-neutral-400`
- Placeholder metni: `"Grup, eğitmen ara"` (eğitmen küçük harf)

---

### 104. Yoklama Detay — İptal StatCard Saat Düzeltmesi

**Dosya:** `src/app/dashboard/attendance-detail/page.tsx`

**Sorun:** İptal StatCard'da `"X ders"` yazıyordu; gerçekte `X * sessionHours` saat gösterilmeli.

**Eklenen hesaplama:**
```ts
const totalCancelledHours = stats.reduce((s, g) => s + g.cancelledThisMonth * g.sessionHours, 0);
```

**StatCard:**
```tsx
<StatCard label="İptal" value={`${totalCancelledHours} saat`}
  sub={`(${totalCancelled} ders)`} ... />
```

**Footer da güncellendi:** `${totalCancelledHours} saat iptal (${totalCancelled} ders, ${totalStudentCancelled} öğrenci kaynaklı)`

---

### 105. Yoklama Detay — Başlık Düzeltmesi

**Dosya:** `src/app/dashboard/attendance-detail/page.tsx`

**`pageTitle` useMemo güncellendi:** Tüm case'lerde "Yoklama Raporu" → "Yoklama Detay":
- Eğitmen seçili: `"Ad — Detay"` (önceki "Ad — Detay" aynı kalır)
- Branş seçili: `"BranşAdı — Detay"` (önceki "BranşAdı — Rapor" düzeltildi)
- Varsayılan: `"Yoklama Detay"` (önceki "Yoklama Raporu" düzeltildi)

---

### 106. AttendancePanel — Grup Değişince Tarih Sıfırlanmıyor (Bug Fix)

**Dosya:** `src/app/components/dashboard/attendance/AttendancePanel.tsx`

**Sorun:** Grup 541'de 10 Mayıs seçiliyken Grup 550'ye geçilince tarih 10 Mayıs'ta kalıyordu. Yeni grubun son yoklama tarihi otomatik seçilmiyordu.

**Neden:** Auto-date-select effect `[preSelectedGroupId, allowEdit]` bağımlılığını dinliyordu. `preSelectedGroupId` URL'den geliyor, manuel sol panel tıklamalarında değişmiyordu.

**Fix:** Bağımlılık `[selectedGroupId]` olarak değiştirildi — hem URL param hem de manuel panel seçimi için tetiklenir:
```tsx
useEffect(() => {
  if (!selectedGroupId) return;
  // bu ay + geçen ay yoklamalarını çek, en son tarihi seç
  getDocs(query(..., where("month", "in", [m0, m1]))).then(snap => {
    const dates = snap.docs.map(d => d.data().date as string).sort().reverse();
    const d = new Date(dates[0] + "T12:00:00");
    setSelectedDate(d); setSelectedMonth(d);
  });
}, [selectedGroupId]);
```

---

### 107. AttendancePanel — Tarih Değişince Eski Exception Kalıyor (Bug Fix)

**Dosya:** `src/app/components/dashboard/attendance/AttendancePanel.tsx`

**Sorun:** Grup 550'de 21 Mayıs "öğrenci gelmediği için iptal edildi" seçiliyken 19 Mayıs'a geçince aynı banner görünmeye devam etti. Refresh'e kadar düzelmiyordu.

**Neden:** `[selectedGroupId, dateKey]` effect'i `setException(null)` çağırmıyordu. `unsubGroupEx` listener yeni tarih için belge yoksa hiçbir şey yapmıyor (`// fall through`) ve `unsubSystemEx` listener da `prev?.scope === "group"` ise `prev`'i koruyordu.

**Fix 1 — Effect başında temizle:**
```ts
setException(null); // tarih veya grup değişince anında temizle
```

**Fix 2 — unsubGroupEx listener belge yoksa temizler:**
```ts
const unsubGroupEx = onSnapshot(..., d => {
  if (d.exists()) { setException(d.data() as LessonException); return; }
  setException(prev => prev?.scope === "group" ? null : prev);
});
```

---

### 108. Yoklama Modülü Move Animasyonu + AttendFlowTransition

**Dosyalar:**
- `src/app/components/layout/AttendFlowTransition.tsx` ← YENİ
- `src/app/layout.tsx`
- `src/app/components/layout/Sidebar.tsx`
- `src/app/attend/page.tsx`
- `src/app/components/dashboard/attendance/AttendancePanel.tsx`
- `src/app/dashboard/attendance/page.tsx`
- `src/app/dashboard/attendance-detail/page.tsx`
- `src/app/context/PageTransitionContext.tsx` ← YENİ (oluşturuldu, yerini AttendFlowTransition aldı)
- `src/app/components/dashboard/attendance/AttendanceDetailContent.tsx` ← YENİ (extracted shared component)

**Hedef:** Dashboard → Attend arası gerçek "move" animasyonu — iki sayfa aynı anda DOM'da kalarak birlikte kayar.

**Temel Sorun:** Farklı Next.js sayfaları native olarak aynı anda animate edilemez. Beyaz overlay yaklaşımı dashboard içeriğini hareket ettirmiyordu.

**Çözüm — AttendFlowTransition:**
```tsx
// AnimatePresence mode="popLayout" + key={pathname}
// Eski sayfa exit yaparken yeni sayfa enter eder → gerçek eş zamanlı hareket
<AnimatePresence mode="popLayout" initial={false}>
  <motion.div
    key={pathname}
    initial={{ x: isAttend ? "100%" : 0 }}
    animate={{ x: 0 }}
    exit={{ x: isDashboard ? "-100%" : "100%" }}
    transition={active ? T : { duration: 0 }}
    style={active ? { position: "fixed", inset: 0, overflowY: "auto" } : undefined}
  >
    {children}
  </motion.div>
</AnimatePresence>
```
- Dashboard exit: `x: "-100%"` (sola kayar)
- Attend enter: `x: "100%"` (sağdan gelir)
- Attend exit: `x: "100%"` (sağa gider)
- Diğer sayfalar: `duration: 0` (animasyon yok)

**layout.tsx:** `AttendFlowTransition` ile `{children}` sarıldı.

**Sidebar:** "Yoklama Al" item `<Link>` → `<button onClick={() => router.push("/attend")}>` olarak değiştirildi. Overlay + `PageTransitionContext` kaldırıldı.

**attend/page.tsx:** `exiting` state kaldırıldı. Attend paneli geri ok → `router.push("/dashboard")` (doğrudan, state yok). `AttendFlowTransition` exit animasyonunu üstlenir.

**attend/page.tsx iç animasyonlar (panel ↔ detay):**
- `showDetail` state ile iki panel yan yana kayar
- Attend panel: `animate={{ x: showDetail ? "-100%" : 0 }}`
- Detail panel: `animate={{ x: showDetail ? 0 : "100%" }}`
- `initial={false}` — detay panel ilk render'da görunmez

**AttendancePanel yeni props:**
- `onBack?: () => void` — sol sidebar'da geri dön butonu (logo altı, takvim listesi 24px üstü)
- `onViewDetail` yokken → `router.push('/dashboard/attendance?groupId=X&ref=attend')` navigasyonu

**attendance-detail/page.tsx:** `ref` param ile geri yön belirlenir:
```tsx
const backUrl = ref === "attendance"
  ? `/dashboard/attendance?groupId=${filterGroupId}`
  : filterInstructorId ? "/dashboard/attendance-report" : null;
```

**Beyaz flash root nedeni:** Önceki yaklaşımda beyaz overlay dashboard'un üstünü kapatıyordu → içerik hareket etmiyordu. `AttendFlowTransition` çözümünde gerçek DOM elementi transform ediliyor.

---

### 109. Sidebar "Yoklama Al" Aktif Durumu

**Dosya:** `src/app/components/layout/Sidebar.tsx`

**Değişiklik:** `/attend` pathname'ine göre `bg-white/10` aktif stil uygulanır:
```tsx
${pathname === "/attend" ? "bg-white/10 text-white shadow-sm" : "text-white hover:bg-white/5"}
```
İkon rengi de `pathname === "/attend"` kontrolüyle `text-[#FF8D28]` olur.

---

### 110. Attend Sayfası Yeni Sekmede Login Bug Fix

**Dosya:** `src/app/attend/page.tsx`

**Sorun:** Yoklama alırken başka sekmede sekme açılınca `/login` ekranı geliyordu.

**Kök neden:** `attend/page.tsx` kendi `onAuthStateChanged` listener'ını kuruyordu. `UserContext` de aynı listener'ı kuruyor. Race condition: context henüz yüklenmeden attend'in listener'ı tetiklenip `/login`'e yönlendiriyordu.

**Çözüm:** `attend/page.tsx`'ten `onAuthStateChanged`, `auth`, `db`, `doc`, `getDoc` kaldırıldı. Yetki kontrolü `useUser()` hook'una devredildi:
```tsx
const { user, loading } = useUser();
useEffect(() => {
  if (loading) return;
  if (!user) { router.push("/login"); return; }
  const isAuthorized = user.roles?.includes("admin") || user.roles?.includes("instructor");
  if (!isAuthorized) { router.push("/dashboard"); return; }
  setReady(true);
}, [loading, user, router]);
```

---

### 111. AttendancePanel "Dersi Bitir" → "Kaydet" Yanlış Gösterme Fix

**Dosya:** `src/app/components/dashboard/attendance/AttendancePanel.tsx`

**Sorun:** Grup/gün değiştirince devam eden yoklamada buton "Kaydet" oluyor, "Dersi Bitir" olması gerekiyor.

**Kök neden:** `onSnapshot` callback'i `saved` state'ini restore etmiyordu. Firestore'da kayıt varsa `saved=true` olmalıydı ama set edilmiyordu.

**Çözüm:** `onSnapshot` içindeki `d.exists()` branch'ine `setSaved(true)` eklendi:
```tsx
if (d.exists()) {
  const data = d.data() as AttendanceDoc;
  setEntries(data.entries ?? {});
  setExistingDoc(true);
  setLessonStarted(true);
  setSaved(true); // ← eklendi
  setAttendanceClosed(data.attendanceClosed ?? false);
  // ...
}
```

---

### 112. AttendFlowTransition Animasyon Denemeleri → Kaldırıldı

**Dosya:** `src/app/components/layout/AttendFlowTransition.tsx`, `src/app/layout.tsx`

**Süreç:**
1. Çeşitli `AnimatePresence` + `motion.div` kombinasyonları denendi (mode: sync, wait, popLayout)
2. Sheet overlay pattern (attend z:2, dashboard z:1) — geri dönüşte lacivert sidebar "patlama" sorunu
3. `key="dashboard"` tüm dashboard rotaları için sabit key — sidebar titreme giderildi ama attend geçişi hâlâ sorunlu
4. `dashboard/layout.tsx` oluşturma + 19 sayfa refactor — sayfa tasarımı bozuldu, GERİ ALINDI (`git checkout .` + yeni dosya silindi)
5. **Final karar:** Animasyondan vazgeçildi

**Sonuç:** `layout.tsx`'ten `AttendFlowTransition` tamamen kaldırıldı, `{children}` doğrudan render ediliyor. Yoklama Al'a basınca attend sayfası normal Next.js yüklenmesiyle açılıyor (attend/page.tsx'teki spinner görünür).

```tsx
// layout.tsx — artık sadece:
<ScoringProvider>
  {children}
</ScoringProvider>
```

**AttendFlowTransition.tsx** dosyası yerinde duruyor ama layout'a import edilmiyor. Silinebilir.

---

### 113. Sidebar Yoklama Accordion sessionStorage Kalıcılığı

**Dosya:** `src/app/components/layout/Sidebar.tsx`

**Sorun:** `/attend` sayfasından dashboard'a dönünce yoklama accordion'u kapanıyordu (Sidebar unmount/remount).

**Çözüm:** `yoklamaOpen` state'i `sessionStorage`'a yazılıp okunuyor:
```tsx
const [yoklamaOpen, setYoklamaOpen] = useState(() => {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('yoklamaOpen');
    if (stored !== null) return stored === 'true';
  }
  return pathname.startsWith('/dashboard/attendance');
});

useEffect(() => {
  sessionStorage.setItem('yoklamaOpen', String(yoklamaOpen));
}, [yoklamaOpen]);
```

---

## Sonraki Adımlar (Öncelik Sırasıyla)

### 1. İLERİDE — Sertifika PDF + Dağıtım
- Finalize sonrası sertifika belgesi üretilecek
- Altyapı hazır: `react-pdf` + `send-kitap` pattern'i kullanılabilir
- Şablon tasarımı kararlaştırılacak — acelesi yok

### 2. İLERİDE — Dashboard Hızlı Yoklama Widget
- `/attend?groupId=xxx` shortcut kartı

### ✅ TAMAMLANDI
- §41 Bekleyen commit → önceki oturumlarda push edildi
- Sınıf Yükselt (Grafik-1 → Grafik-2) → GroupForm + carryOver zaten çalışıyor
- Öğrenci bazlı yoklama raporu → StudentDetailModal Devam Durumu kartı (§56)
- Grading sistemi (not girişi, finalize, 70/30) → §68'de dinamik hale getirildi
- StudentForm isOnlineStudent toggle → §64
- AttendancePanel StudentDetailModal → §65–§67
- Grading "Not Ayarları" sekmesi → §68
- Güvenlik sertleştirme (Blok A + rate limiting + CSP/HSTS) → §76–§78
- Bug fix: silinen grup / e-posta çakışması → §79
- Bug fix: avatar/cinsiyet form reset → §80
- Bug fix: Tab navigasyonu → §81
- Bug fix: aktivasyon maili Authorization header → §82
- Ödev branş filtresi (şablon ↔ grup eşleştirmesi) → §83–§85
- Sentry entegrasyonu (tracing + logs + MCP) → §86
- Yoklama giriş zaman kilidi (30dk önce / 3 saat sonra) → §87
- Auto-close cron bug fix (lessonStartedAt kontrolü) → §88
- Upstash Redis dağıtık rate limiting → §89
- TypeScript any temizliği (tüm dosyalar) → §90 + §93
- AssignmentLibrary kişisel branş filtresi → §92
- Sidebar accordion karşılıklı kapanma + Ödev Ayarları kaldırıldı → §93
- Route yeniden adlandırma (summary→report, report→detail) → §94
- Yoklama Raporu tam filtre çubuğu → §95
- Yoklama Detay filtre çubuğu kaldırıldı → §96
- Admin yoklama düzenleme zaman sınırı bypass → §97
- Accordion navigasyon + Framer Motion → §98
- Sentry ReferenceError + .next cache fix → §99
- Tablo hizalama (Grup sayısı) → §100
- Yoklama modülü move animasyonu + AttendFlowTransition → §108–§109
- Attend sayfası yeni sekmede login bug fix → §110
- AttendancePanel "Dersi Bitir" yanlış gösterme fix → §111
- AttendFlowTransition animasyon denemeleri → vazgeçildi, kaldırıldı → §112
- Sidebar yoklama accordion sessionStorage kalıcılığı → §113
