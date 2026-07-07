// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { LotteryArchive, LotteryResult } from "../domain/core/lottery-result";
import type { LotteryResultRepo } from "../domain/repo/lottery-result-repo";

const RESULTS_COLLECTION = "flexos_lottery_results";
const ARCHIVE_COLLECTION = "flexos_lottery_archive";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreLotteryResultRepo: LotteryResultRepo = {
  async get(assignmentId) {
    const snap = await adminDb.collection(RESULTS_COLLECTION).doc(assignmentId).get();
    if (!snap.exists) return null;
    return snap.data() as LotteryResult;
  },

  async save(result) {
    await adminDb.collection(RESULTS_COLLECTION).doc(result.id).set(clean(result));
  },

  async getArchive(assignmentId) {
    const snap = await adminDb.collection(ARCHIVE_COLLECTION).doc(assignmentId).get();
    if (!snap.exists) return null;
    return snap.data() as LotteryArchive;
  },

  async saveArchive(archive) {
    await adminDb.collection(ARCHIVE_COLLECTION).doc(archive.id).set(clean(archive));
  },
};
