import type { TypingSignal } from "./connectClient";

/** "X yazıyor…" göstergesi — tasarımdaki AYNI 3-nokta animasyonu (`globals.css::fcType`). */
export function TypingIndicator({ signals }: { signals: TypingSignal[] }) {
  if (signals.length === 0) return null;
  const label = signals.length === 1 ? signals[0].name : `${signals.length} kişi`;
  return (
    <div
      className="inline-flex items-center gap-2"
      style={{ padding: "4px 11px", borderRadius: 999, background: "#fff", border: "1px solid #ECEEF1", width: "fit-content" }}
    >
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="connect-typing-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#B4BAC4", display: "inline-block" }} />
        ))}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8A909B" }}>
        <strong style={{ color: "#4A515C" }}>{label}</strong> yazıyor…
      </span>
    </div>
  );
}
