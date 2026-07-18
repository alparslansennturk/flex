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

**SIRADAKİ İŞ:** Faz 2 madde 2 — Reaksiyonlar — AŞAĞIDA tamamlandı, bkz. sıradaki blok.

---

### ✅ Faz 2 madde 2 — Reaksiyonlar (2026-07-18, aynı oturum)

WhatsApp tarzı — kişi başına TEK emoji: `ConnectMessage.reactions?: Record<uid,emoji>`.
Aynı emojiye tekrar basmak kaldırır (toggle); farklı emojiye basmak DEĞİŞTİRİR (bir
öncekini otomatik siler, iki reaksiyon aynı anda tutulmaz). **Yazma yetkisi GEREKMEZ,
sadece okuma** — WhatsApp kanallarındaki AYNI davranış: broadcast kanalda salt-okunur
üyeler VE audience-only (member dokümanı olmayan) okuyucular da tepki verebilir.
Silinmiş ("herkes için") bir mesaja reaksiyon verilemez.

- Yeni servis fonksiyonu `setMessageReaction` (`assertCanRead` yeter, `assertCanWrite`
  DEĞİL). Yeni route'lar: `POST .../messages/[messageId]/reactions` (personel +
  öğrenci). `connect-view.ts::buildMessageViews` ham `reactions` map'ini `reactionCounts`
  (emoji→sayı, render'a hazır) + `myReaction` (çağıranın kendi seçimi) olarak çözüyor.
- **UI (hem personel hem öğrenci tam sayfası):** mesaj balonunun hover menüsüne
  (Düzenle/Sil'in yanına) yeni bir gülen-yüz ikonu eklendi — tıklayınca 6 yaygın
  emojiden oluşan hızlı-seç panosu açılıyor (`_shared/EmojiPicker.tsx::ReactionQuickPick`,
  composer'ın `EmojiButton`'ından AYRI, paylaşımlı bileşen). Balonun altında gerçek
  sayılarla reaksiyon rozetleri (`😂 3`) — kendi reaksiyonun vurgulu, tekrar tıklayınca
  kaldırır. İyimser (optimistic) güncelleme, hata olursa mesajlar yeniden çekilir.
  **Widget bu turda da kapsam dışı** (Favoriler/düzenle-sil ile AYNI karar).

**Test:** `scripts/assert-connect.ts`'e 6 yeni assertion (ekle/değiştir/kaldır toggle,
audience-only okuyucu da verebilir, üye olmayan veremez, silinmiş mesaja verilemez) —
**63/63 geçti.** `tsc --noEmit` + `npm run build` temiz, 19 assert dosyası (510
assertion) hâlâ yeşil.

**Kalan Faz 2:** Okundu-tikleri, misafir daveti, dosya ekleri.

---

### ✅ Faz 2 madde 3 — Okundu-tikleri (2026-07-18, aynı oturum)

WhatsApp tek/çift tik, YENİ bir "okundu" kaydı OLMADAN — var olan `Member.lastReadAt`
(zaten `markRead`/mesaj gönderirken güncelleniyordu) yeniden kullanıldı: bir mesaj
`isMine` ise ve DİĞER tüm üyelerin `lastReadAt`'i o mesajın `createdAt`'inden SONRA
ise çift mavi tik (`readByAll`), değilse tek gri tik. Grup/topluluk gibi çok üyeli
konuşmalarda WhatsApp'taki gibi "HERKES okuyunca" mavi olur.

- `connect-view.ts::buildMessageViews`'e yeni opsiyonel parametre: diğer üyelerin
  `lastReadAt` listesi. İki messages GET route'u (personel + öğrenci) artık
  `listMembers` de çağırıp bu listeyi hesaplayıp geçiriyor.
- UI: mesaj zaman damgasının yanında `Check`/`CheckCheck` ikonu (SADECE kendi
  mesajında). Yeni servis fonksiyonu/route YOK — tamamen var olan veriden türetildi,
  bu yüzden hızlı bir ekti.

`tsc --noEmit` + `npm run build` temiz, `assert-connect.ts` 63/63 (değişmedi —
saf view-katmanı hesaplaması, ayrı test gerektirmedi).

**Kalan Faz 2:** Misafir daveti, dosya ekleri.

---

### ✅ Faz 2 madde 4 — Misafir daveti (2026-07-18, aynı oturum)

Kullanıcı kapsamı netleştirdi: e-postayla YENİ hesap açma YOK (o ayrı/büyük bir iş,
ertelendi) — misafir = sistemde ZATEN hesabı olan biri (başka bir eğitmen, personel,
hatta başka bir öğrenci). Backend'de neredeyse hiçbir şey değişmedi çünkü
`addMember`/`ConnectMemberRole` zaten "guest" rolünü destekliyordu, sadece hiç
kullanılmıyordu:

- `ConnectMember`'a yeni `guestTitle?: string` (Yardımcı Eğitmen/Gözlemci/Konuk/Veli
  gibi açıklayıcı rozet — YETKİYİ ETKİLEMEZ, misafir normal üye gibi okur/yazar,
  ayrı bir kısıtlı izin katmanı bilinçli olarak YOK). `addMember` yeni opsiyonel
  parametre alıyor, `POST .../members` route'una `guestTitle` eklendi.
- **UI (personel sayfası, "Bilgi" paneli, SADECE grup türünde + admin'seniz):**
  "Misafir Ekle" — isim arayınca zaten sayfada yüklü iki dizinden (Personel +
  eğitmenin kendi Öğrencileri, YENİ bir fetch YOK) sonuç çıkıyor, seçip rozet
  (Yardımcı Eğitmen vb.) seçip ekliyorsun. Üye listesinde mor "Misafir" rozeti.

**Test:** `scripts/assert-connect.ts`'e 2 yeni assertion — **65/65 geçti.**
`tsc --noEmit` + `npm run build` temiz, 19 assert dosyası (517 assertion) hâlâ yeşil.

**Kalan Faz 2:** Dosya ekleri (son madde).

---

### ✅ Widget popup taşma bug'ı + Faz 2 madde 5 — Dosya ekleri → **FAZ 2 TAMAMLANDI** (2026-07-18, aynı oturum)

**Önce gerçek bir bug:** kullanıcı widget'ta kısa mesajlarda (özellikle kendi
mesajlarında) düzenle/reaksiyon popup'ının panelin dışına taştığını bildirdi. Kök
neden: hover ikonları balonun kenarından SABİT piksel offsetle (`-56`/`-62`)
konumlandırılıyordu — kısa (veya çok uzun) balonlarda bu sabit offset panelin
kenarını aşabiliyordu. **Kalıcı çözüm** (widget + personel + öğrenci sayfası,
üçünde de aynı desen vardı): ikon satırı artık balonun ÜSTÜNDE (`bottom:"100%"`)
ve balonun KENDİ kenarına hizalı (`[isMine?"right":"left"]:0`, offset YOK) — bu
balon genişliğinden bağımsız her zaman panel içinde kalır. Alt popup'lar (reaksiyon
panosu, "..." menüsü) da AYNI mantıkla ikon satırının ÜSTÜNE açılıyor.

