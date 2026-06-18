import type { Branch } from "../eduos/branch";
import type { Education } from "../eduos/education";
import type { Section } from "../eduos/section";
import type { Track } from "../eduos/track";

/** Katalog PORT'ları (Branş/Eğitim/Bölüm/Track). Implementasyon: `server/catalog-repo.firestore.ts`. */
export interface BranchRepo {
  nextId(): string;
  save(branch: Branch): Promise<void>;
  getById(id: string, tenantId: string): Promise<Branch | null>;
  list(tenantId: string): Promise<Branch[]>;
}
export interface EducationRepo {
  nextId(): string;
  save(education: Education): Promise<void>;
  getById(id: string, tenantId: string): Promise<Education | null>;
  list(tenantId: string, branchId?: string): Promise<Education[]>;
}
export interface SectionRepo {
  nextId(): string;
  save(section: Section): Promise<void>;
  getById(id: string, tenantId: string): Promise<Section | null>;
  list(tenantId: string, educationId?: string): Promise<Section[]>;
}
export interface TrackRepo {
  nextId(): string;
  save(track: Track): Promise<void>;
  getById(id: string, tenantId: string): Promise<Track | null>;
  list(tenantId: string, educationId?: string): Promise<Track[]>;
}
