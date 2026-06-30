import type { FlexosSettings } from "../core/settings";

export interface SettingsRepo {
  get(tenantId: string): Promise<FlexosSettings | null>;
  save(settings: FlexosSettings): Promise<void>;
}
