"use client";

/**
 * Sertifika Notu + Ödev Notu'nun sol "Gruplar" paneli — ikisi de BİREBİR aynı
 * görünüm/davranışı istediği için buraya çıkarıldı (2026-07-16). Aktif/Tamamlanan
 * gruplar akordiyon (framer-motion height anim, Tamamlanan varsayılan KAPALI).
 * Not girişi/puanlama mantığı grup durumuna hiç bakmaz — bu panel SADECE görsel
 * gruplama, Tamamlanan bir grup seçilse de üst bileşenin seçim akışı değişmez.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Check, ChevronDown } from "lucide-react";

export interface GroupPanelItem { id: string; code: string; branch: string; enrolled: number; status?: string }

/** Varsayılan seçim — Aktif Gruplar'daki İLK grup (API sırası korunur). Hiç aktif grup
 * yoksa (hepsi Tamamlanan/Arşiv) ilk gruba düşülür (2026-07-16 kullanıcı kararı: sayfa
 * açılışında Tamamlanan bir grup değil, listedeki en üstteki Aktif grup seçili gelmeli). */
export function firstActiveGroupId(groups: GroupPanelItem[]): string | undefined {
  return groups.find((g) => g.status !== "completed" && g.status !== "archived")?.id ?? groups[0]?.id;
}

export const GROUP_COLORS = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#1CB5AE", "#F91079"];
export function groupColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

function GroupListButton({ group, active, onSelect }: { group: GroupPanelItem; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-[11px] py-[11px] px-3 rounded-[13px] cursor-pointer transition-all"
      style={{
        border: active ? "1px solid #AECBF2" : "1px solid #EEF0F3",
        background: active ? "#EFF5FE" : "#fff",
        boxShadow: active ? "0 4px 14px -8px rgba(32,82,151,.4)" : "none",
      }}
    >
      <div className="rounded-full shrink-0" style={{ width: 4, alignSelf: "stretch", minHeight: 30, background: groupColor(group.id) }} />
      <div className="flex-1 min-w-0 text-left">
        <div className="text-[13.5px] font-extrabold text-[#1E222B] tracking-tight">{group.code}</div>
        <div className="text-[11px] text-[#8E95A3] font-medium mt-0.5">{group.branch} • {group.enrolled} öğrenci</div>
      </div>
      {active && <Check size={16} strokeWidth={2.6} color="#205297" className="shrink-0" />}
    </button>
  );
}

function GroupSection({
  title, groups, open, onToggle, selectedId, onSelect,
}: {
  title: string; groups: GroupPanelItem[]; open: boolean; onToggle: () => void;
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-col">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-1 py-1.5 cursor-pointer">
        <p className="text-[13px] font-bold text-[#5B6472] tracking-wide">{title}</p>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} className="flex shrink-0">
          <ChevronDown size={15} className="text-[#8E95A3]" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex flex-col gap-[7px] pt-2">
              {groups.map((g) => (
                <GroupListButton key={g.id} group={g} active={g.id === selectedId} onSelect={() => onSelect(g.id)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GroupSelectPanel({
  groups, loading, selectedId, onSelect, subtitle = "Not vermek için seçin",
}: {
  groups: GroupPanelItem[]; loading: boolean; selectedId: string | null; onSelect: (id: string) => void; subtitle?: string;
}) {
  const [activeOpen, setActiveOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const completedGroups = groups.filter((g) => g.status === "completed" || g.status === "archived");
  const activeGroups = groups.filter((g) => g.status !== "completed" && g.status !== "archived");

  return (
    // FlexSidebar İLE AYNI desen (2026-07-16 kararı): sticky/fixed pozisyon numarası
    // YOK — bu panel sadece sabit genişlikli (280px), TAM YÜKSEKLİKTE (h-full) ve
    // kendi `overflow:hidden`'ına sahip normal bir flex sütunu. Sağdaki kardeşi
    // (Not/Ödev tablosu) kendi `overflow-y-auto`'suyla kayar, bu panel hiç
    // kaymaz çünkü scroll'un olduğu kapsayıcının İÇİNDE değil, DIŞINDA/yanında.
    <div
      className="bg-white border border-[#E2E5EA] rounded-[20px] p-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] flex flex-col shrink-0"
      style={{ width: 280, height: "100%", overflow: "hidden" }}
    >
      <div className="flex items-center gap-[9px] mb-4 shrink-0">
        <div className="w-8 h-8 rounded-[10px] bg-[#DDE8F8] text-[#205297] flex items-center justify-center">
          <BookOpen size={17} />
        </div>
        <div>
          <div className="text-[14px] font-extrabold text-[#1E222B] tracking-tight">Gruplar</div>
          <div className="text-[11px] text-[#8E95A3] font-medium">{subtitle}</div>
        </div>
      </div>
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-[12px] text-[#8E95A3] py-4 text-center">Yükleniyor…</p>
        ) : groups.length === 0 ? (
          <p className="text-[12px] text-[#8E95A3] py-4 text-center">Henüz grup yok.</p>
        ) : (
          <>
            <GroupSection
              title="Aktif Gruplar" groups={activeGroups} open={activeOpen}
              onToggle={() => setActiveOpen((v) => !v)} selectedId={selectedId} onSelect={onSelect}
            />
            <GroupSection
              title="Tamamlanan Gruplar" groups={completedGroups} open={completedOpen}
              onToggle={() => setCompletedOpen((v) => !v)} selectedId={selectedId} onSelect={onSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}
