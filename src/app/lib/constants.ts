/**
 * FLEX OS - Global & Modular Product Contract
 */

export const COLLECTIONS = {
  USERS: 'users',
  DESIGN_CLASSES: 'design_classes',
  DESIGN_ASSIGNMENTS: 'design_assignments',
  DESIGN_ATTENDANCE: 'design_attendance',
} as const;
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

export const ROLES = {
  ADMIN: 'admin',
  TRAINER: 'instructor',
  STUDENT: 'student',
} as const;
export type UserRole = typeof ROLES[keyof typeof ROLES];

export const SKILLS = {
  GRAPHIC_DESIGN: 'GRAPHIC_DESIGN',
  WEB_DESIGN: 'WEB_DESIGN',
  VIDEO_EDITING: 'VIDEO_EDITING',
  UI_UX: 'UI_UX',
} as const;
export type UserSkill = typeof SKILLS[keyof typeof SKILLS];

export const PERMISSIONS = {
  VIEW_ALL: 'VIEW_ALL',
  STUDENT_DELETE: 'STUDENT_DELETE',
  ROLE_MANAGE: 'ROLE_MANAGE',
  ASSIGNMENT_MANAGE: 'ASSIGNMENT_MANAGE',
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_SALES: 'VIEW_SALES',
} as const;
export type UserPermission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Rota ve Başlık Yapılandırması (Single Source of Truth)
export const NAV_CONFIG = {
  DASHBOARD: {
    path: '/dashboard',
    title: 'Atölye Özeti'
  },
  GROUPS: {
    path: '/dashboard/management',
    title: 'Grup Yönetimi'
  },
  ASSIGNMENTS: {
    path: '/dashboard/management/assignments',
    title: 'Ödev Yönetimi'
  },
  PERMISSIONS: {
    path: '/dashboard/management/permissions',
    title: 'Rol & Yetki Yönetimi'
  }
} as const;

export const TASK_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REVIEWED: 'REVIEWED',
} as const;
export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export const MESSAGE_TYPES = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success',
} as const;
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];