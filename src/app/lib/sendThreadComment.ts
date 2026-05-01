import { auth } from "@/app/lib/firebase";

interface SendCommentResult {
  ok: boolean;
  commentId?: string;
  error?: string;
}

// Özel thread yorumu — /api/comments/create üzerinden server-side write
// CLAIMS_STALE durumunda 1 kez force refresh + retry (aynı idempotencyKey)
export async function sendThreadComment(
  taskId:     string,
  studentId:  string,
  text:       string,
  authorName: string,
): Promise<SendCommentResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: "Oturum bulunamadı, sayfayı yenile." };

  const idempotencyKey = crypto.randomUUID();

  async function attempt(token: string): Promise<Response> {
    return fetch("/api/comments/create", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ taskId, studentId, text, authorName, idempotencyKey }),
    });
  }

  let token = await user.getIdToken();
  let res   = await attempt(token);

  // CLAIMS_STALE → force refresh + 1 retry
  if (res.status === 401) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data.error === "CLAIMS_STALE") {
      token = await user.getIdToken(true); // force refresh
      res   = await attempt(token);        // aynı idempotencyKey
    }
  }

  if (res.ok) {
    const data = await res.json() as { commentId?: string };
    return { ok: true, commentId: data.commentId };
  }

  const err = await res.json().catch(() => ({})) as { error?: string };
  return { ok: false, error: err.error ?? "Yorum gönderilemedi, tekrar dene." };
}
