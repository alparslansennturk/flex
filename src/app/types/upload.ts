// upload_sessions collection types

export type UploadSessionStatus = "initializing" | "uploading" | "completed" | "failed";

export interface UploadSession {
  uploadId:         string;
  userId:           string; // auth UID
  studentId:        string;
  taskId:           string;
  groupId:          string;
  originalFileName: string;
  actualFileName:   string; // 01-dosya.pdf (sıra numarası + orijinal ad)
  fileSize:         number;
  mimeType:         string;
  sessionUri:       string; // Google Drive resumable URI
  folderId:         string; // Google Drive klasör ID (alt klasör)
  folderPath:       string; // İnsan okunabilir yol: /groups/group_{id}/students/...
  status:           UploadSessionStatus;
  driveFileId?:     string;
  driveFileIdSource?: "response" | "fallback_single" | "fallback_latest";
  fallbackUsed?:    boolean;
  fallbackRetries?: number;
  createdAt:        Date;
  completedAt?:     Date;
  expiresAt:        Date; // createdAt + 7 days (Drive session lifetime)
}

export interface InitUploadResponse {
  uploadId:         string;
  sessionUri:       string;
  actualFileName:   string;
  currentUploads:   number;
  maxUploads:       number;
  uploadsRemaining: number;
  totalBytes:       number;
  folderPath?:      string; // Drive klasör yolu (loglama)
}

export interface CompleteUploadResponse {
  submissionId:      string;
  driveFileId:       string;
  driveViewLink:     string;
  downloadUrl:       string;
  fileName:          string;
  fileSize:          number;
  status:            string;
  driveFileIdSource: string;
}

export interface UploadCountResponse {
  current:   number;
  max:       number;
  remaining: number;
}

export interface DeleteFileResponse {
  success:      boolean;
  updatedCount: number;
  message:      string;
}
