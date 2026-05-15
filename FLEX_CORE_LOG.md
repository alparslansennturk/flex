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

## Sonraki Adımlar (Öncelik Sırasıyla)

### 1. HEMEN — Yoklama Canlı Test
- Mevcut gruplara `startDate` girilmemişse GroupForm'dan ekle → kurs şeridi görünür
- Tatil sekmesinden Bayram tatillerini gir (Nisan sonunda 9 gün)
- Birkaç gruba yoklama al, istatistiklerin doğru çalıştığını doğrula
- Toplam/kalan saat ve tahmini bitiş tarihinin mantıklı göründüğünü kontrol et

### 2. SONRA — StudentForm: isOnlineStudent
- `students` dökümanına `isOnlineStudent: boolean` eklenecek
- AttendancePanel zaten bu alanı okuyor (online toggle default olarak set oluyor)
- **Yapılacak:** StudentForm'a toggle/checkbox ekle, useManagement'a handleSave/handleEdit entegre et

### 3. BÜYÜK BLOK — Sertifikasyon Modülü
- Not girişi → sertifikasyon akışı
- Son büyük blok, altyapı sıfırdan kurulacak
