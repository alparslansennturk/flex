"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { resolveFlexosLanding } from "./lib/resolveFlexosLanding";

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

  // Firebase cevap verene kadar görünecek olan "Ferah Bekleme" ekranı
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-surface-50 font-inter">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-base-primary-500" size={40} />
        <p className="text-sm font-bold tracking-widest text-text-muted uppercase italic">
          Atölye Hazırlanıyor...
        </p>
      </div>
    </div>
  );
}