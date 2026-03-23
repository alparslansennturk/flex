// ─── Ortak tipler — tüm oyun ekranları bu tipleri kullanır ───────────────────

export interface Student {
  id: string;
  name: string;
  lastName: string;
  email?: string;
}

export interface TaskData {
  id: string;
  name: string;
  classId?: string;
  groupId?: string;
  level?: string;
  endDate?: string;
  status?: string;
}

export interface DrawResultItem {
  name: string;
  emoji?: string;
}

export interface DrawResult {
  category: string;
  item: DrawResultItem;
}

export interface StudentDraw {
  studentId: string;
  draws: DrawResult[];
}

export type Phase = "idle" | "picking" | "ready" | "drawing" | "done";
