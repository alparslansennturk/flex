# FLEX CORE LORE
> Proje hafızası — her oturumun başında oku. Son güncelleme: 2026-05-21

---

## Platform Vizyonu

**Flex**, tasarım eğitim ekosistemi için çok uygulamalı bir platform. Şu an tek Next.js repo içinde yaşıyor; ileride Turborepo monorepo'ya bölünecek.

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

**Flex-Trainer tamamlanma kriteri:** Yoklama modülü ✅ + Sertifikasyon akışı (devam ediyor)

---

## Firestore Şeması (Kritik Koleksiyonlar)

```
users/{uid}
  role: "admin" | "instructor" | "student"   ← eski, tek değer
  roles: string[]                             ← yeni, tercih edilen
  branches: string[]                          ← eğitmenin yetkili branşları
  studentDocId: string                        ← Auth UID → students doc köprüsü

students/{studentDocId}
  authUid: string                             ← Auth UID ile köprü buradan da kurulur
  groupId: string
  status: "active" | "passive"
  name, lastName, gender, avatarId, photoURL
  isOnlineStudent: boolean

groups/{groupId}
  code: string                                ← "Grafik-1 / Pzt-Çrş"
  discipline: string                          ← branchId
  session: string                             ← "Pazartesi-Çarşamba 10:00-13:00"
  sessionHours: number                        ← seans başına saat (ör. 3)
  startDate: string                           ← "YYYY-MM-DD"
  totalHours: number                          ← toplam müfredat saati
  moduleId: string                            ← branches/{id}/modules/{moduleId}
  status: "active" | "archived"

branches/{branchId}
  name, slug, sessionHours
  modules/{moduleId}
    totalHours, sessionHours, order

design_attendance/{groupId}_{YYYY-MM-DD}
  groupId, date, month (YYYY-MM)
  instructorId
  sessionHours                                ← kayıt anındaki snapshot
  entries: { [studentId]: { hours, online } }
  attendanceClosed: boolean
  closedAt: Timestamp | null
  createdAt, updatedAt, lessonStartedAt

lesson_exceptions/{groupId}_{date} | system_{date}
  groupId: string | null   ← null = sistem geneli tatil
  scope: "group" | "system"
  reason: "holiday" | "instructor_sick" | "no_students" | "other"
  note: string

tasks/{taskId}
  comments/{commentId}                        ← genel duyurular (tüm sınıfa)
  threads/{studentId}/comments/{commentId}    ← özel öğrenci-eğitmen chat
  attachmentUrl?: string                      ← eğitmenin yüklediği şablon dosyası (Drive)
  attachmentName?: string
  kitapDriveFiles?: { [studentId]: { url, fileName } }   ← öğrenci kitap PDF'leri
  kolajDriveFiles?: { [studentId]: { url, fileName } }   ← öğrenci kolaj PDF'leri
  sosyalDriveFiles?: { [studentId]: { url, fileName } }  ← öğrenci sosyal medya PDF'leri

submissions/{submissionId}
  taskId, studentId, groupId, status, file, grade...

users/{uid}/notifications/{notifId}
  type: "message"|"announcement"|"assignment"|"system"
  isRead: boolean, readAt: Timestamp
  actionUrl: string

settings/platform
  leagueGlobalEnabled: boolean
```

---

## Kimlik Doğrulama ve Yetki Kontrolü

- **Hem eski `role` hem yeni `roles[]` array destekleniyor** (geçiş dönemi)
- Admin kontrolü: `data.role === "admin" || data.roles?.includes("admin")`
- `useUser()` hook → `{ user, isAdmin(), hasPermission() }`
- Auth UID ≠ students doc ID — köprü: `users/{uid}.studentDocId`
- Öğrenci login: `users` doc'tan `studentDocId` okunur; yoksa `students` koleksiyonunda `authUid == uid` sorgulanır

---

## Yoklama Modülü — Tamamlandı (2026-05-19)

### Dosyalar
- `src/app/components/dashboard/attendance/AttendancePanel.tsx` — ana bileşen
- `src/app/dashboard/attendance/page.tsx` — Yoklama Detay sayfası (`allowEdit=true`)
- `src/app/dashboard/attendance-report/page.tsx` — Yoklama Al / rapor sayfası

