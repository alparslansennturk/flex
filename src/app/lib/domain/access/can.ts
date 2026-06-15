import type { AccessTarget, Actor, Scope } from "./types";
import { SCOPE_RANK } from "./types";

/**
 * Yetki kararı — tek karar noktası (FLEXOS.md §3, §4.7).
 * İleride `executeAction()` bunu çağırır; insan da AI de aynı kapıdan geçer.
 *
 * Kullanım:
 *  - Form alanı çizilsin mi?     can(actor, "person.pii.write")          (hedefsiz)
 *  - Bu kaydı düzenleyebilir mi? can(actor, "grade.write", { groupId })  (hedefli)
 */
export function can(actor: Actor, capability: string, target?: AccessTarget): boolean {
  const grants = actor.grants.filter((g) => g.capability === capability);
  if (grants.length === 0) return false;
  return grants.some((g) => scopeSatisfied(actor, g.scope, target));
}

/**
 * Aktörün bir capability'yi HİÇ taşıyıp taşımadığı (hedef bakmadan).
 * Form/menü görünürlüğü için pratik kestirme — "bunu hiç yapabilir mi?".
 */
export function hasCapability(actor: Actor, capability: string): boolean {
  return actor.grants.some((g) => g.capability === capability);
}

/** Aktörün bir capability için sahip olduğu EN GENİŞ scope (yoksa null). */
export function widestScope(actor: Actor, capability: string): Scope | null {
  let best: Scope | null = null;
  for (const g of actor.grants) {
    if (g.capability !== capability) continue;
    if (best === null || SCOPE_RANK[g.scope] > SCOPE_RANK[best]) best = g.scope;
  }
  return best;
}

function scopeSatisfied(actor: Actor, scope: Scope, target?: AccessTarget): boolean {
  switch (scope) {
    case "org":
      return true;
    case "branch":
      // Hedef belirtilmemişse (örn. "yeni kayıt formu") izin ver; kayıt-özelse şube eşleşmeli.
      if (!target?.branchId) return true;
      return !!actor.branchIds?.includes(target.branchId);
    case "assigned":
      if (!target?.groupId) return true;
      return !!actor.groupIds?.includes(target.groupId);
    case "self":
      // self her zaman somut bir sahip ister.
      return !!target?.ownerUid && target.ownerUid === actor.uid;
    default:
      return false;
  }
}
