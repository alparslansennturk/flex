"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import { Palette, PenTool, Image, Layout, Layers, Scissors, Type, Camera, Frame, Maximize2, Brush, Pencil, BookOpen, Zap, Briefcase, Star } from "lucide-react";

// --- TİPLER ---
export type TaskType = "odev" | "etkinlik" | "proje";
export type FilterTab = "tumu" | TaskType;
export type IconKey = string; // PascalCase Lucide icon adı (ör. "Palette", "Briefcase")

export interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  points: number;
  icon?: IconKey;
  startDate?: string;
  endDate?: string;
  createdAt: any;
  createdBy?: string;
  createdByName?: string;
  branch?: string;
  ownedBy?: string;     // Eğitmene ait klonlarda set edilir; şablonlarda boş
  templateId?: string;  // Kütüphaneden klonlandıysa orijinal şablonun ID'si
  classId?: string;     // Atanan grup kodu (ör. "Grup 101")
  groupId?: string;     // Atanan grubun Firestore doc ID'si
  groupBranch?: string; // Atanan grubun şubesi
  level?: string;       // Atanan seviye (ör. "Seviye-2")
  isActive?: boolean;
  isPaused?: boolean;   // Parkurda kalır ama buton disabled, durum "Pasif"
  isHidden?: boolean;   // Dashboard'dan gizlenir, yalnızca yönetim sayfasında görünür
  status?: 'active' | 'archived' | 'completed'; // Admin panel durum yönetimi
  isGraded?: boolean;   // Not girişi yapıldıysa true
}

// Eski lowercase key'leri PascalCase'e çevir (Firestore'daki eski veriler için)
const LEGACY_KEY_MAP: Record<string, string> = {
  palette: "Palette", pentool: "PenTool", image: "Image", layout: "Layout",
  layers: "Layers", scissors: "Scissors", type: "Type", camera: "Camera",
  frame: "Frame", maximize: "Maximize2", brush: "Brush", pencil: "Pencil",
  bookopen: "BookOpen", zap: "Zap", briefcase: "Briefcase", star: "Star",
};

// Eski ICON_MAP (legacy fallback — kaldırılmamalı)
const ICON_MAP_LEGACY: Record<string, (s: number) => React.ReactNode> = {
  Palette:   (s) => <Palette size={s} />,   PenTool:   (s) => <PenTool size={s} />,
  Image:     (s) => <Image size={s} />,     Layout:    (s) => <Layout size={s} />,
  Layers:    (s) => <Layers size={s} />,    Scissors:  (s) => <Scissors size={s} />,
  Type:      (s) => <Type size={s} />,      Camera:    (s) => <Camera size={s} />,
  Frame:     (s) => <Frame size={s} />,     Maximize2: (s) => <Maximize2 size={s} />,
  Brush:     (s) => <Brush size={s} />,     Pencil:    (s) => <Pencil size={s} />,
  BookOpen:  (s) => <BookOpen size={s} />,  Zap:       (s) => <Zap size={s} />,
  Briefcase: (s) => <Briefcase size={s} />, Star:      (s) => <Star size={s} />,
};

export const DEFAULT_ICON: Record<TaskType, IconKey> = {
  odev: "Palette", proje: "Briefcase", etkinlik: "Zap",
};

// --- RENK SABİTLERİ ---
export const TYPE_GRADIENT: Record<TaskType, string> = {
  odev:     "bg-gradient-to-b from-pink-500 to-[#B80E57]",
  proje:    "bg-gradient-to-b from-[#FF8D28] to-[#D35400]",
  etkinlik: "bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]",
};

export const TYPE_CONFIG: Record<TaskType, { label: string; badgeBg: string; badgeText: string; dot: string }> = {
  odev:     { label: "Ödev",     badgeBg: "bg-base-primary-50",         badgeText: "text-base-primary-500",         dot: "bg-base-primary-400" },
  proje:    { label: "Proje",    badgeBg: "bg-accent-turquoise-100",     badgeText: "text-accent-turquoise-700",     dot: "bg-accent-turquoise-500" },
  etkinlik: { label: "Etkinlik", badgeBg: "bg-designstudio-primary-50", badgeText: "text-designstudio-primary-600", dot: "bg-designstudio-primary-500" },
};

// --- YARDIMCILAR ---
export function TypeBadge({ type }: { type: TaskType }) {
  const c = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${c.badgeBg} ${c.badgeText} text-[11px] font-bold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function getIcon(iconKey: IconKey | undefined, type: TaskType, size: number): React.ReactNode {
  const rawKey = iconKey ?? DEFAULT_ICON[type];
  const key = LEGACY_KEY_MAP[rawKey] ?? rawKey; // lowercase → PascalCase fallback

  // 1. Dinamik Lucide lookup (forwardRef ikonlar "object" tipinde gelir)
  const DynIcon = (LucideIcons as any)[key];
  if (DynIcon != null && (typeof DynIcon === "function" || typeof DynIcon === "object")) {
    const Icon = DynIcon as React.ComponentType<{ size?: number }>;
    return <Icon size={size} />;
  }

  // 2. Legacy map fallback
  const legacyFn = ICON_MAP_LEGACY[key];
  if (legacyFn) return legacyFn(size);

  return <Palette size={size} />;
}
