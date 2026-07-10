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
  // Satış alt-menüleri (2026-07-10 kullanıcı kararı) — her biri AYRI aç/kapa olabilsin
  // diye tek "satis" modülü yerine 4 ayrı modüle bölündü (örn. bir role Satış Yap
  // kapalı, Satış Listesi açık şeklinde tanımlanabiliyor artık).
  { key: "satis_yap", label: "Satış Yap", desc: "Yeni satış oluşturma, satış iptali", sensitivity: "yellow" },
  { key: "satis_liste", label: "Satış Listesi", desc: "Satış kayıtlarını görüntüleme, aylık takip", sensitivity: "green" },
  { key: "paket_yonetimi", label: "Paket Yönetimi", desc: "Paket oluşturma, düzenleme, silme", sensitivity: "yellow" },
  { key: "kampanya_yonetimi", label: "Kampanya Yönetimi", desc: "Kampanya oluşturma, düzenleme, silme", sensitivity: "yellow" },
  { key: "odeme", label: "Ödeme / Tahsilat", desc: "Ödeme kaydetme, tahsilat takibi", sensitivity: "yellow" },
  // Aktivite Merkezi — Satış/Eğitim Op/Finans'ın ORTAK kullandığı paylaşımlı alan
  // (2026-07-10 kullanıcı kararı) — tek bir bölüme özel değil, kendi ayrı modülü.
  { key: "aktivite", label: "Aktivite Merkezi", desc: "Aktivite/vaka takibi, randevu takvimi", sensitivity: "green" },
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
 * bu isimlerle çalışıyordu, davranış BOZULMASIN diye birebir aynı varsayılanlar
 * (2026-07-10: "satis" 4 alt-modüle bölündü + "aktivite" paylaşımlı modülü eklendi —
 * bu üç rolün varsayılanları o değişikliğe göre güncellendi). */
export const BUILT_IN_ROLE_SEEDS: BuiltInRoleSeed[] = [
  { id: "genel_mudur", label: "Genel Müdür", description: "Tüm yetkiler, tam erişim", color: "#7C3AED", permModules: ALL_PERM_MODULE_KEYS },
  { id: "egitim_koordinatoru", label: "Eğitim Koordinatörü", description: "Eğitim operasyonunun başı", color: "#0369A1", permModules: ["kisi", "kayit", "sinif", "not", "egitmen", "katalog", "satis_liste", "aktivite"] },
  { id: "ogrenci_isleri", label: "Öğrenci İşleri", description: "Öğrenci sorunları, sertifika, SMS, eğitmen iletişimi", color: "#0E7490", permModules: ["kisi", "kayit", "not"] },
  { id: "satis_temsilcisi", label: "Satış Temsilcisi", description: "Satış ve ödeme işlemleri", color: "#C2410C", permModules: ["kisi", "kayit", "satis_yap", "satis_liste", "paket_yonetimi", "kampanya_yonetimi", "odeme", "aktivite"] },
  { id: "finans", label: "Finans Sorumlusu", description: "Ödeme, tahsilat, mali takip", color: "#B45309", permModules: ["odeme", "satis_liste", "aktivite"] },
  { id: "egitmen", label: "Eğitmen", description: "Atanmış gruplarda sınırlı yetki", color: "#15803D", permModules: ["not"] },
];
