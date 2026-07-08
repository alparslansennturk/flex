"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/app/lib/firebase";

export interface RoleDefDTO {
  id: string;
  tenantId: string;
  label: string;
  description?: string;
  color?: string;
  permModules: string[];
  isBuiltIn: boolean;
}

/** `GET /api/flexos/role-defs`'i çeken paylaşımlı hook — Ekle/Düzenle/Ayarlar sayfalarının ortak kaynağı. */
export function useRoleDefs() {
  const [roleDefs, setRoleDefs] = useState<RoleDefDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/role-defs", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRoleDefs(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { roleDefs, loading, reload };
}
