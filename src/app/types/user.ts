import { UserRole, UserPermission } from '@/app/lib/constants';

// "internal" = admin, instructor, accountant, staff
// "external" = student, parent, customer (gelecekte)
export type UserType = 'internal' | 'external';

export interface UserDocument {
  uid: string;
  email: string;
  name: string;
  surname: string;
  roles: string[]; // Çoklu rol için diziye çevrildi
  role?: string;   // Tek rol (yeni kullanıcılar için canonical)
  type?: UserType; // ✅ NEW — backend tarafından set edilir, client'tan asla alınmaz
  title: string;
  gender: 'male' | 'female';
  avatarId?: number;
  birthDate: string;
  isInstructor: boolean;
  permissions: string[];
  status?: 'pending_activation' | 'code_sent' | 'active' | 'suspended';
  isActivated?: boolean;
  branch: string;
  overrides?: Record<string, boolean>;
  permissionOverrides?: Record<string, boolean>;
  createdAt?: unknown;
  createdBy?: string;
}

// ─── Activation Code (codes collection) ──────────────────────────────────────

export interface ActivationCode {
  id:        string;
  code:      string;
  userId:    string;
  email:     string;
  role:      string;
  type:      UserType;
  createdAt: Date;
  expiresAt: Date;
  status:    'pending' | 'sent' | 'used' | 'expired';
  sentAt?:   Date;
  usedAt?:   Date;
}

// ─── User creation payload (API input) ───────────────────────────────────────

export interface UserCreatePayload {
  email:        string;
  name:         string;
  surname?:     string;
  role:         'admin' | 'instructor' | 'student' | 'accountant';
  groupId?:     string; // student için zorunlu
  permissions?: string[];
}

// ─── Email log ────────────────────────────────────────────────────────────────

export interface EmailLog {
  id:        string;
  to:        string;
  userId?:   string;
  subject:   string;
  type:      string;
  status:    'success' | 'failed';
  messageId?: string;
  error?:    string;
  testMode?: boolean;
  createdAt: Date;
}