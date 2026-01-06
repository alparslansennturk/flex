/**
 * FLEX OS - User Document Contract
 */
import { UserRole, UserPermission } from '@/app/lib/constants';

export interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: UserPermission[];
  status: 'active' | 'passive' | 'suspended'; // 'suspended' eklendi - Senior Review ✅
  createdAt: any; 
  lastLogin?: any;
}