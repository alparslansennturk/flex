"use client";

/**
 * FlexOS · Öğrenci portalı — paylaşımlı üst başlık.
 * Canlıdaki `StudentHeader` ile aynı görsel/işleyiş — TEK fark: SVG karakter avatarı yerine
 * FlexOS'un her yerinde kullandığı initials+gradient daire (bkz. FLEXOS.md Faz 3 notu).
 * Bildirim zili GERÇEK (`NotificationBell`, `users/{uid}/notifications` — canlıdaki
 * `complete-upload`/comment-service'in yazdığı AYNI koleksiyon, zaten global toast da var).
 */

import NotificationBell from "@/app/components/notifications/NotificationBell";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toLocaleUpperCase("tr");
}

interface Props {
  studentName: string;
  groupCode?: string;
}

export default function StudentHeader({ studentName, groupCode }: Props) {
  const firstName = studentName.split(" ")[0] || "";

  return (
    <header className="w-full bg-white border-b border-surface-200 font-inter shrink-0">
      <div className="max-w-[1920px] mx-auto h-20 flex items-center justify-between px-8">
        <div className="flex items-center gap-4 truncate pr-4">
          <div className="truncate">
            <h1
              className="text-[clamp(18px,1.2vw,22px)] text-base-primary-900 leading-tight"
              style={{ fontWeight: 630, letterSpacing: "-0.022em" }}
            >
              {`Hoş Geldin, ${firstName} 😊`}
            </h1>
            <p className="text-[14px] text-neutral-400 font-medium mt-0.5 truncate leading-none">
              Bugün ödevlerini kontrol etmeyi unutma.
            </p>
          </div>
        </div>

        <div className="flex items-center shrink-0">
          <NotificationBell />
          <div className="h-8 w-px bg-surface-200 mx-5" />

          <div className="text-right hidden md:block">
            <p className="text-[14px] 2xl:text-[16px] text-base-primary-900 font-bold leading-none mb-1 whitespace-nowrap">
              {studentName}
            </p>
            <p className="text-[12px] 2xl:text-[13px] text-neutral-400 font-medium whitespace-nowrap">
              {groupCode ? `${groupCode} | Öğrenci` : "Öğrenci"}
            </p>
          </div>

          <div className="h-8 w-px bg-surface-200 mx-4" />
          <div
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-[13px] font-bold shadow-sm"
            style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)" }}
          >
            {initials(studentName || "?")}
          </div>
        </div>
      </div>
    </header>
  );
}
