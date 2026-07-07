// FlexOS · Kitap Dünyası — `flexos/kolaj/types.ts` ile aynı desen, kategori yerine
// zengin `BookItem` (kategori kavramı yok, tek "deste").

export interface Student {
  id: string;
  name: string;
  lastName: string;
}

export interface BookItem {
  id: string;
  bookId: string;
  title: string;
  author: string;
  genre: string;
  subGenre: string;
  isbn: string;
  publisher: string;
  pageCount: string;
  dimensions: string;
  backCover: string;
}

export interface DrawResult {
  category: string; // sabit "Kitap"
  item: BookItem;
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
