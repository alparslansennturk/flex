# FLEX_CORE_LOG — Proje Beyni
> Son güncelleme: 2026-03-27
> Bu dosya PC'ye geçince Claude'a verilir, kaldığı yerden devam eder.

---

## Modül Alanı — Ödev Şablonları

**Dosyalar:** `TaskForm.tsx`, `TaskManagementPanel.tsx`, `taskTypes.tsx`

- `Task` arayüzüne `module?: "GRAFIK_1" | "GRAFIK_2"` eklendi.
- Şablon formu 3 sütunlu yapıya geçirildi: **Kart Adı | Modül\* | Seviye**
- Modül seçimi şablonlarda zorunlu alan olarak işaretlendi.
- Şablon tablosuna Seviyeden önce **Modül** sütunu eklendi (Grafik 1 / Grafik 2 pill badge).

---

## Sertifikasyon Sekmesi

**Dosya:** `src/app/dashboard/grading/page.tsx`

- Not Girişi sayfasına üst sekme olarak **Sertifikasyon** eklendi.
- İç sekmeler: **Grafik 1** / **Grafik 2**
- Her sekme: grup dropdown, öğrenci tablosu (Öğrenci Adı | Proje Notu | Ödev Puanı | Toplam Not)
- Kayıt: `projectGrades/{studentId}_{groupId}_{module}` dokümana `setDoc merge`

### Ödev Puanı Hesabı
- `odevPuani = (studentXP / maxXP) × 30`
- `finalNot = projectScore × 0.7 + odevPuani`
- Task verileri `onSnapshot` ile realtime güncelleniyor (`isGraded: true` + modül filtresi)

### Grafik X Bitir Butonu
- Tablo altında finalize butonu
- Onay modalı sonrası `isFinalized: true`, `finalizedAt`, `studentName`, `gender`, `avatarId` kaydediliyor
- Finalize sırasında grup dokümanına `codeAt_GRAFIK_1` / `codeAt_GRAFIK_2` alanı yazılıyor (orijinal kod korunur)

### Öğrenci Listesi Dondurma
- Finalize edilmiş modülde öğrenci listesi `projectGrades` snapshot'ından yüklenir (o andaki öğrenciler)
- Finalize edilmemiş modülde `students` koleksiyonundan `groupId` ile canlı sorgu

---

## Firestore Güvenlik Kuralları

**Dosya:** `firestore.rules`

```
match /projectGrades/{gradeId} {
  allow read: if isSignedIn() && (isAdmin() || isInstructor());
  allow write: if isAdmin() || isInstructor();
}
```

---

## Modül Değişikliği Engeli — Grup Yönetimi

**Dosyalar:** `useManagement.ts`, `GroupForm.tsx`, `ManagementContent.tsx`

- Grup formuna **Modül** dropdown eklendi (5. sütun): Belirtilmemiş / Grafik 1 / Grafik 2
- `Group` arayüzüne `module?: "GRAFIK_1" | "GRAFIK_2"` eklendi
- Modül değiştirilmek istendiğinde `projectGrades`'de mevcut modülün finalize edilip edilmediği kontrol edilir
- Finalize edilmemişse modal: *"Önce Sertifikasyon → Grafik X Bitir butonuna basın"*
- Finalize edildikten sonra not girişi açık kalmaya devam eder

---

## Grup Kodu Değişince Öğrenci Senkronizasyonu

**Dosya:** `useManagement.ts`

- Grup kodu değiştiğinde `groupId` üzerinden gruptaki tüm öğrenciler `writeBatch` ile yeni koda güncellenir
- Böylece Not Girişi'ndeki `where("groupCode", "==", task.classId)` sorgusu tüm öğrencileri bulur
- Yeni eklenen öğrenciler zaten güncel `group.code` ile oluşturulur, sorun yaşanmaz

---

## Sertifikasyon — Grup Kodu Değişikliği Sonrası Stabil Çalışma

**Dosya:** `src/app/dashboard/grading/page.tsx`

- `Group` arayüzüne `originalCode?: string` eklendi
- Gruplar yüklenirken grup dokümanındaki `codeAt_${module}` alanı `originalCode` olarak okunur
- Fallback: `projectGrades`'deki `groupCode` alanından da orijinal kod çekilir
- Öğrenci sorgusu `groupCode` yerine `groupId` (stabil Firestore ID) kullanır
- Task XP sorgusu `originalCode ?? group.code` ile doğru `classId`'ye bakar
- Dropdown: kodu değişmiş finalize gruplar `"Grup 121 (şimdi: Grup 300)"` formatında gösterilir
- `handleSave` ve `handleFinalize`'da `groupCode` alanı `projectGrades`'e kaydedilir

---

## Mimari Notlar

- `projectGrades` belge ID formatı: `{studentId}_{groupId}_{module}`
- Grup geçişi (GRAFIK_1 → GRAFIK_2) aynı Firestore grup ID'si üzerinde yapılır — tarihsel veri bozulmaz
- Task'lar `classId` (grup kodu), notlar `studentId` ile bağlanır — kod değişse de puanlar kaybolmaz
- Composite Firestore index sorunundan kaçınmak için tek `where` + JS-side filtreleme kullanılır
- Öğrenci koleksiyonu hem `groupId` (stabil) hem `groupCode` (görüntü) taşır; kod değişince her ikisi de güncellenir
