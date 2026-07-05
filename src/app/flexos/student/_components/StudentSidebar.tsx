"use client";

/**
 * FlexOS · Öğrenci portalı — paylaşımlı sidebar.
 * Canlıdaki `StudentSidebar` ile aynı görsel/işleyiş — SVG karakter avatarı, Sınıflar Ligi
 * ve Ayarlar linki bilinçli olarak YOK (initials-avatar kararı + lig ayrı roadmap kalemi,
 * bkz. FLEXOS.md Faz 3 notu).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, LogOut } from "lucide-react";
import FlexLogo from "@/app/components/ui/FlexLogo";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

export default function StudentSidebar({ personId }: { personId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "flex-token=; path=/; max-age=0";
    router.push("/login");
  };

  const isHome = pathname === `/flexos/student/${personId}`;

  return (
    <div className="flex flex-col h-full bg-base-primary-900 text-white select-none">
      <div className="p-[40px_40px_0_40px]">
        <Link href={`/flexos/student/${personId}`}>
          <FlexLogo />
        </Link>
      </div>

      <div className="flex-1 px-4 mt-16 space-y-3">
        <Link
          href={`/flexos/student/${personId}`}
          className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all ${
            isHome ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <BookOpen size={18} className={isHome ? "text-designstudio-primary-500 shrink-0" : "shrink-0"} />
          <span className="text-[14px] font-semibold leading-none">Ödevlerim</span>
        </Link>
      </div>

      <div className="px-4 pb-4">
        <div
          onClick={handleLogout}
          className="flex items-center gap-4 px-6 py-4 text-white cursor-pointer hover:bg-white/5 transition-all duration-200 group rounded-xl"
        >
          <span className="transition-colors duration-200 group-hover:text-designstudio-primary-500">
            <LogOut size={18} />
          </span>
          <span className="text-[15px] font-medium leading-tight">Çıkış Yap</span>
        </div>
      </div>
    </div>
  );
}
