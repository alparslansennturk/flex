"use client";

import { useEffect, useState } from "react";
import { useCapabilities } from "../_components/useCapabilities";

/**
 * Liste ekranlarının (Satış/Öğrenci/Grup/Aktivite Merkezi) ortak "şube filtresi
 * varsayılanı" mantığı — 2026-07-22'de Satış Listesi'nde başlayıp diğer ekranlara
 * kopyalanan deseni tek yere toplar. Kısıtlama DEĞİL, sadece varsayılan görünüm:
 * normalde İLK yüklemede kullanıcının kendi şubesine set edilir (sonra kullanıcı
 * seçimi ezilmez), ama rolü `defaultAllBranches:true` ise (Kullanıcı Ayarları'ndan
 * atanır, ör. Satış Müdürü) varsayılan doğrudan "tümü" olur. Her iki durumda da
 * kullanıcı üstten dilediği şubeyi seçip görebilir/işlem yapabilir.
 *
 * `allValue` — ekranların "tüm şubeler" sentinel'i farklı (Satış Listesi `"__all__"`,
 * Öğrenci Havuzu/Sınıflar `"Tümü"`), o yüzden parametreli.
 * `alsoSet` — Öğrenci Havuzu'ndaki gibi applied/pending iki katmanlı filtre olan
 * ekranlarda, init anında pending state'i de AYNI değere set etmek için (opsiyonel).
 */
export function useOfficeFilterDefault(opts?: { allValue?: string; alsoSet?: (v: string) => void }) {
  const allValue = opts?.allValue ?? "__all__";
  const { officeName: myOfficeName, defaultAllBranches } = useCapabilities();
  const [subeFilter, setSubeFilter] = useState<string>(allValue);
  const [subeFilterInitialized, setSubeFilterInitialized] = useState(false);

  useEffect(() => {
    if (subeFilterInitialized) return;
    const initial = defaultAllBranches ? allValue : myOfficeName;
    if (!initial) return; // henüz officeName gelmedi (ve defaultAllBranches değil) — bekle
    setSubeFilter(initial);
    opts?.alsoSet?.(initial);
    setSubeFilterInitialized(true);
    // opts kasıtlı olarak deps dışı — projedeki AYNI desen (satis-liste/GroupTable'daki
    // eski init effect'leri de setter'ları deps'e almıyordu), her render'da yeni referans
    // alıp effect'i gereksiz tetiklememesi için.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOfficeName, defaultAllBranches, subeFilterInitialized, allValue]);

  return { subeFilter, setSubeFilter };
}
