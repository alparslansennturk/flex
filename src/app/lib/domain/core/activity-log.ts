import type { EntityId, ISODateTime, TenantId } from "../base";

/**
 * EĞİTMEN GÜNLÜK İŞ LOGU — Ana Sayfa "En Son Aktiviteler" paneli için. CRM "Aktivite
 * Merkezi" (`repo/activity-repo.ts`, `flexos_activities` — satış/randevu/case) ile
 * KARIŞTIRILMASIN, tamamen ayrı bir kavram.
 *
 * MVP kapsamı sadece yoklama başlat/bitir + not verildi (2026-07-15 kararı). Genişletilebilir
 * union — ödev ver/sil/arşivle gibi türler istenirse aynı desenle eklenir.
 */
export type ActivityLogType = "attendance.started" | "attendance.updated" | "attendance.ended" | "grade.given";

export interface ActivityLogEntry {
  id: EntityId;
  tenantId: TenantId;
  trainerId: EntityId; // grubun eğitmeni — Ana Sayfa bunun akışını okur
  groupId: EntityId;
  type: ActivityLogType;
  title: string;
  description: string;
  createdAt: ISODateTime;
}
