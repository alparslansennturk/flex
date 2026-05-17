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

## Sonraki Adımlar (Öncelik Sırasıyla)

### 1. HEMEN — Figma MCP Bağlantısı + Yoklama Revizesi
- Claude Code yeniden başlat (yeni `.mcp.json` yüklensin)
- Figma'da MCP Plugin'i aç → kanal ID paylaş → `join_channel`
- Kullanıcının Figma'da revize ettiği yoklama ekranını oku
- **İki ekran yapısı planlandı:**
  - **Detaylı:** `/dashboard/attendance` — mevcut AttendancePanel, istatistik + grafik ağır
  - **Basit:** `/yoklama` — bağımsız route, sadece grup seç + yoklama al, minimal UI

### 2. HEMEN — `/yoklama` Bağımsız Route
- **Auth akışı:** Middleware'e `/yoklama` eklenir, login'e `?redirect=/yoklama` ile yönlendirilir
- **Login sayfası:** `useSearchParams` zaten var, satır 103: `router.push("/dashboard")` → `router.push(redirect || "/dashboard")`
- **`/yoklama/page.tsx`:** Dashboard layout dışında, kendi minimal layout'u
- Dashboard'da "Hızlı Yoklama Al" kart/butonu → `/yoklama` linki

### 3. SONRA — StudentForm: isOnlineStudent
- `students` dökümanına `isOnlineStudent: boolean` eklenecek
- AttendancePanel zaten bu alanı okuyor
- **Yapılacak:** StudentForm'a toggle/checkbox ekle

### 4. BÜYÜK BLOK — Sertifikasyon Modülü
- Not girişi → sertifikasyon akışı
- Son büyük blok, altyapı sıfırdan kurulacak
