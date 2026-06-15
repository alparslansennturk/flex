import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Branch } from "../eduos/branch";
import type { Education } from "../eduos/education";
import type { Track } from "../eduos/track";
import { ForbiddenError, ValidationError } from "../errors";
import type { BranchRepo, EducationRepo, TrackRepo } from "../repo/catalog-repo";

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

// ── Eğitim (Grafik-1) ──
export interface CreateEducationInput {
  name: string;
  branchId: EntityId;
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
    listPrice: input.listPrice,
    vatRate: input.vatRate,
    onSale: input.onSale,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await repo.save(education);
  return education;
}

// ── Track (Temel Photoshop) ──
export interface CreateTrackInput {
  name: string;
  educationId: EntityId;
  order?: number;
  hours?: number;
  listPrice?: number;
  sellable?: boolean;
}
export async function createTrack(actor: Actor, input: CreateTrackInput, repo: TrackRepo): Promise<Track> {
  if (!can(actor, "track.create")) throw new ForbiddenError("track.create");
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Track adı zorunludur.");
  if (!input.educationId) throw new ValidationError("educationId zorunludur.");
  const track: Track = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    educationId: input.educationId,
    name,
    order: input.order ?? 0,
    hours: input.hours,
    listPrice: input.listPrice,
    sellable: input.sellable,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await repo.save(track);
  return track;
}
