import type { EntityId, ISODateTime } from "../base";

/**
 * Geliştirici Notları (2026-07-25) — tamamen dahili, ürünün gerçek domain'iyle
 * hiçbir ilişkisi yok. Sadece owner (`view.toggle` capability'si — auth-actor.ts
 * VIEW_TOGGLE_OWNER_EMAIL) görür/yazar; "kullanırken bulduğum hatayı hemen not
 * al, Claude oradan okuyup kapatsın" akışı için basit bir CRUD.
 */
export type DevNotePriority = "dusuk" | "orta" | "yuksek";
export type DevNoteStatus = "acik" | "cozuldu";

export interface DevNote {
  id: EntityId;
  title: string;
  description: string;
  module: string;
  priority: DevNotePriority;
  status: DevNoteStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
