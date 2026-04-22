/**
 * Firestore submission_files CRUD — Server-side (Admin SDK)
 * Versiyonlanmış dosya geçmişini yönetir.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type {
  SubmissionFileVersion,
  SubmissionFileCreate,
} from "@/app/types/submission-file";

const COL = "submission_files";

function docToFile(id: string, data: FirebaseFirestore.DocumentData): SubmissionFileVersion {
  return {
    id,
    submissionId: data.submissionId,
    studentId:    data.studentId,
    driveFileId:  data.driveFileId,
    fileUrl:      data.fileUrl,
    fileName:     data.fileName,
    fileSize:     data.fileSize ?? 0,
    versionNo:    data.versionNo ?? 1,
    isLatest:     data.isLatest ?? false,
    uploadedAt:   (data.uploadedAt as Timestamp).toDate(),
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createSubmissionFile(
  payload: SubmissionFileCreate,
): Promise<SubmissionFileVersion> {
  // Mevcut versiyonları bul
  const existing = await adminDb.collection(COL)
    .where("submissionId", "==", payload.submissionId)
    .orderBy("versionNo", "desc")
    .limit(1)
    .get();

  const versionNo = existing.empty ? 1 : (existing.docs[0].data().versionNo ?? 0) + 1;

  // Eski "isLatest" kayıtlarını temizle
  if (!existing.empty) {
    const batch = adminDb.batch();
    const outdated = await adminDb.collection(COL)
      .where("submissionId", "==", payload.submissionId)
      .where("isLatest", "==", true)
      .get();
    outdated.docs.forEach(d => batch.update(d.ref, { isLatest: false }));
    await batch.commit();
  }

  const ref = adminDb.collection(COL).doc();
  await ref.set({
    ...payload,
    versionNo,
    isLatest:   true,
    uploadedAt: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submission-files] Doc okunamadı: ${ref.id}`);
  return docToFile(ref.id, snap.data()!);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getSubmissionFiles(submissionId: string): Promise<SubmissionFileVersion[]> {
  const snap = await adminDb.collection(COL)
    .where("submissionId", "==", submissionId)
    .orderBy("versionNo", "asc")
    .get();
  return snap.docs.map(d => docToFile(d.id, d.data()));
}

export async function getLatestFile(submissionId: string): Promise<SubmissionFileVersion | null> {
  const snap = await adminDb.collection(COL)
    .where("submissionId", "==", submissionId)
    .where("isLatest", "==", true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return docToFile(snap.docs[0].id, snap.docs[0].data());
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function markAsLatest(fileId: string): Promise<void> {
  const ref  = adminDb.collection(COL).doc(fileId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submission-files] File bulunamadı: ${fileId}`);

  const submissionId = snap.data()!.submissionId as string;

  // Önce hepsini false yap, sonra bu kaydı true yap
  const batch = adminDb.batch();
  const all = await adminDb.collection(COL)
    .where("submissionId", "==", submissionId)
    .where("isLatest", "==", true)
    .get();
  all.docs.forEach(d => batch.update(d.ref, { isLatest: false }));
  batch.update(ref, { isLatest: true });
  await batch.commit();
}
