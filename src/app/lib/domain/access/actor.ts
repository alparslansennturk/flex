import { resolvePackages, type PackageName } from "./packages";
import type { Actor, ActorType, Grant } from "./types";

export interface BuildActorInput {
  uid: string;
  tenantId: string;
  packages: PackageName[];
  groupIds?: string[]; // assigned scope (eğitmenin grupları)
  branchIds?: string[]; // branch scope
  trainerId?: string; // bkz. Actor.trainerId — Trainer.authUid'den çözülür
  type?: ActorType; // varsayılan "human"
  /** bkz. `ResolvePackagesOptions.standaloneMode` — eğitmen tek-başına anahtarı. */
  standaloneMode?: boolean;
  /** Paketten bağımsız, tekil (uid'e özel) grant'ler — ör. Görünüm Anahtarı sahibi. */
  extraGrants?: Grant[];
}

/** Paket adları + bağlamdan etkin Actor üretir (pure). */
export function buildActor(input: BuildActorInput): Actor {
  return {
    type: input.type ?? "human",
    uid: input.uid,
    tenantId: input.tenantId,
    grants: [...resolvePackages(input.packages, { standaloneMode: input.standaloneMode }), ...(input.extraGrants ?? [])],
    groupIds: input.groupIds,
    branchIds: input.branchIds,
    trainerId: input.trainerId,
  };
}
