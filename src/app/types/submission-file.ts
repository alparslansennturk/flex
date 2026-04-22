// submission_files collection types
// Bu, submission_files collection'ındaki versiyonlanmış dosya geçmişini temsil eder.
// submission.ts'deki SubmissionFile (submission içindeki anlık dosya) ile karıştırma.

export interface FileMetadata {
  fileName:    string;
  fileSize:    number; // byte
  mimeType?:   string;
}

export interface SubmissionFileVersion {
  id:           string;
  submissionId: string;
  studentId:    string;
  driveFileId:  string;
  fileUrl:      string;
  fileName:     string;
  fileSize:     number;
  versionNo:    number;
  isLatest:     boolean;
  uploadedAt:   Date;
}

export type SubmissionFileCreate = Omit<
  SubmissionFileVersion,
  "id" | "uploadedAt" | "isLatest" | "versionNo"
>;
