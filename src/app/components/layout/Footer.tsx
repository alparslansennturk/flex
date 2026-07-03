"use client";

import { useRouter } from "next/navigation";
import FlexLogo from "@/app/components/ui/FlexLogo";

export default function Footer({ mini = false, containerClassName }: { mini?: boolean; containerClassName?: string }) {
  const router = useRouter();

  const socialIcons = [
    { name: 'linkedin', src: '/icons/linkedin.svg' },
    { name: 'facebook', src: '/icons/facebook.svg' },
    { name: 'x', src: '/icons/x.svg' },
    { name: 'instagram', src: '/icons/instagram.svg' }
  ];

  // Varsayılan genişlik sınıfı DEĞİŞMEDİ (mevcut ~15 canlı çağıran etkilenmez) — sadece
  // ihtiyacı olan çağıran (ör. FlexOS, header'ıyla piksel hizalı olsun diye) override edebilir.
  const widthClass = containerClassName ?? "w-[94%] mx-auto max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[2000px]";

  return (
    <footer className="w-full bg-[#10294C] border-t border-white/5 mt-auto font-inter shrink-0">
      <div className={`${widthClass} flex items-center justify-between ${mini ? "h-14" : "py-6 min-h-[80px]"}`}>

        <div
          className="flex items-center gap-1 select-none cursor-pointer"
          onClick={() => router.push('/dashboard')}
        >
          <FlexLogo width={64} />
        </div>

        {mini ? (
          <p className="text-[11px] font-normal text-white/80 tracking-wide">
            Copyright © Alparslan Şentürk {new Date().getFullYear()}. Tüm Hakları Saklıdır.
          </p>
        ) : (
          <div className="flex flex-col items-end justify-center">
            <div className="flex items-center gap-4 mb-3">
              {socialIcons.map((icon) => (
                <div
                  key={icon.name}
                  className="w-6 h-6 flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95"
                >
                  <img src={icon.src} className="w-full h-full object-contain brightness-0 invert" alt={icon.name} />
                </div>
              ))}
            </div>
            <p className="text-[12px] font-normal text-white/80 tracking-wide">
              Copyright © Alparslan Şentürk 2026. Tüm Hakları Saklıdır.
            </p>
          </div>
        )}
      </div>
    </footer>
  );
}
