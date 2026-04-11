export type SubmissionStatus =
  | 'pending'
  | 'reviewing'
  | 'graded'
  | 'rejected';

export interface Submission {
  id: string;
  studentId: string;
  taskId: string;
  groupId: string;

  // Dosya bilgileri (Google Drive)
  fileUrl: string;       // Drive download linki
  driveFileId: string;   // Drive dosya ID
  driveViewLink: string; // Drive viewer linki
  fileName: string;
  fileSize: number;
  mimeType: string;

  status: SubmissionStatus;

  grade?: number;
  feedback?: string;
  gradedBy?: string;

  submittedAt: Date;
  reviewedAt?: Date;
  gradedAt?: Date;
  updatedAt: Date;
}

export type SubmissionCreate = Omit<Submission, 'id' | 'submittedAt' | 'updatedAt' | 'status'>;
export type SubmissionUpdate = Partial<Pick<Submission, 'status' | 'grade' | 'feedback' | 'gradedBy' | 'reviewedAt' | 'gradedAt'>>;
