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
| Chrome Guest Mode multi-tab logout fix — 3s debounce | §153 | `UserContext.tsx` |
| Yoklama sayfası geri dönüşte "Kaydet" bug fix — saved state restore | §154 | `AttendancePanel.tsx` |
| ActivityFeed yoklama mesajları — başlatıldı/bitirildi/otomatik bitirildi | §155 | `AttendancePanel.tsx`, `auto-close-attendance/route.ts` |
| Auth: authStateReady() ile yeni tab logout bug'ı + notification debug | §156–157 | `UserContext.tsx`, `NotificationRealtimeService.ts` |
| attendance-detail refactor: Suspense, header onBack, enforceTimeWindow | §158–160 | `attendance-detail/page.tsx`, `Header.tsx` |
| AttendancePanel 4K hizalama: max-w-[1620px], donut max-w kaldırıldı | §161 | `AttendancePanel.tsx` |
| attend sayfası: logo düzeni, header hizalama, back btn kaldırıldı | §162 | `attend/page.tsx` |
| AttendanceDetailContent: StatCard yükseklik + search genişliği (xl/2xl) | §163 | `AttendanceDetailContent.tsx` |
| StudentDetailModal: online/yüzyüze saat breakdown, font weight azaltıldı | §164 | `StudentDetailModal.tsx` |
| UserTable: responsive layout, HoverPopover, BranchCell/RoleCell +N chip | §165 | `UserTable.tsx` |
| AttendanceDetailContent + attendance-detail header hizalama | §166 | `AttendanceDetailContent.tsx`, `attendance-detail/page.tsx` |
| Yoklama Al → Detay geri butonu (onBackToAttend) | §167 | `AttendancePanel.tsx`, `attend/page.tsx` |
| AttendancePanel filterMonth + preSelectedMonth + 3 ay kilidi | §168 | `AttendancePanel.tsx` |
| Yoklama Raporu 4 katlı slide panel yeniden tasarımı | §169 | `attendance-report/page.tsx` |
| Rapor: eğitmen grup tablosu + yoklama geçmişi + günlük detay paneli | §170 | `attendance-report/page.tsx`, `AttendancePanel.tsx` |
| Rapor: 4 panel → 3 panel (split view: sol gruplar, sağ geçmiş) | §171 | `attendance-report/page.tsx` |
| totalDoneCount onSnapshot → getDocs (Firestore şişme önlemi) | §172 | `AttendancePanel.tsx` |
| Announcements rules: teacher→instructor, isAdmin()/isInstructor() helper | §173 | `firestore.rules` |
| API route auth standardizasyonu — withAuth() wrapper | §174 | `lib/with-auth.ts`, 7 route |
| students read: öğrenciler sadece kendi kaydını okuyabilir | §175 | `firestore.rules` |
| Middleware JWT imza doğrulaması — jose RS256 | §176 | `middleware.ts` |
| AttendancePanel geçmiş ders süresi dolmuş kilidi + 6 saat penceresi | §177 | `AttendancePanel.tsx` |
| StudentDetailModal — Genel tab + profesyonel avatar + Sertifikasyon şeritleri | §178 | `StudentDetailModal.tsx` |
| StudentDetailModal — tam yeniden tasarım: grid layout, branş erişim kontrolü | §179 | `StudentDetailModal.tsx` |
| attendance-report: onBackChange optional + guard, stale build artifact tespiti | §180 | `attendance-report/page.tsx` |
| Not Ayarları auto-save (700ms debounce), Kaydet butonu kaldırıldı | §181 | `grading/page.tsx` |
| Ödev puanı hesaplama fix: useAssignment=false→0, live weights, finalize fallback | §182 | `grading/page.tsx` |
| StudentDetailModal certSettings entegrasyonu: hardcoded 0.7/30 kaldırıldı | §183 | `StudentDetailModal.tsx` |
| Yoklama detay kilitli + Düzenle butonu + ders aktifken lock | §186a-c | `AttendancePanel.tsx` |
| Detail paneli son ders tarihine atlar | §186d | `AttendancePanel.tsx` |
| attendance-detail panel state URL'e taşındı | §186e | `attendance-detail/page.tsx` |
| Sidebar Yoklama Detay hardNav + dropdown otomatik kapanır | §186f-g | `Sidebar.tsx` |
| GroupForm modal max-w-5xl, max-h büyütüldü, seans truncate fix | §186h | `GroupForm.tsx`, `ManagementContent.tsx` |

