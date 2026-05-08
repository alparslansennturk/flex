import {
  getFirestore,
  writeBatch,
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import type {
  INotificationService,
  NotificationAudience,
  NotificationPayload,
  SendAnnouncementOptions,
  SendNotificationOptions,
  NotificationResult,
  BatchWriteResult,
} from '@/app/lib/notifications/types'
import { MASTER_ID } from '@/app/lib/constants'

const db = getFirestore()

export class ClientSideNotificationImpl implements INotificationService {

  // ── Generic dispatcher ────────────────────────────────────────────────────
  async dispatch(options: SendNotificationOptions): Promise<NotificationResult> {
    try {
      const userIds = await this.resolveAudience(options.audience)
      if (!userIds.length) return { success: true, totalSent: 0, message: 'No recipients' }

      const groupId = options.audience.type === 'group' ? options.audience.groupId : undefined

      return this.fanOut({
        eventId:   options.eventId,
        userIds,
        senderId:  options.senderId,
        notifType: options.notifType,
        title:     options.title,
        preview:   options.preview,
        actionUrl: options.actionUrl,
        entityId:  options.entityId ?? options.eventId,
        groupId,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: msg, message: 'dispatch failed' }
    }
  }

  // ── Backward-compat: announcement shorthand ──────────────────────────────
  async sendAnnouncement(options: SendAnnouncementOptions): Promise<NotificationResult> {
    const { announcementId, groupId, studentIds, senderId, title, preview, chunkSize } = options
    return this.fanOut({
      eventId:   announcementId,
      userIds:   studentIds,
      senderId,
      notifType: 'announcement',
      title,
      preview:   preview.slice(0, 100),
      actionUrl: `/announcements/${announcementId}`,
      entityId:  announcementId,
      groupId,
      chunkSize,
    })
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const ref = doc(db, 'users', userId, 'notifications', notificationId)
      await updateDoc(ref, { isRead: true, readAt: serverTimestamp() })
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Archive error:', msg)
      throw error
    }
  }

  async clearAll(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, { lastClearedAt: serverTimestamp() })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Clear all error:', msg)
      throw error
    }
  }

  // ── Audience resolver ─────────────────────────────────────────────────────
  private async resolveAudience(audience: NotificationAudience): Promise<string[]> {
    switch (audience.type) {
      case 'users': return audience.userIds
      case 'group': return audience.userIds
      case 'all':   return this.fetchAllUserIds()
      case 'role':  return this.fetchUserIdsByRole(audience.role)
    }
  }

  private async fetchAllUserIds(): Promise<string[]> {
    const snap = await getDocs(collection(db, 'users'))
    return snap.docs.map(d => d.id).filter(id => id !== MASTER_ID)
  }

  private async fetchUserIdsByRole(role: string): Promise<string[]> {
    const snap = await getDocs(
      query(collection(db, 'users'), where('roles', 'array-contains', role))
    )
    return snap.docs.map(d => d.id)
  }

  // ── Core fan-out ──────────────────────────────────────────────────────────
  private async fanOut(params: {
    eventId:   string
    userIds:   string[]
    senderId:  string
    notifType: NotificationPayload['type']
    title:     string
    preview:   string
    actionUrl: string
    entityId:  string
    groupId?:  string
    chunkSize?: number
  }): Promise<NotificationResult> {
    const { eventId, userIds, senderId, notifType, title, preview, actionUrl, entityId, groupId } = params
    const safePreview   = preview.slice(0, 100)
    const safeTitle     = title.slice(0, 200)
    const safeChunkSize = Math.min(params.chunkSize || 400, 400)

    const chunks = this.chunkArray(userIds, safeChunkSize)
    let totalSuccess = 0
    let totalFailed  = 0
    const allErrors: Array<{ studentId: string; error: string }> = []

    for (let i = 0; i < chunks.length; i++) {
      const result = await this.writeBatchChunk(
        eventId, chunks[i], senderId, notifType,
        safeTitle, safePreview, actionUrl, entityId, groupId, i
      )
      totalSuccess += result.successCount
      totalFailed  += result.failureCount
      allErrors.push(...(result.errors || []))
    }

    return {
      success:     totalFailed === 0,
      totalSent:   totalSuccess,
      failedCount: totalFailed,
      message:     `Sent to ${totalSuccess} users${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`,
      error:       totalFailed > 0 ? `${totalFailed} writes failed` : undefined,
    }
  }

  private async writeBatchChunk(
    eventId:   string,
    userIds:   string[],
    senderId:  string,
    notifType: NotificationPayload['type'],
    title:     string,
    preview:   string,
    actionUrl: string,
    entityId:  string,
    groupId:   string | undefined,
    chunkIndex: number,
    retryCount = 0,
    maxRetries = 3
  ): Promise<BatchWriteResult> {
    try {
      const batch = writeBatch(db)
      for (const userId of userIds) {
        const ref = doc(
          collection(db, 'users', userId, 'notifications'),
          `notif_${eventId}_${userId}`
        )
        batch.set(ref, {
          type: notifType,
          entityId,
          senderId,
          title,
          preview,
          actionUrl,
          ...(groupId ? { groupId } : {}),
          createdAt:  serverTimestamp(),
          isRead:     false,
          isArchived: false,
        })
      }
      await batch.commit()
      return { successCount: userIds.length, failureCount: 0, completedAt: new Date() }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (retryCount < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000))
        return this.writeBatchChunk(
          eventId, userIds, senderId, notifType,
          title, preview, actionUrl, entityId, groupId,
          chunkIndex, retryCount + 1, maxRetries
        )
      }
      return {
        successCount: 0,
        failureCount: userIds.length,
        completedAt:  new Date(),
        errors: userIds.map(id => ({ studentId: id, error: msg })),
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size))
    return chunks
  }
}
