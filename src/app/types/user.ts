export type UserRole = 'ADMIN' | 'INSTRUCTOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;

  // Standalone (Boş) -> FlexOS (Dolu) köprüsü
  organizationId?: string; 

  status: 'ACTIVE' | 'PASSIVE';

  createdAt: string; // ISO 8601
  lastLoginAt?: string;
}