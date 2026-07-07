import type { LotteryArchive, LotteryResult } from "../core/lottery-result";

export interface LotteryResultRepo {
  get(assignmentId: string): Promise<LotteryResult | null>;
  save(result: LotteryResult): Promise<void>;
  getArchive(assignmentId: string): Promise<LotteryArchive | null>;
  saveArchive(archive: LotteryArchive): Promise<void>;
}
