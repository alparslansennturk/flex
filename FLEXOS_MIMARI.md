# Flex Eğitim İşletim Sistemi — Veri Modeli Mimarisi

> **Durum:** Tasarım/tartışma kilitlendi (2026-06-09). Kod yazılmadı.
> Yol haritası sunumdan sonra çizilecek.
>
> İlgili: `ARCHITECTURE.md`, `FLEX_CORE_LOG.md`. Bu doküman FlexOS yeniden-inşa veri modelini tanımlar.

---

## 1. Kök Felsefe

**Person (insan) ≠ Enrollment (gruptaki katılım).** Sınıfa özel her şey (devam, not, ödev, sertifika) Enrollment'ta tutulur. Aynı insan birden çok gruba (eş zamanlı dahil) katılabilir → 1 Person + N Enrollment. Mevcut sistemde `students` aslında bir üyelik kaydı; bu yüzden "aynı insan için çok doküman", "aynı mail", "eş zamanlı grup" sorunları çıkıyor. Çözüm: kişiyi üyelikten ayır.

**"Eğitime göre öğrenci, kuruma göre müşteri"** — bu bir tip değil, bakış açısı. Aynı kişi satış için müşteri, eğitmen için öğrenci.

---

## 2. Ayrılabilirlik Kısıtı (en kritik mimari kural)

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

---

## 3. Hiyerarşi

```
ŞUBE (lokasyon: Kadıköy/Şirinevler/Pendik — satış ekibi buraya bağlı)
BRANŞ (disiplin: Grafik Tasarım, Yazılım)
   └─ EĞİTİM (ürün, satılır: Grafik-1, Grafik-2, Python, "Tasarım Full"=paket)
        └─ MODÜL (Temel Photoshop, Temel Illustrator, Corel Draw)
             └─ GRUP / SINIF (eğitmen, takvim, kontenjan, type)
```

- **Şube ≠ Branş.** Şube = fiziksel lokasyon + satış ekibi. Branş = disiplin. Gelir raporu ikisini de ister → Sale her ikisini taşır (şube doğrudan, branş eğitim üzerinden).
- **Eğitim = satılan ürün.** Grafik-1 ve Grafik-2 ayrı satılabilen eğitimler. Paket = bundle-tipi eğitim (içinde N eğitim, tek total fiyat).
- **Grup = eğitimin somut sınıfı.** Bir eğitimi baştan sona işler (81 saat, tüm modülleri sırayla, tek sınıf).

### Ortak modül (cross-education)
Bir modül farklı eğitimlerin öğrencilerine **ortak sınıfta** verilebilir. Örnek: AutoCAD/sosyal medya öğrencisi "Temel Photoshop"u mevcut Grafik-1 grubunun Photoshop haftalarına katılarak alır (ayrı sınıf açılmaz). Modül bitince mezun edilir, yoklaması kilitlenir.

---

## 4. Varlıklar ve Alanlar

