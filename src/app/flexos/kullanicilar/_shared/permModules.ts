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
}

export const PERM_MODULES: PermModuleDef[] = [
  { key: "kisi", label: "Kişi Yönetimi", desc: "Kişi oluşturma, düzenleme, PII erişimi" },
  { key: "kayit", label: "Kayıt İşlemleri", desc: "Eğitime kayıt, grup değiştirme" },
  { key: "sinif", label: "Sınıf / Grup", desc: "Grup oluşturma, düzenleme, silme, öğrenci/eğitmen atama" },
  { key: "not", label: "Not / Değerlendirme", desc: "Not girme, görüntüleme, modül bitirme" },
  { key: "satis_yap", label: "Satış Yap", desc: "Yeni satış oluşturma, satış iptali" },
  { key: "satis_liste", label: "Satış Listesi", desc: "Satış kayıtlarını görüntüleme, aylık takip" },
  { key: "paket_yonetimi", label: "Paket Yönetimi", desc: "Paket oluşturma, düzenleme, silme" },
  { key: "kampanya_yonetimi", label: "Kampanya Yönetimi", desc: "Kampanya oluşturma, düzenleme, silme" },
  { key: "odeme", label: "Ödeme / Tahsilat", desc: "Ödeme kaydetme, tahsilat takibi" },
  { key: "aktivite", label: "Aktivite Merkezi", desc: "Aktivite/vaka takibi, randevu takvimi" },
  { key: "egitmen_ekle", label: "Eğitmen Ekleme", desc: "Yeni eğitmen kaydı oluşturma" },
  { key: "egitmen", label: "Eğitmen Kadrosu", desc: "Eğitmen düzenleme/silme, ücret görüntüleme/düzenleme" },
  { key: "katalog", label: "Eğitim Kataloğu", desc: "Branş, eğitim, bölüm, track yönetimi" },
  { key: "sistem", label: "Sistem Yönetimi", desc: "Rol tanımlama, yetki paketlerini düzenleme" },
  { key: "personel_ekle", label: "Personel Ekleme", desc: "Yeni personel/kullanıcı hesabı oluşturma" },
];
