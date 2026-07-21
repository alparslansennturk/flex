import {
  buildObjectPath,
  initResumableUploadSession,
  deleteObject,
  publicUrl,
} from "../googlestorage";
import type { StorageDeps } from "../domain/repo/storage-deps";

/**
 * `StorageDeps` portunun gerçek implementasyonu — `googlestorage.ts` DEĞİŞTİRİLMEDEN
 * reuse edilir (Flex Connect ekleriyle AYNI bucket). FlexOS ödev teslimleri kendi
 * izole üst segmentinde yaşar (`"Ödev Teslimleri"`, bkz. `submission-service.ts`).
 */
export const submissionStorage: StorageDeps = {
  buildObjectPath(pathSegments, fileName) {
    return buildObjectPath(pathSegments, fileName);
  },

  async initResumableUploadSession(objectPath, mimeType) {
    return initResumableUploadSession(objectPath, mimeType);
  },

  async deleteObject(objectPath) {
    await deleteObject(objectPath);
  },

  publicUrl(objectPath) {
    return publicUrl(objectPath);
  },
};
