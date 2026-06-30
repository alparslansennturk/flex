import type { EntityId, ISODateTime } from "../base";

/**
 * Kiracı-bazlı sistem anahtarları. Şimdilik tek anahtar: `standaloneMode`
 * (Eğitmen V2 — "tek başına eğitmen" switch'i, FLEXOS.md [[egitmen-v2-plan]]).
 *
 * standaloneMode = true  → eğitmen kendi grubunu/öğrencisini kendi açar (Flex Classroom).
 * standaloneMode = false → tam FlexOS entegre modu, Satış/Operasyon besler (varsayılan).
 */
export interface FlexosSettings {
  tenantId: EntityId; // doküman id'siyle aynı
  standaloneMode: boolean;
  updatedAt?: ISODateTime;
  updatedBy?: string;
}
