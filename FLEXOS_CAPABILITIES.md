# FlexOS — Domain & Capability Modeli

> Departman-agnostik domain ve atomik yetki (capability) referansı.
> Bu çalışma yetki sisteminin, modüler mimarinin ve AI entegrasyonunun temelidir.
> Yeni bir modül/ekran/eylem eklerken önce buraya bakılır, capability buradan türetilir.
> Son güncelleme: Haziran 2026 · İlgili: `ARCHITECTURE.md`

---

## Tasarım İlkeleri

**1. Capability = bir domain üzerinde atomik eylem.** Departmana değil, işe bağlı.
Kodda asla `if (role === "satış")` yok; her zaman `can("student.create")`.

**2. İsimlendirme:** `domain.action` veya `domain.subdomain.action` — küçük harf, nokta ayraç, fiil sonda.
Örn: `attendance.write`, `certificate.issue`, `person.note.read`.

**3. Scope ayrı bir eksen — capability'yi şişirmez.** Her yetki *grant*'i bir kapsam taşır:

| Scope | Anlamı | Tipik |
|-------|--------|-------|
| `self` | Sadece kendi kaydı | Öğrenci portalı |
| `assigned` | Atanmış grup/öğrenci | Eğitmen |
| `branch` | Şube geneli | Şube müdürü |
| `org` | Tüm kurum | Admin / Operasyon |

`attendance.write @assigned` (eğitmen) ile `attendance.write @org` (operasyon) **aynı capability, farklı scope**.

**4. Rol/Departman = capability+scope paketinin isimlendirilmiş hali.** Veride sabit değil, düzenlenebilir.
"Eğitmen", "Satış", "Kıdemli Eğitmen" hepsi birer paket. Departman→yetki eşleşmesi kuruma göre değişir; bu yüzden sabitlenmez.

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

---

## Domain Haritası

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

---

## 1. `person` — Öğrenci / Kişi

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

## 2. `enrollment` — Eğitim Kaydı (köprü)

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

## 3. `group` — Grup

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

## 4. `attendance` — Yoklama

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `attendance.read` | Yoklama kayıtlarını gör | 🟢 | ✓ |
| `attendance.start` | Dersi başlat | 🟢 | ✓ |
| `attendance.write` | Yoklama al/işaretle | 🟢 | ✓ |
| `attendance.close` | Dersi bitir/kapat | 🟢 | ✓ |
| `attendance.edit_past` | Geçmiş yoklama düzelt (zaman-kilidi aşımı) | 🟡 | ✓ |
| `attendance.report.read` | Yoklama raporları | 🟢 | ✓ |
| `attendance.export` | Rapor dışa aktar | 🟡 | ✓ |

## 5. `grade` — Not

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `grade.read` | Notları gör | 🟢 | ✓ |
| `grade.write` | Proje notu / XP gir | 🟢 | ✓ |
| `grade.settings.edit` | Ağırlıklar, certSettings | 🟡 | ✓ |
| `grade.finalize` | Modülü bitir → **not donar** | 🔴 | ✓ |
| `grade.report.read` | Not raporları | 🟢 | ✓ |

## 6. `assignment` — Ödev (Çekiliş + Teslim)

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

## 7. `certificate` — Sertifika

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

## 8. `task` — Görev (operasyonel iş akışı)

> Öğrenci ödevinden (`assignment`) farklı: personele atanan iç işler —
> "şu öğrenciyi ara", talep/şikayet, grup açma talebi.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `task.create` | Görev oluştur | 🟢 | ✓ |
| `task.read` | Görevleri gör | 🟢 | ✓ |
| `task.assign` | Birine/departmana ata | 🟢 | ✓ |
| `task.update` | Durum/içerik güncelle | 🟢 | ✓ |
| `task.complete` | Tamamla | 🟢 | ✓ |
| `task.delete` | Sil | 🟡 | ✓ |
| `task.comment` | Yorum ekle | 🟢 | ✓ |

## 9. `notification` — Bildirim (uygulama içi)

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `notification.read` | Kendi bildirimlerini gör | 🟢 | `self` |
| `notification.send` | Tekil/grup bildirimi gönder | 🟢 | ✓ |
| `notification.broadcast` | Toplu bildirim | 🟡 | – |
| `notification.template.manage` | Şablon yönetimi | 🟡 | – |

