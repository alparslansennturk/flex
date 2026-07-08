/**
 * Sadeleştirilmiş yetki modülleri kataloğu — "Kullanıcı Ayarları" + "Kullanıcı Ekle/
 * Düzenle" sayfalarının ORTAK kaynağı (2026-07-08). Öncesinde bu liste (+ 6 yerleşik
 * rolün varsayılan modülleri) `kullanicilar/ekle/page.tsx` ve `kullanicilar/[id]/
 * duzenle/page.tsx`'te AYRI AYRI elle kopyalanmıştı.
 *
 * Kataloğun kendisi (hangi modüller VAR) SABİT — bu FlexOS ürününün kendi yetenekleri,
 * kurumdan kuruma değişmez. Değişebilen kısım her ROLÜN hangi modülleri varsayılan
 * aldığı — o artık Firestore'da (`RoleDef.permModules`, `role-def-service.ts`).
 *
 * **Gerçek capability'lere eşleme HENÜZ YOK** — bu modüller şu an sadece `FlexosUser.
 * permOverrides`'ta veri olarak saklanıyor, `access/can()` tarafında hiçbir etkisi yok
 * (ayrı, daha büyük bir iş — bkz. `role-def.ts` docstring).
 */
export interface PermModuleDef {
  key: string;
  label: string;
  desc: string;
  sensitivity: "green" | "yellow" | "red";
}

export const PERM_MODULES: PermModuleDef[] = [
  { key: "kisi", label: "Kişi Yönetimi", desc: "Kişi oluşturma, düzenleme, PII erişimi", sensitivity: "yellow" },
  { key: "kayit", label: "Kayıt İşlemleri", desc: "Eğitime kayıt, grup değiştirme", sensitivity: "yellow" },
  { key: "sinif", label: "Sınıf / Grup", desc: "Grup oluşturma, düzenleme, silme, öğrenci/eğitmen atama", sensitivity: "green" },
  { key: "not", label: "Not / Değerlendirme", desc: "Not girme, görüntüleme, modül bitirme", sensitivity: "green" },
  { key: "satis", label: "Satış", desc: "Satış yapma, görüntüleme, iptal etme", sensitivity: "yellow" },
  { key: "odeme", label: "Ödeme / Tahsilat", desc: "Ödeme kaydetme, tahsilat takibi", sensitivity: "yellow" },
  { key: "egitmen", label: "Eğitmen Kadrosu", desc: "Eğitmen CRUD, ücret görüntüleme/düzenleme", sensitivity: "yellow" },
  { key: "katalog", label: "Eğitim Kataloğu", desc: "Branş, eğitim, bölüm, track yönetimi", sensitivity: "yellow" },
  { key: "sistem", label: "Sistem Yönetimi", desc: "Rol/yetki tanımlama, kullanıcı yönetimi", sensitivity: "red" },
];

export const ALL_PERM_MODULE_KEYS: string[] = PERM_MODULES.map((m) => m.key);

export interface BuiltInRoleSeed {
  id: string;
  label: string;
  description: string;
  color: string;
  permModules: string[];
}

/** İlk okumada Firestore'a tohumlanan 6 yerleşik rol — `flexos_users` şu ana kadar
 * bu isimlerle çalışıyordu, davranış BOZULMASIN diye birebir aynı varsayılanlar. */
export const BUILT_IN_ROLE_SEEDS: BuiltInRoleSeed[] = [
  { id: "genel_mudur", label: "Genel Müdür", description: "Tüm yetkiler, tam erişim", color: "#7C3AED", permModules: ALL_PERM_MODULE_KEYS },
  { id: "egitim_koordinatoru", label: "Eğitim Koordinatörü", description: "Eğitim operasyonunun başı", color: "#0369A1", permModules: ["kisi", "kayit", "sinif", "not", "egitmen", "katalog"] },
  { id: "ogrenci_isleri", label: "Öğrenci İşleri", description: "Öğrenci sorunları, sertifika, SMS, eğitmen iletişimi", color: "#0E7490", permModules: ["kisi", "kayit", "not"] },
  { id: "satis_temsilcisi", label: "Satış Temsilcisi", description: "Satış ve ödeme işlemleri", color: "#C2410C", permModules: ["kisi", "kayit", "satis", "odeme"] },
  { id: "finans", label: "Finans Sorumlusu", description: "Ödeme, tahsilat, mali takip", color: "#B45309", permModules: ["odeme", "satis"] },
  { id: "egitmen", label: "Eğitmen", description: "Atanmış gruplarda sınırlı yetki", color: "#15803D", permModules: ["not"] },
];
