import type { Actor } from "../access/types";
import { can } from "../access/can";
import { ForbiddenError, ValidationError } from "../errors";
import type {
  Campaign,
  CampaignDiscountType,
  CampaignScope,
  CampaignStatus,
} from "../eduos/campaign";
import type { CampaignRepo } from "../repo/campaign-repo";

export interface CreateCampaignInput {
  name: string;
  description?: string;
  scope: CampaignScope;
  discountType: CampaignDiscountType;
  discountValue: number;
  nthN?: number;
  startDate: string;
  endDate: string;
  status?: CampaignStatus;
}

export type UpdateCampaignInput = Partial<CreateCampaignInput>;

function validate(input: CreateCampaignInput) {
  if (!input.name?.trim()) throw new ValidationError("Kampanya adı zorunludur.");

  const st = input.scope?.type;
  if (!st || !["all", "branch", "education"].includes(st))
    throw new ValidationError("Geçersiz kapsam tipi.");
  if (st === "branch" && (!input.scope.branchIds || input.scope.branchIds.length === 0))
    throw new ValidationError("Branş seçimi zorunludur.");
  if (st === "education" && (!input.scope.educationIds || input.scope.educationIds.length === 0))
    throw new ValidationError("En az 1 eğitim seçmelisiniz.");

  if (!["percent", "fixed", "nth"].includes(input.discountType))
    throw new ValidationError("Geçersiz indirim tipi.");
  if (!input.discountValue || input.discountValue <= 0)
    throw new ValidationError("İndirim değeri 0'dan büyük olmalıdır.");
  if (
    (input.discountType === "percent" || input.discountType === "nth") &&
    input.discountValue > 100
  )
    throw new ValidationError("Yüzde indirim 100'ü geçemez.");
  if (input.discountType === "nth") {
    if (!input.nthN || input.nthN < 2)
      throw new ValidationError("N. alışveriş en az 2 olmalıdır.");
  }

  if (!input.startDate || !input.endDate)
    throw new ValidationError("Başlangıç ve bitiş tarihi zorunludur.");
  if (input.startDate > input.endDate)
    throw new ValidationError("Başlangıç tarihi bitiş tarihinden önce olmalıdır.");
}

export async function createCampaign(
  actor: Actor,
  input: CreateCampaignInput,
  repo: CampaignRepo,
): Promise<Campaign> {
  if (!can(actor, "campaign.create")) throw new ForbiddenError("campaign.create");
  validate(input);
  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    scope: input.scope,
    discountType: input.discountType,
    discountValue: input.discountValue,
    nthN: input.discountType === "nth" ? input.nthN : undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? "taslak",
    createdAt: now,
    createdBy: actor.uid,
  };
  await repo.save(campaign);
  return campaign;
}

export async function updateCampaign(
  actor: Actor,
  id: string,
  input: UpdateCampaignInput,
  repo: CampaignRepo,
): Promise<Campaign> {
  if (!can(actor, "campaign.edit")) throw new ForbiddenError("campaign.edit");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Kampanya bulunamadı.");

  const updated: Campaign = { ...existing };
  if (input.name !== undefined) updated.name = input.name.trim();
  if (input.description !== undefined) updated.description = input.description?.trim() || undefined;
  if (input.scope !== undefined) updated.scope = input.scope;
  if (input.discountType !== undefined) updated.discountType = input.discountType;
  if (input.discountValue !== undefined) updated.discountValue = input.discountValue;
  if (input.nthN !== undefined) updated.nthN = input.nthN;
  if (updated.discountType !== "nth") updated.nthN = undefined;
  if (input.startDate !== undefined) updated.startDate = input.startDate;
  if (input.endDate !== undefined) updated.endDate = input.endDate;
  if (input.status !== undefined) updated.status = input.status;
  updated.updatedAt = new Date().toISOString();
  updated.updatedBy = actor.uid;

  validate(updated as unknown as CreateCampaignInput);
  await repo.save(updated);
  return updated;
}

export async function deleteCampaign(
  actor: Actor,
  id: string,
  repo: CampaignRepo,
): Promise<void> {
  if (!can(actor, "campaign.delete")) throw new ForbiddenError("campaign.delete");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Kampanya bulunamadı.");
  await repo.delete(id, actor.tenantId);
}
