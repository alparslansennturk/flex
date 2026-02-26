// types/auth.ts

export type UserRole = 'admin' | 'instructor' | 'student';

// Sisteme eklenecek her yeni yetkiyi buraya yazıyoruz
export type Permission = 
  | 'VIEW_ALL_CLASSES'
  | 'MANAGE_USERS'
  | 'CREATE_HOMEWORK'
  | 'GRADE_HOMEWORK'
  | 'SYSTEM_SETTINGS';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  roles: UserRole[];
  // İşte hatayı çözen anahtar satır burası: 
  // [key: string] diyerek herhangi bir string ile indexlenebileceğini söylüyoruz.
  overrides?: Record<string, boolean>; 
  createdAt?: any;
}