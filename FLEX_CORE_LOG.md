# FLEX_CORE_LOG — Proje Beyni
> Son güncelleme: 2026-03-24
> Bu dosya PC'ye geçince Claude'a verilir, kaldığı yerden devam eder.

---

## PROJE STACK

- **Framework**: Next.js 14 App Router (`"use client"`)
- **Veritabanı**: Firebase Firestore
- **Auth**: Firebase Auth
- **Mail**: Nodemailer (SMTP) — `src/app/lib/email.ts`
- **Stil**: Tailwind CSS + inline styles

---

## BUGÜN YAPILAN DEĞİŞİKLİKLER (2026-03-24)

### 1. BookGameScreen.tsx — Carousel Animasyon Sistemi
Dosya: `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx`

**Yapılanlar:**
- Slot machine carousel: `BookCarousel` tek bileşen, hiç unmount olmaz (kesinti sorunu çözüldü)
- `spinDone` ve `revealed` prop'ları ile aşamalar yönetilir: spin → pulse → zoom
- Spin sırasında kitap başlıkları bulanık (`filter: blur(2.5px)`), zoom olunca netleşir
- Spin durduğunda merkez kart 3x pulse (`bkWinPulse 0.36s`)
- 1150ms sonra merkez kart `bkCarouselZoom` ile aşağıya büyür (`transform-origin: top center`)
- Yan kartlar eş zamanlı `opacity 0 + scale(0.65)` ile kaybolur
- `overflow: visible` + `visibility: hidden` ile zoomed kart kesilmez
- Renkler: `#1e3a6e` (çok koyu) kaldırıldı → `#1e40af` ile değiştirildi
- Yazar ismi kart içinde, blur ile birlikte gelir/gider

**Keyframe'ler:**
```
bkWinPulse:    0.36s × 3 — merkez kart yanıp söner
bkCarouselZoom: 0→3.2→2.4→2.9→2.7 scale, 0.42s — bounce efekti
```

**Label davranışı:**
- "Kitap Alacak Katılımcı" üstte sabit kalır (isim kaymasın diye)
- Spin bitince ismin ALTINDA "Kitap Belirlendi" fade-in ile çıkar
- `margin: 0` sabit — conditional margin kaldırıldı (isim kayması düzeltildi)

**Layout:**
- Ana alan `gap: 16`, `paddingTop: 64`
- İsim div'i `marginTop: 32`
- Carousel altında büyüyünce isimle arası korunur (`transform-origin: top center`)

### 2. SystemPanel.tsx — Yedek/Restore/Puan Sistemi
Dosya: `src/app/components/dashboard/admin/SystemPanel.tsx`

- **RestoreSystemModal**: groups, students, tasks, lottery_results, assignment_archive koleksiyonlarını backup subcollection'dan geri yükler. Önce `deleteCollection()` ile temizler, sonra batch write.
- **Puan Yedeği Al**: Manuel score backup butonu eklendi
- **Layout**: "Sistem Yönetimi" başlık → 2 kolonlu grid (Sistem Yedekleme + Tehlikeli Bölge) → "Puan Yönetimi" başlık → 2 kolonlu grid (Puan Yedekleme + Puan Sıfırlama)

### 3. Sidebar.tsx — Compact Mode
Dosya: `src/app/components/layout/Sidebar.tsx`

- `useCompact()` hook: `window.innerHeight < 820` → hafif daraltma
- Compact modda: logo padding 40→32px, nav mt-12 space-y-2, items py-3.25, bottom pb-6

### 4. BookScreen.tsx — Intro Animasyonu
Dosya: `src/app/components/dashboard/assignment/kitap/BookScreen.tsx`

- Slot machine: 9 kitap, ortadaki (index 4) kazanan
- `easeOutQuart` ile 2000ms'de hızlı gelip yavaş durur
- Duruktan sonra merkez kitap 3x pulse, sonra bounce ile büyür
- "Kitap Dünyası" yazısı sağdan sola `clip-path: inset()` mask reveal ile açılır
- İkon kitabın içinde sabit, yazı `top: calc(50% + 36px)` konumunda

### 5. usePickingEngine.ts — resetToIdle parametresi
Dosya: `src/app/components/dashboard/assignment/shared/usePickingEngine.ts`

- `resetToIdle(autoPick = true)` parametresi eklendi
- `handleClose` → `resetToIdle(false)` (kullanıcı manuel Başlat'a basar)
- `handleNewPick` → `resetToIdle(true)` (otomatik çekiliş başlar)

---

## MEVCUT DURUM

### Kitap Ödevi (TAM ÇALIŞIYOR)
- Picking engine: sol panelde öğrenci seçimi
- Carousel: slot machine efekti, kazanan kitap animasyonlu reveal
- Duplicate koruması: `availableBooks` filtresi + carousel + `handleSpinComplete` kontrolü
- Firestore'a `lottery_results/{taskId}` kaydı
- `BookResultModal`: PDF indirme + mail gönderme
- Arşive kaydet: `assignment_archive` koleksiyonu

### Kolaj Ödevi (TAM ÇALIŞIYOR)
- `GameScreen.tsx` — picking + çekiliş + PDF + mail

---

## KRİTİK DOSYALAR

```
src/app/components/dashboard/assignment/
├── shared/
│   ├── AssignmentScreen.tsx    ← Ortak çerçeve (intro + game geçişi)
│   ├── StudentPanel.tsx        ← Sol panel
│   ├── usePickingEngine.ts     ← Picking hook (resetToIdle autoPick param'lı)
│   └── types.ts
├── kitap/
│   ├── BookScreen.tsx          ← Intro animasyonu + AssignmentScreen wrapper
│   └── BookGameScreen.tsx      ← TÜM OYUN BURADA (carousel + modal + firestore)
├── kolaj/
│   ├── KolajScreen.tsx
│   └── GameScreen.tsx
└── pool/
    └── poolTypes.ts            ← BookPool, BookItem tipleri

src/app/components/dashboard/admin/
└── SystemPanel.tsx             ← Yedek/Restore/Puan/HardReset

src/app/components/layout/
└── Sidebar.tsx                 ← Compact mode hook burada

src/app/api/
└── send-kitap/route.ts         ← Kitap mail API
```

---

## FIRESTORE KOLEKSIYONLARI

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