---

## ✅ §186 — Yoklama Detay + Düzenle Butonu + Sidebar + GroupForm (2026-06-10)

### §186a — Ders Aktifken Detail Panelden Düzenleme Engellendi
`isReadonlyView` koşuluna `(existingDoc && !attendanceClosed && isToday && mode !== "simple")` eklendi. Ders başlatılmış ama bitmemişken yoklama-detay slide ve dashboard attendance-detail sayfasından düzenleme artık kapalı. Ana attend paneli (`mode="simple"`) etkilenmez. `AttendancePanel.tsx:967`.

### §186b — Dersi Başlat Öncesi Öğrenci Listesi Pasif
Öğrenci listesi opacity koşuluna `(mode === "simple" && isToday && !existingDoc && !hasPersistedEntries && !attendanceClosed)` eklendi. Saat penceresi açılsa bile "Dersi Başlat" basılmadan liste gri + pointer-events-none. `AttendancePanel.tsx:1638`.

### §186c — Yoklama Detay: Varsayılan Kilitli + "Düzenle" Butonu
- Detail panelinde kapatılmış yoklama herkese varsayılan kilitli — `isReadonlyView` koşulu `(attendanceClosed && (!canEdit || !editUnlocked))` oldu.
- `editUnlocked` state eklendi (grup/tarih değişince sıfırlanır).
- "Düzenle" butonu: Temizle'nin 32px solunda. Admin/yönetici → her zaman aktif. Eğitmen → 3 gün içinde aktif, sonra disabled.
- "Düzenle" basılınca `editUnlocked=true` + `setSaved(false)` → "Kaydedildi" otomatik "Güncelle" olur.
- "Güncelle" sonrası `setEditUnlocked(false)` → otomatik tekrar kilitlenir. `AttendancePanel.tsx`.

### §186d — Detail Paneli Son Ders Tarihine Atlar
`preSelectedGroupId` değişince `design_attendance` koleksiyonundan o grubun tüm kayıtları çekilir, en büyük `date` alanı bulunur, `selectedDate` + `selectedMonth` set edilir. Composite index gerektirmez (JS sort). `AttendancePanel.tsx`.

### §186e — attendance-detail Panel State URL'e Taşındı
`showGroupDetail` / `detailGroupId` local state'ten URL parametrelerine (`?detail=groupId&detailMonth=...&detailClosed=...`) taşındı. Sidebar "Yoklama Detay" linki `/dashboard/attendance-detail` (param yok) → panel kapanır. Back butonu `buildListUrl()` ile list param'larını korur. `attendance-detail/page.tsx`.

### §186f — Sidebar "Yoklama Detay" Hard Navigation
`SidebarLink`'e `hardNav` prop eklendi — `<Link>` yerine `<a href>` kullanır, tam sayfa geçişi yapar. "Yoklama Detay" bu prop ile işaretlendi. Sidebar'dan tıklanınca animasyon yok, loader ile sayfa taze gelir. `Sidebar.tsx`.

### §186g — Sidebar Yoklama Dropdown Otomatik Kapanır
`pathname` değişince `/dashboard/attendance` dışına çıkıldığında `setYoklamaOpen(false)` tetiklenir. `Sidebar.tsx`.

