// NOT: Sadece server-side import edilmeli (googledrive.ts firebase-admin gibi server-only değil
// ama OAuth2 refresh-token akışı server ortamı gerektirir).
import {
  ensureFolderPath,
  initResumableSession,
  setPublicReadPermission,
  findFileByActualName,
  deleteFromDrive,
} from "../googledrive";
import type { DriveDeps } from "../domain/repo/drive-deps";

/**
 * `DriveDeps` portunun gerçek implementasyonu — `googledrive.ts` DEĞİŞTİRİLMEDEN reuse edilir
 * (aynı OAuth2 refresh-token, aynı `GOOGLE_DRIVE_FOLDER_ID` kök klasörü). FlexOS kendi izole
 * alt-ağacını (`flexos/{tenantId}/{groupCode}/{personName}/{assignmentTitle}`) açar.
 */
export const submissionDrive: DriveDeps = {
  async ensureFolderPath(pathSegments) {
    return ensureFolderPath(pathSegments);
  },

  async initResumableSession(actualFileName, fileSize, mimeType, folderId) {
    return initResumableSession(actualFileName, fileSize, mimeType, folderId);
  },

  async setPublicReadPermission(fileId) {
    await setPublicReadPermission(fileId);
  },

  async findFileByActualName(actualFileName, parentFolderId) {
    try {
      const result = await findFileByActualName(actualFileName, parentFolderId);
      return { id: result.id };
    } catch {
      return null;
    }
  },

  async deleteFromDrive(fileId) {
    await deleteFromDrive(fileId);
  },
};
