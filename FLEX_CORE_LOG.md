# Flex Trainer — Core Development Log (Index)

> Detaylar için: `FLEX_CORE_LOG_ARCHIVE.md`
> Aylık detay logları: `logs/2026-04.md`, `logs/2026-05.md`

---

## Hızlı Referans

| Konu | Bölüm | Dosya |
|------|-------|-------|
| Kategori → Branş → Modül hiyerarşisi | §1 | `GroupBranchPanel.tsx` |
| Bildirim güvenilirliği (response öncesi await) | §2 | `submit/route.ts` |
| GroupForm modal yeniden tasarım | §3–4 | `GroupForm.tsx` |
| AttendancePanel alan adı düzeltmeleri | §5 | `AttendancePanel.tsx` |
| monthlyLessonCount KALDIRILDI | §6 | — |
| Yoklama günlük aktif/disabled sistemi | §7 | `AttendancePanel.tsx` |
| sessionHours grup düzeyinde | §8–9 | `GroupForm.tsx` |
| AttendancePanel UI düzeltmeleri | §10 | `AttendancePanel.tsx` |
| Tatil yönetimi (GroupBranchPanel) | §11 | `GroupBranchPanel.tsx` |
| Yoklama kayıt + otomatik kapanma cron | §12–15 | `attend/page.tsx` |
| Kurs ilerleme (completedLessons) | §16–18 | `AttendancePanel.tsx` |
| Yoklama raporları altyapısı | §19–30 | `attendance-report/` |
| Öğrenci sil / e-posta çakışması | §79–80 | `api/students/` |
| Güvenlik sertleştirme (rate limit, CSP) | §76–78 | `middleware.ts` |
| Ödev branş filtresi | §83–85 | `AssignmentLibrary.tsx` |
| Sentry entegrasyonu | §86 | `sentry.*.config.ts` |
| Yoklama zaman kilidi | §87 | `attend/page.tsx` |
| Upstash Redis rate limiting | §89 | `middleware.ts` |
| Route yeniden adlandırma (summary→report) | §94 | `app/` |
| Yoklama Raporu filtre çubuğu | §95–96 | `attendance-report/` |
| Framer Motion accordion navigasyon | §98 | `Sidebar.tsx` |
| AttendFlowTransition move animasyonu → KALDIRILDI | §108–112 | `layout.tsx` |
| Sidebar accordion sessionStorage kalıcılığı | §113 | `Sidebar.tsx` |
| ActivityFeed scroll sistemi (15 item, 7 görünür) | §132 | `home-v2/page.tsx` |
| Cuma tatili — standart gruplar için kurumsal tatil | §133 | `AttendancePanel.tsx`, `home-v2/page.tsx` |
| Cuma tatili field mismatch fix (`groupType`→`type`) | §134 | `AttendancePanel.tsx`, `home-v2/page.tsx` |
| Tamamlanan grup yoklama listesinden gizleme | §135 | `AttendancePanel.tsx` |
| Auto-select en yakın ders günü + attendanceClosed filtre | §136 | `AttendancePanel.tsx` |
| Home V4 — 4'lü kompakt ödev parkuru + onSnapshot hata yönetimi | §137–138 | `home-v4/page.tsx`, `DesignParkour.tsx` |
| Ana Sayfa V4 → yeni `/dashboard`, ActivityFeed Firestore + per-user | §139–142 | `dashboard/page.tsx`, `activityLog.ts` |
| Dashboard QuickActionCard büyük ekran iyileştirmeleri | §143 | `dashboard/page.tsx` |
| DesignParkour compact buton sistemi yenileme + "Ödev Atölyesi" | §144 | `DesignParkour.tsx` |
| AttendanceDetailContent "Detay" butonu + onGroupDetail prop | §145 | `AttendanceDetailContent.tsx` |
| Yoklama bitiş tarihi cap — tüm aktif gruplar için estimatedEndDate | §146 | `AttendancePanel.tsx`, `AttendanceDetailContent.tsx` |
| Takvim courseEndDate — bitiş sonrası ders günleri renksiz | §147 | `CalendarPopover.tsx`, `AttendancePanel.tsx` |
| Yoklama Detay slide animasyon — grup detayı sağdan açılır | §148 | `attendance-detail/page.tsx`, `AttendanceDetailContent.tsx` |
| Öğrenci Grup Geçmişi — studentHistory altyapısı | §149 | `lib/studentHistory.ts` |
| Öğrenci Grup Geçmişi — useManagement + graduation yazım noktaları | §150 | `useManagement.ts`, `graduation/page.tsx` |
| Admin backfill sayfası — migrate-history | §151 | `admin/migrate-history/page.tsx` |
| StudentDetailModal tabbed UI — Ders/Geçmiş/İletişim/Ödeme | §152 | `StudentDetailModal.tsx` |

