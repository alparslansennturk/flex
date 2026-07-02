import type { EntityId, ISODateTime } from "../base";

/**
 * Admin Kişisel Görünüm Anahtarı — mevcut mod (Core/Full) sunucu tarafında
 * kalıcı, çünkü artık kozmetik değil: Core'dayken sunucu owner'ı gerçekten
 * `egitmen` paketiyle çözer (bkz. auth-actor.ts). Doküman id = uid.
 */
export interface ViewModeState {
  uid: EntityId;
  mode: "core" | "full";
  updatedAt?: ISODateTime;
}
