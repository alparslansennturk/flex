import { widestScope } from "../access/can";
import type { Actor } from "../access/types";
import { COLLAGE_CATEGORIES, type CollageItem, type CollagePool } from "../core/collage-pool";
import type { AssignmentTemplate } from "../core/assignment-template";
import { ForbiddenError, ValidationError } from "../errors";
import type { CollagePoolRepo } from "../repo/collage-pool-repo";
import type { AssignmentTemplateRepo } from "../repo/assignment-template-repo";

const now = () => new Date().toISOString();

function validateItems(items: CollageItem[]): void {
  for (const it of items) {
    if (!it.name?.trim()) throw new ValidationError("Havuz öğesi adı boş olamaz.");
    if (!COLLAGE_CATEGORIES.includes(it.category)) throw new ValidationError("Geçersiz kategori.");
  }
}

/** Eğitmenin kendi havuz kopyası — yoksa null ("henüz Kütüphaneme Ekle'yi kullanmamış"). */
export async function getMyCollagePool(actor: Actor, repo: CollagePoolRepo): Promise<CollagePool | null> {
  if (!widestScope(actor, "assignment.pool.manage")) throw new ForbiddenError("assignment.pool.manage");
  return repo.getByTrainer(actor.tenantId, actor.uid);
}

/** Tenant varsayılan havuzu — org scope (Kütüphaneme Ekle'nin tohum kaynağı). */
export async function getDefaultCollagePool(actor: Actor, repo: CollagePoolRepo): Promise<CollagePool | null> {
  if (widestScope(actor, "assignment.pool.manage") !== "org") throw new ForbiddenError("assignment.pool.manage");
  return repo.get(actor.tenantId);
}

/** Tenant varsayılan havuzunu yazar — org scope. */
export async function updateDefaultCollagePool(actor: Actor, items: CollageItem[], repo: CollagePoolRepo): Promise<CollagePool> {
  if (widestScope(actor, "assignment.pool.manage") !== "org") throw new ForbiddenError("assignment.pool.manage");
  validateItems(items);
  const pool: CollagePool = {
    id: `${actor.tenantId}_default`,
    tenantId: actor.tenantId,
    items,
    updatedAt: now(),
    updatedBy: actor.uid,
  };
  await repo.save(pool);
  return pool;
}

/**
 * Eğitmenin kendi havuz kopyasını yeniden yazar (tüm-array-rewrite — canlıdaki
 * `CollagePoolPanel.tsx` deseniyle aynı). Havuz henüz yoksa (Kütüphaneme Ekle
 * atlanmışsa) burada sıfırdan oluşturulur — savunmacı, normal akışta gerekmez.
 */
export async function updateMyCollagePool(actor: Actor, items: CollageItem[], repo: CollagePoolRepo): Promise<CollagePool> {
  if (!widestScope(actor, "assignment.pool.manage")) throw new ForbiddenError("assignment.pool.manage");
  validateItems(items);
  const pool: CollagePool = {
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

export interface CollagePoolDeps {
  pools: CollagePoolRepo;
  templates: AssignmentTemplateRepo;
}

/**
 * "Kütüphaneme Ekle" — global oyunlaştırılmış katalog girdisini eğitmenin KİŞİSEL
 * kütüphanesine klonlar + kendi bağımsız havuz kopyasını tenant varsayılanından
 * deep-copy ile tohumlar. İDEMPOTENT: zaten klonlanmışsa var olanı döner, tekrar
 * oluşturmaz (kullanıcı kararı: bir eğitmenin havuzu başka eğitmeni etkilemesin —
 * bu yüzden her klon kendi bağımsız dokümanı, paylaşımlı değil).
 */
export async function addTemplateToPersonalLibrary(
  actor: Actor,
  globalTemplateId: string,
  deps: CollagePoolDeps,
): Promise<AssignmentTemplate> {
  if (widestScope(actor, "template.manage") == null) throw new ForbiddenError("template.manage");

  const globalTemplate = await deps.templates.getById(globalTemplateId, actor.tenantId);
  if (!globalTemplate) throw new ValidationError("Şablon bulunamadı.");
  if (globalTemplate.scope !== "global" || !globalTemplate.gamifiedType) {
    throw new ValidationError("Bu şablon Global Kütüphane'ye eklenebilir bir oyunlaştırılmış şablon değil.");
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
    // Kişisel gamified klon direkt kullanılabilir olmalı — normal şablonlardaki
    // "Şablon Yönetimi'nden manuel onay" adımı burada anlamsız (ekleme = onay).
    visible: true,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await deps.templates.save(clone);

  const defaultPool = await deps.pools.get(actor.tenantId);
  const seedItems: CollageItem[] = defaultPool ? JSON.parse(JSON.stringify(defaultPool.items)) : [];
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
