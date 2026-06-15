# FlexOS — Mimari (Birleşik Referans)

> **Bu dosya, yeni mimarinin tek kaynağıdır.** Önceki dört ayrı doküman
> (`ARCHITECTURE.md`, `FLEXOS_MIMARI.md`, `FLEXOS_CAPABILITIES.md`, `FLEXOS_MVP_FLOW.md`)
> burada birleştirildi.
>
> - **Bugünkü canlı sistemin** teknik referansı için → `FLEX_CORE_LORE.md`
> - **Gelişim günlüğü** için → `FLEX_CORE_LOG.md`
> - **Bu dosya** = gelecekteki yeniden-inşa tasarımı (henüz kod yazılmadı; tasarım 2026-06-09'da kilitlendi).
>
> Son güncelleme: Haziran 2026

---

## Durum / İlerleme (yeniden-inşa)

> Bu blok **ne yapıldığını** izler (tasarım aşağıda, ilerleme burada).
> Branch: `flexos` · Canlı `main` ETKİLENMİYOR · yeni koleksiyonlar (`persons`/`enrollments`), eskilere yazılmıyor.

- [x] Mimari 4 dosyadan tek `FLEXOS.md`'ye birleştirildi (2026-06-15)
- [x] **Tip katmanı yazıldı** — `src/app/lib/domain/` (`core/`: Person, Enrollment, Group, Module, PersonNote · `education/`: Grade · `eduos/` dikiş: Education, Sale, Payment) · `tsc` temiz · canlıya dokunmadı
- [x] **Yetki omurgası yazıldı** — `src/app/lib/domain/access/` (capability registry ~22 + `Scope`/`Sensitivity`/`Actor` tipleri + 4 paket Satış/Op/Eğitmen/Admin + `can()`/`hasCapability()`/`widestScope()`). `person.pii.write` eklendi; eğitmen paketinde PII YOK. `tsc` temiz
- [ ] **SIRADAKİ →** Repo/adapter katmanı (Firestore ↔ domain dönüşümü) — `persons` yaz/oku (yeni koleksiyon)
- [ ] En ince dikey dilim: öğrenci ekle (capability'li form — eğitmen sade / satış tam) → enrollment → eğitmen kendi öğrencisini görür
- [ ] Backfill (`students` → `persons`, tek yönlü, okuma)

---

## İçindekiler

1. [Vizyon, Felsefe ve Modül Haritası](#1-vizyon-felsefe-ve-modül-haritası)
2. [Veri Modeli ve Mimari Katmanlar](#2-veri-modeli-ve-mimari-katmanlar)
3. [Capability & Yetki Modeli](#3-capability--yetki-modeli)
4. [MVP Çekirdek Akış (Blueprint)](#4-mvp-çekirdek-akış-blueprint)
5. [Süreç Sorumlulukları, Öğrenci Kartı ve Güvenlik](#5-süreç-sorumlulukları-öğrenci-kartı-ve-güvenlik)
6. [Yol Haritası ve İnşa Sırası](#6-yol-haritası-ve-inşa-sırası)

---

# 1. Vizyon, Felsefe ve Modül Haritası

## Temel Felsefe

Flex, bir eğitim kurumunun tüm işlemlerini yapacağı bir **işletim sistemidir**.

**Öğrenci merkezli sistem.** Öğrenci gruba, eğitime veya satışa bağlı düşünülmez.
Öğrenci sistemin ana varlığıdır. Satışlar, ürünler, eğitimler, gruplar ve sertifikalar öğrenci etrafında şekillenir.

```
Kişi (Öğrenci)
↓
Satış
↓
Ürün / Paket
↓
Eğitim Kayıtları (Enrollment)
↓
Gruplar
↓
Eğitim Süreci (Yoklama / Not / Sertifika)
```

### Kök Felsefe — Person ≠ Enrollment

**Person (insan) ≠ Enrollment (gruptaki katılım).** Sınıfa özel her şey (devam, not, ödev, sertifika) Enrollment'ta tutulur. Aynı insan birden çok gruba (eş zamanlı dahil) katılabilir → **1 Person + N Enrollment**. Mevcut sistemde `students` aslında bir üyelik kaydı; bu yüzden "aynı insan için çok doküman", "aynı mail", "eş zamanlı grup" sorunları çıkıyor. Çözüm: kişiyi üyelikten ayır.

**"Eğitime göre öğrenci, kuruma göre müşteri"** — bu bir tip değil, bakış açısı. Aynı kişi satış için müşteri, eğitmen için öğrenci.

## Platform Vizyonu (Monorepo)

**Flex**, tasarım eğitim ekosistemi için çok uygulamalı bir platform. Şu an tek Next.js repo içinde yaşıyor; ileride Turborepo monorepo'ya bölünebilir.

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

**Flex-Trainer tamamlanma kriteri:** Yoklama modülü ✅ + Sertifikasyon akışı (devam ediyor).

> **Deployment notu:** Bugün tek root, tek Next.js uygulaması; modüller route bazlı ayrılır.
> Separate repo veya Turborepo bugün **gerekmez** — auth, veri ve UI ortak, ekip küçük, overhead gereksiz.
> Monorepo'ya bölme ancak uygulamalar gerçekten ayrıştığında yapılır.

## Mevcut Durum (Geçici)

Eğitim Operasyonu ve Satış modülleri henüz geliştirilmediği için grup yönetimi **geçici olarak** eğitmen tarafında yapılmaktadır.

Eğitmen şu an: grup oluşturuyor · öğrenci ekliyor · yoklama alıyor · proje notu giriyor.

Bu yapı geçicidir. Uzun vadede **eğitmen grup yönetemez**; bu sorumluluk Eğitim Operasyonu'na geçecektir.

## Modül Haritası

```
flex/
├── trainer/       ← Eğitmen Paneli (mevcut, neredeyse tamamlandı)
├── operation/     ← Eğitim Operasyonu (sıradaki büyük modül)
├── sales/         ← Satış
├── finance/       ← Muhasebe
└── shared/        ← Ortak sistemler (öğrenci, bildirim, sertifika, arama)
```

| Modül | Alt süreçler |
|-------|--------------|
| **Trainer** (Eğitmen) | dashboard · attendance · projects · students* · certificates · grading |
| **Operation** (Eğitim Op) | groups · planning · schedules · trainers · certificates |
| **Sales** (Satış) | leads · sales · products · enrollments |
| **Finance** (Muhasebe) | payments · contracts · collections |
| **Shared** (Ortak) | students · notifications · quick-search · certificates |

\* `trainer/students` geçicidir, ileride `operation`'a geçer.

## Önemli Prensip — Veri Tekrarı Yok

Yanlış: `trainer/students` + `operation/students` + `sales/students` (aynı veri üç yerde).
Doğru: **`shared/students`** — tek kaynak, tüm modüller buraya erişir.

Rol klasörleri **ekran ve süreç** ayrımı içindir. Veri yapıları ve ortak sistemler **shared** altındadır.

```
Trainer / Operation / Sales / Finance   = süreç
Students / Quick Search / Notifications / Certificates   = ortak veri & servis
```

---

# 2. Veri Modeli ve Mimari Katmanlar

> **Durum:** Tasarım/tartışma kilitlendi (2026-06-09). Kod yazılmadı.

## 2.1 Ayrılabilirlik Kısıtı (en kritik mimari kural)

Eğitmen tarafı ileride **"Flex Classroom"** olarak ayrı ticari ürün çıkabilmeli. Bu yüzden iki katman:

| Katman | İçerik | Bağımlılık |
|--------|--------|------------|
| **Core (Classroom)** | Person, Enrollment, Group, Module + eğitim verisi (yoklama/not/ödev/sertifika sonucu) | Kendi kendine yeter, üst katmanı **bilmez** |
| **FlexOS (üst katman)** | Education (ürün), Sale, Payment, Account (firma), Quota, Branş, Şube, gelir raporu | Core'u besler, Core'a bağımlı |

**Demir kural:** Bağımlılık tek yönlü → `FlexOS → Core`. Core, FlexOS'tan import etmez.
Üst katmandan gelen tüm alanlar Core'da **opsiyonel/nullable** (`Enrollment.saleId?`, `Person.accountId?`).
Klasör: `lib/domain/core` ve `lib/domain/eduos`.

**İki kapı:** Enrollment iki yoldan doğabilir:
1. **Eğitmen quick-add (Core):** satış YOK, grup+öğrenci manuel. Standalone Classroom böyle çalışır.
2. **Satış (FlexOS):** Sale → Person + Enrollment.

## 2.2 Hiyerarşi

```
ŞUBE (lokasyon: Kadıköy/Şirinevler/Pendik — satış ekibi buraya bağlı)
BRANŞ (disiplin: Grafik Tasarım, Yazılım)
   └─ EĞİTİM (ürün, satılır: Grafik-1, Grafik-2, Python, "Tasarım Full"=paket)
        └─ MODÜL (Temel Photoshop, Temel Illustrator, Corel Draw)
             └─ GRUP / SINIF (eğitmen, takvim, kontenjan, type)
                  ├─ Attendance (Yoklama)
                  ├─ Grades (Not / XP)
                  └─ Certificate (Sertifika sonucu)
```

- **Şube ≠ Branş.** Şube = fiziksel lokasyon + satış ekibi. Branş = disiplin. Gelir raporu ikisini de ister → Sale her ikisini taşır (şube doğrudan, branş eğitim üzerinden).
- **Eğitim = satılan ürün.** Grafik-1 ve Grafik-2 ayrı satılabilen eğitimler. Paket = bundle-tipi eğitim (içinde N eğitim, tek total fiyat).
- **Grup = eğitimin somut sınıfı.** Bir eğitimi baştan sona işler (örn. 81 saat, tüm modülleri sırayla, tek sınıf).

### Ortak modül (cross-education)
Bir modül farklı eğitimlerin öğrencilerine **ortak sınıfta** verilebilir. Örnek: AutoCAD/sosyal medya öğrencisi "Temel Photoshop"u mevcut Grafik-1 grubunun Photoshop haftalarına katılarak alır (ayrı sınıf açılmaz). Modül bitince mezun edilir, yoklaması kilitlenir.

## 2.3 Varlıklar ve Alanlar

> Katman etiketi: **(Core)** = Classroom çekirdeği, **(FlexOS)** = üst katman.

### Person (Core) — merkez, kalıcı
`id, kimlik{tip: tc|pasaport|yabancı, no}, ad, soyad, telefon, email, cinsiyet, adres`
- **Kimlik = benzersiz anahtar.** Herkesin bir belgesi var (TC yoksa pasaport/yabancı kimlik).
- Sert benzersiz kısıt yerine: ekleme sırasında email/tel/kimlik ile **yumuşak eşleştirme** → "bu kişi zaten var olabilir, mevcut olanı mı kullanıyorsun?" insan onayı. Mail = yardımcı sinyal, sert kilit değil.
- **Grup/eğitim verisi YOK** (o Enrollment'ta).
- Sistemden **silinmez.** Öğrenci kurumun en değerli verisidir: birden fazla eğitim alabilir, birden fazla paket satın alabilir, farklı yıllarda geri dönebilir; geçmiş eğitimleri/grupları/sertifikaları korunur. (KVKK silme talebi → anonimleştir, eğitim geçmişi kalır.)

### Enrollment (Core) — kişinin bir GRUPTAKİ katılımı (kritik köprü)
Sistemin kritik köprü varlığı: Sale ile Group arasındaki bağ.

`id, personId, educationId, groupId?, moduleScope?, başlangıçTarihi, bitişTarihi?, durum, saleId?`

```
Enrollment {
  personId
  saleId?           ← Core'da opsiyonel (standalone Classroom'da boş; FlexOS'ta zorunlu)
  educationId       ← paketteki hangi eğitim
  groupId?          ← hangi gruba yerleşti (boş = grupsuz havuzda bekliyor)
  moduleScope?      ← boş = grubun eğitiminin tüm modülleri; dolu = sadece o modül(ler)
  durum             ← aktif | dondurulmuş | mezun | tamamlandı | transfer | tekrar | bıraktı
  transferHistory[] ← grup değişiklik geçmişi

  // ── Donmuş sonuç (sınıf bitince yazılır, kalıcı) ──
  result {
    finalNot          ← eğitmenin notundan hesaplanan nihai not
    projeNot
    odevPuani
    groupCode         ← hangi sınıfta alındı (denormalize)
    module            ← hangi modül/eğitim
    branch
    donem             ← hangi dönem/yıl
  }
  certificate {
    durum             ← bekliyor | hak_kazandı | kalamadı | verildi
    tip               ← Katılım | Başarı | MEB
    kod               ← belge no (verilince)
    verilisTarihi
  }
}
```

- **Yoklama / not / ödev** grup seviyesinde tutulur (mevcut sistem: `design_attendance` grup bazlı, `gradedTasks` classId bazlı — **DEĞİŞMİYOR**).
- **Not + Sertifika sonucu Enrollment'ta DONAR.** Eğitmenin girdiği not, sınıf bitince (modül finalize / mezuniyet) nihai nota hesaplanır ve **o anda enrollment'a snapshot'lanır** — sonradan ödev/ağırlık değişse veya grup silinse bile **değişmez**. Sertifika dondurulmuş bir gerçektir, her açılışta yeniden hesaplanmaz.
- **Her eğitim ayrı saklanır.** Bir Person birden çok Enrollment taşır; her birinin notu, sertifikası ve sınıf bilgisi ayrı ayrı durur. Aynı kişinin Grafik-1 notu ile Grafik-2 notu bağımsızdır.
- **Sertifika verilmesi kurumun işidir, eğitmenin değil.** Eğitmen yalnızca notu besler (`certificate.durum = hak_kazandı`). Basım/dağıtım Eğitim Operasyonu'nda ayrı adımdır (bkz. §5 Sertifika Akışı).

> Bugünkü sistem notu canlı hesaplayıp `projectGrades`'e yazıyor; donmuş per-enrollment sonuç + sertifika alanları **sıfırdan inşada** eklenecek. 1. etapta sertifika üretilmez ama şema baştan bu alanları taşır.

### Group / Sınıf (Core)
`id, educationId, instructorId, takvim, kontenjan, type, şubeId, durum`
- `type`: standart | özel_ders | kurumsal (teslim formatı).
- `instructorId`: gruba atanan eğitmen. Öğrenci gruba girince bu eğitmenin altına düşer.
- **Gruplar geçicidir.** İsimler değiştirilmez, yeni grup oluşturulur; öğrenciler eski gruptan seçilerek yeni gruba aktarılır → geçmiş yoklama/not/sertifika korunur.

**Grup yaşam döngüsü:**
```
Planlandı → Kayıt Alıyor → Aktif → Ertelendi → Tamamlandı → Sertifika Sürecinde → Arşiv
```

### Module (Core)
`id, educationId, ad, sıra, saat`

### Education / Eğitim (FlexOS) — satılan ürün
`id, ad, branşId, listeFiyatı, kdv, satışaAçık, modules[], sertifikaTanımı`
- `listeFiyatı`: ürün fiyatı (+KDV otomatik). Değişince satış ekranı görür.
- `sertifikaTanımı`: hangi sertifika (Katılım/Başarı/MEB) + koşullar (min devam %, min not, MEB belge bilgisi). **Şu an yanlış yerde** (`users/{instructorId}.certSettings`) → buraya taşınacak.
- Paket = bundle-tipi Education (içinde N education referansı, tek total fiyat).
- Ödeme **ürün seviyesinde** tutulur, devam **eğitim seviyesinde** tutulur. Tek eğitim satışı da, paket satışı da desteklenir.

### Sale / İşlem (FlexOS) — enrollment hareket defteri
`id, tip, customerType, personId, accountId?, educationId(ler), satışFiyatı, salespersonId, şubeId, tarih`
- `tip`: yeni_satış | transfer | tekrar | yerleştirme.
- **Her öğrenci hareketi bir Sale ile başlar — tutar 0 TL olsa bile** (Bilge Adam deseni: güvenlik/denetim, tek giriş kapısı, headcount-gelir tutarlılığı). Transfer/tekrar = çoğu 0 TL.
- `satışFiyatı`: kampanya/indirim sonrası **fiilen satılan** tutar. Gelir raporu bundan çıkar (≠ liste fiyatı).
- `customerType`: bireysel | kurumsal. Özel ders = bireyselin içinde bir tip (Grup.type).
- Paket satışı → 1 Sale → N Enrollment.

### Account / Müşteri (FlexOS) — kurumsal
`id, firmaAdı, yetkili, telefon, ...` → 1 firma N Person.
- Bireyselde ödeyen = kişinin kendisi (ayrı Account yok).
- **Kurumsal en baştan ayrı:** ayrı panel, ayrı firma/yetkili verisi, ayrı gelir (rapor istenirse birleştirilir).

### Payment (FlexOS)
Taksit/tahsilat. `tutar, taksit, durum`. (1. etap dışı, alan hazır.)

### Quota (FlexOS)
**Gelir bazlı** (örn "ay 200k"). Satışçı bazlı + genel.

## 2.4 Akışlar

### Bireysel satış → grup → eğitmen (1. ETAP HEDEFİ)
```
1. SATIŞ      Satışçı eğitim seçer + kişi (yeni/mevcut)
              → Person + Sale + Enrollment(groupId boş, durum=havuzda)
2. GRUBA EKLE Eğitim op havuzdaki enrollment'ı uygun gruba atar
              → groupId set, durum=aktif
3. EĞİTMEN    Grup zaten bir eğitmene ait (Group.instructorId)
              → öğrenci o eğitmenin altına düşer
```

### Ortak modül / dış öğrenci (Ahmet AutoCAD → Temel Photoshop)
Eğitim op uygun (yeni başlayan) Grafik-1 grubu bulur → Ahmet'i yerleştirir (ek satış veya 0 TL transfer) → modül bitince mezun eder → yoklama kilitlenir, enrollment kapanır. `moduleScope = "Temel Photoshop"`.

### Transfer / tekrar
Eski enrollment'ı kapatan + yeni enrollment açan 0 TL'lik Sale (tip=transfer/tekrar). Eski veri (yoklama/not/sertifika) silinmez — eski grubun anahtarıyla ayrı kayıtlarda durur.

## 2.5 Non-Functional Kriterler ("1 sene sonra da çalışsın")

1. **Veri şişmesi:** Person dokümanı küçük; yoklama/not/ödev Enrollment'ın alt-koleksiyonlarında ayrı dokümanlar. Doküman-içi sınırsız array/map YOK (mevcut `gradedTasks` map'i bu hatanın örneği). "Tek alanda gör" = okuma-zamanı birleştirme, tek dev doküman değil.
2. **Firestore ölçek/maliyet:** Bu ölçekte (yüzler–binler öğrenci, yıllar) yeterli. Sınır boyut değil okuma-sayısı. Full-collection `onSnapshot` YOK → `where`+`limit`+sayfalama. Raporlamada aggregation sorgusu veya aylık rollup dokümanı (şube+branş+ay → toplam). İndeks: şube, branş, tarih.
3. **Security:** Veriyi concern'e göre ayrı koleksiyonlara böl (satış/ödeme/eğitim). Rules modelle BİRLİKTE tasarlanır. Person/Enrollment ayrımı güvenliği kolaylaştırır (öğrenci kendi enrollment'ı, eğitmen kendi grubunun enrollment'ları, finans ödeme).

---

# 3. Capability & Yetki Modeli

> Departman-agnostik domain ve atomik yetki (capability) referansı.
> Yetki sisteminin, modüler mimarinin ve AI entegrasyonunun temelidir.
> Yeni bir modül/ekran/eylem eklerken önce buraya bakılır, capability buradan türetilir.

## 3.1 Tasarım İlkeleri

**1. Capability = bir domain üzerinde atomik eylem.** Departmana değil, işe bağlı.
Kodda asla `if (role === "satış")` yok; her zaman `can("student.create")`.

**2. İsimlendirme:** `domain.action` veya `domain.subdomain.action` — küçük harf, nokta ayraç, fiil sonda. Örn: `attendance.write`, `certificate.issue`, `person.note.read`.

**3. Scope ayrı bir eksen — capability'yi şişirmez.** Her yetki *grant*'i bir kapsam taşır:

| Scope | Anlamı | Tipik |
|-------|--------|-------|
| `self` | Sadece kendi kaydı | Öğrenci portalı |
| `assigned` | Atanmış grup/öğrenci | Eğitmen |
| `branch` | Şube geneli | Şube müdürü |
| `org` | Tüm kurum | Admin / Operasyon |

`attendance.write @assigned` (eğitmen) ile `attendance.write @org` (operasyon) **aynı capability, farklı scope**.

**4. Rol/Departman = capability+scope paketinin isimlendirilmiş hali.** Veride sabit değil, düzenlenebilir. "Eğitmen", "Satış", "Kıdemli Eğitmen" hepsi birer paket. Departman→yetki eşleşmesi kuruma göre değişir; bu yüzden sabitlenmez.

**5. Hassasiyet seviyesi** her capability'nin metadata'sı — audit, ekstra onay ve AI gating'i belirler:
- 🟢 **Normal**
- 🟡 **Hassas** — PII/scope kritik, audit'lenir
- 🔴 **Kritik** — geri alınamaz / maliyetli / hukuki → zorunlu audit + insan onayı

**6. Capability Registry şeması** (kayıt başına):

```ts
{
  key: string;            // "assignment.cancel"
  domain: string;         // "assignment"
  label: string;          // "Ödevi İptal Et"  (TR — AI grounding)
  description: string;    // ne yaptığı (TR)
  sensitivity: "green" | "yellow" | "red";
  write: boolean;         // okuma mı yazma mı (audit + AI güvenliği)
  scopable: boolean;      // scope ekseni uygulanır mı
  audited: boolean;       // audit log'a düşer mi
}
```

Bu tek şema 4 şeyi birden besler: **yetki UI'ı · middleware · audit log · AI tool yüzeyi.**

## 3.2 Domain Haritası

| # | Domain | Rol |
|---|--------|-----|
| 1 | `person` (Öğrenci/Kişi) | Merkezi varlık |
| 2 | `enrollment` (Eğitim Kaydı) | Köprü |
| 3 | `group` (Grup) | Süreç kabı |
| 4 | `attendance` (Yoklama) | Eğitim süreci |
| 5 | `grade` (Not) | Eğitim süreci |
| 6 | `assignment` (Ödev/Çekiliş) | Eğitim süreci |
| 7 | `certificate` (Sertifika) | Çıktı |
| 8 | `task` (Görev — operasyonel) | İş akışı |
| 9 | `notification` (Bildirim) | Kanal |
| 10 | `sms` / `email` (İletişim) | Kanal |
| 11 | `system` (user/role/audit/import) | Çapraz |

> **Kapsam dışı (sonraki tur):** `sale`, `payment`, `contract` — Satış/Finans domain'leri. Eğitim Operasyonu'na geçmeden ele alınmayacak.

## 3.3 Capability Tabloları

### 1. `person` — Öğrenci / Kişi
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `person.create` | Yeni kişi kaydı aç | 🟡 | – |
| `person.read` | Temel bilgi (ad, durum, grup) | 🟢 | ✓ |
| `person.read.pii` | TC, telefon, e-posta, adres | 🟡 | ✓ |
| `person.edit` | Temel bilgileri düzenle | 🟡 | ✓ |
| `person.deactivate` | Pasife al (mezun/ayrıldı) | 🟢 | ✓ |
| `person.anonymize` | KVKK silme → anonimleştir | 🔴 | – |
| `person.merge` | Çift kayıtları birleştir (legacy dedup) | 🔴 | – |
| `person.note.read` | Eğitmen notlarını gör (blur açma) | 🟡 | ✓ |
| `person.note.write` | Eğitmen notu ekle/düzenle | 🟢 | ✓ |
| `person.history.read` | Grup/enrollment geçmişi | 🟢 | ✓ |
| `person.consent.manage` | KVKK rıza durumu | 🔴 | – |
| `person.export` | Liste/kişi verisi dışa aktar | 🟡 | ✓ |
| `person.search` | Ctrl+K global arama | 🟢 | ✓ |

### 2. `enrollment` — Eğitim Kaydı (köprü)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `enrollment.create` | Kişiyi bir eğitime kaydet | 🟡 | – |
| `enrollment.read` | Kayıt + donmuş sonucu gör | 🟢 | ✓ |
| `enrollment.edit` | Kayıt alanlarını düzenle | 🟡 | ✓ |
| `enrollment.transfer` | Grup değiştir (geçmiş korunur) | 🟡 | ✓ |
| `enrollment.freeze` | Dondur | 🟢 | ✓ |
| `enrollment.resume` | Dondurulmuşu aktif et | 🟢 | ✓ |
| `enrollment.complete` | Mezuniyet → **sonucu DONDUR** | 🔴 | ✓ |
| `enrollment.cancel` | Kaydı iptal et | 🟡 | ✓ |

### 3. `group` — Grup
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `group.create` | Grup oluştur | 🟢 | ✓ |
| `group.read` | Grup detayı | 🟢 | ✓ |
| `group.edit` | İsim/branş/seans düzenle | 🟢 | ✓ |
| `group.archive` | Arşive al | 🟡 | ✓ |
| `group.delete` | Kalıcı sil | 🔴 | ✓ |
| `group.assign_student` | Öğrenci yerleştir | 🟡 | ✓ |
| `group.remove_student` | Öğrenci çıkar | 🟡 | ✓ |
| `group.assign_trainer` | Eğitmen ata | 🟡 | ✓ |
| `group.activate` | Planlandı → Aktif (yoklama açılır) | 🟡 | ✓ |
| `group.postpone` | Ertele | 🟢 | ✓ |
| `group.complete` | Tamamlandı'ya al | 🟡 | ✓ |
| `group.schedule.edit` | Takvim/tatil yönetimi | 🟢 | ✓ |
| `group.league.toggle` | Lig sistemini aç/kapat | 🟢 | ✓ |

### 4. `attendance` — Yoklama
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `attendance.read` | Yoklama kayıtlarını gör | 🟢 | ✓ |
| `attendance.start` | Dersi başlat | 🟢 | ✓ |
| `attendance.write` | Yoklama al/işaretle | 🟢 | ✓ |
| `attendance.close` | Dersi bitir/kapat | 🟢 | ✓ |
| `attendance.edit_past` | Geçmiş yoklama düzelt (zaman-kilidi aşımı) | 🟡 | ✓ |
| `attendance.report.read` | Yoklama raporları | 🟢 | ✓ |
| `attendance.export` | Rapor dışa aktar | 🟡 | ✓ |

### 5. `grade` — Not
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `grade.read` | Notları gör | 🟢 | ✓ |
| `grade.write` | Proje notu / XP gir | 🟢 | ✓ |
| `grade.settings.edit` | Ağırlıklar, certSettings | 🟡 | ✓ |
| `grade.finalize` | Modülü bitir → **not donar** | 🔴 | ✓ |
| `grade.report.read` | Not raporları | 🟢 | ✓ |

### 6. `assignment` — Ödev (Çekiliş + Teslim)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `assignment.create` | Ödev tanımla/ata | 🟢 | ✓ |
| `assignment.read` | Ödev/arşiv gör | 🟢 | ✓ |
| `assignment.edit` | Ödev düzenle | 🟢 | ✓ |
| `assignment.draw` | Çekiliş yap | 🟢 | ✓ |
| `assignment.cancel` | Ödevi iptal et (cascade) | 🟡 | ✓ |
| `assignment.archive.delete` | Arşiv kaydını kalıcı sil | 🔴 | ✓ |
| `assignment.pool.manage` | Havuz (marka/kitap/kategori) tanımları | 🟡 | – |
| `assignment.submission.read` | Öğrenci teslimlerini gör | 🟢 | ✓ |
| `assignment.submission.grade` | Teslimi puanla | 🟢 | ✓ |

### 7. `certificate` — Sertifika
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `certificate.eligibility.read` | Hak ediş hesabını gör | 🟢 | ✓ |
| `certificate.read` | Sertifika durumu/kaydı | 🟢 | ✓ |
| `certificate.issue` | **Bastır → durum=verildi** (kurum yetkisi) | 🔴 | – |
| `certificate.revoke` | Sertifikayı iptal et | 🔴 | – |
| `certificate.template.manage` | Şablon/MEB bilgileri | 🟡 | – |
| `certificate.export` | PDF üret | 🟡 | ✓ |

> Mimari kuralı: **eğitmende `certificate.*` yazma yok**, sadece `grade.*`.
> Hak ediş `grade.finalize` ile beslenir, basım `certificate.issue` ile kurumda.

### 8. `task` — Görev (operasyonel iş akışı)
> Öğrenci ödevinden (`assignment`) farklı: personele atanan iç işler — "şu öğrenciyi ara", talep/şikayet, grup açma talebi.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `task.create` | Görev oluştur | 🟢 | ✓ |
| `task.read` | Görevleri gör | 🟢 | ✓ |
| `task.assign` | Birine/departmana ata | 🟢 | ✓ |
| `task.update` | Durum/içerik güncelle | 🟢 | ✓ |
| `task.complete` | Tamamla | 🟢 | ✓ |
| `task.delete` | Sil | 🟡 | ✓ |
| `task.comment` | Yorum ekle | 🟢 | ✓ |

### 9. `notification` — Bildirim (uygulama içi)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `notification.read` | Kendi bildirimlerini gör | 🟢 | `self` |
| `notification.send` | Tekil/grup bildirimi gönder | 🟢 | ✓ |
| `notification.broadcast` | Toplu bildirim | 🟡 | – |
| `notification.template.manage` | Şablon yönetimi | 🟡 | – |

### 10. `sms` / `email` — İletişim Kanalları
> Kanal = maliyet/hukuk taşır. Toplu gönderim ayrı ve kritik.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `sms.send` | Tekil SMS | 🟡 | ✓ |
| `sms.bulk_send` | Toplu SMS (maliyet) | 🔴 | – |
| `email.send` | Tekil e-posta (ödev maili vb.) | 🟢 | ✓ |
| `email.bulk_send` | Toplu e-posta | 🟡 | – |
| `messaging.template.manage` | SMS/e-posta şablonları | 🟡 | – |
| `messaging.log.read` | Gönderim logları | 🟡 | ✓ |

### 11. `system` — Çapraz / Yönetim
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `user.create` | Personel hesabı aç | 🟡 | ✓ |
| `user.edit` | Personel düzenle | 🟡 | ✓ |
| `user.deactivate` | Personeli pasife al | 🟡 | ✓ |
| `role.manage` | **Capability paketlerini düzenle** (meta yetki) | 🔴 | – |
| `capability.grant` | Kişiye tekil yetki ver/al | 🔴 | – |
| `audit.read` | Audit log oku | 🟡 | ✓ |
| `settings.platform.manage` | Platform ayarları | 🔴 | – |
| `import.run` | Legacy/veri içe aktarım | 🔴 | – |

### Kabaca Sayılar
~75 atomik capability · 11 domain · 4 scope · 3 hassasiyet seviyesi. Bundan **sınırsız rol** türetilir:
- Eğitmen ≈ 12 capability `@assigned`
- Operasyon ≈ 40 capability `@org`
- Satış ≈ `enrollment` + `person` + (sonra `sale`) paketi
- Admin ≈ tümü `@org`

## 3.4 AI-Ready Foundations

> Hedef: ileride AI-destekli, **kimsede olmayan** bir yapı. Farkı yaratan AI modeli değil,
> **her eylemin AI tarafından adreslenebilir olması.** Bunu bugün ucuza kurulan bir omurga sağlar.
> AI bugün yazılmaz; sadece kemikleri AI-hazır yapılır.

### Omurga: Action (Komut) Katmanı
Her mutasyon tek bir isimli, doğrulanan, capability-korumalı sunucu fonksiyonundan geçer:

```
İnsan UI ─┐
          ├─► executeAction("assignment.cancel", { taskId }, actor)
AI ajanı ─┘        → can(actor, capability, scope)?
                   → validate(args)
                   → write
                   → emitEvent(actor, capability, entity, before/after)
```

İnsan da AI de **aynı kapıdan** geçer: aynı yetki kontrolü, aynı doğrulama, aynı audit.
AI eklendiğinde yeni iş mantığı yazılmaz — ajan var olan action'ları çağırır.
**Yan fayda:** dağınık client yazımının yol açtığı veri-kaybı bug sınıfı (bkz. `FLEX_CORE_LOG` §187–188 çekiliş bug'ları) yapısal olarak biter. Yani AI-hazırlık ile kod kalitesi aynı yatırımdır.

### Bugün ucuza kurulacak 6 temel
| # | Karar | Bugün | AI'da getirisi |
|---|-------|-------|----------------|
| 1 | **Capability registry** (bu bölüm) | Düşük | AI tool yüzeyi + güvenlik bayrakları hazır |
| 2 | **Action katmanı** — yazımlar tek kapıdan | Orta (kademeli) | AI insanla aynı yolu kullanır |
| 3 | **Event/Audit stream** — her action yapısal olay üretir (actor, capability, entity, öncesi/sonrası, zaman) | Düşük | AI'nın hafızası + bağlamı; KVKK audit |
| 4 | **Actor tipi** — `human \| system \| ai` | Çok düşük | AI birinci sınıf aktör, kendi grant'i + audit'i |
| 5 | **Türkçe capability açıklamaları** | Sıfır (yazıldı) | "Şu öğrenciye sertifika bastır" → `certificate.issue` grounding'i |
| 6 | **Temiz/denormalize read model** — Person-merkezli donmuş gerçekler | Karar verildi | AI temiz fact'ler üzerinden doğru muhakeme (RAG zemini) |

3 ve 4'ü sonradan eklemek acı, bugün eklemek bir alan + bir helper.

### Güvenlik declarative gelir
AI'nın neye dokunabileceği registry metadata'sından türetilir:
- **🔴 kritik + `write`** → AI **kendi başına yapamaz**: sadece taslak hazırlar, insan onayı şart (`sms.bulk_send`, `certificate.issue`, `enrollment.complete`, `group.delete`)
- **`read` capability'leri** → AI scope'a göre sorgular ("550'nin devamsızlık raporunu çıkar")
- **🟢/🟡 + `write`** → onaylı/loglu otomasyon ("yeni ödev maili gönder")
- **`audited: true`** olan her AI eylemi audit log'a `actor.type = ai` olarak düşer

### Tangible senaryolar (hepsi omurgayla çalışır)
- *"550'nin durumunu özetle"* → read capability + event stream
- *"Devamsızlığı artan öğrencileri bul, velilerine SMS taslağı hazırla"* → read + `sms.send` (🔴 taslak → insan onayı)
- *"Bu öğrenci sertifikayı hak etti mi?"* → `certificate.eligibility.read`
- **Proaktif:** AI örüntü fark eder → personele `task.create` açar (actor: ai)
- *"Grafik-2 grubunu aktif yap"* → `group.activate`

### Şimdi YAPMA
- AI modeli, chatbot, embedding, RAG — erken, pahalı, değişken.
- "AI" diye ayrı modül. AI ayrı bir şey değil; **omurganın bir tüketicisi.**

Sadece omurgayı (action + event + actor + capability) disiplinle kur; gerisi geldiğinde kendiliğinden oturur.

## 3.5 Core / Vertical Pack Katmanlaması

> Hedef: model ileride eğitim dışı sektörlere de uyarlanabilsin. Kural: **soyutlamayı inşa etme, sınırı çiz.**
> Bugün eğitimi mükemmel yap; dikişleri doğru yere koy ki başka sektöre geçiş bir refactor olsun, rewrite değil.

```
core/                    ← sektör-bağımsız (değişmez)
  person · engagement · org-unit · task
  notification · messaging · audit · user/role/capability · import
  [executeAction + emitEvent + actor + registry mekanizması]

packs/
  education/             ← eğitime özel (çıkarılabilir/değiştirilebilir)
    attendance · grade · certificate · assignment · league
    + terminoloji + varsayılan rol paketleri
  fitness/   (gelecek)   ← membership · session · checkin · workout
  clinic/    (gelecek)   ← appointment · treatment · prescription
```

**Hangi domain nerede:**

| Core (generic) | Education Pack (özel) |
|----------------|------------------------|
| `person`, `task`, `notification`, `sms/email`, `audit`, `user/role/capability`, `import` | `attendance`, `grade`, `certificate`, `assignment`, `league` |
| `engagement` (generic köprü) | |
| `org-unit` (generic kap; eğitim "group" adını verir) | |

**3 mekanizma (yarı-hazır):**
1. **Registry açık/genişletilebilir.** Core kendi capability'lerini kayıtlar; pack *ek* domain+capability register eder. Registry veri, hardcode değil. Yeni sektör = yeni tanım + handler + ekran; core'a dokunmadan.
2. **Generic varlık + tipli uzantı.** `person` generic; "kişinin bağlı olduğu şey" generic `engagement` — `type` ve payload sektöre göre değişir (Eğitim: enrollment→group · Klinik: appointment→treatment · Spor: membership→class). **Donmuş-sonuç deseni generalleşir:** "engagement outcome snapshot" (eğitimde not/sertifika, sürücü kursunda sınav sonucu).
3. **Terminoloji sözlüğü.** Aynı `person` → "Öğrenci/Hasta/Üye/Müvekkil". Vertical config domain→etiket eşler. Çok ucuz, aynı kodu N sektöre koşturur.

**Bugün yapılacak (disiplin, ucuz):** Core'a eğitim kelimesi sokma (`person` içinde "öğrenci/branş/modül" geçmesin); eğitime özel domain'leri ayrı katmanda tut; registry'yi veri-driven tut; plugin altyapısı **kurma**, sadece katman sınırını koru.

**Strateji:** En kolay ilk genişleme eğitim-komşusu sektörler (sürücü/müzik/dil kursu, spor/PT) — `attendance + certificate + grade` pack'ini neredeyse aynen kullanır.

## 3.6 Ticari / Multi-Tenant Mimari

> Hedef: FlexOS satılabilir bir SaaS. Bu, **tek yeni yapısal eksen** ekler: `tenant` (müşteri kurum).
> `actor.type` ve `audit` ile aynı kategoride — **bugün bir alan, sonra retrofit cehennemi.**

**Tenant ekseni:** Her entity, her capability grant, her action, her event bir `tenantId` taşır. Onsuz asla sorgu atılmaz; security rules tenant izolasyonunu zorunlu kılar.

**İki katmanlı yetki** (capability işini aynen tekrar kullanır):
```
Tenant Entitlement   →  müşteri NE satın aldı (Education pack + AI add-on)
        ×                → bu tenant şu capability'leri KULLANABİLİR
User Grant           →  tenant içinde kullanıcıya NE atandı
        ×
Scope                →  self / assigned / branch / org

Etkin yetki = Entitlement ∩ Grant ∩ Scope
```

- **Entitlement** = lisans/paket (satıcı belirler): "Bu tenant Education pack aldı, AI add-on almadı."
- **Grant** = tenant kendi içinde dağıtır (müşteri yönetir): `role.manage` + `capability.grant` müşteriye açık ürün özelliği olur.
- **AI** = bir entitlement bayrağı — paralı katman, tenant bazında aç/kapa.

**Zamanlama — kaçırma:** `tenantId`, öğrenci/grup veri modeli **sıfırdan yazılırken** basılacak (Person≠Enrollment ile aynı tur). Boş sistemde bedava, dolu sistemde korkunç.

**Tuzak (en büyüğü):** Çok-tenant SaaS'ı mutlu kullanan ilk müşteri olmadan kurmak ölümcül.
> **Tenant-zero = kendi kurumun.** Onun için inşa et, ama tenant izolasyonuyla — böylece **müşteri #2 bir config olur, fork değil.** Billing/provisioning/self-serve → müşteri #2 kapıdayken.

---

# 4. MVP Çekirdek Akış (Blueprint)

> Hedef: temel akışı uçtan uca çalıştırmak. Satış kayıt açar → öğrenci oluşur →
> grup oluşturulur/atanır → eğitmen kendi öğrencilerini görür → not girer → operasyon takip eder.
> AI ve ileri otomasyon **kapsam dışı**; sadece mimari dikişler (tenantId, Person≠Enrollment, donmuş sonuç) bırakılır.

## 4.1 Kapsam — bu 4 domain
`person` (öğrenci) · `group` (grup) · `enrollment` (öğrenci–grup ilişkisi) · `grade` (not).
Attendance, certificate, assignment, sale **bu turda değil** (akış için gerekmiyor).

**En kritik kural:** Person grup/not taşımaz. Grup ve not ilişkisi `enrollment`'ta yaşar.
Bu, hem "eğitmen sadece kendi öğrencilerini görür"ü hem "aynı kişi farklı yıllarda geri döner"i çözer.

## 4.2 Veri Modeli (hedef Firestore şema)

> Tüm dokümanlar `tenantId` taşır (multi-tenant dikişi — boşken bedava, sonra korkunç).
> Bugünkü `students`/`groups` koleksiyonlarının yeniden-yazımıdır; eski alanlar migrasyonla taşınır.

### `persons/{personId}` — Öğrenci/Kişi (merkez, kalıcı)
```
tenantId
firstName, lastName
pii: { tcNo?, phone?, email? }
status: "prospect" | "active" | "passive"
consentKVKK: boolean
authUid?                  // öğrenci portalı için (varsa)
createdAt, createdBy
// ⛔ groupId YOK · grade YOK — bunlar enrollment'ta
```

### `groups/{groupId}` — Grup (süreç kabı; generic "org-unit"un eğitim adı)
```
tenantId
code                      // "550"
branch                    // "grafik"
module                    // "GRAFIK_1"
status: "planned" | "enrolling" | "active" | "postponed" | "completed" | "archived"
trainerId                 // atanmış eğitmen (uid)
schedule: { startDate, days[], sessionHours, endDate? }
createdAt, createdBy
```

### `enrollments/{enrollmentId}` — KÖPRÜ (Person ↔ Group), akışın kalbi
```
tenantId
personId                  // FK → persons
groupId                   // FK → groups (güncel grup)
saleId?                   // FK → sale (sonra; şimdilik opsiyonel)
status: "active" | "frozen" | "completed" | "transferred" | "cancelled"
enrolledAt, enrolledBy
transferHistory: [{ fromGroupId, toGroupId, at, by }]

// ── Donmuş sonuç — modül/mezuniyet bitince yazılır, DEĞİŞMEZ ──
result?: {
  finalGrade, projectGrade, assignmentScore,
  groupCode, module, branch, term,
  finalizedAt
}
```

### `grades/{enrollmentId}` — Canlı not (enrollment'a bağlı, donmadan önce mutable)
```
tenantId
enrollmentId, personId, groupId   // sorgu kolaylığı için denormalize
projectGrade
assignmentScore                   // çekiliş ödev XP'sinden (sonra)
components: { ... }
updatedAt, updatedBy
// grade.finalize → hesaplanır, enrollment.result'a snapshot'lanır, orası kilitlenir
```

**Kaynak-of-truth ayrımı:** Canlı not `grades`'te düzenlenir; **resmi sonuç** `enrollment.result`'ta donar. Ödev ağırlığı sonradan değişse veya grup silinse bile `result` değişmez.

## 4.3 Uçtan Uca Akış → Capability Eşlemesi

| # | Adım | Eylem (capability) | Kim (grant) |
|---|------|--------------------|-------------|
| 1 | Satış öğrenci kaydı oluşturur | `person.create` | Satış **veya** Operasyon* |
| 2 | Öğrenci sistemde oluşur (havuza düşer) | (1'in sonucu) + `person.search` | — |
| 3a | Yeni grup oluşturulur | `group.create`, `group.assign_trainer`, `group.activate` | Operasyon |
| 3b | Öğrenci gruba atanır | `enrollment.create` (groupId set) / `group.assign_student` | Operasyon |
| 4 | Eğitmen kendi öğrencilerini görür | `person.read @assigned` + `enrollment.read @assigned` + `group.read @assigned` | Eğitmen |
| 5 | Eğitmen not girer | `grade.read @assigned`, `grade.write @assigned`, `grade.finalize @assigned` | Eğitmen |
| 6 | Operasyon süreci takip eder | `enrollment.read @org`, `group.read @org`, `grade.report.read @org` | Operasyon |

\* **Modülerliğin kanıtı:** Adım 1'i kim yapar sabit değil — kanonik akışta Satış, sizin kurumda Operasyon. **Aynı `person.create` capability'si, farklı grant.** Kodda `if (role==="satış")` yok; sadece kimin pakette `person.create` olduğu değişir.

## 4.4 "Eğitmen kendi öğrencilerini görür" — kilit mekanizma

```
JWT claim:  { groupIds: ["550", "598"] }      // eğitmenin atanmış grupları

query enrollments
  where tenantId == myTenant
  where groupId in myGroupIds
  where status == "active"
→ personId listesi
→ join persons (read @assigned)
```

Bu yüzden Person'da `groupId` tutmuyoruz: bir kişi birden çok enrollment taşıyabilir, eğitmen yalnızca **kendi grubundaki enrollment** üzerinden o kişiyi görür. Scope `assigned` = `groupIds` claim'i.

## 4.5 Minimum Capability Listesi (sadece bu akış)

| Domain | Capability | Hassas |
|--------|-----------|--------|
| person | `person.create` · `person.read` · `person.read.pii` · `person.edit` · `person.search` | 🟡/🟢 |
| enrollment | `enrollment.create` · `enrollment.read` · `enrollment.transfer` | 🟡 |
| group | `group.create` · `group.read` · `group.edit` · `group.assign_student` · `group.assign_trainer` · `group.activate` | 🟢/🟡 |
| grade | `grade.read` · `grade.write` · `grade.finalize` · `grade.report.read` | 🟢/🔴 |
| system | `role.manage` · `capability.grant` (paketleri kurmak için, admin) | 🔴 |

~18 capability. Attendance/certificate/assignment bu akışta yok.

## 4.6 Modül Sınırları (capability paketleri)

> Paket = isimlendirilmiş capability+scope seti. Departman değil, paket.

- **Satış paketi:** `person.create`, `person.read`, `person.read.pii`, `person.edit`, `person.search`, `enrollment.create` — scope `@org` (veya `@branch`).
- **Operasyon paketi:** `group.*`, `enrollment.*`, `group.assign_trainer`, `group.activate`, tüm read'ler `@org`, `grade.report.read @org`.
- **Eğitmen paketi:** `person.read @assigned`, `enrollment.read @assigned`, `group.read @assigned`, `grade.read/write @assigned`, `grade.finalize @assigned`.
- **Admin paketi:** Tümü `@org` + `role.manage`, `capability.grant`.

> Açık karar: `grade.finalize` (not donar) eğitmende mi operasyonda mı? MVP'de **eğitmen @assigned** (bugünkü "Modülü Bitir" davranışı). İleride operasyona alınabilir — sadece grant değişir.

## 4.7 Bugün bırakılan dikişler (AI/gelecek için ucuz)

1. **`tenantId` her dokümanda** + her sorguda + security rules zorunlu.
2. **Mutasyonlar service fonksiyonlarında**, bileşen içine saçılmaz (çekiliş bug sınıfının kökü buydu — `FLEX_CORE_LOG` §187-188). İleride bunlar `executeAction` olur.
3. **`enrollment.result` donmuş snapshot** deseni baştan şemada.
4. **`can(capability, scope)` helper'ı** — başta basit rol→paket eşlemesiyle dolu olsa bile, çağrı noktaları registry'ye hazır.

> Bu dördü dışında AI/otomasyon/multi-vertical mekanizması **kurulmaz**. Sadece çekirdek akış koşar.

---

# 5. Süreç Sorumlulukları, Öğrenci Kartı ve Güvenlik

## 5.1 Modüller Arası Sorumluluk Dağılımı

### Eğitim Operasyonu — İşin Beyni
- Branş, eğitim, grup tanımlar
- Grup tarihlerini ve takvimini belirler
- Eğitmen ataması yapar
- Grubu "Aktif" statüsüne alır → eğitmene yoklama açılır
- Öğrenci taleplerini ve şikayetleri yönetir
- Sertifika süreçlerini yönetir; sertifika basılınca SMS + e-posta otomatik gönderilir

### Satış
- Açılacak grupları ve ürün kataloğunu görür
- Ürün / paket satışı yapar
- Öğrenciyi sisteme kaydeder → havuza düşer
- Havuzdan ilgili gruba yerleştirir

### Eğitmen — Sadece Eğitim
- Grup oluşturamaz, düzenleyemez · öğrenci satışı yapamaz
- Sadece: ders verir, yoklama alır, proje notu girer, eğitmen notu ekler
- Atanmış grupları görür, öğrenciler zaten yerleştirilmiş gelir

## 5.2 Sertifika Verme Akışı (Eğitim Operasyonu)

Hedef: kurumu rahatlatan, uçtan uca otomatik akış. Eğitmen yalnızca notu besler; gerisini sistem + Eğitim Op tek ekrandan yürütür.

```
1. Eğitmen notu verir
        ↓
2. Sistem sertifika notunu hesaplar (proje + ödev ağırlıkları)
   → nota göre hak edilen sertifika türü belirlenir: Başarı | Katılım
        ↓
3. Eğitim Op ekranı — sınıfın "Sertifika Not" listesi
   Her öğrenci satırında: not + hak kazandığı sertifika türü + [Sertifika Bastır]
        ↓
4. [Sertifika Bastır] → otomatik yazıcıdan basılır
   + aynı anda öğrenciye mail/SMS: "Sertifikanız hazır, gelip alabilirsiniz."
        ↓
5. İl dışı / gelemiyorsa → dijital PDF kopyası öğrenciye gönderilir
        ↓
6. enrollment.certificate.durum = verildi + kod + verilisTarihi (kalıcı)
```

- **Sertifika türü karara bağlı:** Eğitim tanımındaki koşullar (min devam %, min not) öğrencinin notuyla kıyaslanır → Başarı mı Katılım mı otomatik belirlenir. Eğitim Op onaylar, sistem türü önerir.
- **Kanal:** Fiziksel basım (yazıcı) **varsayılan**; PDF **opsiyonel/uzaktan** alternatif. İkisi de aynı butondan tetiklenir, durum `verildi`ye döner.
- **Otomatik bildirim:** Basım anında mail + SMS tetiklenir (mevcut `send-*` + bildirim altyapısı pattern'i).

> Tümü Eğitim Operasyonu modülünde, sıfırdan inşada gelecek. Eğitmen tarafında **hiçbir sertifika butonu olmayacak** — sadece not girişi.

## 5.3 Rol + Yetki Modeli (geçiş / bugünkü)

> Hedef model §3'te (capability + scope). Aşağısı bugünkü/geçiş yaklaşımı.

Sadece role kontrolü yetmez. Role + Permission modeli kullanılır.

```
user {
  role: "trainer"
  permissions: ["attendance.read", "attendance.write", "students.read"]
}
```

Middleware ikisini birden kontrol eder: `hasRole("trainer") && hasPermission("attendance.write")`.

**Neden:** İleride şu varyasyonlar çıkacak — Admin · Şube Müdürü · Kıdemli Eğitmen · Eğitmen · Stajyer Eğitmen · Satış+Eğitmen (çift yetki). Bir elemana ek yetki tıkla verilip alınabilmelidir (örn. eğitmene `sales` permission → satış modülü açılır).

### Route Koruması (Middleware)
```
/trainer/*    → role: trainer | admin
/operation/*  → role: operation | admin
/sales/*      → role: sales | admin | permission: sales
/finance/*    → role: finance | admin | permission: finance
```

## 5.4 Öğrenci Kartı

Sistemin merkezidir. **Tek kart** vardır, role göre görünen sekmeler değişir.

| Sekme | Eğitmen | Operasyon | Satış | Muhasebe |
|-------|---------|-----------|-------|----------|
| Eğitim Durumu | ✓ (default) | ✓ | | |
| Lig | ✓ | | | |
| Eğitimler / Gruplar | | ✓ | ✓ | |
| Sertifikalar | ✓ | ✓ | | |
| Eğitmen Notları | ✓ | | | |
| Ödemeler / Sözleşme | | | | ✓ |

- **Eğitmen Notları:** Varsayılan blur. Butona basınca görünür (öğrenci yanında ekran açılabilir).
- **shared altındadır.** Her modülden açılabilir, Ctrl+K ile erişilebilir.

### Ctrl+K — Global Arama
Tüm modüllerin merkezi erişim noktası: `Ctrl+K → "Ege" yaz → Öğrenci Kartı açılır`. Role göre filtrelenir (eğitmen sadece kendi öğrencilerini görür). Shared altında.

## 5.5 Oyunlaştırma (Lig Sistemi)
Kaldırılmayacak. Korunacak. **Opsiyonel.** Eğitmen sınıf ligini açarsa anlam kazanır; öğrenci kartında ayrı "Lig" sekmesi. Default sekme "Eğitim Durumu".

## 5.6 Güvenlik

### Firestore Rules — Katman Katman
```
Trainer    → sadece kendi atanmış groupId'lerine ait dökümanlar
Operation  → tüm gruplar, enrollment'lar
Sales      → products, groups (read) | persons, sales (write)
Finance    → payment dökümanları, contracts
```

### PII & KVKK
- Öğrenci adı, telefon, e-posta hassas veridir; KVKK rızası kayıt altına alınır
- Veri erişim logu tutulur
- **"Öğrenci silinmez"** — silme talebi gelirse kişisel veri anonimleştirilir, eğitim geçmişi korunur

### Audit Log
Her kritik işlem izlenebilir: `Kim → Ne yaptı → Hangi kayıtta → Ne zaman`.
Not girme, sertifika basma, ödeme kaydı, öğrenci transferi, grup statü değişikliği — hepsi loglanır.

### JWT Claims
```
{ role: "trainer", permissions: ["sales"], groupIds: ["550", "598"] }
```
API route'lar claim'e göre izin verir. Client-side kontrole güvenilmez.

### Deployment Stratejisi
Tek root, tek Next.js uygulaması; modüller route bazlı ayrılır.
- `main` → `flex.vercel.app` — stable, eğitmen kullanır
- `dev` → `flex-dev.vercel.app` — geliştirme, ayrı Firebase projesi

---

# 6. Yol Haritası ve İnşa Sırası

## 6.1 İnşa Sırası (veri modeli yeniden-inşa)

1. **Core tiplerini kilitle** (Person, Enrollment, Group, Module) + FlexOS tipleri (Education, Sale, Branş, Şube) — **+ `tenantId` aynı turda.**
2. **Backfill:** mevcut `students` → Person + Enrollment (groupId'den) + `group_history`'den geçmiş enrollment'lar. **Hiçbir şey silinmez.**
3. **İlk dikey dilim:** bireysel satış → gruba ekleme → eğitmene atama (1. etap).
4. Yazım + liste + yoklama + grading sorgularını enrollment-aware repoint.
5. `student.groupId` bağımlılığını kaldır.
6. EduOps (eğitim/grup tanımı) → Satış → Kurumsal → Finans/rapor.

> **Sıra notu:** Ayrılabilirlik kısıtı yüzünden eğitmen tarafının Core'a taşınması, sales'ten ÖNCE — Core'un standalone yettiğini kanıtlamak için.

## 6.2 Capability/Action Omurgası — Sonraki Adımlar

1. `Capability`, `Scope`, `Sensitivity`, `Actor` (+ `tenantId`) TypeScript tipleri + sabit capability listesi (registry iskeleti).
2. `executeAction()` çekirdeği + `emitEvent()` audit helper'ı (önce 1-2 domain'de pilot) — tenantId + actor baştan dahil.
3. Veri modeli yeniden yazımı: Person≠Enrollment **+ tenantId** aynı turda.
4. Core / Education-pack katman sınırının kodda kurulması (eğitim domain'leri ayrı).
5. İki katmanlı yetki: entitlement (tenant) × grant (user) × scope.
6. Rol paketlerinin tanımı (Eğitmen / Operasyon / Satış / Admin → capability+scope setleri).
7. Mevcut hardcoded kontrollerin (`PERMISSIONS.MANAGEMENT_PANEL`, `role === instructor`) registry'ye taşınması.

## 6.3 MVP — Yarın İlk Adım

1. `persons` / `groups` / `enrollments` / `grades` koleksiyon şemalarını + `tenantId`'yi sabitle.
2. `can(capability, scope)` helper'ı + 4 paketi (Satış/Operasyon/Eğitmen/Admin) tanımla.
3. Akışın 1→6 adımını en kısa yoldan uçtan uca koştur (UI minimal, mantık service'te).
4. Çalışınca → Eğitim Operasyonu modülüne geç.

## 6.4 Modül Geliştirme Sırası (büyük resim)

1. **Eğitmen Paneli** — neredeyse tamamlandı (not girme, StudentDetailModal, yönetim paneli, profil ayarları)
2. **Eğitim Operasyonu** — sıradaki büyük modül (rol+permission genişletme, grup yaşam döngüsü, eğitmen atama, grup başlatma → yoklama aktivasyonu)
3. **Satış** — sonraki modül
4. **Finance** — sonraki modül
5. **Öğrenci Portalı** — en sona (Eğitim Operasyonu olmadan eksik kalır)

## 6.5 Kapsam Dışı (1. etap) — alanlar şemada hazır, mantık sonra

Payment/taksit, kurumsal Account, paket çoklu-enrollment, kota takibi, gelir raporlama, sertifika üretimi. Hepsinin alanı şemada baştan var ("temeli sağlam at"), mantığı sonraki etaplarda dolar.
