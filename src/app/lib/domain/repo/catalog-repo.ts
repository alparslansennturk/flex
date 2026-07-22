import type { Branch } from "../eduos/branch";
import type { BranchOffice } from "../eduos/branch-office";
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
export interface BranchOfficeRepo {
  nextId(): string;
  save(office: BranchOffice): Promise<void>;
  getById(id: string, tenantId: string): Promise<BranchOffice | null>;
  list(tenantId: string): Promise<BranchOffice[]>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
export interface EducationRepo {
  nextId(): string;
  save(education: Education): Promise<void>;
  getById(id: string, tenantId: string): Promise<Education | null>;
  list(tenantId: string, branchId?: string): Promise<Education[]>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
export interface SectionRepo {
  nextId(): string;
  save(section: Section): Promise<void>;
  getById(id: string, tenantId: string): Promise<Section | null>;
  list(tenantId: string, educationId?: string): Promise<Section[]>;
  deleteByEducation(educationId: string, tenantId: string): Promise<number>;
}
export interface TrackRepo {
  nextId(): string;
  save(track: Track): Promise<void>;
  getById(id: string, tenantId: string): Promise<Track | null>;
  list(tenantId: string, educationId?: string): Promise<Track[]>;
  deleteByEducation(educationId: string, tenantId: string): Promise<number>;
}
