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

---

## Son Durum (2026-05-30)

- **Yoklama modülü:** Tam çalışıyor (kayıt, kapanma, rapor, detay)
- **Cuma tatili (§133–134):** Standart gruplar Cuma günü tatil statüsünde — overlay amber renk, pulse yok, auto-select atlar. Field mismatch (`groupType`→`type`) düzeltildi.
- **Tamamlanan grup gizleme (§135):** `grading` sayfasında "Modülü Bitir" → grup doc'a `attendanceClosed: true` yazılıyor. `AttendancePanel` bu grupları listeden çıkarıyor.
- **Auto-select (§136):** Bugün dersi olan grup yoksa (Cuma, tatil vb.) en yakın ders günü olan grubu seçiyor. `type` alanı olmayan eski gruplar da Cuma'da doğru filtreleniyor.
- **AttendFlowTransition:** Animasyon vazgeçildi, `layout.tsx`'ten kaldırıldı
- **Notification:** Backend ✅, Frontend ⏸ (Figma bekleniyor)
- **Platform Genişlemesi:** Aşama 1+2 bitti, Aşama 3 beklemede (leagueEnabled toggle)
- **Home V2:** ActivityFeed scroll sistemi tamamlandı (§132)
- **Home V4 (§137–138):** `dashboard/home-v4` oluşturuldu — 4'lü kompakt ödev parkuru, beyaz hızlı eylem kartları, `onSnapshot` permission-denied hataları susturuldu

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
- [ ] **ActivityFeed Firestore bağlantısı:** Şu an mock data. Gerçek `activity_log` koleksiyonu gerekiyor
- [ ] Sol üst geniş alan (HomeBanner altı) — WorkshopAnalysis benzeri bir widget gelecek

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
- [ ] **Home V2 — ActivityFeed UI iyileştirme** (bir sonraki oturum)
- [ ] **Home V2 — ActivityFeed Firestore bağlantısı** (`activity_log` koleksiyonu)
- [ ] **Platform Aşama 3 — leagueEnabled toggle:** `GroupForm` + `useManagement` + `LeagueWidget` + `LeaderboardWidget` + `StudentLeagueWidget`
- [ ] **Kitap PDF Arşivi:** `send-kitap` Drive'a kaydetmiyor; eğitmen kendi gönderdiği kitapları UI'dan göremez
- [ ] **Notification Frontend:** Figma linki bekleniyor (PC'de devam edilecek)

### Uzun Vadeli (Acele Değil)
- [ ] **Sertifika PDF + Dağıtım:** `react-pdf` + `send-kitap` pattern — şablon tasarımı kararlaştırılacak
- [ ] **Dashboard Hızlı Yoklama Widget:** `/attend?groupId=xxx` shortcut kartı
