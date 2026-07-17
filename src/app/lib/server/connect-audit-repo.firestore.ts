// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { ConnectAuditEntry } from "../domain/core/connect-audit";
import type { ConnectAuditRepo } from "../domain/repo/connect-audit-repo";

// Connect'in kendi audit koleksiyonu — `connect_conversations`/`flexos_activity_log`
// hiçbirine dokunmaz, tamamen ayrı. Append-only: bu dosyada `.set()` DIŞINDA
// (update/delete) hiçbir metod yazılmaz.
const COLLECTION = "connect_audit";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreConnectAuditRepo: ConnectAuditRepo = {
  async create(entry) {
    await adminDb.collection(COLLECTION).doc(entry.id).set(clean(entry));
  },
};
