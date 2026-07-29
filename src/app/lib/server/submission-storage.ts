import {
  buildObjectPath,
  initResumableUploadSession,
  createSignedUploadUrl,
  makeObjectPublic,
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

  async createSignedUploadUrl(objectPath, mimeType) {
    return createSignedUploadUrl(objectPath, mimeType);
  },

  async makeObjectPublic(objectPath) {
    await makeObjectPublic(objectPath);
  },

  async deleteObject(objectPath) {
    await deleteObject(objectPath);
  },

  publicUrl(objectPath) {
    return publicUrl(objectPath);
  },
};
