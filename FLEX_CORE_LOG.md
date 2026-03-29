# FLEX CORE LOG
> Son güncelleme: 2026-03-29 (v2)

---

## 1. Arşiv Silince Puan Düşme Sorunu

**Sorun:** Görevler arşivden silinince öğrencilerin puanı sıfırlanıyordu (120 → 84 gibi).

**Kök neden:** `recentScore` hesabı `tasksMap`'e bağlıydı — silinen görev `tasksMap`'ten düşünce `recentScore = 0`, `finalScore = generalScore * 0.7` oluyordu.

**Düzeltmeler:**
- `src/app/lib/scoring.ts` — `GradedTaskEntry`'ye `classId?` ve `endDate?` eklendi
- `src/app/dashboard/grading/page.tsx` — Not kaydında `classId` ve `endDate` entry'ye yazılıyor
- `src/app/dashboard/league/page.tsx`
  - `gradedTasks` filtresi `entry.classId` ile yapılıyor
  - Silinen görevler için `storedEndDate` fallback
  - Skor `generalScore` ile gösteriliyor (artık `finalScore` yok)

---

## 2. G2 Şablonu → G1 Sınıfı: XP Yarıya Düşürme

**Kural:** Grafik-2 şablonu Grafik-1 sınıfına verilince `xpMultiplier = 0.5`. Tersi yok.

**Düzeltmeler:**
- `src/app/components/dashboard/assignment/AssignmentLibrary.tsx` — `xpMultiplier` ve `groupModule` task doc'a yazılıyor
- `src/app/components/dashboard/scoring/DesignParkour.tsx` — Ghost aktivasyon ve reactivation'a `xpMultiplier` + `groupModule` eklendi
- `src/app/dashboard/grading/page.tsx` GradingForm — `xpMultiplier` önce task'tan, yoksa gruptan türetiliyor

---

## 3. Ödev İptal Edilince XP Geri Alma

**Kural:** "Ödevi iptal et" → öğrencilerin kazandığı XP silinir, task `isCancelled: true` olur.

