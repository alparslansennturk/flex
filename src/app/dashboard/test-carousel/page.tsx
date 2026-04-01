"use client"

import * as React from "react"
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}

interface Book {
    id: number
    title: string
    author: string
    coverGradient: string
    textColor: string
    accentColor: string
    genre: string
}

const books: Book[] = [
    {
        id: 1,
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        coverGradient: "from-emerald-800 via-emerald-900 to-black",
        textColor: "text-amber-300",
        accentColor: "bg-amber-400",
        genre: "Classic",
    },
    {
        id: 2,
        title: "1984",
        author: "George Orwell",
        coverGradient: "from-red-900 via-red-950 to-black",
        textColor: "text-white",
        accentColor: "bg-red-500",
        genre: "Dystopian",
    },
    {
        id: 3,
        title: "Pride and Prejudice",
        author: "Jane Austen",
        coverGradient: "from-rose-200 via-rose-300 to-rose-400",
        textColor: "text-rose-900",
        accentColor: "bg-rose-600",
        genre: "Romance",
    },
    {
        id: 4,
        title: "The Hobbit",
        author: "J.R.R. Tolkien",
        coverGradient: "from-amber-700 via-amber-800 to-amber-950",
        textColor: "text-amber-100",
        accentColor: "bg-amber-500",
        genre: "Fantasy",
    },
    {
        id: 5,
        title: "Dune",
        author: "Frank Herbert",
        coverGradient: "from-orange-600 via-orange-800 to-amber-950",
        textColor: "text-orange-100",
        accentColor: "bg-orange-400",
        genre: "Sci-Fi",
    },
    {
        id: 6,
        title: "Jane Eyre",
        author: "Charlotte Bronte",
        coverGradient: "from-slate-700 via-slate-800 to-slate-950",
        textColor: "text-slate-100",
        accentColor: "bg-slate-400",
        genre: "Gothic",
    },
    {
        id: 7,
        title: "Moby Dick",
        author: "Herman Melville",
        coverGradient: "from-sky-700 via-sky-900 to-slate-950",
        textColor: "text-sky-100",
        accentColor: "bg-sky-400",
        genre: "Adventure",
    },
    {
        id: 8,
        title: "Brave New World",
        author: "Aldous Huxley",
        coverGradient: "from-violet-800 via-violet-900 to-black",
        textColor: "text-violet-200",
        accentColor: "bg-violet-400",
        genre: "Dystopian",
    },
    {
        id: 9,
        title: "Wuthering Heights",
        author: "Emily Bronte",
        coverGradient: "from-stone-600 via-stone-800 to-stone-950",
        textColor: "text-stone-100",
        accentColor: "bg-stone-400",
        genre: "Gothic",
    },
    {
        id: 10,
        title: "Crime and Punishment",
        author: "Fyodor Dostoevsky",
        coverGradient: "from-zinc-800 via-zinc-900 to-black",
        textColor: "text-zinc-200",
        accentColor: "bg-zinc-500",
        genre: "Psychological",
    },
]

type SpinState = "idle" | "spinning" | "slowing" | "stopped"

function BookCover({
    book,
    isCenter,
    shouldBlurText
}: {
    book: Book
    isCenter: boolean
    shouldBlurText: boolean
}) {
    const textBlur = shouldBlurText ? "blur-[6px]" : "blur-0"

    return (
        <div
            className={cn(
                "relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-sm shadow-md transition-all duration-300",
                `bg-gradient-to-br ${book.coverGradient}`,
                isCenter && "ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/20"
            )}
        >
            {/* Book spine shadow */}
            <div className="absolute left-0 top-0 h-full w-2 bg-black/40" />

            {/* Top decorative line */}
            <div className={cn("mx-4 mt-4 h-0.5", book.accentColor)} />

            {/* Genre tag */}
            <div className="mt-2 px-4">
                <span className={cn(
                    "text-[8px] font-medium uppercase tracking-widest opacity-70 transition-all duration-300",
                    book.textColor,
                    textBlur
                )}>
                    {book.genre}
                </span>
            </div>

            {/* Title area */}
            <div className="flex flex-1 flex-col justify-center px-4">
                <h3 className={cn(
                    "text-center text-xs font-bold leading-tight transition-all duration-300",
                    book.textColor,
                    textBlur
                )}>
                    {book.title}
                </h3>
            </div>

            {/* Bottom decorative line */}
            <div className={cn("mx-4 mb-4 h-0.5", book.accentColor)} />

            {/* Author */}
            <div className="pb-3 text-center">
                <span className={cn(
                    "text-[7px] font-medium opacity-80 transition-all duration-300",
                    book.textColor,
                    textBlur
                )}>
                    {book.author}
                </span>
            </div>

            {/* Page edges effect */}
            <div className="absolute bottom-0 right-0 top-0 w-1 bg-gradient-to-r from-transparent via-white/10 to-white/20" />
        </div>
    )
}

