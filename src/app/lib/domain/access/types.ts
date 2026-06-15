import type { TenantId } from "../base";

/**
 * Yetki omurgası — temel tipler.
 * Detaylı tasarım: `FLEXOS.md §3` (Capability & Yetki Modeli).
 */

/** Hassasiyet — audit, ekstra onay ve (ileride) AI gating'i belirler. */
export type Sensitivity = "green" | "yellow" | "red";

/** Kapsam ekseni — capability'yi şişirmez, ayrı taşınır. */
export type Scope = "self" | "assigned" | "branch" | "org";

/** Geniş → dar sıralama. org her şeyi kapsar. */
export const SCOPE_RANK: Record<Scope, number> = {
  self: 0,
  assigned: 1,
  branch: 2,
  org: 3,
};

/** Registry kaydı — yetki UI'ı + middleware + audit + (ileride) AI tool yüzeyini besler. */
export interface CapabilityDef {
  key: string; // "person.pii.write"
  domain: string; // "person"
  label: string; // TR — AI grounding
  description?: string;
  sensitivity: Sensitivity;
  write: boolean; // okuma mı yazma mı
  scopable: boolean; // scope ekseni uygulanır mı
  audited: boolean; // audit log'a düşer mi
}

/** İnsan da AI de aynı kapıdan geçer (FLEXOS.md §3.4). */
export type ActorType = "human" | "system" | "ai";

/** Tekil yetki ataması: bir capability + onun kapsamı. */
export interface Grant {
  capability: string;
  scope: Scope;
}

/** Eylemi yapan özne. Paketler `grants`'a çözülür. */
export interface Actor {
  type: ActorType;
  uid: string;
  tenantId: TenantId;
  grants: Grant[]; // paketlerden + tekil grant'lerden çözülmüş etkin yetkiler
  groupIds?: string[]; // assigned scope için (eğitmenin atanmış grupları)
  branchIds?: string[]; // branch scope için (şube müdürü vb.)
}

/** can() çağrısında hedef kayıt bağlamı (kayıt-özel scope kontrolü için). */
export interface AccessTarget {
  groupId?: string;
  branchId?: string;
  ownerUid?: string; // self scope: kaydın sahibi
}
