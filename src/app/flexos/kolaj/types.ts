// Canlıdaki shared/types.ts karşılığı — sadece Kolaj Bahçesi için gerekli alanlar.
// NOT: email BİLEREK yok — trainer client'ta PII (email) görmemeli, mail gönderimi
// server-side Person.pii.email'den resolve edilir (bkz. /api/flexos/lottery-results/mail).

export interface Student {
  id: string;
  name: string;
  lastName: string;
}

export interface CollageItem {
  id: string;
  name: string;
  category: "Gök" | "Yer" | "Obje 1" | "Obje 2";
  color: string;
  emoji: string;
}

export interface DrawResult {
  category: string;
  item: CollageItem;
}

export interface StudentDraw {
  studentId: string;
  draws: DrawResult[];
}

export interface AssignmentData {
  id: string;
  title: string;
  groupId: string;
  gamifiedType?: string;
  status: "draft" | "published" | "closed" | "archived";
  dueDate?: string;
}

export type Phase = "idle" | "picking" | "ready" | "drawing" | "done";
