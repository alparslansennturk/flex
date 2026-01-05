// 1. Modüler Koleksiyon Yapısı (Modül izini taşıyan koleksiyonlar)
export const COLLECTIONS = {
  USERS: 'users',

  // Tasarım Atölyesi Modülü (Design Studio)
  DESIGN_CLASSES: 'design_classes',
  DESIGN_ASSIGNMENTS: 'design_assignments',
  DESIGN_ATTENDANCE: 'design_attendance',
} as const;

// 2. Tip Güvenlikli Roller ve Yardımcı Tipler
export const ROLES = {
  ADMIN: 'ADMIN',
  INSTRUCTOR: 'INSTRUCTOR',
  STUDENT: 'STUDENT',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];
// İleride Login Guard için kullanacağın:
export type NonStudentRole = Exclude<UserRole, 'STUDENT'>;

// 3. Görev Durumları (Bütün sistemin aynı dili konuşması için)
export const TASK_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REVIEWED: 'REVIEWED',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// 4. Şablon Mantığında Ödevler (Ürün Sözleşmesi)
export const DESIGN_STUDIO_TASK_TEMPLATES = [
  {
    key: 'figma-basics',
    title: 'Figma Temelleri',
    defaultStatus: TASK_STATUS.PENDING,
  },
  {
    key: 'color-typography',
    title: 'Renk ve Tipografi',
    defaultStatus: TASK_STATUS.PENDING,
  },
  {
    key: 'ui-project',
    title: 'UI/UX Proje Tasarımı',
    defaultStatus: TASK_STATUS.PENDING,
  }
] as const;