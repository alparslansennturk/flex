import type { CollagePool } from "../core/collage-pool";

export interface CollagePoolRepo {
  /** Tenant varsayılanı (trainerId yok) — "Kütüphaneme Ekle" tohumu. */
  get(tenantId: string): Promise<CollagePool | null>;
  /** Eğitmenin kişisel kopyası (varsa). */
  getByTrainer(tenantId: string, trainerId: string): Promise<CollagePool | null>;
  save(pool: CollagePool): Promise<void>;
}
