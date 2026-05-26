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

---

## Son Durum (2026-05-26)

- **Yoklama modülü:** Tam çalışıyor (kayıt, kapanma, rapor, detay)
- **AttendFlowTransition:** Animasyon vazgeçildi, `layout.tsx`'ten kaldırıldı
- **Notification:** Backend ✅, Frontend ⏸ (Figma bekleniyor)
- **Platform Genişlemesi:** Aşama 1+2 bitti, Aşama 3 beklemede (leagueEnabled toggle)
- **Home V2:** `/dashboard/home-v2` test sayfası oluşturuldu (~%75 tamamlandı)

---

## Home V2 — `/dashboard/home-v2` (§115–130)

**Durum:** Test sayfası çalışıyor, orijinal `/dashboard`'ın yerini alacak.

### Tamamlananlar
- `src/app/dashboard/home-v2/page.tsx` oluşturuldu
- **HomeBanner:** Lacivert (#10294C), 3 gerçek Firestore istatistik (Sınıf/Öğrenci/Ödev), `onSnapshot` canlı veri
- **3 Hızlı Eylem Kartı:** Hızlı Yoklama (mavi), Ödev Teslimi (turuncu), Sertifikasyon (mor) — renkli ikon alanları + pill badge butonları
- **ActivityFeed:** 7 aktivite, tip renkleri, başlık baskın, `justify-end` ile Sertifikasyon kartına hizalı
- **FooterV2:** `h-14`, `flex-logo-white.svg` 70px
- **Sidebar:** `logo` prop eklendi → `flex-logo-title-white.svg` 165px
- **Header:** `innerClassName` prop eklendi → container hizalaması
- **FlexLogo bileşeni:** `src/app/components/ui/FlexLogo.tsx` — variant prop, Rubik font
- **Rubik font:** `layout.tsx`'e eklendi, CSS var `--font-rubik`
- **Container:** `max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]` — header + content + footer eşit

### Eksikler / Sonraki Oturum
- [ ] **ActivityFeed Firestore bağlantısı:** Şu an mock data (hardcoded array). Gerçek `activity_log` koleksiyonu gerekiyor
- [ ] **ActivityFeed UI iyileştirmeleri (kararlaştırıldı):**
  - Her satır kart gibi — `bg-surface-50` veya `border` ile ayrılsın
  - Sol kenarda tip rengi şeridi (`border-l-3`) — ödev=turuncu, yoklama=mavi, not=mor
  - Zaman bilgisi sağ köşeye hizalı
  - Başlık alanında canlı yeşil nokta `●` + "Canlı" yazısı
- [ ] Sol üst geniş alan (HomeBanner altı) — WorkshopAnalysis benzeri bir widget gelecek
- [ ] Hızlı Yoklama kartı "meta" alanı — gerçek tarih ve grup sayısı bağlanacak
- [ ] Ödev Teslimi "3 aktif ödev" — hardcoded, Firestore'dan çekilecek

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
