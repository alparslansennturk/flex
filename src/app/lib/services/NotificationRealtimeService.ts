import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  Timestamp,
  type Unsubscribe
} from 'firebase/firestore'
import type { NotificationPayload } from '@/app/lib/notifications/types'

const db = getFirestore()

export class NotificationRealtimeService {
  static subscribe(
    userId: string,
    callback: (notifications: NotificationPayload[]) => void,
    pageSize = 50
  ): Unsubscribe {
    try {
      const notificationsQuery = query(
        collection(db, 'users', userId, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      )

      // Memory leak protection: prevent callback after unsubscribe
      let unsubscribed = false

      const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        if (unsubscribed) return

        const notifications: NotificationPayload[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data()
            return {
              id: docSnap.id,
              type: data.type || 'system',
              entityId: data.entityId || '',
              senderId: data.senderId || 'system',
              title: data.title || '',
              preview: data.preview || '',
              actionUrl: data.actionUrl || '/',
              createdAt: data.createdAt as Timestamp | undefined,
              isRead: data.isRead ?? false,
              isArchived: data.isArchived ?? false,
              readAt: data.readAt as Timestamp | undefined,
              archivedAt: data.archivedAt as Timestamp | undefined,
              groupId: data.groupId
            } as NotificationPayload
          })
          // Filter out docs with unresolved serverTimestamp (createdAt not yet set)
          .filter((n) => n.createdAt instanceof Timestamp)
          // Stable sort against Firestore cache inconsistencies
          .sort((a, b) => b.createdAt!.toMillis() - a.createdAt!.toMillis())

        console.log(`📡 [${userId}] Received ${notifications.length} notifications`)
        callback(notifications)
      })

      console.log(`📡 Subscribed to notifications for ${userId}`)

      return () => {
        unsubscribed = true
        unsubscribe()
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Subscribe error:', msg)
      throw error
    }
  }

  static getUnreadCount(notifications: NotificationPayload[]): number {
    return notifications.filter((n) => !n.isRead && !n.isArchived).length
  }

  static getArchived(notifications: NotificationPayload[]): NotificationPayload[] {
    return notifications.filter((n) => n.isArchived)
  }

  static getActive(notifications: NotificationPayload[]): NotificationPayload[] {
    return notifications.filter((n) => !n.isArchived)
  }

  // Respects lastClearedAt: hides notifications created before user's last "clear all"
  static filterVisible(
    notifications: NotificationPayload[],
    lastClearedAt?: Timestamp
  ): NotificationPayload[] {
    return notifications.filter((n) => {
      if (n.isArchived) return false
      if (!lastClearedAt || !n.createdAt) return true
      return n.createdAt.toMillis() > lastClearedAt.toMillis()
    })
  }

  static formatDate(timestamp: Timestamp | undefined): string {
    if (!timestamp) return 'Unknown'
    try {
      return timestamp.toDate().toLocaleDateString('tr-TR')
    } catch {
      console.warn('Invalid timestamp:', timestamp)
      return 'Invalid date'
    }
  }
}
