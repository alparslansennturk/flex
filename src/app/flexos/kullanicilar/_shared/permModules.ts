/**
 * Yetki modülleri kataloğu (frontend gösterim kaynağı) — backend'deki
 * `domain/access/perm-modules.ts` ile BİREBİR aynı katalog. Kataloğun kendisi (hangi
 * modüller var) sabit ürün yeteneği; her rolün hangilerini varsayılan aldığı artık
 * Firestore'da (`RoleDef.permModules`) — bkz. `useRoleDefs`.
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
  { key: "satis_yap", label: "Satış Yap", desc: "Yeni satış oluşturma, satış iptali", sensitivity: "yellow" },
  { key: "satis_liste", label: "Satış Listesi", desc: "Satış kayıtlarını görüntüleme, aylık takip", sensitivity: "green" },
  { key: "paket_yonetimi", label: "Paket Yönetimi", desc: "Paket oluşturma, düzenleme, silme", sensitivity: "yellow" },
  { key: "kampanya_yonetimi", label: "Kampanya Yönetimi", desc: "Kampanya oluşturma, düzenleme, silme", sensitivity: "yellow" },
  { key: "odeme", label: "Ödeme / Tahsilat", desc: "Ödeme kaydetme, tahsilat takibi", sensitivity: "yellow" },
  { key: "aktivite", label: "Aktivite Merkezi", desc: "Aktivite/vaka takibi, randevu takvimi", sensitivity: "green" },
  { key: "egitmen", label: "Eğitmen Kadrosu", desc: "Eğitmen CRUD, ücret görüntüleme/düzenleme", sensitivity: "yellow" },
  { key: "katalog", label: "Eğitim Kataloğu", desc: "Branş, eğitim, bölüm, track yönetimi", sensitivity: "yellow" },
  { key: "sistem", label: "Sistem Yönetimi", desc: "Rol/yetki tanımlama, kullanıcı yönetimi", sensitivity: "red" },
];
