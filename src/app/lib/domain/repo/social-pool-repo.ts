import type { SocialPool } from "../core/social-pool";

export interface SocialPoolRepo {
  /** Tenant varsayılanı (trainerId yok) — "Kütüphaneme Ekle" tohumu. */
  get(tenantId: string): Promise<SocialPool | null>;
  /** Eğitmenin kişisel kopyası (varsa). */
  getByTrainer(tenantId: string, trainerId: string): Promise<SocialPool | null>;
  save(pool: SocialPool): Promise<void>;
}