### AttendancePanel Props
```tsx
mode?: "detailed" | "simple"      // detailed=Yoklama Detay, simple=Yoklama Al
autoSelectToday?: boolean
preSelectedGroupId?: string        // URL'den gelen groupId
hideSidebar?: boolean
allowEdit?: boolean                // true=Yoklama Detay, false=Yoklama Al
```

### Kritik Hesaplama Mantığı

```tsx
// 3 günlük pencere DAIMA ders tarihinden hesaplanır (closedAt'tan değil!)
const windowBase = existingDoc && dateKey ? new Date(dateKey + "T23:59:59") : null;
const withinEditWindow = windowBase
  ? (Date.now() - windowBase.getTime()) < 3 * 24 * 60 * 60 * 1000
  : false;

// Düzenlenebilir mi? (Yoklama Detay + 3 gün içi)
const canEdit = allowEdit && (!attendanceClosed || withinEditWindow);

// Salt okunur görünüm: kapatılmış+pencere dolmuş VEYA Yoklama Al'da geçmiş tarih
const isReadonlyView =
  (attendanceClosed && !canEdit) ||
  (!allowEdit && !isToday && existingDoc);

// Kurs bitiş tarihi sonrası yoklama oluşturulamaz
const isPastCourseEnd = estimatedEndDate !== null &&
  dateKey > toDateKey(estimatedEndDate) && !existingDoc;
```

### Banner Durumları (Yoklama Al ekranında)
| Durum | Renk | Mesaj |
|---|---|---|
| `canEdit=true` (Yoklama Detay, 3 gün içi) | Gri | "Bu yoklama kapatıldı — X gün içinde düzenleyebilirsiniz." |
| `!canEdit && withinEditWindow` (Yoklama Al, 3 gün içi) | **Turuncu** | "Yoklamanızı Yoklama Detay menüsünden düzenleyebilirsiniz." |
| `!canEdit && !withinEditWindow` (süresi dolmuş) | **Kırmızı** | "Yoklama düzenleme süresi doldu. Yoklamanızı düzenlemek için yöneticinizle iletişime geçiniz." |

### Yoklama Detay Butonu (Yoklama Al'da)
- Yalnızca `mode="simple" && attendanceClosed && dateKey 3 günden taze` koşulunda görünür
- 3 gün sonra (herkes için, admin dahil) tamamen gizlenir
- Admin Yoklama Detay'a menüden manuel girerek düzenleyebilir

### Haftanın Günleri
- `session` string'inden (`"Pazartesi-Çarşamba 10:00-13:00"`) `parseWeekDays()` ile parse edilir
- `TR_DAYS` map'i Türkçe kısaltmaları JS `Date.getDay()` değerlerine çevirir

### Takvim Kısıtları
- `maxDate = min(today, estimatedEndDate)` — kurs bitişi sonrası tarihe geçilemiyor
- `minDate = group.startDate` — grubun başlangıcından önce geçilemiyor
- `isPastCourseEnd` → "Eğitim programı tamamlandı" overlay mesajı

### handleStartLesson Güvencesi
```tsx
const handleStartLesson = async () => {
  if (!selectedGroupId || existingDoc) return; // mevcut veriyi asla ezme
  ...
};
```

### Sidebar Menü Sırası
Ana Sayfa → Sınıflar → Yoklamalar (accordion) → Ödevler (accordion) → Sertifikasyon → Sınıflar Ligi → Profil Ayarları

Yoklamalar accordion:
- Yoklama Al → `/attend`
- Yoklama Detay → `/dashboard/attendance-report`
- Yoklama Raporu → `/dashboard/attendance-summary` (admin only)

---

## Ödev Modülü — (2026-05-21 güncellendi)

### Route Yapısı
`assignment-test` → `assignment` olarak yeniden adlandırıldı.

