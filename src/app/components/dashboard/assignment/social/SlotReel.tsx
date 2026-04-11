"use client";

import { useEffect, useRef, useState } from "react";

interface SlotReelProps {
  items: string[];
  isSpinning: boolean;
  finalIndex: number;
  delay: number;
  label: string;
  isWinner?: boolean;
  accentColor?: string;
}

export function SlotReel({
  items,
  isSpinning,
  finalIndex,
  delay,
  label,
  isWinner,
  accentColor = "#a855f7",
}: SlotReelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStopped, setIsStopped] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef  = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSpinning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current)  clearTimeout(timeoutRef.current);
      setCurrentIndex(finalIndex);
      setIsStopped(true);
      return;
    }

    if (isSpinning) {
      setIsStopped(false);
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % items.length);
      }, 60);

      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        let slowIndex = 0;
        const slowDown = setInterval(() => {
          slowIndex++;
          setCurrentIndex(prev => (prev + 1) % items.length);
          if (slowIndex > 8) {
            clearInterval(slowDown);
            setCurrentIndex(finalIndex);
            setIsStopped(true);
          }
        }, 100 + slowIndex * 40);
      }, delay);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    };
  }, [isSpinning, delay, finalIndex, items.length]);

  const borderColor = isWinner
    ? accentColor
    : !isStopped
    ? `${accentColor}99`
    : "rgba(255,255,255,0.12)";

  const boxShadow = isWinner
    ? `0 0 32px ${accentColor}55`
    : !isStopped
    ? `0 0 20px ${accentColor}33`
    : "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.38)",
      }}>
        {label}
      </span>

      <div style={{
        position: "relative",
        width: 220,
        height: 112,
        overflow: "hidden",
        borderRadius: 16,
        border: `2.5px solid ${borderColor}`,
        background: "rgba(255,255,255,0.04)",
        boxShadow,
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}>
        {/* Gradient overlays */}
        <div style={{
          position: "absolute", inset: 0, top: 0, height: 28, zIndex: 10,
          background: "linear-gradient(to bottom, rgba(13,21,38,0.9), transparent)",
        }} />
        <div style={{
          position: "absolute", inset: 0, top: "auto", bottom: 0, height: 28, zIndex: 10,
          background: "linear-gradient(to top, rgba(13,21,38,0.9), transparent)",
        }} />

        {/* Text */}
        <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
          <span style={{
            fontSize: 20,
            fontWeight: 800,
            textAlign: "center",
            padding: "0 16px",
            letterSpacing: "-0.01em",
            filter: !isStopped ? "blur(2px)" : "none",
            color: isWinner ? accentColor : !isStopped ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.90)",
            transition: "color 0.2s, filter 0.15s",
          }}>
            {items[currentIndex] ?? "—"}
          </span>
        </div>

        {/* Spin glow */}
        {!isStopped && (
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(90deg, ${accentColor}18, transparent, ${accentColor}18)`,
            animation: "pulse 1s ease-in-out infinite",
          }} />
        )}
      </div>
    </div>
  );
}