**Düzeltme:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx` `handleCancelTask`
  - `task.grades`'den XP'li teslim edenler bulunur
  - `gradedTasks.${taskId}` → `deleteField()` ile silinir
  - `isCancelled: true` task'a yazılır

---

## 4. Sertifikasyon — Grup Bazlı Puan Sıfırlama

**Kural:** Not Girişi başlığındaki "Puanları Sıfırla" butonunun solunda grup seçici.
- **Tümü** → soft reset (isScoreHidden + bumpSeason)
- **Belirli grup** → sadece `gradedTasks` silinir, `projectGrades` dokunulmaz, season değişmez

**Düzeltmeler:**
- `src/app/dashboard/grading/page.tsx`
  - `GradingTabs`: `resetScope` state + select+button kombo UI
  - `ResetPointsModal`: `groupLabel` prop, `isGroupScope` branch ayrıldı

---

## 5. Sertifikasyon — Ödev Puanı Hesap Düzeltmeleri

### 5a. groupModule Filtresi
**Sorun:** `module` alanı şablondan geliyordu — eksik `module` alanında CertModuleTab görevi bulamıyor, ödev puanı "—" çıkıyordu.

**Düzeltme:**
- CertModuleTab `onSnapshot` filtresi: `groupModule` (task verilirken grubun modülü) öncelikli, fallback `module`
- Task oluşturulurken `groupModule` yazılıyor (AssignmentLibrary + DesignParkour)

### 5b. maxXP xpMultiplier Düzeltmesi
**Sorun:** `maxXP = getLevelXP` — `xpMultiplier = 0.5` olan task'larda oran yanlıştı.

**Düzeltme:**
- `maxXP += getLevelXP × (xpMultiplier ?? 1)` — CertModuleTab ve StudentDetailModal'da

### 5c. İptal Edilen Görev maxXP'yi Şişiriyordu
**Sorun:** `isCancelled` task'lar `isGraded: true` kaldığı için maxXP'ye giriyordu → final not 100 yerine 90 çıkıyordu.

**Düzeltme:**
- CertModuleTab ve StudentDetailModal filtrelerine `!t.isCancelled` eklendi

---

## 6. Sertifikasyon — Öğrenci Listesi Realtime

**Sorun:** `getDocs` (tek seferlik) — sayfa açıkken gruba transfer edilen öğrenciler görünmüyordu.

**Düzeltme:**
- `src/app/dashboard/grading/page.tsx`
  - `useRef` + `studentUnsubRef` eklendi
  - Finalize edilmemiş grup: `getDocs` → `onSnapshot` (realtime)
  - Grup değişince abonelik temizleniyor
  - Yeni öğrenci gelince mevcut girilen proje notları korunuyor

---

## 7. Öğrenci Transferi — Eski Puanların Temizlenmesi

**Kural:** Öğrenci başka bir gruba transfer edilince ödev XP'leri sıfırlanır.

**Düzeltme:**
- `src/app/hooks/useManagement.ts`
  - `deleteField` import'a eklendi
  - `handleAddStudent` — grup değişince: `gradedTasks: deleteField()`, `rankChange: 0`, `isScoreHidden: false`

---

## 8. TypeScript Derleme Hatası

- `src/app/dashboard/league/page.tsx` — `map` tipine `classId?: string` eklendi

---

## 9. Öğrenci Kartı — Lig Puanı Toplam Düzeltmesi

**Sorun:** Sol alttaki "Lig Puanı / Toplam" kutusu `student.score` gösteriyordu. Sertifikasyon ve sınıf yönetiminden açınca `score: 0` geçildiği için 0 görünüyordu; ligden açınca sadece mevcut sınıfın skoru çıkıyordu.

**Düzeltme:**
- `src/app/components/dashboard/student-management/StudentDetailModal.tsx`
  - Toplam kutusu: `student.score` → `g1Stats.score + g2Stats.score` (Firestore'dan yüklenen gerçek G1+G2 toplamı)
  - Yükleme sırasında `"…"` gösterilir

---

## 10. Arşiv Silince Öğrenci İstatistiklerinin Sıfırlanması

**Sorun:** Arşivdeki graded task silinince `task.grades` Firestore'dan kalkıyor. `calcModuleStats` ve CertModuleTab yalnızca mevcut task'lardan hesap yaptığı için öğrencinin ödev sayısı, XP ve lig puanı 0'a düşüyordu.

**Kök neden:** `student.gradedTasks[taskId]` kaydı korunuyor ama hesaplamalar onu dikkate almıyordu. Ayrıca `maxXp` saklanmadığı için odevPuani oranı da hesaplanamıyordu.

**Düzeltmeler:**
- `src/app/lib/scoring.ts` — `GradedTaskEntry`'ye `maxXp?` eklendi
- `src/app/dashboard/grading/page.tsx` (`handleSaveGrades`) — Not kaydında `maxXp: baseXP` entry'ye yazılıyor
- `src/app/components/dashboard/student-management/StudentDetailModal.tsx` (`calcModuleStats`)
  - Mevcut task döngüsüne ek olarak: `fsGradedTasks`'ta `classId` eşleşen, Firestore'da artık olmayan (silinmiş) task'ların XP ve `maxXp`'si de `taskCount` / `studentXP` / `maxXP`'e ekleniyor
- `src/app/dashboard/grading/page.tsx` (CertModuleTab)
  - `studentsRef` + `savedOdevPuanis` state eklendi
  - Task `onSnapshot`: mevcut `task.grades` XP'sine ek olarak `studentsRef.current`'tan silinmiş task XP'leri ve `maxXp`'leri toplanıyor
  - `getOdevPuani`: finalize edilmiş grupta `savedOdevPuanis`'ten stored değer kullanılıyor (task silinse etkilenmez)

---

## Etkilenen Dosyalar

| Dosya | Konu |
|---|---|
| `src/app/lib/scoring.ts` | GradedTaskEntry — classId, endDate, maxXp |
| `src/app/dashboard/grading/page.tsx` | Not girişi, CertModuleTab, ResetModal, realtime öğrenci, silinen task recovery |
| `src/app/dashboard/league/page.tsx` | Puan hesabı, TS tip düzeltmesi |
| `src/app/components/dashboard/assignment/AssignmentLibrary.tsx` | xpMultiplier, groupModule |
| `src/app/components/dashboard/scoring/DesignParkour.tsx` | xpMultiplier, groupModule, isCancelled, XP geri alma |
| `src/app/components/dashboard/student-management/StudentDetailModal.tsx` | maxXP, isCancelled filtresi, lig puanı toplam, silinen task recovery |
| `src/app/hooks/useManagement.ts` | Transfer — gradedTasks silme |

---

## Mimari Notlar

- `gradedTasks[taskId]` → `{ xp, penalty, seasonId, classId, endDate, maxXp }` — task silinse bile veri korunur; `maxXp` sayesinde odevPuani oranı recover edilebilir
- `isCancelled: true` — iptal edilen task'lar cert ve student modal'dan dışlanır
- `groupModule` — task verilirken grubun modülü (GRAFIK_1/2) task doc'a yazılır, cert filtresinde öncelikli
- `xpMultiplier` — G2 şablonu G1 grubuna gidince 0.5, aksi null; maxXP hesabına da uygulanır
- Transfer: grup değişince `gradedTasks: deleteField()` çalışır
- Sertifikasyon öğrenci listesi: finalize edilmemişse `onSnapshot`, edilmişse projectGrades'den frozen list
- `projectGrades` ID formatı: `{studentId}_{groupId}_{module}`
- Öğrenci kartı lig puanı toplam: sağ üstteki `student.score` = sadece mevcut sınıf; sol alt Toplam = `g1Stats.score + g2Stats.score`