```
/dashboard/assignment                          → grup listesi
/dashboard/assignment/[groupId]                → gruptaki ödevler
/dashboard/assignment/[groupId]/[assignmentId] → ödev detay (ana sayfa)
/dashboard/assignment/[groupId]/[assignmentId]/[submissionId]/preview → tam ekran önizleme
/dashboard/assignment/grading                  → not girişi
/dashboard/archive                             → ödev arşivi (tüm gruplar)
```

### Ödev Detay Sayfası (`[assignmentId]`)
- Sol: öğrenci listesi (Teslim Edenler / Revize / Teslim Etmeyenler)
- Sağ: seçili öğrencinin teslimi + Aktivite (timeline) + Yorumlar
- Yorumlar: **Duyuru** (genel, tüm sınıf) + **Özel Chat** (öğrenci bazlı) sekmeleri
- Detay Gör butonu (yeşil) → preview sayfasına gider

**`?mode=grading` URL param'ı (Not Girişi'nden gelince):**
- Sol öğrenci listesi gizlenir
- Yorumlarda yalnızca Özel Chat gösterilir (Duyuru sekmesi yok)
- Grading ve GradingTable navigasyonları bu param'ı ekler

**Bildirimden gelince otomatik öğrenci seçilir:**
```tsx
// URL param: ?student=STUDENT_ID
const studentParam = searchParams.get('student');
if (studentParam) { setViewingId(studentParam); autoSelectedRef.current = true; }
```

### Preview Sayfası (`[submissionId]/preview`)
- Tam ekran dosya önizleme (Drive iframe)
- Sağ panel: öğrenci–eğitmen özel thread (sohbet balonu stili)
- Gönderilen tüm dosya versiyonları listelenir, aktif dosya değiştirilebilir
- Revize İste / Onayla butonları top bar'da

### Bildirim actionUrl'leri
- Ödev yüklenince: `/dashboard/assignment/${groupId}/${taskId}?student=${studentId}&tab=private` ✅
- Yorum yapılınca: aynı format ✅
- İlgili dosyalar: `api/submit/route.ts`, `api/submissions/complete-upload/route.ts`, `api/comments/create/route.ts`

### Ödev Arşivi (`/dashboard/archive`)
- Arşivlenmiş grupların tüm ödevleri listelenir (grup accordion → ödev accordion → öğrenci tablosu)
- **Detay** butonu: her ödev için → `router.push(/dashboard/assignment/${groupId}?taskId=${taskId})`
- **İndir** butonu (yeşil): yalnızca eğitmen şablon dosyası varsa (attachmentUrl) görünür
- **PDF sütunu** (kitap/kolaj/sosyal-medya türlerinde): her öğrenci satırında o öğrenciye giden PDF — `İndir` butonu + dosya adı
- Drive URL'leri: `tasks/{taskId}.{kitap|kolaj|sosyal}DriveFiles.{studentId}` → arşiv sayfası açıldığında paralel `getDoc` ile çekilir
- Tablo stili: `text-[12px]`, `whitespace-nowrap`, `max-w-4xl`, ilk/son sütun `pl-8`/`pr-8`, hücre altı `pb-4`

### Google Drive Klasör Yapısı
```
Gruplar/
  {groupName}/
    Eğitmen/
      {instructorName}/
        {taskName}/
          {studentName}-{bookTitle|taskName}.pdf   ← kitap/kolaj/sosyal
    Öğrenciler/
      {studentName}/
        {taskName}/
          ...
Ödev Şablonları/
  {instructorName}/
    {taskName}/
      {templateFile}
```
- `createFolderStructure(groupName, userName, "instructor"|"student", taskName)` → `googledrive-folder.ts`
- `uploadBufferToFolder` + `setPublicReadPermission` → `googledrive.ts`
- send-kitap / send-kolaj / send-sosyal API'leri Drive'a yükleyip `driveUrl` döner
- Frontend bu URL'yi `tasks/{taskId}.{type}DriveFiles.{studentId}` olarak Firestore'a yazar

### StudentDetailModal — Yoklama Donuts (Placeholder)
- XP kartı ikiye bölündü: sol XP barları, sağ devam durumu
- `AttendanceDonut` bileşeni: %70↑ yeşil, %50-70 turuncu, %50↓ kırmızı, 0.6s animasyon
- Şu an rate=75 hardcoded placeholder — gerçek veri bağlantısı henüz yapılmadı

