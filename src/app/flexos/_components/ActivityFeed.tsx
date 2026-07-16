"use client";

/**
 * Paylaşımlı "En Son Aktiviteler" paneli — önceden `egitmen-anasayfa/page.tsx` içinde
 * yerel bileşendi (2026-07-15), öğrenci panosu (`student/[personId]/page.tsx`) da AYNI
 * görünümü kullanmak isteyince buraya çıkarıldı. Eğitmen tarafı `flexos_activity_log`
 * (trainerId bazlı günlük iş logu), öğrenci tarafı kendi teslim/not hareketlerinden
 * (`submission-service.ts::listRecentActivityForStudent`, TAMAMEN ayrı, kalıcı log
 * tutmadan Submission kayıtlarından türetilir) besleniyor — ikisi de aynı öğeye
 * (`ActivityFeedItem`) map ediliyor.
 */

import type { ReactNode } from "react";
import { CalendarCheck, Award, ClipboardList, Activity, Clock } from "lucide-react";

export type ActivityFeedType =
  | "attendance.started"
  | "attendance.updated"
  | "attendance.ended"
  | "grade.given"
  | "submission.created";

export interface ActivityFeedItem {
  id: string;
  type: ActivityFeedType;
  title: string;
  description: string;
  createdAt: string;
}

const ACTIVITY_FEED_CONFIG: Record<ActivityFeedType, { icon: ReactNode; bg: string; color: string; stripe: string }> = {
  "attendance.started": { icon: <CalendarCheck size={13} strokeWidth={2.2} />, bg: "bg-[#EEF4FD]", color: "text-[#3A7BD5]", stripe: "bg-[#3A7BD5]" },
  "attendance.updated": { icon: <CalendarCheck size={13} strokeWidth={2.2} />, bg: "bg-[#EEF4FD]", color: "text-[#3A7BD5]", stripe: "bg-[#3A7BD5]" },
  "attendance.ended":   { icon: <CalendarCheck size={13} strokeWidth={2.2} />, bg: "bg-[#EEF4FD]", color: "text-[#3A7BD5]", stripe: "bg-[#3A7BD5]" },
  "grade.given":        { icon: <Award        size={13} strokeWidth={2.2} />, bg: "bg-[#E6F5ED]", color: "text-[#009F3E]", stripe: "bg-[#009F3E]" },
  "submission.created": { icon: <ClipboardList size={13} strokeWidth={2.2} />, bg: "bg-[#FFF4EB]", color: "text-[#FF8D28]", stripe: "bg-[#FF8D28]" },
};

function activityTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} sa önce`;
  return `${Math.floor(diffH / 24)} gün önce`;
}

export function ActivityFeed({ items, subtitle = "Atölyendeki son hareketler" }: { items: ActivityFeedItem[]; subtitle?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F0F2F6] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#10294C] flex items-center justify-center shrink-0">
            <Activity size={16} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#10294C] leading-none">En Son Aktiviteler</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-none">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-[#10294C]/10 px-2.5 py-1 rounded-full">
          <div className="relative w-1.5 h-1.5">
            <span className="absolute inset-0 bg-[#009F3E] rounded-full animate-ping opacity-75" />
            <span className="relative block w-1.5 h-1.5 bg-[#009F3E] rounded-full" />
          </div>
          <span className="text-[10px] font-bold text-[#10294C]">Canlı</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[12px] text-[#9CA3AF]">
            Henüz aktivite yok
          </div>
        ) : items.map((item, i) => {
          const cfg = ACTIVITY_FEED_CONFIG[item.type];
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[#F9FAFB] transition-colors cursor-default relative
                          ${i < items.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
            >
              <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${cfg.stripe} opacity-70`} />
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5 ml-2`}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold text-[#10294C] leading-snug truncate">{item.title}</p>
                {item.description ? <p className="text-[11.5px] text-[#6B7280] leading-snug line-clamp-2 mt-0.5">{item.description}</p> : null}
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <Clock size={10} className="text-[#C4C9D4]" />
                <span className="text-[10.5px] text-[#C4C9D4] font-medium whitespace-nowrap">{activityTimeAgo(item.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