### §186h — GroupForm Modal Boyutu Büyütüldü
- `ManagementContent.tsx`: dış padding `p-3 sm:p-6` → `p-2 sm:p-4 lg:p-6`, wrapper `max-w-4xl` → `max-w-5xl`.
- `GroupForm.tsx`: `max-h-[90vh]` → `max-h-[96vh] sm:max-h-[92vh]`.
- Seans span: `min-w-0 truncate text-[12px] sm:text-[13px]` — flex container içinde uzun seans metni düzgün truncate olur.

### Commit Edilecek Dosyalar
- `src/app/components/dashboard/attendance/AttendancePanel.tsx` — §186a-d
- `src/app/dashboard/attendance-detail/page.tsx` — §186e
- `src/app/components/layout/Sidebar.tsx` — §186f-g
- `src/app/components/dashboard/ManagementContent.tsx` — §186h
- `src/app/components/dashboard/class-management/GroupForm.tsx` — §186h
- `src/app/components/dashboard/student-management/StudentForm.tsx` — newline fix
- `FLEX_CORE_LOG.md` — bu kayıt

---

## ✅ ÇÖZÜLDÜ — §184 Mezuniyet + §185 Re-Enrollment + UI Düzeltmeleri (2026-06-09)

> **commit: `f4fafd1`**

### §184 — Grup Arşivleme Öğrenciyi Mezuna Düşürmüyordu (ÇÖZÜLDÜ)
**Gerçek kök neden UI filtresiydi** (önceki "groupId eksik" teşhisi yanlıştı). Firestore yazımı `e03a38d` ile zaten düzelmişti — öğrenci `status: passive`, `groupId: "unassigned"` oluyordu. Mezun listede görünmemesinin nedeni **iki ayrı UI filtre katmanı**:
1. `useManagement.ts` `filteredStudents` — "Mezun" paneline geçilse bile `viewMode` (`group-list`/`all-groups`) grup filtresi çalışmaya devam ediyordu; mezunun `groupId`'si `"unassigned"` → eleniyordu. **Fix:** passive panel bloğunda sahiplik kontrolünden sonra `return true` (viewMode filtreleri passive'e uygulanmaz).
2. `ManagementContent.tsx` — branş (discipline) filtresi `disciplineGroupIds.has(s.groupId)` ile eliyordu (`"unassigned"` hiçbir grupta yok). **Bu, ilk fix'ten sonra hayatta kalan asıl katmandı.**

### §184b — Mezun Tablosunda "Mezun (X)" İbaresi (ÇÖZÜLDÜ)
`StudentTable.tsx:177` — sınıf kolonunda `groupCode?.replace(/^Mezun \((.*)\)$/, "$1")`. Zaten Mezun panelindeyken tekrar gereksizdi; aktif öğrencide prefix olmadığı için koşulsuz güvenli.

### §184c — Grup Silinince Mezun Öğrenci Listeden Kayboluyordu (ÇÖZÜLDÜ)
Arşiv grubu **tamamen silinince** mezunun `lastGroupId`'si artık var olmayan gruba bakıyor → branş filtresi eliyordu. **Fix:** `ManagementContent.tsx` `matchesDiscipline()` — passive öğrenci için grup lookup yerine öğrencinin kendi `discipline` alanı kullanılıyor; yoksa `lastGroupId` lookup; o da yoksa her branşta gösterilir (yetim mezun kaybolmasın). `Student` interface'e `discipline?` eklendi.

### §185 — Mezun Öğrenciyi Yeni Gruba Alma (GEÇİCİ ÇÖZÜM)
> Kalıcı çözüm sıfırdan öğrenci/grup yazımında (EduOS, Kişi≠Kayıt modeli) ele alınacak. Bu geçici.

