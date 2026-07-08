import type { Audit, EntityId, TenantId, Gender, ISODate } from "../base";

/**
 * FlexOS Kullanıcı — sisteme giriş yapabilen personel.
 * Çoklu rol destekli: bir kişi hem admin hem eğitmen olabilir.
 * Eğitmen kullanıcısı "Eğitmen Ekle" akışından otomatik oluşur.
 * Öğrenci kullanıcıları ayrı akışla (satış tamamlama → otomatik) oluşur.
 */

/** Rol id'si — sabit değil, `RoleDef.id`'ye (Firestore, `flexos_role_defs`) referans verir. */
export type FlexosUserRole = string;
export type FlexosUserStatus = "aktif" | "pasif";

export interface FlexosUser extends Audit {
  id: EntityId;
  tenantId: TenantId;
  name: string;
  surname: string;
  email: string;
  phone?: string;
  gender: Gender;
  birthDate?: ISODate;
  title?: string;
  /** Çoklu rol — yetki paketi tüm rollerin birleşimi. */
  roles: FlexosUserRole[];
  subes: string[];
  /** Modül bazlı yetki override'ları. Rol paketinden farklıysa burada tutulur. */
  permOverrides?: Record<string, boolean>;
  status: FlexosUserStatus;
  /** Firebase Auth UID — giriş yapabilmesi için bağlanır. */
  authUid?: string;
}
