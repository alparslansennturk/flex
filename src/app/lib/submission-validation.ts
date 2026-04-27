// Server-side only (Admin SDK bağlamında kullanılır)

import { adminDb } from "./firebase-admin";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResult {
  uid:   string;
  email: string;
  role:  string;
  type:  string;
}

/**
 * Authorization: Bearer <token> header'ından kimliği doğrular.
 * Token geçersizse null döner — caller hard-fail uygulamalı.
 */
export async function verifyRequestToken(req: NextRequest): Promise<AuthResult | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token:   string       = authHeader.slice(7);
    const decoded: DecodedIdToken = await getAuth().verifyIdToken(token);
    return {
      uid:   decoded.uid,
      email: decoded.email ?? "",
      role:  (decoded.role  as string) ?? "",
      type:  (decoded.type  as string) ?? "",
    };
  } catch {
    return null;
  }
}

// ─── Submission checks ────────────────────────────────────────────────────────

/**
 * Submission'ın var olup olmadığını doğrular.
 * null dönerse 404 döndür.
 */
export async function fetchSubmission(submissionId: string) {
  const snap = await adminDb.collection("submissions").doc(submissionId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Record<string, unknown> & { id: string };
}

/**
 * groupId'nin submission'ın groupId'siyle eşleşip eşleşmediğini kontrol eder.
 * CRITICAL: grup manipülasyonunu engeller.
 */
export function validateSubmissionGroup(
  submissionGroupId: string,
  requestGroupId:    string,
): boolean {
  return submissionGroupId === requestGroupId;
}

/**
 * Öğrencinin gruba üye olup olmadığını kontrol eder.
 * students collection'da groupId field'ı var (mevcut yapı).
 * Yeni users için memberships collection da kontrol edilir.
 */
export async function validateUserInGroup(
  userId:  string,
  groupId: string,
): Promise<boolean> {
  // Mevcut students collection kontrolü
  const studentSnap = await adminDb
    .collection("students")
    .where("groupId", "==", groupId)
    .get();

  const studentMatch = studentSnap.docs.some(d => d.id === userId);
  if (studentMatch) return true;

  // Yeni memberships collection kontrolü (yeni kullanıcılar için)
  const memberSnap = await adminDb
    .collection("memberships")
    .where("userId",  "==", userId)
    .where("groupId", "==", groupId)
    .where("status",  "==", "active")
    .limit(1)
    .get();

  return !memberSnap.empty;
}

/**
 * Öğrenci yalnızca kendi submission'ına yorum/gönderim yapabilir.
 */
export function validateStudentOwnsSubmission(
  callerUid:   string,
  ownerUid:    string,
  callerRole:  string,
): boolean {
  if (callerRole !== "student") return true; // instructor/admin geçer
  return callerUid === ownerUid;
}

/**
 * Text boş olamaz.
 */
export function validateNonEmptyText(text: unknown): text is string {
  return typeof text === "string" && text.trim().length > 0;
}

/**
 * Score 0–100 arası olmalı.
 */
export function validateScore(score: unknown): boolean {
  if (score === undefined || score === null) return true; // opsiyonel alan
  return typeof score === "number" && score >= 0 && score <= 100;
}

/**
 * Assignment'ın var olup olmadığını ve groupId eşleştiğini kontrol eder.
 */
export async function validateAssignmentGroup(
  taskId:  string,
  groupId: string,
): Promise<{ valid: boolean; taskGroupId?: string }> {
  const snap = await adminDb.collection("tasks").doc(taskId).get();
  if (!snap.exists) return { valid: false };
  const taskGroupId = snap.data()?.groupId as string | undefined;
  // tasks koleksiyonunda groupId yoksa (global task) geçerli sayılır
  if (!taskGroupId) return { valid: true };
  return { valid: taskGroupId === groupId, taskGroupId };
}
