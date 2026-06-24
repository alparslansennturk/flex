import type { Payment } from "../eduos/payment";

/**
 * Payment deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/payment-repo.firestore.ts`.
 */
export interface PaymentRepo {
  nextId(): string;
  saveMany(payments: Payment[]): Promise<void>;
  listBySale(saleId: string, tenantId: string): Promise<Payment[]>;
  listByPerson(personId: string, tenantId: string): Promise<Payment[]>;
}
