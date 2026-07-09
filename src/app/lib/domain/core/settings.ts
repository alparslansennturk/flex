import type { EntityId, ISODateTime } from "../base";

/**
 * Kiracı-bazlı sistem anahtarları (FLEXOS.md [[egitmen-v2-plan]], grup transferi kararı).
 *
 * standaloneMode = true  → eğitmen kendi grubunu/öğrencisini kendi açar (Flex Classroom).
 * standaloneMode = false → tam FlexOS entegre modu, Satış/Operasyon besler (varsayılan).
 *
 * transferRequiresManualSale = false (varsayılan) → grup taşıma `enrollment.transfer`
 *   yetkisiyle (Eğitim Op) doğrudan yapılır, sistem arkada otomatik 0 TL "ek satış" (Sale
 *   type:"transfer") açar. = true → taşıma yalnız `sale.create` yetkisiyle (Satış) yapılabilir
 *   — yani ek satış MANUEL Satış tarafından açılır ve öğrenci aynı işlemle taşınır. Her iki
 *   durumda da bir Sale kaydı (audit/satış logu) düşer.
 */
export interface FlexosSettings {
  tenantId: EntityId; // doküman id'siyle aynı
  standaloneMode: boolean;
  transferRequiresManualSale: boolean;
  updatedAt?: ISODateTime;
  updatedBy?: string;
}
