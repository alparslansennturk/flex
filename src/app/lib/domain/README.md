# `lib/domain` — FlexOS Veri Modeli (yeniden-inşa)

> Yeni mimarinin TypeScript tip katmanı. Tam tasarım: kökteki **`FLEXOS.md`**.
> Bu klasör **canlı sisteme dokunmaz** — yeni koleksiyonlar (`persons`, `enrollments` …)
> içindir; bugünkü `students`/`groups`/`design_attendance` değişmez.

## Katmanlar (bağımlılık tek yönlü: `eduos → education → core`)

| Klasör | Katman | İçerik |
|--------|--------|--------|
| `core/` | Classroom çekirdeği (üst katmanı **bilmez**) | `Person`, `Enrollment`, `Group`, `Module`, `PersonNote` |
| `education/` | Eğitim pack (eğitime özel) | `Grade` |
| `eduos/` | FlexOS üst katman — **DİKİŞ**, mantık sonra | `Education`, `Sale`, `Payment` |
| `base.ts` | Paylaşılan ilkeller | `EntityId`, `TenantId`, `ISODate`, `Gender`, `Audit` |

## Kök ilkeler

- **Person ≠ Enrollment.** Person sadece KİMLİK; grup/not/ödeme/sertifika ayrı
  koleksiyonlarda yaşar, öğrenci kartında okuma anında birleştirilir.
- **Donmuş sonuç.** Not/sertifika `Enrollment.result`'a finalize anında snapshot'lanır,
  sonra değişmez.
- **`tenantId` her varlıkta** (multi-tenant dikişi — boşken bedava).
- **PII gated.** `Person.pii` alanı capability ile kapılı (eğitmen yazamaz/göremez).

## Henüz YOK (sonraki adımlar — `FLEXOS.md §6`)

Capability registry + `can(capability, scope)` + `executeAction()` omurgası,
repo/adapter katmanı (Firestore dönüşümü), backfill scriptleri.
