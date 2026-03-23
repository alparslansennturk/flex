# FLEX_CORE_LOG — Proje Beyni
> Son güncelleme: 2026-03-23
> Bu dosya her büyük commit sonrası güncellenir. PC'ye geçince buradan devam.

---

## PROJE STACK

- **Framework**: Next.js 14 App Router (Client Components — `"use client"`)
- **Veritabanı**: Firebase Firestore (ana veri) + Firebase RTDB (kaynak havuz — eski sistem)
- **Auth**: Firebase Auth
- **Mail**: Nodemailer (SMTP) — `src/app/lib/email.ts`
- **PDF**: `@react-pdf/renderer` — client-side üretim, base64 çıktı
- **Stil**: Tailwind CSS + inline styles

---

## MEVCUT DURUM (Current State)

### PDF Motoru
- Dosya: `src/app/components/dashboard/assignment/kolaj/generateKolajPdf.tsx`
- `@react-pdf/renderer` kullanır, **client-side** üretilir
- Font: Roboto (Google Fonts CDN) — Türkçe karakter desteği için
- `Font.registerHyphenationCallback` ile kelime bölünmesi kapatıldı
- PDF base64 string olarak üretilip mail route'una gönderilir
- **Pratik limit**: Vercel serverless body limit ~160KB — büyük PDF'lerde API 413 hatası verir
- Şu an sadece **Kolaj** için aktif. Kitap PDF'i henüz yapılmadı.

### Mail Hattı
- API route: `src/app/api/send-kolaj/route.ts`
- Lib: `src/app/lib/email.ts` (Nodemailer singleton transporter)
- Servis: `src/app/services/emailService.ts`
- Akış: `GameScreen → generateKolajPdf() → base64 → POST /api/send-kolaj → sendMail()`
- Mail içeriği: HTML tablo (kategori + öğe) + PDF ek
- `email.ts`'de sertifika PDF gönderimi için de TODO notu var (henüz yapılmadı)
- Öğrenci e-postası yoksa mail butonu gizlenir

### Çekiliş / Picking Engine (Sol Panel Animasyonu)
- Hook: `src/app/components/dashboard/assignment/shared/usePickingEngine.ts`
- Aşamalar: `idle → picking → ready`
- Mantık: `remainingStudents` listesinde `setInterval` ile highlight döner, 2800ms sonra kazanan belirlenir (1 kişi kaldıysa 0ms)
- Sol panel (`StudentPanel`) highlight animasyonunu bu hook'tan alır
- `accentColor` prop'u ile her ödev kendi rengini kullanır (kolaj: `#689adf`, kitap: `#60a5fa`)
- Not: "Beyaz Slider / Çarkıfelek" bu projede yok — başka bir projeye ait

### Nükleer Sıfırlama (Hard Reset)
- Dosya: `src/app/components/dashboard/admin/SystemPanel.tsx`
- `HardResetModal`: 2 adımlı — şifre doğrulama (Firebase re-auth) → `deleteCollection()` ile toplu silme
- `deleteCollection()`: 500'lük batch'lerle tüm koleksiyonu temizler
- Hangi koleksiyonları siler: puan/sezon verileri (scoring)
- Admin paneli: `/dashboard/admin/migrate`

### Ödev Arşivi
- Sayfa: `src/app/dashboard/archive/page.tsx`
- Firestore'dan `assignment_archive` koleksiyonunu çeker
- Her kayıt: `groupId, groupName, taskId, taskName, type, completedAt, draws[], students[]`
- Grup bazında gruplandırılmış gösterim

---

## KARAR GÜNLÜĞÜ (Decision Log)

### Ödev Tipleri — `assignmentType` Sistemi
- `taskTypes.tsx`'teki `Task` interface'ine `assignmentType?: "kolaj" | "kitap" | "sosyal_medya"` eklendi
- `TaskForm`'da "Ödev Tipi" list menüsü var — template oluştururken seçilir
- Template'den task klonlanırken (`handleGhostActivate` in `DesignParkour.tsx`) `assignmentType` kopyalanır
- Routing: `DesignParkour.tsx` → `assignmentType` boşsa hiçbir yere gitmiyor (null route — bilerek)
- **Yapılması gereken**: Mevcut tüm kolaj template'leri → "Kolaj Bahçesi", kitap template'leri → "Kitap Dünyası" seçilmeli

### Shared Assignment Mimarisi
- `AssignmentScreen` (shared): task yükleme, status kontrolü, entry screen (öğrenci seçimi), akış yönetimi
- Her ödev kendi `renderIntro` ve `renderGame` prop'unu sağlar
- `StudentPanel` (shared): tüm ödevlerde sol panel aynı, sadece `accentColor` değişir
- Entry screen ("Katılımcıları Seç"): 100% ortak, tüm ödevlerde aynı görünüm
- Intro animasyonları: her ödevde farklı (kolaj: yaprak şekilleri/yeşil, kitap: dikdörtgenler/lacivert)

### Ödev Arşivinin Ayrılması
- Tamamlanan çekilişler ana parkurdan kaldırılır, `assignment_archive` koleksiyonuna yazılır
- Arşiv sayfası eğitmene geçmiş sonuçları gösterir, parkur temiz kalır
- `lottery_results/{taskId}` ayrı tutulur — aynı task yeniden açılırsa entry atlanır