## 10. `sms` / `email` — İletişim Kanalları

> Kanal = maliyet/hukuk taşır. Toplu gönderim ayrı ve kritik.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `sms.send` | Tekil SMS | 🟡 | ✓ |
| `sms.bulk_send` | Toplu SMS (maliyet) | 🔴 | – |
| `email.send` | Tekil e-posta (ödev maili vb.) | 🟢 | ✓ |
| `email.bulk_send` | Toplu e-posta | 🟡 | – |
| `messaging.template.manage` | SMS/e-posta şablonları | 🟡 | – |
| `messaging.log.read` | Gönderim logları | 🟡 | ✓ |

## 11. `system` — Çapraz / Yönetim

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

---

## Kabaca Sayılar

~75 atomik capability · 11 domain · 4 scope · 3 hassasiyet seviyesi.
Bundan **sınırsız rol** türetilir:
- Eğitmen ≈ 12 capability `@assigned`
- Operasyon ≈ 40 capability `@org`
- Satış ≈ `enrollment` + `person` + (sonra `sale`) paketi
- Admin ≈ tümü `@org`

---

## AI-Ready Foundations

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
**Yan fayda:** dağınık client yazımının yol açtığı veri-kaybı bug sınıfı (bkz. FLEX_CORE_LOG §187–188 çekiliş bug'ları) yapısal olarak biter. Yani AI-hazırlık ile kod kalitesi aynı yatırımdır.

### Bugün ucuza kurulacak 6 temel

| # | Karar | Bugün | AI'da getirisi |
|---|-------|-------|----------------|
| 1 | **Capability registry** (bu dosya) | Düşük | AI tool yüzeyi + güvenlik bayrakları hazır |
| 2 | **Action katmanı** — yazımlar tek kapıdan | Orta (kademeli) | AI insanla aynı yolu kullanır |
| 3 | **Event/Audit stream** — her action yapısal olay üretir (actor, capability, entity, öncesi/sonrası, zaman) | Düşük | AI'nın hafızası + bağlamı; KVKK audit |
| 4 | **Actor tipi** — `human \| system \| ai` | Çok düşük | AI birinci sınıf aktör, kendi grant'i + audit'i |
| 5 | **Türkçe capability açıklamaları** | Sıfır (yazıldı) | "Şu öğrenciye sertifika bastır" → `certificate.issue` grounding'i |
| 6 | **Temiz/denormalize read model** — Person-merkezli donmuş gerçekler | Karar verildi | AI temiz fact'ler üzerinden doğru muhakeme (RAG zemini) |

3 ve 4'ü sonradan eklemek acı, bugün eklemek bir alan + bir helper.

### Güvenlik declarative gelir

AI'nın neye dokunabileceği registry metadata'sından türetilir:

- **🔴 kritik + `write`** → AI **kendi başına yapamaz**: sadece taslak hazırlar, insan onayı şart
  (`sms.bulk_send`, `certificate.issue`, `enrollment.complete`, `group.delete`)
- **`read` capability'leri** → AI scope'a göre sorgular ("550'nin devamsızlık raporunu çıkar")
- **🟢/🟡 + `write`** → onaylı/loglu otomasyon ("yeni ödev maili gönder")
- **`audited: true`** olan her AI eylemi audit log'a `actor.type = ai` olarak düşer

### Tangible senaryolar (hepsi omurgayla çalışır)

- *"550'nin durumunu özetle"* → read capability + event stream
- *"Devamsızlığı artan öğrencileri bul, velilerine SMS taslağı hazırla"* → read + `sms.send` (🔴 taslak → insan onayı)
- *"Bu öğrenci sertifikayı hak etti mi?"* → `certificate.eligibility.read`
- **Proaktif:** AI örüntü fark eder → personele `task.create` açar (actor: ai)
- *"Grafik-2 grubunu aktif yap"* → `group.activate`

Hepsinde AI yeni bir şey *yapmıyor*; var olan action'ları çağırıyor.

### Şimdi YAPMA

- AI modeli, chatbot, embedding, RAG — erken, pahalı, değişken.
- "AI" diye ayrı modül. AI ayrı bir şey değil; **omurganın bir tüketicisi.**

Sadece omurgayı (action + event + actor + capability) disiplinle kur; gerisi geldiğinde kendiliğinden oturur.

---

## Core / Vertical Pack Katmanlaması

> Hedef: model ileride eğitim dışı sektörlere de uyarlanabilsin. Kural: **soyutlamayı inşa etme, sınırı çiz.**
> Bugün eğitimi mükemmel yap; dikişleri doğru yere koy ki başka sektöre geçiş bir refactor olsun, rewrite değil.

Domain'ler iki katmana ayrılır:

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
| `engagement` (generic köprü — bkz. aşağı) | |
| `org-unit` (generic kap; eğitim "group" adını verir) | |

**3 mekanizma (yarı-hazır):**

1. **Registry açık/genişletilebilir.** Core kendi capability'lerini kayıtlar; pack *ek* domain+capability register eder. Registry veri, hardcode değil. Yeni sektör = yeni tanım + handler + ekran; core'a dokunmadan.
2. **Generic varlık + tipli uzantı.** `person` generic; "kişinin bağlı olduğu şey" generic `engagement` — `type` ve payload sektöre göre değişir (Eğitim: enrollment→group · Klinik: appointment→treatment · Spor: membership→class). **Donmuş-sonuç deseni generalleşir:** "engagement outcome snapshot" (eğitimde not/sertifika, sürücü kursunda sınav sonucu).
3. **Terminoloji sözlüğü.** Aynı `person` → "Öğrenci/Hasta/Üye/Müvekkil". Vertical config domain→etiket eşler. Çok ucuz, aynı kodu N sektöre koşturur.

**Bugün yapılacak (disiplin, ucuz):** Core'a eğitim kelimesi sokma (`person` içinde "öğrenci/branş/modül" geçmesin); eğitime özel domain'leri ayrı katmanda tut; registry'yi veri-driven tut; plugin altyapısı **kurma**, sadece katman sınırını koru.

**Strateji:** En kolay ilk genişleme eğitim-komşusu sektörler (sürücü/müzik/dil kursu, spor/PT) — `attendance + certificate + grade` pack'ini neredeyse aynen kullanır. Education pack iyi olursa ilk komşu sektörler bedavaya yakın gelir.

---

## Ticari / Multi-Tenant Mimari

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

**Bugün ucuz / sonra pahalı:**

| Bugün (yapısal) | Sonra (müşteri #2 gerçek olunca) |
|---|---|
| Her entity + sorgu + security rules → `tenantId` zorunlu | Tenant provisioning/onboarding |
| `actor` + event → tenantId taşır | Abonelik/faturalama |
| Config = veri (rol, terminoloji, aktif pack) | Self-serve admin UI, custom domain |
| Entitlement kavramını şemada öngör | Pazarlama sitesi |

**Zamanlama — kaçırma:** `tenantId`, öğrenci/grup veri modeli **sıfırdan yazılırken** basılacak (Person≠Enrollment ile aynı tur). Boş sistemde bedava, dolu sistemde korkunç. İki iş ayrılmaz.

**Tuzak (en büyüğü):** Çok-tenant SaaS'ı mutlu kullanan ilk müşteri olmadan kurmak ölümcül.
> **Tenant-zero = kendi kurumun.** Onun için inşa et, ama tenant izolasyonuyla — böylece **müşteri #2 bir config olur, fork değil.** Billing/provisioning/self-serve → müşteri #2 kapıdayken.

---

## Sonraki Adımlar

1. `Capability`, `Scope`, `Sensitivity`, `Actor` (+ `tenantId`) TypeScript tipleri + sabit capability listesi (registry iskeleti).
2. `executeAction()` çekirdeği + `emitEvent()` audit helper'ı (önce 1-2 domain'de pilot) — tenantId + actor baştan dahil.
3. Veri modeli yeniden yazımı: Person≠Enrollment **+ tenantId** aynı turda.
4. Core / Education-pack katman sınırının kodda kurulması (eğitim domain'leri ayrı).
5. İki katmanlı yetki: entitlement (tenant) × grant (user) × scope.
6. Rol paketlerinin tanımı (Eğitmen / Operasyon / Satış / Admin → capability+scope setleri).
7. Mevcut hardcoded kontrollerin (`PERMISSIONS.MANAGEMENT_PANEL`, `role === instructor`) registry'ye taşınması.
