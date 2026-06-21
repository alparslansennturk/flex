import type { Audit, EntityId, TenantId } from "../base";

/**
 * FlexOS — SEANS: haftalık ders kalıbı (gün + saat aralığı).
 * Grup açarken seçilir. Yoklama tarihi, eğitmen çakışma kontrolü
 * ve takvim slot'u bu yapısal veriden hesaplanır.
 *
 *   days:      number[]  — 0=Pazartesi … 6=Pazar (ISO weekday - 1)
 *   startTime: "HH:MM"   — 24h format
 *   endTime:   "HH:MM"   — 24h format
 */
export interface Seans extends Audit {
  id: EntityId;
  tenantId: TenantId;
  days: number[];       // 0=Pts, 1=Sal, 2=Çrş, 3=Prş, 4=Cum, 5=Cts, 6=Paz
  startTime: string;    // "HH:MM"
  endTime: string;      // "HH:MM"
}
