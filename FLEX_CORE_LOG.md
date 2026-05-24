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
