import type { EntityId, ISODateTime } from "../base";

/** Tek bir hesaplama kuralı — "Ödev notu katkısı" aç/kapa + ağırlık. */
export interface CertificateWeighting {
  odevAktif: boolean;
  sertifikaPct: number; // 0-100, ödev ağırlığı = 100 - sertifikaPct
}

/**
 * Sertifika hesaplama ayarı — Sertifika Notu'ndaki "Ödev Notu" sütununu ve
 * ağırlığını, Sertifika Ayarları sayfasındaki toggle+slider'dan besler
 * (`FLEXOS.md` §Sertifikasyon).
 *
 * **İKİ AYRI KURAL (2026-07-06 kararı):** `Education.certType`'a göre (Sınav Bazlı/
 * Proje Bazlı) FARKLI varsayılan — proje bazlı derste ödev genelde anlamlı (varsayılan
 * AÇIK), sınav bazlı derste (Office gibi) genelde anlamsız (varsayılan KAPALI) — ama
 * ikisi de BAĞIMSIZ açılıp kapatılabilir, certType hiçbir şeyi KISITLAMAZ (kullanıcı
 * kararı: esneklik proje tipine kilitlenmesin — sınav bazlı branşta custom/anlık ödev
 * verilmişse istenirse o da sertifikaya katkı yapabilir).
 *
 * İKİ KATMANLI SAHİPLİK (standalone/Core mod kararı, 2026-07-06):
 *  - **Tenant varsayılanı** — `trainerId` YOK, doküman id = tenantId. Op/Admin yönetir
 *    (`certificate.settings.write`, org scope). Full modda TEK geçerli kayıt budur.
 *  - **Eğitmen kişisel override'ı** — `trainerId` DOLU, doküman id = `${tenantId}_${trainerId}`.
 *    Yalnız standalone/Core modda eğitmen kendi kaydını yazabilir (`certificate.settings.write`,
 *    self scope — `EGITMEN_STANDALONE_EXTRA`). Eğitmen kendi kuralını hiç vermemişse
 *    tenant varsayılanına DÜŞER (`certificate-settings-service.ts`).
 *
 * odevAktif=false → sertifika/sınav notu %100 `Grade.projectGrade`'den hesaplanır
 * (sertifikaPct'ye bakılmaz). Sınav bazlı branşta bu alan "Sınav Notu" olarak gösterilir
 * (aynı alan, sadece etiket değişir — ayrı bir "sınav notu" kavramı YOK).
 */
export interface CertificateSettings {
  tenantId: EntityId;
  trainerId?: EntityId; // dolu ise KİŞİSEL override, boşsa tenant varsayılanı
  project: CertificateWeighting; // Proje Bazlı eğitimler için kural
  exam: CertificateWeighting; // Sınav Bazlı eğitimler için kural
  updatedAt?: ISODateTime;
  updatedBy?: string;
}

export const DEFAULT_CERTIFICATE_SETTINGS: Omit<CertificateSettings, "tenantId"> = {
  project: { odevAktif: true, sertifikaPct: 70 },
  exam: { odevAktif: false, sertifikaPct: 100 },
};
