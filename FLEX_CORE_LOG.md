# FLEX_CORE_LOG — Proje Beyni
> Son güncelleme: 2026-03-26
> Bu dosya PC'ye geçince Claude'a verilir, kaldığı yerden devam eder.

---

## PROJE STACK

- **Framework**: Next.js 14 App Router (`"use client"`)
- **Veritabanı**: Firebase Firestore
- **Auth**: Firebase Auth
- **Mail**: Brevo HTTP API — `src/app/lib/email.ts`
- **Stil**: Tailwind CSS + inline styles

---

## BUGÜN YAPILAN DEĞİŞİKLİKLER (2026-03-26)

### 1. email.ts — Brevo'ya Geçiş
Dosya: `src/app/lib/email.ts`

- Nodemailer (Gmail SMTP) tamamen kaldırıldı
- Brevo HTTP API ile değiştirildi (`https://api.brevo.com/v3/smtp/email`)
- Env değişkenleri: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`
- Vercel'de Gmail SMTP datacenter IP bloğu sorunu bu şekilde aşıldı

### 2. league/page.tsx — Lig Tablosu Komple Revize
Dosya: `src/app/dashboard/league/page.tsx`

**Filtre Sistemi:**
- Eski dropdown/select yapısı tamamen kaldırıldı
- Yeni 2-katmanlı filtre: `Eğitmen Bazlı | Şube Bazlı` toggle (aktif = lacivert `bg-base-primary-900`)
- Eğitmen Bazlı altı: `Tüm Gruplarım` (text buton) + `Gruplarım ▼` (pill dropdown)
- Şube Bazlı altı: `Tüm Şubeler` (text buton) + `Şubeler ▼` (pill dropdown)
- Aktif text buton: `font-bold + underline` ile pasiften net ayrışıyor
- Dropdown dış tıklama: şeffaf overlay (`z-10`) ile kapanır
- Şube Bazlı seçilince varsayılan → `user.branch` (branchOptions'ta varsa), yoksa `Tüm Şubeler`
- Grup Bazlı'ya geçişte varsayılan → `filterMode = "branch"`, `branchSubFilter = ALL_BRANCH`

**State Değişkenleri:**
- `filterMode`: `"trainer" | "branch"`
- `trainerGroupFilter`: seçili tek grup kodu veya `ALL_GROUP`
- `branchSubFilter`: seçili şube veya `ALL_BRANCH`
- `openDropdown`: `"groups" | "branches" | null`
- `groupBranches`: groups koleksiyonundan çekilen şube listesi

**Filtreleme Mantığı:**
- `rankedStudents`: tüm filtreleri takip eder (viewMode + filterMode + group/branch)
- `podiumStudents`: spesifik grup seçimini takip etmez, mod düzeyinde filtreler
- `rankedGroups`: `filterMode + branchSubFilter + myGroupCodes` takip eder
- `isAdmin` kontrolü kaldırıldı → admin de olsa Eğitmen Bazlı'da sadece kendi grupları görünür
- `branchOptions`: `groups` koleksiyonu + öğrenci `branch` alanından türetilir (statik liste değil)
- `user.branch` doğrulaması: `branchOptions.includes(user.branch)` kontrolü ile string mismatch önlendi

**Layout Değişiklikleri:**
- Başlık satırı: `Lig Tablosu | 3 grup · 17 öğrenci` → 32px → `[Öğrenci Bazlı] [Grup Bazlı]`
- Toplam/Aylık switch → başlık satırı sağına taşındı, sadece Öğrenci Bazlı'da görünür
- Filtre satırı: `justify-between`, sol filtreler + sağda oval Toplam/Aylık
- Filtre → tablo arası: 16px (`mt-4`)
- Header → filtre arası: 24px (`mt-6`)

**Tablo Değişiklikleri:**
- `GroupTable` komple yeniden yazıldı → `LeaderTable` ile aynı stil
- Her iki tabloda "XP" → "Toplam XP" olarak değiştirildi
- `GroupTable`'a Eğitmen kolonu eklendi (`groupsMap` prop ile)
- `GroupTable`'a `groupsMap` prop geçildi

### 3. globals.css — Login Hata Mesajı Boyutu
Dosya: `src/app/globals.css`

- `.ui-helper-sm { font-size: 13px !important; }` eklendi
- `:root` font-size (1920px'de 15.4px, 2500px'de 16.2px) + kart `scale-110` transform'u ile hata mesajları çok büyüyordu
- `!important` gerekli: Tailwind v4 `@layer` sıralaması `:root !important`'ı geçemiyordu

---

## ÖNCEKİ OTURUM (2026-03-24)

### BookGameScreen.tsx — Carousel Animasyon Sistemi
Dosya: `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`

- Slot machine carousel: `BookCarousel` tek bileşen, hiç unmount olmaz
- `spinDone` ve `revealed` prop'ları: spin → pulse → zoom aşamaları
- Spin sırasında kitap başlıkları bulanık, zoom olunca netleşir
- Spin durduğunda merkez kart 3x pulse (`bkWinPulse 0.36s`)
- 1150ms sonra merkez kart `bkCarouselZoom` ile aşağıya büyür
- Yan kartlar eş zamanlı `opacity 0 + scale(0.65)` ile kaybolur

### SystemPanel.tsx — Yedek/Restore/Puan Sistemi
Dosya: `src/app/components/dashboard/admin/SystemPanel.tsx`

- `RestoreSystemModal`: groups, students, tasks, lottery_results, assignment_archive geri yükleme
- Manuel score backup butonu eklendi
- Layout: 2 kolonlu grid (Sistem Yedekleme + Tehlikeli Bölge) + Puan Yönetimi

### Sidebar.tsx — Compact Mode
Dosya: `src/app/components/layout/Sidebar.tsx`

- `useCompact()` hook: `window.innerHeight < 820` → hafif daraltma

### usePickingEngine.ts
Dosya: `src/app/components/dashboard/assignment/shared/usePickingEngine.ts`

- `resetToIdle(autoPick = true)` parametresi eklendi

---

## MEVCUT DURUM

### Kitap Ödevi (TAM ÇALIŞIYOR)
- Picking engine + Carousel slot machine + BookResultModal (PDF + mail)
- Firestore: `lottery_results/{taskId}` + `assignment_archive`

### Kolaj Ödevi (TAM ÇALIŞIYOR)
- `GameScreen.tsx` — picking + çekiliş + PDF + mail

### Sınıflar Ligi (TAM ÇALIŞIYOR)
- Öğrenci Bazlı / Grup Bazlı view modes
- Eğitmen Bazlı / Şube Bazlı 2-katmanlı filtreleme
- Podyum + analitik kartlar + sıralama tablosu

---

## KRİTİK DOSYALAR

```
src/app/components/dashboard/assignment/
├── shared/
│   ├── AssignmentScreen.tsx
│   ├── StudentPanel.tsx
│   ├── usePickingEngine.ts     ← resetToIdle autoPick param'lı
│   └── types.ts
├── kitap/
│   ├── BookScreen.tsx
│   └── BookGameScreen.tsx      ← TÜM OYUN BURADA
├── kolaj/
│   ├── KolajScreen.tsx
│   └── GameScreen.tsx
└── pool/
    └── poolTypes.ts

src/app/dashboard/league/
└── page.tsx                    ← Lig Tablosu (2-katmanlı filtre sistemi)

src/app/components/dashboard/admin/
└── SystemPanel.tsx

src/app/components/layout/
└── Sidebar.tsx

src/app/lib/
└── email.ts                    ← Brevo HTTP API

src/app/api/
└── send-kitap/route.ts
```

---

## FIRESTORE KOLEKSİYONLARI

- `tasks` — aktif ödevler
- `templates` — task şablonları
- `students`, `groups`
- `lottery_results/{taskId}` — çekiliş sonuçları (draws[])
- `lottery_configs/book` — kitap havuzu (BookPool)
- `lottery_configs/kolaj` — kolaj havuzu
- `assignment_archive` — tamamlanan ödevler
- `scores` — puanlar

---

## ORTAM

- **Firebase proje ID**: `grafik-tasarim-portali`
- **RTDB bölge**: `europe-west1`
- **Mail API**: `/api/send-kitap`, `/api/send-kolaj`
- **Mail servisi**: Brevo (ücretsiz plan, 300 mail/gün)
