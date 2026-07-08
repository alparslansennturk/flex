import type { EntityId, ISODateTime, TenantId } from "../base";
import type { CollageItem } from "./collage-pool";
import type { BookItem } from "./book-pool";
import type { SocialDrawItem } from "./social-pool";

/**
 * ÇEKİLİŞ SONUCU — canlıdaki `lottery_results/{taskId}` dokümanının karşılığı.
 * Doküman id = assignmentId (tek çekiliş oturumu = tek Assignment).
 *
 * **Snapshot semantiği** (canlıdaki davranışla birebir): `item` burada tam kopya
 * olarak saklanır, referans (id) değil — havuz sonradan düzenlense bile geçmiş
 * çekilişler DEĞİŞMEZ. `item` türü havuz türüne göre değişir (Kolaj→`CollageItem`,
 * Kitap→`BookItem`, Sosyal→`SocialDrawItem` — zengin alanları kayıpsız saklamak için).
 */
export interface StudentDraw {
  studentId: EntityId;
  draws: { category: string; item: CollageItem | BookItem | SocialDrawItem }[];
}

export interface LotteryResult {
  id: EntityId; // = assignmentId
  tenantId: TenantId;
  assignmentId: EntityId;
  draws: StudentDraw[];
  /** PDF üretilip mail'e eklendikten sonra Drive linki — indirilebilir arşiv için. */
  driveFiles?: Record<EntityId, { url: string; fileName: string }>;
  updatedAt?: ISODateTime;
}

/**
 * ARŞİV SNAPSHOT'I — canlıdaki `assignment_archive/{taskId}` karşılığı. Her çekimde
 * güncellenir (yarım bırakılsa bile arşivde görünsün diye) — `LotteryResult` ile
 * içerik olarak örtüşür ama task/assignment silinse bile hayatta kalması amaçlanır.
 */
export interface LotteryArchive {
  id: EntityId; // = assignmentId
  tenantId: TenantId;
  assignmentId: EntityId;
  groupId: EntityId;
  taskName: string;
  type: "kolaj" | "kitap" | "sosyal";
  draws: StudentDraw[];
  students: { id: EntityId; name: string; lastName: string }[];
  completedAt: ISODateTime;
}
