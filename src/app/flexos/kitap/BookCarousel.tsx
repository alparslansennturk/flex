"use client";

// Canlıdaki `kitap/BookGameScreen.tsx` içindeki carousel bölümünün (satır 31-314)
// birebir portu — BookCover, COVER_PALETTES, useCarouselSize, BookCarousel.
import { useState, useRef, useEffect, useMemo } from "react";
import type { BookItem } from "./types";

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function useCarouselSize() {
  const [isLarge, setIsLarge] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1920 : false,
  );
  useEffect(() => {
    const update = () => setIsLarge(window.innerWidth >= 1920);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return {
    BOOK_WIDTH: isLarge ? 160 : 120,
    carouselHeight: isLarge ? 320 : 230,
    carouselPadding: isLarge ? "p-8" : "p-5",
    gamepadPaddingTop: isLarge ? 64 : 32,
    gamepadPaddingBot: isLarge ? 32 : 24,
    nameMarginTop: isLarge ? 32 : 12,
    nameMarginBottom: isLarge ? 32 : 16,
    nameFontSize: isLarge ? 44 : 34,
    bottomBarHeight: isLarge ? 88 : 64,
    resultTitleCls: isLarge ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl",
    resultAuthorCls: isLarge ? "text-xl" : "text-base",
    resultSpaceCls: isLarge ? "space-y-3" : "space-y-2",
    resultMtCls: isLarge ? "mt-8" : "mt-4",
  };
}

const COVER_PALETTES = [
  { coverGradient: "from-emerald-800 via-emerald-900 to-black", textColor: "text-amber-300", accentColor: "bg-amber-400" },
  { coverGradient: "from-red-900 via-red-950 to-black", textColor: "text-white", accentColor: "bg-red-500" },
  { coverGradient: "from-rose-200 via-rose-300 to-rose-400", textColor: "text-rose-900", accentColor: "bg-rose-600" },
  { coverGradient: "from-amber-700 via-amber-800 to-amber-950", textColor: "text-amber-100", accentColor: "bg-amber-500" },
  { coverGradient: "from-orange-600 via-orange-800 to-amber-950", textColor: "text-orange-100", accentColor: "bg-orange-400" },
  { coverGradient: "from-slate-700 via-slate-800 to-slate-950", textColor: "text-slate-100", accentColor: "bg-slate-400" },
  { coverGradient: "from-sky-700 via-sky-900 to-slate-950", textColor: "text-sky-100", accentColor: "bg-sky-400" },
  { coverGradient: "from-violet-800 via-violet-900 to-black", textColor: "text-violet-200", accentColor: "bg-violet-400" },
  { coverGradient: "from-stone-600 via-stone-800 to-stone-950", textColor: "text-stone-100", accentColor: "bg-stone-400" },
  { coverGradient: "from-zinc-800 via-zinc-900 to-black", textColor: "text-zinc-200", accentColor: "bg-zinc-500" },
];

interface CoverBook extends BookItem {
  coverGradient: string;
  textColor: string;
  accentColor: string;
}

function toCoverBooks(items: BookItem[]): CoverBook[] {
  return items.map((b, i) => ({ ...b, ...COVER_PALETTES[i % COVER_PALETTES.length] }));
}

function BookCover({ book, isCenter, shouldBlurText }: { book: CoverBook; isCenter: boolean; shouldBlurText: boolean }) {
  const textBlur = shouldBlurText ? "blur-[6px]" : "blur-0";
  return (
    <div
      className={cn(
        "relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-sm shadow-md transition-all duration-300",
        `bg-gradient-to-br ${book.coverGradient}`,
        isCenter && "ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/20",
      )}
    >
      <div className="absolute left-0 top-0 h-full w-2 bg-black/40" />
      <div className={cn("mx-4 mt-4 h-0.5", book.accentColor)} />
      <div className="mt-2 px-4">
        <span className={cn("text-[8px] font-medium uppercase tracking-widest opacity-70 transition-all duration-300", book.textColor, textBlur)}>
          {book.genre}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center px-4">
        <h3 className={cn("text-center text-xs font-bold leading-tight transition-all duration-300", book.textColor, textBlur)}>
          {book.title}
        </h3>
      </div>
      <div className={cn("mx-4 mb-4 h-0.5", book.accentColor)} />
      <div className="pb-3 text-center">
        <span className={cn("text-[7px] font-medium opacity-80 transition-all duration-300", book.textColor, textBlur)}>
          {book.author}
        </span>
      </div>
      <div className="absolute bottom-0 right-0 top-0 w-1 bg-gradient-to-r from-transparent via-white/10 to-white/20" />
    </div>
  );
}

const VISIBLE_BOOKS = 6;

export default function BookCarousel({
  allBooks, winnerBook, onSpinComplete, bookWidth, carouselHeight, carouselPadding,
}: {
  allBooks: BookItem[];
  winnerBook: BookItem;
  onSpinComplete: () => void;
  bookWidth: number;
  carouselHeight: number;
  carouselPadding: string;
}) {
  const TOTAL_WIDTH = allBooks.length * bookWidth;

  const [offset, setOffset] = useState(TOTAL_WIDTH * 2);
  const [spinStatus, setSpinStatus] = useState<"spinning" | "slowing" | "stopped">("spinning");
  const [centerBookIndex, setCenterBookIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(VISIBLE_BOOKS * bookWidth + 100);

  const coverBooks = useMemo(() => toCoverBooks(allBooks), [allBooks]);
  const extendedBooks = useMemo(
    () => [...coverBooks, ...coverBooks, ...coverBooks, ...coverBooks, ...coverBooks],
    [coverBooks],
  );

  const winnerIdx = useMemo(() => {
    const idx = allBooks.findIndex((b) => b.id === winnerBook.id);
    return idx >= 0 ? idx : 0;
  }, [allBooks, winnerBook]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const startOffset = TOTAL_WIDTH * 2;
    const fullRotations = 3;
    const targetOffset = (Math.floor(startOffset / TOTAL_WIDTH) + fullRotations + 1) * TOTAL_WIDTH + winnerIdx * bookWidth;
    const totalDuration = 4800;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / totalDuration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);
      let currentOffset = startOffset + easeOut * (targetOffset - startOffset);
      while (currentOffset >= TOTAL_WIDTH * 4) currentOffset -= TOTAL_WIDTH;
      setOffset(currentOffset);
      if (progress >= 0.7) setSpinStatus("slowing");
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        const finalSnapped = Math.round(targetOffset / bookWidth) * bookWidth;
        let normalized = finalSnapped;
        while (normalized >= TOTAL_WIDTH * 3) normalized -= TOTAL_WIDTH;
        while (normalized < TOTAL_WIDTH * 2) normalized += TOTAL_WIDTH;
        setOffset(normalized);
        setCenterBookIndex(winnerIdx);
        setSpinStatus("stopped");
        onSpinComplete();
        setTimeout(() => setShowResult(true), 150);
      }
    };

    const delay = setTimeout(() => { animationRef.current = requestAnimationFrame(animate); }, 150);
    return () => {
      clearTimeout(delay);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSpinning = spinStatus === "spinning" || spinStatus === "slowing";
  const translateX = viewportWidth / 2 - (48 + (bookWidth - 16) / 2) - offset;

  return (
    <div className={`relative w-full rounded-2xl border border-white/10 bg-black/40 ${carouselPadding} shadow-2xl backdrop-blur-sm`}>
      <div className="absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-1">
        <div className="size-0 border-x-8 border-t-8 border-x-transparent border-t-amber-400" />
      </div>
      <div className="absolute bottom-0 left-1/2 z-40 -translate-x-1/2 translate-y-1">
        <div className="size-0 border-x-8 border-b-8 border-x-transparent border-b-amber-400" />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 z-30 -translate-x-1/2 border-x-2 border-amber-400/30"
        style={{ width: bookWidth - 16 }}
      />
      <div
        ref={viewportRef}
        className="relative mx-auto overflow-hidden rounded-lg bg-gradient-to-b from-slate-800/50 to-slate-900/50"
        style={{ width: "100%", maxWidth: `${VISIBLE_BOOKS * bookWidth + 100}px`, height: `${carouselHeight}px` }}
      >
        <div
          className="absolute flex items-center"
          style={{ transform: `translateX(${translateX}px)`, height: "100%", paddingLeft: 48, paddingRight: 48, gap: 16 }}
        >
          {extendedBooks.map((book, index) => {
            const bookIndex = index % allBooks.length;
            const isCenter = spinStatus === "stopped" && showResult && bookIndex === centerBookIndex;
            const shouldBlur = !(spinStatus === "stopped" && showResult && isCenter);
            return (
              <div
                key={`${book.id}-${index}`}
                className={cn("flex-shrink-0 transition-transform", isCenter && "z-50 scale-125")}
                style={{
                  width: `${bookWidth - 16}px`,
                  transitionDuration: isCenter ? "500ms" : "0ms",
                  transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <BookCover book={book} isCenter={isCenter} shouldBlurText={shouldBlur} />
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-slate-900/95 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-slate-900/95 to-transparent" />
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "size-2 rounded-full transition-all duration-150",
              isSpinning ? "animate-pulse bg-amber-400" : spinStatus === "stopped" ? "bg-emerald-400" : "bg-white/20",
            )}
            style={{ animationDelay: isSpinning ? `${i * 80}ms` : "0ms" }}
          />
        ))}
      </div>
    </div>
  );
}
