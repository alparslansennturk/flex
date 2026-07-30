"use client";

import React from "react";
import { IC } from "./constants";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
      <span style={{ width: 5, height: 18, borderRadius: 3, background: "#f97316" }} />
      <span style={{ fontSize: 15, fontWeight: 800, color: "#0f1f3d" }}>{children}</span>
    </div>
  );
}

export function Label({ children, withLock }: { children: React.ReactNode; withLock?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
      {children}
      {withLock && <span dangerouslySetInnerHTML={{ __html: IC.lockTiny }} />}
    </label>
  );
}

export function SelectWrap({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div style={{ position: "relative" }}>
      {children}
      <span style={{ position: "absolute", right: small ? 13 : 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.chevDownGray }} />
    </div>
  );
}
