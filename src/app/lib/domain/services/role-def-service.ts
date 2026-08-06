import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { ISODateTime } from "../base";
import type { RoleDef } from "../core/role-def";
import { ALL_PERM_MODULE_KEYS, BUILT_IN_ROLE_SEEDS } from "../access/perm-modules";
import { ForbiddenError, ValidationError } from "../errors";
import type { RoleDefRepo } from "../repo/role-def-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

// `/^_+|_+$/g` alternatifi yerine doğrudan tarama: aynı sonucu (baştaki/sondaki
// alt çizgi bloklarını kırp) uzun alt çizgi dizilerinde ikinci dereceden
// backtracking olmadan üretir (Sonar S8786).
function trimUnderscoreEdges(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === "_") start++;
  while (end > start && s[end - 1] === "_") end--;
  return s.slice(start, end);
}

function slugify(label: string): string {
  const normalized = label
    .trim()
    .toLocaleLowerCase("tr")
    .replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ş", "s").replaceAll("ı", "i").replaceAll("ö", "o").replaceAll("ç", "c")
    .replaceAll(/[^a-z0-9]+/g, "_");
  return trimUnderscoreEdges(normalized);
}

/**
 * Rol listesi — okuma da `role.manage` ile gated (Kullanıcılar modülü zaten admin-only).
 * İlk çağrıda bu tenant'ta hiç rol yoksa 6 yerleşik rol otomatik tohumlanır — önceki
 * `kullanicilar/ekle`+`duzenle`'deki sabit kod davranışıyla BİREBİR aynı varsayılanlar,
 * hiçbir mevcut kullanıcı/rol ataması bozulmaz.
 */
export async function listRoleDefs(actor: Actor, repo: RoleDefRepo): Promise<RoleDef[]> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const existing = await repo.list(actor.tenantId);
  if (existing.length > 0) return existing;

  const ts = nowISO();
  const seeded: RoleDef[] = [];
  for (const s of BUILT_IN_ROLE_SEEDS) {
    const roleDef: RoleDef = {
      id: s.id,
      tenantId: actor.tenantId,
      label: s.label,
      description: s.description,
      color: s.color,
      permModules: s.permModules,
      isBuiltIn: true,
      createdAt: ts,
      createdBy: actor.uid,
    };
    await repo.save(roleDef);
    seeded.push(roleDef);
  }
  return seeded;
}

export interface CreateRoleDefInput {
  label: string;
  description?: string;
  color?: string;
  permModules?: string[];
  defaultAllBranches?: boolean;
}

/** Yeni (kurum-özel) rol tanımla — gated `role.manage`. */
export async function createRoleDef(actor: Actor, input: CreateRoleDefInput, repo: RoleDefRepo): Promise<RoleDef> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const label = input.label?.trim();
  if (!label) throw new ValidationError("Rol adı zorunludur.");

  const slug = slugify(label);
  if (!slug) throw new ValidationError("Geçerli bir rol adı girin.");
  const existing = await repo.getById(slug, actor.tenantId);
  if (existing) throw new ValidationError("Bu isimde bir rol zaten var.");

  const permModules = (input.permModules ?? []).filter((m) => ALL_PERM_MODULE_KEYS.includes(m));

  const roleDef: RoleDef = {
    id: slug,
    tenantId: actor.tenantId,
    label,
    description: input.description?.trim() || undefined,
    color: input.color || "#475569",
    permModules,
    isBuiltIn: false,
    defaultAllBranches: input.defaultAllBranches || undefined,
    createdAt: nowISO(),
    createdBy: actor.uid,
  };
  await repo.save(roleDef);
  return roleDef;
}

export interface UpdateRoleDefInput {
  label?: string;
  description?: string;
  color?: string;
  permModules?: string[];
  defaultAllBranches?: boolean;
}

/** Rol güncelle (yetki modülleri dahil) — gated `role.manage`. Yerleşik rollerde de
 * (ad hariç — id sabit kalır) yetki modülleri değiştirilebilir. */
export async function updateRoleDef(actor: Actor, id: string, input: UpdateRoleDefInput, repo: RoleDefRepo): Promise<RoleDef> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Rol bulunamadı.");

  const updated: RoleDef = { ...existing };
  if (input.label !== undefined && !existing.isBuiltIn) {
    const v = input.label.trim();
    if (!v) throw new ValidationError("Rol adı boş olamaz.");
    updated.label = v;
  }
  if (input.description !== undefined) updated.description = input.description.trim() || undefined;
  if (input.color !== undefined) updated.color = input.color;
  if (input.permModules !== undefined) {
    updated.permModules = input.permModules.filter((m) => ALL_PERM_MODULE_KEYS.includes(m));
  }
  if (input.defaultAllBranches !== undefined) {
    updated.defaultAllBranches = input.defaultAllBranches || undefined;
  }

  updated.updatedAt = nowISO();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return updated;
}
