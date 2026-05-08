import type { Timestamp } from 'firebase/firestore'

// ── Audience: kime gönderileceğini tanımlar ──────────────────────────────────
// "group"  → caller zaten studentIds'i biliyor, geçirir (ekstra Firestore query yok)
// "all"    → dispatcher tüm user ID'lerini Firestore'dan çeker
// "role"   → dispatcher o role sahip kullanıcıları çeker
// "users"  → direkt ID listesi
export type NotificationAudience =
  | { type: "all" }
  | { type: "group"; groupId: string; userIds: string[] }
  | { type: "role"; role: string }
  | { type: "users"; userIds: string[] }

export interface SendNotificationOptions {
  eventId: string                          // deterministic ID prefix: notif_{eventId}_{userId}
  notifType: NotificationPayload["type"]
  audience: NotificationAudience
  senderId: string
  title: string
  preview: string
  actionUrl: string
  entityId?: string
}

export interface INotificationService {
  dispatch(options: SendNotificationOptions): Promise<NotificationResult>
  sendAnnouncement(options: SendAnnouncementOptions): Promise<NotificationResult>
  markAsRead(userId: string, notificationId: string): Promise<void>
  archiveNotification(userId: string, notificationId: string): Promise<void>
  clearAll(userId: string): Promise<void>
}

export interface NotificationPayload {
  id: string // deterministic: notif_${announcementId}_${studentId}
  type: 'message' | 'announcement' | 'assignment' | 'system'
  entityId: string
  senderId: string
  title: string
  preview: string // max 100 chars, enforced backend
  actionUrl: string
  createdAt?: Timestamp
  isRead: boolean
  isArchived?: boolean
  readAt?: Timestamp
  archivedAt?: Timestamp
  groupId?: string
}

export interface AnnouncementPayload {
  groupId: string
  createdBy: string
  title: string
  content: string
  attachmentUrl?: string
  memberIds?: string[]
  createdAt: Timestamp
}

export interface NotificationResult {
  success: boolean
  totalSent?: number
  failedCount?: number
  error?: string
  message: string
}

export interface SendAnnouncementOptions {
  announcementId: string
  groupId: string
  studentIds: string[]
  senderId: string
  title: string
  preview: string // truncated to 100 chars
  chunkSize?: number // default: 400, hard-capped at 400
}

export interface BatchWriteResult {
  successCount: number
  failureCount: number
  completedAt: Date
  errors?: Array<{ studentId: string; error: string }>
}
