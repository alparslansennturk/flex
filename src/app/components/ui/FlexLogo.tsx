"use client";

const LOGO_SRC = "/assets/flex-logo-white.svg";

interface FlexLogoProps {
  width?: number;
  className?: string;
  alt?: string;
}

export default function FlexLogo({ width = 84, className, alt = "Flex" }: FlexLogoProps) {
  return (
    <img src={LOGO_SRC} width={width} className={className} alt={alt} />
  );
}