### Person (Core)
`id, kimlik{tip: tc|pasaport|yabancı, no}, ad, soyad, telefon, email, cinsiyet, adres`
- **Kimlik = benzersiz anahtar.** Herkesin bir belgesi var (TC yoksa pasaport/yabancı kimlik).
- Sert benzersiz kısıt yerine: ekleme sırasında email/tel/kimlik ile **yumuşak eşleştirme** → "bu kişi zaten var olabilir, mevcut olanı mı kullanıyorsun?" insan onayı. Mail = yardımcı sinyal, sert kilit değil.
- **Grup/eğitim verisi YOK** (o Enrollment'ta).

### Enrollment (Core) — kişinin bir GRUPTAKİ katılımı
`id, personId, educationId, groupId?, moduleScope?, başlangıçTarihi, bitişTarihi?, durum, saleId?`
- `groupId?` boş = grupsuz havuzda bekliyor (eğitim op yerleştirecek).
- `moduleScope?` boş = grubun eğitiminin tüm modülleri; dolu = sadece o modül(ler) (Ahmet: "Temel Photoshop").
- `durum`: aktif | mezun | tekrar | bıraktı.
- `saleId?` Core'da opsiyonel (standalone Classroom'da boş; FlexOS'ta zorunlu).
- **Yoklama / not / ödev:** grup seviyesinde tutulur (mevcut sistem: `design_attendance` grup bazlı, `gradedTasks` classId bazlı — DEĞİŞMİYOR).
- **Sertifika sonucu:** `certificate{durum: bekliyor|hak_kazandı|kalamadı, finalNot, sertifikaKodu, verilişTarihi}`. moduleScope'a bağlı. Bir kez kazanılınca **kalıcı** (öğrenci başka gruba geçse de durur).

### Group / Sınıf (Core)
`id, educationId, instructorId, takvim, kontenjan, type, şubeId, durum`
- `type`: standart | özel_ders | kurumsal (teslim formatı).
- `instructorId`: gruba atanan eğitmen. Öğrenci gruba girince bu eğitmenin altına düşer.

### Module (Core)
`id, educationId, ad, sıra, saat`

### Education / Eğitim (FlexOS) — satılan ürün
`id, ad, branşId, listeFiyatı, kdv, satışaAçık, modules[], sertifikaTanımı`
- `listeFiyatı`: ürün fiyatı (+KDV otomatik). Değişince satış ekranı görür.
- `sertifikaTanımı`: hangi sertifika (Katılım/Başarı/MEB) + koşullar (min devam %, min not, MEB belge bilgisi). **Şu an yanlış yerde** (`users/{instructorId}.certSettings`) → buraya taşınacak.
- Paket = bundle-tipi Education (içinde N education referansı, tek total fiyat).

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

---

## 5. Akışlar

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

---

## 6. Non-Functional Kriterler ("1 sene sonra da çalışsın")

1. **Veri şişmesi:** Person dokümanı küçük; yoklama/not/ödev Enrollment'ın alt-koleksiyonlarında ayrı dokümanlar. Doküman-içi sınırsız array/map YOK (mevcut `gradedTasks` map'i bu hatanın örneği). "Tek alanda gör" = okuma-zamanı birleştirme, tek dev doküman değil.
2. **Firestore ölçek/maliyet:** Bu ölçekte (yüzler–binler öğrenci, yıllar) yeterli. Sınır boyut değil okuma-sayısı. Full-collection `onSnapshot` YOK → `where`+`limit`+sayfalama. Raporlamada aggregation sorgusu veya aylık rollup dokümanı (şube+branş+ay → toplam). İndeks: şube, branş, tarih.
3. **Security:** Veriyi concern'e göre ayrı koleksiyonlara böl (satış/ödeme/eğitim). Rules modelle BİRLİKTE tasarlanır. Person/Enrollment ayrımı güvenliği kolaylaştırır (öğrenci kendi enrollment'ı, eğitmen kendi grubunun enrollment'ları, finans ödeme).

---

## 7. İnşa Sırası

1. **Core tiplerini kilitle** (Person, Enrollment, Group, Module) + FlexOS tipleri (Education, Sale, Branş, Şube).
2. **Backfill:** mevcut `students` → Person + Enrollment (groupId'den) + `group_history`'den geçmiş enrollment'lar. **Hiçbir şey silinmez.**
3. **İlk dikey dilim:** bireysel satış → gruba ekleme → eğitmene atama (1. etap).
4. Yazım + liste + yoklama + grading sorgularını enrollment-aware repoint.
5. `student.groupId` bağımlılığını kaldır.
6. EduOps (eğitim/grup tanımı) → Satış → Kurumsal → Finans/rapor.

> **Sıra notu:** Ayrılabilirlik kısıtı yüzünden eğitmen tarafının Core'a taşınması, sales'ten ÖNCE — Core'un standalone yettiğini kanıtlamak için.

---

## 8. Kapsam Dışı (1. etap) — alanlar şemada hazır, mantık sonra

Payment/taksit, kurumsal Account, paket çoklu-enrollment, kota takibi, gelir raporlama, sertifika üretimi. Hepsinin alanı şemada baştan var ("temeli sağlam at"), mantığı sonraki etaplarda dolar.
