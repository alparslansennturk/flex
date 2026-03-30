# FLEX CORE LOG
> Son güncelleme: 2026-03-30 (v3)

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

**Düzeltme (ilk):**
- CertModuleTab `onSnapshot` filtresi: `groupModule` öncelikli, `tm != null ? tm === module : true` fallback
- Task oluşturulurken `groupModule` yazılıyor (AssignmentLibrary + DesignParkour)

**Düzeltme (son — eski gruplar için):**
- `tm` (şablon modülü) fallback tamamen kaldırıldı. `groupModule` yoksa direkt `true` döner.
- Sebep: eski görevlerde `tm = "GRAFIK_2"` (şablondan) ama görev GRAFIK_1 grubuna verilmiş — `tm === module` yanlış `false` üretiyordu.
- `classId` sorgusu zaten doğru grubu kısıtladığı için ek modül filtresi gerekmez.

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

## 11. Arşiv — Çoklu Oturum Birleştirme

**Sorun:** İkinci çekim Firestore'a kaydedilmiyordu. `handleArchive` mevcut arşiv dokümanını `updateDoc` ile güncelleyince `Missing or insufficient permissions` hatası alıyordu (rules'ta `allow update` yoktu).

**Kök neden:** `assignment_archive` kuralında yalnızca `allow create` vardı, `allow update` yoktu. Ayrıca birden fazla session için tek dokümana merge yapılması yetki gerektiriyordu.

**Düzeltme:**
- `handleArchive` ve `handleFinalizeTask` her zaman `addDoc` kullanır (update/merge yok) → yalnızca `create` yetkisi yeterli
- `src/app/dashboard/archive/page.tsx`
  - `ArchiveEntry`'ye `allIds: string[]` eklendi
  - Yükleme sırasında `taskId`'ye göre client-side merge: `draws` ve `students` deduplicate edilir
  - `handleDelete`: aynı `taskId`'ye ait tüm dokümanlar `Promise.all` ile silinir
- `firestore.rules` — `assignment_archive`'e `allow update` eklendi (yedek olarak)

---

## 12. DesignParkour — addDoc Undefined Points Hatası

**Sorun:** Şablondan başlatılan Photoshop görevinde `addDoc() called with invalid data. Unsupported field value: undefined (found in field points)` hatası.

**Kök neden:** Şablon dokümanında `points` alanı yoksa `undefined` Firestore'a geçiyordu.

**Düzeltme:**
- `src/app/components/dashboard/scoring/DesignParkour.tsx` `handleGhostActivate`:
  - `points: t.points ?? null`, `description: t.description ?? null`, `type: t.type ?? null`

---

## 13. Kolaj/Kitap — Görev Tamamlama Tespiti

**Sorun:** 1. öğrenci tamamlayınca "Not Ver" butonuna geçiliyordu; 2. öğrenci hâlâ beklemedeydi.

**Kök neden:** `students.length` = o session'a katılan öğrenci sayısı kullanılıyordu. Her session'da bu sayı = o session'ın çekimleri sayısı → her zaman eşit çıkıyordu.

**Düzeltme:**
- `groupStudentCount` state + `useRef` eklendi — `getDocs(students where groupId == task.groupId)` ile gerçek grup üye sayısı çekiliyor
- `handleArchive` içinde: `drawsRef.current.length >= groupStudentCount` → tüm öğrenciler tamamlandıysa `status: "completed"`

---

## 14. Öğrenci Kartı — Toplam Ödev Sayısı Yükleme Durumu

**Sorun:** Modal açılınca "Toplam" kutusu 1 sn boyunca `student.completedTasks` (prop'tan gelen stale değer) gösteriyordu; diğer kutular "…" gösterirken Toplam hatalı sayı çıkıyordu.

**Düzeltme:**
- `src/app/components/dashboard/student-management/StudentDetailModal.tsx`
  - Toplam kutusu: yükleme sırasında `totalTasks` yerine `"…"` gösterilir (`loading` prop geçildi)

---

## 15. Kolaj — İsim ve Soyisim Aynı Satırda

**Sorun:** Çekim ekranında öğrenci ismi büyük puntoda gösterilirken soyisim `<br />` ile alt satıra geçiyordu.

**Düzeltme:**
- `src/app/components/dashboard/assignment/kolaj/GameScreen.tsx` (phase === "ready" bloğu)
  - `<br />` kaldırıldı; soyisim aynı satırda `{" "}` ile bitiştirildi (mavi renk korundu)

---

## Etkilenen Dosyalar

| Dosya | Konu |
|---|---|
| `src/app/lib/scoring.ts` | GradedTaskEntry — classId, endDate, maxXp |
| `src/app/dashboard/grading/page.tsx` | Not girişi, CertModuleTab, ResetModal, realtime öğrenci, silinen task recovery |
| `src/app/dashboard/league/page.tsx` | Puan hesabı, TS tip düzeltmesi |
| `src/app/components/dashboard/assignment/AssignmentLibrary.tsx` | xpMultiplier, groupModule |
| `src/app/components/dashboard/scoring/DesignParkour.tsx` | xpMultiplier, groupModule, isCancelled, XP geri alma, undefined points fix |
| `src/app/components/dashboard/student-management/StudentDetailModal.tsx` | maxXP, isCancelled filtresi, lig puanı toplam, silinen task recovery, Toplam yükleme |
| `src/app/hooks/useManagement.ts` | Transfer — gradedTasks silme |
| `src/app/dashboard/archive/page.tsx` | allIds merge, client-side taskId gruplama, toplu silme |
| `src/app/components/dashboard/assignment/kolaj/GameScreen.tsx` | handleArchive addDoc, groupStudentCount, isim aynı satır |
| `src/app/components/dashboard/assignment/kitap/BookGameScreen.tsx` | handleArchive addDoc, groupStudentCount |
| `firestore.rules` | assignment_archive allow update eklendi |

---

## Mimari Notlar

- `gradedTasks[taskId]` → `{ xp, penalty, seasonId, classId, endDate, maxXp }` — task silinse bile veri korunur; `maxXp` sayesinde odevPuani oranı recover edilebilir
- `isCancelled: true` — iptal edilen task'lar cert ve student modal'dan dışlanır
- `groupModule` — task verilirken grubun modülü (GRAFIK_1/2) task doc'a yazılır, cert filtresinde tek kriter; `module` (şablon) alanına bakılmaz — eski görevlerde yanlış değer verir
- Arşiv çoklu oturum: her `handleArchive` çağrısı yeni `addDoc` oluşturur; archive page `taskId`'ye göre client-side merge yapar
- `xpMultiplier` — G2 şablonu G1 grubuna gidince 0.5, aksi null; maxXP hesabına da uygulanır
- Transfer: grup değişince `gradedTasks: deleteField()` çalışır
- Sertifikasyon öğrenci listesi: finalize edilmemişse `onSnapshot`, edilmişse projectGrades'den frozen list
- `projectGrades` ID formatı: `{studentId}_{groupId}_{module}`
- Öğrenci kartı lig puanı toplam: sağ üstteki `student.score` = sadece mevcut sınıf; sol alt Toplam = `g1Stats.score + g2Stats.score`
