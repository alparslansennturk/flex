import { widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { SMBrand, SMFormat, SMSector, SocialPool } from "../core/social-pool";
import type { AssignmentTemplate } from "../core/assignment-template";
import { ForbiddenError, ValidationError } from "../errors";
import type { SocialPoolRepo } from "../repo/social-pool-repo";
import type { AssignmentTemplateRepo } from "../repo/assignment-template-repo";

const now = () => new Date().toISOString();

export interface SocialPoolData {
  brands: SMBrand[];
  sectors: SMSector[];
  formats: SMFormat[];
  globalPurposes: string[];
  sharedRule: string;
}

function validatePoolData(data: SocialPoolData): void {
  for (const b of data.brands) {
    if (!b.brandName?.trim()) throw new ValidationError("Marka adı boş olamaz.");
  }
  for (const s of data.sectors) {
    if (!s.name?.trim()) throw new ValidationError("Sektör adı boş olamaz.");
  }
}

/** Eğitmenin kendi havuz kopyası — yoksa null ("henüz Kütüphaneme Ekle'yi kullanmamış"). */
export async function getMySocialPool(actor: Actor, repo: SocialPoolRepo): Promise<SocialPool | null> {
  if (!widestScope(actor, "assignment.pool.manage")) throw new ForbiddenError("assignment.pool.manage");
  return repo.getByTrainer(actor.tenantId, actor.uid);
}

/** Tenant varsayılan havuzu — org scope (Kütüphaneme Ekle'nin tohum kaynağı). */
export async function getDefaultSocialPool(actor: Actor, repo: SocialPoolRepo): Promise<SocialPool | null> {
  if (widestScope(actor, "assignment.pool.manage") !== "org") throw new ForbiddenError("assignment.pool.manage");
  return repo.get(actor.tenantId);
}

/** Tenant varsayılan havuzunu yazar — org scope. */
export async function updateDefaultSocialPool(actor: Actor, data: SocialPoolData, repo: SocialPoolRepo): Promise<SocialPool> {
  if (widestScope(actor, "assignment.pool.manage") !== "org") throw new ForbiddenError("assignment.pool.manage");
  validatePoolData(data);
  const pool: SocialPool = {
    id: `${actor.tenantId}_default`,
    tenantId: actor.tenantId,
    ...data,
    updatedAt: now(),
    updatedBy: actor.uid,
  };
  await repo.save(pool);
  return pool;
}

/** Eğitmenin kendi havuz kopyasını yeniden yazar (tüm-alan-rewrite — `collage-pool-service.ts` ile aynı desen). */
export async function updateMySocialPool(actor: Actor, data: SocialPoolData, repo: SocialPoolRepo): Promise<SocialPool> {
  if (!widestScope(actor, "assignment.pool.manage")) throw new ForbiddenError("assignment.pool.manage");
  validatePoolData(data);
  const pool: SocialPool = {
    id: `${actor.tenantId}_${actor.uid}`,
    tenantId: actor.tenantId,
    trainerId: actor.uid,
    ...data,
    updatedAt: now(),
    updatedBy: actor.uid,
  };
  await repo.save(pool);
  return pool;
}

export interface SocialPoolDeps {
  pools: SocialPoolRepo;
  templates: AssignmentTemplateRepo;
}

/**
 * "Kütüphaneme Ekle" — `collage-pool-service.ts::addTemplateToPersonalLibrary` ile
 * birebir aynı desen, `gamifiedType: "sosyal"` şablonlar için. İDEMPOTENT.
 */
export async function addSocialTemplateToPersonalLibrary(
  actor: Actor,
  globalTemplateId: string,
  deps: SocialPoolDeps,
): Promise<AssignmentTemplate> {
  if (widestScope(actor, "template.manage") == null) throw new ForbiddenError("template.manage");

  const globalTemplate = await deps.templates.getById(globalTemplateId, actor.tenantId);
  if (!globalTemplate) throw new ValidationError("Şablon bulunamadı.");
  if (globalTemplate.scope !== "global" || globalTemplate.gamifiedType !== "sosyal") {
    throw new ValidationError("Bu şablon Global Kütüphane'ye eklenebilir bir Reklam Tasarımı şablonu değil.");
  }

  const myTemplates = await deps.templates.list(actor.tenantId);
  const existingClone = myTemplates.find(
    (t) => t.scope === "personal" && t.trainerId === actor.uid && t.sourceTemplateId === globalTemplateId,
  );
  if (existingClone) return existingClone;

  const clone: AssignmentTemplate = {
    id: deps.templates.nextId(),
    tenantId: actor.tenantId,
    scope: "personal",
    trainerId: actor.uid,
    sourceTemplateId: globalTemplateId,
    gamifiedType: globalTemplate.gamifiedType,
    branch: globalTemplate.branch,
    title: globalTemplate.title,
    subtitle: globalTemplate.subtitle,
    description: globalTemplate.description,
    icon: globalTemplate.icon,
    kind: globalTemplate.kind,
    maxPuan: globalTemplate.maxPuan,
    attachments: [],
    visible: true,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await deps.templates.save(clone);

  const defaultPool = await deps.pools.get(actor.tenantId);
  const seed: SocialPoolData = defaultPool
    ? JSON.parse(JSON.stringify({
        brands: defaultPool.brands,
        sectors: defaultPool.sectors,
        formats: defaultPool.formats,
        globalPurposes: defaultPool.globalPurposes,
        sharedRule: defaultPool.sharedRule,
      }))
    : { brands: [], sectors: [], formats: [], globalPurposes: [], sharedRule: "" };

  await deps.pools.save({
    id: `${actor.tenantId}_${actor.uid}`,
    tenantId: actor.tenantId,
    trainerId: actor.uid,
    ...seed,
    updatedAt: now(),
    updatedBy: actor.uid,
  });

  return clone;
}
