/**
 * FLEX OS - Centralized Permission Resolver
 * Kullanıcının belirli bir eyleme yetkisi olup olmadığını denetler.
 */
import { UserDocument } from '@/app/types/user'; // Buraya 'app' ekledik
import { Permission, ROLES } from '@/app/lib/constants'; // Burası zaten doğru

/**
 * Kullanıcının yetkisini kontrol eder.
 * @param user - Mevcut kullanıcı dökümanı
 * @param requiredPermission - Kontrol edilecek yetki (örn: PERMISSIONS.SALES.VIEW)
 */
export const hasPermission = (
  user: UserDocument | null, 
  requiredPermission: Permission
): boolean => {
  if (!user) return false;

  // 1. ADMIN kuralı: ADMIN rolüne sahip kullanıcılar tüm sistem yetkilerine sahiptir.
  if (user.role === ROLES.ADMIN) return true;

  // 2. Özel Yetki Kontrolü: Kullanıcının permissions dizisinde bu yetki var mı?
  return user.permissions.includes(requiredPermission);
};