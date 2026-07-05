/**
 * Google Drive bağımlılık portu — PORT. Domain Firestore'u bilmediği gibi Drive'ı da
 * bilmez; gerçek implementasyon `lib/server/submission-drive.ts`'te `src/app/lib/googledrive.ts`
 * (DEĞİŞTİRİLMEDEN) reuse eder. Assertion script'te fake bir implementasyon enjekte edilir
 * — gerçek network çağrısı test sırasında YAPILMAZ.
 */
export interface DriveDeps {
  /** Kök klasörden başlayarak iç içe path oluşturur/bulur, folderId döner. */
  ensureFolderPath(pathSegments: string[]): Promise<string>;
  /** Resumable upload session açar, Drive'ın döndürdüğü `sessionUri`'yi verir. */
  initResumableSession(actualFileName: string, fileSize: number, mimeType: string, folderId: string): Promise<string>;
  /** Yükleme tamamlandıktan sonra dosyayı herkese-açık okunur yapar. */
  setPublicReadPermission(fileId: string): Promise<void>;
  /** Client `driveFileId` göndermezse isimle arama fallback'i. */
  findFileByActualName(actualFileName: string, parentFolderId: string): Promise<{ id: string } | null>;
  /** Dosyayı Drive'dan kalıcı sil (404'ü sessizce yutar). */
  deleteFromDrive(fileId: string): Promise<void>;
}
