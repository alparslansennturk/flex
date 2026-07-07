import type { BookPool } from "../core/book-pool";

export interface BookPoolRepo {
  /** Tenant varsayılanı (trainerId yok) — "Kütüphaneme Ekle" tohumu. */
  get(tenantId: string): Promise<BookPool | null>;
  /** Eğitmenin kişisel kopyası (varsa). */
  getByTrainer(tenantId: string, trainerId: string): Promise<BookPool | null>;
  save(pool: BookPool): Promise<void>;
}
