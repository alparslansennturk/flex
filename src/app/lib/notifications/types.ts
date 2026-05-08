import type { Timestamp } from 'firebase/firestore'

export interface INotificationService {
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
