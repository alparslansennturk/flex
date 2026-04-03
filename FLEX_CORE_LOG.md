# FLEX CORE LOG
> Son güncelleme: 2026-04-03 (v9)

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

**Eksik (yapılacak):**
- `vercel.json` oluşturulacak: `{ "crons": [{ "path": "/api/cron/deadline-reminder", "schedule": "0 6 * * *" }] }` → 09:00 Istanbul = 06:00 UTC
- Vercel Dashboard → Environment Variables → `CRON_SECRET=<rastgele-string>` eklenecek
- `vercel.json` Vercel'e push edilince cron otomatik aktif olur

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
- Kitap PDF: `bookId` alanı kapak numarası olarak büyük puntoda gösterilir; gramaj `useMemo` + `student.id` bağımlılığıyla öğrenci başına sabit
- `allGroupDone` = `groupStudentCount > 0 && bookDraws.length >= groupStudentCount`; bu durumda erken tamamla UI'ı gizlenir ve task `status: "completed"` otomatik yazılır
- Tarih kısıtı: `min={today}` — tarayıcı native disabled render'ı kullanır, ek validasyon gerekmez
- Kitap carousel: `BookCarousel` offset-tabanlı animasyon kullanır; `toCoverBooks()` ile `BookItem` → `CoverBook` (palette ataması); `viewportRef + ResizeObserver` ile responsive merkez
- **rem ≠ px uyarısı:** `globals.css` root font-size `13.25px * scale-factor` — Tailwind rem spacing'i standart 16px değil ~13.25px bazlı üretir; piksel hassasiyeti gereken layout'ta inline `style={{ ...px }}` kullan
- Brevo: `xsmtpsib-` = SMTP credentials (nodemailer için), `xkeysib-` = REST API key (`/v3/smtp/email` için); `email.ts` REST API kullandığı için `BREVO_API_KEY=xkeysib-...` olmalı
- Cron deadline reminder: `tasks.endDate` YYYY-MM-DD string; cron her çalışmada güncel değeri okur — eğitmen tarihi değiştirse de sistem otomatik adapte olur; `reminderSentDates[]` duplicate önler; aktif etmek için `vercel.json` + `CRON_SECRET` env var gerekli
- Logs sistemi: `mailLogs` ve `scoreLogs` Firestore koleksiyonları — server-side `adminDb` ile yazılır, client-side silinemez; emailService sadece API route'lardan import edilir (firebase-admin güvenli)
- scoreLogs write noktası: `grading/page.tsx` `handleSaveGrades()` içinde `batch.commit()` sonrası — hata olsa bile grading işlemi etkilenmez (try/catch ayrı)
- Sertifikasyon layout: `max-w-250` (~1000px) → `max-w-[1920px]` — 3 yerde değişti (GradingTabs, CertificationPanel, GradingRouter sekme başlığı)

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

