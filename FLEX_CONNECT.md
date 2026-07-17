# Flex Connect — Mimari (Sonnet Uygulama Referansı)

> **Bu dosya = Flex Connect'in tek mimari kaynağı.** Opus çıkardı (2026-07-18),
> **kodlamayı Sonnet yapacak.** Tasarıma **BİREBİR** sadık kalınır (WhatsApp benzeri
> ama kurumsal). Mimari onaylandı; revizyonlar (2026-07-18) işlendi.
>
> - Tasarım kaynağı: `_design/flex-connect/Flex Connect.dc.html` (tam-sayfa 3 kolon) +
>   `_design/flex-connect/Flex Connect Widget.dc.html` (sağ-alt FAB widget). `support.js`
>   = DesignCode runtime (framework, uygulama mantığı DEĞİL — okumaya gerek yok).
> - İlişkili: `FLEXOS.md` (ana mimari), hafıza `[[project_flex_connect]]`.

---

## Durum / İlerleme

> Bu blok ne yapıldığını izler (tasarım/mimari aşağıda, ilerleme burada).

### ✅ Faz 1 — çekirdek uçtan uca (2026-07-18, Sonnet oturumu)

Mimari kilitlendikten hemen sonra AYNI oturumda uygulandı — §8 Faz 1'in 9 adımı da bitti:

1. **Domain tipleri** — `domain/core/connect.ts` (ConnectConversation/Member/Message,
   revize model: `members` alt-koleksiyonu, `memberUids[]`/`reads` YOK, mesajda sadece
   `authorUid`) + `domain/repo/connect-repo.ts`.
2. **Firestore rules + index** — `connect_conversations` + `members`/`messages` alt-
   koleksiyonları, `chats`'teki AYNI "sadece okuma açık, yazma Admin SDK" deseni
   (`exists()` tabanlı `isConnectMember`). `collectionGroup(members)` için `uid`+`realm`
   index (composite + fieldOverride) + `connect_conversations` audience composite index.
   **Gerçekten deploy edildi** (`firebase deploy --only firestore:rules,firestore:indexes`).
3. **Server repo + `connect-service.ts`** — `createConversation`/`sendMessage`/
   `listConversationsForPrincipal`/`markRead`/`addMember`/`removeMember`. İzolasyonun
   kalbi burada: `assertMembersMatchRealm` öğrenciyi `staff` realm'e eklemeyi HER
   YOLDAN reddeder (create + addMember).
4. **API route'ları** — İKİ AYRI aile: `/api/flexos/connect/*` (personel,
   `staffPrincipalFromCaller`) ve `/api/flexos/student/connect/*` (öğrenci,
   `studentPrincipalFromRequest`, `personId`+`authUid` — Actor/capability YOK). **Kritik
   güvenlik notu:** `flexos_users` personel VE öğrenci girişini AYNI koleksiyonda tuttuğu
   için (`roles:["ogrenci"]`) `staffPrincipalFromCaller` önce `persons.findByAuthUid`
   ile "bu uid bir öğrenci mi" diye kontrol eder — öyleyse staff route'una ASLA giremez,
   `actorFromCaller`'ın grants=[] ile sessizce "staff" sayması engellenir.
5. **Kimlik çözümleme** — `server/connect-identity.ts` (uid→ad/renk, `persons`+
   `flexos_users` batch — bunun için her iki repo'ya YENİ `getByAuthUids` metodu
   eklendi, additive/geriye-uyumlu) + `server/connect-view.ts` (DM karşı-taraf adı,
   lastMessage/mesaj render şekli).
6. **Personel tam sayfa** (`/flexos/connect`) — 3 kolon, tasarımdan birebir renk/spacing.
   Create modal: realm seçici (Personel/Eğitmen-Öğrenci) + tip (Kanal/Grup/DM) +
   personel için dizin (`/connect/directory`), eğitmen-öğrenci için KENDİ grubu→roster
   (`/api/flexos/groups` + `/api/flexos/groups/[id]/roster` — roster'a `authUid` alanı
   eklendi, additive) + "tüm öğrencilere aç" (audience) toggle'ı bridge kanal için.
7. **Öğrenci tam sayfa** (`/flexos/student/[personId]/connect`) — aynı bileşen deseni,
   create UI YOK (Faz 1 kararı).
8. **Widget** (`_components/ConnectWidget.tsx`) — sağ-alt FAB + mini pencere, "tam ekran
   aç". Eğitmen Ana Sayfa (`egitmen-anasayfa/page.tsx`) + Öğrenci Ana Sayfa
   (`student/[personId]/page.tsx`) içine gömüldü — kalan sayfalara yaygınlaştırma
   (paylaşımlı layout olmadığı için) FAZ 2.
9. **Test** — `scripts/assert-connect.ts`, 20/20 geçti (izolasyon: öğrenci staff'ı
   göremez/okuyamaz/yazamaz; audience köprüsü okur-yazamaz; writePolicy; realm
   doğrulaması; addMember/removeMember yetkisi; tenant izolasyonu). `tsc --noEmit` +
   `npm run build` temiz, mevcut TÜM assert scriptleri (19 dosya) hâlâ yeşil.

**Gerçek zamanlılık:** Mesaj listesi `onSnapshot` (kanıtlanmış `chats` deseni), konuşma
listesi API'den fetch + mesaj geldiğinde hafif refetch (tam client-side collectionGroup
canlı liste Faz 1'de YOK, gereksiz karmaşıklık).

