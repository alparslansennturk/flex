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
  /** Bir eğitmenin tüm kayıtları (opsiyonel ay filtresi) — Yoklama Raporu filtresi için. */
  listByTrainer(trainerId: string, tenantId: string, month?: string): Promise<Attendance[]>;
  /** Bir ayın TÜM kayıtları (grup/eğitmen filtresi yokken) — Yoklama Raporu için. */
  listByMonth(tenantId: string, month: string): Promise<Attendance[]>;
  /** Bir tarih aralığındaki TÜM kayıtlar — Yoklama Raporu'nun asıl kullandığı filtre
   * (`from`/`to`, çoklu-ay arama çubuğu). `date` alanı üzerinde composite index gerekir
   * (bkz. `firestore.indexes.json`). */
  listByDateRange(tenantId: string, from: string, to: string): Promise<Attendance[]>;
  /** Kiracının TÜM kayıtları — SADECE hiçbir filtre verilmediğinde (nadir, pahalı yol —
   * Yoklama Raporu ekranı ASLA filtresiz çağırmaz, bkz. `attendance/report/route.ts`). */
  list(tenantId: string): Promise<Attendance[]>;
  /** Kaydı sil ("İptal" — Dersi Başlat'ı geri alma, sadece kapatılmamış kayıtlarda). */
  delete(id: string, tenantId: string): Promise<void>;
}
