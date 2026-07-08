// FlexOS · Reklam Tasarımı (Sosyal Medya) — `flexos/kitap/types.ts` ile aynı desen.
// Havuz üç iç içe koleksiyon (Sektörler/Markalar/Formatlar) + ortak amaç/kural.

export interface Student {
  id: string;
  name: string;
  lastName: string;
}

export interface SMBrand {
  id: string;
  brandName: string;
  brandRule: string;
  mainSector: string;
  subSector: string;
  purposes: string[];
}

export interface SMSector {
  id: string;
  name: string;
  subSectors: string[];
}

export interface SMFormat {
  id: string;
  dim: string;
  type: string;
  platform: string;
}

export interface SocialPool {
  id: string;
  tenantId: string;
  trainerId?: string;
  brands: SMBrand[];
  sectors: SMSector[];
  formats: SMFormat[];
  globalPurposes: string[];
  sharedRule: string;
}

// Snapshot semantiği — canlıdaki `FullSMDraw`'ın düz-alan modeliyle birebir.
export interface SocialDrawItem {
  brandName: string;
  sectorDisplay: string;
  brandRule: string;
  purpose: string;
  platform: string;
  contentType: string;
}

export interface DrawResult {
  category: string; // sabit "Reklam"
  item: SocialDrawItem;
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

export type Phase = "idle" | "picking" | "ready" | "spinning" | "result" | "frozen";
