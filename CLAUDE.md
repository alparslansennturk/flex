# Flex — Proje Yönergesi

Bu projede **iki paralel iş** yürür. Aksi belirtilmedikçe **varsayılan bağlam = yeni mimari (FlexOS)**.

| İş | Defter | Ne zaman |
|----|--------|----------|
| **Yeni mimari (VARSAYILAN)** — sıfırdan modüler inşa (Person≠Enrollment, capability modeli) | `FLEXOS.md` · kod: `src/app/lib/domain/` · branch: `flexos` | Varsayılan — her iş |
| **Canlı trainer uygulaması** — yoklama, not, ödev, bug, UI | `FLEX_CORE_LOG.md` (günlük) + `FLEX_CORE_LORE.md` (bugünkü sistemin teknik referansı) | SADECE kullanıcı açıkça "canlı uygulama / yoklama / mevcut sistem" derse |

## Çalışma kuralları

- Kullanıcı **"mimariye devam" / "yeni mimari" / "FlexOS'a devam"** derse → `FLEXOS.md` oku. İlerleme için en üstteki **"Durum / İlerleme"** bloğuna bak (ne bitti / sıradaki ne). Tüm dosyayı okuma; gereken `§` bölümünü aç. Token tasarrufu önemli.
- Kullanıcı kelime ezberlemez; niyetten doğru defteri (FLEXOS mu, LOG mu) Claude seçer.
- Yeni mimari **canlı sisteme dokunmaz:** yeni koleksiyonlar (`persons`, `enrollments`), eski `students`/`groups`/`design_attendance` değişmez/yazılmaz.

## İki bilgisayar (Mac + PC)

- Claude'un kişisel hafızası makineye özeldir, **senkronlanmaz.** Kalıcı durum bu repo dosyalarındadır (`FLEXOS.md` üstündeki "Durum / İlerleme" bloğu = tek doğru ilerleme kaynağı).
- **Bilgisayar değiştirmeden önce `commit` + `push`; açılışta `git pull`.** Yoksa öteki makinede son durum eksik olur.
