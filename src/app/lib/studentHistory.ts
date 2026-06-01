import { db } from "@/app/lib/firebase";
import {
  collection, doc, writeBatch, serverTimestamp,
  WriteBatch, getDocs, query, where,
} from "firebase/firestore";

// ── Tipler ────────────────────────────────────────────────────────────────────

export type PaymentStatus = "active" | "paused" | "stopped" | "unknown";

export type HistoryReason =
  | "enrollment"      // ilk kayıt
  | "transfer"        // grup transferi
  | "module_upgrade"  // GRAFIK_1 → GRAFIK_2
  | "graduation"      // mezuniyet / grup arşivleme
  | "cancellation";   // iptal / bırakma

export interface GroupHistoryEntry {
  groupId: string;
  groupCode: string;
  module: string;           // "GRAFIK_1" | "GRAFIK_2" | ""
  branch: string;           // discipline id
  instructorId: string | null;
  startDate: string | null; // YYYY-MM-DD — null ise bilinmiyor (migration)
  endDate: string;          // YYYY-MM-DD
  reason: HistoryReason;
  paymentStatus: PaymentStatus;
}

export interface StudentSnapshot {
  studentId: string;
  month: string;            // YYYY-MM
  groupId: string;
  groupCode: string;
  module: string;
  branch: string;
  isActive: boolean;
  paymentStatus: PaymentStatus;
  reason: HistoryReason;
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

export function toMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function toDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Batch'e bir group_history subcollection kaydı ekler.
 * Her çağrı yeni bir doc oluşturur (auto-id).
 */
export function batchAddGroupHistory(
  batch: WriteBatch,
  studentId: string,
  entry: GroupHistoryEntry,
): void {
  const ref = doc(collection(db, "students", studentId, "group_history"));
  batch.set(ref, { ...entry, createdAt: serverTimestamp() });
}

/**
 * Batch'e aylık snapshot ekler.
 * Idempotent — aynı studentId+month için tekrar çağrılırsa üzerine yazar.
 */
export function batchUpsertSnapshot(
  batch: WriteBatch,
  snapshot: StudentSnapshot,
): void {
  const ref = doc(db, "student_snapshots", `${snapshot.studentId}_${snapshot.month}`);
  batch.set(ref, { ...snapshot, createdAt: serverTimestamp() }, { merge: true });
}

/**
 * group_history + student_snapshot çiftini atomik olarak yazar.
 * Transfer, mezuniyet ve enrollment tetikleyicilerinde kullan.
 */
export async function writeHistoryAndSnapshot(
  studentId: string,
  history: GroupHistoryEntry,
  snapshot: StudentSnapshot,
): Promise<void> {
  const batch = writeBatch(db);
  batchAddGroupHistory(batch, studentId, history);
  batchUpsertSnapshot(batch, snapshot);
  await batch.commit();
}

// ── Backfill ──────────────────────────────────────────────────────────────────

interface RawStudent {
  id: string;
  groupId?: string;
  groupCode?: string;
  lastGroupId?: string;
  lastGroupCode?: string;
  status?: string;
  grafik1Code?: string;
  grafik2Code?: string;
  [key: string]: unknown;
}

interface RawGroup {
  id: string;
  module?: string;
  discipline?: string;
  instructorId?: string;
  startDate?: string;
}

/**
 * Tek seferlik migration: mevcut öğrenciler için group_history ve
 * son 6 aylık student_snapshots oluşturur.
 *
 * - Zaten kaydı olan öğrencileri atlar (idempotent).
 * - Firestore 500 yazma limitine göre otomatik batch böler.
 *
 * @returns { processed, skipped, errors }
 */
export async function backfillStudentHistory(
  onProgress?: (msg: string) => void,
): Promise<{ processed: number; skipped: number; errors: number }> {
  const log = (msg: string) => { onProgress?.(msg); console.log("[backfill]", msg); };

  // Tüm aktif + pasif öğrencileri çek
  const studentsSnap = await getDocs(collection(db, "students"));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as RawStudent));
  log(`${students.length} öğrenci bulundu.`);

  // Tüm grupları çek (module + discipline için)
  const groupsSnap = await getDocs(collection(db, "groups"));
  const groupMap = new Map<string, RawGroup>(
    groupsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as RawGroup])
  );

  const today = toDateKey();
  const currentMonth = toMonthKey();

  // Son 6 ay listesi
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(toMonthKey(d));
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Zaten group_history'si olan öğrencileri bul
  const existingSnap = await getDocs(
    query(collection(db, "student_snapshots"), where("month", "==", currentMonth))
  );
  const alreadyMigrated = new Set(existingSnap.docs.map(d => d.data().studentId as string));

  // Batch pool — Firestore 500 yazma limiti
  let batch = writeBatch(db);
  let opCount = 0;

  const flush = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  };

  const addToBatch = (fn: (b: WriteBatch) => void) => {
    fn(batch);
    opCount++;
    // Güvenli limit: 490 (bazı operasyonlar çift sayılabilir)
    if (opCount >= 490) return flush();
    return Promise.resolve();
  };

  for (const student of students) {
    try {
      if (alreadyMigrated.has(student.id)) { skipped++; continue; }

      const isActive = student.status !== "passive";
      const currentGroup = student.groupId && student.groupId !== "unassigned"
        ? groupMap.get(student.groupId) : null;

      // ── group_history: mevcut grup ─────────────────────────────────────
      if (currentGroup || (student.groupId && student.groupId !== "unassigned")) {
        const entry: GroupHistoryEntry = {
          groupId:      student.groupId ?? "",
          groupCode:    student.groupCode ?? "",
          module:       currentGroup?.module ?? "",
          branch:       currentGroup?.discipline ?? "",
          instructorId: currentGroup?.instructorId ?? null,
          startDate:    currentGroup?.startDate ?? null,
          endDate:      isActive ? "9999-12-31" : today, // 9999 = hâlâ devam ediyor
          reason:       "enrollment",
          paymentStatus: "unknown",
        };
        await addToBatch(b => batchAddGroupHistory(b, student.id, entry));
      }

      // ── student_snapshots: son 6 ay ───────────────────────────────────
      for (const month of months) {
        const snap: StudentSnapshot = {
          studentId:     student.id,
          month,
          groupId:       student.groupId ?? "",
          groupCode:     student.groupCode ?? "",
          module:        currentGroup?.module ?? "",
          branch:        currentGroup?.discipline ?? "",
          isActive,
          paymentStatus: "unknown",
          reason:        "enrollment",
        };
        await addToBatch(b => batchUpsertSnapshot(b, snap));
      }

      processed++;
      if (processed % 50 === 0) log(`${processed} öğrenci işlendi...`);

    } catch (e) {
      errors++;
      console.error(`[backfill] ${student.id} hatası:`, e);
    }
  }

  await flush();
  log(`Tamamlandı — işlendi: ${processed}, atlandı: ${skipped}, hata: ${errors}`);
  return { processed, skipped, errors };
}
