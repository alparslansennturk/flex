import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Branch } from "../eduos/branch";
import type { BranchOffice } from "../eduos/branch-office";
import type { CertificateRule, DeliveryOption, Education } from "../eduos/education";
import type { Section } from "../eduos/section";
import type { Track } from "../eduos/track";
import { ForbiddenError, ValidationError } from "../errors";
import type { BranchOfficeRepo, BranchRepo, EducationRepo, SectionRepo, TrackRepo } from "../repo/catalog-repo";
import type { GroupRepo } from "../repo/group-repo";

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

// ── Şube (fiziksel ofis — Kadıköy, Pendik…) ──
export interface CreateBranchOfficeInput {
  name: string;
  order?: number;
}
export async function createBranchOffice(actor: Actor, input: CreateBranchOfficeInput, repo: BranchOfficeRepo): Promise<BranchOffice> {
  if (!can(actor, "office.create")) throw new ForbiddenError("office.create");
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Şube adı zorunludur.");
  const office: BranchOffice = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name,
    order: input.order,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await repo.save(office);
  return office;
}

export interface UpdateBranchOfficeInput {
  name?: string;
  order?: number;
}
export async function updateBranchOffice(actor: Actor, id: EntityId, patch: UpdateBranchOfficeInput, repo: BranchOfficeRepo): Promise<BranchOffice> {
  if (!can(actor, "office.edit")) throw new ForbiddenError("office.edit");
  if (!id) throw new ValidationError("id zorunludur.");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Şube bulunamadı.");
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError("Şube adı boş olamaz.");
  const updated: BranchOffice = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.order !== undefined ? { order: patch.order } : {}),
    updatedAt: now(),
    updatedBy: actor.uid,
  };
  await repo.save(updated);
  return updated;
}

export interface DeleteBranchOfficeDeps {
  offices: BranchOfficeRepo;
  groups: GroupRepo;
}
export async function deleteBranchOffice(actor: Actor, id: EntityId, deps: DeleteBranchOfficeDeps): Promise<void> {
  if (!can(actor, "office.edit")) throw new ForbiddenError("office.edit");
  if (!id) throw new ValidationError("id zorunludur.");
  const existing = await deps.offices.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Şube bulunamadı.");
  const allGroups = await deps.groups.list(actor.tenantId);
  const inUse = allGroups.filter((g) => g.branchOfficeId === id && g.status !== "completed" && g.status !== "archived");
  if (inUse.length > 0) {
    throw new ValidationError(`Bu şubeye bağlı ${inUse.length} aktif grup var. Önce grupların şubesini değiştirin.`);
  }
  const ok = await deps.offices.delete(id, actor.tenantId);
  if (!ok) throw new ValidationError("Şube silinemedi.");
}

// ── Eğitim (Grafik Tasarım Kursu) ──
export interface CreateEducationInput {
  name: string;
  mebName?: string;
  branchId: EntityId;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned";
  outline?: string[];
  deliveryMode?: "in_person" | "online" | "hybrid";
  contractType?: string;
  salesModel?: string;
  totalHours?: number;
  listPrice?: number;
  vatRate?: number;
  onSale?: boolean;
  certType?: "exam" | "project";
  deliveryOptions?: DeliveryOption[];
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
    mebName: input.mebName?.trim() || undefined,
    branchId: input.branchId,
    audience: input.audience ?? "individual",
    structure: input.structure ?? "single",
    outline: input.outline,
    deliveryMode: input.deliveryMode,
    contractType: input.contractType,
    salesModel: input.salesModel,
    totalHours: input.totalHours,
    listPrice: input.listPrice,
    vatRate: input.vatRate,
    onSale: input.onSale,
    deliveryOptions: input.deliveryOptions,
    certType: input.certType,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await repo.save(education);
  return education;
}

