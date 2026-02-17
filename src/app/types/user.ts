import { UserRole, UserPermission } from '@/app/lib/constants';

export interface UserDocument {
  uid: string;
  email: string;
  name: string;
  surname: string;
  roles: string[]; // Çoklu rol için diziye çevrildi
  title: string;   // Manuel giriş için zorunlu yapıldı
  gender: 'male' | 'female'; // Yeni zorunlu alan
  birthDate: string; // Yeni zorunlu alan
  isInstructor: boolean; // Eğitmen listesi kontrolü
  permissions: string[];
  branch: string;
  overrides?: Record<string, boolean>;
}