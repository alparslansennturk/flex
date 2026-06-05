"use client";

const LOGOS = {
  white: "/assets/flex-logo-white.svg",
  dark:  "/assets/flex-logo.svg",
};

interface FlexLogoProps {
  width?: number;
  className?: string;
  alt?: string;
  variant?: "white" | "dark";
}

export default function FlexLogo({ width, className, alt = "Flex", variant = "white" }: FlexLogoProps) {
  return (
    <img
      src={LOGOS[variant]}
      width={width}
      className={className ?? (!width ? "w-[60px] md:w-[76px]" : undefined)}
      alt={alt}
    />
  );
}
