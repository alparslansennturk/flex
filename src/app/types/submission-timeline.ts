// submission_timeline collection types

export type TimelineEntryType =
  | "submitted"
  | "comment"
  | "revision_needed"
  | "resubmitted"
  | "approved";

export interface TimelineEntryData {
  commentId?: string;
  fileId?:    string;
}

export interface SubmissionTimelineEntry {
  id:           string;
  submissionId: string;
  studentId:    string;
  taskId:       string;
  groupId:      string;
  type:         TimelineEntryType;
  data:         TimelineEntryData;
  authorId:     string;
  createdAt:    Date;
}

export type SubmissionTimelineCreate = Omit<SubmissionTimelineEntry, "id" | "createdAt">;
