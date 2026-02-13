/**
 * FLEX OS - User Document Contract
 */
import { UserRole, UserPermission } from '@/app/lib/constants';

export interface UserDocument {
  role: string;
  permissions: string[];
  uid?: string;
  email?: string;
  // --- BURAYI EKLE ---
  name?: string;         
  surname?: string;      
  title?: string;        
  isInstructor?: boolean; 
  // -------------------
  overrides?: Record<string, boolean>; // Sendeki hasPermission buna bakıyor, bu da kalsın
}