**Akış:** Mezun panel → öğrenci satırında kalem (Düzenle) → formda aktif grup seç → kaydet. Mevcut transfer akışına bağlandı (`handleSave`, `useManagement.ts`):
- `status` passive→active, yeni gruba geçer, mezun listeden düşer, `group_history`'ye "transfer" kaydı yazılır.
- **Mezuniyet işaretçileri temizleniyor:** passive→active geçişte `lastGroupId`/`lastGroupCode`/`graduatedAt` `deleteField()`. (Yoksa eski arşiv grubu geri yüklenirse `restore` akışı öğrenciyi yeni grubundan koparırdı.)
- **Footgun guard:** `groupId === "unassigned"` ise status zorla aktife çevrilmez (mezunu sadece düzenlerken yanlışlıkla aktife düşmesin).
- **Eski veri korunur:** yoklama `design_attendance` (`{groupId}_{tarih}` key'li, öğrenci dokümanından bağımsız), ödev puanları `gradedTasks` (classId/grup kodu etiketli, silinmiyor), mezuniyet `group_history` — hiçbiri transfer'den etkilenmez.

### Aynı Oturumda Yapılan Diğer UI Düzeltmeleri
- **Login logosu:** `login/page.tsx` `<FlexLogo variant="dark" />` — beyaz kart üzerinde white logo görünmüyordu.
- **GroupForm küçük ekran:** 3 grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, iç padding `p-5 sm:p-8 lg:p-10`, modal dış padding `p-3 sm:p-6` (`GroupForm.tsx` + `ManagementContent.tsx`).
- **Toast bastırma:** `NotificationToastListener.tsx` — eğitmen ödev detay/`preview` alt sayfasındayken message toast'ı çıkmasın. `===` tam eşleşme → `startsWith(targetPath + '/')` ön-ek kontrolü (preview alt route'u da kapsar).
- **Logout permission-denied:** error callback'siz `onSnapshot`'lar → `Sidebar.tsx:49` (`settings/platform`, her sayfada mount + logout butonu burada, asıl suçlu) ve `ManagementContent.tsx:65` (`branches`) → `() => {}` eklendi.

### Commit Edilecek Dosyalar (working tree)
- `src/app/hooks/useManagement.ts` — §184 viewMode filtresi, §185 re-enrollment + lastGroupId temizliği + footgun guard, `Student.discipline?`
- `src/app/components/dashboard/ManagementContent.tsx` — §184c `matchesDiscipline`, branches onSnapshot error cb, modal padding
- `src/app/components/dashboard/student-management/StudentTable.tsx` — §184b "Mezun" prefix kaldırma
- `src/app/components/dashboard/class-management/GroupForm.tsx` — responsive grid + padding
- `src/app/login/page.tsx` — logo variant dark
- `src/app/components/notifications/NotificationToastListener.tsx` — toast bastırma ön-ek
- `src/app/components/layout/Sidebar.tsx` — settings/platform onSnapshot error cb
- `FLEX_CORE_LOG.md` — bu kayıt

---

