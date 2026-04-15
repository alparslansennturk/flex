// ─── Submission Status ────────────────────────────────────────────────────────
// Akış: submitted → reviewing → revision → submitted → ... → completed

export type SubmissionStatus =
  | 'submitted'   // Öğrenci teslim etti, inceleme bekliyor
  | 'reviewing'   // Eğitmen inceliyor
  | 'revision'    // Revizyon istendi, öğrenci tekrar yükleyecek
  | 'completed';  // Tamamlandı

// ─── File ─────────────────────────────────────────────────────────────────────

export interface SubmissionFile {
  driveFileId:   string;  // Google Drive dosya ID
  driveViewLink: string;  // Drive viewer linki
  fileUrl:       string;  // Drive download linki
  fileName:      string;
  fileSize:      number;  // Byte
  mimeType:      string;
}

// ─── Comment ──────────────────────────────────────────────────────────────────

export type CommentAuthorType = 'student' | 'teacher';

export interface Comment {
  id:           string;
  submissionId: string;
  authorId:     string;
  authorType:   CommentAuthorType;
  authorName:   string;
  body:         string;
  createdAt:    Date;
}

export type CommentCreate = Omit<Comment, 'id' | 'createdAt'>;

// ─── Submission ───────────────────────────────────────────────────────────────

export interface Submission {
  id:        string;
  studentId: string;
  taskId:    string;
  groupId:   string;

  /** Kaçıncı teslim (1 = ilk, 2 = 1. revizyon sonrası, …) */
  iteration: number;

  file: SubmissionFile;

  /** Öğrencinin teslimle birlikte yazdığı not */
  note?: string;

  status: SubmissionStatus;

  /** Eğitmenin geri bildirimi (revision veya completed'da) */
  feedback?: string;
  gradedBy?: string;
  grade?: number;

  isLate:    boolean;
  daysLate?: number;

  submittedAt:  Date;
  reviewedAt?:  Date;
  completedAt?: Date;
  updatedAt:    Date;
}

export type SubmissionCreate = Omit<
  Submission,
  'id' | 'iteration' | 'status' | 'submittedAt' | 'updatedAt' | 'reviewedAt' | 'completedAt'
>;

export type SubmissionUpdate = Partial<
  Pick<Submission, 'status' | 'feedback' | 'gradedBy' | 'grade' | 'reviewedAt' | 'completedAt'>
>;
