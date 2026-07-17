import type { ConnectAuditEntry } from "../core/connect-audit";

/**
 * Flex Connect Audit Log deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/connect-audit-repo.firestore.ts` (`connect_audit`).
 *
 * BİLİNÇLİ OLARAK sadece `create` sunar — update/delete metodu YOK (append-only
 * garantisi arayüz seviyesinde: derleyici zaten değiştirme/silme çağrısına izin
 * vermez). Firestore rules ayrıca `allow write: if false` ile client'ı keser.
 */
export interface ConnectAuditRepo {
  create(entry: ConnectAuditEntry): Promise<void>;
}
