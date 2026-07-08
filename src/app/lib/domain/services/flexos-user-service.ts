import type { Actor } from "../access/types";
import { can } from "../access/can";
import type { FlexosUser, FlexosUserRole, FlexosUserStatus } from "../core/flexos-user";
import type { Gender } from "../base";
import type { FlexosUserRepo } from "../repo/flexos-user-repo";
import type { RoleDefRepo } from "../repo/role-def-repo";
import { listRoleDefs } from "./role-def-service";
import { ForbiddenError, ValidationError } from "../errors";

const VALID_STATUSES: FlexosUserStatus[] = ["aktif", "pasif"];
const VALID_GENDERS: Gender[] = ["female", "male", "other", "unspecified"];

const now = () => new Date().toISOString();

/**
 * Rolleri gerçek `RoleDef` listesine karşı doğrular — sabit VALID_ROLES/CREATABLE_ROLES
 * dizileri kaldırıldı (2026-07-08), roller artık "Kullanıcı Ayarları"nda kurum tarafından
 * tanımlanıyor. `allowEgitmen=false` Kullanıcı Ekle'den `egitmen` rolünün seçilememesini
 * korur (o rol sadece Eğitmen Ekle akışından otomatik atanır).
 */
async function validateRoles(roles: string[], allowEgitmen: boolean, actor: Actor, roleDefRepo: RoleDefRepo): Promise<FlexosUserRole[]> {
  if (!Array.isArray(roles) || roles.length === 0) throw new ValidationError("En az bir rol seçmelisiniz.");
  const defs = await listRoleDefs(actor, roleDefRepo);
  const validIds = new Set(defs.map((d) => d.id));
  for (const r of roles) {
    if (!validIds.has(r)) throw new ValidationError(`Geçersiz rol: ${r}`);
    if (!allowEgitmen && r === "egitmen") throw new ValidationError("Eğitmen rolü bu formda atanamaz.");
  }
  return roles;
}

// ── Input types ──

export interface CreateFlexosUserInput {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  title?: string;
  roles?: string[];
  subes?: string[];
  permOverrides?: Record<string, boolean>;
  status?: string;
  /** Route katmanında Firebase Auth hesabı önceden oluşturulup buraya geçirilir — domain katmanı Firebase'i bilmez. */
  authUid?: string;
}

export interface UpdateFlexosUserInput {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthDate?: string | null;
  title?: string | null;
  roles?: string[];
  subes?: string[];
  permOverrides?: Record<string, boolean>;
  status?: string;
}

// ── Service functions ──

export async function createFlexosUser(
  actor: Actor,
  input: CreateFlexosUserInput,
  repo: FlexosUserRepo,
  roleDefRepo: RoleDefRepo,
): Promise<FlexosUser> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const name = input.name?.trim();
  const surname = input.surname?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) throw new ValidationError("Ad zorunludur.");
  if (!surname) throw new ValidationError("Soyad zorunludur.");
  if (!email) throw new ValidationError("E-posta zorunludur.");

  const existing = await repo.getByEmail(email, actor.tenantId);
  if (existing) throw new ValidationError("Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.");

  const gender = (input.gender as Gender) ?? "unspecified";
  if (!VALID_GENDERS.includes(gender)) throw new ValidationError("Geçersiz cinsiyet.");

  // Kullanıcı Ekle'den eğitmen oluşturulamaz
  const roles = await validateRoles(input.roles ?? [], false, actor, roleDefRepo);

  const status = (input.status as FlexosUserStatus) ?? "aktif";
  if (!VALID_STATUSES.includes(status)) throw new ValidationError("Geçersiz durum.");

  const subes = input.subes ?? [];
  if (subes.length === 0) throw new ValidationError("En az bir şube seçmelisiniz.");

  const user: FlexosUser = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name,
    surname,
    email,
    phone: input.phone?.trim() || undefined,
    gender,
    birthDate: input.birthDate || undefined,
    title: input.title?.trim() || undefined,
    roles,
    subes,
    permOverrides: input.permOverrides && Object.keys(input.permOverrides).length > 0
      ? input.permOverrides
      : undefined,
    status,
    authUid: input.authUid,
    createdAt: now(),
    createdBy: actor.uid,
  };

  await repo.save(user);
  return user;
}

export async function updateFlexosUser(
  actor: Actor,
  id: string,
  input: UpdateFlexosUserInput,
  repo: FlexosUserRepo,
  roleDefRepo: RoleDefRepo,
): Promise<FlexosUser> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Kullanıcı bulunamadı.");

  const updated: FlexosUser = { ...existing };

  if (input.name !== undefined) {
    const v = input.name.trim();
    if (!v) throw new ValidationError("Ad zorunludur.");
    updated.name = v;
  }
  if (input.surname !== undefined) {
    const v = input.surname.trim();
    if (!v) throw new ValidationError("Soyad zorunludur.");
    updated.surname = v;
  }
  if (input.email !== undefined) {
    const v = input.email.trim().toLowerCase();
    if (!v) throw new ValidationError("E-posta zorunludur.");
    if (v !== existing.email) {
      const dup = await repo.getByEmail(v, actor.tenantId);
      if (dup) throw new ValidationError("Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.");
    }
    updated.email = v;
  }
  if (input.phone !== undefined) updated.phone = input.phone.trim() || undefined;
  if (input.gender !== undefined) {
    if (!VALID_GENDERS.includes(input.gender as Gender)) throw new ValidationError("Geçersiz cinsiyet.");
    updated.gender = input.gender as Gender;
  }
  if (input.birthDate !== undefined) updated.birthDate = input.birthDate || undefined;
  if (input.title !== undefined) updated.title = input.title?.trim() || undefined;
  // Düzenlemede eğitmen rolü de eklenebilir (mevcut eğitmene admin eklemek gibi)
  if (input.roles !== undefined) {
    updated.roles = await validateRoles(input.roles, true, actor, roleDefRepo);
  }
  if (input.subes !== undefined) {
    if (input.subes.length === 0) throw new ValidationError("En az bir şube seçmelisiniz.");
    updated.subes = input.subes;
  }
  if (input.permOverrides !== undefined) {
    updated.permOverrides = Object.keys(input.permOverrides).length > 0
      ? input.permOverrides
      : undefined;
  }
  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status as FlexosUserStatus)) throw new ValidationError("Geçersiz durum.");
    updated.status = input.status as FlexosUserStatus;
  }

  updated.updatedAt = now();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return updated;
}

/** Silinen kaydı döner — route katmanı `authUid`'i kullanıp Firebase Auth hesabını da silsin diye. */
export async function deleteFlexosUser(
  actor: Actor,
  id: string,
  repo: FlexosUserRepo,
): Promise<FlexosUser> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Kullanıcı bulunamadı.");

  // `existing.id` Firestore doc id'si, `actor.uid` Firebase Auth uid'i — farklı id
  // uzayları, `authUid` üzerinden karşılaştırılmalı (eskiden hiç eşleşmeyen, hiçbir
  // zaman tetiklenmeyen bir kontroldü).
  if (existing.authUid && existing.authUid === actor.uid) {
    throw new ValidationError("Kendi hesabınızı silemezsiniz.");
  }

  await repo.delete(id, actor.tenantId);
  return existing;
}
