# Flex Platform — Mimari Dokümantasyon

> Bu dosya teknik kararların ve genel mimarinin referans notudu.
> Yeni bir modüle veya projeye başlarken buraya bakılmalı.

---

## Genel Yapı

```
Flex CRM (İç Sistem)
├── Eğitim Modülü
│   ├── Tasarım Atölyesi  ← şu an geliştirilen
│   ├── [3D Modelleme]    ← ileride
│   └── [Dijital Pazarlama, ...]
├── Eğitim Operasyon Modülü
├── Satış Modülü
└── [...]

Öğrenci Portalı (Ayrı uygulama)
└── CRM API'siyle konuşur, sadece kendi datasını görür
```

---

## Tasarım Atölyesi

- Flex CRM'in **Eğitim Modülü** altında bir alt modül
- Grafik Tasarım eğitmenine özel
- **Aynı zamanda bağımsız ticari ürün olarak da çalışabilir**
- Şu an standalone Next.js + Firebase olarak geliştirilmekte
- Flex CRM'e entegre edildiğinde auth ve user yönetimi merkezi sisteme devredilecek

---

## Ölçek Kararları

| Katman | Kullanıcı Sayısı | Notlar |
|---|---|---|
| CRM kullanıcıları (eğitmen, admin, operasyon, satış) | 50–100 | Aktif session, Firebase Auth |
| Öğrenci datası | Binlerce (eski veriler dahil) | Firestore'da kayıt, portal auth ayrı |
| Eş zamanlı aktif kullanıcı | Düşük | Belirli saatlerde yoğunluk, gece sessiz |

**Bu ölçekte:** Firestore yeterli, over-engineering gereksiz. Öğrenci portalı ayrı tutulduğu için CRM tarafında yük minimal kalır.

---

## Öğrenci Portalı — Neden Ayrı?

- **Güvenlik:** Binlerce öğrenci CRM'in iç auth sistemine girerse tüm iç veri riske girer
- **Yetki izolasyonu:** Öğrenci sadece kendi datasını görür; CRM kullanıcısı çok daha geniş yetkili
- **Ölçeklenebilirlik:** Öğrenci trafiği CRM trafiğinden bağımsız scale edilebilir

Portalın şu an için mimarisi:
- Ayrı Next.js uygulaması
- Ayrı Firebase Auth (ya da ilerleyen zamanda ayrı auth sağlayıcı)
- Aynı Firestore, ama **ayrı security rules** ile
- CRM PostgreSQL'e geçerse portal API katmanı üzerinden bağlanır

---

## User / Role / Branch Mimarisi

Şu anki yapı (Firestore):

```
users/{uid}
├── name, surname, email, phone
├── roles: string[]          // ["admin", "instructor", ...]
├── branch: string           // "grafik-tasarim", "3d-modelleme", ...
├── permissionOverrides: {}  // rol defaults üzerine ince ayar
├── avatarId: number
├── photoURL?: string        // kullanıcı fotoğrafı (ileride)
└── isActivated: boolean
```

- `roles` array olduğu için bir kullanıcı birden fazla rol taşıyabilir
- `branch` ileride birden fazla olabilir — gerekirse `branches: string[]`'e geçilebilir
- `permissionOverrides` rol bazlı default yetkilerin üzerine ince ayar sağlar

---

## Flex CRM'e Geçişte Değişecekler

- **Veritabanı:** Firestore → PostgreSQL + Prisma (modüller arası ilişkisel veri, raporlama, satış pipeline için)
- **Auth:** Her modülün ayrı auth'u → merkezi kimlik katmanı (tüm modüller buradan beslenecek)
- **Öğrenci Portalı:** CRM'in API'siyle konuşacak, doğrudan DB erişimi olmayacak
- **Tasarım Atölyesi:** Mevcut Firestore yapısı referans alınarak yeni şemaya migrate edilecek

---

## Modül Bağımsızlığı Prensibi

Her modül:
- Kendi başına çalışabilir (standalone ürün olabilir)
- CRM'e bağlandığında merkezi auth ve user yönetimini devralır
- Diğer modüllere doğrudan bağımlı değil, API/event üzerinden haberleşir

---

*Son güncelleme: Mart 2026*
