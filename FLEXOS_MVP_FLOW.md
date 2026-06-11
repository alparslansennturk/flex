# FlexOS — Çekirdek Akış (MVP) Blueprint

> Hedef: temel akışı uçtan uca çalıştırmak. Satış kayıt açar → öğrenci oluşur →
> grup oluşturulur/atanır → eğitmen kendi öğrencilerini görür → not girer → operasyon takip eder.
> AI ve ileri otomasyon **kapsam dışı**; sadece mimari dikişler (tenantId, Person≠Enrollment, donmuş sonuç) bırakılır.
> İlgili: `FLEXOS_CAPABILITIES.md`, `ARCHITECTURE.md`. Son güncelleme: Haziran 2026

---

## Kapsam — bu 4 domain

`person` (öğrenci) · `group` (grup) · `enrollment` (öğrenci–grup ilişkisi) · `grade` (not).
Attendance, certificate, assignment, sale **bu turda değil** (akış için gerekmiyor).

**En kritik kural:** Person grup/not taşımaz. Grup ve not ilişkisi `enrollment`'ta yaşar.
Bu, hem "eğitmen sadece kendi öğrencilerini görür"ü hem "aynı kişi farklı yıllarda geri döner"i çözer.

---

## Veri Modeli (hedef şema)

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

---

## Uçtan Uca Akış → Capability Eşlemesi

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

---

## "Eğitmen kendi öğrencilerini görür" — kilit mekanizma

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

---

## Minimum Capability Listesi (sadece bu akış)

| Domain | Capability | Hassas |
|--------|-----------|--------|
| person | `person.create` · `person.read` · `person.read.pii` · `person.edit` · `person.search` | 🟡/🟢 |
| enrollment | `enrollment.create` · `enrollment.read` · `enrollment.transfer` | 🟡 |
| group | `group.create` · `group.read` · `group.edit` · `group.assign_student` · `group.assign_trainer` · `group.activate` | 🟢/🟡 |
| grade | `grade.read` · `grade.write` · `grade.finalize` · `grade.report.read` | 🟢/🔴 |
| system | `role.manage` · `capability.grant` (paketleri kurmak için, admin) | 🔴 |

~18 capability. Attendance/certificate/assignment bu akışta yok.

---

## Modül Sınırları (capability paketleri)

> Paket = isimlendirilmiş capability+scope seti. Departman değil, paket.

**Satış paketi**
`person.create`, `person.read`, `person.read.pii`, `person.edit`, `person.search`, `enrollment.create` — scope `@org` (veya `@branch`).

**Operasyon paketi**
`group.*`, `enrollment.*`, `group.assign_trainer`, `group.activate`, tüm read'ler `@org`, `grade.report.read @org`.

**Eğitmen paketi**
`person.read @assigned`, `enrollment.read @assigned`, `group.read @assigned`, `grade.read/write @assigned`, `grade.finalize @assigned`.

**Admin paketi**
Tümü `@org` + `role.manage`, `capability.grant`.

> Açık karar: `grade.finalize` (not donar) eğitmende mi operasyonda mı? MVP'de **eğitmen @assigned** (bugünkü "Modülü Bitir" davranışı). İleride operasyona alınabilir — sadece grant değişir.

---

## Bugün bırakılan dikişler (AI/gelecek için ucuz)

1. **`tenantId` her dokümanda** + her sorguda + security rules zorunlu.
2. **Mutasyonlar service fonksiyonlarında**, bileşen içine saçılmaz (çekiliş bug sınıfının kökü buydu — §187-188). İleride bunlar `executeAction` olur.
3. **`enrollment.result` donmuş snapshot** deseni baştan şemada.
4. **`can(capability, scope)` helper'ı** — başta basit rol→paket eşlemesiyle dolu olsa bile, çağrı noktaları registry'ye hazır.

> Bu dördü dışında AI/otomasyon/multi-vertical mekanizması **kurulmaz**. Sadece çekirdek akış koşar.

---

## Yarın ilk adım

1. `persons` / `groups` / `enrollments` / `grades` koleksiyon şemalarını + `tenantId`'yi sabitle.
2. `can(capability, scope)` helper'ı + 4 paketi (Satış/Operasyon/Eğitmen/Admin) tanımla.
3. Akışın 1→6 adımını en kısa yoldan uçtan uca koştur (UI minimal, mantık service'te).
4. Çalışınca → Eğitim Operasyonu modülüne geç.
