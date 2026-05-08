# Notification System — Integration Guide

## Quick Start

```ts
// App startup (optional — default impl is already ClientSideImpl)
import { initializeNotificationService } from '@/app/lib/services/NotificationService'
initializeNotificationService()
```

---

## Send Announcement

```ts
import { NotificationService } from '@/app/lib/services/NotificationService'

const result = await NotificationService.sendAnnouncement({
  announcementId: 'ann_123',       // Firestore doc ID
  groupId: 'group_456',
  studentIds: ['student1', 'student2'], // fetched from group members
  senderId: currentUser.uid,        // teacher UID from auth context
  title: 'Important Notice',
  preview: 'Please check the announcement...' // truncated to 100 chars
  // chunkSize: 300  — optional, hard-capped at 400
})

if (result.success) {
  console.log(`Sent to ${result.totalSent} students`)
} else {
  console.error(result.error)
}
```

---

## Subscribe (Realtime)

```ts
import { useEffect, useState } from 'react'
import { NotificationRealtimeService } from '@/app/lib/services/NotificationRealtimeService'
import type { NotificationPayload } from '@/app/lib/notifications/types'
import type { Timestamp } from 'firebase/firestore'

function useNotifications(userId: string, lastClearedAt?: Timestamp) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const unsubscribe = NotificationRealtimeService.subscribe(userId, (notifs) => {
      const visible = NotificationRealtimeService.filterVisible(notifs, lastClearedAt)
      setNotifications(visible)
      setUnreadCount(NotificationRealtimeService.getUnreadCount(visible))
    }, 50)

    return unsubscribe
    // Note: React StrictMode triggers double-subscribe in dev — harmless
  }, [userId, lastClearedAt])

  return { notifications, unreadCount }
}
```

---

## Mark as Read / Archive / Clear All

```ts
import { NotificationService } from '@/app/lib/services/NotificationService'

// Mark as read
await NotificationService.markAsRead(userId, notificationId)

// Archive (hides from active list, keeps in archive)
await NotificationService.archiveNotification(userId, notificationId)

// Clear all — sets lastClearedAt on users doc (no deletes, audit trail preserved)
await NotificationService.clearAll(userId)
```

---

## Render a Notification Item

```tsx
import { NotificationRealtimeService } from '@/app/lib/services/NotificationRealtimeService'
import type { NotificationPayload } from '@/app/lib/notifications/types'

function NotificationItem({ notification }: { notification: NotificationPayload }) {
  const dateStr = NotificationRealtimeService.formatDate(notification.createdAt)

  return (
    <div>
      <h3>{notification.title}</h3>
      <p>{notification.preview}</p>
      <small>{dateStr}</small>
    </div>
  )
}
```

---

## Local Filtering Helpers

```ts
// Active (not archived)
const active = NotificationRealtimeService.getActive(notifications)

// Archived
const archived = NotificationRealtimeService.getArchived(notifications)

// Unread count
const count = NotificationRealtimeService.getUnreadCount(notifications)

// Respects lastClearedAt (for "clear all" UX)
const visible = NotificationRealtimeService.filterVisible(notifications, user.lastClearedAt)
```

---

## Phase 2: Migrate to Cloud Functions

```ts
import { NotificationService } from '@/app/lib/services/NotificationService'
import { CloudFunctionNotificationImpl } from '@/app/lib/notifications/CloudFunctionImpl'

// Single line swap — frontend unchanged
NotificationService.setImplementation(new CloudFunctionNotificationImpl())
```

Deterministic ID pattern (`notif_${announcementId}_${studentId}`) stays the same in Phase 2 — no DB migration needed.

---

## Architecture Notes

| Concern | Service |
|---|---|
| Send / mark / archive | `NotificationService` (swappable impl) |
| Realtime listener | `NotificationRealtimeService` (frontend only) |
| Types | `lib/notifications/types.ts` |
| Phase 1 impl | `ClientSideNotificationImpl` |
| Phase 2 impl | `CloudFunctionNotificationImpl` (placeholder) |

**clearAll pattern**: Sets `lastClearedAt` on the user doc instead of deleting — O(1) write, preserves audit trail, matches Slack/Discord patterns.

**Idempotency**: Deterministic doc IDs mean retrying a failed batch write is always safe — no duplicates.
