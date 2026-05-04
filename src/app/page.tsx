"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const tokenResult = await user.getIdTokenResult();
      const role = tokenResult.claims.role as string | undefined;

      if (role === "student") {
        const studentDocId = tokenResult.claims.studentDocId as string | undefined;
        if (studentDocId) {
          router.push(`/student/${studentDocId}`);
        } else {
          // studentDocId claim henüz set edilmemişse login'e gönder
          router.push("/login");
        }
      } else {
        router.push("/dashboard");
      }
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