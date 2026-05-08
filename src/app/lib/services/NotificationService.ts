import type { INotificationService, SendAnnouncementOptions, SendNotificationOptions } from '@/app/lib/notifications/types'
import { ClientSideNotificationImpl } from '@/app/lib/notifications/ClientSideImpl'

export class NotificationService {
  private static implementation: INotificationService = new ClientSideNotificationImpl()

  static setImplementation(impl: INotificationService) {
    this.implementation = impl
  }

  static async dispatch(options: SendNotificationOptions) {
    return this.implementation.dispatch(options)
  }

  static async sendAnnouncement(options: SendAnnouncementOptions) {
    return this.implementation.sendAnnouncement(options)
  }

  static async markAsRead(userId: string, notificationId: string) {
    return this.implementation.markAsRead(userId, notificationId)
  }

  static async archiveNotification(userId: string, notificationId: string) {
    return this.implementation.archiveNotification(userId, notificationId)
  }

  static async clearAll(userId: string) {
    return this.implementation.clearAll(userId)
  }
}

// Optional: call at app startup to be explicit about which impl is active
export function initializeNotificationService() {
  NotificationService.setImplementation(new ClientSideNotificationImpl())
  // Phase 2: NotificationService.setImplementation(new CloudFunctionNotificationImpl())
}
