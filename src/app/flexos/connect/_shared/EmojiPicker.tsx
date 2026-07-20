"use client";

import { useRef, useState } from "react";
import { Smile, Paperclip } from "lucide-react";

export const QUICK_EMOJIS = ["😀", "😂", "👍", "🎉", "❤️", "🙏", "😍", "🔥", "👏", "😢", "🤔", "✅", "🚀", "😅", "🙌", "💯", "👀", "🎊"];

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

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Mesaj reaksiyon hızlı-seç panosu (WhatsApp tarzı, Faz 2 madde 2 — 2026-07-18).
 * Composer'ın `EmojiButton`'ından AYRI: sadece 6 yaygın emoji, mesaj balonunun
 * hemen üstünde/yanında açılır. `activeEmoji` doluysa o buton vurgulanır (kendi
 * reaksiyonun). */
export function ReactionQuickPick({ onPick, activeEmoji }: { onPick: (emoji: string) => void; activeEmoji?: string }) {
  return (
    <div
      className="flex items-center gap-0.5"
      style={{ background: "#fff", border: "1px solid #E4E6EB", borderRadius: 999, boxShadow: "0 10px 30px -10px rgba(18,35,59,.3)", padding: "4px 5px" }}
    >
      {QUICK_REACTIONS.map((e) => (
        <button
          key={e} type="button" onClick={() => onPick(e)}
          className="flex items-center justify-center cursor-pointer transition-transform"
          style={{ width: 27, height: 27, border: "none", borderRadius: "50%", background: activeEmoji === e ? "#EAF1FB" : "transparent", fontSize: 16 }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/** Dosya ekle (Faz 2 madde 5 — 2026-07-18): gerçek dosya seçici, `onFileSelected`
 * çağıranın (page.tsx) upload+gönder akışını tetikler. `uploadProgress` doluyken
 * (0-100) gerçek yüzde gösterir (kullanıcı isteği — sadece spinner değil, sayı
 * görmek istedi), `null`/`undefined` iken normal ataç ikonu. */
export function AttachButton({
  size = 40, onFileSelected, uploadProgress,
}: { size?: number; onFileSelected: (file: File) => void; uploadProgress?: number | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = uploadProgress != null;
  return (
    <>
      <input
        ref={inputRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.target.value = ""; }}
      />
      <button
        type="button" title={uploading ? `Yükleniyor · %${uploadProgress}` : "Dosya ekle"} disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        style={{ width: size, height: size, borderRadius: 11, border: "none", background: "transparent", color: uploading ? "#2867bd" : "#6B717C", cursor: uploading ? "default" : "pointer" }}
      >
        {uploading ? (
          <span style={{ fontSize: size >= 40 ? 10.5 : 9.5, fontWeight: 800 }}>%{uploadProgress}</span>
        ) : (
          <Paperclip size={size >= 40 ? 19 : 16} />
        )}
      </button>
    </>
  );
}
