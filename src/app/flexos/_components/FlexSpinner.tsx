"use client";

/**
 * FlexOS · Paylaşımlı spinner bileşenleri.
 * Her sayfanın kendi CSS'i yerine burası kullanılır.
 */

const CSS = `
  .fx-spin{border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:fx-spin 1s linear infinite}
  @keyframes fx-spin{to{transform:rotate(360deg)}}
`;

/** Tam ekran yükleme ekranı — sayfa ilk açılırken (auth/data bekleniyor). */
export function FlexPageLoader({ text = "Flex Yükleniyor" }: { text?: string }) {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#EEF0F3" }}>
      <style>{CSS}</style>
      <div className="fx-spin" style={{ width: 48, height: 48 }} />
      {text ? <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF" }}>{text}</p> : null}
    </div>
  );
}

/** Satır içi spinner — tablo/liste içinde yükleme göstergesi. */
export function FlexSpinner({ size = 40 }: { size?: number }) {
  return (
    <>
      <style>{CSS}</style>
      <div className="fx-spin" style={{ width: size, height: size }} />
    </>
  );
}
