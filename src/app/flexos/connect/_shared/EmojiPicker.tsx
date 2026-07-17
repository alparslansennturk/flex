"use client";

import { useState } from "react";
import { Smile, Paperclip } from "lucide-react";

const QUICK_EMOJIS = ["😀", "😂", "👍", "🎉", "❤️", "🙏", "😍", "🔥", "👏", "😢", "🤔", "✅", "🚀", "😅", "🙌", "💯", "👀", "🎊"];

/** Composer'daki emoji seçici — tasarımdaki emoji butonu, gerçek (hafif) hızlı-seç panosu. */
export function EmojiButton({ onPick, size = 40 }: { onPick: (emoji: string) => void; size?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button" title="Emoji" onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        style={{ width: size, height: size, borderRadius: 11, border: "none", background: open ? "#F4F5F7" : "transparent", color: open ? "#2867bd" : "#6B717C" }}
      >
        <Smile size={size >= 40 ? 20 : 17} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 39 }} onClick={() => setOpen(false)} />
          <div
            className="absolute grid"
            style={{
              bottom: "calc(100% + 8px)", right: 0, background: "#fff", border: "1px solid #E4E6EB",
              borderRadius: 14, boxShadow: "0 20px 50px -15px rgba(18,35,59,.35)", padding: 8,
              gridTemplateColumns: "repeat(6, 1fr)", gap: 2, zIndex: 40, width: 216,
            }}
          >
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e} type="button" onClick={() => { onPick(e); setOpen(false); }}
                className="flex items-center justify-center cursor-pointer transition-colors"
                style={{ fontSize: 18, width: 32, height: 32, border: "none", background: "transparent", borderRadius: 8 }}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Dosya ekle — görsel olarak tasarımda var, gerçek yükleme FAZ 2 (bkz. FLEX_CONNECT.md). */
export function AttachButton({ size = 40 }: { size?: number }) {
  return (
    <button
      type="button" title="Dosya ekle (yakında)" disabled
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: 11, border: "none", background: "transparent", color: "#C3CAD4", cursor: "not-allowed" }}
    >
      <Paperclip size={size >= 40 ? 19 : 16} />
    </button>
  );
}
