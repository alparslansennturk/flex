# FlexOS Yük Testi

> Amaç: "30-40 personel + 500 öğrenci gerçek kullanmaya başlarsa sistem kararlı
> çalışır mı?" sorusuna gerçek Vercel serverless ortamında, gerçek Firestore
> gecikmesiyle cevap vermek. Bu doküman, altyapıyı sıfırdan **tek seferde**
> kurup bundan sonraki her performans testini aynı standartla, ek açıklamaya
> gerek kalmadan tekrarlamak için yazıldı.
>
> Kurulum 2026-08-05'te yapıldı. İlerlemenin genel özeti için → `FLEXOS.md`
> ("Durum / İlerleme" bloğu).

---

## 1) Mimari

```
┌─────────────────────┐         ┌──────────────────────┐
│   PRODUCTION          │         │   LOAD TEST (izole)     │
│                        │         │                          │
│  Vercel proje: flex    │         │  Vercel proje:           │
│  → flex-one-iota       │         │  flexos-loadtest         │
│    .vercel.app         │         │  → flexos-loadtest       │
│                        │         │    .vercel.app           │
│  Firebase: flexos-10ac4│         │  Firebase: flexos-loadtest│
│  (gerçek okul verisi)  │         │  (sadece seed veri)       │
└─────────────────────┘         └──────────────────────┘
        AYNI GİTHUB REPOSU, İKİ AYRI VERCEL PROJESİ
        (flexos-loadtest git-entegre DEĞİL — manuel deploy)
```

- **Aynı kod, iki ayrı hedef.** İki proje de bu repodan build edilir. `flex`
  (prod) her `main` push'unda otomatik deploy olur — buna hiç dokunmuyoruz.
  `flexos-loadtest` git'e bağlı değil, sadece `npm run k6:deploy` çalıştığında
  güncellenir.
- **Firebase tamamen izole.** `flexos-loadtest` ayrı bir Firebase projesi —
  prod'daki `students`/`groups`/`persons`/`enrollments` hiçbirine dokunmaz,
  dokunamaz (farklı proje, farklı service account).
- **Neden gerçek bir Vercel deployment'ı, neden local değil:** Asıl soru "prod
  altyapısı yük altında kararlı mı" — bu, Vercel serverless function'ların
  soğuk başlangıç/eşzamanlılık davranışını ve gerçek bölgeler-arası ağ
  gecikmesini gerektirir. `next start` local'de bunların hiçbiri simüle
  edilemez.
- **Vercel Hobby plan sınırı bilerek gözetiliyor.** Ödeme yöntemi yok, kota
  aşımı ücret değil sadece throttle/hata demek — ama yine de "fair use"a
  saygılı, hafif/kısa testler tercih edilir (bkz. §4).

---

## 2) Environment Variable'lar

Sadece **8 tanesi gerçekten zorunlu** — kodun `flexos-loadtest` Vercel
projesinde çalışması için Vercel dashboard'a eklenmiş durumda:

| Değişken | Ne işe yarar |
|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` / `_API_KEY` / `_AUTH_DOMAIN` / `_STORAGE_BUCKET` / `_MESSAGING_SENDER_ID` / `_APP_ID` | Client Firebase SDK — `flexos-loadtest` projesine bağlanır |
| `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | Admin SDK (server-side Firestore + custom token üretimi) — `service-account-staging.json`'dan |

**Neden diğerleri (Brevo/Gmail/Google Drive/Resend/ADMIN_SECRET/CRON_SECRET)
YOK:** Kod tabanı tarandı — hepsi fonksiyon içinde **lazy** okunuyor (modül
yüklenirken değil), sadece kendi route'ları (e-posta gönderme, Drive upload,
cron) tetiklendiğinde devreye giriyor. k6 senaryolarımız (login/mesaj/yoklama/
ödev listesi) o path'lere hiç girmiyor — eksik olsalar da route çökmez.
`GMAIL_*`/`GOOGLE_DRIVE_KEY`/`RESEND_API_KEY` zaten kodda hiç kullanılmıyor.

Ayrıca **local** tarafta (bu makinede) gerekenler:

