import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Branch } from "../eduos/branch";
import type { CertificateRule, Education } from "../eduos/education";
import type { Section } from "../eduos/section";
import type { Track } from "../eduos/track";
import { ForbiddenError, ValidationError } from "../errors";
import type { BranchRepo, EducationRepo, SectionRepo, TrackRepo } from "../repo/catalog-repo";

const now = (): ISODateTime => new Date().toISOString();

// ── Branş ──
export interface CreateBranchInput {
  name: string;
  slug?: string;
  order?: number;
}
export async function createBranch(actor: Actor, input: CreateBranchInput, repo: BranchRepo): Promise<Branch> {
  if (!can(actor, "branch.create")) throw new ForbiddenError("branch.create");
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Branş adı zorunludur.");
  const branch: Branch = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name,
    slug: input.slug,
    order: input.order,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await repo.save(branch);
  return branch;
}

// ── Eğitim (Grafik Tasarım Kursu) ──
export interface CreateEducationInput {
  name: string;
  branchId: EntityId;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned";
  outline?: string[];
  listPrice?: number;
  vatRate?: number;
  onSale?: boolean;
}
export async function createEducation(actor: Actor, input: CreateEducationInput, repo: EducationRepo): Promise<Education> {
  if (!can(actor, "education.create")) throw new ForbiddenError("education.create");
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Eğitim adı zorunludur.");
  if (!input.branchId) throw new ValidationError("branchId zorunludur.");
  const education: Education = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name,
    branchId: input.branchId,
    audience: input.audience ?? "individual",
    structure: input.structure ?? "single",
    outline: input.outline,
    listPrice: input.listPrice,
    vatRate: input.vatRate,
    onSale: input.onSale,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await repo.save(education);
  return education;
}

// ── Eğitim güncelle (kısmi — Taslak↔Satışta dahil) ──
export interface UpdateEducationInput {
  name?: string;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned";
  outline?: string[];
  listPrice?: number;
  vatRate?: number;
  onSale?: boolean;
}
export async function updateEducation(actor: Actor, id: EntityId, patch: UpdateEducationInput, repo: EducationRepo): Promise<Education> {
  if (!can(actor, "education.edit")) throw new ForbiddenError("education.edit");
  if (!id) throw new ValidationError("id zorunludur.");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Eğitim bulunamadı.");
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError("Eğitim adı boş olamaz.");
  const updated: Education = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.audience !== undefined ? { audience: patch.audience } : {}),
    ...(patch.structure !== undefined ? { structure: patch.structure } : {}),
    ...(patch.outline !== undefined ? { outline: patch.outline } : {}),
    ...(patch.listPrice !== undefined ? { listPrice: patch.listPrice } : {}),
    ...(patch.vatRate !== undefined ? { vatRate: patch.vatRate } : {}),
    ...(patch.onSale !== undefined ? { onSale: patch.onSale } : {}),
    updatedAt: now(),
    updatedBy: actor.uid,
  };
  await repo.save(updated);
  return updated;
}

// ── Bölüm (Grafik-1) ──
export interface CreateSectionInput {
  name: string;
  educationId: EntityId;
  order?: number;
  hours?: number;
  listPrice?: number;
  sellable?: boolean;
  certificateRules?: CertificateRule[];
}
/** Bölüm oluşturma deps: `educations` verilirse eğitim varlığı doğrulanır. */
export interface CreateSectionDeps {
  sections: SectionRepo;
  educations?: EducationRepo;
}
export async function createSection(actor: Actor, input: CreateSectionInput, deps: CreateSectionDeps): Promise<Section> {
  if (!can(actor, "section.create")) throw new ForbiddenError("section.create");
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Bölüm adı zorunludur.");
  if (!input.educationId) throw new ValidationError("educationId zorunludur.");
  if (deps.educations) {
    const edu = await deps.educations.getById(input.educationId, actor.tenantId);
    if (!edu) throw new ValidationError("Seçilen eğitim bulunamadı.");
  }
  const section: Section = {
    id: deps.sections.nextId(),
    tenantId: actor.tenantId,
    educationId: input.educationId,
    name,
    order: input.order ?? 0,
    hours: input.hours,
    listPrice: input.listPrice,
    sellable: input.sellable,
    certificateRules: input.certificateRules,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await deps.sections.save(section);
  return section;
}

// ── Track (Temel Photoshop) ──
export interface CreateTrackInput {
  name: string;
  educationId: EntityId;
  sectionId?: EntityId;
  order?: number;
  hours?: number;
  listPrice?: number;
  sellable?: boolean;
}
/** Track oluşturma deps: `sections` verilirse Bölüm varlığı + eğitime bağlılığı doğrulanır. */
export interface CreateTrackDeps {
  tracks: TrackRepo;
  sections?: SectionRepo;
}
export async function createTrack(actor: Actor, input: CreateTrackInput, deps: CreateTrackDeps): Promise<Track> {
  if (!can(actor, "track.create")) throw new ForbiddenError("track.create");
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Track adı zorunludur.");
  if (!input.educationId) throw new ValidationError("educationId zorunludur.");
  if (input.sectionId && deps.sections) {
    const section = await deps.sections.getById(input.sectionId, actor.tenantId);
    if (!section) throw new ValidationError("Seçilen bölüm bulunamadı.");
    if (section.educationId !== input.educationId) {
      throw new ValidationError("Seçilen bölüm, seçilen eğitime bağlı değil.");
    }
  }
  const track: Track = {
    id: deps.tracks.nextId(),
    tenantId: actor.tenantId,
    educationId: input.educationId,
    sectionId: input.sectionId,
    name,
    order: input.order ?? 0,
    hours: input.hours,
    listPrice: input.listPrice,
    sellable: input.sellable,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await deps.tracks.save(track);
  return track;
}
