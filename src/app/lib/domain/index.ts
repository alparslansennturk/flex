/**
 * FlexOS domain tipleri — tek giriş noktası.
 * Detaylı mimari: `FLEXOS.md` (proje kökü).
 */

export * from "./base";

// ── Core (Classroom çekirdeği — üst katmanı bilmez) ──
export * from "./core/person";
export * from "./core/group";
export * from "./core/module";
export * from "./core/enrollment";
export * from "./core/person-note";

// ── Education pack (eğitime özel) ──
export * from "./education/grade";

// ── FlexOS üst katman (DİKİŞ — mantık sonraki etapta) ──
export * from "./eduos/education";
export * from "./eduos/sale";
export * from "./eduos/payment";