**Bilinçli Faz 1 sınırları (Faz 1-sonu/Faz 2'ye ertelendi):** Topluluk UI/backend'i yok
(tasarımda modalın "Tür" seçicisinde bile YOK — sadece Kanal/Grup/DM); reaksiyon, okundu-
tikleri, favoriler/sabitleme, misafir daveti, dosya eki YOK; konuşma meta PATCH (ad/açıklama
düzenleme) YOK; widget sadece 2 Ana Sayfa'da (paylaşımlı layout yok, ~40 sayfaya gömme işi).

**SIRADAKİ İŞ (2026-07-18'de kapandı):** Canlı doğrulama yapıldı — aşağıdaki blok.

---

### ✅ Canlı doğrulama + UI/gerçek-bug turu (2026-07-18, aynı gün devamı — Sonnet, PC oturumu)

Gerçek admin hesabıyla + gerçek ikinci bir test girişiyle (`scripts/seed-connect-test-login.mjs`,
kullanım sonrası silindi) canlıda test edildi. Bu turda bulunan/düzeltilen GERÇEK bug'lar:

1. **En kritik bug — admin-only kanalda composer hiç kimseye görünmüyordu.** API,
   konuşma listesinde "çağıran bu konuşmanın admini mi" bilgisini hiç döndürmüyordu.
   `writePolicy:"admins"` olan HER kanalda (Kurum Duyuruları gibi) composer, o kanalın
   admini/owner'ı olsan bile hep gizleniyordu — kullanıcı uzun bir "hiçbir şey
   değişmiyor" turu yaşadı (dev server/cache sanıldı, asıl sebep bu değildi). Fix:
   `ConnectConversationView.isAdmin` eklendi (`connect-view.ts`), UI koşulu
   `writePolicy==="admins" && !isAdmin` oldu. Debug: gerçek Firestore verisi
   (`admins[]`/`members[]`) doğrudan sorgulanıp gerçek admin uid'iyle karşılaştırıldı,
   sonra ekrana geçici bir DEBUG satırı basılıp doğrulandı (sonra kaldırıldı).
2. **Header aksiyon ikonları eksikti** — ilk portta "minimal" diye küçült/ara/bilgi/menü
   atlanmıştı, kullanıcı ekran görüntüsüyle gösterip geri istedi: küçült (`router.back()`),
   ara (konuşma içi mesaj filtresi), bilgi (gerçek açıklama+üye listesi paneli —
   mockup'ın uydurma "428 üye"si yerine GERÇEK sayı), menü ("Konuşmadan Ayrıl" →
   `DELETE members`).
3. **İkon yanlıştı** — `lucide-react`'in güncel sürümünde `MessageCircle`'ın path'i
   değişmiş, tasarımın verdiği SVG'yle eşleşmiyordu ("içi boş" görünüyordu). Path
   doğrudan gömüldü: `_shared/ConnectIcon.tsx`.
4. **Scroll bug'ı (iki parça):** (a) konuşma ilk açılırken önce baş gösterip SONRA
   aşağı kayıyordu — `firstLoadRef` ile ilk yüklemede `behavior:"auto"` (anında),
   sonrakiler `"smooth"`. (b) konuşma DEĞİŞTİRİNCE eski mesajlar temizlenmeden yeni
   fetch başlıyordu, kısa süre YANLIŞ (önceki) konuşmanın mesajları görünüyordu —
   artık tıklar tıklamaz `setMessages([])` + `loadingMessages` spinner.
5. **Gerçek "yazıyor" presence sistemi kuruldu** — kullanıcı önce görsel bir önizleme
   istedi (Artifact ile `fcType` animasyonu izole gösterildi), sonra "gerçek presence"
   dedi. `connect_conversations/{id}/typing/{uid}` (yeni koleksiyon, rules AYNI
   messages deseni — okuma açık/yazma Admin SDK). Composer'da 2sn throttle'lı sinyal,
   6sn TTL ile client'ta süzülüyor. **Konum bug'ı:** ilk portta mesaj listesinin
   İÇİNE konmuştu (tasarımda scroll alanının DIŞINDA, composer'ın üstünde sabit bir
   satır) — düzeltildi, ayrıca taşma (marginTop fazlalığı → composer'ın arkasında
   kalma) ve yatay hizasızlık (dış/iç padding farklı matematik kullanıyordu, composer'la
   birebir aynı yapıya çekildi) ayrı ayrı bulunup düzeltildi. Gerçek test için
   `scripts/seed-connect-test-login.mjs` (gerçek 2. Firebase Auth hesabı, admin olarak
   Kurum Duyuruları'na eklenir) yazıldı — kullanıldı, sonra silindi.
6. **Composer eksikleri tamamlandı** — emoji butonu (gerçek hızlı-seç panosu,
   `_shared/EmojiPicker.tsx`) + dosya ekle ikonu (görsel, gerçek yükleme Faz 2,
   disabled+tooltip).
7. **Okunmamış rozeti gerçek sayıya çevrildi** — sabit nokta yerine kırmızı dairede
   gerçek mesaj sayısı. `Conversation.messageCount` (her `sendMessage`'da artar) +
   `Member.readMessageCount` (`markRead`/kendi mesajını gönderince güncellenir) —
   `unreadCount = messageCount - readMessageCount`, tek tek mesaj taramadan hesaplanır.
   Nav rayı + widget FAB rozeti de konuşma SAYISI değil toplam okunmamış MESAJ
   sayısını gösterecek şekilde güncellendi. `seed-connect-demo.mjs` bu sayaca uyacak
   şekilde güncellenip yeniden çalıştırıldı.
8. **Responsive genişlik** — ChatGPT'nin önerdiği kademeli yüzde yaklaşımı yerine tek
   `max-width:2560px + margin:auto` kuralı (aynı sonuç, kesme noktalarında sıçrama yok).
9. **Dummy veri** — `scripts/seed-connect-demo.mjs`: Kurum Duyuruları tasarımdaki THREAD
   ile birebir (gerçek admin uid'i son mesajın yazarı) + 5 kanal daha birer önizleme
   mesajıyla. 4 sahte personel hesabı (Elif Kaya vb., sadece isim/renk için, giriş
   yapamazlar) `flexos_users`'a yazıldı — CANLI "Kullanıcılar" sayfasında da görünürler,
   `--clean` ile geri alınabilir.

**Değişmeyen mimari:** İzolasyon, realm modeli, `members`/`messages` alt-koleksiyon
yapısı, API route ayrımı (staff/student) — hiçbiri bu turda değişmedi, sadece UI/UX
eksikleri ve bir gerçek yetki-görünürlüğü bug'ı kapatıldı.

**SIRADAKİ İŞ (Mac'te devam):** Kalan "chat kısımları" — kullanıcı Mac'e geçince
üzerinde konuşulacak, henüz kapsam netleşmedi. Bilinen açık kalanlar: Topluluk
(Faz 1-sonu), reaksiyon/okundu-tik/favoriler/misafir/dosya eki (Faz 2), widget'ın
kalan sayfalara yayılması, konuşma meta düzenleme (ad/açıklama PATCH) — hiçbiri
bu oturumda ele alınmadı.

---

### ✅ Kurumsal Audit Log altyapısı (Faz 2'den önce, 2026-07-18, Mac oturumu)

**Amaç netleştirildi (kullanıcı):** kullanıcı hareketi (mesajlaşma) DEĞİL, YÖNETİMSEL
işlemlerin kaydı. Yeni append-only `connect_audit/{id}` koleksiyonu — 3 katmanlı
desen (`domain/core/connect-audit.ts` tip + `domain/repo/connect-audit-repo.ts` PORT,
BİLİNÇLİ olarak sadece `create` metodu var, update/delete YOK + `server/
connect-audit-repo.firestore.ts` Firestore impl) `flexos_activity_log` ile AYNI
kanıtlanmış desenin kopyası. Firestore rules `allow read, write: if false` —
tamamen server-only, gelecekteki yönetim paneli bir API route üzerinden okuyacak
(henüz o route yazılmadı).

**Kapsam kararı (kullanıcıyla netleşti — scope creep'ten kaçınmak için):** Faz 1'de
GERÇEKTEN var olan 3 işlem türüne bağlandı: `createConversation` (kanal/grup/topluluk
— `channel.create`/`audience_channel.create`/`group.create`/`community.create`, DM
kapsam dışı bırakıldı), `addMember` (`member.add`), `removeMember` (`member.remove`).
`ConnectAuditAction` tipi kullanıcının istediği TAM taksonomiyi tanımlıyor (channel/
group silme, admin ver/al, ayar PATCH, mesaj sil/düzenle, toplu üye ekleme, realm
değişikliği dahil) ama bu eylemlerin servis fonksiyonları Faz 1'de hiç yok — o yüzden
gerçek `logAudit(...)` çağrısı eklenmedi, sadece tip hazır. Her biri yazıldığında
(Faz 2 veya ayrı "yönetim işlemleri" turu) tek satır `logAudit` çağrısı eklenir.

**Uygulama detayları:**
- `connect-service.ts`: `ConnectDeps`'e `auditLog: ConnectAuditRepo` eklendi. Yeni
  private `logAudit(...)` yardımcı — best-effort (activity-log/mail ile AYNI ilke:
  audit yazım hatası asıl işlemi ASLA başarısız kılmaz, `try/catch` + `console.error`).
  `actorName`/`targetName` mevcut `resolveDisplayName` reuse edilerek çözülüyor.
- IP/user-agent: yeni `connect-principal.ts::extractConnectRequestMeta(req)`
  (`x-forwarded-for` — OTP route'undaki AYNI desen). `createConversation`/`addMember`/
  `removeMember`'a opsiyonel 4./6. parametre (`meta?: ConnectRequestMeta`) eklendi,
  2 route dosyasından (`conversations/route.ts` POST, `.../members/route.ts` POST+DELETE)
  geçiriliyor. Öğrenci route'ları bu 3 fonksiyonu hiç çağırmıyor (Faz 1 kararı —
  öğrencide create/member-yönetimi YOK), dokunulmadı.
- Test: `scripts/assert-connect.ts` yeni audit bloğu (8 assertion: 3 create action tipi
  doğru + DM loglanmıyor + member.add/remove + **normal mesaj gönderme LOGLANMIYOR**
  + her kayıtta actorUid/actorName/tenantId/realm/createdAt dolu) — 28/28 geçti.
  `tsc --noEmit` + `npm run build` temiz, mevcut 19 assert dosyası (407 assertion) hâlâ yeşil.

**Mimariye dokunulmayan kısım:** `connect_conversations`/`members`/`messages` şeması,
izolasyon, realm modeli, API route ayrımı (staff/student) — HİÇBİRİ değişmedi, audit
tamamen additive (yeni koleksiyon + var olan fonksiyonların sonuna log çağrısı).

**SIRADAKİ İŞ:** Yok — bu tur kapandı. Bilinen açık: eksik yönetim işlemleri
(kanal/grup silme, admin ver/al, ayar PATCH, mesaj sil/düzenle, toplu üye ekleme,
realm değişikliği) hâlâ kod olarak yok; yazıldıklarında audit hook'u eklenmeli.
Yönetim panelinden filtreleme/okuma API'si de henüz yok.

---

### ✅ Faz 2 · madde 1 — Favoriler/sabitleme (2026-07-18, Mac oturumu)

Kullanıcı Faz 2'yi karmaşıklık sırasına göre yapmaya karar verdi: 1) Favoriler
2) Reaksiyonlar 3) Okundu-tikleri 4) Dosya ekleri 5) Misafir daveti. Bu ilk madde
tamamlandı — veri modelinde zaten var olan `ConnectMember.pinned` alanı UI'ya bağlandı.

- **Backend:** `connect-service.ts::setPinned(principal, conversationId, pinned, deps)`
  — `markRead` ile AYNI ilke (üye değilse no-op), yetki gerekmez (kişisel tercih).
  **Audit Log'a YAZILMAZ** (yönetimsel işlem değil). İki route: `/api/flexos/connect/
  conversations/[id]/pin` (staff) + `/api/flexos/student/connect/conversations/[id]/pin`
  (student) — `read` route'unun birebir kopyası deseni.
- `connect-view.ts::ConnectConversationView` + `connectClient.ts::ConversationView`'a
  `pinned: boolean` eklendi (`member?.pinned ?? false`).
- **UI — SADECE personel sayfası (`/flexos/connect`):** rail'e 5. nav öğesi "Favoriler"
  (`star`, `Star` ikonu — gerçek bir `ConnectConversationType` DEĞİL, yerel `NavKey`
  birleşimi, tüm tiplerden `pinned` olanları cross-type gösterir). Kolon 2 segment
  kontrolü `Tümü/Okunmamış` → `Tümü/Okunmamış/Sabitlenen` (3 segment, tasarımın
  `filters` dizisiyle birebir). Header "..." menüsüne "Favorilere Ekle"/"Favorilerden
  Çıkar" eklendi (`Star`/`StarOff` ikonu — ilk versiyonda "Sabitle" yazıyordu, kullanıcı
  düzeltti: ikon/sekme "Favoriler" diyorsa aksiyon da "favorilere ekle" demeli, "sabitle"
  farklı bir kavram çağrıştırıyor. İyimser güncelleme + hata durumunda geri alma.
- **Öğrenci sayfasına (`/flexos/student/[personId]/connect`) UI eklenmedi** — o sayfada
  "..." menüsü/rail chrome'u hiç yok (Faz 1'de bilinçli minimal tutulmuş), sadece
  Favoriler için o UI'yı sıfırdan kurmak scope creep olurdu. Backend (route) simetrik
  olarak zaten hazır — istenirse ileride ucuz bir ekleme.
- **Test:** `scripts/assert-connect.ts`'e 4 yeni assertion (kendi tercihini ayarlama,
  kaldırma, audience-only için no-op, audit'e yazılmadığı doğrulaması) — 32/32 geçti.
  `tsc --noEmit` + `npm run build` temiz, 19 assert dosyası hâlâ yeşil.
- **Görsel doğrulama yapılmadı** — sayfa Firebase Auth login gerektiriyor, bu oturumda
  canlı bir kullanıcı oturumu yoktu. Kullanıcı canlıda "Favoriler" sekmesini + "..."
  menüsündeki sabitle/kaldır'ı elle kontrol etmeli.

**SIRADAKİ İŞ:** Faz 2 madde 2 — Reaksiyonlar.

---

### ✅ "Yeni Konuşma" modalı gerçek tasarıma göre yeniden yapıldı + DM akışı + Topluluk (2026-07-18, aynı oturum)

Kullanıcı gerçek ekran görüntülerini (`Flex Connect.dc.html`ün gerçek `createTypes`/
`groupChoices` render script'i) gösterip önceki modalın YANLIŞ olduğunu belirtti:
(1) tasarım 780px yatay, benimki 640px dikeydi; (2) "Kimin İçin" (realm seçici) diye
bir adım tasarımda HİÇ yok, ben uydurmuştum; (3) DM bir TÜR seçeneği DEĞİL —
tasarımda sadece Kanal/Grup/Topluluk var; (4) Grup seçilince gerçek sınıflar
listelenip roster ANINDA altına eklenmeli; (5) Topluluk (`kodları vardı` — design
script'inde tam mantığı zaten yazılıydı, sadece UI'ya hiç bağlanmamıştı) gerçek
sınıf seçip otomatik "Genel Duyuru" kanalı kurmalı.

**DM'in yeni modeli (kullanıcı tarif etti):** ayrı bir "oluştur" akışı YOK. Rayda
personel için 2 yeni ikon — **Personel** + **Öğrenciler** — eğitmen için 1 yeni
ikon — **Eğitmenlerim**. Birine tıklayınca Kolon 2'de o dizin (var olan DM önizlemesiyle
birlikte) listelenir; bir kişiye tıklayınca var olan DM açılır ya da ANINDA oluşturulur.

**Backend (gerçek yeni iş):**
1. `GET /api/flexos/connect/student-directory` — eğitmenin KENDİ gruplarındaki
   (`Group.trainerId===principal.trainerId`) tüm öğrenciler, dedup.
2. `GET /api/flexos/student/connect/trainer-directory` — öğrencinin aktif/tamamlanmış
   kayıtlarındaki grupların eğitmen(ler)i (`Group.trainerId`→`flexos_trainers`→`authUid`), dedup.
3. `connect-service.ts::createConversation` — Faz 1 kararı ("öğrenci oluşturamaz")
   HÂLÂ geçerli, TEK dar istisna: `type:"dm"` + `realm:"trainer_student"` + hedef
   GERÇEKTEN öğrencinin KENDİ enrollment/grup kaydındaki eğitmeni ise (`isStudentsOwnTrainer`
   — client'a güvenmeden sunucu kendi enrollment→grup→trainer zincirini yeniden hesaplar).
   `ConnectDeps`'e SADECE bu doğrulama için `enrollments`/`groups`/`trainers` repo'ları eklendi.
4. **DM dedup** (`findExistingDm`) — aynı iki kişi arasında zaten bir DM varsa dizinden
   tekrar tıklanınca YENİ kopya oluşturulmaz, var olanı döner (iki yönlü de çalışır).
5. **Sınıf odası dedup** (`ConnectConversation.sourceGroupId` yeni alan + `ConnectRepo.
   findBySourceGroupId`) — aynı FlexOS sınıfı için ikinci "sınıf odası" oluşturulmaz,
   var olanı yeniden kullanır. Hem Grup/Sınıf akışında hem Topluluk'un sınıf-odası
   oluşturma adımında AYNI mekanizma.
6. `connect-view.ts`/`connectClient.ts` — dm tipi konuşmalara `peerUid` eklendi (dizinden
   birine tıklayınca "bununla zaten DM var mı" eşleşmesi için).
7. `/api/flexos/student/connect/conversations` route'una POST eklendi (önceden sadece
   GET vardı — öğrenci route ailesinde hiç create endpoint'i yoktu).

**"Yeni Konuşma" modalı — TAMAMEN yeniden yazıldı (`connect/page.tsx`):**
- 780px, tasarımın `createTypes`/2-kolon gövde/footer yapısıyla birebir. "Kimin İçin"
  adımı TAMAMEN kaldırıldı — realm artık türe göre türetiliyor.
- **Kanal:** varsayılan `staff` + Yayıncılar (personel çipleri); "Tüm öğrencilere aç"
  açılırsa `trainer_student`+audience (eski bridge-channel özelliği KORUNDU, tasarımda
  yoktu ama FLEX_CONNECT.md'nin çekirdek mimarisi — kaldırılamaz).
  Tür ikonları tasarımla birebir: Kanal=Megaphone, Grup=UsersRound, Topluluk=Users
  (design script'inin `ICONS.group`/`ICONS.community`'siyle bit-bit eşleşen SVG path'ler).
- **Grup:** yeni "Sınıf" | "Personel" alt-sekmesi (tasarımda yok, kullanıcının "sınıf
  seçilince roster otomatik eklensin" isteğini karşılamak + var olan personel-iş-grubu
  kapasitesini kaybetmemek için eklendi — şeffaf bir ek). "Sınıf" modu: gerçek
  `/api/flexos/groups` listesi (GRP-784 gibi), seçince roster (`/api/flexos/groups/
  [id]/roster`) ANINDA altına isim isim eklenir, `sourceGroupId` ile gönderilir.
- **Topluluk:** gerçek sınıf listesi (checkbox, ≥2 seçim zorunlu), reach sayısı
  `Group.enrolled` alanından (roster fetch gerekmez, tasarımın statik sayısının
  yerine gerçek veri). Oluşturunca: seçili her sınıf için sınıf odası oluştur/yeniden-
  kullan (sırayla, `sourceGroupId` dedup) → union roster'la otomatik "{ad} — Genel
  Duyuru" kanalı → topluluk kaydı (`childIds`=sınıf odaları). Kullanıcı topluluğun
  KENDİSİNE değil, gerçek iletişimin olduğu Genel Duyuru kanalına yönlendirilir
  (topluluk için rayda henüz bir sekme yok, Faz 1-sonu; boş bir ekran açmak yerine
  faydalı olan kanala gidilir).
- `GroupItem` client tipi `enrolled: number` aldı (`/api/flexos/groups` zaten dönüyordu,
  sadece client tipi eksikti).

**Test:** `scripts/assert-connect.ts`'e 10 yeni assertion — öğrenci hâlâ kanal/grup
oluşturamıyor, kendi eğitmeni OLMAYANA DM açamıyor, kendi eğitmenine açabiliyor, DM
dedup (iki yönlü), sourceGroupId dedup. **38/38 geçti.** `tsc --noEmit` + `npm run build`
temiz, 19 assert dosyası (445 assertion) hâlâ yeşil.

**Görsel doğrulama yapılmadı** (Firebase Auth login gerektiriyor) — kullanıcı canlıda
Personel/Öğrenciler/Eğitmenlerim dizinlerini + yeni modalı elle kontrol etmeli.

**SIRADAKİ İŞ:** Faz 2 madde 2 — Reaksiyonlar (kullanıcı onaylarsa).

---

### ✅ Küçült/Kapat ayrımı + widget ikon düzeltmesi (2026-07-18, aynı oturum)

Kullanıcı bulgusu: tam ekran sayfasındaki "küçült" butonu aslında `router.back()`
yapıyordu — widget her zaman kapalı state'le mount olduğu için bu sohbetin
TAMAMEN kapanması gibi hissettiriyordu, gerçek bir "küçült/widget'a dön" davranışı
yoktu. Fix: `ConnectWidget.tsx`'e `requestConnectWidgetReopen()` (sessionStorage
bayrağı) eklendi — widget mount olduğunda bayrak varsa otomatik `open:true` ile
mini pencerede açılıyor. `connect/page.tsx` header'ında artık İKİ ayrı buton var:
**Küçült** (bayrağı set edip `router.back()` — widget'a dönüldüğünde mini pencere
açık görünür) ve **Kapat** (`X`, sadece `router.back()` — widget kapalı/sadece FAB
kalır). Ayrıca widget'ın mini pencere header'ındaki "Tam ekran aç" ikonu (`ChevronLeft`
135° döndürülmüş bir hack'ti) kullanıcının verdiği gerçek Lucide `ExternalLink` SVG
path'iyle birebir eşleşti, artık gerçek `ExternalLink` ikonu kullanılıyor.

`tsc --noEmit` + `npm run build` temiz. Sadece personel tam sayfası + widget
etkilendi (öğrenci tam sayfasında zaten küçült/menü header'ı yok).

---

### ✅ İlk yüklemede otomatik konuşma seçimi (2026-07-18, aynı oturum)

Kullanıcı bulgusu: tam ekranı açıp hiçbir konuşma seçmezsen üstte header/bar HİÇ
görünmüyordu (Kolon 3 sadece `selected` doluyken render ediliyordu). Çözüm: sayfa
ilk yüklendiğinde hâlâ hiçbir şey seçili değilse, liste zaten en son mesaja göre
azalan sıralı olduğu için (`connect-view.ts` sort) en üstteki (channel/group/dm,
community hariç) konuşma otomatik seçiliyor + o konuşmanın türüne göre rail sekmesi
de değişiyor (liste satırı da vurgulanmış görünsün diye). `autoSelectedRef` ile
SADECE ilk yüklemede tetiklenir — mesaj gönderince tetiklenen sonraki
`loadConversations()` çağrıları kullanıcının seçimini yerinden oynatmaz. Hem
personel (`connect/page.tsx`) hem öğrenci (`student/[personId]/connect/page.tsx`)
sayfasına aynı fix eklendi (yapısal olarak ikisinde de aynı eksiklik vardı).
`tsc --noEmit` + `npm run build` temiz.

---

## 0. Değişmez ilkeler

1. **BAĞIMSIZ.** Flex Connect, ödev/teslim sistemine ASLA dokunmaz. Mevcut
   `chats/{assignmentId}_{personId}` ödev-thread'i olduğu gibi kalır — Connect
   tamamen yeni `connect_conversations` koleksiyonu kullanır.
2. **TASARIMA BİREBİR SADAKAT.** Renk/spacing/ikon/animasyon `.dc.html`'den birebir
   port edilir. Sonnet stil için tasarım dosyasını açıp değerleri kopyalar; "yaklaşık"
   veya "kendi yorumu" YOK. Sabitler §11'de özetlendi ama kaynak `.dc.html`'dir.
3. **İKİ REALM + SERT İZOLASYON.** Öğrenci, personelin kanal/grup/1:1'ini ASLA görmez
   (§2, §4). Bu, tüm mimarinin belkemiği.
4. **Kimlik mevcut Firebase Auth üstüne kurulur.** Personel = `flexos_users`, öğrenci
   = `persons` — ikisi de zaten Auth'a bağlı. Yeni kimlik tablosu YOK.
5. **Avatar = baş harf + renk** (proje kuralı, tasarım zaten böyle). İllüstrasyon YOK.

---

## 1. İki Realm + izolasyon (belkemiği)

Realm bir **kişinin** değil, **konuşmanın** özelliğidir. Erişim = **üyelik** (members
alt-koleksiyonu) VEYA **audience** eşleşmesi.

| Realm | Kim | Tipler |
|-------|-----|--------|
| `staff` | Personel (`flexos_users`) | channel, group, dm |
| `trainer_student` | Eğitmen + öğrenci | group (sınıf odası), dm (özel), community |

- **Eğitmen personeldir** → hem `staff` hem `trainer_student` konuşmalarda üye olabilir.
- **Öğrenci SADECE `trainer_student`**'ta üye olabilir. `staff` bir konuşmaya öğrenci
  eklemek yasak (servis reddeder + rules engeller).
- **Tek kontrollü köprü:** personelin yazıp öğrencinin OKUDUĞU resmi kanallar
  ("Öğrenci İşleri", "Kurum Duyuruları") → `audience: "all_students"`. Öğrenci bu
  kanalların üyesi DEĞİLDİR (member dokümanı yok) ama audience sayesinde okur, yazamaz.

Asimetrik izolasyon özeti:
- Öğrenci görür: üyesi olduğu trainer_student grupları + 1:1'leri + eğitmen toplulukları
  + `audience:"all_students"` kanallar.
- Öğrenci GÖRMEZ: tüm `staff` realm (kanal/grup/1:1).

---

## 2. Veri modeli (revize edilmiş — 2026-07-18)

### `connect_conversations/{conversationId}`
```
realm:        "staff" | "trainer_student"
type:         "channel" | "group" | "community" | "dm"
name:         string            // dm'de boş olabilir; liste ismi karşı taraftan çözülür
description?: string
colorKey?:    string            // avatar/ikon rengi (tasarım paleti)
writePolicy:  "admins" | "members"   // channel=admins, group/dm/community=members
admins:       string[]          // channel yazarları + konuşma yöneticileri (küçük dizi, OK)
audience?:    "all_students" | null   // köprü kanallar; null = sadece üyeler
childIds?:    string[]          // SADECE community: paketlediği grupların convId'leri
lastMessage:  { text: string, senderUid: string, at: Timestamp } | null
ownerUid:     string            // oluşturan
tenantId:     string
createdAt:    Timestamp
createdBy:    string
updatedAt?:   Timestamp
```
> **Not (revizyon 1+4):** `memberUids` dizisi KALDIRILDI (üyelik alt-koleksiyonda).
> `lastMessage.senderName` yerine `senderUid` — isim liste kurulurken çözülür.

### `connect_conversations/{conversationId}/members/{uid}`
Üyelik + okunma + kullanıcı tercihi TEK yerde (revizyon 1+2):
```
uid:        string       // == doküman id (collectionGroup sorgusu için denormalize)
realm:      string       // parent realm'i denormalize (defansif izolasyon sorgusu)
role:       "owner" | "admin" | "member" | "guest"
joinedAt:   Timestamp
lastReadAt: Timestamp    // okunmamış sayacı buradan (ayrı reads koleksiyonu YOK)
muted:      boolean
pinned:     boolean
```

### `connect_conversations/{conversationId}/messages/{messageId}`
```
authorUid:    string          // SADECE uid (revizyon 3). İsim/avatar user koleksiyonundan çözülür
authorRealm?: "staff" | "student" | "trainer"   // render hizası/rozet için hafif ipucu (opsiyonel)
text:         string
attachments?: [...]           // FAZ 2
reactions?:   { emoji: count } // FAZ 2
createdAt:    Timestamp
editedAt?:    Timestamp
```
> **Not (revizyon 3):** `authorName` TUTULMAZ. Ad değişince geçmiş bozulmasın + tek
> doğruluk kaynağı user koleksiyonu olsun diye. Render sırasında uid→ad/renk çözülür
> (bkz. §5 kimlik çözümleme).

### `connect_audit/{id}` (2026-07-18 eklendi — kurumsal Audit Log)
Kullanıcı hareketi (mesajlaşma) DEĞİL, YÖNETİMSEL işlem kaydı. Ayrı, düz koleksiyon
(alt-koleksiyon DEĞİL) — gelecekteki yönetim panelinden tek koleksiyonu tarayıp
filtrelemek için. Append-only: repo katmanı sadece `create` sunar.
```
id:               string
action:           ConnectAuditAction   // bkz. domain/core/connect-audit.ts — TAM taksonomi
actorUid:         string
actorName:        string
conversationId:   string
conversationName: string
targetUid?:       string
targetName?:      string
realm:            "staff" | "trainer_student"
tenantId:         string
metadata?:        Record<string, unknown>
createdAt:        Timestamp
ip?:              string
userAgent?:       string
```
> Faz 1'de gerçekten yazılan action'lar: `channel.create`, `group.create`,
> `community.create`, `audience_channel.create`, `member.add`, `member.remove`.
> Diğerleri (channel.delete, admin.grant/revoke, conversation.settings.update,
> message.delete/edit, member.bulk_add, realm.change) tipte tanımlı ama servis
> fonksiyonu henüz yok — yazıldıklarında `logAudit(...)` çağrısı eklenir.

---

## 3. İzolasyon & güvenlik (iki katman)

### Katman 1 — Sunucu sorgusu (asıl garanti)
`members` alt-koleksiyonu olduğu için üyelik `collectionGroup` sorgusuyla çözülür.
Member dokümanına `uid` + `realm` denormalize edildiği için tek atışta:

**"Bana ait konuşmalar"** (her kullanıcı):
```
collectionGroup("members").where("uid","==",me)     // tüm üyeliklerim
  → parent conversationId'leri topla → connect_conversations batch-get
```
- **Öğrenci** zaten hiçbir `staff` konuşmasına üye OLAMADIĞI için bu sorgu güvenli.
  Defansif olarak `.where("realm","==","trainer_student")` eklenebilir.
- **Audience kanalları** (öğrencinin üye OLMADIĞI ama okuduğu) AYRI sorgu:
  ```
  connect_conversations
    .where("realm","==","trainer_student")
    .where("audience","==","all_students")
  ```
  Öğrenci listesi = (üyelikler) ∪ (audience kanalları).

### Katman 2 — Firestore rules (ikinci savunma)
`members` alt-koleksiyonu rules'ı temizler (array-contains yerine `exists()`):
```
function isMember(convId) {
  return exists(/databases/$(db)/documents/connect_conversations/$(convId)/members/$(request.auth.uid));
}
function memberDoc(convId) {
  return get(/databases/$(db)/documents/connect_conversations/$(convId)/members/$(request.auth.uid)).data;
}
function conv(convId) {
  return get(/databases/$(db)/documents/connect_conversations/$(convId)).data;
}
function isStudent() { /* persons'da var, flexos_users'da yok — helper */ }
```
- **conversation read:** üye VEYA (audience=="all_students" ve trainer_student ve öğrenci).
  Öğrenci realm=="staff" bir dokümanı ASLA okuyamaz.
- **messages read:** parent'ı okuyabiliyorsa.
- **messages create:** `writePolicy=="members"` → üye; `writePolicy=="admins"` →
  `request.auth.uid in conv(convId).admins`. authorUid == request.auth.uid zorunlu.
- **members write:** sadece owner/admin ekler/çıkarır; `lastReadAt/muted/pinned` alanlarını
  kişi KENDİ member dokümanında güncelleyebilir (kısıtlı alan seti).
- Mesaj yazımı server API üzerinden yapılır; rules yine de client'a güvenmez.

---

## 4. API yüzeyi (FlexOS deseni: `withAuth` + `actorFromCaller`)

Tüm route'lar `/api/flexos/connect/...`. Çağıran çözülür, realm/üyelik sunucuda uygulanır.

| Route | Metod | İş |
|-------|-------|----|
| `/connect/conversations` | GET | Çağıranın listesi (üyelikler ∪ audience). Realm izolasyonu burada. `lastMessage.senderUid` + peer adları çözülür. |
| `/connect/conversations` | POST | Yeni konuşma (channel/group/dm/community). Realm + tip + üyeleri doğrula (öğrenci staff'a eklenemez). |
| `/connect/conversations/[id]` | GET/PATCH | Tekil / meta güncelle (ad, admins, childIds). |
| `/connect/conversations/[id]/messages` | GET/POST | Mesaj oku/gönder. writePolicy uygulanır. POST `lastMessage`'ı günceller + realtime broadcast. |
| `/connect/conversations/[id]/members` | GET/POST/DELETE | Üye ekle/çıkar (owner/admin). |
| `/connect/conversations/[id]/read` | POST | `members/{me}.lastReadAt = now` (okundu işaretle). |
| `/connect/directory` | GET | DM/grup kurarken üye seçici için realm-filtreli kişi listesi (personel→flexos_users; eğitmen→kendi öğrencileri). |

**Kimlik çözümleme (uid→ad/renk):** GET conversations/messages response'unda uid'ler
toplanıp TEK batch ile çözülür (personel `flexos_users`, öğrenci `persons`). Client'a
`{uid: {name, colorKey, realm}}` sözlüğü döner; mesaj/liste render'ı bu sözlükten okur.
Renk = uid'den deterministik palet (§11) — user dokümanında saklamaya gerek yok.

---

## 5. Gerçek zamanlılık

Mevcut ödev-chat ile **AYNI kanıtlanmış desen:** `connect_conversations/{id}/messages`
doğrudan Firestore `onSnapshot` ile dinlenir (SSE/broadcast DEĞİL — route'lar arası modül
paylaşmıyor, bu zaten `chats` için de böyle çözülmüştü). Konuşma listesi de
`collectionGroup("members").where("uid","==",me)` üstüne `onSnapshot` ile canlı
(lastMessage değişince liste güncellenir). Yazıyor göstergesi FAZ 2 (ephemeral).

---

## 6. Konuşma tipleri — davranış

- **Kanal (channel):** `writePolicy:"admins"`. Sadece `admins[]` yazar; üyeler/audience okur.
  Resmi duyuru (Kurum Duyuruları, Öğrenci İşleri). Öğrenci-görür olan = `audience:"all_students"`.
- **Grup (group):** `writePolicy:"members"`. Karşılıklı. Personel iş grubu (realm staff) VEYA
  sınıf odası (realm trainer_student: eğitmen + sınıf öğrencileri). Misafir (guest role) FAZ 2.
- **DM (dm):** İki üyeli grup. `name` boş; liste adı karşı taraftan çözülür. Realm, iki tarafın
  ortak realm'i (personel↔personel=staff, eğitmen↔öğrenci=trainer_student).
- **Topluluk (community):** `childIds` ile grupları paketleyen MANTIKSAL yapı (fiziksel grup
  değil). Eğitmen kendi gruplarını seçer; topluluğa yazılan mesaj alt grupların tüm üyelerine
  ulaşır. FAZ 1-sonu (channel üstüne ince katman: community üyeleri = childIds gruplarının
  üye birleşimi; ya materyalize edilir ya okuma anında birleştirilir — Faz 1-sonu kararı).

---

## 7. Route & bileşen haritası (tasarım → Next.js)

Tam-sayfa (`Flex Connect.dc.html`) → **3 kolon**:
- **Kolon 1 (ikon rayı, 72px):** Sohbetler(dm) · Kanallar · Gruplar · Topluluklar · Favoriler
  + altta Ayarlar/avatar. (Favoriler = `pinned` filtre; ayrı tip değil.)
- **Kolon 2 (liste, 340px):** arama + segment (Tümü/Okunmamış/Sabitlenen) + satırlar.
- **Kolon 3 (konuşma):** başlık (ad + tip rozeti + meta) + mesajlar (tarih ayraçları, avatar
  gruplama) + composer. Reaksiyon/dosya/okundu-tik = FAZ 2 (tasarımda var, Faz 2'de bağlanır).
- **Create modal:** tip seçici (Kanal/Grup/Topluluk) + ad/açıklama + üye/yayıncı seçici +
  (grup) misafir + (topluluk) grup birleştirme. FAZ 1: Kanal/Grup/DM oluşturma; Topluluk UI
  hazır ama backend Faz 1-sonu; misafir Faz 2.

Widget (`Flex Connect Widget.dc.html`) → **ana sayfa sağ-alt mavi FAB**:
- FAB (58px, #2867bd, okunmamış rozeti) → mini pencere (380×560): liste ↔ konuşma (geri
  butonu) → "tam ekran aç" → tam sayfa route.

**Route'lar:**
- Personel tam sayfa: `/flexos/connect`
- Öğrenci tam sayfa: öğrenci portalı içinde `/flexos/student/connect` (izolasyon: öğrenci
  layout'u yalnız trainer_student verisi çeker).
- Widget: paylaşımlı bileşen (`_components/ConnectWidget.tsx`), ana sayfalara gömülür.

---

## 8. FAZ FAZ plan

### FAZ 1 — Çekirdek (gösterilebilir MVP) ← SIRADAKİ
**Kapsam (kullanıcı kilitledi):** Kanal + Grup + DM · Widget + Tam ekran · gerçek zamanlı
mesajlaşma · temel composer. İki realm + izolasyon. "Öğrenci İşleri → tüm öğrenciler"
audience kanalı dahil.

Adımlar:
1. **Domain + tipler:** `domain/core/connect.ts` (Conversation, Member, Message tipleri),
   `domain/repo/connect-repo.ts` arayüzü.
2. **Firestore rules + index:** §3 kuralları; `collectionGroup(members)` için `uid` (+`realm`)
   index; `audience` sorgusu için composite index. Gerçekten deploy edilir.
3. **Server repo + servis:** `server/connect-repo.firestore.ts`; `domain/services/
   connect-service.ts` (createConversation realm/tip doğrulaması, sendMessage writePolicy,
   markRead, addMember — öğrenci-staff yasağı burada).
4. **API route'ları:** §4 tablosu (conversations GET/POST, [id], messages GET/POST, members,
   read, directory) — hepsi `withAuth`.
5. **Kimlik çözümleme yardımcı:** uid→{name,colorKey,realm} batch (flexos_users + persons).
6. **Tam sayfa UI (personel):** `/flexos/connect` — 3 kolon, `.dc.html`'den birebir. onSnapshot
   ile canlı. Create modal (Kanal/Grup/DM).
7. **Tam sayfa UI (öğrenci):** `/flexos/student/connect` — aynı bileşenler, öğrenci realm
   filtresi + audience kanalları; oluşturma öğrencide kısıtlı (sadece izinli).
8. **Widget:** `ConnectWidget.tsx` (FAB + mini pencere), ana sayfalara gömülür, "tam ekran"
   ile route'a gider.
9. **Test:** `scripts/assert-connect.ts` — izolasyon assert'leri (öğrenci staff göremez,
   audience çözümü, writePolicy reddi), `tsc --noEmit` + `npm run build` temiz.

**Faz 1 kabul:** Personel kendi arasında kanal/grup/DM; eğitmen↔öğrenci grup + DM; Öğrenci
İşleri kanalı tüm öğrencilere; öğrenci personel tarafını HİÇ göremiyor (canlı doğrulama);
widget sağ-altta çalışıyor; gerçek zamanlı.

### FAZ 1-sonu — Topluluk (ucuz eklenti)
`community` tipi + `childIds` fan-out (channel üstüne ince katman). Eğitmen kendi gruplarını
paketleyip tek yerden tüm öğrencilerine duyurur.

### FAZ 2 — Zenginleştirme
Reaksiyonlar · okundu-tikleri (member.lastReadAt üstünden) · Favoriler (pinned) · sabitleme ·
misafir daveti (guest role: yardımcı eğitmen/veli/konuk) · dosya ekleri (mevcut resumable
upload altyapısı reuse) · yazıyor göstergesi.

### FAZ 3 — PWA mobil
Çizimler gelince. AYNI backend/veri, ayrı responsive arayüz (WhatsApp-tarzı liste→tam ekran).
manifest.json + service worker + "Ana Ekrana Ekle". Backend DEĞİŞMEZ.

---

## 9. Yeniden kullanım (mevcut FlexOS'tan)

- **onSnapshot gerçek-zamanlı desen** — `chats` için kanıtlanmış (`student/[personId]/
  [assignmentId]/page.tsx`, `odevler/teslim/.../page.tsx`). Aynısı Connect'e.
- **Auth/route deseni** — `withAuth` + `actorFromCaller` + `can(...)`.
- **Avatar** — baş harf + palet renk (tasarım zaten böyle, proje kuralı).
- **Dosya yükleme (Faz 2)** — `uploadAssignmentAttachment` / resumable chunk altyapısı.
- **FlexModal/framer-motion değerleri** — create modal + widget geçişleri için.

---

## 10. Tasarım sabitleri (özet — kaynak: `.dc.html`)

> Sonnet: kesin değerler için tasarım dosyasını aç. Bu sadece hızlı referans.

- Font: **Inter** 400–800.
- Ray bg `#12233B`, logo/aktif `#2867bd`; pasif ikon `#8FA3BE`.
- Aksan mavi `#2867bd`, hover `#205297`; seçili satır bg `#EAF1FB`.
- Pasif ikon kutusu bg `#EEF1F5` renk `#5A616C`.
- Arama bg `#F4F5F7` border `#E9EBEF`, focus border `#B7CCEC` + `0 0 0 3px rgba(40,103,189,.1)`.
- Konuşma zemini `#F7F8FA`.
- Benim balon: bg `#EDF1FC` border `#DCE3F6`, radius `16px 16px 5px 16px`.
- Karşı balon: bg `#FFFFFF` border `#ECEEF1`, radius `16px 16px 16px 5px`.
- Okunmamış rozeti `#2867bd`; ray badge `#E5484D` (`0 0 0 2px #12233B`).
- Tarih ayraç pill bg `#EDEEF1` renk `#8A909B`.
- Widget: panel 380×560 (`0 24px 60px -16px rgba(18,35,59,.4)`), FAB 58px `#2867bd` sağ-alt 28px.
- Create modal: max 780px, tip seçici 3 kolon, giriş `translateY(14px) scale(.98)` → yerine.
- Yazıyor animasyonu: `fcType` keyframe (tasarımda tanımlı).
