"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";

/**
 * Admin/rol-kısıtlı sayfaların istemci tarafı koruması (2026-07-13 kullanıcı bulgusu):
 * FlexSidebar menüde `canSee(capability)` ile ilgili linki GİZLİYOR ama sayfanın kendisi
 * hiçbir kontrol yapmıyordu — yetkisi olmayan biri (ör. Görünüm Anahtarı sahibi "core"/
 * eğitmen moddayken) sayfaya DOĞRUDAN linkle girince tam admin arayüzünü (Sil/Ekle/Düzenle
 * butonları) görüyordu; tıklarsa sunucu `can()` ile zaten 403 verirdi (asıl güvenlik sınırı
 * orada, bu hook SADECE istemci deneyimi) ama önce kafa karıştırıcı bir "admin gibi açıldı"
 * hissi yaratıyordu.
 *
 * Bu hook capability'yi kontrol eder, YOKSA kullanıcının kendi gerçek ana sayfasına
 * (`/api/flexos/me`'nin `landing` alanı) yönlendirir. `allowed` false olduğu sürece sayfa
 * İÇERİĞİ HİÇ render edilmemeli (çağıran taraf loader göstermeli) — admin panelinin bir anlığına
 * bile flaşlanmasını önlemek için.
 */
export function useRequireCapability(capability: string): { allowed: boolean } {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) { router.replace("/login"); return; }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!res.ok) { router.replace("/login"); return; }
        const json = await res.json() as { capabilities?: string[]; landing?: string };
        if (cancelled) return;
        const caps = new Set(json.capabilities ?? []);
        if (caps.has(capability)) {
          setAllowed(true);
        } else {
          router.replace(json.landing ?? "/flexos/egitmen-anasayfa");
        }
      } catch {
        if (!cancelled) router.replace("/flexos/egitmen-anasayfa");
      }
    })();
    return () => { cancelled = true; };
  }, [capability, router]);

  return { allowed };
}
