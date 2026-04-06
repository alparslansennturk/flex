import type { LucideIcon } from "lucide-react";
import { Layers, BookOpen, Smartphone } from "lucide-react";

// ─── Firestore lottery_configs doküman tipleri ─────────────────────────────

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

export interface CollagePool {
  id: "lottery_collage";
  assignmentId: "task_collage";
  assignmentName: string;
  items: CollageItem[];
  templateType: "wheel";
  createdAt?: unknown;
}

export interface BookPool {
  id: "lottery_book";
  assignmentId: "task_book";
  assignmentName: string;
  items: BookItem[];
  templateType: "deck";
  createdAt?: unknown;
}

export interface SocialMediaPool {
  id: "lottery_sm";
  assignmentId: "task_sm";
  assignmentName: string;
  brands: SMBrand[];
  sectors: SMSector[];
  formats: SMFormat[];
  sharedRule: string;
  templateType: "grid";
  createdAt?: unknown;
}

export type PoolKey = "collage" | "book" | "socialMedia";

export interface PoolMeta {
  key: PoolKey;
  label: string;
  description: string;
  icon: LucideIcon;
  firestoreId: string;
}

export const POOL_LIST: PoolMeta[] = [
  {
    key: "collage",
    label: "Kolaj Bahçesi",
    description: "Gök, Yer, Obje kategorilerinden oluşan görsel havuz",
    icon: Layers,
    firestoreId: "collage",
  },
  {
    key: "book",
    label: "Kitap Seçimi",
    description: "Öğrencilere çekilişle dağıtılan kitap havuzu",
    icon: BookOpen,
    firestoreId: "book",
  },
  {
    key: "socialMedia",
    label: "Sosyal Medya",
    description: "Marka, sektör ve format havuzu",
    icon: Smartphone,
    firestoreId: "socialMedia",
  },
];
