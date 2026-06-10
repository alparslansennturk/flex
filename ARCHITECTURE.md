# Flex Platform — Mimari Dokümantasyon

> Bu dosya teknik kararların ve genel mimarinin referans notudur.
> Yeni bir modüle veya geliştirmeye başlarken buraya bakılmalı.
> Son güncelleme: Haziran 2026

---

## Temel Felsefe

Flex, bir eğitim kurumunun tüm işlemlerini yapacağı bir işletim sistemidir.

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

---

## Mevcut Durum

Eğitim Operasyonu ve Satış modülleri henüz geliştirilmediği için grup yönetimi **geçici olarak** eğitmen tarafında yapılmaktadır.

Eğitmen şu an:
- Grup oluşturuyor
- Öğrenci ekliyor
- Yoklama alıyor
- Proje notu giriyor

Bu yapı geçicidir. Uzun vadede eğitmen grup yönetemez. Bu sorumluluk Eğitim Operasyonu'na geçecektir.

---

## Modüller

```
flex/
├── trainer/       ← Eğitmen Paneli (mevcut, neredeyse tamamlandı)
├── operation/     ← Eğitim Operasyonu (sıradaki büyük modül)
├── sales/         ← Satış
├── finance/       ← Muhasebe
└── shared/        ← Ortak sistemler (öğrenci, bildirim, sertifika, arama)
```

### Trainer (Eğitmen Paneli)
```
trainer/
├── dashboard        ← Ana sayfa, aktivite feed
├── attendance       ← Yoklama
├── projects         ← Ödev / Proje yönetimi
├── students         ← Öğrenci listesi (geçici — ileride operation'a geçer)
├── certificates     ← Sertifika
└── grading          ← Not girme
```

### Operation (Eğitim Operasyonu)
```
operation/
├── groups           ← Grup oluşturma, yönetim, durum takibi
├── planning         ← Açılacak sınıf planlaması
├── schedules        ← Takvim, erteleme
├── trainers         ← Eğitmen atama
└── certificates     ← Sertifika süreci yönetimi
```

### Sales (Satış)
```
sales/
├── leads            ← Potansiyel müşteriler
├── sales            ← Satış kayıtları
├── products         ← Ürün / paket kataloğu
└── enrollments      ← Kayıt oluşturma, öğrenci havuzu
```

### Finance (Muhasebe)
```
finance/
├── payments         ← Ödeme takibi
├── contracts        ← Sözleşmeler
└── collections      ← Tahsilatlar
```

### Shared (Ortak Sistemler)
```
shared/
├── students         ← Tek öğrenci sistemi (tüm modüller kullanır)
├── notifications    ← Bildirim altyapısı
├── quick-search     ← Ctrl+K global arama
└── certificates     ← Sertifika altyapısı
```

---

## Önemli Prensip — Veri Tekrarı Yok

Yanlış yaklaşım:
```
trainer/students
operation/students
sales/students     ← aynı veri üç yerde
```

Doğru yaklaşım:
```
shared/students    ← tek kaynak, tüm modüller buraya erişir
```

Rol klasörleri **ekran ve süreç** ayrımı içindir.
Veri yapıları ve ortak sistemler **shared** altındadır.

```
Trainer    = süreç
Operation  = süreç
Sales      = süreç
Finance    = süreç

Students         = ortak veri
Quick Search     = ortak servis
Notifications    = ortak servis
Certificates     = ortak servis
```

---

## Veri Hiyerarşisi

```
Person (Öğrenci)
└── Sale (Satış)
    └── Product (Ürün / Paket)
        └── ProductItem (Paketteki eğitimler)
            └── Enrollment (Eğitim kaydı)
                └── Group (Grup)
                    ├── Attendance (Yoklama)
                    ├── Grades (Not / XP)
                    └── Certificate (Sertifika)
```

### Person (Öğrenci)
Sistemden silinmez. Öğrenci kurumun en değerli verisidir.
- Birden fazla eğitim alabilir
- Birden fazla paket satın alabilir
- Farklı yıllarda geri dönebilir
- Geçmiş eğitimleri, grupları, sertifikaları korunur

### Product (Ürün / Paket Kataloğu)
Satılan şey eğitim değil, ürün veya pakettir.

```
products/
  "Dijital Tasarım Uzmanlığı"   ← paket
  "Grafik Tasarım"              ← tek eğitim

productItems/
  productId: xxx
  educationType: "Grafik Tasarım"
  order: 1
  defaultBranch: "grafik"
```

Tek eğitim satışı da, paket satışı da desteklenir.
Ödeme **ürün seviyesinde** tutulur, devam **eğitim seviyesinde** tutulur.

