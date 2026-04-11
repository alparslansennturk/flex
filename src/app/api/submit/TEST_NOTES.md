# POST /api/submit — Test Rehberi (Google Drive)

## Ön koşullar
```bash
# .env.local kontrolü
grep GOOGLE_DRIVE .env.local
# → GOOGLE_DRIVE_KEY=eyJ...
# → GOOGLE_DRIVE_FOLDER_ID=1o2IX0...
```

## 1. Sunucuyu başlat
```bash
npm run dev
# http://localhost:3000
```

## 2. Gerçek ID'leri bul (Firebase Console → Firestore)
```
students/{studentId}  → bir doc ID kopyala
tasks/{taskId}        → aktif bir task ID kopyala
groups/{groupId}      → o öğrencinin groupId'si
```

## 3. Mutlu yol — PDF teslim
```bash
curl -X POST http://localhost:3000/api/submit \
  -F "studentId=GERCEK_OGRENCI_ID" \
  -F "taskId=GERCEK_TASK_ID" \
  -F "groupId=GERCEK_GRUP_ID" \
  -F "file=@/path/to/odev.pdf"
```

Beklenen yanıt:
```json
{
  "submissionId": "abc123xyz",
  "driveFileId":  "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "driveViewLink": "https://drive.google.com/file/d/.../view?usp=drivesdk",
  "downloadUrl":  "https://drive.google.com/uc?export=download&id=...",
  "fileName":     "odev.pdf",
  "fileSize":     204800,
  "status":       "pending"
}
```

## 4. Hata senaryoları

### Dosya çok büyük → 413
```bash
# 25MB sahte dosya
dd if=/dev/urandom of=/tmp/big.bin bs=1M count=25
curl -X POST http://localhost:3000/api/submit \
  -F "studentId=ID" -F "taskId=ID" -F "groupId=ID" \
  -F "file=@/tmp/big.bin"
```

### İzin verilmeyen tür → 422
```bash
curl -X POST http://localhost:3000/api/submit \
  -F "studentId=ID" -F "taskId=ID" -F "groupId=ID" \
  -F "file=@script.exe"
```

### Eksik alan → 400
```bash
curl -X POST http://localhost:3000/api/submit \
  -F "studentId=ID"
# → { "error": "taskId zorunludur." }
```

### Yanlış groupId → 400
```bash
curl -X POST http://localhost:3000/api/submit \
  -F "studentId=OGRENCI_ID" \
  -F "taskId=TASK_ID" \
  -F "groupId=BASKA_GRUP_ID" \
  -F "file=@odev.pdf"
# → { "error": "Öğrenci ... bu gruba ... ait değil." }
```

## 5. Drive kontrolü
- Google Drive → klasör ID'si ile aç
- Dosya orada mı? ✓
- Paylaşım ayarı: "Link ile görüntüleyebilir" ✓

## 6. Firestore kontrolü
Firebase Console → Firestore → `submissions` koleksiyonu:
```
{
  studentId: "...",
  taskId: "...",
  groupId: "...",
  driveFileId: "1Bxi...",
  driveViewLink: "https://drive.google.com/...",
  fileUrl: "https://drive.google.com/uc?export=download&id=...",
  fileName: "odev.pdf",
  fileSize: 204800,
  mimeType: "application/pdf",
  status: "pending",
  submittedAt: Timestamp,
  updatedAt: Timestamp
}
```

## 7. Download URL testi
```bash
curl -L "https://drive.google.com/uc?export=download&id=DRIVE_FILE_ID" -o downloaded.pdf
# dosya indi mi? boyutu doğru mu?
```
