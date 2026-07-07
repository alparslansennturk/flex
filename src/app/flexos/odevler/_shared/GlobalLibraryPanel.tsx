"use client";

/**
 * Ödev Yönetimi — Global Kütüphane sekmesi (2026-07-07 kararı). Henüz kişisel
 * kütüphaneye eklenmemiş global OYUNLAŞTIRILMIŞ şablonları listeler (branşa göre
 * zaten `GET /api/flexos/assignment-templates` — kişisel+global birlikte döner,
 * burada `visible` filtresi UYGULANMAZ — o filtre Ana Sayfa Kütüphanesi'ne özel).
 * "Kütüphaneme Ekle" → kişisel klon + kendi bağımsız havuz kopyası oluşturur.
 */
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { ASSIGNMENT_ICONS } from "./assignmentIcons";

interface TemplateItem {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  branch?: string;
  icon?: string;
  scope?: "personal" | "global";
  trainerId?: string;
  sourceTemplateId?: string;
  gamifiedType?: "kolaj";
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function GlobalLibraryPanel() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/assignment-templates", { headers });
      if (res.ok) {
        const data = await res.json() as { items: TemplateItem[] };
        setTemplates(data.items);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const clonedSourceIds = new Set(
    templates.filter((t) => t.scope === "personal" && t.sourceTemplateId).map((t) => t.sourceTemplateId as string),
  );
  const available = templates.filter((t) => t.scope === "global" && t.gamifiedType && !clonedSourceIds.has(t.id));

  async function handleAdd(t: TemplateItem) {
    setAddingId(t.id);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/collage-pool/add-to-library", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ globalTemplateId: t.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Eklenemedi.");
        return;
      }
      toast.success(`"${t.title}" kütüphanenize eklendi.`);
      await load();
    } finally {
      setAddingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-surface-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-surface-100 flex flex-col items-center justify-center py-20 gap-2 text-surface-300">
        <Sparkles size={32} className="opacity-40" />
        <p className="text-[14px] font-bold text-surface-500">Eklenecek yeni bir oyunlaştırılmış şablon yok</p>
        <p className="text-[12.5px] text-surface-400">Zaten tüm uygun şablonları kütüphanenize eklediniz.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {available.map((t) => {
        const Icon = (t.icon && ASSIGNMENT_ICONS[t.icon]) || Sparkles;
        const isAdding = addingId === t.id;
        return (
          <div key={t.id} className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-purple-50 text-purple-600">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-text-primary truncate">{t.title}</p>
                {t.subtitle && <p className="text-[12px] text-surface-400 truncate">{t.subtitle}</p>}
              </div>
            </div>
            <p className="text-[12.5px] text-surface-500 line-clamp-2 flex-1">{t.description}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-600">
                <Sparkles size={11} /> Oyunlaştırılmış
              </span>
              <button
                onClick={() => handleAdd(t)}
                disabled={isAdding}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white cursor-pointer disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)" }}
              >
                {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Kütüphaneme Ekle
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
