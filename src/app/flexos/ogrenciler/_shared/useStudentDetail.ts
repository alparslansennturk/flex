"use client";

/**
 * Öğrenci Detay (sayfa + modal) — TEK paylaşımlı veri hook'u. İki uçtan paralel çeker:
 *  - `GET /api/flexos/persons/[id]` — kimlik + PII + satış/ödeme (mevcut uç, dokunulmadı).
 *  - `GET /api/flexos/persons/[id]/education-summary` — yoklama/sertifika özeti (yeni uç).
 */

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/app/lib/firebase";
import type { TrainingSummary } from "@/app/lib/domain/services/person-education-summary-service";

export interface SaleSummary { id: string; educationName: string; status: string; soldPrice: number; financingFee: number; guardian: { name: string; idNo?: string } | null; date: string }
export interface PaymentLine { id: string; saleId: string; method: string; amount: number; installmentNo: number | null; installmentTotal: number | null; dueDate: string | null; paidAt: string | null; status: string }
export interface PersonDetail {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  isOnlineStudent: boolean;
  createdAt: string | null;
  pii: { phone: string; email: string; address: string; idNo: string; idType: string } | null;
  sales: SaleSummary[];
  payments: PaymentLine[];
  totals: { expected: number; paid: number; remaining: number; rollup: string | null };
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export function useStudentDetail(personId: string | null) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [trainings, setTrainings] = useState<TrainingSummary[]>([]);
  const [poolStatus, setPoolStatus] = useState<string>("grupsuz");
  const [subeler, setSubeler] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const [personRes, eduRes] = await Promise.all([
        fetch(`/api/flexos/persons/${personId}`, { headers }),
        fetch(`/api/flexos/persons/${personId}/education-summary`, { headers }),
      ]);
      if (personRes.ok) setPerson(await personRes.json());
      else setError("Öğrenci bilgisi yüklenemedi.");
      if (eduRes.ok) {
        const data = await eduRes.json() as { items: TrainingSummary[]; poolStatus: string; subeler: string[] };
        setTrainings(data.items);
        setPoolStatus(data.poolStatus);
        setSubeler(data.subeler);
      }
    } catch {
      setError("Sunucu hatası.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void load(); }, [load]);

  return { person, trainings, poolStatus, subeler, loading, error, reload: load };
}