## Son Durum (2026-06-07) — güncellendi

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
- **Chrome Guest Mode logout fix (§153):** `onIdTokenChanged(null)` geldiğinde anında logout yerine 3 saniyelik debounce eklendi. Multi-tab açılışında Firebase geçici null ürettiğinde shared cookie silinmiyordu; timer içinde `auth.currentUser` kontrol edilerek gerçek logout/iptal ayrımı yapıldı. `UserContext.tsx`.
- **Yoklama saved state restore (§154):** Yoklama sayfasından ayrılıp geri dönünce "Dersi Bitir" yerine "Kaydet" görünüyordu; her "Kaydet"te duplicate activity log yazılıyordu. Kök neden: `onSnapshot` callback'inde `d.exists()` durumunda `setSaved` hiç set edilmiyordu. Fix: `setSaved(entries dolu || attendanceClosed)` eklendi. `AttendancePanel.tsx:634`.
- **ActivityFeed yoklama mesajları (§155):** `handleStartLesson` → `"Grup 550 25 Haziran 2026 yoklaması başlatıldı"`. `handleCloseLesson` → `"Grup 550 25 Haziran 2026 yoklaması bitirildi"`. Cron `auto-close-attendance` → `"Grup 550 25 Haziran 2026 yoklaması otomatik bitirildi"`. `groupCode` artık `design_attendance` dokümanına da yazılıyor (cron ekstra sorgu yapmıyor).
- **Auth authStateReady fix (§156):** PC'de yeni tab açılınca logout olma bug'ı çözüldü. Kök neden: Firebase token refresh sırasında `onIdTokenChanged(null)` geliyor, eski 3s debounce yetmiyordu. Fix: `auth.authStateReady()` promise'inden sonra subscribe edildi — başlangıç null'u hiç gelmiyor. Post-init null için Guest Mode koruması 3s debounce korundu. `UserContext.tsx`.
- **Notification debug logları (§157):** `NotificationRealtimeService.subscribe()`'a benzersiz `#ID (caller)` logları eklendi. `NotificationBell`, `NotificationToastListener`, `useNotifications` mount/unmount logları. Araştırma sonucu: triple subscription auth bug'ının yan etkisiydi — `authStateReady()` fix'i ile çözüldü, artık 2 subscription normal (Bell + ToastListener). Loglar production'da aktif bırakıldı.
- **attendance-detail refactor (§158–160):** `page.tsx` Suspense + `AttendanceDetailMain` iç bileşenine bölündü (`useSearchParams` gereksinimi için). Back button `AttendancePanel` sidebar'ından `Header`'a taşındı (`onBack` prop). Liste görünümünde `router.back()`, grup detayında `setShowGroupDetail(false)`. `enforceTimeWindow={true}` eklendi — attendance-detail'dan da zaman kilidi artık çalışıyor. `Header.tsx`'e `onBack?: () => void` prop + `ArrowLeft` eklendi.
- **AttendancePanel 4K hizalama (§161):** `max-w-[1920px]` → `max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]` — header ile hizalandı. Donut bölümündeki gereksiz `max-w-[1200px]` iç wrapper kaldırıldı — donut ve tablo artık aynı genişlikte. Sol sidebar `pt-6` → `pt-5`, sağ içerik de `pt-5` eşitlendi.
- **attend sayfası düzenlemeleri (§162):** Logo yanındaki back button kaldırıldı (logo zaten `/dashboard`'a gidiyor). `topBar` container `max-w-[1920px]` → `max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]` — AttendancePanel ile hizalandı. Sol bölüm `bg-neutral-50 border-r w-[260px]` korundu (gri alan bütünlüğü için). `gap-4` kaldırıldı, `px-4` ile sidebar içeriğine hizalandı.
- **AttendanceDetailContent büyük ekran (§163):** `StatCard` (4 kutu) `py-4` → `xl:py-6 2xl:py-7` — büyük ekranlarda yükseklik artar. Search input `w-44` → `xl:w-64 2xl:w-80`. Ana wrapper `max-w-6xl` → `max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]` header hizalaması.
- **UserTable responsive layout (§165):** Tüm sabit `w-X xl:w-X` sütun genişlikleri kaldırıldı — yatay scroll sorunu çözüldü. `HoverPopover` ortak bileşeni eklendi: trigger üzerinde hover'da içerik tam ortada yukarı çıkar (ok işareti dahil). `BranchCell`: ilk branş + `+N` chip, hover'da tümü görünür. `RoleCell`: aynı pattern roller için. Email, isim, şube hücrelerine truncate + hover ile tam metin. `İşlem` sütunu sticky right + centered, küçük ekranda kompakt buton gap'i. `Durum` sütunu centered. Telefon fontu küçük ekranda `text-[11px]`.
- **AttendanceDetailContent + header hizalama (§166):** `AttendanceDetailContent` wrapper `w-[94%] max-w-[1300px]` → `w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8`. `attendance-detail/page.tsx` Header `innerClassName` da aynı `px-4 sm:px-6 lg:px-8` yaklaşımına geçirildi.
- **StudentDetailModal online/yüzyüze (§164):** `AttendanceDoc` interface'e `online?: boolean` eklendi. `attOnlineHours` + `attInPersonHours` state'leri ve hesaplama eklendi. Devam Durumu kartında Devamsızlık altında `• Yüzyüze: X saat` + `• Online: X saat` (sadece katılım > 0 iken). Font weight `font-black text-[22px]` → `font-bold text-[14px] xl:text-[16px]` — küçük ekranlarda sığıyor.
- **totalDoneCount Firestore fix (§172):** `AttendancePanel`'de tüm zamanları dinleyen `onSnapshot` → `getDocs` dönüştürüldü. Koleksiyon büyüdükçe şişmeyi önler. `AttendancePanel.tsx:616`.
- **Announcements rules fix (§173):** `teacher`/`instructor` rol ismi tutarsızlığı giderildi. `isAdmin() || isInstructor()` helper'larına geçildi — admin artık duyuru oluşturabilir/okuyabilir/silebilir. `firestore.rules`.
- **Middleware JWT imza doğrulaması (§176):** `decodeJwtPayload` (base64 decode only) → `jose` `compactVerify` + Google Firebase JWKS (`RS256`). Sahte JWT artık middleware'i geçemiyor. `exp` kontrolü yapılmıyor — Firebase SDK token refresh akışı bozulmasın. Edge Runtime uyumlu. Bağımlılık: `jose@^6.2.3`. `middleware.ts`.
- **students read kısıtlaması (§175):** `allow read: if isInstructor() || request.auth.uid == studentId || resource.data.authUid == request.auth.uid` — öğrenciler artık sadece kendi kaydını okuyabilir. Eğitmen/admin erişimi korundu, frontend değişikliği gerekmedi. `firestore.rules`.
- **API auth standardizasyonu (§174):** `src/app/lib/with-auth.ts` — `withAuth(handler, { roles, allowAdminSecret })` wrapper. Bearer token + `x-admin-secret` desteği, tutarlı 401/403 hataları. Migrate edilen route'lar: `student/set-account-status`, `notifications/broadcast`, `notifications/task-assigned`, `admin/migrate-custom-claims`, `users/create`, `task-assigned`, `admin/send-welcome-all`, `admin/send-activation-codes`. `student/sync` ve `comments/create` kendine özgü logic nedeniyle migrate edilmedi.
- **AttendancePanel geçmiş ders kilidi (§177):** `isPastExpired = enforceTimeWindow && !isToday && !existingDoc` boolean eklendi. Geçmiş tarihli, kaydı olmayan derse ait yoklama tüm panel pasif + amber banner: "Bu ders için yoklama giriş süresi dolmuştur. Düzeltme yapılması gerekiyorsa Eğitim Operasyona başvurunuz." Zaman penceresi 3 saat → **6 saat** (`WINDOW_AFTER_MIN = 360`) genişletildi. `AttendancePanel.tsx`.
- **attendance-report stale build + onBackChange fix (§180):** Sentry'deki `expandedInstructorId`, `onBackChange`, `instructorGroups`, `AnimatePresence`, `motion` hataları incelendi — tamamı eski build artifact'ları, mevcut kaynak temiz. `onBackChange` prop optional (`?`) yapıldı + `useEffect` içine `if (!onBackChange) return` guard eklendi — build mismatch durumunda crash önlenir. `attendance-report/page.tsx`.
- **Not Ayarları auto-save (§181):** `NotAyarlariPanel`'de manuel "Kaydet" butonu kaldırıldı. `localSetting` değişince 700ms debounce ile Firestore'a otomatik yazılıyor. `readyRef` ile ilk yükleme ve branş değişiminde gereksiz save tetiklenmez. Footer: `Kaydediliyor… → Kaydedildi. → Değişiklikler otomatik kaydedilir`. "Tüm Branşlara Uygula" korundu. `grading/page.tsx`.
- **Ödev puanı hesaplama fix (§182):** `getOdevPuani` ve render `rawOdevPuani` fonksiyonlarında iki kritik fix: (1) `maxOdevPuani === 0` (useAssignment=false) ise finalized kaydına bakılmaksızın 0 döner → toplam = proje notu. (2) `maxXP > 0` ise her zaman canlı `studentXPs / maxXP * maxOdevPuani` hesaplanır — ağırlık değişince (örn. 30→20) tüm ödev notları anında doğru yeniden hesaplanır; task silinmişse (`maxXP=0`) `savedOdevPuanis` fallback olarak kullanılır. `grading/page.tsx`.
- **StudentDetailModal certSettings (§183):** `calcModuleStats` `maxOdevPoints` parametresi aldı — hardcoded `30` kaldırıldı. `makeGrade`'deki hardcoded `0.7` kaldırıldı. Modal, grubun `instructorId`'sinden `users/{instructorId}.certSettings[discipline]` okur; `effectiveProjectWeight` + `effectiveMaxOdevPuani` türetilir. Ödev puanı mantığı: useAssignment=false→0, maxXP>0→canlı, task silinmiş→saved fallback — `grading/page.tsx` ile tutarlı. `StudentDetailModal.tsx`.
- **StudentDetailModal tam yeniden tasarım (§179):** Modal sabit boyut `w-[960px] h-[632px] 2xl:h-[656px]`. **Tüm non-ders tab'lar** için ortak lacivert header (initials + isim + branş · grup + durum badge) — devam % sadece Genel tab'ta sağ üstte. Sol panel tamamen kaldırıldı. **Genel tab** → Ders Bilgileri ile aynı `grid-cols-[230px_1fr]` yapısı: sol sütun (Akademik Durum + Sınıf kodları), sağ sütun (Devam Durumu büyük donut + 4 stat grid, Sertifika Durumu). PerformansKart kaldırıldı (GradCard ile veri tekrarı). **Sertifika Durumu:** g2Code yoksa dashed placeholder kart; 3+ eğitim için `overflow-x-auto` yatay scroll; kart `min-w-[calc(50%-6px)] shrink-0`. **Geçmiş/İletişim/Ödeme:** aynı lacivert header, içerik şimdilik placeholder. **GradCard** sıkıştırıldı: `p-4→p-3`, nota `text-[28px]→text-[22px]`, `mb-3→mb-2` tüm boşluklar. **Branş erişim kontrolü:** `GroupDocData`'ya `discipline` eklendi; fetch'te `setGroupDiscipline(gData.discipline)`. `canViewClassData = isAdmin() || !groupDiscipline || user.branches.includes(groupDiscipline)` — "Ders Bilgileri" tab'ı ve Sertifika Durumu bölümü buna göre gizlenir. Eğitmen sadece kendi branşının öğrenci verisine erişir. `StudentDetailModal.tsx`.
- **StudentDetailModal Genel tab (§178):** Yeni `"genel"` tab eklendi — varsayılan tab artık Genel (oyunlaştırma yok). Modal genişliği `max-w-4xl` → `max-w-[960px]`. Koşullu header: Ders tab'ında eski lacivert oyunlaştırılmış header, diğer tüm tab'larda minimal beyaz kimlik şeridi (initials + isim + branş·grupKodu). `ProfessionalAvatar` bileşeni: gender'a göre `User` ikonu — erkek `bg-base-primary-900`, kadın `bg-base-secondary-700`. Genel tab içeriği `grid-cols-2`: sol sütun (Profil kartı + Eğitmen Notu), sağ sütun (Devam Durumu + Sertifikasyon Notu). Devam Durumu: sol büyük donut (`size=130`) + sağda 2×2 grid (Katıldığı | Devamsızlık, Yüzyüze | Online). Sertifikasyon: yatay şerit satırlar — Grafik-1/Grafik-2 için kod, final, proje, ödev notları. Ödev puanı yoksa pasif. Eğitmen Notu: `instructorNote_${uid}` alanıyla per-instructor Firestore yazımı. `StudentDetailModal.tsx`.

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
- [x] **Firestore şişmesi — month filtresi:** TAMAMLANDI. `design_attendance` aylık count `getDocs` + `groupId`+`month` filtreli (`AttendancePanel.tsx:595`); `lesson_exceptions` onSnapshot `groupId`+`month` filtreli (`:633`). Kalan iki sorgu bilinçli all-time + `groupId`-scoped `getDocs`.
- [x] **Platform Aşama 3 — leagueEnabled toggle:** TAMAMLANDI. Toggle `TaskManagementPanel` "Lig Yönetimi" sekmesinde (global=`settings/platform.leagueGlobalEnabled` admin-only, sınıf=`groups/{id}.leagueEnabled` admin+kendi branşı). Tüketim: eğitmen Sidebar + `/dashboard/league` global'e bakar; öğrenci Sidebar global+grup, öğrenci ana sayfa widget'ı + `/league` sayfası global+grup (son ikisi bu oturumda kapatıldı). Arşiv sekmesi de eğitmene açıldı (kendi ödevleri).
- [x] **Kitap PDF Arşivi:** TAMAMLANDI. `send-kitap` + `instructor/complete-upload` Drive'a yükleyip `tasks/{id}.kitapDriveFiles.{studentId}` yazıyor; `/dashboard/archive` per-öğrenci "PDF / İndir" sütununda gösteriyor (kitap/kolaj/sosyal).
- [x] **Notification Frontend:** TAMAMLANDI. `NotificationBell` → `Header` + `StudentHeader`, `NotificationToastListener` → root `layout.tsx`, `useNotifications` + `NotificationRealtimeService` canlı.
### Uzun Vadeli (Acele Değil)
- [ ] **Dashboard Hızlı Yoklama Widget:** `/attend?groupId=xxx` shortcut kartı

### Sertifika — Eğitim Operasyonu Kapsamı (çok ileride)
> Sertifika basımı/verilmesi **eğitmenin değil kurumun yetkisidir**. Mimarisi Eğitim Operasyonu ile birlikte yapılacak. O zamana kadar dokunulmayacak.
- Sertifika PDF + dağıtım (basım, SMS/e-posta), koşul hesabı (devam % + not), MEB bilgileri
- `dashboard/page.tsx` "Sertifikasyon" kartı not girişine (`/dashboard/grading`) gidiyor — etiket yanıltıcı; meta sabit kalabilir, gerçek-veri işi bu kapsama ait

---

## Eğitim Operasyon — Katalog Yönetimi Vizyonu (2026-06-05)

> Bilge Adam deneyiminden ilham alınan, Eğitim Operasyon platformunun çekirdeği olacak modül.

### Eğitim Tanımlama Ekranı
- Eğitim adı + yıl (örn. "Grafik Tasarım 2026")
- Bağlı branş seçimi
- Durum akışı: `Taslak → Satışa Açık → Eğitim Başladı → Tamamlandı → Arşiv`
- Eski yıl versiyonları arşivde saklanır, yeni yıl aktif olur

### Sekmeler
1. **Genel** — eğitim adı, branş, yıl, açıklama
2. **Modüller** — modül listesi + sırası + saat (örn. Grafik-1 → Temel Photoshop)
3. **Fiyatlandırma** — modül bazlı + toplam fiyat, KDV otomatik, taksit seçenekleri
4. **Sertifikalar** — hangi sertifikaları alır: Katılım / Başarı / MEB; her biri için koşullar (devam %, not ortalaması vb.)
5. **İçerik/Müfredat** — ders konuları, MEB belge bilgileri

### "Satışa Başlat" Butonu
- CRM ekranında eğitim görünür hale gelir
- Satış ekibi lead'e bu eğitimi bağlayabilir, fiyat otomatik gelir
- El ile fiyat girişi kaldırılır

### Bağlantılar
- **CRM** → hangi eğitim satıldı, fiyat buradan
- **Öğrenci kaydı** → hangi eğitime kayıt oldu
- **Sertifika** → MEB bilgileri + koşullar buradan çekilir, mezuniyette otomatik hesaplanır
- **Fatura** → fiyat buradan gelir
- **Mevcut grading/graduation** → sertifika koşullarına göre otomatik karar verir
