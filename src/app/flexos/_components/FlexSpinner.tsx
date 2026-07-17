"use client";

/**
 * FlexOS · Paylaşımlı spinner bileşenleri.
 * Her sayfanın kendi CSS'i yerine burası kullanılır.
 */

const CSS = `
  .fx-spin{border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:fx-spin 1s linear infinite}
  @keyframes fx-spin{to{transform:rotate(360deg)}}
`;

/**
 * Uygulama bu sekmede bir kez tam yüklendi mi? — modül seviyesinde tutulur (client-side
 * navigasyon boyunca hafızada kalır, tam sayfa yenilemede sıfırlanır). Açılış akışında
 * (RootPage → hedef sayfa → FlexSidebar ready) TEK bir yazılı "Flex Yükleniyor" ekranı
 * gösterilsin, sayfa geçişlerindeki kısa kapanışlar (FlexSidebar'ın her mount'ta `ready`
 * sıfırlaması) yazısız kalsın diye eklendi.
 */
let appBooted = false;
export function isAppBooted() {
  return appBooted;
}
export function markAppBooted() {
  appBooted = true;
}

/**
 * Tam ekran yükleme ekranı — sayfa ilk açılırken (auth/data bekleniyor). `text`
 * verilmezse: uygulama bu sekmede henüz hiç tam yüklenmediyse ("appBooted" false,
 * yani açılış akışındayız) varsayılan "Flex Yükleniyor" yazısı gösterilir; uygulama
 * bir kez tam yüklendikten sonra (sonraki sayfa geçişleri) aynı bileşen otomatik
 * olarak yazısız spinner'a döner — her çağıran yeri tek tek güncellemeye gerek kalmadan.
 */
export function FlexPageLoader({ text }: { text?: string } = {}) {
  const label = text ?? (isAppBooted() ? null : "Flex Yükleniyor");
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#EEF0F3" }}>
      <style>{CSS}</style>
      <div className="fx-spin" style={{ width: 48, height: 48 }} />
      {label ? <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF" }}>{label}</p> : null}
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
