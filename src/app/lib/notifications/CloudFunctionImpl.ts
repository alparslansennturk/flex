// ⚠️  PHASE 2 PLACEHOLDER — Cloud Functions Implementation
//
// Migration checklist (when switching):
//   1. Implement INotificationService below
//   2. In NotificationService.ts:
//      NotificationService.setImplementation(new CloudFunctionNotificationImpl())
//   3. Frontend code: ZERO changes needed
//   4. Deterministic ID pattern stays the same: notif_${announcementId}_${studentId}
//
// Phase 2 adds:
//   - Server-side groupId membership validation
//   - Rate limiting (abuse prevention)
//   - Async queue for high-volume fan-out
//   - No Firestore quota concerns (Admin SDK)
//   - Cost: ~$0.04 per announcement (negligible)

import type { INotificationService, SendAnnouncementOptions, NotificationResult } from '@/app/lib/notifications/types'

export class CloudFunctionNotificationImpl implements INotificationService {
  private readonly baseUrl: string

  constructor(baseUrl = '/api/notifications') {
    this.baseUrl = baseUrl
  }

  async sendAnnouncement(options: SendAnnouncementOptions): Promise<NotificationResult> {
    // TODO Phase 2: POST to Cloud Function endpoint
    // The Cloud Function uses Admin SDK + same deterministic ID pattern
    throw new Error('CloudFunctionNotificationImpl.sendAnnouncement not yet implemented')
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    throw new Error('CloudFunctionNotificationImpl.markAsRead not yet implemented')
  }

  async archiveNotification(userId: string, notificationId: string): Promise<void> {
    throw new Error('CloudFunctionNotificationImpl.archiveNotification not yet implemented')
  }

  async clearAll(userId: string): Promise<void> {
    throw new Error('CloudFunctionNotificationImpl.clearAll not yet implemented')
  }
}
