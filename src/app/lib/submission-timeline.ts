/**
 * Firestore submission_timeline CRUD — Server-side (Admin SDK)
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type {
  SubmissionTimelineEntry,
  SubmissionTimelineCreate,
  TimelineEntryType,
  TimelineEntryData,
} from "@/app/types/submission-timeline";

const COL = "submission_timeline";

function docToEntry(id: string, data: FirebaseFirestore.DocumentData): SubmissionTimelineEntry {
  return {
    id,
    submissionId: data.submissionId,
    studentId:    data.studentId,
    taskId:       data.taskId,
    groupId:      data.groupId,
    type:         data.type as TimelineEntryType,
    data:         (data.data ?? {}) as TimelineEntryData,
    authorId:     data.authorId,
    createdAt:    (data.createdAt as Timestamp).toDate(),
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createTimelineEntry(
  payload: SubmissionTimelineCreate,
): Promise<SubmissionTimelineEntry> {
  const ref = adminDb.collection(COL).doc();
  await ref.set({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submission-timeline] Doc okunamadı: ${ref.id}`);
  return docToEntry(ref.id, snap.data()!);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTimeline(submissionId: string): Promise<SubmissionTimelineEntry[]> {
  const snap = await adminDb.collection(COL)
    .where("submissionId", "==", submissionId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map(d => docToEntry(d.id, d.data()));
}

export async function getTimelineForGroup(
  groupId: string,
  taskId:  string,
): Promise<SubmissionTimelineEntry[]> {
  const snap = await adminDb.collection(COL)
    .where("groupId", "==", groupId)
    .where("taskId",  "==", taskId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map(d => docToEntry(d.id, d.data()));
}
