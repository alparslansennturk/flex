/**
 * Admin Kişisel Görünüm Anahtarı — Core/Full. Kişisel, uid'e bağlı, localStorage'da
 * tutulur (sunucu tarafını etkilemez, presentational). Varsayılan: Full.
 */
export type ViewMode = "core" | "full";

const KEY_PREFIX = "flexos_view_mode_";

export function getViewMode(uid: string): ViewMode {
  if (typeof window === "undefined") return "full";
  return window.localStorage.getItem(KEY_PREFIX + uid) === "core" ? "core" : "full";
}

export function setViewMode(uid: string, mode: ViewMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + uid, mode);
}