// ── Eğitim güncelle (kısmi — Taslak↔Satışta dahil) ──
export interface UpdateEducationInput {
  name?: string;
  mebName?: string;
  branchId?: EntityId;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned";
  outline?: string[];
  deliveryMode?: "in_person" | "online" | "hybrid";
  contractType?: string;
  salesModel?: string;
  totalHours?: number | null;
  listPrice?: number | null;
  vatRate?: number;
  onSale?: boolean;
  certType?: "exam" | "project";
  deliveryOptions?: DeliveryOption[] | null;
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
    ...(patch.mebName !== undefined ? { mebName: patch.mebName.trim() || undefined } : {}),
    ...(patch.branchId !== undefined ? { branchId: patch.branchId } : {}),
    ...(patch.audience !== undefined ? { audience: patch.audience } : {}),
    ...(patch.structure !== undefined ? { structure: patch.structure } : {}),
    ...(patch.outline !== undefined ? { outline: patch.outline } : {}),
    ...(patch.deliveryMode !== undefined ? { deliveryMode: patch.deliveryMode } : {}),
    ...(patch.contractType !== undefined ? { contractType: patch.contractType } : {}),
    ...(patch.salesModel !== undefined ? { salesModel: patch.salesModel } : {}),
    ...(patch.totalHours !== undefined ? { totalHours: patch.totalHours ?? undefined } : {}),
    ...(patch.listPrice !== undefined ? { listPrice: patch.listPrice ?? undefined } : {}),
    ...(patch.vatRate !== undefined ? { vatRate: patch.vatRate } : {}),
    ...(patch.onSale !== undefined ? { onSale: patch.onSale } : {}),
    ...(patch.deliveryOptions !== undefined ? { deliveryOptions: patch.deliveryOptions ?? undefined } : {}),
    ...(patch.certType !== undefined ? { certType: patch.certType } : {}),
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

// ── Eğitim sil (cascade: sections + tracks da silinir) ──
export interface DeleteEducationDeps {
  educations: EducationRepo;
  sections: SectionRepo;
  tracks: TrackRepo;
}
export async function deleteEducation(actor: Actor, id: EntityId, deps: DeleteEducationDeps): Promise<void> {
  if (!can(actor, "education.edit")) throw new ForbiddenError("education.edit");
  if (!id) throw new ValidationError("id zorunludur.");
  const existing = await deps.educations.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Eğitim bulunamadı.");
  // Cascade: önce tracks, sonra sections, sonra education
  await deps.tracks.deleteByEducation(id, actor.tenantId);
  await deps.sections.deleteByEducation(id, actor.tenantId);
  await deps.educations.delete(id, actor.tenantId);
}

// ── İçerik senkronizasyonu (düzenleme: sil+yeniden-oluştur) ──
export interface SyncContentSectionInput {
  name: string;
  order: number;
  hours?: number;
  listPrice?: number;
  sellable?: boolean;
  tracks: Array<{
    name: string;
    order: number;
    hours?: number;
    listPrice?: number;
    sellable?: boolean;
  }>;
}
export interface SyncContentDeps {
  sections: SectionRepo;
  tracks: TrackRepo;
  educations: EducationRepo;
}
/**
 * Bir eğitimin tüm bölüm/track içeriğini yeni ağaçla değiştirir (delete-all + recreate).
 * capability: `education.edit` (mevcut bölüm/track oluşturma da bunun parçası).
 */
export async function syncEducationContent(
  actor: Actor,
  educationId: EntityId,
  sections: SyncContentSectionInput[],
  deps: SyncContentDeps,
): Promise<{ sections: Section[]; tracks: Track[] }> {
  if (!can(actor, "education.edit")) throw new ForbiddenError("education.edit");
  if (!educationId) throw new ValidationError("educationId zorunludur.");
  const edu = await deps.educations.getById(educationId, actor.tenantId);
  if (!edu) throw new ValidationError("Eğitim bulunamadı.");

  // 1) Mevcut bölüm/track'leri sil
  await deps.tracks.deleteByEducation(educationId, actor.tenantId);
  await deps.sections.deleteByEducation(educationId, actor.tenantId);

  // 2) Yeni ağacı oluştur
  const createdSections: Section[] = [];
  const createdTracks: Track[] = [];

  for (const secInput of sections) {
    const section: Section = {
      id: deps.sections.nextId(),
      tenantId: actor.tenantId,
      educationId,
      name: secInput.name.trim(),
      order: secInput.order,
      hours: secInput.hours,
      listPrice: secInput.listPrice,
      sellable: secInput.sellable,
      createdAt: now(),
      createdBy: actor.uid,
    };
    await deps.sections.save(section);
    createdSections.push(section);

    for (const trkInput of secInput.tracks) {
      const track: Track = {
        id: deps.tracks.nextId(),
        tenantId: actor.tenantId,
        educationId,
        sectionId: section.id,
        name: trkInput.name.trim(),
        order: trkInput.order,
        hours: trkInput.hours,
        listPrice: trkInput.listPrice,
        sellable: trkInput.sellable,
        createdAt: now(),
        createdBy: actor.uid,
      };
      await deps.tracks.save(track);
      createdTracks.push(track);
    }
  }

  return { sections: createdSections, tracks: createdTracks };
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
