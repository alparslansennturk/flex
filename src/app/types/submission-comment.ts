// submission_comments collection types
// NOT: CommentAuthorType zaten submission.ts'de tanımlı — buradan re-export ediyoruz.

export type { CommentAuthorType } from "./submission";

export interface SubmissionComment {
  id:           string;
  submissionId: string;
  authorId:     string;
  authorType:   import("./submission").CommentAuthorType;
  text:         string;
  isRead:       boolean;
  order:        number;
  createdAt:    Date;
}

export type SubmissionCommentCreate = Omit<SubmissionComment, "id" | "createdAt" | "isRead" | "order">;
