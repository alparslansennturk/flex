import { resolvePackages, type PackageName } from "./packages";
import type { Actor, ActorType } from "./types";

export interface BuildActorInput {
  uid: string;
  tenantId: string;
  packages: PackageName[];
  groupIds?: string[]; // assigned scope (eğitmenin grupları)
  branchIds?: string[]; // branch scope
  type?: ActorType; // varsayılan "human"
}

/** Paket adları + bağlamdan etkin Actor üretir (pure). */
export function buildActor(input: BuildActorInput): Actor {
  return {
    type: input.type ?? "human",
    uid: input.uid,
    tenantId: input.tenantId,
    grants: resolvePackages(input.packages),
    groupIds: input.groupIds,
    branchIds: input.branchIds,
  };
}
