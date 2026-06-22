/**
 * Şube (fiziksel ofis) — sabit liste, STABİL ID'ler.
 *
 * NOT: "Şube" (office) ≠ "Branş" (branch/disiplin). Yetki katmanındaki
 * `branchId`/`branchIds`/`branch scope` ŞUBE içindir (ileride: kullanıcı kendi
 * şubesini görür). ID'ler stabil tutulur ki ileride `Actor.branchIds` ve
 * `can()` target.branchId ile eşleşsin — o zaman yeniden yazım gerekmez.
 *
 * İleride ayrı bir `flexos_branch_offices` koleksiyonu + yönetim UI'ına
 * yükseltilebilir; şimdilik sabit liste yeterli.
 */
export interface BranchOffice {
  id: string;
  name: string;
}

export const BRANCH_OFFICES: BranchOffice[] = [
  { id: "kadikoy", name: "Kadıköy" },
  { id: "pendik", name: "Pendik" },
  { id: "umraniye", name: "Ümraniye" },
  { id: "besiktas", name: "Beşiktaş" },
  { id: "sirinevler", name: "Şirinevler" },
];

const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  BRANCH_OFFICES.map((o) => [o.id, o.name]),
);

/** Şube id → görünen ad. Bilinmeyen id ise id'yi aynen döndürür. */
export function officeName(id?: string | null): string {
  if (!id) return "";
  return NAME_BY_ID[id] ?? id;
}
