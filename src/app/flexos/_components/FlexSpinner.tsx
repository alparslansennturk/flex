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
export function FlexPageLoader() {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
      <style>{CSS}</style>
      <div className="fx-spin" style={{ width: 48, height: 48 }} />
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
