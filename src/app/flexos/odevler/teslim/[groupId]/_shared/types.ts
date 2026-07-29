import type { AssignmentStatus } from "../../../_shared/EditAssignmentModal";

export interface AssignmentAttachment { id: string; fileName: string; fileSize: number; mimeType: string; webViewLink: string }

export interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  createdAt?: string;
  status: AssignmentStatus;
  attachments: AssignmentAttachment[];
}

export type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

export interface SubmissionRow {
  id: string;
  assignmentId: string;
  personId: string;
  status: SubmissionStatus;
}
