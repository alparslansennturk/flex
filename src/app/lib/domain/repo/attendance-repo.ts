import type { Attendance } from "../core/attendance";

/**
 * Attendance deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/attendance-repo.firestore.ts` (yeni `flexos_attendance` koleksiyonu).
 */
export interface AttendanceRepo {
  save(record: Attendance): Promise<void>;
  getById(id: string, tenantId: string): Promise<Attendance | null>;
  getByGroupAndDate(groupId: string, date: string, tenantId: string): Promise<Attendance | null>;
  /** Bir grubun tüm kayıtları (opsiyonel ay filtresi — takvim/aylık sayaç için). */
  listByGroup(groupId: string, tenantId: string, month?: string): Promise<Attendance[]>;
  /** Kiracının TÜM kayıtları — Yoklama Raporu (Op/Finans) için. */
  list(tenantId: string): Promise<Attendance[]>;
}
