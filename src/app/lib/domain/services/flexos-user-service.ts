import type { Actor } from "../access/types";
import { can } from "../access/can";
import type { FlexosUser, FlexosUserRole, FlexosUserStatus } from "../core/flexos-user";
import type { Gender } from "../base";
import type { FlexosUserRepo } from "../repo/flexos-user-repo";
import { ForbiddenError, ValidationError } from "../errors";

const VALID_ROLES: FlexosUserRole[] = ["genel_mudur", "egitim_koordinatoru", "ogrenci_isleri", "satis_temsilcisi", "finans", "egitmen"];
/** Kullanıcı Ekle formundan seçilebilen roller (eğitmen hariç — o Eğitmen Ekle'den gelir) */
const CREATABLE_ROLES: FlexosUserRole[] = ["genel_mudur", "egitim_koordinatoru", "ogrenci_isleri", "satis_temsilcisi", "finans"];
const VALID_STATUSES: FlexosUserStatus[] = ["aktif", "pasif"];
const VALID_GENDERS: Gender[] = ["female", "male", "other", "unspecified"];

const now = () => new Date().toISOString();

function validateRoles(roles: string[], allowEgitmen: boolean): FlexosUserRole[] {
  if (!Array.isArray(roles) || roles.length === 0) throw new ValidationError("En az bir rol seçmelisiniz.");
  const pool = allowEgitmen ? VALID_ROLES : CREATABLE_ROLES;
  for (const r of roles) {
    if (!pool.includes(r as FlexosUserRole)) throw new ValidationError(`Geçersiz rol: ${r}`);
  }
  return roles as FlexosUserRole[];
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
  const roles = validateRoles(input.roles ?? ["operasyon"], false);

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
    updated.roles = validateRoles(input.roles, true);
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

export async function deleteFlexosUser(
  actor: Actor,
  id: string,
  repo: FlexosUserRepo,
): Promise<void> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Kullanıcı bulunamadı.");

  if (existing.id === actor.uid) {
    throw new ValidationError("Kendi hesabınızı silemezsiniz.");
  }

  await repo.delete(id, actor.tenantId);
}
