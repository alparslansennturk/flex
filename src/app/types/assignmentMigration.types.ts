// ─── Kaynak: HTML Firebase Realtime Database ───────────────────────────────

export interface RtdbCollageCategory {
  [itemKey: string]: {
    name?: string;
    color?: string;
    emoji?: string;
    [key: string]: unknown;
  };
}

export interface RtdbCollageItems {
  [category: string]: RtdbCollageCategory | { name?: string; color?: string; emoji?: string };
}

export interface RtdbBookCover {
  bookId?: string;
  title?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  [key: string]: unknown;
}

export interface RtdbBookCovers {
  [key: string]: RtdbBookCover;
}

export interface RtdbSmBrand {
  brandName?: string;
  mainSector?: string;
  subSector?: string;
  purposes?: string[] | Record<string, string>;
  [key: string]: unknown;
}

export interface RtdbSmSector {
  mainSector?: string;
  subSector?: string;
  [key: string]: unknown;
}

export interface RtdbSmFormat {
  dim?: string;
  type?: string;
  platform?: string;
  [key: string]: unknown;
}

// ─── Hedef: Firestore lottery_configs ──────────────────────────────────────

export interface CollageItem {
  id: string;
  name: string;
  category: string;
  color: string;
  emoji: string;
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

export interface SMBrand {
  brandName: string;
  brandRule: string;
  mainSector: string;
  subSector: string;
  purposes: string[];
}

export interface SMSector {
  name: string;
}

export interface SMFormat {
  dim: string;
  type: string;
  platform: string;
}

export interface CollageLotteryConfig {
  id: "lottery_collage";
  assignmentId: "task_collage";
  assignmentName: "Kolaj Bahçesi";
  items: CollageItem[];
  templateType: "wheel";
  createdAt: Date;
}

export interface BookLotteryConfig {
  id: "lottery_book";
  assignmentId: "task_book";
  assignmentName: "Kitap Seçimi";
  items: BookItem[];
  templateType: "deck";
  createdAt: Date;
}

export interface SocialMediaLotteryConfig {
  id: "lottery_sm";
  assignmentId: "task_sm";
  assignmentName: "Sosyal Medya";
  brands: SMBrand[];
  sectors: SMSector[];
  formats: SMFormat[];
  sharedRule: string;
  templateType: "grid";
  createdAt: Date;
}

// ─── Migration result tipleri ───────────────────────────────────────────────

export interface MigrationResult {
  success: boolean;
  message: string;
  count?: number;
  error?: string;
}

export interface MigrationStatus {
  collage: MigrationResult | null;
  book: MigrationResult | null;
  socialMedia: MigrationResult | null;
}

export type MigrationPhase = "collage" | "book" | "socialMedia";
