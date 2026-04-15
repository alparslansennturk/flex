/**
 * Firestore Submission CRUD — Server-side utility (Admin SDK)
 *
 * Tüm işlemler Next.js API route'larından çağrılır.
 * Client-side import YAPMA.
 */

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type {
  Submission,
  SubmissionCreate,
  SubmissionUpdate,
  SubmissionStatus,
} from "@/app/types/submission";

const COL = "submissions";

// ─── Yardımcı: Firestore doc → Submission ────────────────────────────────────

function docToSubmission(id: string, data: FirebaseFirestore.DocumentData): Submission {
  return {
    id,
    studentId:  data.studentId,
    taskId:     data.taskId,
    groupId:    data.groupId,
    iteration:  data.iteration ?? 1,
    file: {
      driveFileId:   data.file?.driveFileId   ?? data.driveFileId   ?? "",
      driveViewLink: data.file?.driveViewLink ?? data.driveViewLink ?? "",
      fileUrl:       data.file?.fileUrl       ?? data.fileUrl       ?? "",
      fileName:      data.file?.fileName      ?? data.fileName      ?? "",
      fileSize:      data.file?.fileSize      ?? data.fileSize      ?? 0,
      mimeType:      data.file?.mimeType      ?? data.mimeType      ?? "",
    },
    note:     data.note,
    status:   data.status as SubmissionStatus,
    feedback: data.feedback,
    gradedBy: data.gradedBy,
    grade:    data.grade,
    isLate:   data.isLate ?? false,
    daysLate: data.daysLate,
    submittedAt:  (data.submittedAt as Timestamp).toDate(),
    reviewedAt:   data.reviewedAt  ? (data.reviewedAt  as Timestamp).toDate() : undefined,
    completedAt:  data.completedAt ? (data.completedAt as Timestamp).toDate() : undefined,
    updatedAt:    (data.updatedAt  as Timestamp).toDate(),
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createSubmission(data: SubmissionCreate): Promise<Submission> {
  // Mevcut iteration sayısını bul
  const existing = await adminDb.collection(COL)
    .where("studentId", "==", data.studentId)
    .where("taskId",    "==", data.taskId)
    .get();
  const iteration = existing.size + 1;

  const ref = adminDb.collection(COL).doc();
  await ref.set({
    ...data,
    iteration,
    status:      "submitted" as SubmissionStatus,
    submittedAt: FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submissions] Oluşturulan doc okunamadı: ${ref.id}`);
  return docToSubmission(ref.id, snap.data()!);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getSubmission(id: string): Promise<Submission | null> {
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  return docToSubmission(snap.id, snap.data()!);
}

export async function getTaskSubmissions(taskId: string): Promise<Submission[]> {
  const snap = await adminDb.collection(COL)
    .where("taskId", "==", taskId)
    .orderBy("submittedAt", "desc")
    .get();
  return snap.docs.map(d => docToSubmission(d.id, d.data()));
}

export async function getStudentSubmissions(studentId: string): Promise<Submission[]> {
  const snap = await adminDb.collection(COL)
    .where("studentId", "==", studentId)
    .orderBy("submittedAt", "desc")
    .get();
  return snap.docs.map(d => docToSubmission(d.id, d.data()));
}

export async function getStudentTaskSubmission(
  studentId: string,
  taskId: string,
): Promise<Submission | null> {
  const snap = await adminDb.collection(COL)
    .where("studentId", "==", studentId)
    .where("taskId",    "==", taskId)
    .orderBy("submittedAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return docToSubmission(snap.docs[0].id, snap.docs[0].data());
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateSubmission(id: string, update: SubmissionUpdate): Promise<void> {
  const ref  = adminDb.collection(COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submissions] Submission bulunamadı: ${id}`);
  await ref.update({ ...update, updatedAt: FieldValue.serverTimestamp() });
}

export async function updateSubmissionStatus(id: string, status: SubmissionStatus): Promise<void> {
  return updateSubmission(id, { status });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteSubmission(id: string): Promise<void> {
  const ref  = adminDb.collection(COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) { console.warn(`[submissions] Silinecek doc bulunamadı: ${id}`); return; }
  await ref.delete();
}