---

## Bildirim Sistemi

### Koleksiyon
`users/{uid}/notifications/{notifId}`

### useNotifications Hook
- `notifications` → filtrelenmiş liste (lastClearedAt sonrası)
- `unreadCount` → `!isRead && !isArchived` sayısı
- `markAsRead(id)` → optimistik + Firestore güncelle
- `clearAll()` → `lastClearedAt` timestamp set eder (siler değil, filtreler)

### NotificationBell UI
**Okunmuş bildirim görünümü (2026-05-19 eklendi):**
- `opacity-50` (soluk)
- Sağda `<Check size={13}>` ikonu (sabit görünür)

**Okunmamış:**
- Tam opaklık
- Hover'da `<ChevronRight>` (eski davranış)

---

## Öğrenci Portalı

- `/student/*` rotaları — öğrenciye özel layout (StudentSidebar)
- Auth UID → `users/{uid}.studentDocId` → `students/{studentDocId}`
- League sayfası login zorunlu (middleware.ts güncellendi)
- `sidebarReady` state ile auth flash engellendi

---

## Teknik Detaylar

### Grup Haftalık Günleri Parse
```tsx
function parseWeekDays(label: string): number[] // 0=Pazar...6=Ctesi
```
`session` field'ından çalışır: `"Pazartesi-Çarşamba"` → `[1, 3]`

### Tahmini Bitiş Tarihi
```tsx
calcEstimatedEndDate(startDate, totalSessions, weekDays, holidayDates)
// totalSessions = Math.ceil(totalHours / sessionHours)
```

### Monthly Done Count
`design_attendance` sorgusu: `groupId == x && month == YYYY-MM`
Sayım: `entries` dolu VEYA `attendanceClosed=true` olan doklar

---

## Sıradaki İşler (Öncelik Sırası)

1. **Kişiye & branşa özel puan toggle** ← SIRADAKI (büyük iş)
   - Sertifikasyon ayarlarında her puan kategorisi (ödev, devam, proje...) branş bazlı açılıp kapatılabilecek
   - Öğrenci bazlı override da olabilir (kişiye özel ağırlık)
   - Hangi field'ların Firestore'a yazılacağı, hangi hesaplama mantığının değişeceği netleştirilecek
   - Mevcut ilgili dosya: `src/app/components/dashboard/scoring/DesignParkour.tsx`, `dashboard/assignment/grading`

2. **StudentForm: isOnlineStudent toggle** — öğrenci ekleme/düzenleme formuna eklenecek

3. **Yoklamayı öğrenciye bağla** — StudentDetailModal donut'u gerçek veriyle doldur
   - `useStudentAttendance(studentId, groupId)` hook hazır, sadece modal'a bağlanacak
   - Öğrenci kendi devam oranını dashboard'da görsün

4. **Eğitmen testi** — yoklama + ödev modüllerini eğitmen hesabıyla test et

5. **Sertifikasyon akışı** — grading sayfası tamamlanacak
   - Puan ayarları Ödev Ayarları'ndan Sertifikasyon'a taşınacak ("Sertifika Not Ayarları")
   - Eğitmen not girer → real-time bildirim → Flex-Ops entegrasyonu

6. **Yoklama giriş kilidi** — ders saatinden 15dk önce kilitli / 30dk sonra kapanır (test bittikten sonra)

7. **Sertifika PDF + Dağıtım** — sertifika üretimi ve öğrenciye gönderim akışı

---

## Notlar / Bilinen Debt

- `design_attendance` koleksiyon adı ileride `attendance` olacak (Ops'a taşımadan önce)
- `designstudio-primary` gibi CSS token isimleri temizlenecek (çalışmayı bozmadan bekliyor)
- `bumpSeason()` şu an tüm sistemi sıfırlıyor — grup bazlı versiyon yazılacak
- Başka bir uygulama aynı DB'ye bağlı olarak yoklama için kullanılıyor — stabil değil, Flex-Trainer attendance ile uyumu değerlendirilecek
