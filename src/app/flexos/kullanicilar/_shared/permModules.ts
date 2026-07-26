/**
 * Yetki modülleri kataloğu (frontend gösterim kaynağı) — backend'deki
 * `domain/access/perm-modules.ts` ile BİREBİR aynı katalog. Kataloğun kendisi (hangi
 * modüller var) sabit ürün yeteneği; her rolün hangilerini varsayılan aldığı artık
 * Firestore'da (`RoleDef.permModules`) — bkz. `useRoleDefs`.
 */
export interface PermModuleGroupDef {
  key: string;
  label: string;
}

/** Akordiyon başlıkları — sıralama burada, `PermModuleDef.group` bu key'lere referans verir. */
export const PERM_MODULE_GROUPS: PermModuleGroupDef[] = [
  { key: "kullanici_yonetimi", label: "Kullanıcı Yönetimi" },
  { key: "ogrenci", label: "Öğrenci İşlemleri" },
  { key: "egitim", label: "Eğitim" },
  { key: "satis_finans", label: "Satış & Finans" },
  { key: "diger", label: "Diğer" },
];

export interface PermModuleDef {
  key: string;
  label: string;
  desc: string;
  group: string;
}

export const PERM_MODULES: PermModuleDef[] = [
  { key: "personel_ekle", label: "Personel Ekleme", desc: "Yeni personel/kullanıcı hesabı oluşturma", group: "kullanici_yonetimi" },
  { key: "egitmen_ekle", label: "Eğitmen Ekleme", desc: "Yeni eğitmen kaydı oluşturma", group: "kullanici_yonetimi" },
  { key: "egitmen", label: "Eğitmen Kadrosu", desc: "Eğitmen düzenleme/silme, ücret görüntüleme/düzenleme", group: "kullanici_yonetimi" },
  { key: "sistem", label: "Sistem Yönetimi", desc: "Rol tanımlama, yetki paketlerini düzenleme", group: "kullanici_yonetimi" },

  { key: "kisi", label: "Öğrenci Düzenleme", desc: "Öğrenciyi düzenleme, grup taşıma, gruptan çıkarma", group: "ogrenci" },

  { key: "sinif", label: "Sınıf / Grup", desc: "Grup oluşturma, düzenleme, silme, öğrenci/eğitmen atama", group: "egitim" },
  { key: "not", label: "Not / Değerlendirme", desc: "Not girme, görüntüleme, modül bitirme", group: "egitim" },
  { key: "yoklama", label: "Yoklama", desc: "Yoklama alma, düzenleme", group: "egitim" },
  { key: "katalog", label: "Eğitim Kataloğu", desc: "Branş, eğitim, bölüm, track yönetimi", group: "egitim" },

  { key: "satis_yap", label: "Satış Yap", desc: "Yeni öğrenci + kayıt oluşturma dahil satış yapma, satış iptali", group: "satis_finans" },
  { key: "satis_liste", label: "Satış Listesi", desc: "Satış kayıtlarını görüntüleme, aylık takip", group: "satis_finans" },
  { key: "paket_yonetimi", label: "Paket Yönetimi", desc: "Paket oluşturma, düzenleme, silme", group: "satis_finans" },
  { key: "kampanya_yonetimi", label: "Kampanya Yönetimi", desc: "Kampanya oluşturma, düzenleme, silme", group: "satis_finans" },
  { key: "odeme", label: "Ödeme / Tahsilat", desc: "Ödeme kaydetme, tahsilat takibi", group: "satis_finans" },

  { key: "aktivite", label: "Aktivite Merkezi", desc: "Aktivite/vaka takibi, randevu takvimi", group: "diger" },
];
