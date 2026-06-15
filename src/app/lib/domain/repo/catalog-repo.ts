import type { Branch } from "../eduos/branch";
import type { Education } from "../eduos/education";
import type { Track } from "../eduos/track";

/** Katalog PORT'ları (Branş/Eğitim/Track). Implementasyon: `server/catalog-repo.firestore.ts`. */
export interface BranchRepo {
  nextId(): string;
  save(branch: Branch): Promise<void>;
  getById(id: string, tenantId: string): Promise<Branch | null>;
}
export interface EducationRepo {
  nextId(): string;
  save(education: Education): Promise<void>;
  getById(id: string, tenantId: string): Promise<Education | null>;
}
export interface TrackRepo {
  nextId(): string;
  save(track: Track): Promise<void>;
  getById(id: string, tenantId: string): Promise<Track | null>;
}
