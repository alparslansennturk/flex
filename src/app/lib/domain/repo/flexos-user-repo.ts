import type { FlexosUser } from "../core/flexos-user";

export interface FlexosUserRepo {
  nextId(): string;
  save(user: FlexosUser): Promise<void>;
  getById(id: string, tenantId: string): Promise<FlexosUser | null>;
  getByEmail(email: string, tenantId: string): Promise<FlexosUser | null>;
  /** Firebase Auth uid'ine göre ara — login sonrası "hangi dashboard'a gitsin" için. */
  findByAuthUid(authUid: string, tenantId: string): Promise<FlexosUser | null>;
  /** Birden fazla auth uid'i tek seferde çözer (Flex Connect kimlik çözümleme — batch). */
  getByAuthUids(authUids: string[], tenantId: string): Promise<FlexosUser[]>;
  list(tenantId: string): Promise<FlexosUser[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
