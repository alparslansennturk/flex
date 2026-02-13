/**
 * FLEX OS - Centralized Permission Resolver
 */
import { UserDocument } from '@/app/types/user'; 
import { ROLES } from '@/app/lib/constants'; 

/**
 * Kullanıcının yetkisini kontrol eder.
 */
export const hasPermission = (
  user: UserDocument | null, 
  requiredPermission: string
): boolean => {
  if (!user) return false;

  // 1. ADMIN kuralı
  if (user.role === ROLES.ADMIN) return true;

  // 2. Özel Yetki Kontrolü
  return Array.isArray(user.permissions) && user.permissions.includes(requiredPermission);
};