### RTDB → Firestore Migrasyon (Arı Bilgi Bağlantısı)
- Eski sistem: `grafik-tasarim-portali-default-rtdb.europe-west1.firebasedatabase.app` (Firebase RTDB)
- Bu RTDB, kolaj elemanları / kitap kapakları / sosyal medya brand havuzlarını tutar
- Migrasyon kodu: `src/app/lib/migration/assignmentDataMigration.ts`
- `fetchRtdb()` ile RTDB'den çeker → `parseCollageItems()` / `parseBookCovers()` / `parseSMBrands()` ile dönüştürür → Firestore `lottery_configs/{type}` dokümanına yazar
- Admin migrate sayfasından tetiklenir: `/dashboard/admin/migrate`
- **Önemli**: RTDB ham verisi değişirse parse fonksiyonları güncellenmelidir

---

## TEKNİK BORÇLAR (Tech Debt)

### "Parsing failed" Hataları — Migrasyon
- `parseCollageItems()`, `parseBookCovers()`, `parseSMBrands()` fonksiyonları RTDB'nin tam yapısını bekler
- RTDB'de kategori objesi yerine `null` veya string gelirse sessizce atlanır
- Hata: `throw new Error("RTDB verisi bulunamadı: {path}")` — path null dönünce
- Çözüm: Her parse fonksiyonu önce `typeof catValue !== "object" || catValue === null` kontrolü yapıyor
- Yine de yeni veri tipleri RTDB'ye eklenirse tip tanımları (`assignmentMigration.types.ts`) güncellenmeli

### assignmentType Geriye Dönük Uyumluluk
- Eski task'larda Firestore'da `assignmentType` alanı yok → "Ödev Detay" butonu çalışmaz
- Tüm aktif ve arşiv task'larına manuel `assignmentType` set edilmeli (Firestore console'dan)

### BookGameScreen Placeholder
- `BookScreen.tsx` → `BookGameScreen` şu an sadece sol panel + boş sağ alan
- `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx` dosyası var ama henüz bağlanmadı
- 2. fazda: picking engine + kitap çekiliş mekanizması + PDF/mail

### Mail — Sadece Kolaj
- `/api/send-kolaj` sadece kolaj formatını biliyor
- Kitap ödevi için ayrı `/api/send-kitap` route'u yazılacak (farklı mail şablonu)
- `email.ts`'deki attachment yapısı hazır, sadece route + template eksik

---

## SIRADAKI HEDEFLER (Next Steps)

### Kitap Oyun Alanı (Faz 2)
- `BookGameScreen.tsx`'i `BookScreen.tsx`'e bağla (şu an placeholder var)
- `usePickingEngine` hook'unu kitap için adapte et
- Çekiliş: `lottery_configs/book` → her öğrenciye 1 kitap
- `lottery_results/{taskId}` → sonuçları Firestore'a yaz
- Sonuç overlay + PDF + mail

### Sosyal Medya Ödevi
- `assignmentType: "sosyal_medya"` tanımlı, route yok
- `/dashboard/sosyal-medya/page.tsx` oluşturulacak
- `SocialMediaPoolPanel.tsx` var — havuz yönetimi hazır
- Çekiliş mantığı: brand + sector + format kombinasyonu

### Yoklama Modülü (Planlandı — Kodda Yok)
- Öğrenci yoklaması için ayrı modül
- Firestore'da `attendance` koleksiyonu
- Grup bazında, tarih bazında kayıt
- Dashboard'a entegrasyon

---

## ORTAM / TERCIHLER

- **VS Code font**: `"editor.fontSize": 13` (varsa settings.json'da)
- **Node**: proje kök dizininde `.nvmrc` yoksa sistem Node kullanılıyor
- **Firebase proje ID**: `grafik-tasarim-portali`
- **RTDB bölge**: `europe-west1`
- **Firestore koleksiyonları**: `tasks`, `templates`, `students`, `groups`, `lottery_results`, `lottery_configs`, `assignment_archive`, `scores`

---

## DOSYA HARİTASI (Kritik Dosyalar)

```
src/app/
├── components/dashboard/
│   ├── assignment/
│   │   ├── shared/
│   │   │   ├── AssignmentScreen.tsx   ← Tüm ödevlerin ortak çerçevesi
│   │   │   ├── StudentPanel.tsx       ← Sol panel (accentColor prop'lu)
│   │   │   ├── usePickingEngine.ts    ← Picking animasyon hook'u
│   │   │   └── types.ts               ← Student, TaskData, DrawResult vb.
│   │   ├── kolaj/
│   │   │   ├── KolajScreen.tsx        ← Intro + AssignmentScreen wrapper
│   │   │   ├── GameScreen.tsx         ← Kolaj çekiliş ekranı (tam)
│   │   │   └── generateKolajPdf.tsx   ← PDF motoru
│   │   ├── kitap/
│   │   │   ├── BookScreen.tsx         ← Intro + sol panel + placeholder sağ
│   │   │   └── BookGameScreen.tsx     ← Henüz bağlanmadı (faz 2)
│   │   ├── TaskForm.tsx               ← "Ödev Tipi" list menüsü burada
│   │   └── taskTypes.tsx              ← Task interface + assignmentType
│   ├── scoring/
│   │   └── DesignParkour.tsx          ← Ana parkur + routing
│   └── admin/
│       └── SystemPanel.tsx            ← Hard Reset
├── api/
│   └── send-kolaj/route.ts            ← Mail API
├── lib/
│   ├── email.ts                       ← Nodemailer transporter
│   └── migration/
│       └── assignmentDataMigration.ts ← RTDB → Firestore
└── dashboard/
    ├── kolaj/page.tsx
    ├── kitap/page.tsx
    └── archive/page.tsx
```
