import type { Campaign } from "../eduos/campaign";

export interface CampaignRepo {
  nextId(): string;
  save(campaign: Campaign): Promise<void>;
  getById(id: string, tenantId: string): Promise<Campaign | null>;
  list(tenantId: string): Promise<Campaign[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