**Faz 2 madde 5 — Dosya ekleri:** Araştırma sonucu gerçek altyapı bulundu: FlexOS'ta
dosyalar Firebase Storage'a DEĞİL, kurumun Google Drive'ına yükleniyor (OAuth2,
`googledrive.ts`). Ödev eklerindeki "resumable + 256KB chunk-proxy" karmaşıklığı
BİLİNÇLİ olarak KULLANILMADI (250MB'a kadar büyük dosyalar için gerekliydi) — Connect
ekleri için basit tek-seferlik yükleme yeterli (`uploadBufferToFolder`), Vercel'in
4.5MB istek gövdesi sınırı altında kalınarak (`MAX_ATTACHMENT_BYTES = 4MB`).

- `ConnectMessage.attachments?: ConnectAttachment[]` (`driveFileId, webViewLink,
  fileName, fileSize, mimeType` — assignment eklerinin AYNI şekli). `sendMessage`
  artık opsiyonel `attachments` parametresi alıyor, **metin BOŞ olabilir eğer ek
  varsa** (WhatsApp gibi, sadece dosya gönderebilirsin). `lastMessage` önizlemesi
  ek-only mesajda `📎 {dosyaAdı}` gösterir.
- Yeni route'lar (`.../messages/attachment` POST, personel + öğrenci): dosyayı Drive'a
  yükler (`ensureFolderPath(["Flex Connect", conversationId])` + `uploadBufferToFolder`
  + `setPublicReadPermission`), MIME (`ALLOWED_MIME_TYPES` — assignment'lerle AYNI
  liste) + boyut (4MB) doğrular, sonra `sendMessage`'ı ek bilgisiyle çağırır.
- **UI (üç yerde de — personel/öğrenci/widget):** eskiden pasif "yakında" olan ataç
  ikonu artık GERÇEK dosya seçici (`AttachButton` bileşeni yeniden yazıldı, gizli
  `<input type=file>`). Dosya seçilince o an yazıda ne varsa altyazı (caption)
  olarak gider, anında yüklenip gönderilir (spinner). Mesaj balonunda dosya kartı
  (ikon+ad+boyut), tıklayınca Drive'da yeni sekmede açılır. Görsel önizleme
  (thumbnail) YOK — bilinçli sadeleştirme, hepsi aynı generic kart.

**Test:** `scripts/assert-connect.ts`'e 3 yeni assertion (ek yokken boş metin
reddedilir, ek varken kabul edilir, lastMessage önizlemesi dosya adını gösterir) —
**68/68 geçti.** `tsc --noEmit` + `npm run build` temiz, 19 assert dosyası (523
assertion) hâlâ yeşil.

---

## 🎉 FAZ 2 TAMAMLANDI (2026-07-18)

