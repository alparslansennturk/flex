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
    submissionId:  data.submissionId,
    studentId:     data.studentId,
    driveFileId:   data.driveFileId,
    driveViewLink: data.driveViewLink ?? "",
    fileUrl:       data.fileUrl,
    fileName:      data.fileName,
    fileSize:      data.fileSize ?? 0,
    mimeType:      data.mimeType ?? "",
    versionNo:     data.versionNo ?? 1,
    isLatest:      data.isLatest ?? false,
    uploadedAt:    (data.uploadedAt as Timestamp).toDate(),
    ...(data.deleted    ? { deleted: true }                                       : {}),
    ...(data.deletedBy  ? { deletedBy: data.deletedBy as string }                 : {}),
    ...(data.deletedAt  ? { deletedAt: (data.deletedAt as Timestamp).toDate() }   : {}),
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createSubmissionFile(
  payload: SubmissionFileCreate,
): Promise<SubmissionFileVersion> {
  // Mevcut versiyonları bul — orderBy yok (FAILED_PRECONDITION riski), JS sort kullan
  const existing = await adminDb.collection(COL)
    .where("submissionId", "==", payload.submissionId)
    .get();

  const maxVersion = existing.empty
    ? 0
    : Math.max(...existing.docs.map(d => d.data().versionNo ?? 0));
  const versionNo = maxVersion + 1;

  // Eski "isLatest" kayıtlarını temizle
  if (!existing.empty) {
    const batch = adminDb.batch();
    existing.docs
      .filter(d => d.data().isLatest === true)
      .forEach(d => batch.update(d.ref, { isLatest: false }));
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

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Dosyayı soft-delete yapar (Drive silme ayrıca yapılır).
 * Audit trail için kayıt korunur, isLatest=false olur.
 */
export async function softDeleteFile(fileId: string, deletedBy: string): Promise<void> {
  const ref  = adminDb.collection(COL).doc(fileId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submission-files] Silinecek file bulunamadı: ${fileId}`);

  const batch = adminDb.batch();

  // Eğer isLatest ise bir önceki silinmemiş versiyonu latest yap
  if (snap.data()!.isLatest) {
    const submissionId = snap.data()!.submissionId as string;
    const allFiles = await adminDb.collection(COL)
      .where("submissionId", "==", submissionId)
      .get();

    // Silinmemiş + bu dosya olmayan en yüksek versionNo'lu kaydı bul
    const candidate = allFiles.docs
      .filter(d => d.id !== fileId && !d.data().deleted)
      .sort((a, b) => (b.data().versionNo ?? 0) - (a.data().versionNo ?? 0))[0];

    if (candidate) batch.update(candidate.ref, { isLatest: true });
  }

  batch.update(ref, {
    deleted:   true,
    deletedBy,
    deletedAt: FieldValue.serverTimestamp(),
    isLatest:  false,
  });

  await batch.commit();
}

/**
 * Bir submission'ın silinmemiş dosya sayısını döner (upload limit için).
 */
export async function getActiveFileCount(submissionId: string): Promise<number> {
  const snap = await adminDb.collection(COL)
    .where("submissionId", "==", submissionId)
    .where("deleted", "!=", true)
    .get();
  return snap.size;
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
