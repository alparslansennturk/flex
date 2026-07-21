/**
 * Google Cloud Storage bağımlılık portu — PORT. `drive-deps.ts` ile AYNI amaç
 * (domain Firestore'u bilmediği gibi GCS'i de bilmez), ama GCS'in gerçek
 * şekline uygun: klasör arama/oluşturma yok (path'ler önceden biliniyor),
 * ayrı bir "izin ver" adımı yok (upload anında zaten publicRead). Gerçek
 * implementasyon `lib/server/submission-storage.ts`'te `src/app/lib/googlestorage.ts`
 * (DEĞİŞTİRİLMEDEN) reuse eder.
 */
export interface StorageDeps {
  /** Segment dizisinden tek bir object path oluşturur (gerçek "klasör" yok). */
  buildObjectPath(pathSegments: string[], fileName: string): string;
  /** Resumable upload oturumu açar, GCS'in döndürdüğü `sessionUri`'yi verir. */
  initResumableUploadSession(objectPath: string, mimeType: string): Promise<string>;
  /** Dosyayı GCS'ten kalıcı sil (404'ü sessizce yutar). */
  deleteObject(objectPath: string): Promise<void>;
  /** Public URL — upload anında zaten `publicRead` olduğu için ayrı bir izin adımı yok. */
  publicUrl(objectPath: string): string;
}