| Dosya/Değişken | Ne işe yarar |
|---|---|
| `service-account-staging.json` (repo kökü, gitignore'da) | Seed script + token üretimi için Admin SDK kimliği. Firebase Console → flexos-loadtest → Project Settings → Service accounts → Generate new private key. **Makineye özel — PC'de yeniden indirilmeli.** |
| `.env.staging.local` (repo kökü, gitignore'da) | Web config (yukarıdaki `NEXT_PUBLIC_*` değerleri) + `VERCEL_AUTOMATION_BYPASS_SECRET` (bkz. §4) |

---

## 3) Seed Script

`scripts/seed-loadtest.mjs` — deterministik, idempotent, İLİŞKİLİ test verisi
üretir (rastgele bağımsız kayıt yok: personel→eğitmen→sınıf→öğrenci→ödev/
yoklama/Connect mesajı hepsi birbirine bağlı).

```bash
npm run seed                          # profile=large (varsayılan), yaz
node scripts/seed-loadtest.mjs --dry-run          # sadece sayaç, yazma yok
node scripts/seed-loadtest.mjs --profile=small    # small|medium|large
npm run seed:clean                     # ÖNCE bu profildeki eski seed veriyi SİLER, sonra yazar
```

| Profil | Öğrenci | Personel | Sınıf | Toplam doküman (~) |
|---|---|---|---|---|
| small | 20 | 5 | 2 | ~200 |
| medium | 150 | 15 | 15 | ~3.000 |
| large | 500 | 50 (32 eğitmen) | 50 | ~16.700 |

Güvenlik: `service-account-staging.json`'ın `project_id`'si `flexos-loadtest`
değilse script hiçbir şey yazmadan durur — prod'a yanlışlıkla yazma imkânsız.

---

## 4) İlk Kurulum (SADECE bir kere gerekli)

Bu adımlar 2026-08-05'te bu proje için yapıldı — bir dahaki sefere **hiçbiri
gerekmez**, doğrudan §5'e geç. Buraya, ileride ikinci bir staging projesi
kurulursa (ya da bu proje silinip yeniden yaratılırsa) tekrar lazım olur diye
yazıldı.

1. **Firebase Authentication'ı etkinleştir** — yeni Firebase projelerinde
   varsayılan AÇIK değil. https://console.firebase.google.com/project/flexos-loadtest/authentication
   → "Get started" → Email/Password sağlayıcısını Enable et. (Ücretsiz Spark
   planda çalışır — Blaze GEREKMEZ; "Identity Platform" adlı gelişmiş sürüm
   Blaze ister ama biz ona hiç ihtiyaç duymuyoruz.)
2. **Vercel projesini oluştur ve Framework Preset'i düzelt.** `vercel link -y
   -p flexos-loadtest` boş bir dizinde çalıştırılırsa proje "Other" framework
   ile oluşur — bu, Next.js route'larının (API dahil) hiç servis edilmemesine
   (kör 404) yol açar. Vercel dashboard → flexos-loadtest → Settings → Build
   and Deployment → Framework Preset → **Next.js** seç, Save, sonra yeniden
   deploy et.
3. **Deployment Protection Bypass secret'ı üret.** Vercel yeni projelerin
   deployment'larını varsayılan olarak takım girişi (SSO) arkasına kilitler —
   k6/curl bu duvarı geçemez. Vercel dashboard → flexos-loadtest → Settings →
   Deployment Protection → **Protection Bypass for Automation** → **+ Add
   Secret** (not: "k6 load test" gibi bir şey yaz). Üretilen değeri
   `.env.staging.local`'a `VERCEL_AUTOMATION_BYPASS_SECRET=...` olarak ekle.
   (Buton küçük harfli açıklama metninin ALTINDA, sağda — kolay gözden
   kaçıyor.)
4. **RoleDef'leri tohumla.** `flexos_role_defs` koleksiyonu boşsa (yeni
   proje), Firestore-tabanlı ofis rolleri (genel_mudur, egitim_koordinatoru
   vb.) hiçbir capability çözemez — `attendance.write` gibi kontroller sessizce
   403 döner. **Bu adım artık otomatik** — `generate-tokens.mjs` bir admin
   (`role:"admin"` custom claim'i) token'ı üretip `/api/flexos/role-defs`'i bir
   kere çağırıyor (bkz. §5), 6 yerleşik rolü tohumluyor. Elle yapmak gerekirse
   aynı endpoint'i admin yetkili bir token'la çağırmak yeterli.

---

## 5) Baştan Sona Çalıştırma Rehberi

Sıfırdan, hiç ek açıklama gerektirmeden:

```bash
# 0) service-account-staging.json var mı kontrol et (yoksa Firebase Console'dan indir, §2)
ls service-account-staging.json

# 1) Test verisini yaz (istersen önce temizleyip taze başla)
npm run seed:clean

# 2) Kodu flexos-loadtest'e deploy et (birkaç dakika sürer)
npm run k6:deploy

# 3) Gerçek Firebase ID token'ları üret (eğitmen+öğrenci+admin, 1 saat geçerli)
npm run k6:tokens

# 4) k6'yı çalıştır (varsayılan: 20 VU, 1dk — Hobby plan'a uygun hafif yük)
npm run k6:run

# Daha ağır bir koşum istenirse (dikkat: Hobby fair-use, bkz. §1):
k6 run -e VUS=60 -e DURATION=3m scripts/k6/loadtest.js
```

k6 çıktısındaki `{stage:steady}` etiketli satırlara bak (§7) — ilk 30sn
soğuk-başlangıç/ramp-up gürültüsü olarak ayrı tutulur, threshold'lar da
sadece o döneme uygulanır.

**Sırayı bozma:** token'lar 1 saat geçerli — adım 3'ü çalıştırdıktan sonra
adım 4'ü makul bir süre içinde çalıştır. Deploy (adım 2) token üretiminden
(adım 3) ÖNCE gelmeli çünkü token üretimi son adımında canlı deployment'a
(`/api/flexos/role-defs`) bir istek atıyor.

---

## 6) Test Senaryoları

`scripts/k6/loadtest.js` — 5 senaryo, gerçek kullanım oranlarına yakın
ağırlıklarla, aynı anda (k6 `ramping-vus` executor, her biri ayrı VU havuzu):

| Senaryo | İstek | Ağırlık | Kim | Ne temsil ediyor |
|---|---|---|---|---|
| `login` | `GET /api/flexos/me` | %20 | eğitmen+öğrenci karışık | Giriş sonrası dashboard/capability yükleme |
| `attendance_read` | `GET /api/flexos/attendance?groupId=&month=` | %30 | eğitmen | Yoklama takvimine bakma |
| `send_message` | `POST /api/flexos/connect/conversations/:id/messages` | %30 | eğitmen | Sınıf odasına mesaj atma |
| `assignments_list` | `GET /api/flexos/student/assignments?personId=` | %15 | öğrenci | Ödev listesini görüntüleme |
| `attendance_write` | `PATCH /api/flexos/attendance/:id` | %5 | admin (org-scope) | Yoklama kaydet/kapat |

**Neden "login" bir HTTP senaryosu değil, `GET /api/flexos/me`:** Gerçek
kimlik doğrulama (`signInWithEmailAndPassword`) doğrudan Google'ın Identity
Toolkit sunucularına gider — bizim Vercel altyapımızı hiç yormaz, k6'nın
ölçtüğü şey olmamalı. Login sonrası UYGULAMAMIZIN yaptığı ilk gerçek iş
(rol/capability/landing hesaplama) `/api/flexos/me`'dir — asıl yük testi
edilmesi gereken budur.

**Neden `attendance_write` admin (genel-yetkili) hesapla:** Seed'deki yoklama
kayıtları haftalar öncesine ait ve kapalı (`attendanceClosed:true`) —
standart bir eğitmen hesabı (assigned-scope) bunları 3 günlük düzenleme
penceresi dolduğu için düzenleyemez (`ValidationError`, iş kuralı gereği,
bug değil). Org-scope aktör (admin/genel müdür) bu pencereden muaf — canlıdaki
gerçek davranışla birebir aynı. Gerçekçi bir eğitmen-yazma senaryosu istenirse
ayrı bir iş: yeni (bugünün tarihli) bir yoklama kaydı `startLesson` ile
açtırıp onu düzenlemek gerekir.

---

## 7) Sonuçları Değerlendirme

k6 çıktısının **`{stage:steady}` etiketli** satırlarına bak (ilk 30sn'yi
warm-up olarak hariç tutar). Bakılacak metrikler:

- **Error rate** (`http_req_failed{stage:steady}`) — **hedef: <%1.** Bundan
  yüksekse önce durumu Vercel Dashboard → flexos-loadtest → Functions/Logs'tan
  teşhis et, "işe yaramıyor" deyip geçme.
- **p95 / p99 gecikme** (`http_req_duration{stage:steady}`) — ortalama değil,
  **kuyruk** önemli (kullanıcıların %5-1'i en kötü deneyimi yaşıyor).
  Referans: interaktif bir API isteği için p95 <1s iyi, 1-2s kabul edilebilir,
  >2s araştırılmalı.
- **RPS** (`http_reqs`, `iterations`) — o VU sayısında sistemin kaldırdığı
  gerçek trafik hacmi.
- **Senaryo bazlı Trend'ler** (`flexos_login_duration`,
  `flexos_message_duration`, `flexos_attendance_read_duration`,
  `flexos_attendance_write_duration`, `flexos_assignments_duration`) — HANGİ
  endpoint'in yavaş olduğunu ayırt etmek için (toplam `http_req_duration` tek
  başına bunu göstermez).

### Örnek çıktı (2026-08-05, 20 VU / 1dk, `large` profil)

```
checks_succeeded: 100.00% (547/547)   → 0 hata

http_req_duration{stage:steady}: avg=787ms  p(90)=1.73s  p(95)=1.84s

  flexos_login_duration:              avg=503ms  p(95)=716ms
  flexos_attendance_read_duration:    avg=533ms  p(95)=808ms
  flexos_assignments_duration:        avg=723ms  p(95)=943ms
  flexos_attendance_write_duration:   avg=775ms  p(95)=994ms
  flexos_message_duration:            avg=1.79s  p(95)=2.13s  ← belirgin şekilde yavaş
```

**Bulunan gerçek sorun:** `send_message` diğer 4 senaryodan ~2× yavaş.
Kaynağı bulundu — `connect-push-service.ts::notifyNewMessage` mesaj
gönderildikten sonra, HTTP yanıtı DÖNMEDEN ÖNCE, konuşmadaki HER ÜYE için ayrı
ayrı Firestore okuma+yazma yapıyor (sınıf odalarında ~10 öğrenci = ~10 paralel
ama senkron bekletilen alt-istek). 500 öğrenci ölçeğinde kalabalık sınıflarda
bu gecikme büyür.

**✅ DÜZELTİLDİ (2026-08-05, aynı oturum, `295e1a4` ile push edildi):** her
iki mesaj route'unda (`connect/conversations/[id]/messages` ve
`student/connect/conversations/[id]/messages`) `notifyNewMessage` çağrısı
Next.js `after()` ile HTTP yanıtı DÖNDÜKTEN SONRAYA ertelendi — zaten
`try/catch` içinde (non-fatal) olduğundan mesajın kaydını etkilemiyor, sadece
yanıt süresini artık uzatmıyor. **Ölçülmüş before/after yok** — bu fix, yukarıdaki
tam sistem testinden SONRA yapıldı (tam sistem testi zaten Connect'i
kapsamıyordu, §12). Doğrulamak için Connect k6 senaryosunu (§6) tekrar
çalıştırıp `flexos_message_duration`'ın diğer 4 senaryoyla aynı seviyeye
düştüğünü kontrol et.

---

## 8) Test Verilerini Temizleme

```bash
npm run seed:clean
```

Ne siler: `seedTag:"seed:loadtest"` taşıyan TÜM dokümanlar (personel, öğrenci,
sınıf, ödev, yoklama) + Connect konuşmaları (`recursiveDelete` ile — bu, k6'nın
test sırasında EKLEDİĞİ mesajları da otomatik temizler, çünkü onlar seed'li
konuşmanın alt-koleksiyonunda yaşıyor) + `users/{uid}/notifications`.

**Ne SİLMEZ (bilerek):**
- **Firebase Auth hesapları** (`seed-staff-*`, `seed-student-*`) —
  `generate-tokens.mjs`'in oluşturduğu hesaplar. Zararsız (izole projede sahte
  veri), ama tamamen sıfırlamak istersen Firebase Console → Authentication →
  Users → tümünü seç → Delete (elle, script yok).
- **`flexos_role_defs`** (6 yerleşik rol) — genel/paylaşılan config, seed'e
  özel değil, silinmesine gerek yok.
- **Vercel Deployment Protection Bypass secret**, Framework Preset ayarı —
  proje-seviyesi ayarlar, seed'den bağımsız, kalıcı kalmalı.

---

## 9) Sık Karşılaşılan Problemler

| Belirti | Kök neden | Çözüm |
|---|---|---|
| `auth/configuration-not-found` (token üretiminde) | flexos-loadtest'te Firebase Authentication hiç açılmamış | §4 madde 1 |
| Deployment'ta HER route (root dahil) 404 | Vercel Framework Preset "Other" — Next.js routing hiç çalışmıyor | §4 madde 2 |
| `curl`/k6 isteği 302 ile `vercel.com/sso-api`'ye yönleniyor | Deployment Protection (SSO) — bypass secret eksik/yanlış | `x-vercel-protection-bypass` header'ını kontrol et, §4 madde 3 |
| `403 Yetki yok: attendance.write` (admin/genel_mudur token'ıyla) | `flexos_role_defs` boş, ofis rolü hiçbir capability'ye çözülmüyor | `generate-tokens.mjs` bunu otomatik tetikliyor — script çıktısında "RoleDef tohumlama tetiklendi" satırını doğrula |
| `attendance write` senaryosu `403`/`ValidationError` | Eğitmen (assigned-scope) hesabıyla eski/kapalı bir kayda yazılmaya çalışılıyor — 3 günlük düzenleme penceresi dolu | Beklenen davranış, admin/org-scope token kullan (script zaten öyle yapıyor) |
| k6: `idToken` isteklerinde `401` | Token'lar 1 saatlik ömrü doldurmuş | `npm run k6:tokens` ile yeniden üret |
| `npm run k6:deploy` sonrası prod (`flex`) proje linki bozuk görünüyor | Olmamalı — script `trap` ile garanti geri yüklüyor, ama yarıda kesilirse (`Ctrl+C` sinyali script'e ulaşmazsa) manuel kontrol et: `cat .vercel/project.json` → `projectName` "flex" olmalı |
| Test sırasında Vercel "abuse"/rate-limit hatası | Hobby plan fair-use sınırına yakın | VU/süreyi düşür (`-e VUS=10 -e DURATION=30s`), art arda çok sık koşma |

---

## 10) Dosya Haritası

```
scripts/seed-loadtest.mjs        Firestore test verisi (personel/öğrenci/sınıf/ödev/yoklama/Connect)
scripts/k6/generate-tokens.mjs    Gerçek Firebase ID token üretimi + RoleDef tohumlama
scripts/k6/deploy-staging.sh      Repo'yu flexos-loadtest'e deploy eder (prod linkini bozmadan)
scripts/k6/loadtest.js            k6 test senaryoları
scripts/k6/.tokens.json           ÜRETİLEN token'lar (gitignore'da, 1 saat ömürlü)
scripts/k6/results/               k6 --summary-export çıktıları (gitignore'da)
.env.staging.local                Staging Firebase web config + Vercel bypass secret (gitignore'da)
service-account-staging.json      Staging Firebase Admin SDK kimliği (gitignore'da, makineye özel)
```

---

## 11) Blaze Kota Sorunu — Bulgu ve Çözüm (2026-08-05)

**Sorun:** 60 VU / uzatılmış süre koşumunda checks başarı oranı **%75.1**'e
düştü (1453/1934 geçti, 481 başarısız — `summary-20260805-140451-vus60.json`),
`http_req_duration{steady}` avg=4.58s, p95=19.7s — kurulum bug'ı gibi görünen
ama aslında **Firestore Spark (ücretsiz) plan günlük kota tükenmesi** (yük-
bağımsız, sabit günlük limit — kota bitince TÜM istekler, VU sayısından
bağımsız, aynı anda başarısız olmaya başlıyor). Vercel Dashboard Logs +
curl'le doğrulandı.

**Çözüm:** `flexos-loadtest` projesi Blaze'e yükseltildi (mevcut bir Cloud
Billing hesabı yeniden kullanıldı, yeni kart gerekmedi — Blaze'de de aynı
ücretsiz kota kalır, sadece sert tavan kalkar, aşımda throttle değil ücret
başlar).

**Doğrulama (Blaze sonrası, aynı 60 VU profili,
`summary-20260805-150052-vus60-blaze.json`):**

| Metrik | Blaze ÖNCESİ | Blaze SONRASI |
|---|---|---|
| checks başarı | %75.1 (1453/1934) | **%100 (3754/3754)** |
| `http_req_duration{steady}` avg | 4.58s | **727ms** |
| p95 | 19.7s | **1.38s** |
| p99 hedefi (<2s) | ❌ | ✅ |

---

## 12) Tam Sistem Testi (Connect Hariç) — Sonuçlar (2026-08-05)

Kapsam: satış→eğitim→op→eğitmen→yoklama döngüsünün TAMAMI (Connect kasıtlı
hariç — o zaten §1-11'de ayrı test edildi). `scripts/k6/full-system.js`, 6
persona (öğrenci/eğitmen/eğitim koordinatörü/öğrenci işleri/satış temsilcisi/
genel müdür), `--profile=system` seed verisi (500 öğrenci, 20 personel —
3 admin/3 satış/3 op/8 eğitmen/3 koordinatör, 40 sınıf). Sabit koşum
parametresi: **VUS=30, DURATION=90s** (varsayılan, kullanıcı kararıyla —
gerçek baseline olarak bu kabul edildi).

Üç ayrı koşum: **BASELINE** (3 optimizasyon öncesi) → **POST-OPT** (attendance
query daraltma + sales cache sonrası) → **POST-OPT v2** (persons
`withAccountStatus` opt-in sonrası). Her koşumda **%0 hata, checks %100
geçti** (0 fails) — üç koşumda da eşik ihlali yaşanmadı.

### Genel `http_req_duration{stage:steady}`

| Koşum | avg | med | p90 | p95 | max |
|---|---|---|---|---|---|
| Baseline (15:45) | 811ms | 719ms | 1321ms | **1678ms** | 8148ms |
| Post-opt (16:31) | 632ms | 640ms | 887ms | **1066ms** | 3870ms |
| Post-opt v2 (16:36) | 574ms | 618ms | 792ms | **858ms** | 1250ms |

**p95 toplamda 1678ms → 858ms (~%49 iyileşme).** Toplam istek/iterasyon:
baseline 1356 istek/533 iterasyon, post-opt 1462/571, post-opt v2 1491/582
(10-11 req/s sabit — kapasite değil gecikme optimize edildi).

### Endpoint bazlı (avg, en yavaştan en hızlıya — BASELINE)

| Endpoint (senaryo) | Baseline avg | Post-opt avg | Post-opt v2 avg |
|---|---|---|---|
| `ops_attendance_report` (yoklama raporu, koordinatör) | **1634ms** | 1319ms | **688ms** |
| `student_affairs_persons` (Havuz listesi, öğrenci işleri) | **1433ms** | 911ms | **688ms** |
| `trainer_grade` (not verme) | 1104ms | 900ms | 878ms |
| `sales_create` (satış oluşturma) | 942ms | 891ms | 985ms |
| `student_assignments` (ödev listesi) | 879ms | 775ms | 720ms |
| `student_activity` (öğrenci aktivite) | 862ms | 781ms | 723ms |
| `sales_list` (satış listesi) | 859ms | 554ms | 415ms |
| `ops_groups` (sınıf listesi) | 805ms | 479ms | 360ms |
| `trainer_attendance_read` (yoklama okuma) | 740ms | 682ms | 523ms |
| `me` (dashboard/capability) | 733ms | 571ms | 495ms |

**`ops_attendance_report`** (bulgu #10 — Firestore query daraltma) ve
**`student_affairs_persons`**/**`sales_list`** (bulgu #11/#12 — sales cache +
persons `withAccountStatus` opt-in) en büyük iyileşmeyi gösterdi — tam olarak
optimize edilen 3 uç bunlardı, ölçüm beklenen sonucu doğruladı. `sales_create`
ve `trainer_grade` (optimize EDİLMEYEN yazma uçları) 3 koşum boyunca kabaca
sabit kaldı — bu da optimizasyonların yalnızca hedeflenen okuma yollarını
etkilediğini, başka bir şeyi yanlışlıkla hızlandırmadığını (ya da
yavaşlatmadığını) doğruluyor.

---

## 13) Persons Endpoint Pagination — Tasarım ve Doğrulama (2026-08-05)

**Tasarım (kullanıcı onaylı "Seçenek C"):** `GET /api/flexos/persons`
geriye-uyumlu `?limit=&cursor=` — parametre verilmezse eski davranış (tam
liste) birebir korunur. Cursor: `createdAt DESC, __name__ DESC` composite
sıralama + `"${createdAt}|${id}"` kodlanmış cursor (tek-alanlı cursor'ın aynı
milisaniyede oluşan kayıtlarda kararsız olma riskini ortadan kaldırır,
kullanıcı talebiyle eklendi). Havuz ve Kullanıcılar sayfaları: ilk yükleme
50 kayıt + "Daha Fazla Yükle", arama/filtre aktifleşince (bir kere) tam
listeye yükseliyor.

**API doğrulaması (flexos-loadtest, 516 gerçek seed kişi, gerçek Bearer
token'larla curl):**

| Aktör | İstek | Sonuç |
|---|---|---|
| Genel Müdür (org-scope) | `?limit=10` | 10 kayıt + `nextCursor` — sayfa 2'ye cursor'la devam edildi, farklı (daha eski) `createdAt` + doğru sonraki kayıt döndü |
| Standalone eğitmen (assigned-scope) | `?limit=10` | **62 kayıt** (kendi TÜM öğrencileri), `nextCursor` YOK — org-wide ham sayfaya düşüp öğrenci gizleme riski ortadan kalktı (bkz. §14, bulgu #3) |
| Genel Müdür | parametresiz | 516/516 kayıt, `nextCursor` alanı hiç yok — eski davranış birebir korunuyor |

Frontend tarafı yerel dev sunucuda (gerçek prod veri, gerçek admin oturumu)
smoke-test edildi: Havuz ve Kullanıcılar sayfaları hatasız yüklendi, tüm
`/api/flexos/persons` istekleri 200 döndü, konsolda hata yok. Üretimde sadece
35 öğrenci olduğundan "Daha Fazla Yükle" tetiklenmedi (35<50) — bu spesifik
UI akışı için bkz. §14.

---

## 14) 2026-08-05 Code Review — Bulgular ve Doğrulama

Bu oturumdaki tüm diff `/code-review` ile tarandı, 6 bulgu çıktı, hepsi
düzeltildi:

| # | Bulgu | Durum |
|---|---|---|
| 1 | Havuz sayfası: realtime sync, "Daha Fazla Yükle" ile genişletilmiş listeyi sessizce ilk 50'ye sıfırlıyordu | ✅ Düzeltildi (`hasLoadedExtra` bayrağı) |
| 2 | Kullanıcılar sayfası: aynı hata | ✅ Düzeltildi (`stuHasLoadedExtra` bayrağı) |
| 3 | `buildPersonsPage`: assigned-scope aktörler (standalone eğitmen) için org-wide ham sayfa + sayfa-içi filtre, öğrenci gizleyebiliyordu | ✅ Düzeltildi — bu aktörler artık her zaman tam-liste yoluna yönlendiriliyor, §13'te API ile doğrulandı |
| 4 | Cron batch commit hatası atomiklik/log kaybına yol açıyordu (`auto-close-attendance`, `auto-close-flexos-attendance`) | ✅ Düzeltildi (chunk-bazlı try/catch + `closedDocs` takibi) |
| 5 | 6 repo dosyasında tekrarlanan 30'luk chunk deseni | ✅ Refactor edildi (`src/app/lib/server/firestore-chunk.ts`) |
| 6 | `buildAllPersons`/`buildPersonsPage` tekrarlanan map-kurulumu | ✅ Refactor edildi (ortak `buildJoinMaps()`) |

**Doğrulama:** `npx tsc --noEmit -p .` temiz, `npx vitest run` 107/107 geçti,
`flexos-loadtest`'e yeniden deploy edildi, §13'teki API testleri bu deploy
sonrası koşuldu, üretimde frontend smoke-test yapıldı (hata yok).

**Test edilemeyen tek senaryo (dürüstçe not edilmeli):** Bulgu #1/#2'nin tam
uçtan-uca tekrar-üretimi ("50+ kayıt yükle → realtime tetikle → sıfırlanmadığını
gör") — üretimde sadece 35 öğrenci olduğu için "Daha Fazla Yükle" hiç
tetiklenmiyor, staging'e (516 kayıt) CSP kısıtları yüzünden hızlı custom-token
login açılamadı (`script-src` harici Firebase SDK yüklemesine izin vermiyor).
Mantık basit iki bayrak eklemesi olduğundan `tsc`/kod incelemesiyle doğruluğu
güvenceye alındı, ama canlı tekrar-üretim yapılmadı.
