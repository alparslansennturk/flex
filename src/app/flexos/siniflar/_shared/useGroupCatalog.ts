"use client";

/**
 * FlexOS · Sınıflar — paylaşımlı katalog fetch mantığı (Branş→Eğitim→Bölüm cascade
 * + Seans kütüphanesi). Hem Full (Operasyon) Grup Ekle formu hem Core (eğitmen)
 * Sınıf Aç formu aynı kataloğu aynı şekilde okusun diye tek yerde tutulur.
 */
import { useCallback, useEffect, useState } from "react";
import { auth } from "@/app/lib/firebase";
import type { SeansDoc } from "./groupDisplay";

export interface BranchDoc { id: string; name: string; order?: number }
export interface EducationDoc {
  id: string; name: string; branchId: string;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned";
  totalHours?: number;
}
export interface SectionDoc { id: string; educationId: string; name: string; order: number; hours?: number }

/** `enabled=false` iken hiçbir fetch yapmaz (örn. standaloneMode henüz bilinmiyor/Full kapalıyken). */
export function useGroupCatalog(branchId: string, educationId: string, enabled: boolean = true) {
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [educations, setEducations] = useState<EducationDoc[]>([]);
  const [sections, setSections] = useState<SectionDoc[]>([]);
  const [seanslar, setSeanslar] = useState<SeansDoc[]>([]);
  const [loadingEdu, setLoadingEdu] = useState(false);
  const [loadingSec, setLoadingSec] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  // -- branş listesi + seans kütüphanesi: bir kez --
  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    (async () => {
      try {
        const hdrs = await authHeaders();
        const [brRes, snRes] = await Promise.all([
          fetch("/api/flexos/branches", { headers: hdrs, signal: ac.signal }),
          fetch("/api/flexos/seanslar", { headers: hdrs, signal: ac.signal }),
        ]);
        const brJson = brRes.ok ? await brRes.json() : { items: [] };
        const snJson = snRes.ok ? await snRes.json() : { items: [] };
        if (!ac.signal.aborted) {
          setBranches(brJson.items ?? []);
          setSeanslar(snJson.items ?? []);
        }
      } catch { /* sessiz — form boş katalogla açılır */ }
    })();
    return () => ac.abort();
  }, [authHeaders, enabled]);

  // -- branş seçilince eğitimler --
  useEffect(() => {
    if (!enabled || !branchId) { setEducations([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingEdu(true);
      try {
        const res = await fetch(`/api/flexos/educations?branchId=${encodeURIComponent(branchId)}`, { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setEducations(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") { /* sessiz */ }
      } finally {
        if (!ac.signal.aborted) setLoadingEdu(false);
      }
    })();
    return () => ac.abort();
  }, [branchId, authHeaders, enabled]);

  const selEdu = educations.find((e) => e.id === educationId);
  const isSectioned = selEdu?.structure === "sectioned";

  // -- eğitim seçilince bölümler (sadece sectioned ise) --
  useEffect(() => {
    if (!enabled || !educationId || !isSectioned) { setSections([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingSec(true);
      try {
        const res = await fetch(`/api/flexos/sections?educationId=${encodeURIComponent(educationId)}`, { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setSections(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") { /* sessiz */ }
      } finally {
        if (!ac.signal.aborted) setLoadingSec(false);
      }
    })();
    return () => ac.abort();
  }, [educationId, isSectioned, authHeaders, enabled]);

  return { branches, educations, sections, seanslar, loadingEdu, loadingSec, isSectioned, selEdu, setEducations, setSections };
}
