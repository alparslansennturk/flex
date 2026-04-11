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
    studentId: data.studentId,
    taskId: data.taskId,
    groupId: data.groupId,
    fileUrl: data.fileUrl,
    driveFileId: data.driveFileId,
    driveViewLink: data.driveViewLink,
    fileName: data.fileName,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    status: data.status as SubmissionStatus,
    grade: data.grade,
    feedback: data.feedback,
    gradedBy: data.gradedBy,
    submittedAt: (data.submittedAt as Timestamp).toDate(),
    reviewedAt: data.reviewedAt ? (data.reviewedAt as Timestamp).toDate() : undefined,
    gradedAt: data.gradedAt ? (data.gradedAt as Timestamp).toDate() : undefined,
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Yeni teslim kaydı oluşturur.
 * status otomatik olarak 'pending' set edilir.
 * submittedAt ve updatedAt server-side FieldValue.serverTimestamp() ile set edilir.
 */
export async function createSubmission(data: SubmissionCreate): Promise<Submission> {
  const ref = adminDb.collection(COL).doc();

  const payload = {
    ...data,
    status: "pending" as SubmissionStatus,
    submittedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);

  // Taze snapshot al (serverTimestamp resolve edilmiş haliyle)
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`[submissions] Oluşturulan doc okunamadı: ${ref.id}`);
  }

  return docToSubmission(ref.id, snap.data()!);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Tek submission döner. Bulunamazsa null döner.
 */
export async function getSubmission(id: string): Promise<Submission | null> {
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  return docToSubmission(snap.id, snap.data()!);
}

/**
 * Belirli bir task'a ait tüm submission'ları döner.
 * submittedAt'e göre yeniden eskiye sıralı.
 */
export async function getTaskSubmissions(taskId: string): Promise<Submission[]> {
  const snap = await adminDb
    .collection(COL)
    .where("taskId", "==", taskId)
    .orderBy("submittedAt", "desc")
    .get();

  return snap.docs.map(doc => docToSubmission(doc.id, doc.data()));
}

/**
 * Belirli bir öğrenciye ait tüm submission'ları döner.
 * submittedAt'e göre yeniden eskiye sıralı.
 */
export async function getStudentSubmissions(studentId: string): Promise<Submission[]> {
  const snap = await adminDb
    .collection(COL)
    .where("studentId", "==", studentId)
    .orderBy("submittedAt", "desc")
    .get();

  return snap.docs.map(doc => docToSubmission(doc.id, doc.data()));
}

/**
 * Belirli bir öğrencinin belirli bir task için submission'ını döner.
 * Yoksa null döner.
 */
export async function getStudentTaskSubmission(
  studentId: string,
  taskId: string
): Promise<Submission | null> {
  const snap = await adminDb
    .collection(COL)
    .where("studentId", "==", studentId)
    .where("taskId", "==", taskId)
    .orderBy("submittedAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  return docToSubmission(snap.docs[0].id, snap.docs[0].data());
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Submission durumunu ve/veya not bilgilerini günceller.
 */
export async function updateSubmission(
  id: string,
  update: SubmissionUpdate
): Promise<void> {
  const ref = adminDb.collection(COL).doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`[submissions] Submission bulunamadı: ${id}`);
  }

  await ref.update({
    ...update,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Sadece status günceller (kısa yol).
 */
export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus
): Promise<void> {
  return updateSubmission(id, { status });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Firestore submission doc'unu siler.
 * Google Drive'daki dosyayı SİLMEZ — gerekirse Drive API ayrıca çağrılmalı.
 */
export async function deleteSubmission(id: string): Promise<void> {
  const ref = adminDb.collection(COL).doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    console.warn(`[submissions] Silinecek doc bulunamadı: ${id}`);
    return;
  }

  await ref.delete();
}
