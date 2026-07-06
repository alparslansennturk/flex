import type { CertificateSettings } from "../education/certificate-settings";

export interface CertificateSettingsRepo {
  /** Tenant varsayılanı (trainerId yok). */
  get(tenantId: string): Promise<CertificateSettings | null>;
  /** Eğitmenin kişisel override'ı (varsa). */
  getByTrainer(tenantId: string, trainerId: string): Promise<CertificateSettings | null>;
  save(settings: CertificateSettings): Promise<void>;
}