---

## Son Durum (2026-06-01 — 2. güncelleme)

- **Yoklama modülü:** Tam çalışıyor (kayıt, kapanma, rapor, detay)
- **Cuma tatili (§133–134):** Standart gruplar Cuma günü tatil statüsünde — overlay amber renk, pulse yok, auto-select atlar. Field mismatch (`groupType`→`type`) düzeltildi.
- **Tamamlanan grup gizleme (§135):** `grading` sayfasında "Modülü Bitir" → grup doc'a `attendanceClosed: true` yazılıyor. `AttendancePanel` bu grupları listeden çıkarıyor.
- **Auto-select (§136):** Bugün dersi olan grup yoksa (Cuma, tatil vb.) en yakın ders günü olan grubu seçiyor. `type` alanı olmayan eski gruplar da Cuma'da doğru filtreleniyor.
- **AttendFlowTransition:** Animasyon vazgeçildi, `layout.tsx`'ten kaldırıldı
- **Notification:** Backend ✅, Frontend ⏸ (Figma bekleniyor)
- **Platform Genişlemesi:** Aşama 1+2 bitti, Aşama 3 beklemede (leagueEnabled toggle)
- **Home V2:** ActivityFeed scroll sistemi tamamlandı (§132)
- **Home V4 (§137–138):** `dashboard/home-v4` oluşturuldu — 4'lü kompakt ödev parkuru, beyaz hızlı eylem kartları, `onSnapshot` permission-denied hataları susturuldu
- **Ana Sayfa Swap + ActivityFeed (§139–142):** `home-v4` içeriği `/dashboard`'a taşındı, eski `/dashboard` → `home-v4`'e. ActivityFeed Firestore `activity_log`'a bağlandı (per-user, `limit 15`, canlı). `activityLog.ts` per-user yazım + tüm ödev işlemlerine logActivity eklendi. Banner/sidebar/footer tasarım güncellemeleri yapıldı.
- **Dashboard QuickActionCard (§143):** Büyük ekranlarda (`xl:`) kart yüksekliği +%25 (`xl:min-h-[194px]`), başlık `xl:text-[19px]`, ikon-başlık dikey ortalı, badge butonu `font-semibold xl:px-5`.
- **DesignParkour compact butonlar (§144):** Tüm butonlar `rounded-full` pill, `font-semibold`, `h-8 px-4` standart, mor "Detay" `pl-4 pr-3` (chevron optik dengesi), `gap-1`, "Tasarım atölyesi" → **"Ödev Atölyesi"** `text-[11px]` tüm kart tiplerine eşitlendı.
- **Yoklama bitiş tarihi cap (§146):** `estimatedEndDate` artık `attendanceClosed` koşulsuz tüm aktif gruplar için hesaplanıyor. `countWeekdaysInMonth`'a `endDate?` eklendi. Bitiş tarihinden sonraki günler planlanan derse dahil edilmiyor.
- **Takvim renk fix (§147):** `CalendarPopover`'a `courseEndDate` prop eklendi. Sadece kurs bitiş sonrası ders günleri renksiz; bugün-bitiş arası ders günleri hâlâ mavi.
- **Yoklama Detay slide animasyon (§148):** Grup satırındaki "Detay" butonuna basınca liste sola kayar, `AttendancePanel` sağdan gelir. Geri butonuyla tersine döner. `onGroupDetail` callback ile router.push kaldırıldı.
- **Öğrenci Grup Geçmişi altyapısı (§149–151):** `studentHistory.ts` — `GroupHistoryEntry`, `StudentSnapshot` tipleri, `batchAddGroupHistory`, `batchUpsertSnapshot`, `backfillStudentHistory`. `useManagement.ts` + `graduation/page.tsx`'e 4 yazım noktası eklendi (enrollment, transfer, archive, modül yükseltme). Firestore rules: `group_history` subcollection + `student_snapshots`. Admin backfill sayfası: `/dashboard/admin/migrate-history`. 28 öğrenci başarıyla migrate edildi.
- **StudentDetailModal tabbed UI (§152):** Ders / Geçmiş / İletişim / Ödeme tab'ları. Admin görür, eğitmen sadece ders içeriğini görür (tab bar gizli). Geçmiş tab'ında `group_history` subcollection'dan kayıtlar. İletişim + Ödeme şimdilik placeholder (ileride Eğitim Operasyon / Flex-CRM ile dolacak). Sabit boyut `min-h-135` wrapper.