export default function BookCarousel() {
    const [offset, setOffset] = React.useState(0)
    const [spinState, setSpinState] = React.useState<SpinState>("idle")
    const [selectedBook, setSelectedBook] = React.useState<Book | null>(null)
    const [showSelectedBook, setShowSelectedBook] = React.useState(false)
    const [centerBookIndex, setCenterBookIndex] = React.useState(0)
    const animationRef = React.useRef<number | null>(null)
    const startTimeRef = React.useRef<number>(0)
    const viewportRef = React.useRef<HTMLDivElement>(null)
    const [viewportWidth, setViewportWidth] = React.useState(0)

    const BOOK_WIDTH = 160
    const VISIBLE_BOOKS = 6
    const TOTAL_WIDTH = books.length * BOOK_WIDTH

    // Create extended array for infinite loop effect (5 copies for smooth looping)
    const extendedBooks = React.useMemo(() => {
        return [...books, ...books, ...books, ...books, ...books]
    }, [])

    // Initialize offset to center the books properly
    React.useEffect(() => {
        setOffset(TOTAL_WIDTH * 2)
    }, [TOTAL_WIDTH])

    // Measure actual viewport width for responsive centering
    React.useEffect(() => {
        const el = viewportRef.current
        if (!el) return
        setViewportWidth(el.clientWidth)
        const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const startSpin = React.useCallback(() => {
        if (spinState !== "idle" && spinState !== "stopped") return

        setSpinState("spinning")
        setSelectedBook(null)
        setShowSelectedBook(false)

        const randomFinalBook = Math.floor(Math.random() * books.length)
        const fullRotations = 3
        const startOffset = offset
        // Mutlak slot: her spin sonrası normalizedOffset = TOTAL_WIDTH*2 + randomFinalBook*BOOK_WIDTH
        // (startOffset'e delta eklemek yerine sabit bir base'den hesap yap → birikimli drift yok)
        const targetOffset = (Math.floor(startOffset / TOTAL_WIDTH) + fullRotations + 1) * TOTAL_WIDTH + randomFinalBook * BOOK_WIDTH

        const totalDuration = 4000
        startTimeRef.current = performance.now()

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTimeRef.current
            const progress = Math.min(elapsed / totalDuration, 1)

            // Easing function: starts fast, slows down smoothly
            const easeOut = 1 - Math.pow(1 - progress, 4)

            let currentOffset = startOffset + easeOut * (targetOffset - startOffset)

            // Keep offset within reasonable bounds by wrapping
            while (currentOffset >= TOTAL_WIDTH * 4) {
                currentOffset -= TOTAL_WIDTH
            }

            setOffset(currentOffset)

            if (progress >= 0.7) {
                setSpinState("slowing")
            }

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate)
            } else {
                // BURASI ÇOK KRİTİK: Offset'i en yakın kitabın tam katına yuvarlıyoruz (Mıknatıs Etkisi)
                const finalSnappedOffset = Math.round(targetOffset / BOOK_WIDTH) * BOOK_WIDTH

                let normalizedOffset = finalSnappedOffset
                while (normalizedOffset >= TOTAL_WIDTH * 3) {
                    normalizedOffset -= TOTAL_WIDTH
                }
                while (normalizedOffset < TOTAL_WIDTH * 2) {
                    normalizedOffset += TOTAL_WIDTH
                }

                setOffset(normalizedOffset) // Küsuratsız, tam rakam!
                setCenterBookIndex(randomFinalBook)
                setSpinState("stopped")
                setSelectedBook(books[randomFinalBook])
                setTimeout(() => setShowSelectedBook(true), 150)
            }
        }

        animationRef.current = requestAnimationFrame(animate)
    }, [spinState, offset, TOTAL_WIDTH, BOOK_WIDTH])

    React.useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [])

    const isSpinning = spinState === "spinning" || spinState === "slowing"

    // Calculate which book is in the center based on current offset
    const currentCenterIndex = Math.round(offset / BOOK_WIDTH) % books.length

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
            {/* Ambient lighting */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-1/4 top-1/4 size-96 rounded-full bg-amber-500/5 blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-sky-500/5 blur-3xl" />
            </div>

            {/* Title */}
            <h1 className="mb-12 text-center text-4xl font-light tracking-wide text-white md:text-5xl">
                Book Selector
            </h1>

            {/* Slot machine container */}
            <div className="relative w-full max-w-7xl rounded-2xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-sm">
                {/* Center indicator */}
                <div className="absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-1">
                    <div className="size-0 border-x-8 border-t-8 border-x-transparent border-t-amber-400" />
                </div>
                <div className="absolute bottom-0 left-1/2 z-40 -translate-x-1/2 translate-y-1">
                    <div className="size-0 border-x-8 border-b-8 border-x-transparent border-b-amber-400" />
                </div>

                {/* Center highlight lines */}
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-40 -translate-x-1/2 border-x-2 border-amber-400/30" />

                {/* Books viewport */}
                <div
                    ref={viewportRef}
                    className="relative mx-auto overflow-hidden rounded-lg bg-gradient-to-b from-slate-800/50 to-slate-900/50"
                    style={{
                        width: '100%',
                        maxWidth: `${VISIBLE_BOOKS * BOOK_WIDTH + 100}px`,
                        height: '320px'
                    }}
                >
                    {/* Books strip */}
                    {/* px-12 = 48px padding, kitap merkezi = 48 + (BOOK_WIDTH-16)/2 = 120px → viewportWidth/2 - 120 - offset */}
                    <div
                        className="absolute flex items-center gap-4 px-12"
                        style={{
                            transform: `translateX(${viewportWidth / 2 - 120 - offset}px)`,
                            height: '100%',
                        }}
                    >
                        {extendedBooks.map((book, index) => {
                            const bookIndex = index % books.length
                            const isCenter = spinState === "stopped" && showSelectedBook && bookIndex === centerBookIndex
                            // Always blur text except for the center book when stopped and revealed
                            const shouldBlurText = !(spinState === "stopped" && showSelectedBook && isCenter)

                            return (
                                <div
                                    key={`${book.id}-${index}`}
                                    className={cn(
                                        "flex-shrink-0 transition-transform",
                                        isCenter && "z-50 scale-125"
                                    )}
                                    style={{
                                        width: `${BOOK_WIDTH - 16}px`,
                                        transitionDuration: isCenter ? '500ms' : '0ms',
                                        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                                    }}
                                >
                                    <BookCover
                                        book={book}
                                        isCenter={isCenter}
                                        shouldBlurText={shouldBlurText}
                                    />
                                </div>
                            )
                        })}
                    </div>

                    {/* Edge shadows */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-slate-900/95 to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-slate-900/95 to-transparent" />
                </div>

                {/* Status indicator */}
                <div className="mt-6 flex justify-center gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className={cn(
                                "size-2 rounded-full transition-all duration-150",
                                isSpinning
                                    ? "animate-pulse bg-amber-400"
                                    : spinState === "stopped"
                                        ? "bg-emerald-400"
                                        : "bg-white/20"
                            )}
                            style={{
                                animationDelay: isSpinning ? `${i * 80}ms` : '0ms'
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Selected book info */}
            <div className={cn(
                "mt-16 text-center transition-all duration-700",
                spinState === "stopped" && showSelectedBook
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-8 opacity-0"
            )}>
                {selectedBook && (
                    <div className="space-y-3">
                        <span className="text-sm uppercase tracking-widest text-amber-400">
                            Selected
                        </span>
                        <h2 className="text-4xl font-semibold text-white md:text-5xl">
                            {selectedBook.title}
                        </h2>
                        <p className="text-xl text-white/60">
                            by {selectedBook.author}
                        </p>
                        <span className="mt-3 inline-block rounded-full bg-white/10 px-5 py-1.5 text-base text-white/80">
                            {selectedBook.genre}
                        </span>
                    </div>
                )}
            </div>

            {/* Spin button */}
            <button
                onClick={startSpin}
                disabled={isSpinning}
                className={cn(
                    "mt-12 rounded-full border-0 px-16 py-8 text-xl font-medium shadow-lg transition-all duration-300",
                    isSpinning
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:scale-105 hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-500/25 active:scale-95"
                )}
            >
                {isSpinning ? "Spinning..." : spinState === "stopped" ? "Spin Again" : "Spin"}
            </button>

            {/* Hint text */}
            <p className={cn(
                "mt-6 text-base text-white/40 transition-opacity duration-300",
                spinState === "idle" ? "opacity-100" : "opacity-0"
            )}>
                Press the button to select a random book
            </p>
        </div>
    )
}




