// src/lib/constants.ts
import { User } from '../types/user';

export const MOCK_USERS: User[] = [
  {
    id: 'admin_1',
    name: 'Alparslan (Yönetici)',
    email: 'admin@flex.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'instructor_1',
    name: 'Eğitmen Alp',
    email: 'hoca@flex.com',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  }
];