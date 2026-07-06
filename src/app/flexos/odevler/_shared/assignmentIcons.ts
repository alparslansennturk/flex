import type { LucideIcon } from "lucide-react";
import {
  PenLine, Image as ImageIcon, BookOpen, LayoutGrid, Code2, Palette, Camera, Film, Music,
  BarChart3, Calculator, Globe, FlaskConical, Presentation, Target, Lightbulb,
} from "lucide-react";

/**
 * Ödev/şablon ikon seçimi — "Ödev Ekle" modalı (`egitmen-anasayfa/OdevOlusturModal.tsx`)
 * ile Şablon Yönetimi'nin oluştur/düzenle modalı (`odevler/yonetim/page.tsx`) AYNI ikon
 * setini kullanır — tek kaynak, ikisi de buradan besleniyor.
 */
export const ASSIGNMENT_ICONS: Record<string, LucideIcon> = {
  pen: PenLine, image: ImageIcon, book: BookOpen, layout: LayoutGrid, code: Code2,
  palette: Palette, camera: Camera, film: Film, music: Music, chart: BarChart3,
  calc: Calculator, globe: Globe, flask: FlaskConical, presentation: Presentation,
  target: Target, lightbulb: Lightbulb,
};
export const ASSIGNMENT_ICON_KEYS = Object.keys(ASSIGNMENT_ICONS);

export const ASSIGNMENT_KIND_OPTIONS: Array<{ key: "normal" | "proje"; label: string }> = [
  { key: "normal", label: "Ödev" },
  { key: "proje", label: "Proje" },
];
