import type { Trainer } from "../core/trainer";

/**
 * Trainer deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/trainer-repo.firestore.ts` (yeni `flexos_trainers` koleksiyonu).
 */
export interface TrainerRepo {
  nextId(): string;
  save(trainer: Trainer): Promise<void>;
  getById(id: string, tenantId: string): Promise<Trainer | null>;
  list(tenantId: string): Promise<Trainer[]>;
  delete(id: string, tenantId: string): Promise<void>;
  /** Firebase auth uid'ine göre ara (`Trainer.authUid`) — actor.uid → eğitmen kadrosu docId çözümü için. */
  findByAuthUid(authUid: string, tenantId: string): Promise<Trainer | null>;
}
