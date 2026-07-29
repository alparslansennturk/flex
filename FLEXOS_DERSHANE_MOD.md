# FlexOS — Dershane / LGS-Üniversite Hazırlık Modu (Plan)

> Bu dosya SADECE bu konuya özel. Genel ilerleme için `FLEXOS.md`,
> teknik borç için `FLEXOS_TEKNIK_BORC.md` — orada sadece bu dosyaya
> tek satır pointer var, detay burada.
>
> Durum (2026-07-29): **Sadece plan/karar aşaması. Hiçbir kod yazılmadı.**

## Ne değil, ne

**FlexOS bir dijital eğitim platformu DEĞİL.** Doping Hafıza, online kurs
siteleri, video-ders platformları gibi öğrenciye doğrudan dijital içerik/
müfredat sunan bir ürün değil — ve dershane modu da bunu değiştirmiyor.

FlexOS, **yüz yüze eğitim veren kurumların** operasyon/yönetim sistemidir
(LMS — Learning Management System, içerik değil YÖNETİM anlamında):
yoklama, kayıt/satış, ödev takibi, sertifikasyon. Öğrenci fiziksel olarak
derse geliyor; sistem kurumun bu süreci yönetmesini sağlıyor.

**Sınav ve Ölçme-Değerlendirme modülleri de aynı çerçevede düşünülecek:**
kurumun kendi öğrencilerine kendi sınıfında/şubesinde uyguladığı sınavların
(deneme sınavı, konu testi vb.) sonuçlarının kaydı/takibi/analizi — üçüncü
parti bir dijital soru bankası/online sınav ürünü DEĞİL, kurumun kendi
yüz yüze sınav pratiğinin dijital yönetim katmanı.

## Ticari motivasyon

Kullanıcının kararı (2026-07-29): FlexOS'u sadece bilişim kursu değil,
LGS hazırlık / üniversite hazırlık dershaneleri pazarına da açmak. Bu
segmentte bilişim kursu için ürün az ama LGS/üni hazırlık için kurum çok
fazla — pazar büyüklüğü açısından avantajlı görüldü.

## Yaklaşım

Ayrı bir ürün/kod tabanı DEĞİL — mevcut Görünüm Anahtarı / capability
tabanlı mod deseninin ([[flexos_view_toggle_real_capability_2026_07_02]]
memory kaydı, `FLEXOS.md` §Capability) devamı olarak **yeni bir mod**.
Alttaki domain model (Branş→Eğitim→Modül→Grup, Ödev, Yoklama,
Sertifikasyon) korunuyor, mod'a göre terminoloji/etiket değişiyor:

- Eğitmen → Öğretmen
- Grup → Sınıf
- (kesinleşmedi — kullanıcı UI tasarımı ilerledikçe başka relabel'lar da
  çıkabilir)

## Eksik / yeni olan gerçek iş

Sınav modülü + Ölçme-Değerlendirme modülü — bunlar mevcut Ödev sisteminin
bir varyantı OLMAYABİLİR, muhtemelen ayrı domain kavramları gerekecek:
- Soru Bankası (kurumun kendi soru havuzu)
- Deneme Sınavı / Konu Testi (kurumun uyguladığı sınav — sonuç girişi)
- Net/Analiz Engine (doğru-yanlış-boş → net hesaplama, branş bazlı
  performans, öğrenci karnesi/veli bilgilendirme ihtimali)

Bunların hiçbiri henüz tasarlanmadı — sadece varlığı biliniyor.

## Sıra

1. **Kullanıcı** Sınav ve Ölçme-Değerlendirme modüllerinin UI'ını kendisi
   tasarlayacak (Claude Design veya benzeri).
2. UI paylaşılınca gerçek domain modelleme konuşması yapılacak — özellikle
   "Deneme Sınavı ayrı bir entity mi, yoksa Ödev'in bir türü mü?" kararı.
3. Kullanıcı "koda dök" dedikten sonra implementasyon başlayacak.

**Şu an hiçbir kod aksiyonu yok — sadece bu plan.**