### Enrollment (Eğitim Kaydı)
Sistemin kritik köprü varlığı. Sale ile Group arasındaki bağ.

```
Enrollment {
  personId
  saleId
  educationId       ← paketteki hangi eğitim
  groupId           ← hangi gruba yerleşti
  status            ← aktif | dondurulmuş | tamamlandı | transfer
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

**Not + Sertifika sonucu Enrollment'ta DONAR.** Eğitmenin girdiği not, sınıf bitince (modül finalize / mezuniyet) nihai nota hesaplanır ve **o anda enrollment'a snapshot'lanır** — sonradan ödev/ağırlık değişse veya grup silinse bile **değişmez**. Sertifika dondurulmuş bir gerçektir, her açılışta yeniden hesaplanmaz.

**Her eğitim ayrı saklanır.** Bir Person birden çok Enrollment taşır; her birinin notu, sertifikası ve sınıf bilgisi (groupCode/module/branch/dönem) **ayrı ayrı** durur. Aynı kişinin Grafik-1 notu ile Grafik-2 notu bağımsızdır.

**Sertifika verilmesi kurumun işidir, eğitmenin değil.** Eğitmen yalnızca notu besler (`certificate.durum = hak_kazandı`). Basım/dağıtım Eğitim Operasyonu'nda ayrı bir adımdır: Eğitim Op, `durum = hak_kazandı && kod yok` enrollment'ları **otomatik listede** görür, sertifikayı basıp `durum = verildi` + `kod` + `verilisTarihi` yazar. (Bkz. Modüller Arası Sorumluluk → Eğitim Operasyonu.)

> Bugünkü sistem notu canlı hesaplayıp `projectGrades`'e yazıyor; donmuş per-enrollment sonuç + sertifika alanları **sıfırdan inşada** (öğrenci/veri tipleri oluşturulurken) eklenecek. 1. etapta sertifika üretilmez ama şema baştan bu alanları taşır.

### Group (Grup)
Gruplar geçicidir. İsimler değiştirilmez, yeni grup oluşturulur.
Öğrenciler eski gruptan seçilerek yeni gruba aktarılır.
Böylece geçmiş yoklamalar, notlar ve sertifikalar korunur.

**Grup yaşam döngüsü:**
```
Planlandı → Kayıt Alıyor → Aktif → Ertelendi → Tamamlandı → Sertifika Sürecinde → Arşiv
```

---

## Sertifika Verme Akışı (Eğitim Operasyonu)

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

**Sertifika türü karara bağlı:** Eğitim tanımındaki koşullar (min devam %, min not) öğrencinin notuyla kıyaslanır → Başarı mı Katılım mı otomatik belirlenir. Eğitim Op onaylar, sistem türü önerir.

**Kanal:** Fiziksel basım (yazıcı) **varsayılan**; PDF **opsiyonel/uzaktan** alternatif. İkisi de aynı butondan tetiklenir, durum `verildi`ye döner.

**Otomatik bildirim:** Basım anında mail + SMS tetiklenir (mevcut `send-*` + bildirim altyapısı pattern'i). Öğrenci "gel al" veya "PDF'ini indir" yönlendirmesi alır.

> Tümü Eğitim Operasyonu modülünde, sıfırdan inşada gelecek. Eğitmen tarafında **hiçbir sertifika butonu olmayacak** — sadece not girişi. Bkz. [Enrollment → certificate], Modüller Arası Sorumluluk → Eğitim Operasyonu.

---

## Rol + Yetki Modeli

Sadece role kontrolü yetmez. Role + Permission modeli kullanılır.

```
user {
  role: "trainer"
  permissions: [
    "attendance.read",
    "attendance.write",
    "students.read"
  ]
}
```

Middleware ikisini birden kontrol eder:
```
hasRole("trainer") && hasPermission("attendance.write")
```

**Neden:** İleride şu varyasyonlar çıkacak:
- Admin
- Şube Müdürü
- Kıdemli Eğitmen
- Eğitmen
- Stajyer Eğitmen
- Satış + Eğitmen (çift yetki)

Bir elemana ek yetki tıkla verilip alınabilmelidir. Örneğin eğitmene `sales` permission'ı eklenirse satış modülüne erişimi açılır.

### Route Koruması (Middleware)
```
/trainer/*    → role: trainer | admin
/operation/*  → role: operation | admin
/sales/*      → role: sales | admin | permission: sales
/finance/*    → role: finance | admin | permission: finance
```

---

## Öğrenci Kartı

Sistemin merkezidir. **Tek kart** vardır, role göre görünen sekmeler değişir.

| Sekme | Eğitmen | Operasyon | Satış | Muhasebe |
|-------|---------|-----------|-------|----------|
| Eğitim Durumu | ✓ (default) | ✓ | | |
| Lig | ✓ | | | |
| Eğitimler / Gruplar | | ✓ | ✓ | |
| Sertifikalar | ✓ | ✓ | | |
| Eğitmen Notları | ✓ | | | |
| Ödemeler / Sözleşme | | | | ✓ |

**Eğitmen Notları:** Varsayılan olarak blur görünür. Öğrenci yanında ekran açılabilir. Butona basınca görünür hale gelir.

**Öğrenci Kartı shared altındadır.** Her modülden açılabilir, Ctrl+K ile erişilebilir.

---

## Ctrl+K — Global Arama

Tüm modüllerin merkezi erişim noktası.

```
Ctrl+K → "Ege" yaz → Öğrenci Kartı Açılır
```

- Tüm modüller aynı arama sistemini kullanır
- Role göre filtrelenir: eğitmen sadece kendi öğrencilerini görür
- Shared altında konumlanır

---

## Modüller Arası Sorumluluk Dağılımı

### Eğitim Operasyonu — İşin Beyni
- Branş, eğitim, grup tanımlar
- Grup tarihlerini ve takvimini belirler
- Eğitmen ataması yapar
- Grubu "Aktif" statüsüne alır → eğitmene yoklama açılır
- Öğrenci taleplerini ve şikayetleri yönetir
- Sertifika süreçlerini yönetir
- Sertifika basılınca SMS + e-posta otomatik gönderilir

### Satış
- Açılacak grupları ve ürün kataloğunu görür
- Ürün / paket satışı yapar
- Öğrenciyi sisteme kaydeder → havuza düşer
- Havuzdan ilgili gruba yerleştirir

### Eğitmen — Sadece Eğitim
- Grup oluşturamaz, düzenleyemez
- Öğrenci satışı yapamaz
- Sadece: ders verir, yoklama alır, proje notu girer, eğitmen notu ekler
- Atanmış grupları görür, öğrenciler zaten yerleştirilmiş gelir

---

## Oyunlaştırma (Lig Sistemi)

Kaldırılmayacak. Korunacak. Opsiyonel olacak.

Eğitmen sınıf ligini açarsa anlam kazanır. Öğrenci kartında ayrı "Lig" sekmesi olarak konumlanır.
Default sekme "Eğitim Durumu"dur.

---

## Güvenlik

### Firestore Rules — Katman Katman
```
Trainer    → sadece kendi atanmış groupId'lerine ait dökümanlar
Operation  → tüm gruplar, enrollment'lar
Sales      → products, groups (read) | persons, sales (write)
Finance    → payment dökümanları, contracts
```

### PII & KVKK
- Öğrenci adı, telefon, e-posta hassas veridir
- KVKK rızası kayıt altına alınmalıdır
- Veri erişim logu tutulmalıdır
- "Öğrenci silinmez" prensibi — silme talebi gelirse kişisel veri anonimleştirilir, eğitim geçmişi korunur

### Audit Log
Her kritik işlem izlenebilir olmalıdır:
```
Kim → Ne yaptı → Hangi kayıtta → Ne zaman
```
Not girme, sertifika basma, ödeme kaydı, öğrenci transferi, grup statü değişikliği — hepsi loglanır.

### JWT Claims
```
{ role: "trainer", permissions: ["sales"], groupIds: ["550", "598"] }
```
API route'lar claim'e göre izin verir. Client-side kontrole güvenilmez.

---

## Deployment Stratejisi

Tek root, tek Next.js uygulaması. Modüller route bazlı ayrılır.

```
main  → production (eğitmen kullanımda)
dev   → aktif geliştirme (yeni modüller)
```

- `main` → `flex.vercel.app` — stable, eğitmen kullanır
- `dev` → `flex-dev.vercel.app` — geliştirme ortamı, ayrı Firebase projesi

Separate repo veya Turborepo gerekmez. Auth, veri ve UI ortaktır. Ekip küçük, overhead gereksiz.

---

## Geliştirme Sırası

1. **Eğitmen Paneli** — neredeyse tamamlandı
   - Not girme düzenleme
   - StudentDetailModal — Genel Durum tab
   - Yönetim paneli boş sayfalar
   - Profil ayarları

2. **Eğitim Operasyonu** — sıradaki büyük modül
   - Rol + permission modelinin genişletilmesi
   - Grup yaşam döngüsü (Planlandı → Arşiv)
   - Eğitmen atama
   - Grup başlatma → yoklama aktivasyonu

3. **Satış** — sonraki modül

4. **Finance** — sonraki modül

5. **Öğrenci Portalı** — en sona (Eğitim Operasyonu olmadan eksik kalır)
