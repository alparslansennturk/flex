"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { resolveFlexosLanding } from "./lib/resolveFlexosLanding";
import { FlexPageLoader } from "./flexos/_components/FlexSpinner";

export default function RootPage() {
  const router = useRouter();

  // 2026-07-13 canlıya alma: eski `/dashboard`/`/student/{id}` hedefleri yerine
  // FlexOS'un kendi `resolveFlexosLanding`'i (rol/capability bazlı, `/api/flexos/me`)
  // kullanılıyor — tüm gerçek eğitmen/öğrenciler zaten FlexOS'a taşındığı için güvenli.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/flexos/giris");
        return;
      }
      const token = await user.getIdToken();
      router.push(await resolveFlexosLanding(token));
    });

    return () => unsubscribe();
  }, [router]);

  // Firebase cevap verene kadar görünecek olan bekleme ekranı — hedef sayfadaki
  // FlexPageLoader ile AYNI (2026-07-16: eskiden ayrı bir "Atölye Hazırlanıyor" stili
  // vardı, açılışta iki farklı loader arka arkaya göze çarpıyordu).
  return <FlexPageLoader />;
}