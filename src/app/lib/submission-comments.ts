/**
 * Firestore submission_comments CRUD — Server-side (Admin SDK)
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type {
  SubmissionComment,
  SubmissionCommentCreate,
} from "@/app/types/submission-comment";

const COL = "submission_comments";

function docToComment(id: string, data: FirebaseFirestore.DocumentData): SubmissionComment {
  return {
    id,
    submissionId: data.submissionId,
    authorId:     data.authorId,
    authorType:   data.authorType,
    text:         data.text,
    isRead:       data.isRead ?? false,
    order:        data.order  ?? 0,
    createdAt:    (data.createdAt as Timestamp).toDate(),
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createComment(
  submissionId: string,
  authorId:     string,
  authorType:   SubmissionCommentCreate["authorType"],
  text:         string,
): Promise<SubmissionComment> {
  // Sıradaki order numarasını bul
  const existing = await adminDb.collection(COL)
    .where("submissionId", "==", submissionId)
    .orderBy("order", "desc")
    .limit(1)
    .get();

  const order = existing.empty ? 1 : (existing.docs[0].data().order ?? 0) + 1;

  const ref = adminDb.collection(COL).doc();
  await ref.set({
    submissionId,
    authorId,
    authorType,
    text,
    isRead:    false,
    order,
    createdAt: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submission-comments] Doc okunamadı: ${ref.id}`);
  return docToComment(ref.id, snap.data()!);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getComments(submissionId: string): Promise<SubmissionComment[]> {
  const snap = await adminDb.collection(COL)
    .where("submissionId", "==", submissionId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map(d => docToComment(d.id, d.data()));
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function markCommentRead(commentId: string): Promise<void> {
  const ref  = adminDb.collection(COL).doc(commentId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`[submission-comments] Comment bulunamadı: ${commentId}`);
  await ref.update({ isRead: true });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteComment(commentId: string): Promise<void> {
  const ref  = adminDb.collection(COL).doc(commentId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.warn(`[submission-comments] Silinecek comment bulunamadı: ${commentId}`);
    return;
  }
  await ref.delete();
}
