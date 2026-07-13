"use client";

import { useEffect, useRef } from "react";
import { auth } from "@/app/lib/firebase";
import type { RealtimeEventType } from "@/app/lib/server/realtime-hub";

/**
 * Herhangi bir varlık listesi gösteren HER ekran için TEK, paylaşılan gerçek-zamanlı
 * senkron kancası. `/api/flexos/realtime/stream` (SSE) ucuna bağlanır; sunucu bir
 * grup/öğrenci/satış/not/yoklama/eğitmen/eğitim kaydı değiştiğinde ilgili `type` ile
 * olay yollar — biz de çağıranın KENDİ ZATEN VAR OLAN veri yükleme fonksiyonunu
 * (`onChange`) tekrar çağırırız. Burada ayrı bir fetch/cache katmanı icat edilmiyor,
 * mevcut `fetch`+`useState` düzenine uyuluyor.
 *
 * `eventTypes`: bu ekranın hangi olaylarla ilgilendiği (örn. `["groups.changed"]` veya
 * birden fazla, örn. `["groups.changed","sales.changed"]`). Eşleşmeyen olaylar sessizce
 * yok sayılır — TEK stream'e herkes bağlanır, sunucu tarafında ayrı uçlar YOK.
 *
 * Native `EventSource` kullanılmıyor çünkü custom `Authorization: Bearer` header'ı
 * göndermez; bunun yerine `fetch` ile stream açılıp manuel satır satır ayrıştırılıyor.
 * Bağlantı koparsa (ağ, sunucu yeniden başlama, Vercel fonksiyon zaman aşımı vb.)
 * üstel geri çekilmeyle otomatik yeniden bağlanır — çağıran taraf tekrar bağlanma
 * mantığı yazmak zorunda değil.
 */
export function useRealtimeSync(eventTypes: RealtimeEventType[], onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const typesKey = eventTypes.join(",");

  useEffect(() => {
    const wanted = new Set(typesKey.split(",").filter(Boolean));
    if (wanted.size === 0) return;

    let stopped = false;
    let abortController: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // 2026-07-13 kota fix: toplu işlemler (ör. "Notları Kaydet"in N öğrenciyi tek tek
    // PATCH etmesi) aynı türde N ayrı broadcast üretiyordu — her biri açık her sekmede
    // AYRI bir yeniden-çekim tetikliyordu (bir save = N × pahalı sorgu, kota olayının
    // ikinci kök nedeni). Kısa bir sessizlik penceresi içindeki art arda olaylar artık
    // TEK bir `onChange()`'e toplanıyor.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // "Notları Kaydet" iki AYRI adım (önce N not, sonra ayrı bir arşivleme PATCH'i) —
    // aradaki gecikme kısa debounce'u kaçırıp 2. bir yenilemeye sebep olabiliyordu,
    // pencere biraz genişletildi (2026-07-13, ek güvenlik payı).
    const DEBOUNCE_MS = 1000;

    const connect = async () => {
      if (stopped) return;
      abortController = new AbortController();
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("no-auth-user");
        const token = await user.getIdToken();

        const res = await fetch("/api/flexos/realtime/stream", {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

        attempt = 0; // bağlantı kurulduğunda geri çekilme sayacı sıfırlanır
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue; // ": ping" gibi yorum satırları atlanır
            try {
              const event = JSON.parse(line.slice(6));
              if (event?.type && wanted.has(event.type)) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => onChangeRef.current(), DEBOUNCE_MS);
              }
            } catch {
              // bozuk çerçeveyi yut, bağlantıyı koparma
            }
          }
        }
      } catch {
        // bağlantı hatası veya kapandı — aşağıda yeniden denenecek
      }

      if (stopped) return;
      attempt += 1;
      const delay = Math.min(30_000, 1_000 * 2 ** attempt);
      retryTimer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      stopped = true;
      abortController?.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [typesKey]);
}