---

## Home V2 — `/dashboard/home-v2` (§115–130)

**Durum:** Test sayfası çalışıyor, orijinal `/dashboard`'ın yerini alacak.

### Tamamlananlar
- `src/app/dashboard/home-v2/page.tsx` oluşturuldu
- **HomeBanner:** Lacivert (#10294C), 3 gerçek Firestore istatistik (Sınıf/Öğrenci/Ödev), `onSnapshot` canlı veri
- **3 Hızlı Eylem Kartı:** Hızlı Yoklama (mavi), Ödev Teslimi (turuncu), Sertifikasyon (mor) — renkli ikon alanları + pill badge butonları
- **ActivityFeed:** 15 mock aktivite, tip renkleri — scroll sistemi tamamlandı (§132)
- **FooterV2:** `h-14`, `flex-logo-white.svg` 70px
- **Sidebar:** `logo` prop eklendi → `flex-logo-title-white.svg` 165px
- **Header:** `innerClassName` prop eklendi → container hizalaması
- **FlexLogo bileşeni:** `src/app/components/ui/FlexLogo.tsx` — variant prop, Rubik font
- **Rubik font:** `layout.tsx`'e eklendi, CSS var `--font-rubik`
- **Container:** `max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]` — header + content + footer eşit
- **Küçük ekran fix:** QuickActionCard alt kısmı `pl-[44px]` kaldırıldı, badge `whitespace-nowrap shrink-0`
- **Ödev Teslimi:** `tasks` koleksiyonu `isActive==true` sayısı Firestore'dan gerçek zamanlı
- **Hızlı Yoklama akıllı pulse (§131):**
  - `holidays` koleksiyonu dinleniyor → tatil günü animasyon yok
  - `groups` (active) + `design_attendance` (bugün) dinleniyor
  - Her dakika: ders günü mü? `[sessionStart-15dk, sessionEnd+3sa]` penceresinde mi? Doc yok mu? → `animate-ping`
  - Meta: 1 grup → grup kodu (ör. "Grup 550"), 2+ → "3 grup", değilse tarih
  - Auto-dismiss: kart tıklanınca, `/attend` açılınca, `/dashboard/assignment` açılınca localStorage'a yazar → söner
  - Gün değişince otomatik sıfırlanır

### ActivityFeed Scroll Sistemi (§132) — TAMAMLANDI
- 15 mock aktivite, tümü render edilir (slice yok)
- Container: `max-height: calc((7 * 56px) + 24px)`, `overflow-y: auto`
- Her satır: `h-[56px] shrink-0 flex items-center`
- Padding: top 12px, bottom 24px, left/right 16px, `box-sizing: border-box`
- Custom scrollbar: 4px, `#CBD5E1` → hover `#10294C`, `scrollbar-gutter: stable`
- Panel `h-full` — banner'ın üstünden kartların altına kadar uzanır

### Cuma Tatili — Standart Gruplar (§133) — TAMAMLANDI
- `Group` interface'e `groupType` eklendi (`"standart"` | `"özel_ders"` | `"kurumsal"`)
- `isFridayBlock = groupType === "standart" && getDay() === 5` türetildi
- `isActiveForDate` artık `isFridayBlock` da kontrol ediyor
- `overlayMessage`: "Cuma günleri grup dersleri yoktur." — amber renk + CalendarOff ikonu (tatil gibi)
- `autoSelectToday`: Cuma'da standart grupları otomatik seçmiyor
- Grup listesi `hasClass`: Cuma bloku hesaba katılıyor
- Home-v2 pulse: Cuma'da standart gruplar için pulse yanmıyor
- `"özel_ders"` ve `"kurumsal"` gruplar etkilenmiyor

### Cuma Tatili Field Mismatch Fix (§134) — TAMAMLANDI
- **Kök neden:** Firestore'da alan adı `type` (useManagement → `type: groupType`), ama `AttendancePanel` `groupType` okuyordu → `undefined` → `isFridayBlock` hiç tetiklenmiyordu
- `AttendancePanel.tsx`: `Group` interface `groupType?` → `type?`, 3 ayrı `g.groupType` → `g.type`
- `home-v2/page.tsx`: ref tipi, Firestore okuma ve pulse kontrolü → `type`
- **Ek fix:** Eski gruplar `type` alanı olmayabilir → Cuma kontrolü `type === "standart"` yerine `type !== "özel_ders" && type !== "kurumsal"` olarak tersine çevrildi

### Tamamlanan Grup Yoklama Listesinden Gizleme (§135) — TAMAMLANDI
- `grading/page.tsx` → "Modülü Bitir" (GRAFIK_2 finalize) → grup doc'a `attendanceClosed: true` + `attendanceClosedAt` yazıyor
- `AttendancePanel.tsx`: grup yüklenirken `isActiveGroup = status !== "archived" && !attendanceClosed` filtresi eklendi
- Admin ve eğitmen sorguları her ikisi de bu filtreyi kullanıyor
- Sonuç: GRAFIK_2 bitirilen gruplar yoklama listesinden otomatik düşüyor

### Auto-Select En Yakın Ders Günü (§136) — TAMAMLANDI
- **Eski:** `todayMatch` bulamazsa `groups[0]` — dersi bitmiş/yanlış grup seçiliyordu
- **Yeni:** `todayMatch` yoksa her grup için "kaç gün sonra ders var?" hesaplanır, en küçük offset'li grup seçilir
- Cuma + type'sız eski gruplar da doğru filtreleniyor (`type !== "özel_ders" && type !== "kurumsal"`)
- Örnek: Cuma günü → Pazartesi dersi olan Grup 598 otomatik seçilir

### Eksikler / Sonraki Oturum
- [x] **ActivityFeed Firestore bağlantısı** — TAMAMLANDI (§140)
- [ ] Sol üst geniş alan (HomeBanner altı) — WorkshopAnalysis benzeri bir widget gelecek

---

## Ana Sayfa Yenileme — `/dashboard` (§139–142)

### Sayfa Swap (§139) — TAMAMLANDI
- `home-v4` içeriği `/dashboard/page.tsx`'e taşındı (yeni ana sayfa)
- Eski `/dashboard` içeriği → `dashboard/home-v4/page.tsx`'e taşındı

### ActivityFeed Firestore Bağlantısı (§140) — TAMAMLANDI
- `activity_log` koleksiyonu: `userId`, `type`, `title`, `description`, `createdAt`
- `where("userId", "==", uid)` + `orderBy("createdAt", "desc")` + `limit(15)` — per-user, canlı
- Firestore composite index oluşturuldu (`userId + createdAt desc`)
- Firestore rules: `activity_log` için okuma/yazma kuralları eklendi
- `activityLog.ts`: `auth.currentUser?.uid` ile per-user yazım, debug log'lar temizlendi

### logActivity Kapsamı Genişletme (§141) — TAMAMLANDI
- Tüm ödev işlemlerine logActivity eklendi: oluşturma, iptal, arşiv, aktifleştirme, silme, güncelleme
- Format: `title = "İşlem (GrupKodu)"`, `description = "ÖdevAdı"`
- Etkilenen dosyalar: `DesignParkour.tsx`, `QuickAssignModal.tsx`, `AssignmentLibrary.tsx`, `TaskManagementPanel.tsx`, `TasksContent.tsx`

### Tasarım Güncellemeleri (§142) — TAMAMLANDI
- Banner: `p-8` (32px her yön), stat kutucukları küçültüldü, gap 24px
- Sidebar: `flex-logo-white.svg` 90px, menü `mt-12`, aktif item arka plan kaldırıldı (sadece turuncu ikon)
- Footer: 64px yükseklik, logo 64px, yıl dinamik `new Date().getFullYear()`
- ActivityFeed: yükseklik JS ile kartlara eşitleniyor (ResizeObserver), "Canlı" badge yeşil pulse noktası
- Aktivite başlığında grup kodu parantez içinde gri ve küçük (`text-[11px] font-medium text-[#4B5563]`)
- Loading state: beyaz flash yerine `#F4F6F9` arka planlı spinner

---

## Dashboard + DesignParkour İyileştirmeleri (§143–144)

### QuickActionCard Büyük Ekran (§143) — TAMAMLANDI
- Kart: `xl:min-h-[194px]` (%25 yükseklik artışı, küçük ekran `155px` korundu)
- Başlık: `xl:text-[19px]`, ikon ile `items-center` dikey hizalama
- Badge buton: `font-semibold`, `xl:text-[15px] xl:px-5 xl:py-2`

### DesignParkour Compact Buton Sistemi (§144) — TAMAMLANDI
- Tüm aksiyon butonları `rounded-full` (pill)
- `font-semibold` (bold'dan düşürüldü)
- Compact yükseklik `h-8`, padding `px-4` standardize edildi
- Mor aktif "Detay" butonu: `pl-4 pr-3` (chevron sağ ağırlığı için asimetrik)
- ChevronRight: `gap-1`, `shrink-0`, `leading-none` wrapper ile dikey hizalama
- "Tasarım atölyesi" → **"Ödev Atölyesi"** — tüm kart tiplerinde `text-[11px]`, `opacity-60` kaldırıldı
- "Ödev Ver" (sağ üst): `rounded-xl` (12px)

---

## Yoklama Bitiş Tarihi + Takvim (§146–147)

### estimatedEndDate Cap — Tüm Gruplar (§146) — TAMAMLANDI
- **Kök neden:** `estimatedEndDate` yalnızca `attendanceClosed === true` olduğunda hesaplanıyordu → aktif gruplar sınırsız ders günü sayıyordu
- `AttendanceDetailContent.tsx`: `g.attendanceClosed &&` koşulu kaldırıldı
- `AttendancePanel.tsx`: `countWeekdaysInMonth`'a `endDate?` eklendi; `courseTotalHours`/`totalSessions`/`estimatedEndDate` hesabı `plannedCount`'tan önceye alındı; grup listesinde de per-group `gEndStr` hesaplanıp geçiliyor
- Sonuç: Tüm gruplar tahmini bitiş tarihinden sonraki günleri planlanan derse saymıyor

### Takvim courseEndDate (§147) — TAMAMLANDI
- **Kök neden:** `maxDate = today` olduğunda bugün-bitiş arası tüm ders günleri renksizleşiyordu
- `CalendarPopover.tsx`: `courseEndDate?: string` prop eklendi; `isAfterCourseEnd` bayrağı türetildi
- Yalnızca `courseEndDate`'ten sonraki ders günleri plain disabled; öncekiler mavi kalmaya devam ediyor
- `AttendancePanel.tsx`: `DayCalendarPopover`'a `courseEndDate={estimatedEndStr}` geçildi

---

## Yoklama Detay Slide Animasyon (§148)

### Slide Animasyon + onGroupDetail (§148) — TAMAMLANDI
- `attendance-detail/page.tsx`: Framer Motion ile iki panel — liste sola (`x: -100%`), detay sağdan (`x: 100%→0`)
- Geçiş: `tween 0.3s ease [0.4,0,0.2,1]` — `attend/page.tsx` ile aynı pattern
- Detay panel: `AttendancePanel preSelectedGroupId + allowEdit + onBack`
- `AttendanceDetailContent.tsx`: `onGroupDetail?: (groupId) => void` prop eklendi; verilmezse eski `router.push` davranışı korunur
- Geri butonu: `AttendancePanel`'in sol sütun üstü — `onBack` prop ile ay seçicinin 24px üzerinde

---

## Home V4 — `/dashboard/home-v4` (§137–138)

### Home V4 Oluşturma (§137) — TAMAMLANDI
- `src/app/dashboard/home-v4/page.tsx` oluşturuldu — `home-v3` baz alındı
- 3 hızlı eylem kartı `bg-white` yapıldı (v3'te renkli tint vardı)
- `DesignParkour` çağrısı: `gridClassName="grid-cols-2 sm:grid-cols-4"`, `compact={true}`, `maxSlots={4}`

### DesignParkour compact + maxSlots prop'ları (§137) — TAMAMLANDI
- `gridClassName`, `compact`, `maxSlots` prop'ları eklendi (default'lar v3'ü etkilemez)
- `compact=true`: padding `p-7`→`p-4`, ikon `w-12`→`w-9`, başlık `text-[17px]`, buton padding azaldı
- `maxSlots=4`: ghost + placeholder ile her zaman 4 slot dolu
- Grup ismi başlık altına taşındı (`text-[13px]`, ayrı `<p>` elemanı, `·` ayırıcı)
- Aktif kart mor buton compact modda: `px-5`→`px-3`, metin `"Ödev Detay"`→`"Detay"`
- Expired/completed "Detay" butonu compact modda: `px-3`→`px-2`
- Footer'da "Tasarım atölyesi" yazısı `absolute` konuma alındı → butonlar üzerine serbestçe geliyor

### onSnapshot Permission-Denied Hata Yönetimi (§138) — TAMAMLANDI
- `home-v3`, `home-v4`, `DesignParkour` içindeki tüm `onSnapshot` çağrılarına `() => {}` error callback eklendi
- Yetkisiz kullanıcıda Firebase `permission-denied` sessizce yutulur, konsola hata fırlatılmaz

---

## Yapılacaklar / Bekleyenler

### Kısa Vadeli
- [x] **Ana Sayfa ActivityFeed Firestore bağlantısı** — TAMAMLANDI (§140)
- [x] **Öğrenci Grup Geçmişi** — TAMAMLANDI (§149–152). Altyapı + backfill + tabbed UI kuruldu.
- [ ] **Firestore şişmesi — month filtresi:** `design_attendance` + `lesson_exceptions` onSnapshot'larına `where("month", "==", monthKey)` ekle (`AttendancePanel.tsx:534,543`)
- [ ] **Platform Aşama 3 — leagueEnabled toggle:** `GroupForm` + `useManagement` + `LeagueWidget` + `LeaderboardWidget` + `StudentLeagueWidget`
- [ ] **Kitap PDF Arşivi:** `send-kitap` Drive'a kaydetmiyor; eğitmen kendi gönderdiği kitapları UI'dan göremez
- [ ] **Notification Frontend:** Figma linki bekleniyor (PC'de devam edilecek)
- [ ] **Sertifikasyon kartı gerçek veri** — sertifika sistemi güncellendikten sonra yapılacak (`dashboard/page.tsx` QuickActionCard meta)

### Uzun Vadeli (Acele Değil)
- [ ] **Sertifika PDF + Dağıtım:** `react-pdf` + `send-kitap` pattern — şablon tasarımı kararlaştırılacak
- [ ] **Dashboard Hızlı Yoklama Widget:** `/attend?groupId=xxx` shortcut kartı
