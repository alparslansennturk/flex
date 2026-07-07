import { widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { BookItem, BookPool } from "../core/book-pool";
import type { AssignmentTemplate } from "../core/assignment-template";
import { ForbiddenError, ValidationError } from "../errors";
import type { BookPoolRepo } from "../repo/book-pool-repo";
import type { AssignmentTemplateRepo } from "../repo/assignment-template-repo";

const now = () => new Date().toISOString();

function validateItems(items: BookItem[]): void {
  for (const it of items) {
    if (!it.title?.trim()) throw new ValidationError("Kitap adı boş olamaz.");
    if (!it.author?.trim()) throw new ValidationError("Yazar adı boş olamaz.");
  }
}

/** Eğitmenin kendi havuz kopyası — yoksa null ("henüz Kütüphaneme Ekle'yi kullanmamış"). */
export async function getMyBookPool(actor: Actor, repo: BookPoolRepo): Promise<BookPool | null> {
  if (!widestScope(actor, "assignment.pool.manage")) throw new ForbiddenError("assignment.pool.manage");
  return repo.getByTrainer(actor.tenantId, actor.uid);
}

/** Tenant varsayılan havuzu — org scope (Kütüphaneme Ekle'nin tohum kaynağı). */
export async function getDefaultBookPool(actor: Actor, repo: BookPoolRepo): Promise<BookPool | null> {
  if (widestScope(actor, "assignment.pool.manage") !== "org") throw new ForbiddenError("assignment.pool.manage");
  return repo.get(actor.tenantId);
}

/** Tenant varsayılan havuzunu yazar — org scope. */
export async function updateDefaultBookPool(actor: Actor, items: BookItem[], repo: BookPoolRepo): Promise<BookPool> {
  if (widestScope(actor, "assignment.pool.manage") !== "org") throw new ForbiddenError("assignment.pool.manage");
  validateItems(items);
  const pool: BookPool = {
    id: `${actor.tenantId}_default`,
    tenantId: actor.tenantId,
    items,
    updatedAt: now(),
    updatedBy: actor.uid,
  };
  await repo.save(pool);
  return pool;
}

/** Eğitmenin kendi havuz kopyasını yeniden yazar (tüm-array-rewrite — `collage-pool-service.ts` ile aynı desen). */
export async function updateMyBookPool(actor: Actor, items: BookItem[], repo: BookPoolRepo): Promise<BookPool> {
  if (!widestScope(actor, "assignment.pool.manage")) throw new ForbiddenError("assignment.pool.manage");
  validateItems(items);
  const pool: BookPool = {
    id: `${actor.tenantId}_${actor.uid}`,
    tenantId: actor.tenantId,
    trainerId: actor.uid,
    items,
    updatedAt: now(),
    updatedBy: actor.uid,
  };
  await repo.save(pool);
  return pool;
}

export interface BookPoolDeps {
  pools: BookPoolRepo;
  templates: AssignmentTemplateRepo;
}

/**
 * "Kütüphaneme Ekle" — `collage-pool-service.ts::addTemplateToPersonalLibrary` ile
 * birebir aynı desen, `gamifiedType: "kitap"` şablonlar için. İDEMPOTENT.
 */
export async function addBookTemplateToPersonalLibrary(
  actor: Actor,
  globalTemplateId: string,
  deps: BookPoolDeps,
): Promise<AssignmentTemplate> {
  if (widestScope(actor, "template.manage") == null) throw new ForbiddenError("template.manage");

  const globalTemplate = await deps.templates.getById(globalTemplateId, actor.tenantId);
  if (!globalTemplate) throw new ValidationError("Şablon bulunamadı.");
  if (globalTemplate.scope !== "global" || globalTemplate.gamifiedType !== "kitap") {
    throw new ValidationError("Bu şablon Global Kütüphane'ye eklenebilir bir Kitap Dünyası şablonu değil.");
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
  const seedItems: BookItem[] = defaultPool ? JSON.parse(JSON.stringify(defaultPool.items)) : [];
  await deps.pools.save({
    id: `${actor.tenantId}_${actor.uid}`,
    tenantId: actor.tenantId,
    trainerId: actor.uid,
    items: seedItems,
    updatedAt: now(),
    updatedBy: actor.uid,
  });

  return clone;
}