Tüm 6 madde bitti: Favoriler/sabitleme, Reaksiyonlar, Okundu-tikleri, Misafir
daveti, Dosya ekleri, Yazıyor göstergesi (Faz 1'de zaten vardı). Ayrıca bu Faz 2
turunda plan dışı ama gerçek kullanıcı ihtiyacından doğan büyük ek işler de
tamamlandı: Kurumsal Audit Log, DM akışının komple yeniden tasarımı (Personel/
Öğrenciler/Eğitmenlerim dizinleri), Kanal'ın "Personel Kanalı"/"Öğrenci Kanalı"
ayrımı + gerçek yazma-yetkisi düzeltmesi, Grup'un Sınıf/Personel modu, mesaj
düzenle/sil (WhatsApp birebir), ve Faz 1-sonu için planlanan Topluluk (community)
de plandan ÖNCE tam olarak bitirildi.

**Kalıcı olarak kapsam dışı (2026-07-18, kullanıcı kararı):** Flex Connect'e
dışarıdan katılım YOK — e-posta daveti, telefon numarasıyla ekleme, QR davet, link
ile gruba katılma. Şirket içinde tek sistem bu olduğu için herkesin zaten FlexOS
hesabı var; misafir ekleme SADECE var olan hesaplar arasından arama ile olur
(`guestTitle` salt görsel etiket, yetki değiştirmez). Bu bir "eksik" değil, bilinçli
tasarım sınırı — tekrar gündeme gelmeyecek.

### ✅ 2 küçük ek madde tamamlandı (2026-07-18, aynı oturum)

- **Dosya eki görsel önizlemesi** — `_shared/AttachmentView.tsx` (yeni paylaşımlı
  bileşen, 3 sohbet ekranında da kullanılıyor): `image/*` mimeType'lar için Drive
  `https://drive.google.com/thumbnail?id=...&sz=w500` üzerinden gerçek küçük resim
  gösterir (public-read zaten açık — `setPublicReadPermission`), yüklenemezse
  (`onError`) otomatik eski genel dosya kartına düşer. Diğer türler (pdf/doc/zip vb.)
  değişmeden genel dosya kartı kalır.
- **Favoriler'in widget karşılığı** — widget'ta rail/tab yapısı olmadığı için tam
  sayfadaki gibi ayrı bir "star" sekmesi yerine: (1) arama kutusunun yanına tek bir
  yıldız toggle butonu (`showPinnedOnly`) — listeyi sadece sabitlenenlere filtreler,
  (2) açık konuşma başlığına küçük bir yıldız butonu — o an açık sohbeti favoriye
  ekler/çıkarır (`setConversationPinned`, tam sayfayla aynı iyimser-güncelleme
  deseni). Backend zaten vardı (`ConversationView.pinned`), sadece widget UI eklendi.

### 🎉 DESKTOP TAMAMEN BİTTİ — son 2 madde + izolasyon doğrulaması (2026-07-18, aynı oturum)

Kullanıcı en riskli yerin yetki/izolasyon katmanı olduğunu vurguladı (öğrenci
şirketin iç yazışmasını görürse felaket). Kod yazmadan önce 3 katman tek tek
doğrulandı:

1. **Servis katmanı** — `scripts/assert-connect.ts` (76/76 geçti). Kilit fonksiyon
   `assertMembersMatchRealm`: `resolveUidKind` ÖNCE `persons` koleksiyonuna bakar
   (varsa "student" döner, `flexosUsers`'da ne yazarsa yazsın) — yani bir uid HEM
   `persons` HEM `flexosUsers`'da olsa bile güvenli yöne (öğrenci) düşer. `unknown`
   uid → `ValidationError` (fail-closed, sessizce izin verilmez).
2. **API katmanı** — `staffPrincipalFromCaller`: çağıranın `persons` kaydı VARSA
   `null` döner, `withAuth` 403 ile keser — öğrenci `/api/flexos/connect/*` route
   ailesine (staff realm) HİÇBİR ŞEKİLDE giremez, service fonksiyonları hiç
   çalışmaz. `studentPrincipalFromRequest`: `personId` + `person.authUid===caller.uid`
   zorunlu, başkasının personId'siyla asla çalışmaz.
3. **Firestore rules (ikinci savunma, client raw SDK için)** — `connect_conversations`
   read: `isConnectMember` (gerçek `members/{uid}` dokümanı) VEYA `realm=="trainer_student"
   && audience=="all_students"` — realm:"staff" konuşmalar audience dalından ASLA
   geçemez (alan sabit `realm=="trainer_student"` şartına bağlı). `allow write: if
   false` her yerde — tüm yazma Admin SDK üzerinden.

Sonuç: öğrenci hiçbir yoldan (server bug'ı hariç) staff realm'e giremez. Kod
tarafında hiçbir açık bulunmadı, mevcut mimari zaten doğruydu.

Ardından kalan son 2 madde bitirildi:

- **Konuşma meta düzenleme (ad/açıklama)** — `updateConversationMeta` (yeni servis
  fonksiyonu, `connect-service.ts`), `PATCH /api/flexos/connect/conversations/[id]`
  (SADECE personel route'u — öğrenci hiçbir zaman owner/admin olamaz, ayrıca
  route eklenmedi). Yetki: `conversation.admins.includes(principal.uid)` (addMember
  ile AYNI kural). DM düzenlenemez. `conversation.settings.update` audit action'ı
  (taksonomide zaten vardı) artık gerçekten kullanılıyor. Personel sayfasında
  "Bilgi" panelinde Pencil ikonuyla (SADECE admin'e görünür) inline form. (Yayıncı
  listesi düzenleme UI'ı da bu turda geldi — bkz. aşağıdaki bölüm.) 8 yeni assertion.
- **Widget'ın kalan sayfalara yaygınlaştırılması** — tek tek ~35 sayfayı elle
  düzenlemek yerine, ortak `FlexHeader.tsx`'e (tüm personel sayfaları + öğrenci Ana
  Sayfa'nın kullandığı TEK paylaşımlı bileşen) yeni `connectPersonId?` prop'uyla
  `<ConnectWidget>` gömüldü — widget zaten `position:fixed` bir FAB olduğu için
  header'ın kendi layout'unu hiç etkilemez. Tek satırlık bir değişiklik ~35 sayfaya
  otomatik yayıldı. Personel sayfalarında prop verilmez (`/api/flexos/connect/*`),
  öğrenci Ana Sayfa'da `connectPersonId={personId}` verilir (`/api/flexos/student/
  connect/*`). Önceki 2 elle-gömme (`egitmen-anasayfa`, öğrenci Ana Sayfa) kaldırıldı
  (çifte widget olmasın diye). Flex Connect'in KENDİ 2 tam sayfası (`connect/page.tsx`,
  öğrenci `connect/page.tsx`) zaten FlexHeader KULLANMIYOR — o yüzden onlarda widget
  otomatik ÇIKMAZ (istenen davranış, zaten mesajlaşma ekranındasın). Öğrencinin ödev
  detay sayfası (`student/[personId]/[assignmentId]`) kendi özel header'ını kullandığı
  için kapsam dışı bırakıldı (ayrı, küçük bir iş — istenirse sonra eklenir).

**Desktop artık TAMAMEN bitti** — Faz 1, Faz 1-sonu (Topluluk), Faz 2 (6 madde),
+ bu son 2 madde. Kalan tek şey Faz 3 (PWA mobil), henüz tasarım bekleniyor.

### ✅ Menü dışına tıklayınca kapanma + Kanal/Grup/Topluluk yönetimi genişletildi (2026-07-18, aynı gün devamı)

**Bug fix — boş yere tıklayınca menüler kapanmıyordu:** header "..." menüsü,
mesaj "..." menüsü, reaksiyon seç panosu — hiçbiri dışarı tıklayınca kapanmıyordu.
Yeni paylaşımlı hook `_shared/useCloseDropdownsOnOutsideClick.ts` (tek `mousedown`
dinleyici, `data-connect-dropdown` attribute'u dışına her tıklamada verilen TÜM
kapatma fonksiyonlarını çağırır) 3 sohbet ekranının hepsine eklendi.

**Kullanıcı bulgusu — "sadece isim değil, üye ekleme/çıkarma ve silme de olmalı":**
Düzenleme özelliği gerçekten çok dar kalmıştı, aynı oturumda genişletildi:

- **Silme (kanal/grup/topluluk)** — `deleteConversation` (yeni servis fonksiyonu),
  `DELETE /api/flexos/connect/conversations/[id]`. Yetki: **SADECE owner** (admin/
  Yayıncı yeterli değil — en yüksek yetki, addMember/removeMember'daki admin
  kuralından daha sıkı). DM silinemez (zaten "ayrıl" var). Alt-koleksiyonlar
  (`members`/`messages`/`typing`) `connect-repo.firestore.ts`'de `adminDb.
  recursiveDelete(ref)` ile temizlenir — ESKİDEN sadece parent doc siliniyordu,
  yetim alt-doküman kalıyordu (bu turda fark edilen gerçek bug). Drive'daki
  `Flex Connect/{id}` eki klasörü de best-effort silinir. Topluluk silinince
  paketlediği grup konuşmaları ETKİLENMEZ (bağımsız kayıtlar). UI: header "..."
  menüsünde "Kanalı/Grubu/Topluluğu Sil" (SADECE owner'a görünür, `window.confirm`
  ile onay — codebase'teki mevcut desen).
- **Üye ekle/çıkar (misafir dışında normal üye de)** — "Misafir Ekle" bölümü
  "Üye/Misafir" rol seçenekli hale geldi (backend zaten `role` parametresi
  destekliyordu, sadece UI kısıtlıydı), kapsam grup'tan kanala da genişledi. Üye
  listesindeki her satıra (sahip HARİÇ) "Çıkar" (X) butonu eklendi — `removeMember`
  servis fonksiyonu zaten vardı, sadece client wrapper (`removeConversationMember`)
  + UI eksikti.
- **Kanal: Yayıncı ekle/çıkar** — "Düzenle" formuna (channel type'ta) staff
  checkbox listesi eklendi, `detail.admins`'ten (yeni `ConversationDetail.admins`/
  `ownerUid` alanları) seed edilir. Gerçek bug fix: `updateConversationMeta`
  `adminUids` değiştiğinde artık YENİ Yayıncı için `members/{uid}` dokümanı da
  oluşturuluyor (`role:"admin"`) — ESKİDEN sadece `conversation.admins[]` diziye
  ekleniyordu, Firestore rules `isConnectMember` buna bakmadığı için yeni Yayıncı
  admins'e girse de KENDİ mesajlarını bile okuyamıyordu (yazabiliyordu ama
  göremiyordu — sessiz, ciddi bir UX bug'ıydı). Yayıncılıktan çıkarılan kovulmaz,
  sadece "admin" rozeti "member"e geri düşer (WhatsApp'ta da öyle).
- **Topluluk: sonradan yeni grup ekleme** — `updateConversationMeta`'ya `childIds`
  desteği eklendi (tam liste replace, ≥2 grup + tip="group" + tenant eşleşmesi
  doğrulanır). **Kritik mimari bulgu:** Topluluk kaydının `childIds`'i hiçbir yerde
  OKUNMUYORDU — gerçek erişim, toplulukla birlikte oluşturulan ayrı "Genel Duyuru"
  kanalının `readerUids`'inden geliyor, ikisi birbirine hiç bağlı değildi (sadece
  isimle eşleşiyorlardı). Sadece `childIds` güncellemek yeni grubun öğrencilerine
  HİÇBİR ŞEY kazandırmıyordu (sessiz, yanıltıcı bir "çalışıyormuş gibi görünen"
  özellik olurdu). Kullanıcıya bu soruldu → **"gerçek bağ kur"** seçildi. Çözüm:
  yeni alan `ConnectConversation.announcementChannelId` (topluluk oluşturulurken
  Genel Duyuru kanalının id'si kaydedilir) + `updateConversationMeta` artık
  `childIds`'e YENİ eklenen her grubun rosterini bu kanala GERÇEKTEN okuyucu
  (`members/{uid}`, `role:"member"`) olarak ekliyor. Grup çıkarılırsa okuyucu
  OTOMATİK silinmez (kasıtlı — başka yoldan erişimi olabilir, güvenli taraf).
  UI: Bilgi panelinde "Yeni Grup Ekle" (kendi sınıflarım listesi, tıklayınca
  sınıf-odası dedup'la oluşturulur/bulunur + topluluğa eklenir). Eski (bu alan
  olmadan kurulmuş) topluluklarda uyarı gösterilir ("otomatik göremez").
- **Doğrulama:** 76→96 assertion (silme/üye-admin-senkron/childIds/
  announcementChannelId hepsi test edildi), 0 başarısız.

### 🎉🎉 DESKTOP KESİN TAMAMLANDI — mesaj popup'ları + "oluştur" tarzı düzenleme modalı (2026-07-18, aynı gün sonu)

Yukarıdaki menü/z-index bug'ı 3 kez farklı belirtiyle geri geldi (header'ın
altında, bir sonraki mesajın altında) — kök neden CSS-relative `position:
absolute` konumlamanın scrollable konteynerin clipping/stacking-context
davranışına bağımlı olmasıydı. **Kesin çözüm:** reaksiyon panosu + Düzenle/Sil
menüsü artık `position:fixed` + `document.body`'ye **portal** ile açılıyor
(`_shared/popoverPosition.ts` — tıklanan butonun gerçek viewport koordinatından
yukarı/aşağı yön hesaplar), 3 ekranın hepsinde (personel/öğrenci/widget).
İkon satırı hover'da görünür (tıklama gerekmez), mesaj satırının kendisi
`hover:z-[60]` ile öne çıkar.

Ardından kullanıcı "Düzenle" akışını da yeniden istedi — Bilgi panelindeki
inline form yerine **"oluştur" modalıyla birebir aynı görünümde ayrı bir
modal** (`page.tsx` içinde inline JSX, header'da Bilgi'nin SOLUNA eklenen
kalem butonuyla açılır). Kanal/Grup/Topluluk hepsinde ad+açıklama, kanalda
ayrıca Yayıncı checkbox'ı, toplulukta ayrıca mevcut gruplar + "Yeni Grup Ekle"
(Bilgi panelinden BURAYA taşındı). İlk versiyonda modal açılışı `GET .../[id]`
fetch'ini bekliyordu (~1sn gecikme) — **kök çözüm:** `admins`/`ownerUid`/
`childIds`/`announcementChannelId`/`description` konuşma LISTESI API'sine
(`connect-view.ts::ConnectConversationView`) eklendi — bu veri zaten sunucuda
mevcuttu, ayrı bir istek hiç gerekmiyormuş. Modal artık **tamamen senkron**
açılıyor, `updateConversationMeta` de güncellenmiş `admins`/`childIds`'i
response'ta döndürüp `conversations` state'ine doğrudan yazıyor (yeniden
fetch yok).

**Desktop artık kesinlikle bitti** — Faz 1, Faz 1-sonu, Faz 2 (6 madde), 2 küçük
madde, silme/üye-yönetimi/Yayıncı/Topluluk-grup-ekleme, ve şimdi de mesaj
popup'ları + düzenleme modalı. Kalan tek şey Faz 3 (PWA mobil, tasarım bekliyor)
+ öğrencinin ödev-detay sayfasına widget eklenmesi (ayrı, küçük, istenirse
sonra).

---

### ✅ İlk mesaj popup'ı + gerçek yükleme yüzdesi (2026-07-18, aynı oturum)

Bir önceki turdaki "popup balonun üstüne aç" fix'i YENİ bir bug açtı: konuşmanın
EN ÜSTÜNDEKİ mesajda (üstünde başka mesaj/boşluk yoksa) yukarı açılan popup
başlığın arkasında kalıp erişilemez oluyordu — kullanıcı bulgusu. **Çözüm: yön artık
dinamik** — `i > 0` (ilk mesaj DEĞİLSE) yukarı açılır, ilk mesajda İSTİSNAİ olarak
aşağı açılır (`openMenuUpward`/`i>0` her üç dosyada — widget/personel/öğrenci).
Karmaşık bir "gerçek boşluk ölç" (collision detection) yerine bilinçli basit bir
sezgisel kural — pratikte yeterli, sadece ilk mesaj özel durum.

**Ayrıca kullanıcı isteği: dosya yüklerken gerçek yüzde göstersin.** `fetch` upload
progress vermiyor — `connectClient.ts::sendMessageWithAttachment` artık `XMLHttpRequest`
kullanıyor (`upload.onprogress`), gerçek `%0-100` client'a akıyor. `AttachButton`
artık spinner değil gerçek sayı gösteriyor (`%37` gibi), yüklenirken pasif.

`tsc --noEmit` + `npm run build` temiz, `assert-connect.ts` 68/68 (bu ikisi saf
UI/client-side, backend değişmedi).

---

### ✅ "Herkes için sil" artık Drive'daki dosyayı da GERÇEKTEN siliyor (2026-07-18, aynı oturum)

Kullanıcı bulgusu — GERÇEK bir bug: dosya ekli bir mesaj "herkes için" silinince
Firestore'daki mesaj `deletedForEveryone:true` oluyordu ama **Drive'daki gerçek
dosya hiç silinmiyordu** — yetim (orphan) kalıyordu, hem gereksiz depolama hem
(dosya URL'i biri tarafından not alınmışsa) potansiyel erişim riski. Düzeltildi:

- `deleteMessageForEveryone` artık SİLİNMEDEN ÖNCEKİ mesajı (attachments dahil)
  döndürüyor VE Firestore'daki kayıttan `attachments` alanını da temizliyor.
- Her iki DELETE route'u (personel + öğrenci) artık dönen ekleri `deleteFromDrive`
  ile Drive'dan da siliyor — best-effort (`Promise.allSettled`, bir Drive hatası
  asıl silme işlemini ASLA geri almaz, sadece loglanır).
- **"Benim için sil" Drive'a DOKUNMAZ** (bilinçli — dosya diğerleri için hâlâ geçerli,
  sadece "herkes için sil" gerçek/kalıcı silme anlamına gelir, WhatsApp'taki gibi).

**Klasör yapısı netleştirildi (kullanıcı vurguladı — kesin ayrım gerekiyordu):**
`{Drive kökü}/Flex Connect/{conversationId}/...` — ödev eklerinin kullandığı
`{Drive kökü}/{grup}/{ödev}/{öğrenci}/...` yapısından TAMAMEN ayrı bir isim/dal,
aynı paylaşımlı kök altında ama asla kesişmez (zaten baştan böyle kurulmuştu, bu
turda sadece doğrulandı/netleştirildi).

**Yükleme yüzdesinin bazen direkt %100 görünmesi:** Bug değil — küçük dosyalarda
(birkaç yüz KB) tarayıcı yükleme o kadar hızlı bitiyor ki ara yüzde event'i hiç
gelmeden tek seferde %100'e atlıyor (fiziksel bir sınır, `XMLHttpRequest`'in kendi
davranışı). Büyük/yavaş bağlantıda gerçek artan yüzde görünür.

`tsc --noEmit` + `npm run build` temiz, `assert-connect.ts` 68/68 hâlâ yeşil,
19 assert dosyası regresyon vermedi.

---

### ✅ Mesaj düzenle/sil/reaksiyon/okundu-tikleri widget'a taşındı (2026-07-18, aynı oturum)

Kullanıcı sordu: "en son yapılanları widget'ta da yapalım, neden eksik, uzun mu sürer."
Backend zaten paylaşımlıydı (`connectClient.ts`), sadece UI'ya bağlanmamıştı — hızlı bir
port oldu. `ConnectWidget.tsx`'in mini mesaj balonuna tam sayfayla AYNI davranış eklendi:
hover'da beliren Sil/Düzenle menüsü + reaksiyon hızlı-seç panosu + reaksiyon rozetleri +
tek/çift okundu tiki + "düzenleme modu" composer şeridi. Daha dar panel (380px) için
ikon/menü boyutları küçültüldü (22px ikon kutuları, 12px yazı) ama mantık birebir aynı.

**Favoriler widget'ta HÂLÂ yok** — o ayrı bir konu: widget'ta rail/sekme kavramı yok
(sadece düz liste + arama), "Favoriler" için ekrana nasıl bir giriş noktası ekleneceği
ayrı bir küçük tasarım kararı gerektiriyor (ör. arama kutusunun yanına bir filtre ikonu).
İstenirse ayrı bir turda eklenir.

`tsc --noEmit` + `npm run build` temiz, `assert-connect.ts` 63/63 (backend değişmedi).

---

### ✅ Mesaj düzenle/sil — WhatsApp birebir (2026-07-18, aynı oturum)

Kullanıcı isteği: "aynı whatsapp gibi, birebir." İki silme modu + düzenleme:

- **Düzenle:** SADECE yazar. `ConnectMessage.editedAt` (zaten tipte vardı, hiç
  kullanılmıyordu) artık gerçekten set ediliyor; UI zaman damgasının yanında
  "Düzenlendi" gösteriyor. Silinmiş ("herkes için") bir mesaj düzenlenemez.
- **"Herkes İçin Sil"** — SADECE yazar. `text` kalıcı temizlenir + `deletedForEveryone:
  true`, HERKESTE "Bu mesaj silindi" (italik gri) placeholder'ı görünür.
- **"Benim İçin Sil"** — yetki gerekmez, yazar dahil HERKES kullanabilir. Yeni
  `hiddenFor: string[]` alanı — SADECE o kişinin `listMessages` sonucundan filtrelenir,
  mesaj diğerleri için hiç değişmez.
- `ConnectConversation.lastMessage`'a `messageId` eklendi — düzenlenen/silinen mesaj
  o an listede gösterilen ÖNİZLEME ise (liste ekranındaki son mesaj satırı) önizleme
  de senkron güncelleniyor (düzenlemede yeni metin, "herkes için sil"de "Bu mesaj silindi").
- Yeni repo metodu `ConnectRepo.getMessage`. Yeni servis fonksiyonları: `editMessage`,
  `deleteMessageForEveryone`, `deleteMessageForMe`. Yeni route'lar: `PATCH`/`DELETE
  ?scope=everyone|me` — hem `/api/flexos/connect/conversations/[id]/messages/
  [messageId]` (personel) hem öğrenci karşılığı.
- **UI (hem personel hem öğrenci tam sayfası):** mesaj balonunun üzerine gelince
  (`group`/`group-hover` — hover'da beliren "..." ikonu) küçük bir menü: kendi
  mesajında Düzenle/Herkes İçin Sil/Benim İçin Sil, başkasının mesajında sadece
  Benim İçin Sil. Düzenle composer'ı "düzenleme moduna" alır (üstte "Mesajı
  düzenliyorsun" şeridi + iptal). **Widget (mini pencere) bu turda kapsam dışı**
  (Favoriler'de olduğu gibi — widget'a yaygınlaştırma ayrı, daha ucuz bir iş).

**Test:** `scripts/assert-connect.ts`'e 9 yeni assertion (yazar olmayan düzenleyemez/
silemez, düzenleme lastMessage'ı günceller, silinen mesaj düzenlenemez, "benim için
sil" SADECE çağırandan kaybolur diğerleri normal görür) — **57/57 geçti.**
`tsc --noEmit` + `npm run build` temiz, 19 assert dosyası (504 assertion) hâlâ yeşil.

---

### ✅ Kanal = "Personel Kanalı" | "Öğrenci Kanalı" + gerçek bug fix'ler (2026-07-18, aynı oturum)

Kullanıcı 3 ayrı şey bildirdi: (1) Kanal oluşturdaki "Yayıncılar" listesi de diğerleri
gibi liste+checkbox olsun (chip grid değil) — yapıldı. (2) "Yayıncılar ne demek,
kimlerin duyuru yapabileceğini mi anlatıyor?" sorusuna cevap ararken GERÇEK bir bug
bulundu: seçilen "Yayıncılar" `admins[]`'e hiç eklenmiyordu, SADECE oluşturan admin
oluyordu — seçilenler sessizce salt-okunur "member" kalıyordu (isim/davranış
uyuşmuyordu). (3) Kullanıcı bunun üzerine mimariyi netleştirdi: **Kanal artık 2
alt-türle başlıyor — "Personel Kanalı" | "Öğrenci Kanalı".**

- **Personel Kanalı** (`realm:"staff"`, yeni `broadcastToAllStaff:true`): TÜM aktif
  personel OTOMATİK okuyucu/member olur — server `flexosUsers.list()` ile KENDİSİ
  hesaplar (client'a güvenilmez, `isStudentsOwnTrainer` ile AYNI ilke). Seçilen
  Yayıncılar `admins[]`'e girer (gerçekten yazabilir), seçilmeyenler salt-okunur kalır.
- **Öğrenci Kanalı** (`realm:"trainer_student"`, `audience:"all_students"` — eski
  "Tüm öğrencilere aç" toggle'ının yerini aldı): TÜM öğrenciler mevcut audience
  mekanizmasıyla otomatik okur, seçilen Yayıncılar (personel dizininden, örn.
  "Aysun Kaya — Öğrenci İşleri Sorumlusu") admins'e girip yazar.
- **"Tüm personele aç" için Firestore-rules tabanlı bir audience DEĞERİ eklenmedi**
  (ör. `all_staff`) — bilinçli mimari karar: rules seviyesinde "bu uid öğrenci mi"
  sorgusu yapılamıyor (`persons` koleksiyonu authUid ile değil personId ile
  keyleniyor, rules sadece `get()`/`exists()` yapabilir, query yapamaz), yani böyle
  bir audience değeri EKLENSEYDİ bir öğrencinin ham Firestore SDK ile (`onSnapshot`)
  staff kanalını doğrudan okuyabilmesi gibi GERÇEK bir izolasyon açığı olurdu.
  Onun yerine Topluluk'un "Genel Duyuru" kanalıyla AYNI, zaten güvenli desen
  kullanıldı: gerçek `member` dokümanları materyalize edilir (`isConnectMember`
  rule'u zaten var, yeni risk yok).
- Grup/Topluluk listelerindeki `minHeight`/`maxHeight` uyuşmazlığı (200/220 gibi)
  DÜZELTİLDİ — Kanal panelini yeniden yazarken yanlışlıkla bu uyuşmazlık oradan da
  kopyalanmıştı, "veri gelince modal 1sn sonra yükseliyor" bug'ı BUYDU (daha önce
  chip grid'de çözülmüştü, liste tasarımına geçerken tekrar bozulmuştu). Artık
  Kanal + Grup/Personel ikisinde de 200/200 sabit.

**Test:** `scripts/assert-connect.ts`'e 5 yeni assertion (seçilmeyen personel otomatik
okuyucu olur ama admin değildir/yazamaz, seçilen Yayıncı admin olur ve gerçekten
yazabilir) — **43/43 geçti.** `tsc --noEmit` + `npm run build` temiz, 19 assert
dosyası (490 assertion) hâlâ yeşil.

---

### ✅ Topluluk davranışı doğrulandı + GERÇEK bir yazma-yetkisi bug'ı bulundu/düzeltildi (2026-07-18, aynı oturum)

Kullanıcı Topluluk'un WhatsApp topluluğuyla aynı olup olmadığını sordu: "Genel Duyuru'yu
SADECE ben yazarım, öğrenci yazamaz; ama gruplara ayrı ayrı da yazabilirim; gruplar
birbirini göremez." Doğrularken **gerçek bir bug** bulundu: Topluluk'un otomatik
"Genel Duyuru" kanalı oluşturulurken bundled sınıfların TÜM öğrenci roster'ı
`memberUids` olarak gönderiliyordu — ama channel tipinde `memberUids` artık (bir
önceki turdaki "Yayıncılar" fix'i yüzünden) `admins[]`'e giriyor, yani **öğrenciler
de yanlışlıkla yazabilir hale geliyordu.** Kullanıcının istediğinin TAM TERSİ.

**Fix — `CreateConversationInput`'a yeni `readerUids?: string[]` alanı:** SADECE
type==="channel" için, admin/Yayıncı OLMADAN salt-okunur üye eklemek için (`memberUids`
= yazarlar/admins, `readerUids` = okuyucular). Topluluk'un Genel Duyuru kanalı artık
`memberUids: []` (Yayıncı yok, sadece eğitmen/owner yazar) + `readerUids: [...union
roster]` (bundled sınıfların öğrencileri okur, yazamaz) gönderiyor.

**Doğrulanan/test edilen gerçek davranış (kullanıcının 3 maddesi):**
1. Genel Duyuru — SADECE eğitmen yazar, bundled sınıfların öğrencisi okur ama YAZAMAZ.
2. Eğitmen bundled sınıfların HER BİRİNE ayrı ayrı da yazabilir (kendi "sınıf odası"
   grup konuşması, `writePolicy:"members"`, zaten üye/owner).
3. Bundled gruplar birbirini GÖREMEZ — her biri ayrı `connect_conversations` dokümanı,
   ayrı `members` alt-koleksiyonu; Grafik-1'deki öğrencinin Grafik-2'de üyelik kaydı
   hiç yok, bu YAPISAL olarak zaten garanti (ekstra kod gerekmedi).

**Test:** `scripts/assert-connect.ts`'e 5 yeni assertion (Genel Duyuru'da öğrenci
yazamaz/okur, eğitmen her iki bundled gruba da ayrı ayrı yazabilir, gruplar arası
izolasyon) — **48/48 geçti.** `tsc --noEmit` + `npm run build` temiz, 19 assert
dosyası (495 assertion) hâlâ yeşil.

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

**Sonradan düzeltme (aynı oturum, kullanıcı UX spesifikasyonu verdi):** FAB'a
DOĞRUDAN tıklama artık HER ZAMAN tam ekran açıyor (varsayılan davranış). Mini
pencere artık SADECE masaüstünde (`matchMedia("(hover: hover) and (pointer: fine)")`)
FAB'ın üzerine gelince çıkan bir hover popover'daki "Mini Sohbeti Aç" seçeneğinden
açılıyor — ileri kullanıcı kısayolu. Mobilde hover yok, tıklama zaten tam ekrana
gider. Widget zaten açıkken FAB'a tıklama onu kapatır (X, değişmedi). Terminoloji
netleşti: mini penceredeki "Tam Ekrana Geç" (`ExternalLink`), tam ekrandaki
"Mini Moda Geç" (eski "Küçült", davranış AYNI — `requestConnectWidgetReopen` +
`router.back()`).

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
Çizimler HAZIR (2026-07-18) — AYNI backend/veri, ayrı responsive arayüz (WhatsApp-tarzı liste→tam ekran).
manifest.json + service worker + "Ana Ekrana Ekle". Backend DEĞİŞMEZ — yeni bir
altyapı kurulmayacak, sadece yeni UI katmanı.

**Push notification — SONA bırakıldı (2026-07-18, kullanıcı kararı):** Mesaj
geldiğinde öğrenciye bildirim gitmesi KESİN gerekiyor ("normalde aslında olacak,
mutlaka" — **"whatsapp gibi düşün, aynısı olacak"**: app kapalı/arka plandayken
bile sistem bildirimi düşer, gönderen adı + mesaj önizlemesi görünür, dokununca
o sohbet açılır) ama Faz 3'ün İLK işi değil — UI bittikten sonra en son
eklenecek. Gerçek yeni altyapı gerektiren TEK parça budur (service worker push
subscription + backend'de token saklama/tetikleme, Web Push standardı). Mevcut
`NotificationBell`/`/users/{uid}/notifications` sistemi (bkz. hafıza
`notification_system_status`) ayrı bir sistem (ödev duyuruları için, uygulama
İÇİNDEYKEN zil ikonu) — WhatsApp tarzı push, app KAPALIYKEN de çalışması
gerektiği için ayrı/ek bir mekanizma (service worker), tasarımlar gelince netleşir.
Ayrıca: bildirim kapatılsa/silinse BİLE uygulama ikonunda okunmamış sayısı rozet
olarak kalmalı (WhatsApp'taki ikon rozeti) — bu, push'tan BAĞIMSIZ ayrı bir API
(Badging API, `navigator.setAppBadge(count)`), aynı "en sona" kapsamına dahil.

**PWA ikonu:** Şimdilik GEÇİCİ bir ikon kullanılacak (kullanıcı: "masaüstü ikonu
geçici yaparız şimdilik") — final marka ikonu sonra gelir, `manifest.json`
kurulumunu bloklamaz.

### ✅ Faz 3 — Mobil UI ilk turu kuruldu (2026-07-18, aynı gün)

Tasarım dosyaları (`Flex Connect Mobil.dc.html` + `support.js`) incelendi, kullanıcı
"BİREBİR aynı, yorum katma, düzenlemeleri sonra yaparız" dedi. 2 mimari karar
netleştirildi: (1) **ayrı route** `src/app/flexos/connect/mobile/page.tsx` (PWA
manifest'i kendi scope'una sahip olsun diye, masaüstü sayfayı hiç etkilemez), (2)
**splash/login YOK** — FlexOS zaten oturum açtırıyor, PWA açılınca direkt sekmeli
uygulamaya girer (tasarımdaki login demo/inceleme amaçlıydı).

**Gerçek veriyle bağlı (tam çalışır):** 4 sekme (Sohbetler/Kanallar/Personel/
Ayarlar — `fetchConversations`/`fetchDirectory`), Kanallar sekmesi gerçek
realm+type kombinasyonuna göre 5 bölüme ayrılır (Kurum Duyuruları=channel+staff,
Öğrenci İşleri=channel+trainer_student, Sınıf Kanalları=group+trainer_student,
Personel Grupları=group+staff [tasarımda yoktu, gerçek veri kaybolmasın diye
eklendi], Topluluklar=community), sohbet detayı (gerçek mesaj/gerçek-zamanlı/
gerçek yazıyor-göstergesi [tasarımdaki sabit-açık göstergeydi, DÜZELTİLDİ],
okundu-tiki, reaksiyon/dosya eki GÖSTERİMİ, gün ayırıcı, mesaj gruplama), Kanal/
Grup/Topluluk oluşturma (gerçek `createConversation`, Topluluk'ta masaüstüyle
AYNI çok adımlı akış — sınıf odası dedup + Genel Duyuru + announcementChannelId),
Personel dizininden dokununca DM aç/oluştur (masaüstündeki `openDirectMessage`
ile AYNI mantık), tema (Sistem/Light/Dark, gerçek `matchMedia`), çıkış (gerçek
`signOut`), profil kartı (gerçek `users/{uid}` adı, FlexHeader ile AYNI desen).

**Bilinçli olarak ATLANAN (backend karşılığı yok / tasarımda da pasif —
kullanıcı: "düzenlemeleri sonra yaparız"):** presence (çevrimiçi/derste/rahatsız
etmeyin — Connect'te hiç presence altyapısı yok), Personel'de departman
gruplaması (DirectoryUser'da departman alanı yok, düz liste), "çalışma saatleri
dışı" uyarı banner'ı (gerçek çalışma-saati kaydı yok), composer'daki emoji/ek
ikonları (tasarımda da onClick YOK, salt görsel — masaüstündeki tam çalışan
dosya eki BİLEREK bağlanmadı), mesaj düzenle/sil/reaksiyon-EKLEME (tasarımın
kendisinde bu etkileşim hiç yok, sadece var olan reaksiyonlar gösteriliyor),
kanalda "Herkes Yazabilir" izni (backend'de kanal writePolicy her zaman
"admins" — mevcut domain modelinde karşılığı yok, toggle görsel duruyor),
Bildirimler ekranı (sadece UI + local state — push altyapısı en sona bırakıldı).

**Bilgi mimarisi düzeltmesi (2026-07-18, kullanıcı kararı — "whatsapp gibi
düşün"):** İlk turda "Sohbetler" SADECE DM'leri gösteriyordu, kanal/grup/topluluk
sadece "Kanallar" tabında görünüyordu (tasarımın KENDİ `submitCreate` kodu da
bu konuda çelişkiliydi: grup/topluluk oluşturunca 'chats' tabına yönlendiriyordu
ama statik liste onları hep 'channels'ta gösteriyordu — muhtemelen demo'nun
kusuru). Kullanıcı netleştirdi: **"Sohbetler" WhatsApp'ın "Chats" ekranı gibi
TEK BİRLEŞİK liste olacak** — DM+Grup+Kanal+Topluluk hepsi birlikte, en son
mesaja göre sıralı (`fetchConversations` zaten bu sırayla döner), tıklayınca
AYNI sohbet ekranı açılır. **"Kanallar" tabı KALDI** — ayrıca kategorize/keşfet
görünümü olarak (masaüstündeki gibi bölümlere ayrılmış), aynı konuşmalar HER
İKİ yerde de görünüyor. Personel sekmesine de aynı gün bir **Personel/Öğrenciler
segment toggle** eklendi (masaüstünde ayrı rail sekmeleri "Personel"/
"Öğrenciler" var, mobilde 5. bir alt-tab açmak yerine aynı tab içinde geçiş —
öğrenciye dokununca `trainer_student` realm'inde DM açılıyor/oluşturuluyor,
`openDirectMessage` masaüstüyle aynı mantık).

**Henüz YAPILMAYAN (Faz 3'ün geri kalanı):** `manifest.json` + service worker
kaydı + "Ana Ekrana Ekle", push notification + App Badge (bilinçli en sona
bırakıldı), PWA ikonu (geçici bile henüz yok). Tip kontrolü/lint temiz. Kullanıcı
tarayıcıda GÖRSEL olarak henüz doğrulamadı (bu ortamda tarayıcı testi yok).

### ✅ PWA altyapısı kuruldu — manifest + service worker + geçici ikon (2026-07-18, aynı gün)

- **Manifest** — `public/manifest-connect-mobile.json` (ayrı isimli, ana FlexOS'un
  ileride kendi manifest'i olursa çakışmasın diye). `start_url`/`scope`:
  `/flexos/connect/mobile` — SADECE bu route'u kapsar. `display:"standalone"`,
  `theme_color:"#2867bd"`.
- **Geçici ikon** — statik dosya yerine `src/app/api/pwa/connect-mobile-icon/
  route.tsx` (`next/og` `ImageResponse`, `?size=192|512`) — mavi kare zemin +
  beyaz "FC" harfleri. Final marka ikonu gelince bu route (ya da statik hale
  getirilmiş versiyonu) değiştirilir, manifest'teki referans aynı kalır. `curl`
  ile doğrulandı: gerçek 192×192 ve 512×512 PNG dönüyor.
- **Service worker** — `public/sw-connect-mobile.js`, SADECE kurulabilirlik
  kriterini karşılayacak minimal bir `fetch` handler'ı var (gerçek offline/cache
  stratejisi YOK — kasıtlı, bayat önbellek riskini şimdiden almamak için).
  `layout.tsx`'te (SADECE bu route'a özel, masaüstünü etkilemez) sayfa içinden
  `navigator.serviceWorker.register(..., { scope: "/flexos/connect/mobile/" })`
  ile kaydediliyor.
- **`layout.tsx`** — Next.js Metadata API (`manifest`, `appleWebApp`, `viewport`
  → `viewportFit:"cover"` + `themeColor`) — Android VE iOS "Ana Ekrana Ekle"
  için gerekli meta'lar.
- **Doğrulama:** `curl` ile manifest/ikon/SW route'larının hepsi 200 döndüğü ve
  ikonun gerçek PNG olduğu doğrulandı. Bilinen zararsız not: `tsc --noEmit`,
  Next'in dev-modu otomatik ürettiği `.next/dev/types/validator.ts` dosyasında
  (git'e hiç girmeyen, `.next/` içinde, build artifact) geçici bir tip uyuşmazlığı
  gösteriyor — sayfa runtime'da GERÇEKTEN çalışıyor (curl 200), dev server
  yeniden başlatılınca kendiliğinden düzelir, gerçek bir kod hatası DEĞİL.

**Hâlâ eksik:** Push notification + App Badge (bilinçli en sona), final marka
ikonu, kullanıcının kendi cihazında GÖRSEL/kurulum testi.

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
