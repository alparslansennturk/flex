export interface PopoverPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Mesaj aksiyonu popup'ları (reaksiyon panosu, düzenle/sil menüsü) için GERÇEK
 * viewport koordinatı hesaplar — `position:fixed` + portal ile render edilirler
 * (2026-07-18, tekrarlayan bug: CSS-relative `top/bottom:100%` konumlama,
 * scrollable konteyner içinde header'ın veya bir sonraki mesajın arkasında
 * kalabiliyordu — hem clipping hem z-index/stacking-context sorunları vardı,
 * `position:fixed` + `document.body`'ye portal bunların HİÇBİRİNE tabi değil).
 */
export function computePopoverPosition(
  anchor: HTMLElement,
  alignEdge: "left" | "right",
  estimatedHeight = 200,
): PopoverPosition {
  const rect = anchor.getBoundingClientRect();
  // GERÇEK bug (2026-07-20 kullanıcı bulgusu): eski koşul "üstte yer VARSA" yukarı
  // açıyordu — altta da bolca yer olsa bile, çünkü öncelik yanlıştı (üstte yer olması
  // TEK BAŞINA yukarı açmayı tetikliyordu). Doğrusu: varsayılan AŞAĞI, SADECE altta
  // yer YOKSA ve üstte yer VARSA yukarı dön.
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward = spaceBelow < estimatedHeight && spaceAbove > estimatedHeight;
  const vertical: PopoverPosition = openUpward
    ? { bottom: window.innerHeight - rect.top + 4 }
    : { top: rect.bottom + 4 };
  const horizontal: PopoverPosition = alignEdge === "right"
    ? { right: window.innerWidth - rect.right }
    : { left: rect.left };
  return { ...vertical, ...horizontal };
}
