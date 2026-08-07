"use client";

import { useEffect, useRef, useState, CSSProperties } from "react";
import { S, IC } from "./constants";

// ── Paste sanitizer: bold/italic/başlık/liste koru, class/style/div/span temizle ──
const PASTE_ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "P", "BR", "A"]);
function sanitizePastedHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  function process(node: Node): Node[] {
    if (node.nodeType === Node.TEXT_NODE) return [node.cloneNode()];
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const el = node as Element;
    const tag = el.tagName;
    const children = Array.from(el.childNodes).flatMap(process);
    if (PASTE_ALLOWED.has(tag)) {
      const newEl = document.createElement(tag.toLowerCase());
      if (tag === "A") { const href = el.getAttribute("href"); if (href) newEl.setAttribute("href", href); }
      children.forEach((c) => newEl.appendChild(c));
      return [newEl];
    }
    if (tag === "DIV") {
      const p = document.createElement("p");
      children.forEach((c) => p.appendChild(c));
      return [p];
    }
    return children; // span ve diğerleri: içeriği koru, etiketi at
  }
  const out = document.createElement("div");
  Array.from(tmp.childNodes).flatMap(process).forEach((n) => out.appendChild(n));
  return out.innerHTML;
}

// ── basit zengin-metin editörü (contentEditable + execCommand, kütüphanesiz) ──
export function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);

  // GERÇEK BUG (2026-07-28): boş deps ile SADECE mount'ta senkronize ediyordu —
  // düzenleme modunda (?id=...) mevcut eğitimin `icerikMetni`'si mount'tan SONRA,
  // async fetch bittiğinde geliyor; editör hep boş görünüyordu ve kullanıcı bir şey
  // yazıp kaydedince mevcut içerik sessizce siliniyordu. `value` artık dep — `!==`
  // kontrolü kullanıcının kendi yazdığı (onChange zaten aynı innerHTML'i state'e
  // yazdığından) durumda gereksiz DOM reset/imleç sıçraması yapmıyor.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const sync = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const cmd = (c: string, arg?: string) => {
    document.execCommand(c, false, arg);
    ref.current?.focus();
    sync();
  };

  const updateFloat = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setFloatPos(null); return; }
    if (!ref.current?.contains(sel.anchorNode)) { setFloatPos(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0) { setFloatPos(null); return; }
    setFloatPos({ x: rect.left + rect.width / 2, y: rect.top });
  };

  // Float toolbar butonu (koyu arka plan, beyaz yazı)
  const fb = (label: string, title: string, run: () => void, extra?: CSSProperties) => (
    <span key={label + title} title={title} role="button" tabIndex={0}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 30, borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#f1f5f9", padding: "0 7px", userSelect: "none" as const, transition: "background .1s", ...extra }}
      onMouseDown={(e) => { e.preventDefault(); run(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); } }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.15)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >{label}</span>
  );

  // Üst statik toolbar butonu
  const btn = (label: string, title: string, run: () => void, extra?: CSSProperties) => (
    <span className="ee-fmt" title={title} role="button" tabIndex={0} style={{ ...S.fmtBtn, ...extra }} onMouseDown={(e) => { e.preventDefault(); run(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); } }}>{label}</span>
  );

  // `eslint-plugin-react-hooks@7`'nin yeni `react-hooks/refs` kuralı, aşağıdaki
  // `cmd("...")` çağrılarını "render sırasında ref erişimi" sanıp yanlış pozitif
  // veriyor — hepsi `() => cmd(...)` ile SARILI, sadece `onMouseDown`'da (tıklanınca)
  // çalışıyor, render anında hiç invoke edilmiyor. Doğrulandı (2026-07-28): `[value]`
  // dep fix'inden ÖNCE bu kural hiç tetiklenmiyordu, sonra tetiklendi — kuralın kendi
  // heuristiği bu effect'in dependency şekline duyarlı, kod aslında güvenli.
  /* eslint-disable react-hooks/refs */
  return (
    <div className="ee-editor" style={{ border: "1px solid #e3e8f0", borderRadius: 12, background: "#fff" }}>
      {/* Float toolbar — seçim yapılınca belirir */}
      {floatPos && (
        <div style={{
          position: "fixed",
          left: Math.max(8, floatPos.x),
          top: Math.max(8, floatPos.y - 46),
          transform: "translateX(-50%)",
          zIndex: 9999,
          background: "#1e293b",
          borderRadius: 10,
          padding: "3px 5px",
          display: "flex",
          alignItems: "center",
          gap: 1,
          boxShadow: "0 6px 24px rgba(0,0,0,.32)",
          pointerEvents: "auto",
        }}>
          {fb("B", "Kalın", () => cmd("bold"), { fontWeight: 800 })}
          {fb("Başlık", "Başlık", () => cmd("formatBlock", "h3"), { fontSize: 12, padding: "0 8px" })}
          {fb("I", "İtalik", () => cmd("italic"), { fontStyle: "italic" })}
          {fb("U", "Altı çizili", () => cmd("underline"), { textDecoration: "underline" })}
          <span style={{ width: 1, height: 16, background: "#475569", margin: "0 3px", flex: "0 0 auto" }} />
          {fb("A", "Küçük yazı", () => cmd("fontSize", "2"), { fontSize: 10, fontWeight: 700 })}
          {fb("A", "Normal yazı", () => cmd("fontSize", "3"), { fontSize: 13, fontWeight: 700 })}
          {fb("A", "Büyük yazı", () => cmd("fontSize", "5"), { fontSize: 16, fontWeight: 700 })}
          <span style={{ width: 1, height: 16, background: "#475569", margin: "0 3px", flex: "0 0 auto" }} />
          {fb("•—", "Liste", () => cmd("insertUnorderedList"), { fontSize: 15, letterSpacing: -1 })}
          {fb("Temizle", "Biçimi temizle", () => cmd("removeFormat"), { fontSize: 11, fontWeight: 500, padding: "0 8px" })}
        </div>
      )}
      {/* Üst statik toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "7px 10px", borderBottom: "1px solid #eef1f6", background: "#fafbfd", borderRadius: "11px 11px 0 0", flexWrap: "wrap" }}>
        {btn("B", "Kalın", () => cmd("bold"), { fontWeight: 800 })}
        {btn("Başlık", "Başlık", () => cmd("formatBlock", "h3"), { width: "auto", padding: "0 9px", fontWeight: 700, fontSize: 12.5 })}
        {btn("I", "İtalik", () => cmd("italic"), { fontStyle: "italic" })}
        {btn("U", "Altı çizili", () => cmd("underline"), { textDecoration: "underline" })}
        <span style={{ width: 1, height: 18, background: "#e2e8f1", margin: "0 6px" }} />
        {btn("A", "Küçük yazı", () => cmd("fontSize", "2"), { fontSize: 11, fontWeight: 700 })}
        {btn("A", "Normal yazı", () => cmd("fontSize", "3"), { fontSize: 14, fontWeight: 700 })}
        {btn("A", "Büyük yazı", () => cmd("fontSize", "5"), { fontSize: 17, fontWeight: 700 })}
        <span style={{ width: 1, height: 18, background: "#e2e8f1", margin: "0 6px" }} />
        <span className="ee-fmt" title="Madde listesi" role="button" tabIndex={0} style={S.fmtBtn} onMouseDown={(e) => { e.preventDefault(); cmd("insertUnorderedList"); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cmd("insertUnorderedList"); } }} dangerouslySetInnerHTML={{ __html: IC.list }} />
        {btn("Temizle", "Biçimi temizle", () => cmd("removeFormat"), { width: "auto", padding: "0 9px", fontSize: 12 })}
      </div>
      <div
        ref={ref}
        className="ee-rt"
        contentEditable
        tabIndex={0}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        data-ph="Eğitim içeriğini buraya yapıştırın — kazanımlar, müfredat başlıkları, modüller…"
        onInput={sync}
        onMouseUp={updateFloat}
        onKeyUp={updateFloat}
        onBlur={() => setTimeout(() => setFloatPos(null), 120)}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          if (html) {
            document.execCommand("insertHTML", false, sanitizePastedHtml(html));
          } else {
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          }
          sync();
        }}
        style={{ minHeight: 240, padding: "14px 16px", fontSize: 14, lineHeight: 1.6, color: "#1e293b", outline: "none", overflowY: "auto" }}
      />
    </div>
  );
}
