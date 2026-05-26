"use client";

export type FlexLogoVariant =
  | "eğitmen"
  | "öğrenci"
  | "satış"
  | "eğitim operasyon"
  | "yönetim";

interface FlexLogoProps {
  variant?: FlexLogoVariant;
  size?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: { flex: "text-[18px]", tag: "text-[11px]" },
  md: { flex: "text-[22px]", tag: "text-[13px]" },
  lg: { flex: "text-[26px]", tag: "text-[14px]" },
};

export default function FlexLogo({ variant, size = "md" }: FlexLogoProps) {
  const s = SIZE[size];
  return (
    <div className="flex items-baseline gap-[5px] select-none" style={{ fontFamily: "var(--font-rubik), sans-serif" }}>
      <span className={`${s.flex} font-bold text-white tracking-[-0.03em] leading-none`}>
        flex
      </span>
      {variant && (
        <span className={`${s.tag} font-medium text-white/40 tracking-tight leading-none`}>
          — {variant}
        </span>
      )}
    </div>
  );
}
