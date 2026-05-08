import {
  getFirestore,
  writeBatch,
  collection,
  doc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import type {
  INotificationService,
  SendAnnouncementOptions,
  NotificationResult,
  BatchWriteResult
} from '@/app/lib/notifications/types'

const db = getFirestore()

export class ClientSideNotificationImpl implements INotificationService {
  async sendAnnouncement(options: SendAnnouncementOptions): Promise<NotificationResult> {
    try {
      const {
        announcementId,
        groupId,
        studentIds,
        senderId,
        title,
        preview: rawPreview,
        chunkSize = 400
      } = options

      const preview = rawPreview.slice(0, 100)
      const safeTitle = title.slice(0, 200)
      const safeChunkSize = Math.min(chunkSize || 400, 400)

      if (!studentIds || studentIds.length === 0) {
        return { success: true, totalSent: 0, message: 'No students to notify' }
      }

      console.log(`📢 Starting announcement fan-out: ${announcementId}`)
      console.log(`📊 Total students: ${studentIds.length}`)
      console.log(`✅ IDEMPOTENT: Deterministic IDs prevent duplicates on retry`)

      const chunks = this.chunkArray(studentIds, safeChunkSize)
      console.log(`📦 Split into ${chunks.length} chunks (max ${safeChunkSize} per batch)`)

      let totalSuccess = 0
      let totalFailed = 0
      const allErrors: Array<{ studentId: string; error: string }> = []

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        console.log(`\n⏳ Processing chunk ${chunkIndex + 1}/${chunks.length}...`)

        const chunkResult = await this.writeBatchWithRetry(
          announcementId,
          groupId,
          chunk,
          senderId,
          safeTitle,
          preview,
          chunkIndex
        )

        totalSuccess += chunkResult.successCount
        totalFailed += chunkResult.failureCount
        allErrors.push(...(chunkResult.errors || []))

        console.log(`✅ Chunk ${chunkIndex + 1}: ${chunkResult.successCount} success, ${chunkResult.failureCount} failed`)
        this.logQuotaUsage(totalSuccess)
      }

      console.log(`\n🎉 Announcement complete! Sent: ${totalSuccess}, Failed: ${totalFailed}`)

      return {
        success: totalFailed === 0,
        totalSent: totalSuccess,
        failedCount: totalFailed,
        message: `Announcement sent to ${totalSuccess} students${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`,
        error: totalFailed > 0 ? `${totalFailed} writes failed` : undefined
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Announcement error:', errorMessage)
      return { success: false, error: errorMessage, message: 'Failed to send announcement' }
    }
  }

  private async writeBatchWithRetry(
    announcementId: string,
    groupId: string,
    studentIds: string[],
    senderId: string,
    title: string,
    preview: string,
    chunkIndex: number,
    retryCount = 0,
    maxRetries = 3
  ): Promise<BatchWriteResult> {
    try {
      const batch = writeBatch(db)

      for (const studentId of studentIds) {
        const notificationsRef = collection(db, 'users', studentId, 'notifications')
        // Deterministic ID: idempotent across retries — same write on retry = no duplicate
        const deterministicId = `notif_${announcementId}_${studentId}`
        const notificationRef = doc(notificationsRef, deterministicId)

        batch.set(notificationRef, {
          type: 'announcement',
          entityId: announcementId,
          senderId,
          title,
          preview,
          actionUrl: `/announcements/${announcementId}`,
          groupId,
          createdAt: serverTimestamp(),
          isRead: false,
          isArchived: false
        })
      }

      console.log(`   → Committing ${studentIds.length} writes (deterministic IDs = idempotent)...`)
      await batch.commit()

      return { successCount: studentIds.length, failureCount: 0, completedAt: new Date() }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`   ❌ Batch failed (attempt ${retryCount + 1}/${maxRetries}):`, errorMessage)

      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        console.log(`   ⏳ Retrying in ${delay}ms (deterministic ID = safe retry)...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.writeBatchWithRetry(
          announcementId,
          groupId,
          studentIds,
          senderId,
          title,
          preview,
          chunkIndex,
          retryCount + 1,
          maxRetries
        )
      }

      return {
        successCount: 0,
        failureCount: studentIds.length,
        completedAt: new Date(),
        errors: studentIds.map((id) => ({ studentId: id, error: errorMessage }))
      }
    }
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const ref = doc(db, 'users', userId, 'notifications', notificationId)
      await updateDoc(ref, { isRead: true, readAt: serverTimestamp() })
      console.log(`✅ Marked ${notificationId} as read`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Mark as read error:', msg)
      throw error
    }
  }

  async archiveNotification(userId: string, notificationId: string): Promise<void> {
    try {
      const ref = doc(db, 'users', userId, 'notifications', notificationId)
      await updateDoc(ref, { isArchived: true, archivedAt: serverTimestamp() })
      console.log(`📦 Archived ${notificationId}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Archive error:', msg)
      throw error
    }
  }

  // Enterprise pattern: lastClearedAt instead of deleting — O(1), audit trail preserved
  async clearAll(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, { lastClearedAt: serverTimestamp() })
      console.log(`🗑️ Cleared all notifications for ${userId} (lastClearedAt set)`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Clear all error:', msg)
      throw error
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private logQuotaUsage(writesThisSession: number) {
    const realisticUsableLimit = 8000 // ~8K/day accounting for reads, updates, retries
    const percentUsed = (writesThisSession / realisticUsableLimit) * 100
    if (percentUsed > 95) {
      console.error(`🔴 Critical: ${percentUsed.toFixed(1)}% of realistic daily limit used. Consider Cloud Functions migration.`)
    } else if (percentUsed > 80) {
      console.warn(`⚠️  Quota warning: ${percentUsed.toFixed(1)}% of realistic daily limit used`)
    }
  }
}
