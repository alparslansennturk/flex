# FlexOS — Mimari (Birleşik Referans)

> **Bu dosya, yeni mimarinin tek kaynağıdır.** Önceki dört ayrı doküman
> (`ARCHITECTURE.md`, `FLEXOS_MIMARI.md`, `FLEXOS_CAPABILITIES.md`, `FLEXOS_MVP_FLOW.md`)
> burada birleştirildi.
>
> - **Bugünkü canlı sistemin** teknik referansı için → `FLEX_CORE_LORE.md`
> - **Gelişim günlüğü** için → `FLEX_CORE_LOG.md`
> - **Bu dosya** = gelecekteki yeniden-inşa tasarımı (henüz kod yazılmadı; tasarım 2026-06-09'da kilitlendi).
>
> Son güncelleme: Haziran 2026

---

## Durum / İlerleme (yeniden-inşa)

> Bu blok **ne yapıldığını** izler (tasarım aşağıda, ilerleme burada).

### ✅ Flex Connect — hover/uzun-basma menü konumlama fix + push bug (badge/tıklama) + ana bildirim ziline bağlanma (2026-07-20, PC oturumu 2 — EN GÜNCEL)

**Menü konumlama** (kullanıcı bulgusu: "üzerine gelmeye çalışırken menüler sürekli
kayboluyor"): masaüstünde chevron (Düzenle/Yanıtla/Yıldızla/Kopyala/Sil menüsü)
artık balonun ALTINDA değil, İÇİNDE sağ üst köşede; emoji/reaksiyon butonu ise
balonun DIŞINDA — kendi mesajında solda, karşı tarafın mesajında sağda. Hover
grubu artık TÜM mesaj satırına (balon+dıştaki ikon aynı kutu) uygulanıyor, bu
yüzden fare balondan ikona giderken artık hover kopmuyor (kök sebep: eskiden
ikon balonun ~4px altında ayrı bir kutuydu, aradaki boşlukta hover kayboluyordu).

**Mobil uzun-basma menüsü iki bug'ı:**
- iOS'un kendi native metin-seçme/"Kopyala" callout'u bizim menümüzle çakışıyordu
  (`WebkitTouchCallout` hiç set edilmemişti) — artık engellendi, sadece bizim
  menümüz çıkıyor.
- Emoji/reaksiyon ekleme mobilde hiç yoktu (sadece var olanları görüntüleyebiliyordu) —
  uzun-basma menüsüne "Tepki Ver" satırı + emoji şeridi eklendi.

**Öğrenci masaüstü sayfası** (`/flexos/student/[personId]/connect`) — daha önce
bu güncellemenin dışında bırakılmıştı, şimdi eklendi: "en son sohbete otomatik
atlama" kaldırıldı (personel sayfasıyla AYNI fix), yeni mesaj menüsünün TAMAMI
(Reply/Star/Copy/Edit/Delete, sistem mesajı, "sohbet başladı" kartı, inline-saat
balon, dıştaki emoji butonu) buraya da port edildi — SADECE "Özelden Yanıtla" ve
"Sohbeti Sil" hariç (ikisi de mimari/yetki gereği öğrenci tarafında yok; "Sohbeti
Sil"i öğrenciye açmayı denedim, kullanıcı "şimdilik yapma" dedi, geri alındı —
bkz. `hideConversationForMe` hâlâ SADECE personel).

**GERÇEK bir push bug'ı bulundu ve düzeltildi** (kullanıcı bulgusu: "mesaj gelince
badge gelmiyor, connecte girip çıkmak gerekiyor" + "bildirime tıklayınca sohbete
gitmiyor"): `sw-connect-mobile.js`'teki push handler, FCM'in Admin SDK'dan
`data:{...}` ile (notification alanı olmadan) gönderilen mesajları web push'a
naklederken alanları KÖKTE değil `data` anahtarının ALTINDA gönderdiğini
hesaba katmıyordu — `payload.title`/`payload.badge`/`payload.conversationId`
HER ZAMAN `undefined` kalıyordu. Bu TEK bug hem "rozet hiç güncellenmiyor" HEM
"bildirime tıklayınca doğru konuşmaya gitmiyor" şikayetlerinin ortak kökü çıktı.
Ayrıca bildirime tıklayınca sohbete GİTME kodu (ne uygulama açıkken ne kapalıyken)
hiç yazılmamıştı — ikisi de eklendi (`postMessage` dinleyicisi + soğuk başlangıç
için `?openConversation=` URL param'ı).

**Connect mesajları artık ana FlexOS bildirim ziline/toast'ına bağlı** — önceden
tamamen bağımsızdı (SADECE mobil FCM push'a gidiyordu, `users/{uid}/notifications`
koleksiyonuna hiç yazmıyordu, yani Connect dışındaki hiçbir yerde görünmüyordu).
`ConnectDeps`'e `notify` eklendi (`comment-service.ts::CommentDeps.notify` ile
AYNI sözleşme, `flexos-notify.ts::notifyUser` — zaten var olan `NotificationBell`/
`NotificationToastListener` altyapısı, yeni bir koleksiyon/rules AÇILMADI), push
aboneliğinden BAĞIMSIZ olarak her mesajda tüm alıcılara yazılıyor. Ödev yorumu
bildirimleri zaten bu sisteme bağlıydı (`comment-service.ts`), oradan ayrıca bir
şey yapılmadı.

**SIRADAKİ İŞ:** Bu turda yapılanların TAMAMI (özellikle push bug fix'i — badge
gerçekten real-time geliyor mu, bildirime tıklayınca doğru sohbete gidiyor mu,
ve yeni bildirim zili entegrasyonu) gerçek cihazda henüz test edilmedi.

---

### ✅ Flex Connect — WhatsApp'a yakın mesaj/menü güncellemesi + "24 hep geri geliyor" fix + Sohbeti Sil (2026-07-20, PC oturumu 1)

**"24 hep geri geliyor" çözüldü:** Audience-only okuyucular (üye kaydı olmayanlar,
ör. "Kurum Duyuruları" gibi audience:"all_students" kanalları) için `markRead`
Faz 1'de sessizce no-op ediyordu ("basitlik kararı") — okunmamış sayısı HİÇ
kalıcı olmuyordu. Artık ilk okumada gerçek bir member dokümanı oluşturuluyor;
bonus olarak bu kişiler artık o kanaldan push bildirimi de alacak (önceden hiç
almıyorlardı, gizli bir eksikti — `notifyNewMessage` alıcı listesi `listMembers`'tan
geliyor).

**"Sohbeti Sil"** (DM'e özel, WhatsApp'taki gibi KİŞİSEL gizleme — kalıcı silme
DEĞİL): `ConnectMember.hiddenAtMessageCount` — silen kişinin listesinden kaybolur,
karşı taraf hiç etkilenmez, karşı taraf yeni mesaj yazınca otomatik geri görünür.
Öğrenci-eğitmen DM'sinde SADECE eğitmen kullanabilir, personel-personel DM'de
ikisi de. Masaüstünde DM menüsündeki eski "Konuşmadan Ayrıl" yerine geçti, mobilde
ölü duran 3-nokta butonu artık gerçek bir menü açıyor.

**Büyük WhatsApp-parity güncellemesi** (kullanıcının detaylı spesifikasyonu +
ekran görüntüsü referans alındı, Plan mode ile onaylanıp uygulandı):
- **Sistem mesajları**: gruba üye eklenince (hem toplu oluşturmada hem tekil
  eklemede) "N kişi gruba eklendi" otomatik mesaj (`ConnectMessage.kind:"system"`).
- **Reply/Reply Privately**: `ConnectMessage.replyTo` (statik anlık görüntü,
  canlı referans DEĞİL). Özelden Yanıtla SADECE grup mesajında + başkasının
  mesajında + personelde (öğrenci menüde hiç görmüyor, mevcut "öğrenci
  keyfi DM açamaz" mimarisiyle çakışmasın diye) — yazarın DM'i aç/oluştur +
  alıntı composer'a ön-dolu.
- **Star (Yıldızla)**: `ConnectMessage.starredBy` (kişi başına bağımsız,
  `hiddenFor` ile aynı desen). Ayrı bir "Yıldızlı Mesajlar" ekranı YOK
  (kullanıcı kararı) — sadece küçük bir yıldız göstergesi.
- **Balon layout'u**: saat artık metinle AYNI satır akışında (flex yerine düz
  `inline` akış — kısa mesajda yanında, uzun mesajda otomatik son satıra düşer,
  ekstra JS ölçüm gerekmez). SADECE metin mesajlarında; dosya eki mesajlarında
  eski (ekin altında, sağda) düzen korundu.
- **Unified menü**: masaüstünde eski ayrı kalem-butonu + `MoreVertical` menüsü
  TEK bir chevron ikonuna indirgendi (Düzenle/Yanıtla/Yıldızla/Kopyala/[Özelden
  Yanıtla]/Sil). Mobilde bu menü **basılı tutunca** açılıyor (~450ms eşik),
  balonun sağına 4px boşlukla, `createPortal(document.body)` ile HER ZAMAN
  altındaki mesajların üzerinde kalıyor (masaüstündeki `computePopoverPosition`
  deseniyle aynı ilke — scroll konteynerinin z-index'inin dışına taşınır).
  **Mobilde önceden Düzenle/Sil/Reaksiyon-ekleme HİÇ yoktu** — bu güncellemeyle
  ilk kez geldi (önceden sadece görüntüleme vardı).
- **Konuşma başlangıcı**: "Sohbet [tarih] tarihinde başladı" kartı — SADECE
  `messages.length < 60` iken (sunucu `limitToLast(60)` çekiyor, sayfalama yok,
  daha kalabalık sohbette bu gerçek başlangıç olmayabilir, gerçek veriye sadık
  kalmak için böyle sınırlandı).
- **Attachment birleştirme**: mobil artık masaüstüyle AYNI paylaşılan
  `AttachmentView` component'ini kullanıyor (resim önizlemesi dahil) — kendi
  duplicate/resim-önizlemesiz kartı kaldırıldı. `AttachmentView`'e `dark?`
  prop'u eklendi (masaüstü her zaman açık tema, mobil koyu/açık).

**Kapsam dışı bırakılanlar (bilinçli):** KVKK/Gizlilik Politikası metni (gerçek
hukuki metin gerektirir), "Yıldızlı Mesajlar" ayrı ekranı, öğrenci tarafında
Özelden Yanıtla (mimari kısıtlama), student desktop sayfası (`/flexos/student/
[personId]/connect`) bu güncellemenin DIŞINDA kaldı (plan sadece personel
masaüstü + mobil PWA'yı kapsıyordu).

**SIRADAKİ İŞ:** Bu büyük güncelleme gerçek cihazda henüz uçtan uca test
edilmedi — özellikle mobildeki basılı-tutma menüsünün konumlanması/z-index'i,
Reply Privately akışı, ve sistem mesajlarının gerçek bir grup üyesi eklenince
doğru göründüğü doğrulanmalı.

---

### ✅ Flex Connect Mobil — push bildirimi gerçek cihaz doğrulaması (3 gerçek bug) + Ayarlar ekranı temizliği (2026-07-20, PC oturumu)

**Push bildirimi — gerçek cihazda test edilirken sırayla 3 gerçek bug bulundu/çözüldü:**
1. iOS'ta `Notification.requestPermission()` SADECE Ana Ekrana eklenmiş (standalone) PWA'da diyalog gösteriyor, Safari sekmesinde sessizce hiçbir şey olmuyor — `isStandalone` tespiti eklendi, standalone değilse net uyarı.
2. **GERÇEK KÖK NEDEN** (kullanıcı bulgusu: "izin verdim ama hiç tepki yok"): service worker kaydı `scope:"/flexos/connect/mobile/"` (SONDA `/`) kullanıyordu, manifest'in `scope`/`start_url`'ü ise `/flexos/connect/mobile` (sonda `/` YOK) — sayfanın kendi URL'i kendi SW'sinin scope'una prefix olarak GİRMİYORDU, bu yüzden `navigator.serviceWorker.ready` sonsuza kadar askıda kalıyordu (dialog/hata YOK, "hiç tepki yok" tam da bu). Scope manifest'le birebir eşitlendi.
3. `getToken()` öncesi cihazda önceki bir denemeden (farklı VAPID key'le) kalmış push subscription varsa sessizce/anlaşılmaz patlıyordu — önce `unsubscribe` eklendi. Ayrıca SW-ready + getToken adımlarına 8sn `withTimeout` + gerçek JS hata adı/mesajını gösteren toast eklendi (artık hiçbir adım sessizce sonsuza kadar takılı kalamaz).
4. UX: anahtara basınca 1-4sn süren (FCM token + 2 sunucu isteği) zincir boyunca görsel geri bildirim yoktu, kullanıcı "basmadı" sanıyordu — dönen gösterge + `toast.loading` ("Bildirimler etkinleştiriliyor...") → aynı toastId üzerinden success/error'a güncelleniyor.
5. "Push Bildirimleri" → **"Anlık Bildirimler"** (kullanıcı: "push" terimi çoğu kullanıcı için anlaşılır değil).

**Sahte/işlevsiz UI temizliği** (kullanıcı sert tepkisi: "öğrenci onları gerçek sanacak, neden vakit kaybettirdin"): Bildirimler ekranındaki "Ses & Titreşim", "Sessiz Saatler", "Çalışma Saati Uyarıları" anahtarları hiçbir backend'e bağlı değildi (sadece local state, hiç okunmuyordu) — üçü de kaldırıldı.

**Yerine gerçek kurumsal kural geldi** (kişisel açma/kapama YOK, herkeste sabit): öğrenci → eğitmen DM'de (`realm:"trainer_student"`, `type:"dm"`), İstanbul saatiyle 22:00-09:00 arası gönderilen mesajlar `ConnectMessage.afterHours` ile işaretlenir, hem öğrenciye hem eğitmene "🌙 Mesai saati dışı" etiketi görünür (mobil + masaüstü `connect/page.tsx`) — mesaj ENGELLENMEZ/geciktirilmez, sadece etiketlenir. Amaç: kurumun öğrenci-eğitmen arası kontrolsüz iletişim riskini azaltma isteği (`connect-service.ts::isAfterHoursStudentToTrainerDm`).

**Profil bug'ı çözüldü:** Ayarlar'daki profil ismi soğuk PWA açılışında sonsuza kadar "…" kalabiliyordu (`auth.currentUser` mount'ta TEK SEFERLİK okunuyordu, Firebase Auth oturumu henüz geri yüklenmemişse o an `null` çıkıp effect bir daha hiç çalışmıyordu) — artık zaten izlenen `authUser` state'ine bağlı. Unvan sabit **"Eğitmen"** oldu — gerçek dahili unvan (Firestore `users.title`, ör. "Yönetici"/Admin) Connect'te ARTIK HİÇ okunmuyor/gösterilmiyor (kullanıcı: Admin kimliği öğrenciye asla sızmasın).

**Ayarlar ekranı denetimi** (kullanıcının "burada boş boş çok şey var" turu): "Dil" satırı kaldırıldı (çoklu-dil altyapısı hiç yok, "Türkçe" yazan tıklanamaz satırın anlamı yoktu). "Gizlilik & Güvenlik" artık GERÇEK bir Şifre Değiştir ekranı (Firebase Auth `reauthenticateWithCredential`+`updatePassword`) — KVKK/Gizlilik Politikası metni BİLEREK eklenmedi (gerçek hukuki metin gerektirir, uydurma metin sahte bir toggle'dan daha kötü olurdu). Yeni **"❓ Yardım ve Geri Bildirim"** bölümü: "Sorun Bildir"/"Öneri Gönder" → açıklama kutusu → gönder + altında "Sürüm v1.0.0" (eski alt yazıdan taşındı). Öğrenciyse gönderim Aktivite Merkezi'ne **"destek"** kategorisinde bir talep olarak düşer (yeni koleksiyon AÇILMADI, var olan Case/Activity sistemi kullanıldı — `case-service.ts::reportStudentIssue`, YENİ route `api/flexos/student/connect/report-issue`, `case.create` yetkisi GEREKMEZ, dar kapsamlı self-servis eylem, açık "destek" talebi varsa mevcut talebe not olarak eklenir — case.ts'teki genel dedup kuralıyla aynı). Personelse (Case bir Person'a/öğrenciye bağlı olmak zorunda, personelin böyle bir kaydı yok) `mailto:` yedeği kullanılır.

**SIRADAKİ İŞ:** Tüm bu değişiklikler (push scope fix'i + yeni Ayarlar ekranı) gerçek cihazda uçtan uca son bir kez doğrulanmalı — özellikle "Sorun Bildir"in gönderdiği talebin Aktivite Merkezi'nde göründüğü ve Şifre Değiştir'in gerçekten çalıştığı. KVKK/Gizlilik Politikası metni kullanıcıdan/hukuk tarafından gelirse ayrıca eklenecek.

---

### ✅ Flex Connect Mobil — push bildirimi + badge + iOS alt-boşluk kapatma + final marka ikonu/splash (2026-07-19 gece, PC oturumu)

**Bugünkü işin özeti — sırayla:**

1. **iOS Safari PWA'da alt boşluk — uzun teşhis zinciri.** Kök neden bir
   önceki (Mac) oturumunda "çözüldü" denen şey aslında kalıcı değildi. Ekrana
   geçici bir runtime teşhis paneli eklenip (`window.innerHeight`,
   `visualViewport.height`, `document.documentElement.clientHeight`,
   `screen.height`, `env(safe-area-inset-bottom)` probe'u, shell/nav gerçek
   `getBoundingClientRect()`) gerçek cihazdan ölçüm alındı: iOS standalone'da
   **üçü de** `screen.height`'tan **47px kısa** geliyor — bu, `env(safe-area-
   inset-bottom)`'un kendisinden (34px) bile büyük bir açık, yani JS'ten gelen
   HİÇBİR viewport ölçümü gerçek fiziksel ekranı vermiyor.
   - 1. deneme: `shellStyle`'da `position:fixed;inset:0` ile AYNI ANDA açık
     `height` verilmesi CSS'te "aşırı kısıtlanmış" durum yaratıyordu (spec
     `bottom`'u yok sayıyor) — `height`→`minHeight` yapıldı. Mimari olarak
     doğruydu ama tek başına gerçek cihazdaki 47px'i kapatmadı.
   - 2. deneme: WebKit'e özel `-webkit-fill-available` (`style jsx` +
     `!important`, SADECE iOS'ta, scoped class) — bu da fark yaratmadı.
   - **Nihai çözüm (pes edip gizleme stratejisi):** `isIOS` tespiti
     (`navigator.userAgent`) eklendi. SADECE iOS'ta: bottom-nav zemini
     `T.bg`'ye (zaten `body`/`html`'e JS ile senkron tutulan renk) eşitlendi,
     sert `borderTop` yerine hafif üst `boxShadow` kondu, padding sıkılaştırıldı
     (ikonlar dibe yakın). Login ekranı ve `SplashGate.tsx`'in açık-tema zemin
     rengi de aynı nedenle `T.bg`/`#F4F5F7`'ye çekildi. Android/masaüstü hiç
     etkilenmedi (`isIOS` dışında eski stil aynen kaldı). Kullanıcı onayı:
     "böyle kesinlikle daha iyi oldu." **Not: bu bir gizleme/disguise, WebKit'in
     kendi ölçüm açığı hâlâ orada — geometrik gerçek çözüm bulunamadı.**
   - Teşhis paneli iş bitince kaldırıldı.

2. **Push bildirimi + uygulama ikonu badge + sessize alma — uçtan uca (Web
   Push/FCM).** Yeni Firestore koleksiyonu `connect_push_subscriptions/{uid}`
   (token'lar + genel açık/kapalı tercihi). `setMuted` (`ConnectMember.muted`
   tipte zaten vardı, servise/route'a bağlandı — WhatsApp gibi konuşma bazlı
   sessize alma). `notifyNewMessage` (`connect-push-service.ts`) her mesaj
   gönderiminde (4 route: personel+öğrenci × metin+ek) tetikleniyor —
   sessize/kapalı alıcılara göndermiyor, badge rakamını TÜM konuşmalardaki
   gerçek okunmamış toplamından (`messageCount - readMessageCount`, mesaj
   taraması yapmadan) hesaplıyor, ölü FCM token'larını otomatik temizliyor.
   8 yeni API route (register/unregister/settings/mute × personel/öğrenci).
   Service worker'a `push`+`notificationclick` handler'ları eklendi — BİLEREK
   "data-only" FCM payload (`notification` alanı YOK) kullanılıyor, yoksa FCM
   arka planda kendi bildirimini gösterip bizim `setAppBadge` mantığımızı hiç
   çalıştırmayabilirdi. İstemci: Ayarlar'daki "Push Bildirimleri" anahtarı
   gerçek izin/token akışına bağlandı, sohbet başlığına sessize alma zil ikonu
   eklendi, badge `conversations`'taki gerçek okunmamış toplamıyla senkron.
   VAPID public key Firebase Console'dan alınıp `.env.local` + Vercel
   (Production+Preview, `vercel link` ile CLI'dan) ortam değişkenine eklendi,
   production'da bundle'da doğrulandı. Ayrıca: logout'ta `tab`/`screen`
   state'i sıfırlanmıyordu (Ayarlar'dan çıkan bir sonraki girişte yine
   Ayarlar'da açılıyordu) — `handleLogout`'ta düzeltildi.

3. **Final marka ikonu + splash logosu.** Kullanıcı 3 yeni SVG verdi
   (`public/assets/Mobile-Desktop-Icon.svg`, `Mobile-Splash-Logo.svg`,
   `-White.svg`). Desktop/PWA ikonu `sharp` ile 192/512px + apple-touch-icon
   (180px) PNG'e render edilip manifest + `layout.tsx` metadata'sına bağlandı;
   eski geçici "FC" harfli dinamik `next/og` ikon route'u tamamen kaldırıldı.
   `SplashGate.tsx`'teki placeholder konuşma-balonu ikonu gerçek logoyla
   değiştirildi (açık temada renkli, koyu temada beyaz varyant).

**SIRADAKİ İŞ:** Push bildirimi + badge + mute gerçek cihazda uçtan uca
doğrulanmadı (kod push edildi, kullanıcı henüz test etmedi). Yeni marka ikonu
da cihazda doğrulanmadı — iOS ikon önbelleği "yapışkan" olabilir, PWA'nın
silinip yeniden kurulması gerekebilir. iOS alt-boşluk konusu KAPANMADI, sadece
gizlendi — ileride WebKit güncellemesi/başka bir yaklaşım gerekebilir.

---

### ✅ Flex Connect Mobil — kritik oturum/cache bug zinciri çözüldü + UI/UX ince ayar turu (2026-07-19 gece, Mac oturumu)

**Bugünkü işin özeti — sırayla:**

1. **UI ince ayar** (kullanıcı isteği): alt bar boşluğu → üst/alt 16px eşit padding
   (flexbox merkezleme, `bottomNavStyle`/buton stilleri), ikonlar 23px→28px,
   pasif ikon rengi `T.muted`→`T.text2` (daha belirgin), "Personel" alt-sekme
   etiketi → "Kullanıcılar" (içerideki Personel/Öğrenciler toggle AYNEN kaldı),
   fontlar (sohbet/kanal ismi, mesaj balonu, input) 13-14px→16-17px.
2. **Geçişler**: framer-motion zaten yüklüydü, tab/ekran geçişlerine sade
   opacity fade eklendi (x-slide DENENDİ, "sert" bulunup kaldırıldı).
3. **Öğrenci mobil ayrımı** — AYRI ROUTE AÇILMADI (PWA scope'u
   `/flexos/connect/mobile`'a sabit, farklı path standalone modundan çıkarır).
   Aynı sayfa, giriş sonrası `/api/flexos/me`'nin `landing` alanına bakıp
   öğrenci mi personel mi anlıyor (masaüstünün kullandığı AYNI mekanizma).
   Öğrenciyse: "Kullanıcılar"→"Eğitmenim" (`fetchTrainerDirectory`), "+" (yeni
   sohbet) gizli, personel dizinine hiç istek atılmıyor. Server'da da bağımsız
   engel var (`connect-service.ts` zaten `createConversation`'ı personel
   dışına kapatıyor) — çift katmanlı.
4. **Firestore read amplifikasyonu** (kullanıcı: "935 sonra 300,300 read
   spike'ı gördüm") — `listMessages` GET route'ları (personel+öğrenci) limit
   VERMEDEN çağrılıyordu, her `onSnapshot`/gönderme tetiklenişinde konuşmanın
   TÜM geçmişi yeniden okunuyordu. `limit=60` eklendi, kök neden kapandı.
5. **KRİTİK bug zinciri — "splash geldi gitti", gecikmeli giriş, garip oturum
   davranışı:**
   - Kök `src/app/layout.tsx`'teki `UserProvider` (`UserContext.tsx`) TÜM
     uygulamayı sarıyor, mobil Connect "ayrı route" olsa da React ağacı hâlâ
     onun İÇİNDEYDİ. `UserProvider` kendi `loading` state'i false olana kadar
     children'ını hiç render etmiyordu (`{!loading && children}`).
   - GERÇEK kök neden (Playwright ile canlı konsol logları izlenerek
     bulundu): bu "SENARYO-B: 3sn sonra doLogout()" (flex-token cookie'sini
     GERÇEKTEN temizleyen) kod, asıl mobil sayfadan DEĞİL, Firebase Auth
     SDK'nın arka planda açtığı gizli yardımcı `iframe`'den
     (`/__/auth/iframe`, bu projede Firebase Hosting yok, 404 dönüp bizim
     genel 404/kök layout'a düşüyor) geliyordu — o iframe'in KENDİ
     `window.location`'ı farklı olduğu için path kontrolü orada işe
     yaramıyordu. **Görünmez ama gerçek bir cookie-temizleme yan etkisiydi.**
   - Fix: `UserContext.tsx`'e `shouldSkipAuthGuard()` — path
     (`/flexos/connect/mobile`) VEYA `window.self !== window.top` (iframe
     içindeyiz) ise auth/cookie mantığı hiç çalışmıyor. Canlıda doğrulandı
     (Playwright): o loglar artık hiç çıkmıyor, masaüstünde regresyon yok.
   - Ayrıca: Vercel Authentication (SSO koruması) projede
     `all_except_custom_domains` olarak açık — SADECE `flex-one-iota.vercel.app`
     korumasız, TÜM diğer `.vercel.app` adresleri (otomatik deploy URL'leri
     DAHİL) Vercel'in kendi login ekranına düşüyor. Kullanıcı yanlış adresten
     PWA kurmuştu, o yüzden "Vercel şifresiyle giriyorum" diyordu. **Öğrencilere
     paylaşılacak link KESİNLİKLE `flex-one-iota.vercel.app` olmalı.**
   - "Vercel Toolbar" bizim KENDİ kodumuz — `VercelToolbarWrapper.tsx`, kök
     layout'ta, SADECE `user.roles.includes("admin")` ise gösteriyor (gerçek
     Vercel platform toolbar'ı değil, gerçek öğrencilerde hiç çıkmaz).
   - Vercel edge cache de sorundu (`x-vercel-cache: HIT`, `x-nextjs-stale-time:
     300`) — `Cache-Control: no-store` header'ı yetmedi, route'a
     `export const dynamic = "force-dynamic"` eklendi (hem `page.tsx` hem
     `layout.tsx`).
   - Servis çalışanından (`sw-connect-mobile.js`) `skipWaiting`/`clients.claim`
     kaldırıldı — sayfa yüklenirken kontrolün anında el değiştirmesi bazı
     kaynakların yeniden tetiklenmesine yol açıyordu.
6. **Kalıntı splash titremesi** (zaten-giriş-yapılmış oturumda yeniden
   açılışta): React'in kendiliğinden "hydration mismatch" kurtarma davranışı
   (SADECE bu route'ta oluyor, tam kökü BULUNAMADI — layout.tsx'in
   viewport/metadata export'ları, styled-jsx, force-dynamic tek tek test
   edildi, hiçbiri sebep değildi) sayfayı (`page.tsx`) arkada sessizce bir kez
   yeniden kuruyor, bu da sayfanın kendi splash state'ini resetleyip splash'ı
   geri getiriyordu. **Mimari çözüm** (kullanıcı önerisi): splash artık
   `page.tsx`'in DEĞİL, yeni `SplashGate.tsx` (layout.tsx'te, sayfanın ÜSTÜNDE)
   bileşeninin state'i — sayfa sadece `useMarkConnectReady()` ile "hazırım"
   diyor, idempotent, sayfa kaç kere sessizce yeniden kurulursa kurulsun
   `SplashGate` etkilenmiyor. Canlıda doğrulandı (Playwright ile zaman
   damgalı snapshot): splash tek seferde temiz açılıp kapanıyor.
7. **100dvh Chrome-iOS-PWA'da yetersiz kalıyordu** (kullanıcı: "Chrome'da Ana
   Ekrana Ekle'de alt bar tam oturmuyor, tarayıcı barının olduğu yerde
   boşluk var") — CSS birimine güvenmek yerine `window.visualViewport.height`
   ile gerçek yükseklik JS'te ölçülüp piksel olarak veriliyor artık.

**Doğrulama yöntemi notu:** Bu oturumda `vercel` CLI (deployment/alias
inceleme) + Playwright (gerçek tarayıcı, canlı konsol/network/hydration
hataları) kullanıldı — kullanıcının kendi cihaz raporları + canlı teşhis
birlikte kök nedenleri buldu. Sadece kullanıcı raporuna güvenip körlemesine
fix atmak (ilk birkaç deneme) işe yaramadı, gerçek veri şart oldu.

**SIRADAKİ İŞ:** Kullanıcı PC'ye geçti, oradan devam edecek. Açık kalanlar:
splash'ın GÖRSEL tasarımı ("daha sonra tasarım yaparız" dendi, alttaki
loader/yazı zaten kaldırıldı), Chrome-iOS `viewportHeight` fix'inin cihazda
doğrulanması, hydration mismatch'in tam kökü (zararsız hale getirildi ama
hâlâ açıklanamadı), 3-4 gerçek öğrenciyle canlı pilot hâlâ bekliyor, push
bildirimi/App Badge/final marka ikonu hâlâ kapsam dışı bırakıldı.

---

### ✅ FlexOS CANLIYA ALINDI + Flex Connect (Faz 1-3) tamamlandı, Mobil PWA production'da (2026-07-18/19, Mac oturumu)

**En önemli mimari değişiklik: FlexOS artık TEK canlı sistem.** Kullanıcı bu iki
günde eski (pasif) canlı Flex Core'u devre dışı bıraktı — artık gerçek
öğrencilere FlexOS üzerinden ödev veriyor ve yoklama alıyor. `main` branch =
production, `flexos` branch = geliştirme (aynı commit'e senkron tutuluyor,
`git push origin flexos:main` ile). Bundan sonraki TÜM işler bu aktif-canlı
sistemin üzerine ekleniyor — "henüz canlıya çıkmadı" varsayımı ARTIK GEÇERSİZ.

**Flex Connect (madde 96'daki "henüz tasarım/kod yok" notu KAPANDI) — tam
detay `FLEX_CONNECT.md`'de, özet:**
- **Faz 1** (çekirdek: kanal/grup/DM/topluluk, iki-realm izolasyonu, widget) tamamlandı.
- **Faz 2** (Audit Log, Favoriler, reaksiyonlar, okundu-tiki, misafir daveti,
  dosya ekleri) tamamlandı + kanal/grup/topluluk **silme**, **üye yönetimi**,
  **düzenleme modalı**, mesaj popup'larının `position:fixed`+portal'a taşınması
  (scrollable konteyner clipping/z-index bug'larının kesin çözümü) eklendi.
- **Faz 3 (Mobil PWA)** — `/flexos/connect/mobile`, ayrı route, gerçek veriyle
  4 sekme (Sohbetler=WhatsApp-tarzı birleşik liste, Kanallar=kategorize
  görünüm, Personel+Öğrenciler toggle, Ayarlar), gerçek mesajlaşma/oluşturma
  akışları, PWA altyapısı (manifest+geçici ikon+service worker), gerçek
  Splash+Login (aynı FlexOS hesabı). **Production'a alındı, kullanıcı kendi
  telefonuna kurdu, 2 gerçek bug bulunup düzeltildi** (iOS standalone modda
  durum çubuğu + alt boşluk — `env(safe-area-inset-*)` + `100dvh`). Sıradaki:
  3-4 gerçek öğrenciyle canlı pilot (bkz. hafıza `flexos_connect_mobile_pilot_plan`).

**SIRADAKİ İŞ:** Flex Connect Mobil'de kullanıcının kendi cihazında bulacağı
görsel/UX ince ayarlar + push bildirimi/App Badge (bilinçli en sona bırakıldı)
+ final marka ikonu. Ayrıca bu dosyanın altındaki (madde 100-103, 2026-07-14
tarihli) "SIRADAKİ İŞ" listesindeki Flex Connect maddesi artık kapandı, diğer
maddeler (arşiv ödev Firestore-seviyesi filtre, yorum/globals.css, bildirim
listener tekilleştirmesi vb.) hâlâ açık olabilir — kod durumu doğrulanmadan
güvenilmesin.

---

### ✅ Ödev mail bildirimi (Brevo) + Ödev Notu'nda "proje" ayrımı + çok sayıda UI düzeltmesi (2026-07-17, Mac oturumu)

**1) Ödev verilince öğrencilere mail — eski (pasif) canlı sistemde vardı, FlexOS'a hiç taşınmamıştı, kullanıcı bulgusu.** Yeni `lib/server/assignment-mail.ts::notifyAssignmentPublished` — `POST /api/flexos/assignments` ile bir ödev **published** (taslak değil) olarak oluşunca gruptaki (veya `targetPersonIds` doluysa sadece hedef kişilere) tüm **aktif** öğrencilere Brevo üzerinden mail gidiyor (`lib/email.ts::sendMail`, FlexOS'ta zaten şifre sıfırlama/kullanıcı kodu için canlı — aynı altyapı reuse edildi, yeni env/kurulum gerekmedi). Mail içinde ödev başlığı/alt başlık/son teslim tarihi + öğrenci portalına giden bir "Ödevi Görüntüle" butonu var. Best-effort: gönderim hatası ödev oluşturmayı asla başarısız kılmaz, sonuç (`{sent,total}`) `OdevOlusturModal.tsx`'teki başarı toast'ında gösteriliyor ("X/Y öğrenciye mail gönderildi").

**2) Ana Sayfa "En Son Aktiviteler" paneline "Ödev Verildi" türü eklendi.** `activity-log.ts::ActivityLogType`'a `"assignment.published"` eklendi, `assignment-service.ts::assignTask` published ödev oluşunca (opsiyonel `activityLog` dep varsa) log yazıyor, `ActivityFeed.tsx`'e mor `BookOpen` ikonlu yeni bir kart tipi eklendi. `assignments/route.ts` `invalidateActivityLogCache` çağırıyor (yoklama/not route'larıyla AYNI desen).

**3) Ödev Notu hesabında "proje" türü ödevler ARTIK HİÇ SAYILMIYOR — 2026-07-06'daki eski %30/%70 iç ağırlıklandırma kararının YERİNE geçti.** Kullanıcı netleştirdi: "proje" kavramı SADECE Sertifika Notu'nda yaşar (`Grade.projectGrade`, elle girilir, sertifika notu sayfasından); bir ödeve `kind:"proje"` verilse bile o ödevin puanı/teslimi Ödev Notu hesabına (payda/pay) hiç eklenmiyor artık. `submission-service.ts::computeOdevYuzdeleri` düzeltildi (proje kategorisi kasıtlı olarak hep boş kalıyor, `combineOdevYuzdesi` otomatik olarak normal'i %100 ağırlıkla alıyor — kod değişmedi, zaten "kategori boş" fallback'i vardı). `sertifikasyon/not/page.tsx`'teki client-side kopya formül DOKUNULMADAN otomatik doğru davranmaya başladı (aynı fallback deseni). Ayrıca **Ödev Türü = Proje** seçilince "Ödev Puanı" alanı hem `OdevOlusturModal.tsx` (Ödev Ver) hem `odevler/yonetim/page.tsx` (Şablon Oluştur/Düzenle) içinde tamamen kalkıp yerine "puan kullanılmaz, Sertifika Notu'ndan elle girilir" notu çıkıyor. Test: `scripts/assert-submission.ts` eski "proje %70 ağırlık" testi yeni kurala göre güncellendi, 44/44 geçti.

**4) Öğrenci Detay — "Yapılan Ders" ile "Derse Katılım" ayrıştırıldı (kullanıcı: "aynı satırda neden, karışık duruyor").** `person-education-summary-service.ts::AttendanceSummary`'ye yeni `heldHours` alanı eklendi (o güne kadar GERÇEKTEN işlenmiş toplam ders saati, öğrencinin katılımından bağımsız — zaten hesaplanıyordu ama dışarı hiç verilmiyordu). `StudentEgitimBilgileri.tsx`'teki yoklama kartı artık **5 eşit-aralıklı satır**: Toplam Ders → Yapılan Ders (`heldHours`) → Derse Katılım (`doneHours`, yüz yüze/online kırılımı burada) → Devamsızlık → Kalan Ders — her satır kendi `border-b`'siyle net ayrılıyor (eskiden sadece `gap-3`, "Yapılan Ders"/"Derse Katılım" görsel olarak yapışık duruyordu).

**5) "Sadece online satın alan" öğrenciler için `isOnlineStudent` UI'ya bağlandı.** Alan zaten `Person`'da vardı (eski canlı sistemden backfill'le gelmiş, FlexOS'un kendi satış/öğrenci-ekle akışlarında SET EDİLEMİYOR — bilinen eksik, ileride eklenebilir) ama Öğrenci Detay'da hiç gösterilmiyordu. `GET /api/flexos/persons/[id]` ve `.../education-summary` response'larına eklendi; Öğrenci Detay'ın 3 yerinde (sayfa/panel/modal) isim yanında **"(O)"** rozeti çıkıyor; online-only öğrencide "Derse Katılım" satırındaki "Xs yüz yüze · Ys online" kırılımı (zaten hepsi online olacağı için) gizleniyor. Yoklama Al roster'ındaki `(O)` rozeti zaten vardı (eski sistemden portlanmış), dokunulmadı.

**6) "Ödev Ver" modalı (`OdevOlusturModal.tsx`) genişletildi + dosya yükleme "Ödev Teslimi" sayfasıyla AYNI desene getirildi.** Modal 860px→980px, tek dikey sütun yerine 2 sütuna bölündü (sol: ad/tür/grup/tarih/puan, sağ: açıklama/dosya) — dikeyde sığma sorunu çözüldü. Dosya yükleme artık her zaman açık bir kutu değil: küçük "+ Dosya Yükle" butonu sağa doğru genişleyerek **Bilgisayardan Yükle | Google Drive** iki butonunu açıyor (teslim sayfasındaki AYNI framer-motion width-expand deseni), Drive linki `assignmentId` beklemeden hemen locale ekleniyor (gerçek yükleme değil, referans link — ödev oluşunca ilk `attachments` alanıyla gönderiliyor). Sürükle-bırak artık modalın TAMAMINDA çalışıyor (mavi glow border, teslim sayfasındaki "kart her zaman geçerli drop hedefi" davranışı).

**7) Küçük UI düzeltmeleri:** (a) açılış akışında (RootPage→hedef sayfa→FlexSidebar ready) artık TEK sürekli "Flex Yükleniyor" yazılı ekran — `FlexSpinner.tsx`'e modül-seviyeli `appBooted` bayrağı eklendi, sonraki sayfa geçişleri yazısız kalıyor (`FlexPageLoader` her çağrıldığı yerde otomatik karar veriyor). (b) Ödev Şablon Yönetimi tablosunda şablon adı altındaki alt başlık kaldırıldı (düzenleme panelinde hâlâ var). (c) Ana Sayfa "En Son Aktiviteler" paneline sabit 28px alt boşluk (`h-7`, scroll'dan bağımsız her zaman görünür). (d) Öğrenciler Havuzu filtre satırı: "İsim ara" artık Eğitim'den hemen sonra (Filtrele'ye yakınlaştırma denendi, kullanıcı geri aldı); Temizle butonu görününce Filtrele'nin alt satıra kaymasını önleyen gerçek bug fix (`flexShrink:0` tüm sabit filtrelere/butonlara, sadece aradaki spacer küçülüyor). (e) Öğrenciler Havuzu tablosundaki "Durum" rozeti (Aktif/Mezun vb.) yatay padding 12px→16px (filtre panelindeki chip'ler dokunulmadan bırakıldı, kullanıcı özellikle istemedi).

**Test/doğrulama:** `tsc --noEmit` + `npm run build` her adımda temiz. `scripts/assert-assignment.ts` 39/39, `scripts/assert-submission.ts` 44/44.

**SIRADAKİ İŞ:** Yok — bu oturumdaki tüm istekler kapatıldı. Bilinen açık: `Person.isOnlineStudent` FlexOS'un kendi satış/öğrenci-ekle akışlarında set edilemiyor (sadece backfill'den gelen mevcut öğrencilerde dolu) — istenirse ayrı bir turda satış formuna/öğrenci ekle formuna toggle eklenebilir.

---

### ✅ Tahmini Bitiş Tarihi (yoklama) + GRP-784 bölüm-saat bug'ı + ACİL erken-başlatma bug'ı + Öğrenci Bilgi modal/panel düzenlemeleri (2026-07-16, Mac oturumu)

**1) Gerçek zamanlı, tatil-duyarlı "Tahmini Bitiş Tarihi" — eski canlı sistemden eksik kalan hesaplama geri geldi.** Yeni `domain/services/schedule-calc.ts` (`calcEstimatedEndDate`/`expandHolidayDates`, eski `AttendancePanel.tsx::calcEstimatedEndDate`'in birebir portu) — başlangıç tarihi + haftalık ders günleri + toplam ders saatinden GERÇEK ZAMANLI hesaplanıyor, tatil eklenince otomatik güncelleniyor, HİÇBİR YERDE saklanmıyor. Önce Öğrenci Detay'a (`person-education-summary-service.ts`) eklendi, GRP-784 ile gerçek veriye karşı doğrulandı (2026-10-22 doğru çıktı, eski `Group.schedule.endDate` alanı zaten `undefined`'dı). Sonra `AttendanceCore.tsx`'e (Yoklama Al üst lacivert bar + Yoklama Detay bilgi paneli, "Başlangıç Tarihi:"/"Tahmini Bitiş Tarihi:") ve `AttendanceDetailList.tsx`'e (Yoklama Detay liste sayfası — kendi yerel `calcEstimatedEndDate` kopyası kaldırılıp merkezi fonksiyona bağlandı) taşındı.

**2) Aynı GRP-784 üzerinden 2 gerçek bug daha bulundu:**
   - **Sınıfı Düzenle formunda "Toplam Saat" hiç kaydedilmiyordu** — `siniflar/page.tsx`'teki `fToplamSaat` state'i Group'ta karşılığı olmayan sahipsiz bir alandı (`editGroup`'ta hiç doldurulmuyor, `onSave` payload'ında hiç yok). Artık kataloktan (bölüm/eğitim) OTOMATİK türetilen salt-okunur bir alana çevrildi. Aynı formda **"Seans" bilgisi kayıt sonrası siliniyordu** — seans kütüphanesinde eşleşme bulunamazsa (`fSeansIdx=-1`) `days:[]` gönderilip gerçek programın üzerine yazılıyordu; artık eşleşme yoksa grubun mevcut gün/saatine düşülüyor.
   - **"Toplam Ders" bölümlü eğitimde bölüm ayrımı yapmıyordu** — GRP-784 (Grafik-2, kendi saati 96) `Education.totalHours`'ı (TÜM paket, 177) gösteriyordu. `GET /api/flexos/groups` artık `sectionHours`/`educationTotalHours` ayrı ayrı döndürüyor, 4 tüketici (`AttendanceCore`, `siniflar/[id]` "Toplam Program", `AttendanceDetailList`, Sınıf Ekle formu) `sectionHours ?? educationTotalHours` sırasını kullanacak şekilde düzeltildi.

**3) ACİL — gerçek production olayı: ders saatinden saatlerce önce yanlışlıkla "Dersi Başlat"a basıldı, gerçek bir yoklama kaydı + aktivite logu oluştu** (GRP-784, 19:00 dersi 15:23'te başlatıldı). **Kök neden:** `AttendanceCore.tsx::isWithinTimeWindow` içinde `if (isOrgScope) return true;` — admin/eğitim-op için 15dk-önce kuralını dersin saatine bakmaksızın TAMAMEN atlıyordu. Hatalı kayıt (`flexos_attendance`) + aktivite (`flexos_activity_log`, "Yoklama Başlatıldı") script'le production'dan temizlendi. **Fix iki katmanlı:** (a) client — 15dk-önce kuralı artık rol farketmeksizin herkes için geçerli, ders saati geldikten SONRA org-scope hâlâ süresiz muaf (kullanıcının tarif ettiği 4 kural: 15dk-önce kilit / 3 gün eğitmen düzenleme / 8 saat (eskiden yanlışlıkla 6 saatti, `WINDOW_AFTER_MIN` 360→480 düzeltildi) hızlı-giriş / sonrası admin-only aynen korundu); (b) server — `attendance-service.ts::startLesson`'a AYNI kural sunucu tarafında da eklendi (önceden HİÇ doğrulanmıyordu, sadece client kilitliyordu) — İstanbul yerel saatine `Intl.DateTimeFormat` ile AÇIKÇA göre hesaplanıyor (Vercel'in kendi TZ'sinden, muhtemelen UTC, bağımsız).

**4) Küçük UI iyileştirmeleri:** Yoklama Detay liste sayfasındaki "Bu Ay İlerleme"/"Kurs İlerleme" çubukları artık 0→gerçek-değer giriş animasyonuyla açılıyor. `FlexSidebar` menü aralıkları sıkılaştırıldı (padding/gap azaltıldı) + gerçek bug fix: `<nav>` ile alttaki Sistem Ayarları/Çıkış bloğu arasındaki `marginTop:auto` boşluğu kısa ekranda sidebar'ın taşmasına/alt bloğun üste yapışmasına sebep oluyordu — `<nav>` artık `flex:1+overflowY:auto`, kendi içinde scroll oluyor.

**5) Öğrenci Bilgi modal/panel — birden çok tur kullanıcı geri bildirimiyle düzenlendi:**
   - **Sertifika Notu sayfasında öğrenciye tıklama artık çalışıyor** — eğitmen için `StudentDetailModal`, admin/eğitim-op (`canOverrideLock` sinyali) için Yoklama Detay'daki AYNI "liste↔detay kayması" deseniyle (sidebar sabit, içerik kayar, sol üstte geri butonu) yeni bir `StudentDetailPanel.tsx` bileşeni açılıyor.
   - Modal'ın açılışta önce daracık, veri gelince aniden büyüme bug'ı `min-h-[620px]` ile giderildi.
   - Kurs meta kartında başlık artık grup kodu (`GRP-784`), alt başlık bölüm adı (`Grafik-2`) — "Grafik Tasarım Kursu" (eğitim adı) artık büyük başlıkta değil. Eğitim seçici dropdown'da ayraç `·`→`-`.
   - **Sertifika Not Bilgileri kartı** kullanıcının verdiği mockup'a göre yeniden tasarlandı: rakam büyütüldü (36px→46px), renk 3 kademeli (90+ yeşil / 50-89 mavi / <50 kırmızı — mockup'ın kendi 2 kademeli yeşil/kırmızısı KASITLI değiştirildi), alt çubuk donut'takiyle aynı 0→gerçek-değer animasyonuna kavuştu.
   - **Genel Bilgiler (modal, 4 alan):** birkaç tur tartışma sonrası Ad Soyad → E-posta → Şube → Cinsiyet'te karar kılındı. Doğum Tarihi ve "Kayıt Tarihi" (kullanıcı doğru tespit etti: kayıt tarihi satış/kayıt olayına ait, eğitmen bağlamında anlamsız) modalda YOK — course tarihleri zaten Eğitim Bilgileri panelinde var. Telefon alanı zaten SADECE non-compact (admin) modda gösteriliyordu, dokunulmadı — "eğitmen telefon göremez, satış/admin görebilir" kuralı buradan doğal olarak sağlanıyor.

**Test/doğrulama:** Her adımda `tsc --noEmit` + `npm run build` temiz. GRP-784 gerçek Firestore verisiyle çapraz kontrol edildi (Section "Grafik-2" hours=96, Education totalHours=177 doğrulandı; hatalı attendance/activity-log kaydı script'le tespit edilip silindi).

**SIRADAKİ İŞ:** Yok — bu oturumdaki tüm bildirilen bug'lar/istekler kapatıldı.

---

### ✅ Ana Sayfa gerçek "En Son Aktiviteler" akışı + 8 gerçek bug (canlı testte bulundu) (2026-07-15, Mac oturumu)

**Özellik — Ana Sayfa'daki "En Son Aktiviteler" paneli gerçek veriyle çalışıyor** (öncesinde sabit `ActivityFeedPlaceholder`, "Henüz aktivite yok"). Yeni: `domain/core/activity-log.ts`, `domain/repo/activity-log-repo.ts`, `server/activity-log-repo.firestore.ts`, `/api/flexos/egitmen-anasayfa/activity-log` route (bootstrap'a eklendi). **Bilinçli olarak CRM "Aktivite Merkezi" (`repo/activity-repo.ts`, `flexos_activities`) İLE KARIŞTIRILMADI** — tamamen ayrı, yeni `flexos_activity_log` koleksiyonu. Kapsam: `attendance.started`/`attendance.ended`/`attendance.updated` (`attendance-service.ts`) + `grade.given` (`submission-service.ts::gradeSubmission`/`gradeManually`/`gradeBatch`, `grade-service.ts::saveGrades`). Realtime: yeni SSE event gerekmedi, var olan `attendance.changed`/`grades.changed` kullanıldı. Firestore rules server-only, yeni composite index deploy edildi — **ama `firebase.json`'da `firestore.indexes` yolu hiç tanımlı değilmiş, ilk deploy'um bu yüzden index'i sessizce atlamıştı, `firebase.json` düzeltilip yeniden deploy edildi.**

**Canlı testte kullanıcının bulduğu 8 gerçek bug (hepsi düzeltildi):**
1. **Hızlı Yoklama kartı yeni sekmede açmıyordu** — sidebar'daki "Yoklama Al" (2026-07-02'den beri bilinçli `window.open`) ile tutarsızdı. `QuickActionCard`'a `openInNewTab` prop'u eklendi.
2. **Toplu not girişinde öğrenci başına ayrı log** — eski canlı sistemin AYNI bug'ı tekrarlanıyordu (`handleSaveGrades` diff yapmıyordu). `gradeBatch`/`saveGrades` artık SADECE gerçekten değişen notlar için TEK özet log yazıyor ("6 öğrenciye not girildi"), puan gösterilmiyor (kullanıcı: "100p demiş, gerek yok").
3. **Sertifika Notu (`grade-service.ts::saveGrades`) aktivite logu hiç yoktu** — sadece Ödev Notu tarafı bağlanmıştı, unutulmuştu.
4. **Cache invalidation eksikliği** — aktivite yazıldıktan sonra 30sn'lik okuma cache'i düşürülmüyordu, SSE anında refetch stale liste dönüyordu ("güncelledim, hiç düşmedi"). 6 mutasyon route'una `invalidateActivityLogCache` eklendi.
5. **"Güncelle" butonu yoklamayı yanlışlıkla yeniden açıyordu** — `AttendanceCore.tsx`'teki "Güncelle" butonu `close:false` gönderiyordu, `saveAttendance` bunu "yeniden aç" olarak yorumluyordu (kod yorumu "kapalı kalıyor" diyordu ama YANLIŞTI) — kullanıcı "Kaydet dedim Dersi Bitir çıktı" diye yakaladı. `close:undefined`'a çevrildi.
6. **Panel yüksekliği içerik arttıkça büyüyordu** — eski canlı sistemdeki (`dashboard/page.tsx`) AYNI çözüm portlandı: `ResizeObserver` ile sol kart grid'inin bittiği yer ölçülüp panelin `maxHeight`'ına sabitleniyor. İlk versiyonda efekt `[]` bağımlılıkla SADECE ilk (loading) render'da çalışıp bir daha tetiklenmiyordu (`authed===null` erken dönüşü yüzünden `cardsRef` henüz DOM'da değildi) — `[authed, sharedLoaded]` dep'ine eklenerek düzeltildi. `no-scrollbar` class'ı da kaldırıldı (kullanıcı: scroll görünür olmalı, yoksa kaydırılabildiğini anlamaz).
7. **Full/admin modda `actor.trainerId` hiç çözülmüyordu** — `auth-actor.ts::actorFromCaller`, `trainerId` SADECE `packages.includes("egitmen")` ise aranıyordu; Full modda paket `["admin"]` olduğu için Görünüm Anahtarı sahibi (aynı kişi hem admin hem gerçek eğitmen) Full'dayken Ana Sayfa'nın "kendi" verisi (aktivite) hep boş dönüyordu. `caller.email === VIEW_TOGGLE_OWNER_EMAIL` de arama koşuluna eklendi. **Turbopack hot-reload bu bellek-içi cache'i (`trainerIdCache`) eski koda takılı bıraktı** (bu projede daha önce de görülen bir desen) — dev sunucusu restart'ıyla düzeldi, kod değişikliği doğruydu.
8. **Kullanıcılar sayfasında 2 ayrı, alakasız ama ciddi bug bulundu** (kullanıcı "vahim hata" dedi):
   - **Personel listesinde öğrenci hesapları görünüyordu** — `flexos_users` koleksiyonu personel VE öğrenci giriş hesaplarını (`provisionStudentLogin`, `roles:["ogrenci"]`) AYNI yerde tutuyor, Personel API'si (`/api/flexos/users`) hiç rol filtresi uygulamıyordu. `roles.includes("ogrenci")` filtresi eklendi.
   - **"Son giriş" yanlış hesaplanıyordu** — SADECE Firebase Auth'un `lastSignInTime`'ına bakılıyordu, bu alan SADECE yeni email/şifre girişinde güncellenir; günlük normal kullanımda (çıkış yapmadan devam eden oturum) sessiz token yenilemesi (`lastRefreshTime`) hiç sayılmıyordu. Gerçek örnekle kanıtlandı (bir öğrenci gün içinde kullandı ama "19 gündür girmedi" yazıyordu — `lastRefreshTime` dündü, `lastSignInTime` 19 gün önceydi). Bu SADECE o öğrenciye özel değil, çıkış yapıp tekrar girmeyen HERKESİ etkiliyordu — `persons/route.ts` artık ikisinin en yenisini kullanıyor.

**Test kapsamı:** `scripts/assert-attendance.ts` (24/24) + `scripts/assert-submission.ts` (42/42) + `scripts/assert-grade.ts` (18/18, aktivite testleri YENİ eklendi). `tsc --noEmit` + `npm run build` temiz. Firestore rules+indexes gerçekten deploy edildi (`firebase.json` fix sonrası doğrulandı).

**SIRADAKİ İŞ:** Kod commit+push edilecek (bu oturumun sonu). Ödev ver/sil/arşivle, grup ekleme gibi diğer aktivite log türleri bu turda YOK (istenirse aynı desenle sonra eklenir). Ceren Gürel'in gerçek "şifremi unuttum" senaryosu (`lastRefreshTime` fix'iyle artık doğru görünmeli) PC'de/sonraki oturumda tekrar canlı doğrulanabilir.

---

### ✅ Ödev arşivi gerçek bug'ı + Arşiv sekmesi/kalıcı sil + 2 AÇIK mimari karar (2026-07-14, Mac oturumu, aynı gün DEVAMI)

**1) Gerçek bug bulundu ve düzeltildi (commit `ed82976`):** Kullanıcı Ana Sayfa'da bir ödevi ("raket ödevi", grup 784) kart menüsünden "İptal Et" dedi (`status: "archived"` — backend doğru çalışıyor, Firestore'a doğru yazılıyor). Ama `/flexos/odevler/teslim/[groupId]` sayfasında hâlâ "Aktif Ödevler"de görünüyordu — o sayfadaki Aktif/Tamamlanan ayrımı SADECE `dueDate`'e bakıyordu, `status` hiç kontrol edilmiyordu. Fix: arşivlenenler Aktif/Tamamlanan'dan tamamen çıkarıldı + yeni bir **"Arşiv" sekmesi** eklendi (sade kart: başlık+tarih) + her kartta onaylı **"Kalıcı Sil"** (`DELETE /api/flexos/assignments/:id`, zaten vardı, backend'de cascade yok).

**2) Kullanıcı test ederken İKİNCİ gerçek bug'ı kendi buldu:** ödeve yorum ("selam") bıraktı → bildirim düştü → sonra ödevi Kalıcı Sil'le sildi → bildirime tıklayınca sonsuz loader (öksüz thread/yorum referansı). **Bilinçli olarak ŞİMDİ düzeltilmedi** — kullanıcı bunun genelde test senaryosu olduğunu, gerçek kullanımda kalıcı silmeyeceğini söyledi. Tartışılan ama uygulanmayan öneri: `deletePerson`'daki AYNI desen (`Satış/ödeme geçmişi varsa reddedilir`) — ödevde yorum/teslim varsa `deleteAssignment` hard-delete'i reddetsin, arşivde kalsın. **PC'de/ileride gerekirse bu eklenebilir, henüz kod yok.**

**3) Kullanıcının kendi bulduğu ÜÇÜNCÜ, daha derin nokta:** arşivlenmiş ödevler bile "sürekli okunan veri" — `/api/flexos/assignments` (hem `list` hem `listByTrainerIds`) status'a göre HİÇ Firestore-seviyesi filtre yapmıyor, TÜM ödevleri (arşiv dahil) her çağrıda okuyor. **Araştırırken gerçek bir Firestore KISITI bulundu:** bireysel eğitmen (org-scope olmayan, en yaygın yol) sorgusu zaten `trainerId in [...]` kullanıyor (2026-07-13 kota fix) — Firestore TEK sorguda birden fazla `in` filtresine izin vermiyor, yani üstüne `status in [...]` eklemek bu yolda doğrudan mümkün değil. **Gerçek çözüm ya `isArchived: boolean` düz alanı (migrasyon gerekir) ya da ayrı sorgular** — bu saatte/oturumda riske girilmedi, kod yazılmadı. **PC'de ele alınacak, bilinçli açık iş.**

**4) Bilgi notu (kod değil, mimari yön):** Kullanıcı "Flex Connect" adlı ayrı bir uygulamanın (WhatsApp-benzeri ama farklı tasarım, masaüstü çizimleri Claude Design'da tamamlandı) sohbet geçmişini ödevden BAĞIMSIZ tutabileceğini düşünüyor — eğer chat mimarisi assignment'a değil person/group'a bağlanırsa, madde 2'deki "ödev silinince yorum/bildirim öksüz kalıyor" sorunu mimari olarak kendiliğinden ortadan kalkar. Henüz tasarım/kod yok, ilerideki bir karar.

**KARAR (2026-07-15, Mac oturumu):** Madde 1 kapandı — `deleteAssignment` hard-delete'e güvenlik freni EKLENMEYECEK, mevcut davranış korunacak. Kullanıcı gerekçesi: ödev kaydı öğrenci/satış kaydı gibi kalıcı önem taşımıyor — zaten belirli süre sonra siliniyor, öğrenci mezun olunca da önemi kalmıyor. `deletePerson`'daki desen (satış/ödeme geçmişi varsa reddet) buraya bilinçli olarak UYGULANMAYACAK.

**SIRADAKİ İŞ (Mac ya da PC, hangisi açılırsa):**
1. Arşivlenmiş ödevlerin Firestore-seviyesinde okunmasını engelleme — `isArchived` düz alan + migrasyon (ya da ayrı sorgular), `trainerId in [...]` ile `status in [...]`'ın AYNI sorguda birleşemediği unutulmasın.
2. Flex Connect (ayrı chat uygulaması) tasarımı geldiğinde mimari karar gözden geçirilsin.
3. Önceki oturumlardan kalan, hâlâ açık: yorum yapma/globals.css talimatının netleşmesi, bildirim listener tekilleştirmesi, Sınıf Odası dönüşümü, öğrenci portalı grup seçici/genel eksikler.

---

### ✅ Sidebar flaşı KESİN çözüldü + Vercel↔Firestore bölge uyuşmazlığı bulundu + bootstrap endpoint + persons TTL (2026-07-14, Mac oturumu, bir önceki blokun DEVAMI)

**1) Sidebar flaşı gerçekten bitti — 3 turda.** Bir önceki blokta "çözüldü" denen fix yetersiz çıktı: kullanıcı hem "Full menüler bir an görünüp gizleniyor" hem "önce sadece Ana Sayfa, sonra diğerleri kademeli doluyor" bildirdi. Kök neden: `FlexSidebar`'ın `caps`/`mode` state'i sıcak modül-cache'ten İYİMSER okunuyordu — cache doğruysa sorun yok, ama caps boşken (soğuk mount) `canSee()` her şeyi gizlediği için kademeli dolma oluyordu; cache cache YANLIŞSA (nadir ama olası) yanlış öğe bir an görünüyordu. **Kesin fix:** `ready` adlı tek bir bayrak eklendi — `false` iken (her mount'ta, cache ne olursa olsun) sidebar'ın YERİNE tam ekranı kaplayan `position:fixed` bir kapatma katmanı dönüyor (projenin paylaşımlı `FlexSpinner`'ı, gri zemin — kullanıcı lacivert+logo'yu beğenmedi), altındaki hiçbir şey görünmüyor; `ready=true` olunca TEK seferde tam/doğru nav render ediliyor. İlk denemede `if (ready) return` ile fetch'i atlayıp bir REGRESYON yarattım (yanlış değer sonsuza kadar cache'te donuyordu) — geri alındı, fetch her mount'ta sessizce (skeleton göstermeden) arka planda çalışıp state'i günceller (SWR deseni). `auth-actor.ts::packagesForCaller` da sertleştirildi: view-mode okuma hatası artık sessizce "full"a düşmüyor, son bilinen değere düşüyor. Commit'ler: `a9808f4`.

**2) Kota teşhisi — gerçek sayılarla.** Kullanıcı "ilk açılışta 900+ okuma, saatte 6.6k" bildirdi. `egitmen-anasayfa/page.tsx` incelendi: `/api/flexos/persons` (8 koleksiyon: persons+enrollments+sales+payments+bundles+…, TTL=0, hep taze) sadece banner'daki TEK bir "Öğrenci" sayısı için tam maliyetiyle çekiliyordu → **tamamen kaldırıldı**, sayı artık `/api/flexos/groups`'un zaten döndürdüğü `enrolled` (doluluk) alanından, aktif gruplar toplanarak türetiliyor (commit `d478639`). Ardından `groups` (3×), `assignment-templates` (2×), `/api/flexos/me` (OdevKütüphanesi'nin sadece trainerId için yaptığı, aslında gereksiz bir çağrı) aynı sayfada tekrar tekrar çekildiği görüldü → sayfa TEK SEFER çekip `OdevParkuru`/`OdevKütüphanesi`'ye prop olarak geçecek şekilde yeniden yapılandırıldı (commit `4dd8e59`). Sonuç: 3 dakikada ~441 okumaya düştü (900+'dan).

**3) ASIL kök neden — coğrafi bölge uyuşmazlığı.** Hız hâlâ 3-4sn'ydi, dedup rağmen düzelmedi. DevTools Network'te her `/api/flexos/*` isteğinin (holidays gibi bariz ucuz biri dahil) aynı ~1.5-2.5sn'yi aldığı görüldü — bu "her route'un kendi işi" değil, PAYLAŞILAN sabit bir maliyet işaretiydi. `vercel inspect` → fonksiyonlar **`iad1`** (Virginia, ABD) çalışıyor. `firebase firestore:databases:get` → Firestore **`eur3`**'te (Avrupa). Yani her istek Atlantik'i iki kez geçiyordu. **Kullanıcı Vercel Dashboard'dan Function Region'ı Frankfurt'a (`fra1`) taşıyıp redeploy etti** — süreler anında `groups 515ms / templates 226ms / holidays 302ms / assignments 505ms / me 270ms / settings 216ms`'e düştü (önceki 1.47-2.54sn'den 3-8× iyileşme). Bu, tüm oturumun EN YÜKSEK etkili tek düzeltmesiydi.

**4) Kullanıcı "demir tavında dövülsün" dedi, iki ek iş daha aynı oturumda bitirildi (commit `b903a0a`):**
   - **`/api/flexos/egitmen-anasayfa/bootstrap`** — sayfanın `groups`/`assignment-templates`/`holidays`/`assignments` ihtiyacı artık TEK istekte (ilgili route'lardan export edilen `fetchGroupsForActor`/`fetchTemplatesForActor`/`fetchAssignmentsForActor`/`buildMeInfo` fonksiyonları aynen import edilip Promise.all'la paralel çalıştırılıyor, kod tekrarı yok). `me`/`settings` BİLEREK dışarıda bırakıldı — onlar `FlexSidebar`'ın (20+ sayfada ortak) kendi çağrıları, sayfaya özel bir endpoint'e bağlamak paylaşımlı bileşeni kırardı.
   - **`persons` TTL 0 → 20sn** — kullanıcı "500 öğrenci olsa ne olur" diye sorunca (Öğrenci Havuzu sayfası aynı ağır 8-koleksiyon join'i kullanıyor, sayfalama yok) gündeme geldi. Geçen haftaki "silme-sonrası-gecikme" şüphesi hiçbir zaman kanıtlanamamıştı; artık `PATCH`/`DELETE`/`close-account`'a `invalidateCache` eklendi (gerçek değişiklik anında yansır), TTL sadece "hiç mutasyon olmasa en kötü durum" sınırı.

**Kanıtlanmış sonuç (kullanıcı canlıda ölçtü):** ilk (soğuk) yükleme ~350-440 okuma (kabul edilebilir, tek seferlik), sonraki dakika **0 okuma** — arka planda hiçbir sızıntı/poll yok. Hız: en yavaş istek 515ms (önceki 2.54sn'den).

**Yan bulgu (aksiyon alınmadı, düşük öncelik):** Bildirim sistemi (`NotificationToastListener` + `NotificationBell`/`useNotifications`) AYNI `users/{uid}` dokümanını ve AYNI `users/{uid}/notifications` sorgusunu birbirinden habersiz 2'şer kez `onSnapshot` ile dinliyor — cleanup'ları doğru (memory leak yok), sadece gereksiz bağlantı çoğalması. İleride `NotificationRealtimeService`'e tekilleştirme eklenebilir.

**⚠️ AÇIK/CEVAPSIZ:** Kullanıcı bir mesajında "projede benim verdiğimin dışında asla yorum yapılmasın, globals.css dosyasını hep hatırla" dedi — bu, oturumun geri kalanıyla (hiç CSS konuşulmadı) bağlantısız ve kod tabanının kendi yerleşik (yoğun, tarihli, "neden" açıklayan) yorum geleneğiyle ÇELİŞİYOR. Uygulanmadı, kullanıcıya açıkça soruldu, henüz yanıt gelmedi — **PC'de ilk iş bu netleşsin.**

Commit sırası: `a9808f4` → `d478639` → `4dd8e59` → `b903a0a`. Hepsi `flexos` + `main`'e push edildi (main = production, Vercel deploy ediyor). Vercel Function Region Frankfurt'a taşındı (kod/commit değil, dashboard ayarı — PC'de bunun kalıcı olduğunu/ekibin bildiğini varsay). Her adımda `tsc --noEmit` + `npm run build` temiz.

**SIRADAKİ İŞ (PC'de):**
1. **Önce netleştir:** yukarıdaki "yorum yapma + globals.css" talimatı neydi — başka bir konuşmadan mı karıştı?
2. Kota grafiğini birkaç saat/gün daha izle (steady-state gerçekten düşük mü kalıyor).
3. İstenirse: bildirim listener'larının tekilleştirilmesi (düşük öncelik, yan bulgu).
4. Önceki oturumlardan kalan, hâlâ açık işler geçerliliğini koruyor: Sınıf Odası dönüşümü, öğrenci portalı grup seçici, öğrenci portalı genel eksikler — bkz. aşağıdaki eski bloklar.

---

### ✅ Sidebar flaş KALICI fix + read-cache TTL seçici geri açıldı (2026-07-14, Mac oturumu — bir önceki, YETERSİZ çıkan tur)

**1) Sidebar flaş — kullanıcı bir önceki (cb2f86c) fix'ten SONRA da hâlâ oluyor dedi.** Kök neden tam anlaşıldı: owner'ın `flexos_users`'taki ofis rolü capability'leri (`sale.create` vb.) zaten Core/Full modundan BAĞIMSIZ her zaman `caps` içinde geliyor (mode'a göre değişen tek şey `mode` string'i) — tek koruma `canSee()`'deki `mode === "full"` kontrolüydü. Önceki fix `mode`'u modül-cache'e aldı ama bilinmeyen (henüz fetch edilmemiş) durumda hâlâ `"full"` (EN AÇIK/permissive) varsayıyordu — cache soğukken (ilk mount, ya da önceki sayfanın fetch'i `cancelled` ile iptal olduysa) yine yanlış yönde varsayılan devredeydi. **Gerçek fix:** `caps` için zaten var olan "yüklenene kadar gizle" kuralı `mode`'a da uygulandı — bilinmeyen mod artık `"full"` değil `null`, katı `mode === "full"` eşitliği null'da otomatik `false` döner. Full-only öğeler sunucu GERÇEKTEN `"full"` demeden ASLA görünmez (`FlexSidebar.tsx`).

**2) Kota tekrar uçtu (983/786/850 gibi okuma rakamları) — kök neden: `read-cache.ts`'teki TTL 2026-07-13'te TAMAMEN devre dışı bırakılmıştı** (bir silme-sonrası-gecikme bulgusu yüzünden, kanıtlanamayan Turbopack modül-çoğaltma şüphesiyle). O zaman bilinçli tercihti ama artık sistem canlıda gerçek kullanıcılarla — TTL'siz hâl her açılışta ~121+ okumaya (groups 6-koleksiyon join dahil) sebep oluyordu. **Kullanıcı kararıyla hibrit TTL'e geri dönüldü:** `cachedRead()` TTL kontrolünü tekrar uyguluyor (in-flight coalescing zaten aktifti) — `assignment-templates`/`trainers` **5dk**, `groups` (en pahalı uç) **1dk**, `persons` (silinme şüphesi en yüksek uç) **0ms** (hep taze okur, `< 0` asla doğru olmaz).

Commit: `f697ac0`, `flexos` + `main`'e push edildi (main lokali eski kalmış olabilir, `origin/main` güncel — `git push origin flexos:main` ile fast-forward yapıldı). typecheck+build temiz.

**SIRADAKİ İŞ (yarın):** (1) Kota grafiğini izle — hibrit TTL'in gerçekten kotayı düşürüp düşürmediğini doğrula. (2) Sidebar flaş'ın bu kez gerçekten bitip bitmediğini canlıda tekrar test et (deploy sonrası hard-refresh). (3) Bir önceki oturumdan kalan açık işler hâlâ geçerli: Sınıf Odası dönüşümü, öğrenci portalı grup seçici, öğrenci portalı genel eksikler — bkz. aşağıdaki eski bloklar.

---

### 🚀 CANLIYA ALMA SONRASI — eski sistem pasife alındı + resolveLanding KRİTİK veri bug'ı + sidebar flaş fix (2026-07-13, aynı gün, PC oturumu)

**Bu blok bir önceki "CANLIYA ALINDI" girdisinden SONRA, aynı PC oturumunda oldu — kronolojik olarak EN GÜNCEL durum budur.**

1. **Eski sistem tamamen pasife alındı** (kod silinmedi, kullanıcı kararı: 1 ay yedek, sonra silinecek):
   - Yeni paylaşılan `src/app/lib/resolveFlexosLanding.ts` — rol bazlı landing (`/api/flexos/me`'nin `landing` alanı).
   - Eski kök `/` ve eski `/login`: başarılı auth sonrası artık `/dashboard`/`/student/{id}` yerine `resolveFlexosLanding` kullanıyor.
   - `src/middleware.ts`: `/dashboard`, `/student`, `/admin`, `/league`, `/attend` — kime ait olursa olsun artık HER ZAMAN köke (`/`) yönlendiriliyor (eski JWT-doğrulama/rol-izolasyon mantığı kaldırıldı, gereksiz kaldı).

2. **KRİTİK, gerçek veriyle doğrulanmış bug — `resolveLanding` (`/api/flexos/me/route.ts`):** Kullanıcı "3 aktif öğrenci var, girince ne olacak" diye sorunca admin script ile gerçek veri kontrol edildi: `flexos_users`'ta `roles:["ogrenci"]` olan SADECE 1 kayıt (test hesabı), ama `persons`'ta `authUid` dolu **20 gerçek kişi** vardı. Eski mantık ÖNCE `flexos_users` rolüne bakıyordu, "ogrenci" bulamayınca `persons`'a HİÇ bakmadan boş `/flexos/anasayfa` placeholder'ına düşürüyordu — yani 19 gerçek öğrenci girişte boş sayfaya düşecekti. Fix: `flexos_users` rolü eşleşmese bile `persons`'ta `authUid` eşleşmesi TEK BAŞINA öğrenci landing'i için yeterli sayılıyor artık (persons zaten doğru dolu, asıl doğruluk kaynağı o).

3. **Öğrenci sidebar'ı eğitmen sidebar'ıyla birebir aynı yapıldı:** `FlexSidebar.tsx`'ten `Item`/`S`/`IC`/`css` export edilip `StudentSidebar.tsx` bunları kullanıyor (aynı gradient/genişlik/aktif-durum vurgusu). Öğrenci header'ı da (`StudentHeader` kaldırıldı) artık paylaşımlı `FlexHeader` (`displayNameOverride` prop'u eklendi — `users/{uid}` legacy dokümanına bağımlı olmasın diye).

4. **Sidebar flaş bug'ı (kullanıcı canlıda yakaladı):** Core moddaki admin sayfa değiştirince (Eğitimler'e girince, sonra Ana Sayfa'da da) bir an TÜM menüler (Full-only Satışlar dahil) görünüp kayboluyordu. Kök neden: `caps` mount'lar arası modül-seviyesinde cache'leniyordu (`capsCache`) ama `mode` HER mount'ta `"full"`a resetleniyordu — sidebar remount olunca (paylaşımlı layout yok) caps cache'ten anında dolup mode henüz gerçek fetch'ten gelmeden `"full"` sanılıyordu. Fix: `mode` da `modeCache` ile aynı desende cache'lendi. **Kullanıcı deploy'un canlıya yansımasından ÖNCE test etmiş olabilir — bir dahaki oturumda hard-refresh sonrası hâlâ oluyor mu diye TEKRAR DOĞRULANMALI.**

Commit sırası: `a1a9672` (eski sistem pasife) → `79cb541` (resolveLanding fix) → `cb2f86c` (sidebar flaş fix). Hepsi `flexos` + `main`'e push edildi, typecheck+build her adımda temiz.

**SIRADAKİ İŞ (Mac'te devam):** (1) Sidebar flaş fix'inin gerçekten çözüp çözmediğini doğrula (kullanıcı son testi deploy tamamlanmadan yapmış olabilir). (2) [[project_mobile_chat_pwa_vizyon]] — Sınıf Odası dönüşümü (Genel Duyuru → herkesin yazabildiği sınıf chat'i) henüz kod yazılmadı. (3) [[project_student_portal_grup_secici]] — bitmiş grup→devam grubu senaryosu, go-live sonrası ertelendi, kabul edilmiş. (4) Öğrenci portalı — kullanıcı "ayrıca yapılacak, ana sistemden ayrılacak" demişti, henüz başlamadı.

---

### 🚀 CANLIYA ALINDI — `flexos` branch `main`'e merge edilip push edildi (2026-07-13, aynı gün, PC oturumu sonu)

**Kullanıcı kararı (kesin, birkaç kez teyit edildi):** `flexos` branch `main`'e merge edildi (çakışmasız fast-forward — `main`'de flexos'ta olmayan hiç commit yoktu) ve `origin/main`'e push edildi (`20b716f`). Vercel `main`'i production'a deploy ediyor — yani bu push GERÇEK kullanıcılara gitti. Merge öncesi `tsc --noEmit` + `npm run build` temiz doğrulandı.

**Kapsam kararı:** İlk faz = eğitmen ödev versin + öğrenci yüklesin + yoklama alınsın (üçü de kullanıcı tarafından test edilip onaylandı — yoklama: "grup 2 gün yoklaması girdim"). Satış/Eğitim Op/Eğitmenler modülleri de flexos'ta zaten var ama finans YOK, başka eksikler olabilir — kullanıcı bunu kabul ediyor, "eskiden kalan hiçbir şey kullanılmayacak, eskisi TAMAMEN pasife alınacak, yedek olarak tutulacak (silinmeyecek)."

**⚠️ SIRADAKİ İŞ (henüz yapılmadı):** Eski sistemi (`/dashboard/*`, eski `/login` akışı) gerçek kullanıcılar için erişilemez/pasif hale getirmek — kod SİLİNMEYECEK (yedek), sadece routing/login ile erişim kapatılacak. Mekanizma netleşmedi (muhtemelen `resolveLanding`/login-yönlendirme zaten FlexOS'a gidiyor olabilir, doğrulanmalı; direkt `/dashboard` URL'sine girilirse ne olacağı ayrı konu).

**Bilinen, kabul edilmiş, go-live SONRASI ertelenen eksik:** [[project_student_portal_grup_secici]] — bitmiş grup→devam grubu (örnek: 550 Grafik1 → 784 Grafik2) senaryosunda öğrenci dashboard'u SADECE aktif enrollment'ların ödevlerini gösteriyor, bitmiş grubun ödevleri kayboluyor. Çözüm zaten tasarlanmış bir modelin (`project_student_card_hub` — eğitim seçici) öğrenci-facing uzantısı. Go-live'ı bloklamıyor, kullanıcı onayladı.

### ✅ PC oturumu: 5 gerçek bug + anlık chat (Firestore onSnapshot) + kritik altyapı bulguları — "vahim hatalar" kullanıcı tarafından KAPANDI kabul edildi (2026-07-13, aynı gün, Mac oturumunun devamı)

**Bir önceki (Mac) oturumun bıraktığı "durum iyi değil / vahim hatalar var" uyarısı kullanıcı tarafından ÇÖZÜLDÜ kabul edildi** ("ciddi vahim hataları biz düzelttik bugün merak etme") — aşağıdaki iş bu kapsamda sayılıyor, ayrı bir detay listesi hiç istenmedi/verilmedi.

**Bulunup düzeltilen 5 gerçek bug (canlı test ile):**
1. `completeUpload`: 2 dosya AYNI ANDA tamamlanınca `nextId()` (rastgele) yerine deterministik Submission ID (`tenantId_assignmentId_personId`) — öksüz 2. submission'a bölünme + kota çarpımı düzeltildi
2. Ödev Ver/Ödev Teslimi grup listelerinde bitmiş/iptal gruplar filtrelenmiyordu → `mapStatus` ile tutarlı hale geldi (EgitmenSiniflarPanel'deki AYNI kural)
3. `EditAssignmentModal` çoklu dosya yüklemede stale-closure index bug'ı (`jobs.length` aynı anda yakalanıp hepsi aynı index'i eziyordu) → id-bazlı eşleşme
4. Bildirim (`postThreadCommentAsStudent`) hep `/flexos/egitmen-anasayfa`'ya gidiyordu → artık `teslim/{groupId}/{assignmentId}?personId=` ile doğru öğrenci thread'i otomatik açılıyor
5. Ana Sayfa "Detay" butonu (needsGrading olmayan dalda) doğrudan roster/teslim detayına atlıyordu (canlıdaki "önce liste" davranışı 2026-07-11'de sadece bir daldan düzeltilmişti) → artık her iki dalda da önce ödev listesine gidip ilgili ödevi açık gösteriyor
6. + canlıdaki tam-ekran "Detay Gör" önizleme sayfası (dosya önizleme + sohbet + onayla/revize) hiç portlanmamıştı → portlandı

**Anlık chat (öğrenci↔eğitmen 1:1) — mimari karar:** `comments.changed` broadcast + `useRealtimeSync` (SSE) denendi, CANLI TESTTE (terminal loguyla) KANITLANDI ki Turbopack dev'de `/api/flexos/realtime/stream` ile mutasyon route'ları FARKLI modül instance'ında çalışıyor (`broadcast()` her zaman dinleyici=0 buluyordu, aradan unsubscribe hiç geçmeden) — **in-memory pub/sub'ın Vercel çoklu-instance riski (realtime-hub.ts'teki bilinen sınır) local dev'de bile gerçekleşiyor.** Kullanıcı kararı: chat için SSE yerine `chats/{chatId}/messages` koleksiyonunu client DOĞRUDAN Firestore `onSnapshot` ile okusun (canlıdaki `tasks/{id}/threads/{studentId}/comments` ile AYNI desen) — yazma yine Admin SDK (mevcut yetki kontrolleri korunur), rules SADECE okuma açar (trainerUid/studentUid eşleşmesi, `tasks/threads` ile aynı ilke: "hoca ve öğrenci ID'lerini denetle", admin/org-scope bypass YOK — bilinçli sınır, gerekirse ayrıca eklenir). `mirrorToChat` dual-write yapıyor (eski `flexos_comments`'e de yazıyor, geriye uyumluluk + testler).

**KRİTİK bulgu — `with-auth.ts`'te unutulmuş Mac teşhis kodu:** `_read-audit.ts` (Firestore SDK'sının `Query`/`CollectionReference`/`DocumentReference` prototiplerini monkey-patch eden GEÇİCİ ölçüm aracı, kendi yorumu "analiz bitince silinecek" diyordu) hâlâ `with-auth.ts` içinde aktifti — Mac'e özel sabit bir log dosyası yolu (`/private/tmp/claude-501/...`) içeriyordu, TÜM API route'ları etkiliyordu. Silindi (`_read-audit.ts` + `with-auth.ts`'teki 3 satır).

**KRİTİK bulgu #2 — `firestore.rules` 2 haftadır deploy edilmemiş:** Kullanıcı "deploy ettim" dedikten sonra bile chat'te "Missing or insufficient permissions" devam etti. `firebaserules` API'sinden aktif ruleset'in `updateTime`'ı kontrol edilince **30 Haziran** tarihli olduğu görüldü (chats bloğu YOK) — önceki deploy denemesi hiç yürürlüğe girmemiş. Gerçek deploy tekrar yapıldı, `updateTime` + içerik doğrulandı.

`tsc --noEmit` + `npm run build` + 29/29 (assert-comment) + 37/37 (assert-submission) temiz. Commit: `65d8547` (push edildi, Mac `git pull` almalı).

**İleri vizyon (KOD YOK, sadece kayıt):** [[project_mobile_chat_pwa_vizyon]] — Flex chat'ini kurumun resmi WhatsApp-alternatifi + mobil PWA'ya taşıma planı, kullanıcı "şimdi değil" dedi ama ACİL öncelikli (kurumdan gelen WhatsApp-yasağı maili sonrası Flex'i kuruma kabul ettirme pitch'i).

**SIRADAKİ İŞ:** (1) Öğrenci Ana Sayfası'nı (`/flexos/student/[personId]`) canlıyla tam eşitleme — "Sınıflar Ligi" yerine öğrenciye özel aktiviteler konması (henüz yapılmadı, sadece task olarak açık). (2) **Canlıya geçiş kapsamı netleşmedi** — sadece ödev/teslim/chat akışı mı (eğitmen-öğrenci), yoksa satış/yoklama/sertifika dahil tüm platform mu? Kullanıcıya soruldu, cevap bekleniyor. (3) Mobil PWA vizyonu — aciliyet var ama "şimdi değil" denildi, tetiklenirse [[project_mobile_chat_pwa_vizyon]] oku.

---

### ⚠️ Kota sızıntısı kökten çözüldü + 18 gerçek bug fix + Öğrenci Portalı KRİTİK EKSİK — canlıya geçiş ERTELENDİ (2026-07-13, çok uzun oturum, PC'de devam)

**Bu oturumun ilk yarısı — Firestore kota sızıntısı derin teşhis + kökten çözüm.** Kullanıcı bulgusu: kota bir günde defalarca aniden fırladı (15k→35k, dakikada 400-1.4k okuma). Gerçek zamanlı ölçüm aracıyla (geçici, sonra kaldırıldı) kanıtlandı: tek bir "kaydet" aksiyonu ~12-30 okuma (ucuz), asıl maliyet **Ana Sayfa'ya her dönüşte** groups(56)/persons(108)/templates(18)/trainers(51) gibi ağır uçların 30sn-5dk cache'i olmadan defalarca yeniden okunmasıydı + **dev'in kendisi** (Claude'un kod düzenlemesi → Turbopack recompile → açık sekmelerin/canlı `onSnapshot` dinleyicilerinin yeniden okuması) önemli bir sızıntı kaynağıydı. **Kullanıcı kararı: bundan sonraki geliştirme local dev değil doğrudan canlı Vercel'de** ([[flexos_gelistirme_artik_canli_vercel]]) — dev-recompile sızıntısı orada hiç olmayacak.

**KRİTİK GÜVENLİK BULGUSU + kökten fix:** Görünüm Anahtarı (Core/Full) sahibinin modu bellek-içi `cachedViewMode` değişkeninde tutuluyordu — mod değiştirme (`POST view-access/mode`) ile `assignments` GET'in okuduğu mod **farklı bellek konumlarıydı** (Next.js dev/Turbopack route'lar arası modül kopyalama şüphesi, KESİN kanıtlanamadı ama 5+ ardışık mod değişiminden sonra bile `assignments` HER ZAMAN org-scope/40-doküman davranmaya devam etti). **Fix: bellek-içi cache TAMAMEN kaldırıldı**, mod her istekte doğrudan Firestore'dan okunuyor (~1 okuma, ihmal edilebilir maliyet, garanti doğru). Aynı modül-çoğaltma şüphesi GÜN SONUNDA **read-cache.ts'i de (groups/persons/templates/trainers 5dk cache) vurdu** — silinen bir öğrenci, cache invalidate DOĞRU çağrılmasına rağmen (kod doğrulandı) hard-refresh sonrası bile listede görünmeye devam etti. **O da devre dışı bırakıldı** (`cachedRead` artık her zaman taze okur, in-flight coalescing hâlâ aktif) — DOĞRULUK, kritik canlıya-geçiş testi sırasında kota-tasarrufundan öncelikli tutuldu. Detaylı teşhis: [[flexos_kota_sizintisi_teshis_2026_07_13]].

**İkinci yarı — kullanıcı "canlıya alabiliriz" deyip gerçek uçtan-uca testine başladı, 18 GERÇEK bug bulundu, hepsi düzeltildi:**
1. Ödev Notu liste rozeti notlanan ödevi "bekliyor" gösteriyordu (client-only hesap, DB'den türetilmedi)
2. Yeni/boş grupta (GRP-784) sahte dummy ödev fallback'i gösteriliyordu
3. Eğitim Yönetimi sayfası yetkisiz erişimde yönlendirme yapmıyordu (admin panel flaşlanıyordu)
4. **Yoklama gün eşleşmesi — SİSTEMİK bug, 9+ yerde (6 dosya), HEM client HEM SUNUCU** (`attendance-service.ts::startLesson` dahil): `schedule.days` ISO-tabanlı (0=Pazartesi) ama JS'in `Date.getDay()`'i (0=Pazar) doğrudan karşılaştırılıyordu — 1 gün kayması. `isoWeekday()`/`toJsWeekdays()` helper'larıyla düzeltildi.
5. Grup düzenleme "admin'de bile çıkmıyordu" → aslında görünüm-modu güvenlik bug'ının (#yukarıda) yan etkisiydi
6. Admin moda geçince `/flexos/anasayfa` (boş "yakında" placeholder) yerine artık `/flexos/egitmen-anasayfa`'ya gidiyor
7. Yoklama Detay'a girince takvim her zaman ayın 1'ine sabitliydi → bugüne düzeltildi
8. "Dersi Başlat" butonu hata olunca SESSİZCE başarısız oluyordu → artık toast.error
9. Geçmiş tarihli girişte "Dersi Başlat" yerine "Yoklama Gir" + kaydetme onay toast'ı
10. "Güncelle" butonu gereksiz "Dersi Bitir" onay modalı açıyordu → direkt kaydediyor
11. Yoklama Raporu: tamamlanmış eski gruplar güncel aya hayalet saat ekliyordu (54 saat vs gerçek 24) + varsayılan aralık "bugüne kadar" değil "tüm ay" oldu
12. Core "Sınıflarım" kart görünümünde grup düzenleme butonu HİÇ yoktu (sadece gizli liste görünümünde vardı)
13. "Sil" gerçekten silmiyordu, sadece enrollment cancel ediyordu ("silindi" mesajı YANLIŞTI) → gerçek `deletePerson` + doğru mesaj (role.manage/admin ister)
14. Silinen öğrenci listede gecikmeli kalıyordu → optimistic anında kaldırma
15. Öğrenci Ekle grup dropdown'ı tamamlanmış eski grupları da listeliyordu → sadece aktif
16. Core öğrenci ekleme: telefon (KVKK) kaldırıldı, cinsiyet eklendi (istatistik için)
17. **Öğrenci otomatik giriş hesabı + aktivasyon maili YOKTU** — `provisionTrainerLogin` deseni öğrenciye uyarlandı (`provisionStudentLogin`, persons/route.ts) + enrollment `educationId` artık gruptan türetiliyor (eskiden boştu, "Eğitim: —" görünüyordu)
18. Öğrenci girişi yanlış (staff) sayfaya düşüyordu (`resolveLanding` "ogrenci" rolünü hiç tanımıyordu) + kişi silinince `flexos_users` kaydı öksüz kalıp yeniden-oluşturmada eski/ölü hesaba bağlanıyordu (`cleanupAuthAccount` düzeltildi)

**⚠️ SONUÇ — canlıya geçiş ERTELENDİ.** #18'i düzelttikten sonra kullanıcı öğrenci hesabıyla tekrar giriş denedi ve **"ciddi ciddi vahim hatalar var. Canlıdan hiç düzgün alınmamış. Eğitmen öğrenci bağlantısı çokkk eksikler var eksik sayfalar var. Durum iyi değil"** dedi — test PC'ye geçmeden hemen önce, ödev/dosya/yorum akışına girmeden durduruldu. **Kullanıcı henüz TAM DETAY vermedi** (hangi sayfalar eksik, ne bağlantı kopuk — spesifik değil). Detay: [[flexos_ogrenci_portali_eksik_2026_07_13]].

`tsc --noEmit` + `npm run build` her adımda temiz. Son commit: `ee6541a`.

**SIRADAKİ İŞ (PC'de, ACİL):** (1) Kullanıcıdan "durum iyi değil" dediği somut detayları al. (2) `/flexos/student/[personId]` + `/flexos/student/[personId]/[assignmentId]` sayfalarını hiçbir önceki iddiaya (ör. "Faz 3 canlıdan birebir port" notu) güvenmeden BAŞTAN oku/test et. (3) Canlıya geçiş kararını kullanıcı onayı olmadan verme.

---

### ✅ Kimlik-karışıklığı zinciri fix + Mod senkronu fix + Gerçek-zamanlı senkron (SSE) TÜM ana varlıklara (2026-07-11/12, uzun oturum)

**1) Sistemik `Group.trainerId` vs `actor.uid` kimlik-karışıklığı bulundu ve düzeltildi.** `Group.trainerId` (ve `Assignment.trainerId`) aslında `flexos_trainers` koleksiyonunun DOCID'sini taşıyor, Firebase Auth uid'ini DEĞİL — iki ayrı kimlik uzayı. Canlı Firestore verisiyle doğrulanan bu ayrım, ~10 dosyada (groups/persons/assignments/submissions route'ları, comment-service) eğitmen modunda Sınıflar/Öğrenciler/Ödevler/yorum-yazarı/bildirimlerin sessizce boş/yanlış görünmesine sebep oluyordu. Fix: `Actor.trainerId` alanı eklendi (`Trainer.authUid === actor.uid` ile çözülüyor), `ownerMatches()` helper'ı tüm self/assigned-scope sahiplik kontrollerinde kullanıldı. Düzeltirken kendi kendine bir güvenlik regresyonu da yakalanıp (sentinel `"__no_trainer_record__"` ile) düzeltildi — `actor.trainerId` undefined olduğunda filtre atlanıp TÜM tenant'ın sızmasına yol açabilirdi.

**2) 3'lü mod state-ayrışması fix.** Server Firestore + server in-process cache + client localStorage bağımsız bir şekilde Core/Full modunu takip ediyordu, owner bazen eğitmen modunda "sıkışıp kalıyordu". localStorage katmanı (`viewMode.ts`) tamamen silindi, tek doğru kaynak `GET /api/flexos/me`'nin döndürdüğü `mode` alanı oldu. Sidebar'a "Sistem Ayarları" linki her iki modda da erişilebilir hale getirildi (role.manage || view.toggle) — Full'a dönüş ayrı bir buton/switch OLARAK EKLENMEDİ (denenip kullanıcı tarafından reddedildi), PIN modalı üzerinden çalışıyor. `standaloneMode` sidebar'da artık gerçekten kontrol ediliyor (Satış/Aktivite Merkezi/Öğrenciler standalone'da gizleniyor).

**3) Sınıflar/Öğrenciler/Ödevler UI ve iş kuralı düzeltmeleri:** varsayılan grup filtresi "Aktif"; tamamlanan/arşivlenen gruplara öğrenci eklenemez/transfer edilemez (server+client çift kapı); grup "tamamlandı"ya alınınca enrollment'lar otomatik `completed`'a düşer (+ geçmiş veri için tek seferlik backfill); Ödev Teslimi'nde canlıdaki `AttachmentManager` (sürükle-bırak + dosya adı gösterimi, kart kapalıyken bile çalışan mavi glow border) birebir portlandı; Ödev Parkuru "Detay"/"Not Ver" artık doğru akordiyonu/ödevi otomatik açıp scroll ediyor.

**4) Prodüksiyon Firestore kota tükenme olayı + kökten çözüm.** Gece 02:00-09:00 arası (kullanıcı uyurken) günlük okuma kotası tükendi — kök neden: Eğitmen Ana Sayfa + Eğitim Operasyon Ana Sayfa'daki `setInterval` polling'i macOS ekran kilidinde durmuyordu (`visibilitychange` tetiklenmiyor), üstüne pahalı 6-koleksiyonlu `/api/flexos/groups` join'i bir pollinge eklenmişti. Kullanıcı "idle-detection" ve "5dk'ya çıkar" önerilerini reddedip kesin talimat verdi: polling TAMAMEN kalksın AMA gerçek zamanlı senkron kalsın, Firestore client erişimi AÇILMASIN, `firestore.rules` gevşetilmeSİN.

**Çözüm: Server-Sent Events, bellek-içi tek-instance pub/sub — TEK altyapı, TÜM ana varlıklar.** `src/app/lib/server/realtime-hub.ts` (`RealtimeEventType` union: groups/students/sales/grades/attendance/trainers/educations/activities `.changed`) → `src/app/api/flexos/realtime/stream/route.ts` (TEK SSE ucu) → `src/app/flexos/_shared/useRealtimeSync.ts` (TEK client hook, `(eventTypes, onChange)` imzası). ~20 mutasyon route'una `broadcast()` eklendi, ~18 ekrana hook bağlandı (Eğitmen/Operasyon Ana Sayfa, Sınıflar, Eğitmen Sınıflar, Sınıf Detay, Kullanıcılar, Öğrenci Havuzu, Satış Dashboard/Listesi, Yoklama Raporu/Al/Detay, Sertifikasyon Not/Ödev Notu, Eğitmenler, Eğitim Yönetimi, Aktivite Merkezi). Her ekran kendi var olan `loadXxx` fonksiyonunu callback olarak geçiyor — ayrı fetch/cache katmanı yok. Detay + bilinçli sınırlar: proje hafızası `flexos_groups_realtime_sse_2026_07_11`.

`tsc --noEmit` + `npm run build` + 395/395 assertion temiz.

**SIRADAKİ İŞ (kod YOK):** Bu oturumda dokunulmayan/ertelenen: "Eğitmen Tek Başına" standalone modunda Kullanıcılar/Eğitimler'in sadeleştirilmiş tasarımı (ayrı oturum gerekiyor), Finans modülü (sıfır kod), Randevu Takvimi (placeholder), Şube Aşama-2 (başlamadı). Ayrıca: mevcut 39 "closed" durumundaki backfilled ödevin statüsü hakkında (bulk-değişim yapılsın mı) hiç karar verilmedi.

### ✅ Eğitmen Onboarding Otomasyonu + Kullanıcılar Düzeltmeleri + Sınıf Detay Sayfası (2026-07-10, ikinci canlı-test oturumu, aynı gün)

Bir önceki girdideki test oturumunun devamı — kullanıcı kendi hesabıyla + "Eda Yılmaz"/Eğitim Koordinatörü hesabıyla gerçek tarayıcı testine devam etti, çok sayıda gerçek bug/eksik bulunup aynı oturumda kapatıldı.

**1) Eğitmen onboarding UÇTAN UCA otomatikleşti.** `POST /api/flexos/trainers` artık trainer roster kaydının yanında (e-posta zaten bir hesaba bağlı değilse) otomatik Firebase Auth hesabı + `flexos_users` (rol: egitmen) + aktivasyon kodu maili oluşturuyor (`Trainer.authUid` linki, `users/[id]/resend-code` route'u da eklendi — kod kaybolursa yeniden gönderim). Zaten kayıtlı e-postaysa (owner dahil) DOKUNMUYOR. Önceden bu akış hiç yoktu; Kullanıcı Ekle'den "egitmen" rolü seçilse bile `resolveFlexosUserGrants` onu bilerek dışlıyordu (gerçek yetki hiç gelmiyordu) — yeni akış gerçek `instructor` custom claim'i set ederek bunu çözdü (admin claim'i olan hesap ASLA düşürülmez).

**2) Kullanıcılar sayfası — owner-only "Admin" görünürlüğü + gerçek aktivasyon durumu.** Personel tablosunda SADECE sistem sahibi kendi satırında "Admin" rozeti görür (kimse göremez, `GET /api/flexos/users` server-side filtreli); "Beklemede" (henüz `emailVerified:false`) rozeti artık gerçek Firebase Auth durumundan türetiliyor. Sekme çubuğu artık "Kullanıcı Ekle" ile aynı satırda; tekrarlayan "N personel" chip'i kaldırıldı.

**3) Sistem Ayarları sayfası kuruldu** (`/flexos/sistem-ayarlari`, sidebar linki artık gerçek) — Sistem Modu/Grup Taşıma Kuralı/Kişisel PIN Kullanıcılar'dan buraya taşındı, 2 sekme (**Genel Ayarlar** + **Loglar** placeholder). "Ana Sayfa" routing sistem sahibi için artık placeholder yerine gerçek Eğitmen Ana Sayfa'ya gidiyor.

**4) Sidebar "Eğitmenler" linki GERİ GELDİ.** Sabah Kullanıcılar sekmesine konsolide edilip kaldırılmıştı, kullanıcı sert tepki verdi ("ben adminim, görmem lazım her şeyi") — artık HEM bağımsız sidebar linki (tam CRUD sayfa) HEM Kullanıcılar'daki özet sekmesi bir arada. Ders: [[feedback-admin-full-nav-visibility]] (yeni memory).

**5) YENİ SAYFA: Sınıf Detay tam sayfa** (`/flexos/siniflar/[id]`) — kullanıcı Claude Design'da çizip verdi, "yandan açılan sheet değil, sınıfa bas ve detaylar gelsin" kararıyla. `GroupTable.tsx` satır tıklaması artık buraya yönlendiriyor (eski `RosterDrawer` bu akıştan kaldırıldı). Hero+bilgi kartları+kapasite şeridi+öğrenci tablosu (gerçek roster+Devam% yoklama kayıtlarından hesaplanıyor). Mockup'tan bilerek sapılan yerler: branş rengi tamamen kaldırıldı (sabit mavi — pembe/magenta "kırmızı" gibi algılanıyordu), "Öğrenci Ekle" sıfırdan kişi formu değil arama+seç (grupsuz + aynı eğitime ait adaylar, gerçek "Gruba Ata" ucu), "Öğrenciyi Düzenle" sayfadan hiç ayrılmadan inline modal (önce Öğrenci Havuzu'na yönlendirip orada sheet açıyordu, "saçma" bulundu).

**Roster aksiyon semantiği netleşti (ÖNEMLİ düzeltme):** Grup Değiştir = gerçek `transferEnrollment` (closeAs zorunlu). **YENİ: Mezun Et** (`setEnrollmentStatus`, backend zaten vardı UI yoktu) — hedef grup istemez, grup devam ederken TEK öğrencinin kaydı kapanır, yoklama/ödev dağıtımı otomatik düşer (`active` filtreli). **"Sınıftan Çıkar" (X) DÜZELTME: hard-delete DEĞİL** — `removeFromGroup` sadece `status:"cancelled"` yazar, Firestore dokümanı silinmez (önceki oturumda yanlış anlatılmıştı). Otomatik mezuniyet YOK — ders/seans bitiş tarihi geçse bile hiçbir cron/otomatik mekanizma `Enrollment.status`'ü değiştirmiyor, SADECE insan aksiyonu. Detay: [[project-sinif-detay-page]] (yeni memory).

**6) UX/CSS düzeltmeleri (küçük ama çok sayıda):** Eğitmenler tablosundaki hover popup'lar (`overflow:hidden` içinde sıkışıyordu) → `createPortal`+`position:fixed`. Sınıflar "Grup Ekle" bottom-sheet sabit `height` (içerik büyüyünce zıplamasın). Sidebar'daki 7 akordiyon artık birbirini kapatıyor. Öğrenci Havuzu'nda filtre-dropdown ile satır-aksiyon-menüsü birbirini kapatıyor. Sınıflar tablosunda en soldaki nokta artık DURUM rengi (branş rengi "Eğitim" sütununa taşındı, kare şeklinde — daire=durum/kare=branş asla karışmasın). Sınıflar tablosu satır yüksekliği artırıldı (12px→18px padding, "basık" duruyordu). **Yeni kural: öğrencisi olmayan grup başlatılamaz** (`updateGroupStatus` server + `GroupTable.tsx` client, çift kapı).

**7) Test verisi + gerçek uçtan-uca doğrulama:** GRP-550'deki (Grafik-1) 9 öğrencinin eski seed-script'ten (`backfill-grades-assignments.mjs`) kalma `status:"completed"`si "active"e resetlendi. Kullanıcı GERÇEK Grup Değiştir akışıyla **4 öğrenciyi GRP-550'den GRP-784'e (Grafik-2) başarıyla taşıdı** (closeAs=completed/Mezun) — transfer akışı canlı test edilip DOĞRULANDI.

**8) Local dev:** `.env.local`'a `NEXT_PUBLIC_APP_URL=http://localhost:3000` eklendi (PC'ye özel, senkronize olmaz, Mac'te ayrı ayarlanmalı) — aktivasyon/şifre mailleri artık Vercel değil localhost'a linkliyor.

`tsc --noEmit` + `npm run build` her adımda temiz.

**SIRADAKİ İŞ (kod YOK):** Satıştan grupsuz gelen öğrenciler için Eğitim Op'a otomatik bildirim fikri konuşuldu (henüz karar yok, kapsam: basit "gruba atanmayı bekliyor" bildirimi mi, akıllı gün/seans önerisi de mi olsun). Tekil enrollment için gerçek hard-delete ucu hâlâ yok (sadece `deletePerson` cascade seviyesinde var) — istenirse ayrı iş.

### ✅ Öğrenci Havuzu çoklu-branş Gruba Ata + zaman çakışması + Kullanıcı yetki düzeltmeleri (2026-07-10, canlıya-öncesi test oturumu)

Bugün "canlıya almak için engel kalmamalı" hedefiyle gerçek test oturumu başladı (bkz. aşağıdaki **Test Kontrol Listesi**). Test sırasında bulunan 2 gerçek engel + 1 tasarım boşluğu kapatıldı:

**1) Gruba Ata artık kişinin TÜM grupsuz kayıtlarını tek düz listede gösteriyor** — önceden `persons` API sadece "ilk" grupsuz enrollment'ı (`assignableEnrollmentId`, tekil) dönüyordu; 3'lü paket satışı (Grafik Tasarım + Dijital Pazarlama + Video gibi) aynı anda 3 grupsuz enrollment açtığında ikisi görünmez kalıyordu. `assignableEnrollments` (liste) oldu. Bölümlü (sectioned) eğitimde Gruba Ata artık SADECE ilk bölümün (Grafik-1) gruplarını gösteriyor — ikinci bölüme geçiş hâlâ sadece Grup Değiştir'le. **Zaman çakışması kontrolü** eklendi: kişinin başka aktif bir grubuyla gün/saat çakışan aday hem Gruba Ata'da hem Grup Değiştir'de disabled+tooltip — hem client hem server (`enrollment-service.ts::schedulesOverlap`, `assignToGroup`/`transferEnrollment` içine gömülü `ValidationError`) taraflı, boş `schedule.days` (backfill) çakışma YOK sayılıyor (kullanıcı kararı). Yeni `scripts/assert-schedule-conflict.ts` (10 assertion). Grup Değiştir'in hedef grup etiketi artık Bölüm adını (sectionName) önceliklendiriyor.

**2) Kullanıcı oluşturma — canlı ile paylaşılan Firebase Auth çakışması düzeltildi.** Test sırasında ortaya çıktı: FlexOS ve canlı sistem AYNI Firebase Auth projesini paylaşıyor; bir e-posta canlıda zaten kayıtlıysa (öğrenci/eğitmen) `POST /api/flexos/users` `auth/email-already-exists` ile tamamen tıkanıyordu — gerçek ofis personeli onboarding'inde de aynı şekilde tıkanacaktı. Artık e-posta zaten Auth hesabına sahipse MEVCUT uid yeniden kullanılıyor (instructor backfill presedanıyla aynı additive mantık), `findByAuthUid` ile zaten bir flexos_users'a bağlıysa reddediliyor. Kritik yan düzeltme: Firestore hatasında rollback artık SADECE biz yeni açtıysak Auth hesabını siliyor (mevcut/canlı bir hesabı asla silmiyor).

**3) Yetki modeli granülerleştirildi** (Eğitim Koordinatörü testinde bulunan 3 sorun): (a) "Öğrenciler" sidebar linki `sale.read`'e bağlıydı (yanlış — Eğitim Koordinatörü'nün satış modülü yok), artık `person.read`. (b) "Ödevler" sidebar'ı Eğitim Koordinatörü'nde de görünüyordu çünkü ödev/teslim/yoklama-ALMA capability'leri "Sınıf/Grup" (`sinif`) modülüne bilerek konmuştu (2026-07-08 kararı) — artık `PERM_MODULE_CAPABILITIES.sinif`'ten çıkarıldı, SADECE gerçek Eğitmen rolünün kendi ayrı paketinde kalıyor (ofis rolleri artık grup CRUD + yoklama RAPORU görür, yoklama ALMA/ödev yönetimi göremez). (c) "Satış" tek modülü **4 ayrı modüle** bölündü (`satis_yap`/`satis_liste`/`paket_yonetimi`/`kampanya_yonetimi`, her biri Kullanıcı Ayarları'nda ayrı kutucuk + sidebar'da ayrı gated) — kullanıcı kararı: "her alt menü ayrı ayrı yetkilendirilebilir olmalı". "Aktivite Merkezi" kendi paylaşımlı modülüne (`aktivite`) taşındı — Satış'a özel değil, Satış+Eğitim Op+Finans ortak kullanır. `BUILT_IN_ROLE_SEEDS` buna göre güncellendi (Eğitim Koordinatörü: +satis_liste +aktivite; Satış Temsilcisi/Finans: satis→4 parçaya bölündü +aktivite).

**⚠️ KRİTİK — manuel adım gerekiyor:** `RoleDef` Firestore'da SADECE ilk okumada (koleksiyon boşsa) tohumlanıyor, kod değişince otomatik güncellenmiyor (`listRoleDefs`). Yani BUILT_IN_ROLE_SEEDS'teki bu değişiklikler zaten oluşturulmuş rol kayıtlarına YANSIMADI: **Kullanıcı Ayarları'na girip Eğitim Koordinatörü'ne "Satış Listesi"+"Aktivite Merkezi" kutucuklarını, Satış Temsilcisi/Finans'a yeni 4 satış kutucuğunu elle işaretlemek gerekiyor** — yoksa bu rollerdeki gerçek kullanıcılar (özellikle Satış Temsilcisi/Finans, eski tekil "satis" anahtarı artık öksüz) satış yetkilerini sessizce kaybeder.

`tsc --noEmit` + `npm run build` + 17 assertion scripti (0 hata) temiz.

**Bilinen ama BUG OLMAYAN bulgu:** Aynı tarayıcının farklı sekmelerinde farklı hesap test edilirse ("Alparslan" + "Eda Yılmaz" aynı anda) `onSnapshot` listener'ları (canlı `users/{uid}` dinleyen `UserContext`/`useNotifications`) Firebase Auth'un `localStorage` paylaşımı yüzünden geçici "Missing or insufficient permissions" console hatası basabiliyor — zaten yakalanmış (`console.error`), Next.js 16 dev overlay bunu bile kırmızı ekran gösteriyor. Production'da bu overlay hiç çıkmaz. Çözüm: çoklu hesap testi ayrı incognito pencerelerde yapılmalı.

**✅ TAMAMLANDI (aynı gün, sonraki oturumda):** Kullanıcılar sayfası 3 sekmeli oldu: Personel (`role.manage`) / Eğitmenler (`trainer.read`, hafif özet + "Eğitmen Kadrosu'na Git") / Öğrenciler (`person.read`, gerçek `/api/flexos/persons`'a bağlı — `DUMMY_STUDENTS` kaldırıldı). Sidebar'da bağımsız "Eğitmenler" linki PLANLANDIĞI GİBİ kaldırılmadı — aynı oturumda kullanıcı "ben adminim, görmem lazım her şeyi" diyerek geri istedi (bkz. yukarıdaki "Sidebar Eğitmenler linki GERİ GELDİ" notu), o yüzden HEM bağımsız link HEM Kullanıcılar'daki özet sekme bir arada duruyor. Kod: `kullanicilar/page.tsx` + `FlexSidebar.tsx`.

**Test Kontrol Listesi (canlıya çıkış öncesi, bu oturumun TaskList'inde #7-#27 — repo'da PERSIST OLMUYOR, bilgi kaybolmasın diye burada özetleniyor):**
- Yetki/Hesap: kullanıcı oluşturma+aktivasyon maili (✅ bug bulundu+düzeltildi, uçtan uca tarayıcı testi YARIM — Eda Yılmaz oluşturuldu, aktivasyon linkine tıklanmadı), aktivasyon sayfası, şifremi unuttum, rol bazlı login yönlendirme, gerçek capability bağlama (✅ 3 sorun bulundu+düzeltildi, granüler modül testi PC'de devam), kullanıcı sil→Firebase hesabı silme, Kullanıcı Ayarları gerçek etkisi — HEPSİ hâlâ test edilecek.
- Öğrenci Havuzu: Gruba Ata çoklu-branş + ilk-bölüm filtresi + zaman çakışması (✅ kod bitti, tarayıcı testi YOK), Grup Değiştir 3-nokta menü, Grup sil cascade-unassign, sidebar Sistem Ayarları/Çıkış.
- Ödev+Not: 3-nokta menüler, dosya yükleme, Revize İste/Onayla+bildirim, otomatik not hesabı, kilit mimarisi — hiçbiri test edilmedi.
- Oyunlaştırılmış (Reklam Tasarımı) + Backfill spot-check — test edilmedi.

**Ayrıca not:** Alparslan'ın (tek gerçek eğitmen) `flexos_users`'da "Eğitmen" rolü var ama `Trainer` roster'ında (Eğitmen Kadrosu, `/flexos/egitmenler`) HİÇ kaydı yok — backfill script'i bunu hiç oluşturmadı, bu iki koleksiyon kasıtlı olarak ayrı (bkz. FLEXOS.md'de "Eğitmen Kadrosu ile 'ben eğitmenim' rolü farklı kavramlar"). Kendine manuel bir Eğitmen Kadrosu kaydı açması gerekebilir (grup ataması/eğitmen listesi testleri için).

---
> Branch: `flexos` · Canlı `main` ETKİLENMİYOR · yeni koleksiyonlar (`persons`/`enrollments`), eskilere yazılmıyor.

### ✅ Grup Transferi + Ek Satış Kuralı BİTTİ (2026-07-10, kullanıcı diyaloğuyla 2 kez düzeltildi)

Bir önceki girdideki "SIRADAKİ İŞ" tamamlandı. **İlk implementasyon YANLIŞTI** (tek enrollment'ı mutasyona uğratıp `groupId`'sini değiştiriyordu) — kullanıcı canlı test senaryosunu (Grup 550/Grafik-1 bitti → Grup 784/Grafik-2'ye ek satışla geçiş) anlatınca 2 kritik düzeltme geldi:

1. **"Taşıma" = ek satış = YENİ KAYIT, tek kaydın mutasyonu DEĞİL.** Kullanıcı: "Grup taşınırsa o öğrenciye sistem ek satış yapar 0tl. Yani yeni kayıt yapar." Sebep: Grafik Tasarım gibi bölümlü eğitimlerde her bölümün (Grafik-1/Grafik-2) KENDİ ayrı yoklama+sertifikası var — tek paket satışı olsa da. Tek kaydı taşımak iki bölümün geçmişini aynı dokümanda karıştırırdı.
2. **Eski kaydın kapanış durumu (`completed` mi `cancelled` mi) SİSTEM TARAFINDAN TAHMİN EDİLEMEZ, kullanıcı seçer.** Kullanıcı istisnası: "Eğer öğrencinin grubu tamamlanmadan grubun ortasında başka sınıfa başka sebepten geçerse mezun statüsüne geçmez ama eski grubundaki o ana kadarki yoklama vb. aktiviteleri eski grubunda aynen durur." Yani modül GERÇEKTEN bittiyse (`completed`/mezun) vs. sadece sınıf değişikliği (henüz bitmedi, `cancelled`, mezun SAYILMAZ) — ikisi de aynı mekanizma ama farklı sonuç durumu, seçim taşımayı yapan kişiye ait.

**Sonuç mimari:** `enrollment-service.ts::transferEnrollment(actor, {enrollmentId, toGroupId, closeAs:"completed"|"cancelled"}, deps)` — eski kaydı OLDUĞU GİBİ bırakır (id/groupId değişmez, `closeAs`'e göre `completed`/`cancelled` olarak KAPANIR), YENİ bir Enrollment açar (hedef grupta `active`, yeni Sale'e `saleId` ile bağlı — normal satış dikişiyle birebir aynı). İkisi `Enrollment.continuedAsEnrollmentId` (eski→yeni) / `continuesFromEnrollmentId` (yeni→eski) ile zincirlenir; `transferHistory` (from/to/at/by) eski kayıtta audit izi olarak kalır. Kapanmış (completed/cancelled) bir kaydı TEKRAR taşımaya çalışmak reddedilir — zincirin en son (aktif) halkası hedeflenmeli.

**Yetki/switch değişmedi:** `flexos_settings.transferRequiresManualSale` (varsayılan `false`) — kapalıyken `enrollment.transfer` yeter (Eğitim Op doğrudan taşır, sistem arkada 0 TL `Sale{type:"transfer"}` sessizce açar, actor'ın `sale.create`'e sahip olması GEREKMEZ); açıkken `enrollment.transfer` YETMEZ, `sale.create` gerekir (sadece Satış taşıyabilir). `settings-service.ts` READ-MERGE-WRITE (iki switch aynı dokümanı paylaşıyor, biri diğerini sessizce sıfırlamasın diye).

**Route + persons API:** `POST /api/flexos/enrollments/[id]/transfer` body `{toGroupId, closeAs}` (closeAs ZORUNLU, yoksa 400). `persons` route'undaki `groupList`'e `enrollmentId` eklendi (frontend'in hangi enrollment'ı hedefleyeceğini bilmesi için).

**Frontend:** Öğrenci Havuzu Grup sütununa "Grup Değiştir" ikon-butonu (tekil chip + çoklu-grup popup'ın her satırı) — popup'ta hover-gap flicker bug'ı da düzeltildi (wrapper'a görünmez `paddingBottom` bridge, gap artık elemanın kendi kutusunun parçası). Modal: hedef grup seçimi + **"Eski kayıt nasıl kapansın?"** ikili seçim (Mezun / Sadece sınıf değişikliği) — ikisi de seçilmeden "Gruba Taşı" aktifleşmiyor. Kullanıcılar sayfasına "Grup Taşıma Kuralı" switch kartı eklendi (`standaloneMode` kartıyla yan yana, grid 2→3 sütun, doğrudan toggle). **Sistem Ayarları ayrı sayfa olarak KURULMADI** — switch `standaloneMode` presedanını izleyerek Kullanıcılar sayfasında yaşıyor.

**Test:** `scripts/assert-transfer.ts` (31 assertion) — mutasyon YOK doğrulaması, closeAs completed/cancelled/geçersiz, zincir bağları (continuedAsEnrollmentId/continuesFromEnrollmentId), 3 halkalı zincir taşıma, kapanmış kaydı tekrar taşıma reddi, capability/switch ayrımı, validasyonlar, standalone eğitmen ownerUid ayrımı. `tsc --noEmit` + `npm run build` temiz, mevcut takım (standalone-mode, enrollment-status) regresyonsuz yeşil. **Tarayıcıda test edilmedi** (bu oturumda authenticated session yoktu) — kullanıcı PC'de gerçek Grup 550→784 senaryosuyla test edecek.

### ✅ Grup sil = cascade-unassign + Dummy veri temizliği + Sidebar Sistem Ayarları/Çıkış (2026-07-09)

- **Grup sil davranışı düzeltildi** (`group-service.ts::deleteGroup`) — önceden gruptaki aktif kayıtlar varsa `ValidationError` ile silmeyi tamamen reddediyordu (frontend'deki uyarı modalı "öğrenciler grupsuz duruma düşer" diyordu ama backend bunu hiç yapmıyordu, tutarsızlık). Şimdi gerçekten söylediğini yapıyor: gruptaki tüm kayıtların `groupId`'si boşaltılır (kayıt/durum SİLİNMEZ, sadece grupsuz havuza düşer), sonra grup silinir. Hiçbir geçmiş-grup izi yazılmaz (kullanıcı kararı: ders/kayıt hiç yapılmamış bir grupta yazılacak anlamlı bir geçmiş yok — `transferHistory` alanına DOKUNULMADI, bkz aşağıdaki parkedilmiş transfer kararı). Route yorumu (`api/flexos/groups/[id]/route.ts`) güncellendi. `tsc` temiz.
- **Dummy veri temizliği YAPILDI** — Firestore inventory'si `createdBy` alanına göre çıkarılıp (seed-script / backfill-script / backfill-grades-script / gerçek kullanıcı uid) gerçek/test ayrımı netleştirildi, kullanıcı onayıyla ~194 test dokümanı silindi (63 persons, 16 enrollments, 4 test flexos_groups [Grup 888 DAHİL DEĞİL — o gerçek], flexos_sales/payments/cases/activities/appointments TAMAMEN boşaltıldı [hepsi testti], 4 test flexos_educations, eski bağlantısız `flexos_prospects` mock'u [14] silindi). Kalan: 28 person, 42 enrollment, 6 grup (541/550/598/888 + 2 tarihi Grafik1), grades/assignments/submissions backfill'i, gerçek 3 branş/2 eğitim katalog — hepsi doğrulandı gerçek. Kullanıcı: "gerçek testlere başlayacağım, sistem canlıdan getirdiğim öğrenciler hariç temiz olmalı."
- **Sidebar: Sistem Ayarları + gerçek Çıkış eklendi** (`FlexSidebar.tsx`) — canlıdaki "Yönetim Paneli + Çıkış" deseniyle birebir: sol altta admin-only ("role.manage" cap) tek link "Sistem Ayarları" (sayfası HENÜZ YOK, tıklayınca "yakında" toast) + ayraç + gerçek **Çıkış** (`signOut(auth)` + `/flexos/giris`'e yönlendirme — önceden FlexSidebar'da HİÇ logout yoktu, eksiklik fark edilip kapatıldı).

**SIRADAKİ İŞ (kullanıcı onayladı, kod YOK — kapsam soruları netleşmedi):** Grup transferi + ek satış kuralı. Canlıda öğrenci başka gruba taşınırken (kendi talebiyle veya modül geçişinde) Satış 0 TL'lik bir "ek satış" kaydı açıyordu — güvenli ama yavaş. FlexOS'ta Sistem Ayarları'na bir switch gelecek: **varsayılan (switch kapalı)** Eğitim Operasyon yöneticisi öğrenciyi direkt taşırsa sistem arkada otomatik 0 TL ek satış kaydı oluşturup izin verir (taşıma hızlanır); **switch açık** (başka şirketler için) öğrenci taşıma MUTLAKA manuel bir ek satış işlemiyle (Satış departmanı üzerinden) yapılmalı. Mimari zaten hazır ama bağlanmamış: `Sale.type` içinde `"transfer"` değeri var, `enrollment.transfer` capability kayıtlı (`access/registry.ts`, "Grup Değiştir") ama servis fonksiyonu hiç yazılmamış, `Enrollment.transferHistory` alanı tanımlı ama kullanılmıyor — bu, eski parkedilmiş "Grup Değişimi = Yeni Satış" kararının (bkz proje hafızası `project_group_change_sale`) somut karşılığı. Şu an öğrenciyi bir gruptan başka bir gruba GERÇEKTEN taşıyan bir UI/aksiyon da yok (`assignToGroup` sadece grupsuz kayıtlar için çalışıyor). Açık kapsam soruları: (1) taşıma UI'ı bu işin parçası mı; (2) Sistem Ayarları sayfası hiç kurulmadı — minimal ayar altyapısı mı kurulacak yoksa şimdilik hardcode default mı, switch UI'ı sonraya mı bırakılacak. Detay: proje hafızası `project_transfer_ek_satis_kural`.

### ✅ Backfill (canlı → FlexOS) YAPILDI — `scripts/backfill-live-to-flexos.mjs` (2026-07-08, 4. oturum)

Tek gerçek eğitmen kullanıcı (Alparslan Şentürk), başka gerçek eğitmen yok → sahiplik ayrımı sorunu olmadan TÜM canlı veri taşındı (kapsam: tüm geçmiş, sadece aktif değil). Script idempotent (id'ler canlıdan deterministik korunur), sadece OKUR canlı `students`/`groups`/`branches`'tan, hiç yazmaz. `--dry-run` bayrağı var.

- **`flexos_users`**: Kendi kaydı oluşturuldu — YENİ Firebase Auth hesabı AÇILMADI, mevcut uid (`kYG8N01PTudh1VT1uvy2vg8vmAR2`) yeniden kullanıldı. Rol: **sadece "Eğitmen"** — "Genel Müdür" gibi yeni-sistem rolü BİLİNÇLİ OLARAK eklenmedi, çünkü admin erişimi zaten eski canlı-claim'den (`users/{uid}.roles:["admin","instructor"]`) geliyor, additive tasarım gereği yeni sistem ona dokunmuyor.
- **`flexos_groups`**: 4 grup taşındı. `branch` = canlı `branches` lookup'tan isim (denormalize string, katalog bağlama YOK — `educationId`/`sectionId`/`trackId` boş, Group modeli bunları optional tutuyor). `trainerId` = canlı `instructorId` aynen taşındı. `schedule.days` HER ZAMAN `[]` (canlıda yapılandırılmış gün verisi yok, bilinen sınır).
- **`persons` + `enrollments`**: 28 öğrenci taşındı (3'ü grupsuz — canlıda `groupId:"unassigned"` sentinel'i tespit edilip grupsuz sayıldı). `pii` sadece `email` dolu (TC/telefon/adres canlıda hiç yok, fabrikasyon YAPILMADI). `saleId`/`result` boş (satış/final not verisi yok). Kişi başı tek enrollment (canlı modelde çoklu enrollment kavramı yok), enrollment id = person id (deterministik).

**Doğrulandı:** `--dry-run` + gerçek çalıştırma sonrası birkaç `flexos_users`/`flexos_groups`/`persons`/`enrollments` dokümanı manuel kontrol edildi, alanlar beklendiği gibi.

### ✅ Gerçek hesap/aktivasyon akışı + Gerçek yetki bağlama BİTTİ (2026-07-08, aynı gün, 3. oturum)

Bir önceki girdideki "ÖNEMLİ AÇIK NOKTA"nın HER İKİ ön koşulu da bugün kapandı — roller/yetkiler artık gerçekten çalışıyor (kod tamam, TARAYICI TESTİ HENÜZ YAPILMADI — kullanıcı: "testi toplu olarak yapacağım, canlıya almadan önce").

**1) Gerçek hesap + aktivasyon (canlıdan UI birebir port):** `POST /api/flexos/users` artık gerçek Firebase Auth hesabı açıyor (`authUid` set edilir), `flexos_codes` koleksiyonuna (canlı `codes`'a hiç dokunmadan, ayrı) aktivasyon kodu yazıp maili OTOMATİK gönderiyor (Brevo, mevcut env). Kullanıcı kararı: "ben asla göndermiyorum, otomatik gidiyor zaten" — canlıdaki 2 aşamalı (oluştur→ayrıca gönder) akış BİLEREK tek adıma indirildi; manuel "tekrar gönder" (sorunlu durumlar için) ayrı, henüz yapılmamış iş. 3 yeni sayfa UI birebir: `/flexos/giris`, `/flexos/giris/aktivasyon` (kod-bazlı ilk aktivasyon + oobCode-bazlı şifre sıfırlama TEK sayfada — canlıda 2 ayrı sayfaydı), `/flexos/giris/sifremi-unuttum`. Yeni route'lar: `POST /api/flexos/activation/verify`, `POST /api/flexos/password-reset` (canlının birebir mantığı, ayrı koleksiyonlar). Kullanıcı silme artık Firebase hesabını da siliyor (önceden öksüz kalıyordu) + "kendi hesabını silemezsin" kontrolündeki eski bug (`doc.id===actor.uid` — asla eşleşmeyen bir karşılaştırmaydı) `authUid` üzerinden düzeltildi. **3 dashboard var, login sonrası role göre doğru olana yönlendirme:** `GET /api/flexos/me` artık `landing` alanı da dönüyor (`egitmen`→Eğitmen Ana Sayfa, `egitim_koordinatoru`→Eğitim Operasyon Ana Sayfa, diğerleri→`/flexos/anasayfa` genel placeholder) — `FlexosUserRepo.findByAuthUid` yeni eklendi.

**2) Gerçek yetki bağlama:** Yeni `access/perm-module-capabilities.ts` — 9 yetki modülünü (kisi/kayit/sinif/not/satis/odeme/egitmen/katalog/sistem) mevcut `packages.ts`'teki kanıtlanmış capability gruplamasından türeterek gerçek capability+scope'a (hepsi "org" scope) bağlıyor. Bilinçli karar: **Yoklama+Ödev capability'leri "Sınıf/Grup" modülüne kondu** (modül açıklamasında açıkça yazmıyordu, karar verilmesi gerekti — istenirse kolayca taşınır). **"egitmen" ROLÜ bu tabloyu KULLANMAZ** — kendi ayrı, kanıtlanmış paketi var (`ROLE_PACKAGES.egitmen`, assigned/self scope); "Eğitmen Kadrosu" MODÜLÜ (CRUD+ücret, Eğitim Koordinatörü'nün sahip olacağı şey) ile "ben eğitmenim" ROLÜ farklı kavramlar. `auth-actor.ts::actorFromCaller` artık **async** — `flexos_users`'ı `authUid` ile bulup rollerinin `RoleDef.permModules`'unu + `permOverrides`'ını okuyup gerçek grant'lere çeviriyor (`resolveFlexosUserGrants`). **116 çağrı noktası (69 dosya)** `await`'e geçirildi (sed+perl ile toplu, tsc'nin hata verdiği her yeri tek tek doğrulayarak — 0 kaçak). Eski canlı-claim'li hesaplar (`isAdmin`/`instructor`) hiç `flexos_users` kaydına sahip olmadığından yeni sistem onlara dokunmuyor, iki sistem ek kod gerektirmeden yan yana duruyor (additive tasarım). **Bilinen sınır:** biri hem "egitmen" hem ofis rolüne sahipse ikisi TEK actor'da birleşmiyor (eğitmen tarafı hep eski yoldan geliyor) — nadir senaryo, ertelendi. Firestore rules'a `flexos_users`/`flexos_role_defs`/`flexos_codes` için eksik olan server-only satırları eklendi (davranış değişmedi, sadece tutarlılık — varsayılan zaten reddediyordu).

**Hâlâ eksik/açık:** `.env.local`'de `NEXT_PUBLIC_APP_URL` yoktu (yerelde mail linkleri yanlış domaine gider) — kullanıcıya söylendi, eklenip eklenmediği teyit edilmedi. Sistem Ayarları/Backup/Log — hâlâ sadece plan.

### ✅ Kullanıcı Ayarları (Rol Tanımları) BİTTİ + Satış hibrit teslim şekli fix (2026-07-08, aynı gün, ayrı oturum — bu commit)

Kullanıcı: "Sabit roller olacak evet ama istenirse değişebilir yetkiler dedim, bunu sen de biliyorsun" — mimari yeniden hatırlatıldı (yeni karar değil). Sonuç: rol tanımları artık Firestore'da, sabit kod değil.

**Backend (yeni):** `RoleDef` domain tipi (`core/role-def.ts`) + `RoleDefRepo` portu + Firestore adapter (`flexos_role_defs` koleksiyonu) + `role-def-service.ts` (`listRoleDefs` ilk çağrıda 6 yerleşik rolü otomatik tohumlar, `createRoleDef`/`updateRoleDef` — yerleşik rollerde ad değişmez ama `permModules` değişir). Yetki modülleri kataloğu (`access/perm-modules.ts`, 9 modül: kisi/kayit/sinif/not/satis/odeme/egitmen/katalog/sistem) SABİT ürün yeteneği ama hangi rolün hangisini varsayılan aldığı artık veri. Routes: `GET/POST /api/flexos/role-defs`, `PATCH /api/flexos/role-defs/[id]`.

**Frontend (yeni):** `/flexos/kullanicilar/ayarlar` sayfası — rol listesi + "Rol Ekle" + her rolün 9 yetkisini aç/kapa. Sidebar "Kullanıcılar" tek link'ten akordiyona çevrildi (Kullanıcı Listesi + Kullanıcı Ayarları).

**Refactor:** `kullanicilar/ekle` + `kullanicilar/[id]/duzenle` + `kullanicilar/page.tsx` (liste) artık `useRoleDefs()` hook'uyla backend'den okuyor — 3 yerde ayrı ayrı kopyalanmış `ROLE_META`/`ROLE_DEFAULT_PERMS`/`CREATABLE_ROLES` kaldırıldı. `flexos-user-service.ts::validateRoles` artık gerçek RoleDef listesine karşı doğruluyor (`FlexosUserRole` tipi sabit union'dan `string`'e gevşetildi — sadece 3 dosyada kullanılıyordu, blast radius küçüktü). Rol seçimi UI'ı yan yana chip'ten (rol sayısı artınca sığmıyordu) **dropdown + checkbox** bileşenine geçti (`kullanicilar/_shared/RoleMultiSelect.tsx`) — seçilenler altta kaldırılabilir etiket olarak görünür. Ünvan+Rol yan yana. `scrollbarGutter:"stable"` ile sekme geçişinde scrollbar çıkınca içeriğin sola kaymasını (4 sayfada) düzelttik.

**ÖNEMLİ AÇIK NOKTA (kasıtlı, iletildi):** Bu roller/permModule'lar HÂLÂ gerçek `can()` yetki kontrolüne bağlı DEĞİL — sadece veri/görsel katman. Gerçek bağlama için iki ön koşul netleşti: (1) `flexos_users` kayıtlarının bugün gerçek Firebase Auth hesabı yok (`createFlexosUser` sadece Firestore doc yazıyor, hesap/aktivasyon akışı YOK) — önce bu kurulmalı; (2) `auth-actor.ts::actorFromCaller` senkron ve 50+ yerde çağrılıyor, gerçek bağlama async'e geçmeyi gerektirir (ayrı, riskli refactor). Kullanıcı: "yetki bağlamayı sen yapınca ben birkaç farklı mail hesabından fake kullanıcı oluşturup test edeceğim" — yani bu iş SIRADA ama önce hesap-bağlama.

**Satış Yap hibrit teslim şekli fix:** `Education.deliveryMode==="hybrid"` + `deliveryOptions` (yüz yüze/online ayrı fiyat) domain'de vardı, Satış Yap hiç okumuyordu — hep düz `listPrice` kullanılıyordu. Artık Full Paket satışında (Track Bazlı hariç — kapsam dışı, tracklerin kendi teslim fiyatı yok) "Teslim Şekli" (Yüz Yüze/Online) seçici var, fiyat seçime göre `deliveryOptions`'dan geliyor.

**SADECE TARTIŞMA/PLAN (kod YOK, çok uzun bir görüşme) — Mac'te devam edilirse buradan hatırlanmalı:** "Sistem Ayarları" / süper admin fikri konuşuldu, detay için bkz. bu oturumun PC tarafındaki hafıza dosyası (`project_sistem_ayarlari_super_admin`) — özet: FlexOS sidebar'ına Çıkış'ın üstüne bir **Ayarlar** akordiyonu gelecek (Sistem Logları + Sistem Modu = admin görür; **Sistem Ayarları** = SADECE süper admin görür, admin verme paneli — süper admin > admin > diğerleri hiyerarşisi, admin süper admini göremez/admin veremez). Admin verme e-posta ile Firebase hesabı aranarak yapılacak (flexos_users'a bağımlı değil). Ayrıca **Backup Kontrol** sayfası (hem online/Firestore-içi hem gerçek local/indirilebilir JSON export — ikisi de olacak) ve **Log sistemi** (satış/mail/sms logları, canlıdaki `dashboard/logs` deseni referans) konuşuldu — **HİÇBİRİ ÖNCELİK DEĞİL şu an**, sadece kapsam netleşti. Süper admin e-postası (`alparslan.sennturk@gmail.com` mı yoksa `flexos.platform@gmail.com` mı) HÂLÂ TEYİT EDİLMEDİ — koda başlamadan önce sorulmalı.

### ✅ Ödev Verme + Not — eğitmen tarafındaki 2 ciddi alan UÇTAN UCA BİTTİ (2026-07-08, aynı gün, uzun oturum)

Kullanıcı: "eğitmen tarafında 2 ciddi alan kaldı → Ödev Verme/Alma + Not Girme" — bugün ikisi de tamamlandı. Kilit/Sertifika Bastır dışında **backend dahil gerçek**, tarayıcıda click-through test EDİLMEDİ (kullanıcı kendi test edecek, "test ederken çıkan hataları çöze çöze ilerleriz").

**Ödev tarafı:**
- **3-nokta menüler + gerçek aksiyonlar** — Kütüphane kartı (Başlat/Kaldır — `DELETE assignment-templates/[id]`), Ghost kart (Başlat — `OdevOlusturModal` prefill), Aktif kart (Bitir/Düzenle/İptal Et).
- **"Ödevi Bitir"** — yeni statü İCAT EDİLMEDİ, domain'de zaten var ama kullanılmayan `"closed"` değeri kullanıldı. Kart kaybolmaz, "Bekliyor/Not Girişi" ikili butona (yanıp-sönen yeşil nokta) döner — canlıdaki `task.status==="completed"` davranışı birebir.
- **"İptal Et"** — `PATCH assignments/[id]` `{status:"archived"}`, Ödev Yönetimi'nin "Arşivle"siyle aynı servis.
- **"Ödevi Düzenle" BİTTİ** — yeni paylaşımlı `src/app/flexos/odevler/_shared/EditAssignmentModal.tsx` (Ödev Yönetimi'nin kendi inline modalı buraya taşındı, Ödev Parkuru kartı da AYNI bileşeni kullanıyor — tek kaynak, iki giriş noktası).
- **"Revize İste"/"Onayla" BİTTİ** — backend (`PATCH submissions/[id]/status`) Faz 2'den beri VARDI ama hiçbir UI'dan çağrılmıyordu. Bugün: Ödev Teslimi detay ekranına gerçek buton + **öğrenciye bildirim** (`updateSubmissionStatus`'a `notify` dependency eklendi — "Revize İstendi"/"Ödeviniz Onaylandı! 🎉"). **Toplu işlem de eklendi** — checkbox + "Toplu İşlem" dropdown (canlıdaki `bulkSetStatus` birebir), seçili öğrencilere paralel PATCH.
- **"Ödev Dosyası Yükle" BİTTİ** (hem oluşturma hem düzenleme) — Classroom deneyimi: dosya(lar) `OdevOlusturModal`'da SEÇİLİR (tarayıcı belleğinde `File[]`, henüz yüklenmez, assignmentId yok), "Kaydet/Başlat"a basınca SIRAYLA (1) assignment oluşturulur → gerçek id, (2) seçili dosyalar `uploadAssignmentAttachment()` (yeni paylaşımlı fonksiyon, `odevler/_shared/uploadAssignmentAttachment.ts`) ile Drive'a yüklenir. `EditAssignmentModal`'daki sürükle-bırak da AYNI fonksiyonu kullanır (var olan ödeve dosya ekleme). Chunk proxy öğrenci teslimiyle AYNI (`/api/flexos/submissions/upload-chunk`, kind'a bakmaz, reuse). Yeni backend: `initAttachmentUpload`/`completeAttachmentUpload` (`submission-service.ts`) + `POST /api/flexos/assignments/[id]/init-attachment-upload` + `POST /api/flexos/assignments/complete-attachment-upload` — hedef `Submission` değil doğrudan `Assignment.attachments`.
- **Drive klasör hiyerarşisi DÜZELTİLDİ** (kullanıcı: "çok eğitmen kullanacaksa ayırt edebilmeliyiz") — eskiden `flexos/{tenantId}/{grupKodu}/{öğrenciAdı}/{ödevAdı}` idi (yanlış sıra, eğitmen adı yok). Şimdi: **`{Eğitmen Adı}/{Branş}/{Grup Kodu}/{Ödev Adı}/{Eğitmen|Öğrenci Adı}`** — `resolveAssignmentFolderSegments()` (`submission-service.ts`), hem öğrenci teslimi hem eğitmen eki AYNI helper'ı kullanır. `UploadSession`'a `kind:"submission"|"attachment"` discriminator + `personId` artık opsiyonel eklendi (`core/submission.ts`). `SubmissionDeps`'e `trainers: TrainerRepo` eklendi (eğitmen adını çekmek için) — 3 call site (`init-resumable-upload`, `complete-upload` route'ları + `assert-submission.ts`) güncellendi.

**Not tarafı:**
- **Ödev Notu manuel puan girişi KALDIRILDI** — taban puan HER ZAMAN `Assignment.maxPuan`, net puan = `maxPuan × (1−gecikme cezası%)` otomatik hesaplanır. Gecikme kademesi (1 hafta/2 hafta+) artık GERÇEK `Submission.isLate`+`submittedAt`'ten otomatik türetilir (`durumFromSubmission()`) — eskiden herhangi bir teslim varsa körlemesine "teslim etti" yazılıyordu.
- **Sertifika Notu ağırlık bug'ı düzeltildi** — "Ödev Notu" kolonu artık SADECE ayara (`odevAktif`) bakar, veri yoksa `%0` gösterir (eskiden veri yoksa kolon TAMAMEN gizleniyordu, ayar açık olsa bile sertifika-notu-only'e sessizce düşüyordu — "sistem ayarları görmüyor" bug'ının gerçek sebebi). Grup-genelinde HİÇ ödev notu yoksa (muhtemelen ayar yanlışlıkla açık unutulmuş) "Taslak Kaydet" artık sessizce 0'layıp kaydetmek yerine uyarı modalı açıyor (Vazgeç / Ödev Notu ayarını devre dışı bırak).
- **Kilit mimarisi KİŞİ-bazlı** (2 kez düzeltildi — önce YANLIŞ olarak grup-genelinde "Notları Gönder" toplu kilitleme yapılmıştı, kullanıcı düzeltti: "biz sertifika notlarını topluca girmiyoruz ki, biri bugün öteki 6 ay sonra getiriyor"). Doğrusu: `Grade.locked` alanı KİŞİ bazlı, tetikleyici Eğitim Op'un o kişiye özel "Sertifika Bastır" aksiyonu (**HENÜZ YOK**, ayrı/ertelenmiş iş). `saveGrades` kilitli kişiyi sessizce atlar, roster'daki diğerlerini engellemez. `canOverrideLock` (org scope/yetkili) kilidi hiç umursamaz. UI: kilitli satırda soluklaşma YOK, yeşil onay tiki + tıklanınca "Bu kişiye sertifikası basıldı..." bilgi toast'ı. **Tek buton kaldı: "Notu Kaydet"** — ayrı "Notları Gönder"/finalize kavramı YOK, `Enrollment.result` snapshot'lama da YOK (kullanıcı kararı: "notu kaydet desek bile admin/yetkili düzenleyebilir").
- **Sertifika Bastır/PDF/fiziksel baskı/mail-SMS bildirimi — TAM VİZYON KONUŞULDU ama "acelesi yok" (kullanıcı), hiç kod yazılmadı.** Bkz proje hafızası `project_certificate_issuance_vision`.

**Genel/altyapı:**
- **`FlexPageContent` merkezi wrapper eklendi** (`FlexHeader.tsx`) — `FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS`'ı doğru ortalamak için tek kaynak (`w-full`/`mx-auto` class'ı EKLEME, compact class'ın kendi `w-[94%]`'üyle çakışır — 2026-07-08'de bu hata iki sayfada ayrı ayrı çıktı, "sıfıra yapışma" bug'ı). 3 sayfa buna geçirildi: Eğitmen Ana Sayfa, Satış Dashboard, Sertifika Notu. **Kullanıcı kararı: bundan sonra yazılacak HER yeni sayfa bunu kullanacak, kalan ~33 sayfa ayrı ayrı ileride geçirilecek (kör toplu değişiklik YOK).**
- Dar ekranda (`1fr` + sabit-px kardeş kolon) grid taşma bug'ı — `minmax(0,1fr)` fix'i (Satış Dashboard + Sertifika Notu).
- **Yetki katmanı netleşti (kod okunarak doğrulandı, henüz DEĞİŞTİRİLMEDİ):** `auth-actor.ts::packagesForCaller` hâlâ GEÇİCİ — `flexos_users`'ı hiç okumuyor, canlı Firebase Auth custom claim'lerine bakıyor (`role==="instructor"`→egitmen, `isAdmin`→admin). Satış/Operasyon/Finans hiç eşlenmemiş (boş paket döner). **Önemli bulgu:** gerçek bir canlı eğitmen hesabı (`role:"instructor"` claim'i + `groupIds`) FlexOS'a girip GERÇEKTEN `egitmen` paketiyle çalışabiliyor — `flexos_users` gerekmiyor. Backfill (`students`→`persons`) yapılmadığı için o eğitmen FlexOS'ta kendi canlı verisini GÖRMEZ — sadece FlexOS'un kendi akışlarından (Satış Yap vb.) girilen veri görünür.

### ✅ Reklam Tasarımı — 3/3 oyunlaştırılmış ödev birebir port edildi, ÜÇLÜ TAMAMLANDI (2026-07-08)

Kolaj Bahçesi + Kitap Dünyası'nın ardından üçüncü ve SON oyunlaştırılmış ödev (`assignmentType:"sosyal_medya"` canlı karşılığı, kullanıcıya "Reklam Bulucu" olarak görünüyor) aynı desenle taşındı — en karmaşık kısım: hiyerarşik 3 seviyeli çekiliş (Sektör→Alt Sektör→Marka→Amaç, **string eşleşmesiyle** bağlı, foreign-key değil) + arka planda sessizce bağımsız bir Format seçimi, 3 paralel slot-reel (1800/3200/4600ms gecikme, 7400ms'de kilitleniyor).

**Yeni domain modeli:** `SocialPool`/`SMBrand`/`SMSector`/`SMFormat`/`SocialDrawItem` (`src/app/lib/domain/core/social-pool.ts`) — Collage/Book ile AYNI iki-katmanlı sahiplik deseni. `SocialDrawItem` diğerlerinden FARKLI: `CollageItem`/`BookItem` gibi havuzdan bire-bir kopyalanan bir öğe değil, hiyerarşik seçimin SONUCU (brandName/sectorDisplay/brandRule/purpose/platform/contentType düz alanlar) — `LotteryResult.draws[].item` union'ı `CollageItem | BookItem | SocialDrawItem`'a genişledi, `LotteryArchive.type`/`GamifiedAssignmentType` `"sosyal"` ile genişledi. `assignment-service.ts`'teki `VALID_GAMIFIED_TYPES` hardcode listesine de `"sosyal"` eklenmesi gerekti (unutulsaydı org-scope admin bile şablon oluşturamazdı — assertion bunu yakaladı).

**Backend:** `social-pool-repo.ts`/`.firestore.ts` (`flexos_social_pools`), `social-pool-service.ts` (`getMySocialPool`/`updateMySocialPool`/`addSocialTemplateToPersonalLibrary`[gamifiedType≠"sosyal" şablonu reddeder]/`getDefaultSocialPool`/`updateDefaultSocialPool` — items array yerine tüm havuz nesnesi `{brands,sectors,formats,globalPurposes,sharedRule}` tek seferde rewrite ediliyor). Route'lar: `GET/PATCH /api/flexos/social-pool`, `POST /api/flexos/social-pool/add-to-library`. `lottery-results/mail` route'u `type:"sosyal"` için AYRI dallandı — `SocialDrawItem` düz-alan modeli `{category,item:{name,title}}` şemasına uymadığı için mail tablosu Marka Kuralı/Amaç/Platform/İçerik Türü 4 satırıyla ayrı render ediliyor. **26 yeni assertion** (`scripts/assert-social-pool.ts`) — self/org izolasyon, idempotency, tür karışmama (Kitap şablonu Sosyal havuzuna eklenemiyor), saveDraw sahiplik/status-flip/arşiv `type:"sosyal"`. Toplam assertion takımı (16 script, 300 assertion) regresyonsuz yeşil.

**Frontend:** `/flexos/sosyal` (EntryScreen→SocialGameScreen, aynı iskelet). `SlotReel.tsx` canlıdan birebir (RAF değil setInterval tabanlı, 60ms/100+40ms yavaşlama). Hiyerarşik seçim algoritması (sektörleri karıştır→geçerli alt sektörleri filtrele→marka seç→amaç seç, boşsa `globalPurposes` fallback) birebir port edildi. `OdevOlusturModal`/`GlobalLibraryPanel`/Ödev Yönetimi admin formu `gamifiedType: "kolaj"|"kitap"|"sosyal"` genelinde çalışıyor, "Global Kütüphane'ye ekle" seçici **4'lü** oldu (Yok/Kolaj/Kitap/Reklam Tasarımı), Havuz Yönetimi 3 sub-tab (`SocialPoolPanel.tsx` — Sektörler/Markalar/Reklam Ölçüleri/Amaç&Kural, en ağır admin paneli çünkü 3 iç içe koleksiyon).

**PDF şablonu:** `generateSocialPdf.tsx` — canlının tablo+"Yapılacaklar" bullet şablonu Inter font'a geçirilerek birebir taşındı.

**Basitleştirme (Kolaj/Kitap'taki kararla AYNI, kapsam gereği):** canlıdaki ayrı "Arşive Kaydet"/"Ödevi Tamamla" akışı tek "Ödevi Tamamla" butonuna sadeleştirildi.

`tsc --noEmit` + `npm run build` temiz. Seed script (`scripts/seed-social-pool-default.mjs --commit`) çalıştırıldı — canlıdaki **10 sektör, 122 marka, 7 ortak amaç** + global "Reklam Tasarımı" katalog girdisi FlexOS'a taşındı. **Not:** canlıdaki `formats` öğelerinde `id` alanı YOK (client-side normalize ediliyordu) — seed script'te sentetik id üretilerek **5 format** taşındı.

**⚠️ Tarayıcıda test edilmedi** (bu oturumda authenticated session yoktu) — PC'de/canlı ortamda `/flexos/sosyal` akışının (picking→spin→PDF/mail→sonuç kartı) uçtan uca denenmesi gerekiyor.

**3 oyunlaştırılmış ödev turu TAMAMLANDI** — Kolaj Bahçesi + Kitap Dünyası + Reklam Tasarımı hepsi FlexOS'ta canlı-birebir çalışıyor.

### ✅ Kitap Dünyası — 2/3 oyunlaştırılmış ödev birebir port edildi (2026-07-08)

Kolaj Bahçesi'nin ardından ikinci oyunlaştırılmış ödev (`assignmentType:"kitap"` canlı karşılığı) aynı desenle taşındı — havuz+çekiliş mekaniği+PDF+mail, ama kategori kavramı YOK (Kolaj'ın Gök/Yer/Obje 1/Obje 2'sinin aksine tek düz "deste").

**Yeni domain modeli:** `BookPool`/`BookItem` (`src/app/lib/domain/core/book-pool.ts`) — `CollagePool` ile AYNI iki-katmanlı sahiplik deseni (tenant varsayılanı `${tenantId}_default` / eğitmen kişisel kopyası `${tenantId}_${trainerId}`, izole, "Kütüphaneme Ekle" ile tohumlanır). `LotteryResult.draws[].item` tipi `CollageItem | BookItem` union'a genişletildi — kitabın zengin alanları (author/genre/isbn/publisher/pageCount/dimensions/backCover) snapshot semantiğiyle kayıpsız saklanıyor. `GamifiedAssignmentType` = `"kolaj" | "kitap"`, `LotteryArchive.type` de aynı şekilde genişledi ve `lottery-service.ts::saveDraw` artık `assignment.gamifiedType`'tan türetiyor (hardcode "kolaj" kaldırıldı).

**Backend (aynı repo→servis→route deseni):** `book-pool-repo.ts`/`.firestore.ts` (`flexos_book_pools` koleksiyonu), `book-pool-service.ts` (`getMyBookPool`/`updateMyBookPool`/`addBookTemplateToPersonalLibrary`[idempotent, gamifiedType:"kitap" olmayan şablonu reddeder]/`getDefaultBookPool`/`updateDefaultBookPool`). Route'lar: `GET/PATCH /api/flexos/book-pool`, `POST /api/flexos/book-pool/add-to-library`. Ortak `lottery-results`/`lottery-results/mail` route'ları REUSE edildi — mail route artık `type:"kolaj"|"kitap"` parametresiyle metin/dosya adını değiştiriyor (`MAIL_COPY` map'i), item tipi `{name?,title?,emoji?}` gevşetildi (Kolaj `.name`, Kitap `.title` kullanıyor). **25 yeni assertion** (`scripts/assert-book-pool.ts`) — self/org izolasyon, idempotency, tür karışmama (Kolaj şablonu Kitap havuzuna eklenemiyor), zengin alan kayıpsız saklama, saveDraw sahiplik/status-flip/arşiv `type:"kitap"`. Toplam assertion takımı (15 script, 274 assertion) regresyonsuz yeşil.

**Frontend:** `/flexos/kitap` (yeni route — EntryScreen→BookGameScreen, `/flexos/kolaj/page.tsx` ile birebir aynı iskelet). En riskli parça **`BookCarousel`** (`flexos/kitap/BookCarousel.tsx`) — canlıdaki RAF tabanlı "kitaplık rulet" animasyonu (5-kopya sonsuz şerit, `ResizeObserver` responsive merkezleme, 4800ms ease-out, 3 tam tur + kazanan offset'e kilitleme, `spinStatus: spinning→slowing→stopped`) birebir taşındı — Kolaj'ın 4-kategori slot mekaniğinden tamamen farklı, kategori kavramı yok (`catCount={1}`). `OdevOlusturModal`/`GlobalLibraryPanel`/Ödev Yönetimi admin formu artık `gamifiedType: "kolaj"|"kitap"` genelinde çalışıyor — admin "Global Kütüphane'ye ekle" toggle'ı ikili switch'ten **3'lü seçiciye** (Yok/Kolaj Bahçesi/Kitap Dünyası) evrildi, Havuz Yönetimi sekmesi Kolaj/Kitap sub-tab'ı ile ikisini de barındırıyor (`BookPoolPanel.tsx`).

**PDF şablonu:** `generateKitapPdf.tsx` — canlının tek-sütun düz sayfa şablonu (bookId 72pt üstte, başlık/yazar/yayınevi/tür, arka kapak justify metin, "Teknik Özellikler" tablosu) Inter font'a geçirilerek (Kolaj kararıyla aynı gerekçe) birebir taşındı.

**Basitleştirme (Kolaj'daki kararla AYNI, kapsam gereği):** canlıdaki ayrı "Arşive Kaydet"/"Ödevi Tamamla" overlay sekansı sadeleştirildi (toast+yönlendirme).

`tsc --noEmit` + `npm run build` temiz. Seed script (`scripts/seed-book-pool-default.mjs --commit`) çalıştırıldı — canlıdaki **30 kitap** + global "Kitap Dünyası" katalog girdisi (branch: Grafik Tasarım — canlıdaki `template.branch` alanının aslında ŞUBE adı ["Kadıköy Şb"] olduğu fark edilip Kolaj'daki gibi hardcode edildi) FlexOS'a taşındı.

**(GÜNCEL DURUM: Reklam Tasarımı [3/3] de tamamlandı — bkz. yukarıdaki en güncel blok. Aşağıdaki ön araştırma notu tarihsel referans olarak bırakıldı.)**

**Reklam Tasarımı — ön araştırma notu (2026-07-08, Explore agent, artık uygulandı):**
- Canlı dosyalar: `src/app/components/dashboard/assignment/social/SocialGameScreen.tsx` (1051 satır), `.../pool/SocialMediaPoolPanel.tsx` (1045 satır), `.../pool/poolTypes.ts`'teki `SocialMediaPool`/`SMBrand`/`SMSector`/`SMFormat` tipleri (`templateType:"grid"`), `src/app/api/send-sosyal/route.ts`, `generateSocialPdf.tsx`.
- **Mekanik:** Kolaj/Kitap'tan farklı — hiyerarşik 3 seviyeli zincir seçim (Ana Sektör→Alt Sektör→Marka, **string eşleşmesiyle** bağlı, foreign-key değil). 3 slot-reel görsel olarak dönüyor (Kolaj'a benzer, farklı gecikmeler: 1800/3200/4600ms, 7400ms kilitleniyor) ama arka planda SESSİZCE iki alan daha ekleniyor: markanın `purposes`'undan (boşsa ortak `globalPurposes`'tan) bir amaç + bağımsız rastgele bir format (platform+boyut). Yani çekilen şey görünenden zengin: Marka+Sektör+Amaç+Format.
- **Havuz modeli (en riskli/karmaşık kısım):** 4 ayrı iç içe koleksiyon — Brands (kendi `purposes` listesiyle), Sectors (alt sektör listesi), Formats (düz liste), ortak `globalPurposes`+`sharedRule` (paylaşılan kural metni, PDF'de bullet-list). Kolaj/Kitap'ın tek-liste yapısından belirgin daha karmaşık.
- **PDF/Mail:** Aynı genel desen (react-pdf + mail altyapısı reuse edilebilir), PDF'e ekstra "Yapılacaklar" bullet bölümü var; mail Drive linkini `sosyalDriveFiles.{studentId}` alanına yazıyor.
- **Havuz yönetimi:** 4 sekmeli CRUD (Sektörler/Markalar/Formatlar/Amaç&Kural) — Kolaj/Kitap'ın tek-liste panellerinden çok daha ağır, muhtemelen bu turun en zaman alan kısmı.
- **Kapsam tahmini:** oyun ekranı+animasyon Kolaj/Kitap ile benzer boyutta; havuz veri modeli+yönetim paneli belirgin daha büyük iş. Muhtemelen bu tur öncekilerden (Kitap ~30-45dk) daha uzun sürer.

### ✅ Kolaj Bahçesi — 1/3 oyunlaştırılmış ödev birebir port edildi (2026-07-07)

Canlıdaki 3 oyunlaştırılmış ödev şablonundan (Kolaj Bahçesi/kolaj, Kitap Dünyası/kitap, Reklam Tasarımı/sosyal medya) **ilki tam kapsam FlexOS'a taşındı** — kullanıcı kararı: "ayrı ayrı alalım", Kitap ve Sosyal Medya AYRI turlarda gelecek (henüz yok).

**Sahiplik/görünürlük modeli (kullanıcı kararıyla netleşti, canlıdan farklı bir kural):** Kolaj Bahçesi **global bir katalog girdisi** (branş="Grafik Tasarım" filtreli), ama eğitmen ondan DİREKT başlatamıyor — önce Ödev Yönetimi'nin yeni **"Global Kütüphane"** sekmesinden **"Kütüphaneme Ekle"** ile kendi KİŞİSEL kütüphanesine klonluyor. Klonlamayla birlikte kendi **bağımsız havuz kopyası** (tenant varsayılanından deep-copy tohumlanır) oluşuyor — kullanıcının açık endişesi ("herkes bir ekleme yaparsa karışır, kaos olur") üzerine her eğitmenin havuzu TAMAMEN İZOLE, birbirini etkilemiyor. Kendi havuzunu (Gök/Yer/Obje 1/Obje 2 kategorileri) yeni **"Havuz Yönetimi"** sekmesinden (Ödev Yönetimi artık 5 sekmeli) CRUD'luyor.

**Yeni veri modeli:** `AssignmentTemplate.gamifiedType?/sourceTemplateId?`, `Assignment.gamifiedType?`, yeni `CollagePool` (`flexos_collage_pools`, `CertificateSettings` ile aynı iki-katmanlı doküman id deseni: `${tenantId}_default` org varsayılanı / `${tenantId}_${trainerId}` kişisel kopya), yeni `LotteryResult`+`LotteryArchive` (`flexos_lottery_results`/`flexos_lottery_archive`, doküman id=assignmentId, snapshot semantiği — havuz sonradan değişse de geçmiş çekilişler değişmez).

**Yeni capability: `assignment.pool.manage`** (self→her eğitmenin normal yetkisi EGITMEN_CORE'da, standalone-only DEĞİL; org→Op/Admin, tenant varsayılanını yönetir ama bu turda ayrı bir admin ekranı YOK). "Kütüphaneme Ekle" ayrı capability gerektirmedi — mevcut `template.manage` self scope reuse edildi.

**Admin promote akışı (kullanıcı: "ben admin olarak oluşturduğum bir ödevi istersem global kütüphaneye ekleyebilirim"):** Şablon Yönetimi'nin global şablon formuna (SADECE org-scope aktöre görünür, `/api/flexos/me`'ye eklenen `templateManageScope` alanıyla tespit edilir) "Global Kütüphane'ye ekle (Kolaj Bahçesi)" toggle'ı eklendi — seed script'e bağımlılık kalmadı, admin istediği an istediği global şablonu işaretleyebilir.

**Backend (repo→servis→route→assertion deseni, tam):** `collage-pool-service.ts` (`getMyCollagePool`/`updateMyCollagePool`/`addTemplateToPersonalLibrary`[idempotent, org-default'tan tohumlar]/`getDefaultCollagePool`/`updateDefaultCollagePool`), `lottery-service.ts` (`saveDraw`[assigned-scope, LotteryResult+Archive+roster-tam-olunca-Assignment.status→"published" flip — tek route'ta, canlıdaki 3 ayrı client Firestore yazımı yerine], `getLotteryResult`). Route'lar: `GET/PATCH /api/flexos/collage-pool`, `POST /api/flexos/collage-pool/add-to-library`, `GET/POST /api/flexos/lottery-results`, `POST /api/flexos/lottery-results/mail` (canlının `/api/send-kolaj/route.ts`'i ile birebir — `sendMail`/`uploadBufferToFolder`/`setPublicReadPermission`/`createFolderStructure` REUSE edildi, yeni altyapı yok). **21 yeni assertion** (`scripts/assert-collage-pool.ts`) — self-scope izolasyon, idempotency, org/self karışmama, draw+status-flip. Toplam mevcut assertion takımı (13 script) regresyonsuz yeşil.

**Önemli güvenlik düzeltmesi (plan aşamasında yakalandı):** Live'da öğrenci e-postası client'tan mail route'una gönderiliyordu; FlexOS'ta email PII alanı ve eğitmen `person.read.pii` yetkisine sahip olmayabilir (Full modda hiç yok) — `/api/flexos/lottery-results/mail` artık `to` parametresini client'tan HİÇ ALMIYOR, `Person.pii.email`'i server-side resolve ediyor. Roster/EntryScreen client'ta öğrenci email'i hiç göstermiyor.

**Frontend:** `/flexos/kolaj` (yeni route — EntryScreen[katılımcı seç]→GameScreen[picking→4-kategori slot çekilişi→sonuç modalı→PDF indir/mail gönder], `usePickingEngine` hook'u BAŞTAN DOĞRU kullanıldı — canlıda Kolaj bunu kullanmıyordu, kendi kopyasını elle yazmıştı, bu tekrar yaratılmadı). PDF fontu **Inter** (kullanıcı kararı, Roboto yerine) — gerçek çalışan gstatic TTF URL'leri `curl` ile doğrulanarak bulundu. `OdevOlusturModal` prefill'e `gamifiedType` eklendi, "Ödevi Başlat" gamified şablonda normal oluşturma yerine `/flexos/kolaj`'a yönlendiriyor. Ödev Yönetimi 3→5 sekme (+Havuz Yönetimi +Global Kütüphane).

**Bilinçli basitleştirme:** canlıdaki ayrı "Arşive Kaydet"/"Ödevi Tamamla" siyah-overlay animasyon sekansı sadeleştirildi (toast+yönlendirme) — mekanik/veri/kurallar birebir, sadece bu kozmetik geçiş daha basit.

`tsc`/ESLint/`npm run build` temiz. Seed script (`scripts/seed-collage-pool-default.mjs --commit`) çalıştırıldı — canlıdaki 88 öğe (4×22) + gerçek "Kolaj Bahçesi" başlık/açıklama FlexOS'a taşındı.

Kitap Dünyası (2/3) 2026-07-08'de aynı desenle tamamlandı — bkz. yukarıdaki blok. Reklam Tasarımı (3/3, Sosyal Medya) hâlâ kullanıcı onayı bekliyor.

### ✅ Ödev Şablon Göçü + Kütüphane/Parkuru semantik düzeltmesi (2026-07-07)

Canlıdaki (`templates` koleksiyonu) 15 normal şablon `scripts/migrate-my-templates.mjs` ile `flexos_assignment_templates`'e taşındı — hepsi `scope:"personal"`, `trainerId=kYG8N01PTudh1VT1uvy2vg8vmAR2`. **"Benim şablonlarım" `createdBy` ile sınırlı değildi:** canlıda 18 toplam şablonun 11'i kullanıcının kendi uid'i, 7'si `flexos.platform@gmail.com` ("Sistem Destek" admin hesabı) tarafından oluşturulmuştu ama kullanıcı hepsini "bana ait" saydı — 3 oyunlaştırılmış (`scope==="gamified"`: Kolaj Bahçesi, Reklam Tasarımı, Kitap Dünyası) bu turda HARİÇ tutuldu, ayrı ele alınacak. Detay: [[flexos_odev_sablon_migration_2026_07_07]].

**Bilinçli yaklaşık eşlemeler:** canlının `points` alanı (3-5 gibi küçük değerler, FlexOS'un 100-ölçekli `maxPuan`ıyla örtüşmüyor) taşınmadı, hepsi varsayılan 100. İkon eşlemesi yaklaşık (16 whitelist'e). Branş: canlının `discipline` alanı (`branches` koleksiyonu ID→isim) kullanıldı, "Grafik-1"→FlexOS "Grafik Tasarım"a eşlendi.

**Kullanıcı geri bildirimiyle Kütüphane/Parkuru semantiği TERSİNE ÇEVRİLDİ** (önceki 2026-07-06 kararının tam tersi):
- **Ödev Parkuru ghost-slot** artık `visible` alanına HİÇ bakmıyor — sınıflara gerçekten verilip başlatılan (aktif) ödev sayısı bir satırı (4) doldurmuyorsa kalan slotlar TÜM şablonlardan otomatik/deterministik-rastgele dolduruluyor (id-hash %7 karıştırma, zaten vardı, sadece `visible` filtresi kaldırıldı).
- **Ödev Kütüphanesi** artık `visible===true` filtresi uyguluyor — Şablon Yönetimi'nde onaylanmayan (X) şablon Kütüphane'de listelenmiyor. Tooltip/rozet metinleri "Ana sayfada" → "Kütüphanede" güncellendi.
- **Kütüphane'nin branş dropdown'ı** artık şablonlarda geçen branşlardan DEĞİL, "eğitmenin kendi gruplarının branşları ∪ eğitmenin kendi şablonlarının branşları" birleşiminden türetiliyor (canlıdaki sabit `user.branches` listesine en yakın karşılık — FlexOS'ta öyle bir alan yok). `GET /api/flexos/groups` çağrısına `?trainerId=<kendi-uid>` EXPLICIT eklendi — org-scope aktör (admin/owner) parametresiz istekte TÜM tenant'ın gruplarını görüyordu, bu widget'ta kim görüntülüyorsa sadece kendi branşlarını görmeli.
- **"Web Tasarım" branşı** FlexOS Branş Havuzu'na eklendi (önceden sadece "Grafik Tasarım"/"Yazılım" vardı), Web-Test şablonu ona bağlandı.
- **Şablon Yönetimi branş çipi nötr gri** yapıldı (`odevler/yonetim/page.tsx`'e özel, `BRANS_COLORS` paylaşımlı dosyasına dokunulmadı) — eğitmen tek branşta çalışınca renkli palet monoton/anlamsız kalıyordu.
- **Gerçek-zamanlıya-yakın yenileme:** Ödev Kütüphanesi artık `egitim-operasyon-anasayfa`'daki activities polling ile AYNI desen — 60sn interval + `visibilitychange`'de anında yenile (client Firestore listener YOK, `flexos_*` server-only rules kararına uygun — bkz. [[flexos_firestore_client_access_pattern]]).

`tsc`/ESLint temiz.

### ✅ Şablon Yönetimi — Ödev Yönetimi'nin İLK sekmesi, canlı-birebir, BİTTİ (2026-07-06, aynı gün devam)

Kullanıcı düzeltti: bu iş "ileride eklenir" değil, **çekirdek/olmazsa-olmaz** ("şablon ödevin kalbi, olmazsa canlıya alamam") — kademeli/minimal öneri geri çevrildi, doğrudan canlı-birebir tam kapsam istendi. Kullanıcı Claude Design çıktısı verdi (`Ödev Şablonu Yönetimi.dc.html`), `/flexos/odevler/yonetim` sayfasına **İLK sekme** olarak (Şablon Yönetimi → Mevcut Ödevler → Arşiv) portlandı.

- **`AssignmentTemplate.visible?: boolean`** eklendi — Ana Sayfa'daki Ödev Parkuru'nun ghost-slotlarında görünürlüğü kontrol eder. Yeni şablon varsayılan `visible:false` (Şablon Yönetimi'nden manuel onaya kadar Ana Sayfa'da görünmez). `egitmen-anasayfa/page.tsx`'teki `OdevParkuru`'nun ghost-template filtresi artık `t.visible === true` şartını da arıyor (önceden hiç bakmıyordu — bu turdan önce TÜM kullanılmamış şablonlar ghost-slot adayıydı, bug'dı).
- **`updateTemplate`/`deleteTemplate`** (`assignment-service.ts`) yeni — `assertTemplateOwnership` ortak yardımcı: kişisel şablon SADECE sahibi eğitmen (org-scope Op/Admin BİLE erişemez — "sadece kendisi görür/yönetir" kararına sadık), global şablon SADECE org-scope. `PATCH`/`DELETE /api/flexos/assignment-templates/[id]` route'u (`assignments/[id]` ile aynı desen).
- **11 yeni assertion** (`scripts/assert-assignment.ts`, toplam **31**): visible varsayılan false, branch denormalize, kişisel/global sahiplik matrisi (başka eğitmen/org-scope-bile-erişemez/doğru sahip/admin-global), olmayan id, boş başlık. Hepsi yeşil. `tsc`/ESLint/`npm run build` temiz.
- **Sayfa** (`odevler/yonetim/page.tsx`): branş filtresi gerçek katalogdan (`GET /api/flexos/branches`), renkler paylaşımlı `siniflar/_shared/groupDisplay.ts`'teki `BRANS_COLORS`/`BRANS_FALLBACK` (tasarımın kendi sabit 5-branş rengi KULLANILMADI — tutarlılık için mevcut paylaşımlı palet). Tablo: Şablon Adı/Açıklama/Branş/İşlem (görünürlük onay ✓/✕ toggle + düzenle + sil), üstte mavi bilgi kutusu + "N şablon ana sayfada" rozeti, oluştur/düzenle modalı (Tailwind, sayfanın kendi mevcut modal deseniyle tutarlı — paylaşımlı `FlexModal` DEĞİL, bu sayfanın zaten kullandığı ham modal deseni), silme onay modalı.
- **"Ödev Ekle" modalına branş seçici EKLENMEDİ (kullanıcı kararı):** `OdevOlusturModal.tsx`'te "Şablon olarak kaydet" işaretliyken artık şablonun branşı seçili **Grup**'tan (`groups.find(g=>g.id===groupId)?.branch`) otomatik gönderiliyor — Ödev Ekle'de ayrı bir branş alanı yok, sadece Şablon Yönetimi'nin kendi (grupsuz) oluşturma formunda manuel branş seçici var.
- Bkz [[project-sablon-yonetimi]], [[feedback-no-scope-reduction-core]].

**Şablon Yönetimi modalı "Ödev Ekle" ile TAM parite oldu (aynı gün devam):** Kullanıcı: "Ödev oluşturdakinin aynısı olsun" — modal framer-motion + portal'a geçti (`egitmen-anasayfa/OdevOlusturModal.tsx` ile BİREBİR aynı geçiş: backdrop 0.18s fade, panel 0.24s scale/y), alan seti genişledi: Şablon Adı (üst) + Alt Başlık (alt) solda / İkon Seçimi (16 ikon, aynı popup) sağda dikey buton, Ödev Türü (Ödev/Proje) + Branş dropdown tek satırda, Açıklama en altta. **İkon/tür sabitleri paylaşımlı dosyaya çıkarıldı** (`odevler/_shared/assignmentIcons.ts` — `ASSIGNMENT_ICONS`/`ASSIGNMENT_ICON_KEYS`/`ASSIGNMENT_KIND_OPTIONS`), hem Ödev Ekle hem Şablon modalı AYNI kaynaktan besleniyor (tekrar yok). `AssignmentTemplate`'e `subtitle?`/`icon?`/`kind?` eklendi (Assignment'takiyle aynı `AssignmentKind` tipi); `createTemplate`/`updateTemplate` bu alanları kabul ediyor + `kind` doğrulaması (VALID_KINDS). "Ödev Ekle"deki "Şablon olarak kaydet" artık subtitle/icon/kind'i de gönderiyor (önceden sadece title/description/branch gidiyordu — kayıp veri riski kapandı). Tablo satırı artık seçili ikonu + alt başlığı da gösteriyor (önceden hep aynı ClipboardList + sadece title). **16 yeni assertion** (toplam **36**, `scripts/assert-assignment.ts`): subtitle/icon/kind create+update, kind default "normal", geçersiz kind reddi (create+update). `tsc`/ESLint/`npm run build` temiz.

**Modal yükseklik zıplaması düzeltildi + bilgi kutusu kaldırıldı (aynı gün devam):** İkon seçimi popup'ı açılınca modal aniden zıplıyordu — sebep, panel'in `maxHeight`/iç-scroll sınırı olmadan sadece içeriğe göre auto-height olmasıydı (Ödev Ekle'de olduğu gibi `maxHeight:"calc(100dvh-32px)"` + body'de `flex-1 min-h-0 overflow-y-auto` YOKTU). Panel artık `flex flex-col` + `maxHeight` ile sınırlı, header/footer `shrink-0`, body scroll'lu — Ödev Ekle ile birebir aynı davranış. Ayrıca "Onay (✓) butonuna basınca..." açıklama kutusu kullanıcı isteğiyle kaldırıldı (gereksiz bulundu), `visibleTemplateCount` değişkeni de artık kullanılmadığı için silindi.

**Modal yükseklik davranışı TEKRAR düzeltildi — bu sefer sabit (aynı gün devam, kullanıcı: "genişlik ve yükseklik aynen korunmalı, oynamamalı asla"):** Bir önceki `maxHeight` (auto-fit) çözümü yeni bir sorun açtı — ikon seçici popup'ı açılınca panel'in TAMAMI aniden büyüyordu. Hem `OdevOlusturModal.tsx` hem Şablon modalı (`odevler/yonetim/page.tsx`) artık `maxHeight` yerine SABİT `height: min(Npx, calc(100dvh-32px))` kullanıyor (Ödev Ekle 820px, Şablon 760px — önceki 770'in yetersiz çıkmasından ders alınarak bolluk payı arttırıldı). Body'nin zaten var olan `flex-1 min-h-0 overflow-y-auto`'su sayesinde ikon picker açılıp içerik taştığında SADECE body içinde scroll çıkıyor, panelin kendisi asla büyümüyor/küçülmüyor — ikon picker kapalıyken de normal içerik bu sabit yüksekliğin altında kaldığı için scroll hiç görünmüyor. Bkz [[feedback-modal-fixed-dimensions]] (yeni feedback hafızası — genel kural olarak kaydedildi).

**✅ Ödev Kütüphanesi eklendi — Eğitmen Ana Sayfa'nın en büyük eksiği kapandı (aynı gün devam, kullanıcı: "canlıya bak, sağa sola kaydırılabilir scrolling mantığında olan kütüphaneyi istiyorum"):** Daha önce (2026-07-06 erken saatler) "Ana Sayfa'dan Ödev Kütüphanesi kaldırıldı" kararı VERİLMİŞTİ ("muhtemelen Ödev Yönetimi'ne eklenir" varsayımıyla) — kullanıcı bunu geri aldı, canlıdaki `AssignmentLibrary.tsx`'in BİREBİR portu Ödev Parkuru'nun altına eklendi (`egitmen-anasayfa/page.tsx::OdevKutuphanesi`).

- **Yatay kaydırmalı kart listesi** (canlıdaki gibi `overflow-x-auto snap-x`, ~4.3 kart görünür), overflow varsa sol/sağ ok butonları (`ResizeObserver` ile tespit). Kart: gri ikon kutusu (şablonun kendi seçili ikonu) + başlık/alt başlık + branş çipi (renkli, `BRANS_COLORS`) + "Ödevi Başlat" butonu.
- **Kişisel/Global sekme ayrımı KALDIRILDI** (kullanıcı kararı) — `GET /api/flexos/assignment-templates` zaten eğitmenin kendi kişisel + tüm global şablonlarını tek listede döndürüyor (`listTemplates`). Yerine SADECE **branş seçici** var (şablonlarda fiilen bulunan branşlardan türetilir, >1 branş varsa gösterilir — çoklu branşlı eğitmen kütüphaneler arası geçiş yapar).
- **`visible` alanı burada FİLTRE DEĞİL** — Kütüphane HER ZAMAN TÜM şablonları gösterir (canlıdaki gibi); `visible` sadece Ödev Parkuru'nun küçük ghost-slot önizlemesini etkiler. İki ayrı "görünürlük" ekseni: Parkuru=küratörlü küçük önizleme, Kütüphane=tam liste.
- **`OdevOlusturModal`'a `prefill` (`AssignmentPrefill`) desteği eklendi** — Kütüphane'deki "Ödevi Başlat" AYNI modalı şablonun `title/subtitle/description/icon/kind` alanlarıyla ÖN-DOLU açıyor (`templateId` de body'ye eklendi — daha önce hiç gönderilmiyordu, bu da bir eksiklikti). Eğitmen sadece grup+tarih seçip onaylıyor. Prefill'liyken "Şablon olarak kaydet" bölümü GİZLENİYOR (zaten şablondan başlatılıyor, tekrar kaydetmek anlamsız), başlık "Ödevi Başlat" oluyor. Yeni bir "AssignActivateModal" klonu YAZILMADI — mevcut modal genişletildi (kod tekrarı yok).
- `tsc`/ESLint/`npm run build` temiz.

**Branş Havuzu'nda 2'şer kopya çıktı — kök neden bulunup temizlendi (aynı gün):** Kullanıcı Şablon Yönetimi'nin branş dropdown'ında "Grafik Tasarım" ve "Yazılım"ın ikişer kere göründüğünü fark etti. Araştırma: `scripts/seed-flexos-dashboard-demo.mjs` (Satış Dashboard demo verisi için, 2026-07-04'te çalıştırılmış) branş adı çakışmasını KONTROL ETMEDEN her çalıştığında yeni ID ile 8 branş yazıyor (`flexos_branches`) — bunlardan "Grafik Tasarım"/"Yazılım" zaten 2026-06-18'de kullanıcı tarafından Branş Havuzu ekranından GERÇEK olarak eklenmişti, script bunları isim bazında fark etmeden tekrar ekledi ("Sistem Uzmanlığı"/"Dijital Pazarlama" da script'in demo branşlarıydı, gerçek değildi). **4 seed-script branşı silindi** (`createdBy:"seed-script"` filtresiyle) — kullanıcı kararı: bağlı 4 demo eğitim + 39 demo satışın `branchId`'i artık geçersiz kalacak ama dummy veri olduğu için sorun değil ("teste geçince dummyler gidecek zaten"). Script'in kendisi HENÜZ düzeltilmedi (gelecekte tekrar çalıştırılırsa aynı çakışma tekrarlanabilir) — bilinen açık, kullanıcı istemedikçe dokunulmayacak.

**Şablon Yönetimi görsel ince ayarları — birkaç kullanıcı geri bildirim turu (aynı gün, Kütüphane'den ÖNCE oldu ama not buraya toplu düşüldü):**
- **Renk paleti düzeltmesi:** Kullanıcı "hâlâ aynısı değil, renkli ve güzel bir tasarım vermiştim" dedi — kök neden: paylaşımlı `groupDisplay.ts::BRANS_COLORS` İngilizce placeholder isimlerle (`Design/Finance/Software`) yazılmıştı, gerçek branşlarla (`Grafik Tasarım`/`Yazılım`) HİÇ eşleşmiyordu → tüm çipler sessizce gri fallback'e düşüyordu. Kullanıcının verdiği tasarımın KENDİ renk paleti (gerçek isimlerle eşleşen) `BRANS_COLORS`'a taşındı. Aynı hatalı palet 6 başka sayfada da (Eğitmenler/Satış Listesi/Paket-Kampanya Yönetimi/Öğrenci Havuzu) ayrı kopyalanmış halde duruyor — DOKUNULMADI, kullanıcı istemedi. Bkz [[feedback-use-given-design-values]].
- **Düzenle/Sil butonları** tasarımdaki gibi beyaz kenarlıklı kutuya çevrildi (önceden border'sız düz ikondu, hover renkleri de tasarımın tam hex'i değildi).
- **Onay/kaldır ikon-renk mantığı DÜZELTİLDİ** (kullanıcı: "onay tıkı olursa yeşil, x olursa açık kırmızı arka plan" — tasarımın kendi "aksiyon butonu" mantığından farklı, "durum göstergesi" mantığı istendi): `visible:true` → yeşil + Check ikonu, `visible:false` → açık kırmızı (`#FFECEC`/`#F3B0B0`/`#D93636`) + X ikonu.
- **Yeşil "N şablon ana sayfada" rozeti** geri eklendi (açıklama cümlesini kaldırırken yanlışlıkla rozeti de silmiştim) — başlık satırında, branş filtresinin yanında.
- **Satır aksiyonlarında tam-reload kaldırıldı:** onay/düzenle/sil/arşivle gibi TEKİL satır aksiyonlarından sonra koca `loadData()` çağrılıyordu (kullanıcı: "onay tıkına basınca komple liste kayboluyor geliyor, saçma değil mi"). Hem Şablon Yönetimi hem Mevcut Ödevler/Arşiv sekmelerindeki TÜM mutation handler'ları (`saveTplForm`/`toggleTplVisible`/`confirmTplDelete`/`handleSave`/`handleDelete`/`setStatus`/`handleBulkDelete`) artık sadece ilgili satırı yerel state'te güncelliyor, tam reload YOK. Bkz [[feedback-no-full-reload-on-row-action]].
- `tsc`/ESLint/`npm run build` her adımda temiz.

**Ödev Kütüphanesi ince ayarları + Ödev Puanı alanı (aynı gün, Kütüphane'den SONRA):**
- **Kütüphane kartındaki branş çipi RENKSİZ yapıldı** (kullanıcı: "kütüphane kısmı renksiz olsun") — referans görsel (`kütüphane.png`, canlının gerçek ekran görüntüsü) gösterdi ki canlıda branş hiç renklendirilmiyor, sadece düz gri italik metin (branş adı yoksa "Global"). Oyunlaştırılmış (mor "Oyunlaştırılmış" rozeti) FlexOS'ta henüz yok, o özellik gelince eklenecek.
- **`AssignmentTemplate.maxPuan?: number`** eklendi (kullanıcı: "Ödev Ekle'deki Ödev Puanı satırını şablona da ekleyelim") — `createTemplate`/`updateTemplate` kabul ediyor + pozitif doğrulama (VALID pattern, `assignTask` ile aynı), varsayılan 100. Şablon modalına Ödev Ekle ile AYNI Ödev Puanı bloğu (input + 100/150/200/250/300 hızlı seçim) eklendi. `AssignmentPrefill`e de `maxPuan` eklendi — Kütüphane'den "Ödevi Başlat" artık şablonun puanını da taşıyor. **3 yeni assertion** (toplam **39**): maxPuan kaydediliyor/varsayılan/negatif-red (create+update).
- **Modal yüksekliği 760→820px** — Puan satırı eklenince sabit 760px yetersiz kaldı (kullanıcı: "scroll çıktı, sığmaz mı"), Ödev Ekle'nin kanıtlanmış 820 değerine eşitlendi.
- **Küçük ekran kompaktlaştırması** (kullanıcı: "küçük ekranlarda da scroll olmasın") — header/body/footer padding'leri (`py-6.5→py-5`, `px-8→px-7`), body `gap-5→gap-4`, açıklama `rows 5→4` küçültüldü; bu, sabit yüksekliğin dar viewport'larda gerekli içerik miktarına daha rahat sığmasını sağlıyor (garantili sıfır-scroll fiziksel olarak çok kısa pencerelerde mümkün değil, ama pratikte normal küçük ekranlarda artık rahat sığıyor).
- **"Ödev Ver" butonu** (Ödev Parkuru) düz turuncudan (`bg-[#FF8D28]`) "Şablon Oluştur" ile AYNI gradient'e (`linear-gradient(135deg,#FF8D28,#D66500)`) çevrildi — iki oluşturma butonu artık görsel olarak tutarlı.
- `tsc`/ESLint/`npm run build` temiz.

### ✅ Grade domain backend BİTTİ + Sertifika Notu bağlandı (2026-07-06, aynı gün devam)

`domain/education/grade.ts` entity'si zaten vardı (ilk mimari katmanında, hiç dokunulmamıştı) — bu turda **repo → servis → route → assertion** kuruldu (Faz1/2 deseni). Capability'ler (`grade.read/write/finalize/report.read`) zaten registry+packages'ta hazırdı, ekstra iş gerekmedi.

- **`domain/repo/grade-repo.ts`** — port (`save`/`getById`/`listByGroup`; doküman id = enrollmentId, `nextId` yok — upsert).
- **`domain/services/grade-service.ts`** — `saveGrades(actor, {groupId, entries[]}, deps)` (toplu upsert, 0-100 validasyon, `null`=temizle) + `getGradesByGroup(actor, groupId, deps)`. İkisi de `grade.write`/`grade.read` gated, **assigned scope** (eğitmen sadece `Group.trainerId === actor.uid` olan kendi grubu — `attendance-service.ts`'teki desenin aynısı).
- **`server/grade-repo.firestore.ts`** — yeni `flexos_grades` koleksiyonu, server-only rules.
- **Route `/api/flexos/grades`** — `GET ?groupId=` (okuma) + `POST` (body `{groupId, entries}`, toplu kaydet).
- **16 assertion geçti** (`scripts/assert-grade.ts`): admin/kendi-grubuna-atanmış-eğitmen yazabilir; başka-eğitmenin-grubu/satış/operasyon (yalnız `grade.report.read`'i var, `grade.read` YOK)/finans reddedilir; aralık-dışı-not + varolmayan-grup + boş-entries → ValidationError; güncelleme createdAt korur; not temizleme (`null`→`undefined`) çalışır. `tsc`+ESLint+`npm run build` temiz.
- **Sertifika Notu sayfası bağlandı:** grup seçilince `GET /api/flexos/grades?groupId=` ile notlar ön-doluyor (sayfa yenilense de kaybolmuyor), "Taslak Kaydet" artık gerçek `POST`'a yazıyor (saving state + toast). **"Notları Gönder" (finalize) hâlâ "yakında"** — `Enrollment.result` snapshot'lama ayrı iş (`grade.finalize`, kilitleme mantığı), bu turun kapsamı dışında.
- **Ödev Notu da bağlandı (aynı gün devam):** "Notları Kaydet" artık net puanı (puan−ceza) `Grade.assignmentScore`'a `POST /api/flexos/grades` ile yazıyor; ödev tekrar açılınca `GET /api/flexos/grades?groupId=` ile ön-doluyor. **Bilinen kısıt (kasıtlı, dokümante):** `assignmentScore` enrollment başına TEK alan (per-assignment ayrı saklama yok) — bu yüzden en son kaydedilen ödevin net puanı geçerli olur, birden fazla ödev farklı skorları üst üste yazar. Otomatik hesaplama (Submission tamamlanma oranından) gelince bu geçici kısıt kalkacak. Dummy veri fallback'i (`DUMMY_GROUPS`/`dummyRosterFor`/`dummyAssignmentsFor`) KORUNDU — kullanıcı talebi.
- **`CertificateSettings` backend BİTTİ + bağlandı, SONRA İKİ KATMANLI'ya EVRİLDİ (aynı gün devam):** Kullanıcı kararı: standalone/Core modda merkezi Op/Admin yok, o yüzden HER EĞİTMEN kendi sertifika hesaplama kuralını (Ödev notu aç/kapa + ağırlık) belirleyebilmeli; kendi kuralını vermeyen eğitmen tenant varsayılanına düşer.
  - **Model:** `CertificateSettings.trainerId` opsiyonel alan — boşsa **tenant varsayılanı** (doküman id=tenantId, Op/Admin yönetir, `certificate.settings.write` **org scope**), doluysa **eğitmenin KİŞİSEL override'ı** (doküman id=`${tenantId}_${trainerId}`, aynı capability ama **self scope** — yalnız `EGITMEN_STANDALONE_EXTRA`'da, yani SADECE standalone/Core modda; Full/entegre modda eğitmenin bu capability'si hiç yok).
  - **Okuma (`getCertificateSettings`):** `widestScope(actor,"certificate.settings.write")==="self"` ise önce eğitmenin kendi override'ına bakar, yoksa tenant varsayılanına düşer (o da yoksa sabit varsayılan `%70/%30` açık).
  - **Yazma (`updateCertificateSettings`):** scope'a göre dallanır — org (Op/Admin) → tenant varsayılanını yazar; self (standalone eğitmen) → yalnız kendi `trainerId`'li kaydını yazar, diğer eğitmenleri/tenantı ETKİLEMEZ.
  - Route `/api/flexos/certificate-settings` (GET/PATCH) değişmedi — dallanma tamamen serviste. Firestore `flexos_certificate_settings` (server-only rules), repo'ya `getByTrainer` eklendi.
  - **16 assertion geçti** (`scripts/assert-certificate-settings.ts`, standaloneMode true/false + kendi kural/kuralsız/başka-eğitmeni-etkilememe senaryoları dahil). Diğer 12 assertion script'i de (190+ assertion toplam) hâlâ yeşil — `packages.ts` değişikliği regresyon yaratmadı. `tsc`+ESLint+build temiz.
  - **Sertifika Ayarları sayfası:** mount'ta `GET` ile yükler, "Ayarları Kaydet" → `PATCH`; API yanıtında `trainerId` varsa üstte turuncu "Bu senin kişisel ayarın" rozeti, yoksa mavi "Tenant varsayılanı" rozeti gösterir. Full moddaki eğitmen kaydetmeye çalışırsa 403 → açıklayıcı toast ("yalnız Operasyon/Yönetici değiştirebilir").
  - **Sertifika Notu sayfası:** `odevAktif`/`sertifikaPct`'yi hâlâ aynı `GET`'ten okuyor — hangi katmandan geldiği (kendi/tenant) sayfa için şeffaf, sadece doğru sayılar geliyor.
  - Menü görünürlüğü ekstra iş gerektirmedi: Sertifikasyon akordiyonu zaten `grade.finalize` sahibi herkese (eğitmen dahil, her iki modda) açık — kullanıcının "eğitmen menüsünde görünsün" isteği yapısal olarak zaten karşılanıyordu.
- **`certType` (Sınav Bazlı/Proje Bazlı) Sertifika Notu'na bağlandı, SONRA DÜZELTİLDİ (aynı gün devam):** `Education.certType` (katalogda zaten vardı, `eduos/education.ts`) sertifika hesabını KISITLAMAZ. İlk turda "sınav bazlı branşta etiket 'Sınav Notu' olsun" denendi ama kullanıcı DÜZELTTİ: **alan adı HER ZAMAN "Sertifika Notu" kalır** — ayrı bir "Sınav Notu" kavramı YOK ("sınav notu gelir, sertifika notunu OLUŞTURUR"; ileride sınav modülü de aynı `Grade.projectGrade` alanına yazacak). `certType` yalnız **hangi ağırlık bloğunun** kullanılacağını seçer.
  - **`CertificateSettings` İKİ AYRI BLOĞA bölündü** (`project`/`exam`, her biri kendi `{odevAktif, sertifikaPct}`): proje bazlı eğitimlerde ödev notu varsayılan AÇIK (%70/%30), sınav bazlı eğitimlerde (Office gibi) varsayılan KAPALI (%100) — ama kullanıcı kararı: **ikisi de bağımsız açılıp kapatılabilir** (sınav bazlı branşta custom/anlık ödev verilmişse istenirse o da sertifikaya katkı yapabilir; certType hiçbir şeyi hard-gate ETMEZ).
  - `GET /api/flexos/groups` yanıtına `certType` eklendi (mevcut Education join'inden, ekstra sorgu yok). Sertifika Notu sayfası seçili grubun `certType`'ına göre `settings.project`/`settings.exam`'den doğru ağırlığı seçer, etiket sabit "Sertifika Notu" kalır.
  - Sertifika Ayarları sayfası artık **2 sekmeli** (Proje Bazlı / Sınav Bazlı), "Ayarları Kaydet" ikisini birlikte `PATCH` eder (`{project, exam}` body).
  - **21 assertion geçti** (`scripts/assert-certificate-settings.ts`, iki blok + standalone/Full + kendi-kural/kuralsız senaryoları). Toplam 195 assertion (13 script) yeşil. `tsc`+ESLint+build temiz.
- **Ödev Notu per-assignment saklama kısıtı ÇÖZÜLDÜ (aynı gün devam, 2026-07-06):** Kullanıcı kararı — her ödevin kendi puanı var (100/200/300 gibi), bunlar toplanır, `Grade.assignmentScore` (enrollment başına TEK alan, üst üste yazan) TAMAMEN KALDIRILDI.
  - **`Assignment.maxPuan?: number`** eklendi (varsayılan 100 — "özel" ödevler 200/300 olabilir). `assignTask`/`updateAssignment` kabul ediyor (pozitif validasyon).
  - **`Submission.grade`** (zaten vardı, `submission.grade` capability + `PATCH /api/flexos/submissions/[id]/grade` route zaten kuruluydu) artık aralığı `0..assignment.maxPuan` (`gradeSubmission` assignment'ı çekip doğruluyor, sabit 0-100 kaldırıldı) — ödev başına KALICI, üst üste yazmıyor.
  - **`computeOdevYuzdeleri(tenantId, groupId, deps)`** (yeni, `submission-service.ts`) — grup içindeki TÜM yayınlanmış ödevlerin `maxPuan` toplamı (payda) + her kişinin kazandığı `Submission.grade` toplamı (pay), OKUMA ANINDA hesaplanır, HİÇBİR YERE YAZILMAZ. Taslak/arşiv ödevler paydaya girmez. Grupta hiç ödev yoksa `totalMaxPuan=0` → "veri yok", sertifika hesabı Sertifika Notu'na düşer.
  - **`Grade` entity'den `assignmentScore` KALDIRILDI** — artık sadece `projectGrade` (Sertifika/Sınav notu) saklıyor.
  - **`GET /api/flexos/grades`** yanıtına `odev: {totalMaxPuan, earnedByPerson}` eklendi (mevcut `items`'ın yanına) — istemci yüzdeyi kendi türetiyor.
  - **Sertifika Notu sayfası:** Ödev Notu sütunu artık EDİTLENEMEZ — salt-okunur, otomatik hesaplanan `%X` rozeti (input kaldırıldı). Ayar açık ama grupta hiç ödev yoksa (veri yok) toplam hesaba Ödev Notu hiç girmez, sadece Sertifika Notu esas alınır.
  - **Ödev Notu sayfası:** "Notları Kaydet" artık her öğrencinin net puanını (puan−ceza) DOĞRUDAN `Submission.grade`'e yazıyor (`PATCH /submissions/[id]/grade`, `Promise.all` — çoklu istek). Teslimi olmayan öğrenci notlanamaz (Submission dokümanı yok — zaten payda hesabında 0 sayılır, ekstra işlem gerekmez). `MAX_PUAN` artık sabit değil, her ödevin kendi `maxPuan`'ından okunuyor. Dummy veri fallback'i KORUNDU.
  - **30 assertion geçti** (`scripts/assert-submission.ts`: maxPuan sınırı + `computeOdevYuzdeleri` — toplama/boş-grup/taslak-hariç senaryoları). Toplam **202 assertion (13 script)** yeşil. `tsc`+ESLint+build temiz.
- **Ödev Notu'nun İÇ ağırlıklandırması eklendi (aynı gün devam, 2026-07-06):** Kullanıcı kararı — Ödev Notu tek bir havuz değil, `normal` ödevler (%30) ve `proje` ödevler (%70) diye AYRI ağırlıklandırılan iki kategori; bu SABİT iş kuralı, Sertifika Ayarları'ndaki dışsal Sertifika/Ödev ağırlığından (`CertificateSettings.sertifikaPct`) TAMAMEN AYRI bir eksen — ikisi karıştırılmamalı.
  - **`Assignment.kind?: "normal" | "proje"`** eklendi (varsayılan "normal"). `assignTask`/`updateAssignment` kabul ediyor + validasyon.
  - **`computeOdevYuzdeleri`** artık `{normal, proje}` diye iki ayrı kategori döndürüyor (her biri kendi `totalMaxPuan`+`earnedByPerson`'ı ile) — eskiden tek düz `{totalMaxPuan, earnedByPerson}` idi.
  - **`combineOdevYuzdesi(result, personId)`** (yeni, `submission-service.ts`) — `ODEV_TUR_AGIRLIK = {normal:30, proje:70}` ile ağırlıklı nihai yüzdeyi hesaplar. Bir kategori hiç yoksa ağırlık TAMAMEN diğerine kayar (100%); ikisi de yoksa `null` (veri yok, sertifika hesabı Sertifika Notu'na düşer).
  - **Sertifika Notu sayfası:** `odevYuzdesi()` artık aynı ağırlıklı formülü client-side uyguluyor (submission-service.ts'teki sabitle senkron, yorumla işaretli).
  - **Ödev Notu sayfası:** ödev listesinde `proje` türü ödevler mor "Proje" rozetiyle işaretleniyor (görsel ayrım, düşük maliyetli dokunuş).
  - **5 yeni assertion** (`scripts/assert-submission.ts`, toplam 35): kategori ayrımı, tek-kategori-varken-tam-ağırlık, ağırlıklı-karışık-hesap (normal %100 + proje %50 → %65), veri-yok senaryosu. Toplam **207 assertion (13 script)** yeşil. `tsc`+ESLint+build temiz.
- **"Notları Gönder" akışı NETLEŞTİ (henüz KOD YOK, kullanıcı "bunlar sonra" dedi — 2026-07-06):** Bu akış aslında §5.2'de (Sertifika Verme Akışı) zaten tasarlanmıştı, kullanıcı bugün TEYİT etti + bir noktayı YUMUŞATTI:
  - **Ayrı bir "gönder/kilitle" adımı YOK** — eğitmen not girdiği an (Taslak Kaydet), Eğitim Op ZATEN aynı Grade kaydını görüyor (paylaşımlı okuma, ek bir "submit" gerekmiyor). Sertifika Notu ekranı ile Eğitim Op'un göreceği ekran **AYNI** — tek fark Op'ta her öğrenci satırında ekstra **"Sertifika Bastır"** butonu olması.
  - **Not DEĞİŞTİRİLEBİLİR kalır** (eskiden `FrozenResult` docstring'inde "DEĞİŞMEZ" yazıyordu — bu YUMUŞATILDI): sertifika basıldıktan sonra bile elzem durumlarda yetkili kişi (Op/Admin) notu düzeltebilmeli. Sert bir freeze/immutable snapshot YOK.
  - **Sertifika Bastır** → sistem notu görüp `%90` Başarı / `%50` Katılım eşiğine göre otomatik doğru sertifika türünü seçip basar (mevcut Sertifika Notu sayfasındaki durum-chip mantığıyla AYNI eşikler).
  - **Basım anında otomatik mail** öğrenciye gider ("Sertifikanız hazır"); SMS entegrasyonu ve mail şablonu İLERİDE (kullanıcı: "bunlar sonra").
  - **Kod YAZILMADI** — bu sadece tasarım teyidi. Sıradaki iş buysa: `certificate.issue`/`certificate.read` capability'lerini registry+packages'a eklemek (tasarımda zaten var, §3.3 tablo) + Eğitim Op'un "Sertifika Notu" görünümüne (aynı sayfa, yetki bazlı ekstra buton) + basım/mail tetikleme servisi.
- **✅ "Ödev Oluştur" modalı BİTTİ (aynı gün devam, 2026-07-06):** Kullanıcı Claude Design çıktısı verdi (`Ödev Oluştur.dc.html`), Ödev Parkuru'ndaki "+Ödev Ver" butonuna bağlandı (`egitmen-anasayfa/OdevOlusturModal.tsx`).
  - **Alanlar:** İkon seçimi (16 lucide ikon, kozmetik — `Assignment.icon`), Ödev Adı, Alt Başlık (`Assignment.subtitle` — YENİ alan, **Ödev Parkuru kartında da gösteriliyor**, başlığın altında ayrı satır), Ödev Türü (Ödev/Proje → mevcut `kind` alanına bağlı, Ödev Notu iç ağırlıklandırmasını besler), Grup, Bitiş Tarihi, Ödev Puanı (hızlı seçim 100/150/200/250/300 → `maxPuan`), Açıklama, "Şablon olarak kaydet" toggle.
  - **"Şablon olarak kaydet" → KİŞİSEL kütüphane (2026-07-06 kararı, ayrı netleştirme):** "Global kütüphane sadece admine özel" ama bu ERTELENDİ ("sonra yapacağız") — BU turda sadece KİŞİSEL: her eğitmen kendi şablonunu kaydedebilir, sadece kendisi görür. `AssignmentTemplate`'e `scope:"personal"|"global"` + `trainerId` eklendi; `template.manage` capability'si **aynı key, scope'a göre dallanıyor** (self→personal, org/Op-Admin→global, certificate.settings.write ile AYNI desen). `listTemplates` artık scope'a göre filtreliyor (kişisel sadece sahibine, global herkese). **3 yeni assertion** (`assert-assignment.ts`, toplam 20): eğitmen kişisel şablon oluşturabilir, başka eğitmenin kişiselini göremez, global herkese açık kalır.
  - **Geçiş animasyonu:** framer-motion, FlexOS'un paylaşımlı `FlexModal.tsx` ile AYNI değerler (backdrop 0.18s fade, panel 0.24s scale/y cubic-bezier) — canlıdaki `management-components/Modals.tsx` modal deseniyle uyumlu.
  - **Layout — kullanıcı geri bildirimiyle 2 tur revize edildi:** (1) küçük ekranda dikey scroll çıkıyordu → alanlar aynı satırda gruplandı (tür+grup+tarih tek satır), modal genişletildi (880→960px) + kısaltıldı (760→600px). (2) sıralama değişti: Ödev Adı üstte, Alt Başlık altında (aynı sütun), İkon Seçimi sağda uzun/dikey buton (`items-stretch` ile iki input'un toplam yüksekliğine eşit).
  - `tsc`+ESLint+`npm run build` temiz. Toplam **210 assertion (13 script)** yeşil.
  - **Layout — kullanıcıyla ~8 tur revize edildi (aynı gün) — NİHAİ HÂL:** modal `maxWidth:860px`, yükseklik `min(770px, calc(100dvh-32px))` (`100vh` DEĞİL — `dvh` kullanılıyor, tarayıcı chrome'u genişleyip daraldıkça `vh` değişip modalı kaydırıyordu). Her yönde **24px padding** (header/body/footer). Etiketler 12.5px font + `mb-2`, body satır arası boşluk `gap-4` (16px) — "öğe araları çok dar" geri bildirimiyle büyütüldü. Açıklama **sabit `rows={4}`** (flex-grow'lu deneme görsel çakışmaya sebep olmuştu, kaldırıldı). Son satır: **"Ödev Dosyası Yükle" (sol, placeholder) + "Şablon olarak kaydet" (sağda, kompakt toggle kart)** yan yana, dosya yükleme metni sola yaslı.
  - **Backdrop'un KENDİ `overflow-y-auto`'su kaldırıldı** (2026-07-06 düzeltme) — modal zaten `dvh`'ye göre sığacak şekilde sınırlı, backdrop'un scroll'a hiç ihtiyacı yoktu; scrollbar belirip kaybolması (Mac'te "scrollbar'ları hep göster" ayarı açıkken ~15px) küçük bir kayma hissi yaratıyordu. İçerik taşarsa SADECE modalın kendi body'si kayar.
  - **"Ödev Dosyası Yükle" BİLEREK PLACEHOLDER — kullanıcı: "bu kısım sonra olur" (2026-07-06):** Sürükle-bırak + çoklu dosya + otomatik yükleme istendi (Drive'a). Backend YOK — kutu "yakında" toast'ı veriyor. **Kullanıcının belirttiği hedef klasör yapısı (ileride kurulunca uygulanacak):** `Grup Adı > Eğitmen Adı > Ödev Adı`. Kurulacağı zaman muhtemelen `submission-service.ts`'teki `initUpload`/`completeUpload` resumable-session deseninin (Drive entegrasyonu zaten var, `DriveDeps`) ödev-eki için genellenmesi gerekecek — assignmentId henüz yokken (oluşturma anında) upload edilebilmesi için grup+eğitmen bazlı ayrı bir session modeli lazım (Assignment'a değil).
  - **KALAN (küçük):** Ghost kart üzerindeki "Ödev Ver" (şablonu aktive et, `AssignActivateModal` karşılığı) ve "Detay" hâlâ "yakında".

### 🔵 Sertifikasyon — Sertifika Ayarları UI portlandı, ÜÇÜ de tamam ama HİÇBİRİ backend'e bağlı değil (2026-07-06, aynı gün devam)

`/flexos/sertifikasyon/ayarlar` — Claude Design çıktısından (`Sertifika Ayarları.dc.html`) birebir port: "Ödev notu sertifika hesabında kullanılsın" toggle'ı + (açıksa) bağlı Sertifika/Ödev ağırlık slider'ları (toplam hep %100) + hızlı ön ayarlar (%100/%70-30/%60-40/%50-50) + koyu lacivert "Örnek Hesaplama" kartı (80×sertifika + 90×ödev = toplam) + kapalıyken dashed bilgi kutusu. Tamamen local state, "Ayarları Kaydet" "yakında" toast'ı.

**Sertifikasyon menüsü artık 3 sayfa da UI olarak tamam** (Sertifika Notu, Ödev Notu, Sertifika Ayarları) — **hiçbiri gerçek backend'e yazmıyor/okumuyor** (grup/ödev/öğrenci listeleri gerçek, ama notlar/ayarlar local state). Bu ayarlar sayfasındaki toggle, Sertifika Notu'nda kaldırılan switch'in YERİNİ tutacak şekilde tasarlandı (kullanıcı: "sertifika ayarlarına ödev notu aç/kapa ekleyeceğiz, oradan kapatınca buraya da otomatik yansıyacak") — ama bu bağlantı henüz KURULMADI (ikisi de kendi local state'inde, ortak bir kaynağa bağlı değil). Backend kurulunca: tek bir `CertificateSettings` (tenant-level, muhtemelen `odevAktif`+`sertifikaPct`) kaydı hem Ayarlar sayfasını hem Sertifika Notu'nun sütun görünürlüğünü hem Ödev Notu'nun (otomatik puan) hesaplama mantığını beslemeli.

`tsc`/`eslint`/`build` temiz.

### 🔵 Sertifikasyon — Ödev Notu UI portlandı, backend YOK (2026-07-06, aynı gün devam)

Sidebar'a **Ödev Notu** eklendi (Sertifika Notu ile Sertifika Ayarları arasına — kullanıcı sırası: "Sertifika Notu, sonra ödev notu gelecek"). Kullanıcı Claude Design çıktısı verdi (`Ödev Notu Verme.dc.html`), "sayfası hazır, hemen yap" dedi.

- **`/flexos/sertifikasyon/odev-notu`** — 2 görünüm: (1) grup seç → o grubun ödevleri liste halinde (durum özeti: Bekliyor/X-Y puanlandı/Tamamlandı), (2) bir ödeve tıklayınca öğrenci bazlı puanlama tablosu (Teslim Durumu dropdown: Teslim etti/1 hafta gecikmeli/2 hafta+ gecikmeli/Teslim etmedi → gecikme cezası %0/%10/%20/%100, Ödev Puanı input, Net Puan = puan−ceza).
- **Grup/ödev/öğrenci listesi GERÇEK veri** (`GET /api/flexos/groups` + `GET /api/flexos/assignments?groupId=` + roster) — canlıdaki gibi sahte "GRP-01" verisi yok, gerçek Faz1/2 assignment domain'i kullanıldı. Teslim Durumu her öğrenci için gerçek `Submission`'dan ÖN-DOLDURULUYOR (`GET /api/flexos/submissions?assignmentId=` — teslim var mı yok mu → "Teslim etti"/"Teslim etmedi" başlangıç değeri), ama sonrası (dropdown değişimi, puan girişi, kaydetme) sadece local state.
- **`maxPuan` sabit 100** — Assignment entity'sinde henüz puan alanı yok.
- Kullanıcı önemli notu (henüz UYGULANMADI, sadece kayıt): "Ödev notu puanı normalde ELLE girilmeyecek — öğrenci ödevlerini tamamladıysa otomatik hesaplanıp sabitlenecek." Yani bu manuel puanlama ekranı GEÇİCİ/ara adım; asıl hedef Submission tamamlanma oranından otomatik puan üretimi. Backend (Grade domain — zaten `education/grade.ts`'te entity var ama repo/servis yok) kurulunca bu sayfa muhtemelen büyük ölçüde otomatikleşecek ya da sadece istisna/override ekranına dönüşecek.

`tsc`/`eslint`/`build` temiz.

### 🔵 Sertifikasyon — Sertifika Notu UI portlandı, backend YOK (2026-07-06)

Ödev işi kullanıcı kararıyla duraklatıldı ("ödevler burada dursun, sonra devam ederiz") — yeni öncelik: **Sertifikasyon** menüsü (Sertifika Notu + Sertifika Ayarları). Kullanıcı Claude Design çıktısı verdi (`Sertifika Not Verme.dc.html`) ve "UI kısmını en önce yapalım" dedi.

- Sidebar'a **Sertifikasyon** akordiyonu: **Sertifika Notu** (`/flexos/sertifikasyon/not`, kuruldu) + **Sertifika Ayarları** (henüz "yakında" — tasarımı gelecek).
- **Sertifika Notu** — tasarımdan BİREBİR görsel port: sol sabit grup listesi (renkli çubuk + seçili tik), sağda toolbar (grup bilgisi + "Ödev Notu" aç/kapa toggle + ağırlık rozeti `%70/%30` veya `%100`) + öğrenci not tablosu (avatar+isim, Sertifika Notu input, Ödev Notu input — toggle'a göre gizli/görünür, Toplam Not (ağırlıklı hesap, renkli rozet), Durum chip: `≥90` Başarı Sertifikası yeşil / `≥50` Katılım Sertifikası mavi / altı boş).
- **Grup + öğrenci listesi GERÇEK veri** (`GET /api/flexos/groups` + `GET /api/flexos/groups/[id]/roster`) — sahte isim yok.
- **Backend BİLEREK YOK bu turda** — `Grade` domain entity zaten tanımlıydı (`domain/education/grade.ts`, `id=enrollmentId`, `projectGrade`/`assignmentScore`/`components`) ama repo/servis/route hiç kurulmamıştı. Notlar şimdilik SADECE local state'te (`sayfa yenilenince kaybolur`), "Taslak Kaydet"/"Notları Gönder" butonları "yakında" toast'ı veriyor — bir sonraki adım bu domain'i (Faz 1/2 desenindeki gibi: repo+servis+capability-gated route+assertion) kurup bu UI'ı ona bağlamak.

`tsc`/`eslint`/`build` temiz.

### ✅ Şablon havuzu kararı netleşti + Ana Sayfa'dan Ödev Kütüphanesi kaldırıldı (2026-07-06)

Kullanıcı kararı: canlıdaki mevcut şablonlar (özellikle **oyunlaştırılmış olanlar**) global bir **template ödev kütüphanesi** olarak saklanacak; herhangi bir tasarım eğitmeni oradan kendi kütüphanesine **duplicate/kopyala** diyebilecek (`templateKind: "standard"|"system"` + deep-copy tasarımıyla örtüşüyor, [[flexos_odev_faz2_submission_2026_07_05]]). **Ama** bu kütüphane Eğitmen Ana Sayfa'da GÖSTERİLMEYECEK — kullanıcı: "anasayfada alt kütüphane kısmında kişisel ve global olmayacak, hiç bişi yazmayacak... muhtemelen Ödev Yönetimi içine ekleriz."

Buna göre `egitmen-anasayfa/page.tsx`'teki placeholder "Ödev Kütüphanesi" (Kişisel/Global tab'lı) bölümü **tamamen kaldırıldı** — henüz gerçek şablon-duplicate tasarımı kodlanmadığı için (kullanıcı: "kütüphaneyi kaldırsan bile sakın canlıdakilere dokunma" — FlexOS zaten `flexos_assignment_templates` ayrı koleksiyonunu kullanıyor, canlı `templates`'a hiç dokunulmadı/dokunulmuyor). Şablon kütüphanesi ileride muhtemelen Ödev Yönetimi'ne ("Şablon Yönetimi" sekmesi olarak) eklenecek — henüz kod yok, sadece karar.

`tsc`/`eslint`/`build` temiz.

### ✅ Ödev Parkuru (Eğitmen Ana Sayfa) — gerçek veriye bağlandı, GÖRÜNÜM only (2026-07-06)

Kullanıcı: "Ödev Yönetimi'nde neden Yeni Ödev butonu var, orası sadece verilmiş ödevlerin listesi" → doğru, canlıda `TaskManagementPanel`'in Mevcut Ödevler/Arşiv sekmelerinde oluşturma YOK (sadece düzenle/sil/arşivle) — buton kaldırıldı. Gerçek oluşturma noktası **Eğitmen Ana Sayfa**'daki "Ödev Parkuru": sağ üstte turuncu "+Ödev Ver", altında kart grid'i.

Canlıdaki `DesignParkour.tsx` (1070 satır, `dashboard/page.tsx`'te `maxSlots={4} compact`) tam okunup mantığı çözüldü: **3 kart türü, sırayla doldurulur:**
1. Gerçek aktif ödevler (en yeni solda, `createdAt` DESC).
2. Kalan slotlar → kullanılmamış şablonlardan "ghost" kart (GERÇEK isim/açıklama ama soluk/pasif stil — kesikli border, "Pasif" durumu, disabled buton), deterministik karıştırma (id-hash `%7`, her render'da rastgele değişmez).
3. Hâlâ slot kalırsa tamamen boş skeleton placeholder.

Kullanıcı onaylı kademeli kapsam: **bu turda SADECE kart görünümü** — `egitmen-anasayfa/page.tsx`'teki `OdevParkuru()` artık `/api/flexos/assignments` + `/api/flexos/assignment-templates`'ten gerçek veri çekiyor, 3 kart türünü doğru sırada/sayıda render ediyor. **Aksiyonlar (Ödev Ver, Ödevi Başlat, Detay) hâlâ "yakında" toast** — canlıdaki `QuickAssignModal`/`AssignActivateModal`/düzenle-bitir-iptal modalları henüz portlanmadı, ayrı bir iş kalemi. "Ödev Teslimi" hızlı aksiyon kartı da (`href={null}` idi) gerçek sayfaya bağlandı.

`tsc`/`eslint`/`build` temiz.

### ✅ Ödev Verme — Eğitmen tarafı "Ödev Teslimi" + "Ödev Yönetimi" BİTTİ (2026-07-05/06)

Sidebar'a **"Ödevler"** akordiyonu: **Ödev Yönetimi** / **Ödev Teslimi** / **Ödev Değerlendirme** (üçüncüsü henüz "yakında", en sona bırakıldı — notlandırma).

**⚠️ Bu ikisi AYRI ekranlar, karıştırılmamalı** (bir ara yanlışlıkla birleştirilip geri ayrıldı, bkz. aşağıdaki düzeltme notu):
- **Ödev Teslimi** (`/flexos/odevler/teslim`) — canlıdaki 3 kademeli akışın (`dashboard/assignment/page.tsx` → `[groupId]/page.tsx` → `[groupId]/[assignmentId]/page.tsx`) **birebir görsel** portu ("grup kartları falan orada, birebir istiyorum" talebiyle): grup kartları (`GroupCard`, renk paleti/arşivleme modalı BİREBİR) → grubun ödev listesi (accordion, teslim/bekleyen/revize istatistikleri, SALT-OKUNUR — oluşturma/düzenleme YOK burada) → tek ödevin master-detail teslim ekranı (öğrenci listesi + dosyalar + yorum paneli). Kullanıcı kararı: "notlandırma sistemini en son yapacağız — ödev verme/alma canlı çalışsın şimdi" → **grading aksiyonları (Revize İste/Onayla) BİLEREK YOK**, sadece görüntüleme + yorumlaşma.
- **Ödev Yönetimi** (`/flexos/odevler/yonetim`) — canlıdaki `TaskManagementPanel.tsx` (1095 satır, `/dashboard/tasks`, global 5 sekmeli ayarlar sayfası: Şablon Yönetimi/Mevcut Ödevler/Arşiv/Ödev Havuzları/Lig) — **GRUP KARTI DEĞİL, TEK global tablo** (grup sadece bir sütun). Kullanıcı onaylı kademeli kapsam: şimdilik SADECE **Mevcut Ödevler + Arşiv** sekmeleri — global tablo (tüm gruplardaki ödevler tek listede, grup/durum/teslim tarihi sütunlu), "Yeni Ödev" modalında Grup seçimi zorunlu, düzenle/sil/arşivle/aktife-al, arşivde toplu seç+sil. **Şablon Yönetimi + Ödev Havuzları henüz YOK** — kullanıcının oyunlaştırılmış şablonları için önemli olduğu belirtildi ama `templateKind: "standard"|"system"` + duplicate/deep-copy tasarım kararı henüz verilmedi (bkz. [[flexos_odev_faz2_submission_2026_07_05]]), karar netleşince eklenecek. **Lig Yönetimi hiç YOK** (kullanıcı kararı: ayrı/opsiyonel modül). FlexOS'un TEK canonical `assignTask`/`updateAssignment`/`deleteAssignment` servisine bağlı.

**Düzeltme geçmişi (aynı gün, ders çıkarılacak — 3 tur yanlış anlama):** (1) Önce Ödev Yönetimi'ni Ödev Teslimi'nin neredeyse kopyası (grup kartı → CRUD) olarak yaptım → kullanıcı "aynı sayfa" dedi → bunu "birleştir/sil" diye yanlış yorumlayıp Yönetimi SİLDİM. (2) Kullanıcı düzeltti: "canlıya bak, sildin" → geri EKLEDİM ama yine grup-kartı deseniyle (aynı hata). (3) Kullanıcı canlı URL'i verdi (`/dashboard/tasks`) → gerçekten okundu: TaskManagementPanel **HİÇ grup-kartı kullanmıyor**, global tablo. Doğru versiyon böyle kuruldu. **Ders:** kullanıcı bir sayfayı "aynı/yanlış" diye eleştirdiğinde önce canlıdaki GERÇEK karşılığını (URL'i varsa) tekrar oku — varsayımla düzeltme yapma, ikinci kez de yanlış çıkabilir.

**Yeni backend parçası:** `getSubmissionForStaff` (`submission-service.ts`) + `GET /api/flexos/submissions/[id]` — tek bir teslimin dosyalarını+sahibini döner (`submission.read` gated, grup-scope kontrollü). Diğer her şey Faz 1/2/3'te zaten kurulan servis/route'ları reuse ediyor (assignment CRUD, submission listeleme, comment-service).

Artık uçtan uca döngü test edilebilir: Ödev Yönetimi'nde ödev oluştur → Ödev Teslimi'nde/öğrenci `/flexos/student/[personId]` üzerinden yükler → eğitmen Ödev Teslimi'nde teslimi görür + yorum yazar.

`tsc --noEmit` + `eslint` + `npm run build` temiz. `assert-submission.ts` (23), `assert-comment.ts` (20), `assert-assignment.ts` (18) regresyon yok. **Test edilmeyen:** tarayıcıda gerçek veriyle uçtan uca kontrol edilmedi.

### ✅ Ödev Verme — Faz 3 (Öğrenci ekranları) + Yorum/Bildirim domain'i BİTTİ (2026-07-05)

Kullanıcı: "canlıdakini birebir alacaksın görünüm ve işleyiş olarak" — canlıdaki `/student/[studentId]/page.tsx` (651 satır) + `/student/[studentId]/[taskId]/page.tsx` (1038 satır) tam okunup FlexOS'a portlandı: `src/app/flexos/student/[personId]/page.tsx` (dashboard: filtre pilleri, accordion ödev listesi, Duyurular paneli) + `src/app/flexos/student/[personId]/[assignmentId]/page.tsx` (drag-drop + 256KB chunk'lı resumable upload, Teslim Geçmişi, geri çekme, sağda 1:1 yorum paneli). **Bilinçli farklar:** SVG karakter avatarı yerine FlexOS'un her yerdeki initials+gradient dairesi (kullanıcı kararı), Sınıf Ligi widget'ı YOK (ayrı roadmap kalemi), accordion'da ResizeObserver animasyonu yerine düz conditional render (basitleştirme).

**Kullanıcı itirazı üzerine kapsam büyütüldü — yorum/bildirim "can damarı" (Faz 4'ten öne çekildi):** Faz 4'e bırakılması planlanan yorum/duyuru sistemi, kullanıcının "öğrenci yükler, ben yorum yazamazsam ödevin hiç önemi kalmaz" itirazı üzerine ŞİMDİ kuruldu:
- `domain/core/comment.ts` — TEK `Comment` entity: `personId` doluysa 1:1 thread (eğitmen↔öğrenci, submission olmasa bile çalışır — canlıyla aynı), boşsa genel duyuru (gruptaki herkes görür, SADECE eğitmen/op yazar).
- Yeni capability `assignment.comment.write` (egitmen assigned, op/admin org) — öğrencinin kendi thread'ine yazması/düzenlemesi/silmesi ise capability DIŞINDA, Faz 2/3 sahiplik deseniyle aynı (`authorUid`/`person.authUid` eşleşmesi).
- `comment-service.ts`: `postGeneralComment`/`postThreadCommentAsStaff` (gated) + `postThreadCommentAsStudent`/`list*ForStudent` (sahiplik) + `editOwnComment`/`deleteOwnComment` (rol farketmez, SADECE `authorUid` sahipliği — canlının `canAct` mantığıyla aynı) + `listAnnouncementsForStudent` (kişinin aktif olduğu TÜM gruplardaki duyurular, dashboard için).
- **Bildirim/toast — YENİ SİSTEM İCAT EDİLMEDİ:** proje kökünde zaten global `NotificationToastListener` + `Toaster` (sonner) + `users/{uid}/notifications` (canlının `complete-upload` route'unun yazdığı AYNI koleksiyon/kural) çalışıyordu — `lib/server/flexos-notify.ts` sadece bu koleksiyona admin SDK ile doc yazıyor, geri kalan her şey (real-time onSnapshot, toast, okundu işaretleme, `NotificationBell` dropdown) zaten hazırdı. **Ekstra kazanç:** `FlexHeader.tsx`'teki bildirim zili daha önce sadece `toast.info("yakında")` stub'ıydı — gerçek `<NotificationBell/>` ile değiştirildi, artık TÜM FlexOS staff sayfalarında (20+ sayfa) çalışan bir bildirim geçmişi var.
- Yorumlar client'ta **polling** ile tazeleniyor (6sn, sekme arka plandayken durur) — `flexos_comments` için yeni bir Firestore client-rules açılımı YAPILMADI (bkz. `[[flexos_firestore_client_access_pattern]]` hafızası), anlık toast zaten yukarıdaki global sistemden geliyor.
- `EnrollmentRepo.listByPerson` eklendi (kişinin TÜM kayıtlarını bulmak için — önceki `findActive` sadece belirli bir grup+kişi çifti alıyordu); bu interface değişikliği `assert-cancel-sale.ts`/`assert-enrollment-status.ts`/`assert-lesson-exception.ts`/`assert-standalone-mode.ts`'teki fake repo'lara da yansıtıldı.
- Yeni route'lar: `/api/flexos/assignments/[id]/comments`(+`/thread`) (staff), `/api/flexos/student/assignments`(+`/[id]`, `/[id]/comments`, `/[id]/thread`) + `/api/flexos/student/announcements` + `/api/flexos/student/me` (öğrenci, sahiplik-gated), `/api/flexos/comments/[id]` (PATCH/DELETE, ortak sahiplik).
- `scripts/assert-comment.ts` — **20 assertion, hepsi geçti** (staff/öğrenci gating, bildirim tetikleme, çoklu-grup duyuru birleştirme, sahiplik-only edit/delete, org-scope, tenant izolasyonu). `assert-submission.ts` (23) ve `assert-assignment.ts` (18) regresyon olmadan geçmeye devam ediyor.

`tsc --noEmit` + `eslint` + `npm run build` temiz (yeni route'lar + iki öğrenci sayfası dahil). **Test edilmeyen:** tarayıcıda gerçek bir öğrenci hesabıyla uçtan uca doğrulanmadı (bu ortamda giriş yapılamıyor) — sıradaki oturumda gerçek bir öğrenci+eğitmen çifti ile upload→yorum→bildirim akışı canlı kontrol edilmeli. Ayrıca öğrenci "Ayarlar" (ses bildirimi) sayfası portlanmadı (kapsam dışı bırakıldı, istenirse eklenir).

### ✅ Ödev Verme — Faz 2 backend (Submission + Google Drive domain) BİTTİ (2026-07-05)

Faz 1'in üstüne: `Submission`/`SubmissionFile`/`UploadSession` (`src/app/lib/domain/core/submission.ts`). **Canlıdan tasarım farkı:** bir (assignment, kişi) çifti için TEK `Submission` dokümanı yaşar (canlıda her yükleme yeni doküman açıyordu, durum/not 3 dağınık yoldan değişiyordu). Dosya geçmişi `SubmissionFile` versiyonlamasında (`isLatest` bayrağı), `iteration` revizyon sonrası her yeni yüklemede artar.

**Capability'ler (registry.ts + packages.ts):** `submission.read`, `submission.status.write`, `submission.grade` — eğitmen `assigned` (kendi grubu), Operasyon/Admin `org`. Öğrencinin kendi teslimini yükleme/silme/geri çekmesi BİLEREK bu registry'nin dışında — capability yerine basit sahiplik kontrolü (`person.authUid === requesterUid`), canlının öğrenci-tarafı zaten Actor sisteminin tamamen dışında olduğu için (Faz 3 notuyla tutarlı).

**`submission-service.ts`** (TEK canonical servis): `initUpload`/`getSessionForChunk`/`completeUpload`/`deleteFile`/`retract` (öğrenci, sahiplik-gated) + `updateSubmissionStatus`/`gradeSubmission`/`listSubmissionsFor{Assignment,Group}` (eğitmen/op, capability-gated, `assignment-service.ts` ile birebir desen). `getMaxUploads` iş kuralı canlıyla birebir (`completed`→0, `revision`→8, diğer→5).

**Google Drive: `googledrive.ts` DEĞİŞTİRİLMEDEN reuse edildi** — `lib/server/submission-drive.ts` `DriveDeps` portunu (`domain/repo/drive-deps.ts`) gerçek `ensureFolderPath`/`initResumableSession`/`setPublicReadPermission`/`findFileByActualName`/`deleteFromDrive` fonksiyonlarıyla dolduruyor, aynı OAuth2 refresh-token + `GOOGLE_DRIVE_FOLDER_ID` env değişkenleri (.env.local'den, elle uğraşılmadı). FlexOS kendi izole alt-ağacını açıyor: `flexos/{tenantId}/{groupCode}/{personName}/{assignmentTitle}`.

**Route'lar (`/api/flexos/submissions/*`):** `init-resumable-upload`/`upload-chunk`(saf proxy, Firestore'a yazmaz)/`complete-upload`/`delete-file`/`retract` (öğrenci-tarafı, `withAuth` + sahiplik) + `GET /` (liste, `submission.read` gated, assigned-scope `trainerId` filtreli — `assignments/route.ts` deseniyle aynı) + `PATCH [id]/status`, `PATCH [id]/grade` (capability-gated).

Firestore: `flexos_submissions`, `flexos_submission_files`, `flexos_upload_sessions` (canlının `submissions`/`submission_files`/`upload_sessions`'ına dokunulmadı). `PersonRepo`'ya `findByAuthUid` eklendi (öğrenci sahiplik çözümü için).

`scripts/assert-submission.ts` — **23 assertion, hepsi geçti** (sahiplik/yetki gating, dosya boyutu/MIME validasyonu, max-upload limiti, revizyon döngüsü, org-scope bypass, retract iş kuralları, tenant izolasyonu) — gerçek Drive network çağrısı YAPILMADI, fake `DriveDeps` enjekte edildi.

`tsc --noEmit` + `eslint` + `npm run build` temiz (8 yeni route dahil). **UI YOK bu fazda** (Faz 3/4'e bırakıldı, kullanıcı kararı: "Ödev UI ve havuzlarını sonra düşünelim").

**Not — kullanıcıyla konuşulan ama Faz 2'ye dahil edilmeyen konular (sıradaki oturumlarda ele alınacak):**
- **Şablon havuzu yeniden tasarımı:** şu an kişisel + global havuz var; kullanıcının 3 adet oyunlaştırılmış (kura sistemli, özel kodlanmış animasyonlu — örn. kitap kapağı) şablonu var, hiçbir branş kullanmıyor. Karar: `templateKind: "standard" | "system"` ayrımı — `system` şablonlar SADECE kod deploy'uyla eklenir/değişir (UI'dan oluşturulamaz/silinemez), eğitmenler kütüphaneden **duplicate** edip kendi kişisel havuzuna alabilir; duplicate her `system` şablonun kendine özel payload'ını (örn. kitap kapağı listesi) DEEP-COPY ile izole bir kopyaya taşır (her template-tipinin kendi `cloneData` stratejisi gerekir — genel bir clone fonksiyonu yetmez). Henüz kod yazılmadı.
- **Öğrenci portalı:** ayrı ve kapsamlı bir modül olarak FlexOS bitince ele alınacak — ödev görme/gönderme/takip, not görme, talep, yoklama görme, sınav, anket. FlexOS içinde mi dışında mı olacağı henüz kararlaştırılmadı.

### ✅ Ödev Verme — Faz 1 backend (Assignment/Template domain) BİTTİ (2026-07-04, aynı gün devam)

Kullanıcı: eğitmen tarafında Yoklama'dan sonra kalan 2 ciddi alan — Ödev Verme/Alma + Not Girme (Sınıflar Ligi tamamen ayrı/opsiyonel, şimdilik yok). Önce canlıdaki mevcut sistemi bir agent'a inceletmiştik: **ödev oluşturma canlıda 2 bağımsız yoldan** oluyordu (`AssignmentLibrary.tsx` + `DesignParkour.tsx`, ikisi de kendi başına `addDoc`), **submission durum/not güncelleme 3 ayrı yoldan**, eğitmen tarafı dosya yükleme öğrenciden FARKLI endpoint kullanıyordu. **Önemli bulgu: DesignParkour "oyunlaştırılmış" değil** — XP/rozet/streak yok (grep'te çıkmadı), aynı `tasks`/`templates` verisi üzerine sadece farklı bir görsel cilt. Google Drive entegrasyonu (`googledrive.ts`) ise dikkatli yazılmış, kırılganlığı kod değil tek kişisel OAuth hesabı — olduğu gibi korunacak.

**Karar (plan onaylandı):** Bu dağınıklığı FlexOS'a taşımıyoruz — TEK canonical create-servis, TEK submission durum/not servisi. **Faz 1 = Assignment/Template domain, backend-only, Submission/Drive'a HİÇ dokunulmadı** (en riskli parça izole bir sonraki faza bırakıldı ki fake repo ile assert edilebilsin).

**Yapılanlar:**
- `src/app/lib/domain/core/assignment.ts` (Assignment+AssignmentAttachment) + `assignment-template.ts` (AssignmentTemplate) — canlıdaki `tasks`/`templates` karşılığı.
- Capability'ler: `assignment.create/edit/read/delete` + `template.manage` (registry.ts). Paket kablolama: `egitmen` (assigned scope, yoklama/not gibi çekirdek iş — standalone-only DEĞİL), `operasyon`+`admin` (org scope + `template.manage` — kütüphane küratörlüğü sadece Op/Admin, eğitmen sadece okur).
- Repo+Firestore adapter (`flexos_assignments`, `flexos_assignment_templates` — canlının `tasks`/`templates`'ına dokunulmadı).
- `assignment-service.ts`: `assignTask` (grup sahipliği `can(actor,"assignment.create",{groupId,ownerUid:group.trainerId})` ile kontrol — `attendance-service.ts`'teki desenle birebir), `updateAssignment`, `deleteAssignment`, `createTemplate`, `listTemplates`.
- Route'lar: `POST/GET /api/flexos/assignments` (GET'te assigned-scope aktör sunucu tarafında kendi ödevlerine daraltılır — `groups/route.ts`'teki `trainerId` zorlama deseniyle aynı), `PATCH/DELETE /api/flexos/assignments/[id]`, `GET/POST /api/flexos/assignment-templates`.
- `scripts/assert-assignment.ts` — **18 assertion, hepsi geçti** (yetki gating, scope izolasyonu, validasyon, tenant izolasyonu, template küratörlüğü).

`tsc --noEmit` + `eslint` + `npm run build` temiz (yeni 3 route dahil). **UI YOK bu fazda.**

**TAM FAZ PLANI (plan dosyası makineye özel/senkronlanmıyor, o yüzden burada tam kopyası):**

**Faz 2 (SIRADAKİ) — Submission + Google Drive:**
- Domain (outline, henüz yazılmadı): `Submission extends Audit` — `id, tenantId, assignmentId, personId, groupId, status ("pending"|"submitted"|"revision_requested"|"approved"|"rejected"), grade?, gradedAt?, gradedBy?, retractedAt?`. `SubmissionFile extends Audit` — `id, tenantId, submissionId, version, actualFileName, originalFileName, driveFileId, mimeType, fileSize, uploadedBy`. `UploadSession` — `id, tenantId, submissionId, personId, actualFileName, driveSessionUri, status, expiresAt` (canlıdaki 7 günlük TTL/idempotency deseni aynen).
- Yeni capability'ler: `submission.read`, `submission.grade`, `submission.status.write` (assignment.* ile aynı scope mantığı — egitmen assigned, operasyon/admin org).
- Canlının 3 durum/not güncelleme yolu (`PATCH .../status`, ayrı `PATCH .../grade`, dağınık client `updateDoc`) yerine **TEK servis** (`updateSubmissionStatus`/`gradeSubmission`).
- **Google Drive: `googledrive.ts` DEĞİŞTİRİLMEDEN reuse** — dosya zaten `ensureFolderPath(pathSegments, rootFolderId?)` opsiyonel folder-id parametresi alıyor (kod içinde doğrulandı). FlexOS servisi `ensureFolderPath(["flexos", tenantId, groupCode, personName], undefined)` ile kendi izole alt-ağacını açar, dönen folder-id'yi `uploadBufferToFolder`/`initResumableSession`'a verir. `googledrive.ts` dosyasının kendisine HİÇ dokunulmuyor.
- Canlının trainer-side `AttachmentManager`'ının kullandığı (`/api/instructor/init-file-upload`+`complete-file-upload`) ayrı/denetlenmemiş yol PORTLANMIYOR — sadece öğrenci tarafının kanonik akışı (`init-resumable-upload`→`upload-chunk`→`complete-upload`→`delete-file`/`retract`) taşınıyor, eğitmen referans-dosya-ekleme de aynı akışı kullanacak.
- Route'lar (Faz 2'de yazılacak): `/api/flexos/submissions/{init-resumable-upload,upload-chunk,complete-upload,delete-file,retract}` + durum/not güncelleme route'u.
- Assertion script'te Drive gerçek network çağrısı YAPILMAYACAK — fake "drive" dependency inject edilecek (aynı Map-backed repo deseni).

**Faz 3 — Öğrenci tarafı basit ekranlar:** Canlıda `/student/[studentId]/...` capability sisteminin TAMAMEN DIŞINDA, basit "uid = studentId eşleşmesi" kontrolüyle çalışıyor (staff Actor/paket sistemine hiç girmiyor). FlexOS'ta da aynı basit desen — henüz hiç FlexOS-farkında öğrenci route'u YOK (`src/app/student` sıfır FlexOS referansı içeriyor, `src/app/flexos/*` altında öğrenci-yüzü hiç yok), sıfırdan kurulacak. Kullanıcı kararı: "basitçe alsak da olur şu anda" — kapsamlı bir capability entegrasyonuna gerek yok.

**Faz 4 — Eğitmen "Ödev Alma"/not verme UI'ı:** Grading workspace (canlıdaki `[groupId]/[assignmentId]/page.tsx` + `grading/page.tsx`'in TEK canonical birleşimi), yorum thread'leri (`tasks/{id}/comments`, `tasks/{id}/threads/{studentId}/comments` — canlıdaki yapı), bildirim/mail hookup. Canlıda tutarsız olan real-time davranış (bazı sayfa `onSnapshot`, bazısı one-shot fetch) FlexOS'ta HER YERDE tutarlı `onSnapshot` ile kurulacak.

**Kritik referans dosyalar (Faz 2+ için de geçerli):** `src/app/lib/domain/services/attendance-service.ts` (grup-sahipliği kontrol deseni), `src/app/lib/googledrive.ts` (reuse edilecek, değiştirilmeyecek), `scripts/assert-view-access.ts`/`assert-assignment.ts` (assertion iskelet deseni).

Plan dosyası (yerel makinede, senkronlanmıyor): `C:\Users\asent\.claude\plans\graceful-jumping-muffin.md` — yukarıdaki özet onun tam kopyası, ayrıca bakmaya gerek yok.

### ✅ Eğitim Operasyon Dashboard eklendi — Ana Sayfa'nın `education.create` rotası (2026-07-04, aynı gün devam)

Kullanıcı dünkü Claude Design çıktısını (`Eğitim Operasyon Dashboard.dc.html`, demo veri) verdi — "bunu da yaparsak dashboardların çoğu biter (Finans+Genel Müdür hariç)". Satış Dashboard/Eğitmen Ana Sayfa ile aynı desende gerçek uçlara bağlanarak portlandı: **yeni sayfa `src/app/flexos/egitim-operasyon-anasayfa/page.tsx`**.

- **Donut (Açık Eğitim Dağılımı):** aktif (`status==="active"`) grupların branş kırılımı, Recharts `PieChart` (Satış Dashboard'un GÜNCEL Recharts deseniyle aynı, eski conic-gradient CSS değil — yeni sayfa olduğu için doğrudan güncel yaklaşımla kuruldu). `GET /api/flexos/groups`'un zaten sunucu tarafında join'lediği `branch` adı + `enrolled` (aktif kayıt sayısı) kullanıldı, ekstra sorgu gerekmedi.
- **Özet metrik şeridi (4 kart):** Aktif Sınıf/Aktif Öğrenci/Bu Hafta Başlayacak GERÇEK (`groups`'tan hesaplanıyor — `schedule.startDate` bugün+7 gün penceresi). **Sertifika Bekleyen = "—"** (Sertifika domain'i hâlâ kurulmadı, bkz. `certificate_scope` hafızası — dürüst placeholder).
- **Büyük işlem kartları (2):** "Grup Oluştur"→`/flexos/siniflar`, "Yoklama Takibi"→`/flexos/yoklama/al` — ikisi de gerçek route.
- **Hızlı işlemler (3):** Sertifikasyon/Anketler/Bildirim Merkezi — hiçbirinin backend'i yok, "yakında" toast (tasarımın kendisinde de `href="#"` — placeholder olduğu zaten belliydi).
- **Yaklaşan Sınıflar:** henüz başlamamış (`planned`/`enrolling`) + `schedule.startDate` bugünden ileride olan gruplar, tarihe göre artan sıralı, "X gün sonra" — GERÇEK. Branş renk paleti donut ile tutarlı (`branchColor` map, aynı `DONUT_PALETTE` index'i).
- **Eğitim Operasyon Akışı:** ⚠️ **bilinçli basitleştirme** — tasarımda 6 farklı olay tipi vardı (yoklama tamamlandı/sertifika/talep/sınıf açıldı/anket/bildirim) ama bunların çoğunun (sertifika/anket/bildirim/sınıf-açıldı-event-log/yoklama-tamamlandı-aggregate) backend'de karşılığı YOK. Panel şu an **aynı `GET /api/flexos/activities` akışını** (Satış Dashboard'un Canlı Aktivite Akışı ile birebir aynı endpoint — `activity.read` zaten Operasyon paketinde de var, CRM/talep sistemi department-agnostic) gösteriyor — uydurma ikon/tip yok, dürüst ama şimdilik Satış-ağırlıklı bir feed. Gerçek çok-domainli bir "operasyon olay logu" ileride ayrı bir iş kalemi.

**Routing — `FlexSidebar.tsx` "Ana Sayfa" dallanmasına yeni kol eklendi:** `role.manage`→admin anasayfa (değişmedi) → **YENİ:** `education.create` (Operasyon paketine özgü — `packages.ts`'te satış/eğitmen'de hiç yok, standalone eğitmende de yok, admin zaten üstteki dalda yakalanıyor) → Eğitim Operasyon Dashboard → `sale.create`→Satış Dashboard (değişmedi) → yoksa Eğitmen Ana Sayfa (değişmedi). Mevcut 3 rotaya dokunulmadı, sadece aralarına 1 kol eklendi.

`tsc --noEmit`, `eslint`, `npm run build` (tüm route'lar dahil `/flexos/egitim-operasyon-anasayfa`) temiz. **Test edilmeyen:** tarayıcıda gerçek bir Operasyon hesabıyla doğrulanmadı (bu ortamda giriş yapılamıyor) — sıradaki oturumda bir Operasyon kullanıcısıyla kontrol edilmeli, özellikle donut/Yaklaşan Sınıflar'ın az veri durumunda (Satış Dashboard'daki "az branş" gerilme sorunu burada da çıkabilir, henüz o düzeltme uygulanmadı).

### ✅ Paylaşımlı `FlexHeader`+`Footer` TÜM FlexOS sayfalarına yayıldı (2026-07-04, aynı gün devam)

Satış Dashboard + Eğitmen Ana Sayfa'da onaylanan `FlexHeader`/`Footer mini` deseni ("güzel olursa diğer sayfalara da yaparız" — 2026-07-03 notu) kullanıcı onayıyla kalan **21 sayfaya** yayıldı: Eğitim Yönetimi (katalog/Ekle/Ayarlar/Tatil/Branşlar/Seanslar), Sınıflar (Full + Core `EgitmenSiniflarPanel`), Öğrenci Havuzu, Eğitmenler, Kullanıcılar (liste/Ekle/Düzenle), Satışlar (Liste/Paket/Kampanya/Satış-Yap), Aktivite Merkezi, Randevu Takvimi (placeholder), Ana Sayfa (admin placeholder), Yoklama Detay+Raporu (header-only). Artık **sadece 2 sayfada eski desen kalmıyor** (bkz. aşağıdaki bilinçli istisna).

**`FlexHeader.tsx`'e yeni `left` prop'u eklendi:** breadcrumb/geri-butonu olan sayfalar (Eğitim Ekle, Eğitim Ayarları alt-sayfaları, Kullanıcı Ekle/Düzenle, Yoklama Detay) için sol tarafı (icon+title+subtitle bloğu) TAMAMEN özel içerikle değiştirir — sağdaki bildirim+avatar bloğu (isim fetch+cache dahil) hep aynı kalır. `subtitle` prop'u da opsiyonel yapıldı (`left` kullanan sayfalarda gereksiz).

**Bilinçli istisna — Yoklama Al (`/flexos/yoklama/al`) dokunulmadı:** bu sayfa kasıtlı olarak FlexSidebar'sız/bağımsız (2026-07-02 kararı — "ders başladıktan sonra yanlışlıkla başka sayfaya geçip yoklamayı yarım bırakmasın", sidebar menüden yeni sekmede açılıyor). FlexHeader/Footer eklemek bu tasarım kararını bozardı.

**Yoklama Detay + Yoklama Raporu — sadece HEADER, Footer YOK:** ikisi de `position:absolute inset-0` kayan panel deseni kullanıyor (`overflow:hidden` sabit-viewport), Footer'ın doğal bir yeri yok — sadece üst header (bell/avatar/isim) `FlexHeader`'a taşındı, sayfa içindeki tekrarlı isim-fetch kodu da temizlendi (artık `FlexHeader` kendi içinde tek kaynaktan çekiyor).

**🔧 Düzeltme — Yoklama Detay/Raporu içerik genişliği header'la eşitlendi (aynı gün devam):** Kullanıcı fark etti: FlexHeader 1920 genişliğinde ama içerik (`AttendanceCore`/`AttendanceDetailList` paylaşımlı bileşenleri, Yoklama Al'ın eski topBar'ıyla eşleşecek şekilde 1300/1440/1620 sabitti) dar kalıyordu. **Risk:** bu iki bileşen Yoklama Al'da da kullanılıyor, Al'ın kendi topBar'ı hâlâ 1300/1440/1620 (kasıtlı, dokunulmadı) — o yüzden bileşenlerin genişliğini direkt 1920'e sabitlemek Al'da YENİ bir uyumsuzluk yaratırdı. **Çözüm:** her iki bileşene opsiyonel `containerClassName` prop'u eklendi (varsayılan = eski 1300/1440/1620 string'i, Yoklama Al hiç değişmedi), Yoklama Detay + Yoklama Raporu'ndaki tüm çağrılar (`AttendanceDetailList`, `AttendanceCore` mode="detail" — 2 yerde: sağdan kayan grup detayı + Rapor'un iç içe 3. paneli) `"...max-w-[1920px] mx-auto px-9..."` ile override ediyor. Yoklama Raporu'nun kendi sayfa-içi Panel 1 div'i de (paylaşımlı bileşen değil, doğrudan page.tsx'te) aynı şekilde 1920'e çekildi. Panel 2 (split view) zaten `flex` tam-genişlik kullanıyordu, dokunulmadı.

`tsc`+`npm run build` temiz (tüm route'lar dahil).

**Yan ürün — kod temizliği:** Header değişince artık çağrılmayan `soon()`/bildirim-toast fonksiyonları (kullanılmayan değişken kalmasın diye) ilgili dosyalardan silindi (Eğitim Yönetimi, Eğitim Ekle, Seanslar, Öğrenci Havuzu).

`tsc --noEmit` ve `npm run build` (tüm route'lar dahil) temiz; `eslint src/app/flexos` **21 problem sayısı değişik olmadı** (23 pre-existing warning/error, hepsi bu işten önce de vardı — stash ile doğrulandı, hiçbiri bu değişiklikle eklenmedi). **Test edilmeyen:** tarayıcıda toplu olarak gezilmedi — sıradaki oturumda görsel bir tur (özellikle breadcrumb'lı `left` sayfaları: Eğitim Ekle, Kullanıcı Ekle/Düzenle, Yoklama Detay) faydalı olur.

### ✅ Satış Dashboard — donut+kota grafikleri Recharts'a taşındı, senkron giriş animasyonu (2026-07-04)

Kullanıcı iki grafiği de (donut'un conic-gradient CSS halkası, kota'nın elle-SVG burn-up eğrisi) **animasyonlu Recharts** bileşenleriyle değiştirmek istedi. Uzun bir iterasyon turu sonrası kilitlenen hâl:

- **Donut → `PieChart`/`Pie`/`Cell`.** Legend/skala/"Diğer" popup mantığı (2026-07-03'te kilitlenen) HİÇ değişmedi, sadece halkanın kendisi Recharts'a taşındı (`donut` useMemo'ya `pieData` eklendi).
- **Kota kartı** birkaç görsel dener (burn-up → basit iki-çubuk → son karar) sonrası: gerçek günlük kümülatif TL eğrisi, **Tremor'un "Revenue by month" örneğinin görsel tarifi ödünç alındı** (açık gri yatay grid, ince çerçeve, sade eksen) — **Tremor'un kendi 989 satırlık bileşeni KURULMADI**, sadece stil taklit edildi (yeni paket/dosya yok). `SATIS_KOTASI_HEDEF_TL` 500.000→1.500.000 (seed'in gerçek hacmine yakın).
- **Kritik ders — giriş animasyonu senkronu:** Ayrı Recharts animasyonları (`isAnimationActive`/`onAnimationStart`) birbirinden bağımsız zamanlayıcı olduğu için senkron başlamıyordu. Çözüm: TEK paylaşımlı `revealProgress` (0→1, `useAnimProgress` hook) — donut'un açısı VE kota'nın clip-path'i aynı değerden besleniyor, Recharts'ın kendi animasyonları kapatıldı (`isAnimationActive={false}`). Detaylı tuzaklar (hidden-clock erken bitme, YAxis autoscale titremesi, clip-path vs değer-ölçekleme) → hafıza: `flexos_satis_dashboard_charts_2026_07_04.md`.
- **Yan ürün:** `appointments`/`activities` route'larındaki N+1 sorgu (kişi başına ayrı `getById`) → `sales/route.ts`'teki desenle aynı tek `list()`+Map join'ine çevrildi.

`tsc`+ESLint temiz, `npm run build` başarılı, tarayıcıda kullanıcı tarafından doğrulandı ("oldu ok").

### ✅ Satış Dashboard — donut "az branş" düzeltmesi (2026-07-03, aynı gün devam)

Kullanıcı 4K'da fark etti: tek branş satılmışken (`donutTopCount=1`) legend kartı `flex:1` ile kalan tüm yatay alanı dolduruyor, garip gerilmiş bir kart oluşuyordu. Merkezleme (`justifyContent:center`) alternatifi konuşuldu ama "sağda koca boşluk kalır" itirazıyla elendi — kullanıcı kararı: **kart grid'i her zaman en az 4 kart (2×2) göstersin**, satışı olmayan branşlar kataloğun geri kalanından **soluk yer tutucu** olarak eklensin (hangi branşlar olduğu önemli değil), satışı olan kart(lar) normal/aktif kalsın.

**Uygulanan:** `donut` useMemo artık `branches` (yeni `GET /api/flexos/branches` fetch'i, `loadAll`'a eklendi) parametresine bağlı. Gerçek satışı olan branş sayısı (`top.length`) 1-3 arasındaysa, kataloğun satışı olmayan geri kalanından `DONUT_MIN_CARDS=4`'e tamamlanacak kadarı `muted:true` ile legend'e eklenir (conic-gradient/`stops` etkilenmez — sadece kart listesine ekleniyor). Mevcut `donutTopCount`/`donutScale`/grid-column mantığı zaten legend uzunluğuna bağlı olduğu için ekstra kod gerekmedi — 4 karta tamamlanınca grid otomatik 2 sütuna (2 üst 2 alt) geçiyor. Muted kart stili: kesikli border, gri renk çubuğu, "—"/"satış yok" metni, soluk yazı rengi.

**Bilinçli kapsam dışı:** 0 satış durumu (mevcut "Bu ay henüz satış kaydı yok." boş-durum metni) değiştirilmedi — sadece 1-3 gerçek branş varken devreye giriyor. 6'dan fazla branş satılmışsa mevcut "Diğer" butonu davranışı aynen korunuyor.

**🔧 Düzeltme — kataloğun kendisi 4'ten az branş içerince (aynı gün devam):** İlk versiyon sadece gerçek katalogdan (`GET /branches`) dolduruyordu; test ortamında katalogda toplam 3 farklı branş vardı (`Yazılım` — biri gerçek biri eski demo-seed duplicate'i, `Grafik Tasarım`), bu yüzden 4'e değil 2'ye tamamlanıyordu (kod bug'ı değil, veri eksikliği). **Kullanıcı kararı: "şimdilik fake koy, branş havuzunu doldurunca oradan çekeriz."** `DONUT_DUMMY_BRANCHES` (6 sabit isim, seed script'teki branş adlarıyla aynı) eklendi — önce katalogdan doldurulur, hâlâ `DONUT_MIN_CARDS`e ulaşmadıysa dummy isimlerden tamamlanır. Katalog büyüdükçe `catalogFillers` listesi otomatik büyüyüp dummy'lerin yerini alır (kod tarafında ek iş gerekmez, sadece branş eklenmesi yeterli) — **geçici, branş havuzu dolunca kaldırılabilir/otomatik devre dışı kalır.**

`tsc`+ESLint temiz. **Test edilmeyen:** tarayıcıda doğrulanmadı (özellikle 1 branş senaryosunda 3 soluk kartın görünümü) — sıradaki oturumda/şimdi kontrol edilmeli.

### ✅ Paylaşımlı `FlexHeader` + canlı `Footer` (mini) FlexOS'a kazandırıldı (2026-07-03, aynı gün devam)

Kullanıcı fark etti: FlexOS sayfalarında hiç footer yoktu; canlıda `src/app/components/layout/Footer.tsx` var (`mini` prop'lu — küçük/ince versiyon + sosyal medyalı tam versiyon TEK bileşende, `mini` ile seçiliyor). **Kullanıcı kararı: student tarafı hariç HER YERDE `mini` versiyon.** Aynı oturumda ikinci bir eksik de netleşti: her FlexOS sayfası kendi header JSX'ini kopyala-yapıştır tutuyordu (Yoklama Raporu/Detay'da bir desen, Satış Dashboard'da farklı bir desen, isim bazı sayfalarda statik hardcoded) — **kullanıcı: "sidebar gibi dinamik tek bileşenden olsun, bir yerde değişince hepsinde değişsin."**

**Yapılan:**
- **`src/app/flexos/_components/FlexHeader.tsx`** (yeni, FlexSidebar ile aynı "tek kaynak" deseni) — sticky header, opsiyonel ikon kutusu, `greeting` modu ("Hoş Geldin, {isim} 😊") veya sabit `title`, `subtitle`, `roleLabel` (örn. "Yönetici · Satış"), `maxWidth`. İsim `users/{uid}` Firestore'dan çekilir (Yoklama Raporu'ndaki dinamik-isim deseniyle birebir) + FlexSidebar'daki `capsCache` deseniyle aynı modül-seviyeli `nameCache` (sayfa değişince yeniden fetch/flaş yok). Bildirim zili + kullanıcı avatarı (initials+gradient) dahil.
- **Satış Dashboard'a bağlandı:** kendi inline header'ı (statik "Alparslan Şentürk" hardcoded'du — bilinmeyen bir eksiklikti, bu iş yan ürün olarak düzeltti) kaldırıldı, `<FlexHeader greeting subtitle="..." roleLabel="Yönetici · Satış" />` ile değiştirildi.
- **`<Footer mini />`** canlıdan doğrudan import edilip (`@/app/components/layout/Footer`, yeni bir wrapper YOK — zaten tek kaynak) sayfanın en altına eklendi. `main` artık `flex flex-col` + içerik grid'i `flex:1` (footer içindeki `mt-auto` ile birlikte kısa içerikte de en alta yapışıyor, uzun içerikte scroll'un sonunda görünüyor — canlıdaki davranışla aynı).
- **Sıradaki (kullanıcı onayı bekliyor):** "güzel olursa diğer FlexOS sayfalarına da yaparız" — bu iki bileşen (FlexHeader+Footer mini) henüz sadece Satış Dashboard'da. Diğer sayfalar (Yoklama Al/Detay/Rapor, Eğitim Yönetimi, Öğrenci Havuzu, Sınıflar, Eğitmenler, Kullanıcılar, Aktivite Merkezi) hâlâ kendi eski header desenlerini kullanıyor, footer'sız.

`tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/satislar/dashboard` derlendi). **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 3 düzeltme daha (aynı gün devam, kullanıcı fark etti):**
1. **Sidebar logosu sahteydi:** Claude Design'ın taklit ettiği 4 renkli kare ikon + ayrı "flex" metni, gerçek marka logosu değildi. `FlexSidebar.tsx` artık canlıdaki gerçek `<FlexLogo variant="white"/>` (`@/app/components/ui/FlexLogo`, `/assets/flex-logo-white.svg`) kullanıyor — kullanıcı boyut değişmesin dedi, önceki logo alanının yüksekliğiyle (~38px) eşleşecek `width={138}` verildi (SVG oranı ~3.6:1). `S.logoBox` stili (artık kullanılmıyor) silindi. **Footer zaten gerçek logoyu kullanıyordu** (`Footer.tsx` içinde `<FlexLogo width={64}/>`) — ek iş gerekmedi.
2. **Selamlama metni yanlıştı:** "Hoş Geldin, {isim} {soyisim} 😊" — canlıda (`Header.tsx`) SADECE ilk isim (`user?.name?.split(' ')[0]`). `FlexHeader.tsx`'e `firstName = displayName.split(" ")[0]` eklendi, greeting bunu kullanıyor (sağdaki kullanıcı bloğundaki tam isim değişmedi, o ayrı).
3. **Font ağırlığı çok kalındı:** `fontWeight:800` yerine canlıdaki (`Header.tsx` `h1`) birebir değeri `fontWeight:630, letterSpacing:"-0.022em"` kullanılıyor.

`tsc`+ESLint temiz, `npm run build` başarılı.

**🔧 4. düzeltme — header/içerik/footer sol-sağ kenar hizası (kullanıcı ekran görüntüsü attı):** Sidebar/logo/greeting/donut hepsi onaylandı, tek sorun kalmıştı: `FlexHeader` sabit `maxWidth:1560px` inline style kullanıyordu, canlı `Footer.tsx` ise Tailwind'in responsive `w-[94%] mx-auto max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[2000px]` sınıflarını — 4K/geniş ekranda (`2xl` kırılımı) ikisi farklı genişliğe çıkıp header'daki başlık/avatar ile footer'daki logo/telif hizası kayıyordu. **Fix:** `FlexHeader.tsx`'ten `FLEX_CONTENT_WIDTH_CLASS` sabiti export edildi (Footer'ın sınıfıyla BİREBİR aynı string, kasıtlı kopya) — hem `FlexHeader`'ın iç sarmalayıcısı hem Satış Dashboard'un içerik grid'i artık bu sınıfı kullanıyor (eski `maxWidth`/`margin:"0 auto"` inline stilleri kaldırıldı). `FlexHeader`'ın `maxWidth` prop'u da kaldırıldı (artık gereksiz). **Diğer sayfalara FlexHeader/Footer taşınırken bu sabit otomatik olarak hizayı koruyacak** — ekstra iş gerekmez.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** düzeltme sonrası tarayıcıda tekrar doğrulanmadı.

**🔧 5. düzeltme — genişlik standardı diğer FlexOS sayfalarıyla eşitlendi:** Kullanıcı büyük ekranda fark etti: bir önceki düzeltme (Footer'ın kendi `2xl:max-w-[2000px]` Tailwind sınıfı) Satış Dashboard'u diğer FlexOS sayfalarından (Eğitim Yönetimi, Sınıflar, Eğitmenler, Satış Yap — hepsi sabit `maxWidth:1920`) daha geniş yapıyordu. **Karar: sayfa genişliği FlexOS'un mevcut standardına (1920) uysun, Footer'ın kendi genişliğiyle piksel-piksel eşleşmesi ikincil.** `FlexHeader`'daki `FLEX_CONTENT_WIDTH_CLASS` (Tailwind) kaldırıldı, yerine `FLEX_CONTENT_MAX_WIDTH=1920` sabiti + `maxWidth` prop'u (varsayılan bu sabit) geri geldi — hem `FlexHeader`'ın iç sarmalayıcısı hem Satış Dashboard'un içerik grid'i artık diğer sayfalarla BİREBİR aynı `maxWidth:1920, margin:"0 auto", padding:"..36px.."` deseninde.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 6. düzeltme — Footer de header/avatar ile hizalandı:** Genişlik standardı 1920'e sabitlendi ama Footer hâlâ canlının kendi `w-[94%] ... 2xl:max-w-[2000px]` sınıfını kullanıyordu (kenarlar hizasız kaldı). Canlı `Footer.tsx`'i BOZMADAN çözüldü: yeni opsiyonel `containerClassName` prop'u eklendi (verilmezse eski sınıf aynen kalır — mevcut ~15 canlı çağıran ETKİLENMEDİ). Satış Dashboard artık `<Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />` geçiyor — `FLEX_CONTENT_MAX_WIDTH` (1920) ile piksel-piksel aynı kutu + `px-9`=36px (header'ın `padding:"20px 36px"`'ıyla aynı iç boşluk). **Not:** Tailwind JIT className'i build-time statik taradığı için `containerClassName` sabit yazılmalı, `FLEX_CONTENT_MAX_WIDTH` değişirse elle senkronlanmalı (dinamik interpolasyon çalışmaz) — koda yorum olarak düşüldü.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı — bu son hizalama turu için bir ekran görüntüsü daha gerekiyor.

### ✅ Satış Dashboard — Satış Kotası kartı eklendi (2026-07-03, aynı gün devam)

Kullanıcı bir görsel referans attı (`chart.png`, "Hedef İlerleme" tasarımı — kümülatif çizgi grafik + Gerçekleşen/Hedef/Tamamlanma/Kalan/Dününe göre istatistikleri). Önce donutun yanına (3. sütun) eklemek konuşuldu ama Aktivite Akışı'nın sağ sütunda 2 satır kapladığı fark edilince (kullanıcının "ilginç durum" öngörüsü doğru çıktı — donut satırına 3. sütun eklemek Aktivite Akışı ile çakışıyordu) kullanıcı vazgeçti: **donut 4 kartlı kaldı (bir önceki 6-kart denemesi tamamen geri alındı, `isWideDonut`/matchMedia kodu silindi), Satış Kotası bunun yerine aksiyon kartları satırına (Satış Yap/Satış Listesi'nin yanına) 3. kart olarak eklendi** — bu satır zaten sadece col1 (geniş sütun) içinde kendi 2-sütunlu alt-grid'i olduğu için sağ sütundaki Randevular/Aktivite Akışı'yla hiç çakışmıyor, temiz çözüm.

**Uygulanan:** `SATIS_KOTASI_HEDEF=30` (gerçek kota/hedef backend'i yok, sabit placeholder) + `kota` useMemo (bu ayki `monthActive` satışlardan günlük/kümülatif seri — gün-gün satış sayısı toplanarak "Gerçekleşen", `Math.max(0,hedef-gerçekleşen)` "Kalan", bugünün günlük artışı "Dününe göre"). `SatisKotasiCard` — Satış Yap/Satış Listesi ile aynı kart iskeleti (ikon kutusu+başlık üstte), altında Gerçekleşen/Hedef + %Tamamlanma rozeti + küçük SVG alan-grafiği (elle çizilmiş `viewBox` tabanlı polyline/path, recharts kullanılmadı — dosyanın geri kalanıyla tutarlı, donut da aynı şekilde elle SVG/conic-gradient) + alt satırda Kalan/Dününe göre. Aksiyon kartları grid'i `"1fr 1fr"`→`"1fr 1fr 1fr"`.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı — özellikle 3'lü satırın küçük ekranda (~1440px) ne kadar sıkışacağı (kullanıcıyla önceden konuşulan risk, "Satış Yap" kartının açıklama metni dar kalabilir) kontrol edilmeli. **Açık:** gerçek kota/hedef değeri (şu an sabit 30) ileride ayarlanabilir/backend'e bağlanabilir bir alan olmalı — henüz o iş yapılmadı.

**🔧 Düzeltme — küçük ekranda 3'lü satır "dik" duruyordu (aynı gün devam):** Kullanıcı: "~1440'ta kartlar fazla dik, sadece küçük ekranlarda yükseklik azalsın, büyük ekranlarda aynı kalsın." `ACTION_ROW_COMPACT_BREAKPOINT="(max-width:1600px)"` + `isCompactRow` state (donuttaki `isWideDonut` ile aynı titremesiz lazy-initializer deseni). Altında: 3 kartın da padding'i 22→16, başlık altı boşluk 14→10, buton üstü boşluk 14→10/12→8; **Satış Yap kartının açıklama metni compact modda tamamen kaldırıldı** (zaten önceden flag'lenen "dar ekranda sıkışabilir" riskini de kapatıyor); Satış Kotası'nın grafik yüksekliği 52→40. 1600px üstünde hiçbir şey değişmiyor.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — "Satış Yap" kartı boş kalmıştı (aynı gün devam):** Kullanıcı fark etti: bir önceki adımda compact modda kaldırılan açıklama metni kartı "boş" hissettiriyordu, Satış Listesi'nin yanında bilgi yoğunluğu dengesiz duruyordu. Açıklama metni geri getirildi (artık compact modda da her zaman görünür) + altına gerçek veriden küçük bir rozet eklendi: **"Bu ay {monthActive.length} satış tamamladın"** (turuncu pill, kartın kendi renk temasıyla uyumlu) — sahte veri değil, zaten hesaplanan `monthActive.length`.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — "Bu ay X satış" rozeti yerine "en son satış" bilgi kutusu (aynı gün devam):** Kullanıcı: "Bu ay 15 satış yaptın yazısı yetmiyor, büyük ekranda sıkıntılı — orta kısımda bilgilendirici bir yazı olsun, örn. 'En son 12 dakika önce Zeynep Şen için Yazılım branşında satış yapıldı.'" "Bu hafta en hızlı kapanan branş" fikri de önerildi ama bu sayfada "kapanma hızı" (lead→satış süresi) diye bir veri yok — uydurmamak için elenip sadece **gerçek** veriden türeyen "en son satış" fikri uygulandı. Turuncu rozet kaldırıldı, yerine ince kesikli çerçeveli soluk kutu (`recentActive[0]` — zaten hesaplı en son aktif satış — `"En son {relTime} önce {studentName} için {branchName} branşında satış yapıldı."`, boş durumda "Henüz satış kaydı yok."). Kutu `flex:1` ile kartın ortasını dolduruyor (büyük ekran boşluğu sorunu da çözülüyor). **Küçük ekranda (`isCompactRow`) yazılar küçülüyor, kaldırılmıyor** (kullanıcı: "küçük ekranda yazıları ufalt ama [kaldırma]") — açıklama metni 13→11.5px, bilgi kutusu 12.5→11px.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — tek metne indirildi + büyük ekranda kutuyu dolduracak şekilde (aynı gün devam):** Kullanıcı: "2 tane yazı olunca kötü durmuş" — jenerik açıklama metni ("Öğrenci bilgisi, eğitim ve ödeme adımlarıyla...") kaldırıldı, sadece "en son satış" bilgi kutusu kaldı (ikon+başlık zaten amacı anlatıyor, tek net mesaj). Kullanıcı: "ok ama orayı biraz doldurması lazım büyük ekranlarda" — kutu `flex:1` + `display:flex, alignItems:center` (metin dikey ortalanıyor, kutu kartın kalan tüm boşluğunu dolduruyor) + büyük ekranda daha büyük padding (16px) ve font (14px, öncekinden 12.5'ten büyütüldü) — küçük ekranda (`isCompactRow`) hâlâ daha kompakt (10px padding, 11.5px font).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🐛 Gerçek bug — metin `display:flex` altında birbirine girmişti (aynı gün devam, tarayıcıda DOĞRULANDI):** Kullanıcı ekran görüntüsünde harflerin üst üste bindiğini bildirdi. Kök neden: kutunun kendisi `display:"flex"` idi ve içindeki JSX Fragment (`"En son " <b>X</b> " önce " <b>Y</b> ...`) birden fazla ayrı text-node/`<b>` kardeşten oluşuyordu — flex container altında her biri AYRI flex-item olur (flex-wrap varsayılan `nowrap`), normal satır-içi metin akışı/wrap'i BOZULUR. **Fix:** tüm metin tek bir `<span>` içine alındı (kutu hâlâ `display:flex,alignItems:center` ile dikey ortalıyor ama artık TEK flex-item — span — var, içindeki metin normal inline akışla wrap oluyor). Ayrıca kullanıcı "turuncu zemin olmasın" dedi — cream/tan renk paleti (`#FFFBF6`/`#F0DCC4`) kaldırıldı, sayfanın kendi nötr rengine (`#F7F8FA`/`#EEF0F3`, `SummaryRow` ile aynı) çevrildi. Kullanıcı: "Şimdi düzelmiş... son hali daha iyi."

`tsc`+ESLint temiz, `npm run build` başarılı.

### ✅ Satış Dashboard — Satış Kotası TL'ye çevrildi + 3 küçük iyileştirme (2026-07-03, aynı gün devam)

Kullanıcının 3 ayrı isteği:
1. **Satış Kotası kart-içeriği TL bazlı dummy veriye çevrildi:** üstte "15/30 hedef" (sayı) yerine **"Hedef Satış: 500.000 TL"** + **"%50 Tamamlanma Oranı"** rozeti; altta sol tarafta iki satır yığılı — **"Yapılan Satış: 250.000 TL"** + **"Kalan: 250.000 TL"**; sağdaki "Dününe göre" AYNI kaldı (kullanıcı: "en sağdaki tamam"). `SATIS_KOTASI_HEDEF_TL=500000`/`SATIS_KOTASI_YAPILAN_TL=250000` sabitleri (dummy, gerçek kota backend'i yok) — `kalanTl`/`tamamlanmaOrani` bunlardan hesaplanıyor (tutarlı: 250k+250k=500k, %50). **Grafiğin kendisi hâlâ gerçek veriden** (bu ayki günlük satış sayısı, kümülatif) — TL hedefinden bağımsız kendi ölçeğinde (`Math.max(...cumulative,1)`), aksi halde 500.000'lik eksende sayı-bazlı çizgi düz görünürdü.
2. **Bugünkü Randevular — büyük ekranda 5 randevu görünür oldu:** `APPT_VISIBLE_ROWS_NARROW=4`(≤1600px)/`APPT_VISIBLE_ROWS_WIDE=5`(>1600px), aynı `isCompactRow` breakpoint'i (aksiyon kartı satırıyla paylaşılan). Seed script'e (`scripts/seed-flexos-dashboard-demo.mjs`) 2 randevu daha eklendi (5→7) — hem küçük hem büyük ekran senaryosunu (4 görünür/3 scroll, 5 görünür/2 scroll) test edecek kadar.
3. **"Aktif Satışlar" → "En Son Satışlar"** başlık değişikliği (havuz zaten en son 3 aktif satışı gösteriyordu, isim buna göre düzeltildi).

`tsc`+ESLint temiz, `npm run build` başarılı, seed script syntax doğrulandı (`node --check`). **Test edilmeyen:** tarayıcıda doğrulanmadı — seed script'i `--clean` ile tekrar çalıştırıp yeni 7 randevuyu görmek gerekiyor.

**🔧 Düzeltme — sağ sütun büyük ekranda genişletildi (aynı gün devam):** Kullanıcı: "Aktiviteler/Randevu sütununu büyük ekranda biraz genişletelim, böylece üst (donut+aksiyon) alanının yayılması azalır." Dış grid `gridTemplateColumns` artık `isCompactRow` (≤1600px) ise `"1fr 340px"`, değilse `"1fr 420px"` — aynı breakpoint aksiyon kartı satırı ve Bugünkü Randevular ile paylaşılıyor, tek bir yerde tanımlıydı (340px başka hiçbir yerde hardcode değildi), değişiklik tek satır.

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

**🔧 Düzeltme — Satış Kotası grafiği düz çizgiydi, referans görsel gibi eğri olmalıydı + etiket (aynı gün devam):** Kullanıcı `chart.png` referansındaki gibi yumuşak eğri bekliyordu, benim ilk implementasyonum düz çizgi segmentleriydi (`M...L...L...`). **Fix:** yeni `smoothLinePath()` yardımcı fonksiyonu — nokta dizisini Catmull-Rom spline'dan kübik Bezier'e çeviriyor (tension 1/6, standart yumuşatma tekniği), `SatisKotasiCard`'ın çizgi/alan path'i artık bunu kullanıyor. Ayrıca "Kalan" etiketi **"Kalan Satış"** oldu (Yapılan Satış'la aynı isimlendirme deseni).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

### ✅ Satış Dashboard — donut responsive 4/6 kart (2026-07-03, aynı gün devam — SONRADAN GERİ ALINDI, bkz. yukarı)

Kullanıcı fark etti: sayfa genişliği 1920'e çıkınca (bir önceki düzeltme) donut yanındaki legend kartları yine gerilmeye başladı (aynı kök sorun, yeni genişlikte tekrar ortaya çıktı). Kullanıcı fikri: geniş ekranda (≥1920px) boşluk bırakmak yerine **6 kart (3 üst 3 alt)** göster, dar ekranda (ör. 1440px) **4 kart (2 üst 2 alt)** kalsın — donuta dokunulmadan.

**Uygulanan:** `DONUT_MIN_CARDS_NARROW=4`/`DONUT_MIN_CARDS_WIDE=6` + `window.matchMedia("(min-width: 1920px)")` tabanlı `isWideDonut` state. **Titreme yok:** `useState`'in lazy initializer'ı ilk render'da `window` zaten var olduğu için (`typeof window !== "undefined"` kontrolüyle) doğru değeri okuyor — bu sayfa zaten `authed===null` iken hiçbir şey render etmediğinden (auth+veri yüklenene kadar donut hiç DOM'a girmiyor) SSR/hydration uyuşmazlığı da yok, "önce 4 sonra 6'ya sıçrama" hiç olmuyor (kullanıcı talebi: "sayfa tam yüklenmeden açma yapma"). `donut` useMemo artık `isWideDonut`'a bağlı (minCards parametrik) + legend grid'i `donutCols` (`donutTopCount<=2→1, isWideDonut→3, değilse→2`) ile `repeat(N,1fr)`. `DONUT_TOP_N=6` zaten sabit olduğu için `donutScale` formülü değişmedi (6 kartta otomatik 1.0 skalaya iniyor, aynen 6-gerçek-branş senaryosundaki gibi).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda farklı pencere genişliklerinde (özellikle 1920 sınırında resize) doğrulanmadı.

### ✅ Eğitmen Ana Sayfa — canlı `dashboard/page.tsx`'ten UI portu BİTTİ (2026-07-03, aynı gün devam)

Kullanıcı: "canlıdaki eğitmen dashboard'u birebir FlexOS'a al." Canlıda ayrı bir "eğitmen dashboard" yok — `src/app/dashboard/page.tsx` admin+eğitmen ortak tek sayfa (rol ayrımı içeride permission kontrolüyle). Yapı: Sidebar+Header+Footer + lacivert özet banner (Sınıf/Öğrenci/Ödev sayısı, canlı) + 3'lü hızlı aksiyon kartı (Hızlı Yoklama/Ödev Teslimi/Sertifikasyon) + Aktivite Akışı paneli (`activity_log`) + **Ödev Parkuru** (`DesignParkour`, 1070 satır) + **Ödev Kütüphanesi** (`AssignmentLibrary`, 330 satır).

**Kapsam netleştirmesi (kullanıcı onayladı):** Ödev Parkuru/Kütüphanesi'nin GERÇEK verisi (`tasks`/`templates` koleksiyonları, `useUser()`/`PERMISSIONS`/`activityLog`/beş ayrı modal — QuickAssignModal/AssignActivateModal/CompleteConfirmModal/CancelConfirmModal/TaskEditModal) canlının kendi altyapısına bağlı; FlexOS'ta "Ödev" domain'i **hiç kurulmadı** (kullanıcı: "ödevler başlı başına konuşmamız gereken bir süreç"). Karar: **UI'ı birebir portla, veri katmanını FlexOS'ta karşılığı olanlarla gerçek yap, olmayanlarla dürüst boş/placeholder bırak** — sahte veri uydurulmadı.

**Yeni sayfa `src/app/flexos/egitmen-anasayfa/page.tsx`** (önceki içi-boş placeholder'ın yerine geçti):
- **Banner:** Sınıf/Öğrenci sayısı GERÇEK (`GET /api/flexos/groups` status=active count + `GET /api/flexos/persons` — ikisi de zaten trainer'a scope'lu, ekstra kod gerekmedi). Ödev sayısı "—" (domain yok).
- **Hızlı Yoklama kartı — pulse mantığı GERÇEK veriyle portlandı:** canlının regex tabanlı `session` string parse'ı (`parseWeekDaysHome`/`parseSessionTimeHome`) YERİNE FlexOS'un zaten yapısal `Group.schedule` alanı (`days:number[]`, `startTime`/`endTime`) kullanıldı — daha temiz, regex'e gerek kalmadı. `ATTEND_BEFORE_MIN=15`/`ATTEND_AFTER_MIN=180` canlıyla birebir aynı. Adaya düşen gruplar için `GET /api/flexos/attendance?groupId=&date=` ile "bugün alındı mı" kontrolü (canlının tek `design_attendance where date==` bulk sorgusu FlexOS'ta yok, grup-grup dönülüyor — tipik eğitmen 1-3 grup olduğu için sorun değil). Tatil kontrolü `GET /api/flexos/holidays` (zaten var, yoklama modülünden). Dismiss localStorage anahtarı `flexos_attend_dismissed_{tarih}` (canlıdakinden ayrı namespace).
- **Ödev Teslimi / Sertifikasyon kartları:** statik meta ("Ödev domain'i yakında" / "Yakında"), tıklanınca toast — Sertifikasyon zaten sidebar'da da `go(null)`→"yakında" (FlexSidebar.tsx:328), tutarlı.
- **Aktivite Akışı paneli:** görsel kabuk birebir ama veri yok (FlexOS'ta eğitmenin sınıf-aktivite log'u — canlının `activity_log`'u — henüz karşılığı yok; FlexOS'taki `activities` koleksiyonu Satış/CRM'e ait, farklı bir şey) → sabit "Henüz aktivite yok" boş-durum.
- **Ödev Parkuru:** başlık+"Ödev Ver" butonu (toast) + her zaman 4× `PlaceholderParkourCard` (canlının kendi boş-durum kartı — gerçek şablon/task olmayınca zaten bu görünüyor, birebir aynı CSS/opacity/dashed-border).
- **Ödev Kütüphanesi:** başlık+Kişisel/Global sekmeleri (yerel state, işlevsel) + her ikisinde de canlıdaki "Henüz kişisel/global şablonunuz yok." boş-durum kutusu.
- Header/Footer Satış Dashboard'daki paylaşımlı `FlexHeader`(greeting, canlının birebir metni "Bugün atölyende neler oluyor? İşte son durum.", roleLabel="Eğitmen") + `Footer mini` (aynı `containerClassName` hizalama deseni) — kod tekrarı yok.

`tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/egitmen-anasayfa` derlendi). **Test edilmeyen:** tarayıcıda doğrulanmadı (özellikle Hızlı Yoklama pulse mantığı gerçek bir grupla denenmeli — trainerId'ye atanmış aktif grup + bugünkü seans saatiyle). **Sıradaki (ayrı konuşma, kullanıcı onayı bekliyor):** Ödev domain'i (tasks/templates FlexOS backend'i) kurulunca bu sayfadaki placeholder'lar gerçek `DesignParkour`/`AssignmentLibrary` mantığıyla değiştirilecek.

### ✅ Satış Dashboard BİTTİ (2026-07-03)

Claude Design çıktısı (`Satış Dashboard.dc.html`, demo veri) gerçek uçlara bağlanarak `flexos/satislar/dashboard/page.tsx`'e portlandı. **Donut** (bu ayki aktif satışların branş dağılımı, `/api/flexos/sales`'ten türetilir) + **hızlı aksiyon kartları** (Satış Yap / Satış Listesi, ikincisinde Bu Ay Ciro/Satış Adedi/İptal özeti) + **Aktif Satışlar havuzu** (son 3 aktif satış) + **Bugünkü Randevular** + **Canlı Aktivite Akışı** (son 30 aktivite). **Ödeme durumu rozeti YOK** (2026-06-29 kararına uyumlu — sadece Finans modülünde olacak). **Yeni backend uçları:** `GET /api/flexos/appointments` (tüm randevular, kişi adı join'li, `appointment.read` gated) + `GET /api/flexos/activities` (son 30 aktivite, kişi adı join'li, `activity.read` gated) — ikisi için de `ActivityRepo`/`AppointmentRepo` portlarına `list(tenantId)` eklendi + firestore adapter'lara implementasyon.

**Routing düzeltmesi (kullanıcı geri bildirimi):** Satış Dashboard Satışlar akordiyonunda bir alt-menü DEĞİL — "Ana Sayfa" nav öğesinin **sale.create paketine düşen hedefi** (Ana Sayfa zaten role'e göre farklı sayfaya gidiyordu: `role.manage` → admin anasayfa, yoksa → eğitmen anasayfa; şimdi 3. dal eklendi). `FlexSidebar`'daki tek "Ana Sayfa" öğesi artık `role.manage` → `/flexos/anasayfa` · `sale.create` (ve role.manage YOK) → `/flexos/satislar/dashboard` · yoksa → `/flexos/egitmen-anasayfa`. Sayfa kendi `FlexSidebar active="ana"` geçiyor (Satışlar akordiyonuna eklenen link geri alındı). `tsc`+ESLint temiz, `npm run build` başarılı (route listede `○ /flexos/satislar/dashboard`).

**Demo veri:** `scripts/seed-flexos-dashboard-demo.mjs` — yalnız yeni FlexOS koleksiyonlarına yazar (branş/eğitim/persons/sales/cases/activities/appointments, `seedTag` ile temizlenebilir). 8 branşlık dengesiz dağılım (Yazılım %30 → Robotik ve Kodlama %2) + bugün için 5 randevu (Case+Activity+Appointment üçlüsü, gerçek domain akışına uygun). Satış tarihleri HER ZAMAN bu ayın 1'i ile bugün arasında üretilir (ay başında -19 gün gibi sabit ofsetler geçen aya taşıp "bu ay" filtresinden düşüyordu — bulunan gerçek bug). `--n=<sayı>` flag'i ile sadece ilk N branş seed'lenir (donut'un az-branşlı davranışını test etmek için, örn. `--clean --n=1`).

**Donut/legend responsive davranışı (kullanıcıyla iteratif kilitlendi 2026-07-03):**
- Legend **top-6 + "Diğer"** kuralı: `DONUT_TOP_N=6`, en çok satan 6 branş ayrı kart, gerisi tek "Diğer"e toplanır (`DONUT_OTHER_COLOR` gri).
- "Diğer" kartı ortalanan/ölçeklenen alanın **DIŞINDA** — karta `position:relative` + "Diğer" `position:absolute` (sağ-alt köşe, `right:24 bottom:32`), hover'da (`.sd-other-legend:hover .sd-other-tip`, CSS-only) İngilizce/Robotik gibi alt-branşları `%· kayıt` detayıyla listeleyen bir tooltip popup açılır.
- **Donut çemberi HER ZAMAN sabit boyut** (216px, inset 50) — kullanıcı kararı: donut'a dokunulmayacak, SADECE branş kartları ölçeklenecek.
- **Kart ölçeği (`donutScale`)** branş sayısına göre kademeli: 1 branşta `1.25x`, 6'da `1.0x` (`Math.max(1, 1.25 - (n-1)*0.05)`), font/padding/gap hep buna bağlı.
- **Grid sütun kuralı:** 1-2 branşta **tek sütun** (alt alta, büyük kart/kartlar) · 3+ branşta **2 sütun** (yan yana; tek sayıda kalırsa son satır yanı boş — kabul edilen davranış).
- Legend alanı `alignSelf:"center"` ile donut çemberiyle aynı satırda dikey ortalanır (veri sayısından bağımsız, sabit piksel offset YOK).
- Bugünkü Randevular kartında da benzer "tahmin değil hesap" dersi: her randevu satırı **sabit `APPT_ROW_HEIGHT=56`**, kapsayıcı `maxHeight` bundan + `APPT_ROW_GAP`/`APPT_VISIBLE_ROWS=4` ile **matematiksel** hesaplanıyor (rastgele piksel denemesi yerine) — 5. randevu üstte `APPT_LIST_PAD=24` padding + net kesim ile TAM gizleniyor, altta ayrı (scroll dışı) 24px spacer var.
- **Ders (feedback):** kart/alan boyutlandırmalarında rastgele piksel tahmini yerine sabit birim + formül kullanmak, kullanıcıyla defalarca "tahminle olmaz" turu dönmekten daha hızlı sonuç veriyor.

### ✅ Admin Kişisel Görünüm Anahtarı (Core/Full) — BİTTİ (2026-07-01)

> Karar Opus ile kilitlendi (2026-07-01), kullanıcıyla ekstra netleştirme sonrası Sonnet kodladı + doğruladı.

**Bağlam — iki AYRI kavram (karıştırma):**
1. **Sistem Sürümü = `standaloneMode`** (mevcut switch, Kullanıcılar sayfası, admin-only). Sistemin geneli + EĞİTMENLERİN yetkisini belirler (`EGITMEN_STANDALONE_EXTRA` = self-service grup/öğrenci ekle aç/kapa). Bir kez ayarlanır, herkesi etkiler. **KALIR, dokunulmaz.**
2. **Admin Kişisel Görünüm Anahtarı (YENİ):** SADECE owner'ın kendi ekranını Core/Full arası çevirir. Sistemi/eğitmenleri ETKİLEMEZ. `standaloneMode`'dan bağımsız. Presentational (güvenlik değil — owner zaten tüm yetkilere sahip, sadece göz karışmasın).

**Neden gerçek/canlı iş (demo değil):** Sistem eğitmen modunda gerçekten canlıya açılacak (önce test). Admin eğitmenleri panelden ekler → tek kullanımlık kod → eğitmen kullanır. Core=Full eksi Satış/Eğitim-OP; eğitmen modülü İKİ üründe de AYNI (hafif değil, aylarca emek — ortak kalp). Tek fark: Core'da eğitmen kendi grup/öğrencisini ekler.

**Görünüm Anahtarı — kesin davranış:**
- **Tetikleme:** gizli klavye kısayolu (Sonnet mantıklı default, örn. ⌘/Ctrl+Shift+M). Üst bar/sidebar'da GÖRÜNÜR kontrol YOK (kullanıcı çirkin buluyor). Sıfır görsel iz.
- **PIN gate:** kısayola basınca ekranda **4 haneli PIN** modalı → doğru PIN → diğer moda geç (Core↔Full). PIN **server-side + hash'li** (client bundle'a gömülmez), küçük verify endpoint'i.
- **PIN değiştirme:** owner için **ayar menüsü** (mevcut PIN doğrula → yeni PIN → hash sakla), yine owner-only.
- **Kime açık:** SADECE owner — `view.toggle` capability'si (yalnız owner hesabında). Başkası tuşa bassa no-op, iz yok. **UID kodun içine GÖMÜLMEZ** — "owner/süper-admin" ayrımı ya da kullanıcıya tekil grant (capability-driven, ileride ortak eklenebilsin).
- **View-state:** kişisel, uid'e bağlı saklanır (localStorage[uid] yeterli). **Varsayılan Full** (kullanıcı kararı 2026-07-01: "default admin olsun, belki sonra değiştiririm"). Kısayol **asimetrik**: Full→Core PIN'siz direkt; Core→Full PIN ister. Full modunda hâlâ owner/admin'sin (server-side yetki değişmez) — Core sadece menüyü sadeleştirir.

**Menü kuralı (tek kaynak, dağınık `if` yok):** öğe görünür ⟺ `can(actor, yetki)` **VE** (öğe core-grubu **VEYA** owner view-state = Full). Eğitmen: satış yetkisi yok → zaten görmez. Owner: view-state enterprise gruplarını (Satış/Aktivite/Kampanya/Eğitim-OP/Kullanıcılar/Eğitmenler) açıp kapatır.

**Mevcut durum (Opus kontrol etti 2026-07-01):**
- ✅ Server-side güvenlik TAM: tüm servisler `can(actor,…)` + `ForbiddenError`. Eğitmen satış servisini çağıramaz (menü gizleme kozmetik değil, server zaten koruyor).
- ⚠️ `FlexSidebar.tsx` statik/mod-kör, tüm menüler her zaman render; 18 sayfa ayrı import.
- ⚠️ `/flexos/layout.tsx` YOK. Modu client'a taşıyan tek yer `kullanicilar/page.tsx` (`/api/flexos/settings` fetch).

**Sonnet uyguladı (2026-07-01):** `view.toggle` capability (`registry.ts`+`packages.ts`, admin paketine — UID hardcode yok) · PIN backend: `domain/core/view-pin.ts` + `repo/view-pin-repo.ts` + `server/view-pin-repo.firestore.ts` (koleksiyon `flexos_view_pins`, doküman id=uid, server-only rules) + `domain/services/view-access-service.ts` (`getViewAccessStatus`/`verifyViewPin`/`setViewPin`, Node `scrypt`+`timingSafeEqual`, hep `view.toggle` gated) · route'lar `GET /api/flexos/me` (capability listesi — menü kararına genel amaçlı temel), `GET /api/flexos/view-access` (hasPin), `POST /api/flexos/view-access/verify`, `POST /api/flexos/view-access/pin` · **layout.tsx yerine FlexSidebar kendi içinde self-contained** (18 sayfayı refactor etmeden `/api/flexos/me` fetch + localStorage[uid] mode + `Ctrl/Cmd+Shift+M` kısayolu + `ViewPinModal.tsx`, hepsi tek dosyada — "tek kaynak" ilkesi korunuyor) · FlexSidebar menü kuralı `canSee(cap, core)` ile bağlandı: core-grup (Ana Sayfa/Öğrenciler/Sınıflar/Yoklamalar/Sertifikasyon) her zaman, enterprise-grup (Eğitim Yönetimi/Satışlar/Eğitmenler/Kullanıcılar/Aktivite Merkezi) sadece Full · PIN kurulum/değişim UI'ı `kullanicilar/page.tsx`'e eklendi (Sistem Modu kartının altı, sadece `view.toggle` sahibi görür — sidebar/topbar'da sıfır görsel iz korundu). **16 yeni assertion** (`scripts/assert-view-access.ts`) + mevcut 24 (standalone-mode) geçti, `tsc`+ESLint temiz, `npm run build` başarılı. **✅ Tarayıcıda test edildi (2026-07-02):** kullanıcı login + kısayol + PIN akışını çalıştırdı — Core moduna geçince sol menü sadeleşiyor (enterprise grupları gizleniyor), beklendiği gibi.

### ✅ Sınıflar — Core/Full paylaşımlı GroupTable+RosterDrawer BİTTİ (2026-07-01)

Eğitmen (Core) "Sınıflarım" ekranı kart-grid'den Full'daki (Operasyon) kaliteye çıkarıldı — kopyala-yapıştır değil, **tek paylaşımlı kod** (`src/app/flexos/siniflar/_shared/`): `groupDisplay.ts` (tipler+STATUS_MAP+initials-avatar yardımcıları), `useGroupCatalog.ts` (Branş→Eğitim→Bölüm cascade + Seans kütüphanesi fetch, `enabled` flag'li), `GroupTable.tsx` (filtre+Liste/Kart toggle+sayfalama+lifecycle: Başlat/Bitir/Sil/Geri Al, `mode="full"|"core"` ile Eğitmen/Şube/doluluk-bar kolonlarını gizler), `RosterDrawer.tsx` (`canManage` prop'uyla Full'da salt-görüntüleme, Core'da öğrenci ekle/çıkar formu — Havuz olmadığı için tek yer burası). Avatar = daire+baş harf (feedback_avatar_style, görsel avatar yok). `siniflar/page.tsx` (Full) ve `EgitmenSiniflarPanel.tsx` (Core) artık ikisi de bu bileşenleri kullanıyor. **Core'daki gerçek eksikler kapatıldı:** Bölüm dropdown'ı (sectioned eğitimde eskiden hiç yoktu) + gerçek Seans picker (`/api/flexos/seanslar`, eskiden elle gün-toggle) + Düzenle (editingId, eskiden hiç yoktu) + lifecycle butonları (eskiden capability var ama UI yoktu). `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 24+14 assertion (standalone-mode + view-access) hâlâ geçiyor (regresyon yok). **Test edilmeyen:** tarayıcıda gerçek kullanım (bu oturumda login yok).

#### Kararlar / Bağlam (2026-07-01, Opus ile — "neden böyle")

Bu bölüm yukarıdaki spec'in stratejik arka planı. İşi kodlamak için spec yeter; bunlar "neden bu yolu seçtik" içindir.

- **Core ayrı bir ticari ürün DEĞİL.** Kullanıcının niyeti: "eğitmen kısmını ticari düşünmüyorum; esas satarsam full paket satarım." Ortada tek kurum var (çalıştığı şirket), full sistemi şimdi benimsemeyecek → "bari eğitmenler kendi kısmını kullansın" diye eğitmen modu açılıyor. Nihai hedef herkes için full sistem.
- **GERÇEK canlı kullanım, demo değil** (önce test süreçleri). Bu yüzden menü gizleme tek başına yetmez — server-side `can()` de kesmeli (zaten kesiyor, doğrulandı).
- **Eğitmen modülü hafif/çöpe atılabilir DEĞİL** — aylarca emek (oyunlaştırılmış tasarım ödevleri, detaylı yoklama, aylık ders raporu, sertifika/ödev notu, öğrenciden ödev toplama). İki üründe de AYNI modül; **Core = Full eksi Satış/Eğitim-OP.** Tek fark: Core'da eğitmen kendi grup/öğrencisini ekler (`EGITMEN_STANDALONE_EXTRA`).
- **`standaloneMode` runtime switch KALIR** (dün kurulan Firestore + cache). Admin-only (Kullanıcılar sayfası), eğitmen çeviremez. Esneklik + gerektiğinde geçiş için doğru mekanizma.
- **REDDEDİLEN yollar:** (a) Gemini/GPT'nin ticari `licenseTier` + faturalandırma-sınırı katmanı → over-engineering, satılmayan ürün için gereksiz. (b) Kuruma-özel env-sabiti / per-install dağıtım → şimdilik gereksiz, runtime esneklik isteniyor. (c) Multi-tenant izolasyon → tek kurum olduğu için gereksiz. **Hepsi "ileride tamamen ticari olursa" diye ERTELENDİ**, şimdi kurulmayacak.

### ✅ Sınıflarım (Core) — canlı UX'e hizalama + kritik yetki-kapsamı açıkları BİTTİ (2026-07-01)

Kullanıcı canlı sistemi (`src/app/components/dashboard/class-management`+`student-management`) inceleyip Core'un davranışını ona göre düzeltmemizi istedi. Yapılanlar:

- **Sidebar flaş düzeltildi:** `FlexSidebar` sayfa değişince yeniden mount oluyordu, capability listesi her seferinde boştan yükleniyordu → menü "boşalıp doluyordu". Modül-seviyeli `capsCache` eklendi (ilk yüklemede fetch, sonra cache'ten oku).
- **Sistem Modu switch'ine onay modalı** eklendi (Kullanıcılar sayfası) — tek tıkla değişmiyor, "Evet/Vazgeç" onayı şart (FlexModal deseni).
- **Kullanıcılar sayfası header'ı** diğer sayfalarla (mavi ikon, container genişliği) hizalandı.
- **Core UI canlıya göre yeniden kuruldu:** Grup Ekle formu bottom-sheet'ten **akordiyona** çevrildi (sayfa içi açılıp kapanıyor, modal değil); grup kartı sol ikonu branş-rengi yerine **paylaşımlı avatar paleti** (initials+gradient, `avatarStyle`); Core'da **Liste görünümü kaldırıldı** (sadece Kart); grup filtre barı Full'un 4 durumundan (Açılacak/Aktif/Tamamlandı/İptal) canlıdaki gibi **Aktif/Arşiv** ikilisine indirildi; grup kartına tıklayınca artık sağdan drawer AÇILMIYOR — aşağıdaki **Öğrencilerim** tablosu o gruba filtreleniyor ("Mevcut Grup: X" / "Tüm Öğrenciler" toggle, canlıdaki "Mevcut Sınıf" davranışı); üst buton "+ Grup Ekle" olarak yeniden adlandırıldı.
- **Öğrencilerim bölümü tamamlandı:** Öğrenci Havuzu tablo görseliyle (avatar/badge/tableCard stilleri) ama Core'a özel sade kolonlar; 15/sayfa + sayfalama; Aktif/Mezun tab; sağ üstte **Öğrenci Ekle** (bottom-sheet, Grup opsiyonel — **AÇIK SORUN**, aşağı bak); satır aksiyonları canlıdaki gibi **Düzenle/Mezun Et/Aktife Al/Sil** (onay modalli). Backend: `setEnrollmentStatus` yeni servis (`enrollment-service.ts`, completed/cancelled/active geçişleri, grupsuz kayıtlarda da çalışır) + `PATCH /api/flexos/enrollments/[id]` artık `{status}` body'sini de kabul ediyor. 7 yeni assertion (`scripts/assert-enrollment-status.ts`).
- **🔒 KRİTİK yetki-kapsamı açıkları bulundu ve kapatıldı** (kullanıcı sordu: "diğer eğitmen diğer eğitmenin öğrencisini görebilir mi?" — cevap evetti, düzeltildi):
  - `GET /api/flexos/persons` — org-scope olmayan aktör (eğitmen) artık SADECE kendi grubundaki öğrencileri görür (önceden TÜM okulu görüyordu — gerçek sızıntıydı). `primaryEnrollmentId` + `groups[].groupId` alanları eklendi (Core'un satır aksiyonları + grup filtresi için).
  - `GET /api/flexos/groups` — `trainerId` query param'ı client'tan geliyordu, sunucu doğrulamıyordu (biri boş bırakınca/başka uid yazınca her şeyi görebilirdi). Artık `group.read` yetkisi kontrol ediliyor + org-scope olmayan aktör için `trainerId` sunucu tarafında `actor.uid`'e sabitleniyor.
  - `GET /api/flexos/groups/[id]/roster` — hedef grup hiç kontrol edilmiyordu (herhangi bir groupId ile herhangi bir roster çekilebiliyordu). Artık grup çekilip `group.trainerId === actor.uid` (veya org-scope) doğrulanıyor.
  - **AÇIK KALAN (düşük risk, ertelendi):** `PATCH /api/flexos/persons/[id]` (Düzenle) hâlâ hedef-bazlı sahiplik kontrolü yapmıyor — id'ler tahmin edilemez olduğu için pratik risk düşük, ama tam kapsam için sıradaki iş.
- `tsc`+ESLint temiz, `npm run build` başarılı, tüm assertion'lar (24+14+7) geçiyor.

**✅ BİTTİ (2026-07-01, sonraki turda):** Core'da "Öğrenci Ekle" formunda Grup seçimi **zorunlu** yapıldı ("Grupsuz — sonra atarım" seçeneği kaldırıldı; boş bırakılırsa "Grup seçimi zorunludur" uyarısı). Enrollment artık koşulsuz oluşturuluyor (eskiden `if (sGroupId)` şartlıydı). Düzenleme modunda Grup alanı zaten yoktu, değişmedi.

**✅ BİTTİ — Eğitim Ayarları artık Core'da da erişilir:** Kullanıcı sordu: eğitmen kendi grubunu açarken Branş/Eğitim seçmesi gerekiyor ama bunları oluşturma yetkisi (`branch.create`/`education.create`) sadece admin/operasyon'da — peki admin, Core görünümündeyken (Görünüm Anahtarı) bunu nasıl kurar? Çözüm: `FlexSidebar`'daki "Eğitim Yönetimi" akordiyonu ikiye ayrıldı — **"Eğitimler"** (katalog CRUD/Eğitim Ekle) Full-only kaldı, **"Eğitim Ayarları"** (Branş Havuzu + Tatil + Sertifika + Sözleşme, `/flexos/egitim-yonetimi/ayarlar`) artık **hem Core hem Full'da görünüyor** (`canSee("branch.create", true)` — core=true). Veri zaten baştan beri ortaktı (`flexos_branches` tek koleksiyon); değişen sadece sidebar görünürlük kuralı. Gerçek eğitmen hesapları `branch.create` yetkisine sahip olmadığı için onlara yine hiç görünmez — sadece admin/operasyon paketi görür.
- `tsc`+ESLint temiz, `npm run build` başarılı.

### ✅ Full versiyonda eğitmen v2 — capability-gated "benim gruplarım" görünümü BİTTİ (2026-07-02)

Full'da eğitmen ana sisteme bağlı, kendisi grup/öğrenci EKLEMİYOR (bunu Core modda yapıyor — doğrulandı, Core'daki Grup Ekle/Öğrenci Ekle akışı uçtan uca tamam, tek düzeltme: `EgitmenSiniflarPanel.tsx:576`'daki yanıltıcı "Grup seçimi opsiyonel" yardım metni silindi, kod zaten grubu zorunlu kılıyordu).

**Full'da bulunan boşluk:** Eğitmen `standaloneMode=false` iken admin'in birebir aynı Sınıflar/Öğrenciler sayfalarını görüyordu; ekleme/düzenleme butonları `standaloneMode`'a göre değil gerçek capability'e göre gizlenmiyordu (veri zaten API'de scope'luydu — bkz. yukarıdaki "kritik yetki açıkları" fix'i — ama UI hâlâ "tüm sistem" hissi veriyordu).

**Çözüm:** `src/app/flexos/_components/useCapabilities.ts` — `GET /api/flexos/me`'yi bir kere çeken, modül-seviyeli cache'li paylaşımlı hook (FlexSidebar'daki `capsCache` deseninin sayfa-seviyeli hali). `GroupTable.tsx`'e `canManage?: boolean` prop'u eklendi (default `true`, Core'daki mevcut kullanım etkilenmedi) — `false` iken liste görünümündeki Başlat/Bitir/Düzenle/Sil/Geri-al aksiyon hücresi `—` ile değişiyor. `siniflar/page.tsx`: `canManageGroups = caps.has("group.create")` — "Grup Ekle" butonu ve `GroupTable canManage` buna bağlandı. `ogrenciler/havuz/page.tsx`: `canAssignGroup = caps.has("group.assign_student")` → "Gruba Ata" satır aksiyonu, `canEditPerson = caps.has("person.edit")` → öğrenci detayındaki "Düzenle" butonu gate edildi. Eğitmen Full'da (`EGITMEN_CORE` paketi: sadece `group.create` yok, `group.assign_student` yok, `person.edit` yok) artık bu aksiyonları hiç görmüyor; admin/operasyon/satış (kendi paketlerinde bu capability'ler var) değişiklik görmüyor. `tsc`+ESLint temiz, `npm run build` başarılı (tüm route'lar derlendi, regresyon yok).

**Test edilmeyen:** Gerçek eğitmen hesabıyla Full'da tarayıcı testi (bu oturumda login yapılmadı) — sıradaki oturumda doğrulanmalı.

### ✅ Görünüm Anahtarı artık GERÇEK yetki düşürüyor (sadece owner'a özel) BİTTİ (2026-07-02)

Kullanıcı `Cmd+Shift+M`'i test ederken fark etti: Core moda geçince yetkisi hâlâ tam admin'di (kozmetik — sadece sidebar sadeleşiyordu). İstediği: Core moddayken **gerçekten eğitmen gibi** olmak (grup ekleyemesin, PII göremesin, başka eğitmenin öğrencisini göremesin) — ama SADECE kendi hesabında, başka hiçbir admin/eğitmen hesabında bu özellik var olmasın.

**Mimari değişiklik:**
- `view.toggle` capability'si **admin paketinden çıkarıldı** (`packages.ts`) — artık paket-seviyeli değil, `actor.ts`'e eklenen `extraGrants` (tekil/uid'e özel grant) mekanizmasıyla veriliyor.
- `src/app/lib/server/auth-actor.ts`: **tek bir sabit** `VIEW_TOGGLE_OWNER_EMAIL = "alparslan.sennturk@gmail.com"` — kod tabanında BAŞKA HİÇBİR YERDE uid/email hardcode yok. `packagesForCaller()`: bu email + Core moddaysa paket `["egitmen"]` döner (yoksa her zaman `["admin"]`); `actorFromCaller()`: bu email'e her zaman `view.toggle` grant'i ekler (paket ne olursa olsun — Core'dayken bile Full'a dönebilsin diye).
- Mod artık **sunucuda da kalıcı** (önceden sadece localStorage'da kozmetikti): yeni `flexos_view_modes/{uid}` koleksiyonu (server-only) + `ViewModeRepo` port/adapter + `setViewMode()` servis fonksiyonu + `POST /api/flexos/view-access/mode` route. `auth-actor.ts`'te `standaloneMode` ile aynı desende in-process TTL cache (10sn, fire-and-forget refresh, soğuk başlangıçta güvenli varsayılan `"full"`).
- `resolvePackages(["egitmen"], {standaloneMode})` zaten var olan mekanizmayı kullanıyor — sistem Full modundaysa (`standaloneMode=false`) owner Core'a geçince gerçek bir eğitmenle **birebir aynı** `EGITMEN_CORE` kısıtlarına düşüyor (grup/öğrenci ekleyemez, PII yazamaz), sistem Core modundaysa `EGITMEN_STANDALONE_EXTRA` da eklenir — özel kod yok, mevcut standaloneMode dalı olduğu gibi devrede.
- `FlexSidebar.tsx`: kısayol artık modu hem localStorage'a hem sunucuya yazıyor (`persistModeAndReload`), sonra **sayfayı yeniliyor** — böylece hem sidebar hem her sayfanın kendi `useCapabilities()` cache'i taze `/api/flexos/me` sonucunu okur (stale-cache riski yok).
- `scripts/assert-view-access.ts` yeni mimariye göre güncellendi (admin artık `view.toggle`'ı owner-simülasyonlu tekil grant'le alıyor, "sıradan admin paket-seviyeli view.toggle YOK" assertion'ı eklendi) — **15 assertion geçti** (+1 yeni). Tüm mevcut assertion'lar (24+7+12) regresyon olmadan geçti. `tsc`+ESLint temiz, `npm run build` başarılı.

**Kabul edilen sınırlama:** Şu an owner'ın uid'ine `trainerId` olarak atanmış gerçek grup yok — Core moda geçince Sınıflar boş görünecek ("size atanmış grup yok"), kullanıcı bunu kabul etti (sistem yeni kuruluyor, ileride gerçek gruplar atanınca dolacak).

**Test edilmeyen:** Gerçek tarayıcıda `Cmd+Shift+M` ile Core'a geçip API çağrılarının (`GET /groups`, `/persons` vb.) gerçekten `egitmen` kısıtlarıyla döndüğü doğrulanmadı (bu oturumda login yok) — sıradaki oturumda doğrulanmalı. Ayrıca `flexos_view_modes` cache TTL'i (10sn) nedeniyle mod değişimi ilk birkaç saniye gecikmeli yansıyabilir (mevcut `standaloneMode` cache'iyle aynı bilinen davranış).

**🔧 Düzeltme (2026-07-02, aynı oturum devamı):** Kullanıcı test ederken 2 şey netleşti:
1. **Mimari teyidi (doğru kurulmuş, değişiklik gerekmedi):** İki ayrı kavram karışmasın diye açıkça test edildi — `flexos_settings.standaloneMode` (Sistem Modu, Kullanıcılar sayfası, sistem geneli Full↔Core) ile `flexos_view_modes/{uid}` (kişisel görünüm, `Cmd+Shift+M`, SADECE owner) birbirine hiç dokunmuyor. Kısayol asla sistem modunu değiştirmiyor — sadece owner'ın kendi paketini (`admin`↔`egitmen`) değiştiriyor, eğitmen kısıtları mevcut sistem moduna göre otomatik şekilleniyor (`resolvePackages` zaten `standaloneMode`'u parametre alıyor). Sistem Full↔Core geçişi HER ZAMAN sadece Kullanıcılar'daki buton ile olur — doğrulandı, kod zaten böyle.
2. **Gerçek bug bulundu ve düzeltildi:** Kısayolla mod değiştirip sayfa yenilenince sidebar/sayfa aksiyonları (ör. Sınıflar'daki "Grup Ekle") bazen eski yetkiyle kalıyordu, manuel yenileme ya da menüye girip çıkınca düzeliyordu. Neden: `auth-actor.ts`'teki mod cache'i (`standaloneMode` ile aynı TTL deseni, 10sn) mod Firestore'a yazıldıktan sonra hemen yenilenmiyordu — bir sonraki normal istek TTL'i geçene kadar eski değeri döndürüyordu. **Çözüm:** yeni `primeViewModeCache(mode)` — `POST /api/flexos/view-access/mode` route'u `setViewMode()` başarılı olduğu anda bu instance'ın cache'ini TTL beklemeden senkron günceller (client zaten `window.location.reload()` çağırıyordu — asıl sorun sunucudaki gecikmeydi). `tsc`+ESLint temiz, 15+24 assertion geçti, `npm run build` başarılı.

**🔒 Kapsam düzeltmesi (aynı oturum, kullanıcı fark etti):** "Öğrenciler" (Havuz) sayfası admin/satış/operasyon işi — eğitmen bunu ne Full'da ne Core sistem modunda görmeli, kendi öğrencilerini Core'daki Sınıflarım → "Öğrencilerim" bölümünden ekliyor/görüyor zaten (ayrı, doğru akış). Eskiden `FlexSidebar`'da "Öğrenciler" linki `canSee("person.read", true)` ile gösteriliyordu — `person.read` eğitmen paketinde de olduğu için (hem Core hem Full) eğitmen bu linki görüyordu (link'e tıklayınca API zaten kendi grubuna scope'lu veri döndürüyordu — güvenlik açığı değildi, ama yanlış sayfaydı/UX tutarsızlığıydı). Düzeltme: gate `canSee("sale.read", false)` oldu — `sale.read` eğitmen paketinde (ne Core ne Full/standalone-extra) hiç yok, sadece satış/operasyon/admin'de var; `false` (enterprise-grup) ile owner'ın kişisel Core görünümünde de gizleniyor (mode=core iken owner zaten egitmen paketine düşüyor, aynı kural otomatik uygulanıyor). `tsc`+ESLint temiz, `npm run build` başarılı.

**✅ Real-time gecikme kökten kapatıldı + doğrulandı (2026-07-02, aynı oturum):** Kullanıcı local dev'de test ederken mod değişiminin bazen gecikmeli/ters yansıdığını bildirdi ("admin iken grup ekleyemiyorum, eğitmen iken ekleyebiliyorum" gibi kafa karıştırıcı anlar dahil). Kök neden ikiliydi: (1) `primeViewModeCache` henüz eklenmemişken TTL cache gecikmesi (bir önceki maddede düzeltildi), (2) gerçek bir yarış durumu — eski/geride kalmış bir arka plan Firestore okuması (`refreshViewModeCache`), yeni yazılan doğru değerin üzerine geç gelip eskiyi yazabiliyordu. **İkinci fix:** `refreshViewModeCache` artık okumaya başladığı anın zaman damgasını tutuyor (`requestStartedAt`) ve sonuç geldiğinde `viewModeLoadedAt` bu zamandan daha yeniyse (yani araya `primeViewModeCache` veya başka bir refresh girmişse) sonucu ATLIYOR — böylece geç gelen eski okuma asla daha taze bir değerin üzerine yazamaz. Kullanıcı bu fix sonrası "Grup Ekle" doğru çalıştı ama "Eğitim Yönetimi" hâlâ otomatik `window.location.reload()` sonrası eski (admin) haliyle görünmeye devam etti — sadece elle Cmd+R basınca düzeliyordu. Kök neden farklıydı: `fetch("/api/flexos/me")` çağrıları `cache` opsiyonu belirtmiyordu, tarayıcı otomatik reload sonrası isteği **HTTP cache'ten** (birkaç yüz ms önceki eski cevap) sunuyordu; sunucu da yanıtta `Cache-Control` header'ı vermiyordu. **Fix:** hem `FlexSidebar.tsx` hem `useCapabilities.ts`'teki `/api/flexos/me` çağrılarına `cache: "no-store"` eklendi, route'un kendisi de `Cache-Control: no-store` header'ıyla dönüyor (savunma amaçlı, çift taraflı). `tsc`+ESLint temiz, `npm run build` başarılı. **Bu spesifik cache fix'i kullanıcı tarafından henüz tarayıcıda doğrulanmadı** (bir önceki maddedeki TTL/race fix'i doğrulandı, bu üçüncü kök neden ondan hemen sonra bulundu) — sıradaki oturumda/testte kontrol edilmeli. Ayrıca doğrulandı: `education.create`/`branch.create` eğitmen paketinde (Core dahil, sistem Full iken) hiç yok → "Eğitim Yönetimi" akordiyonu (Eğitimler+Eğitim Ayarları) eğitmen görünümünde artık doğru şekilde tamamen gizli; `group.read`/`grade.write`/`grade.finalize` her zaman eğitmen paketinde → Sınıflar/Yoklamalar/Sertifikasyon her iki sistem modunda da görünür — kod zaten böyle kuruluydu, ek değişiklik gerekmedi. `tsc`+ESLint temiz, 15+24 assertion geçti, `npm run build` başarılı.

**Kökten çözüm — TTL/periyodik yenileme tamamen kaldırıldı (aynı gün, devam):** `no-store` fix'i Full→Core yönünü düzeltti ama Core→Full (PIN'li) yönünde aynı sınıf sorun (sol menü/yetki gecikmeli geliyor, başka sayfaya girip çıkınca düzeliyor) + `GET /api/flexos/persons` (Öğrenciler listesi geçiş anında geçici BOŞ geliyordu — aynı kök neden: actor geçiş anında yanlışlıkla `egitmen`e, yani "atanmış grubum yok"a düşüp boş liste dönüyordu) devam etti. **Gerçek kök neden:** `standaloneMode` deseninden kopyalanan 10sn'lik arka plan TTL yenilemesi mimari olarak yanlış modeldi — `standaloneMode` BİRDEN FAZLA admin'in farklı tarayıcılardan değiştirebileceği bir ayar olduğu için periyodik yoklama (polling) gerekiyor; ama görünüm modu SADECE TEK kullanıcıya özel ve SADECE TEK bir kod yolundan (`POST /view-access/mode`) değişiyor — periyodik yeniden okuma hiç gerekmiyordu, sadece yarış riski katıyordu (eski bir arka plan okuması yeni yazılan doğru değerin üzerine geç gelip yazabiliyordu). **Yeni model:** `cachedViewMode` SADECE (1) soğuk başlangıçta bir kez Firestore'dan yüklenir (`loadViewModeOnColdStart`, `viewModeColdStartDone` bayrağıyla tek seferlik) VEYA (2) `primeViewModeCache()` ile senkron güncellenir (her mod değişiminde `POST /mode` route'u tarafından çağrılır) — periyodik TTL yeniden kontrolü tamamen kaldırıldı, tek doğruluk kaynağı artık `primeViewModeCache`. `tsc`+ESLint temiz, 15+24+7 assertion geçti, `npm run build` başarılı. **Test edilmeyen:** bu son kökten-çözüm kullanıcı tarafından henüz tarayıcıda doğrulanmadı (art arda çok sayıda bug bulunup düzeltildiği için bu oturumda zaman kalmadı) — sıradaki oturumda Core↔Full geçişleri (özellikle PIN'li Core→Full yönü) ve Öğrenciler listesinin her geçişte anında doğru geldiği tekrar test edilmeli.

**✅ "Yanlış sayfada kalma" sorunu → geçici Ana Sayfa'larla çözüldü (aynı gün, devam):** Kullanıcı test ederken iki gerçek UX sorunu bulundu: (1) Kullanıcılar sayfasındayken eğitmen moduna geçince sayfa `role.manage` isteyen veri çekmeye devam edip 403+çirkin "fetch failed" hatası veriyordu; (2) Öğrenciler (Havuz) sayfasındayken mod değişince sayfa aynı URL'de kalıyor, dışarı çıkıp geri girene kadar düzelmiyordu. **Kök neden:** `persistModeAndReload` sadece `window.location.reload()` yapıyordu — mod değişse de kullanıcı capability'si olmayan bir sayfada kalabiliyordu. **Çözüm:** iki geçici (içi boş) placeholder sayfa eklendi — `/flexos/anasayfa` (admin/Full) ve `/flexos/egitmen-anasayfa` (eğitmen/Core), ikisi de hiçbir capability-gated veri çekmiyor (asla 403 vermez, sadece auth ister). `persistModeAndReload` artık `reload()` yerine ilgili moda uygun ana sayfaya **navigate** ediyor (`window.location.href`) — bu hem UX sorununu çözüyor hem de yeni URL'e gidildiği için önceki tüm cache/staleness sınıfı sorunları da bypass ediyor (aynı URL'e tekrar istek değil, hiç yapılmamış taze istek). Sidebar'daki "Ana Sayfa" linki de artık işlevsel (`role.manage` varsa admin ana sayfa, yoksa eğitmen ana sayfa) — eskiden "yakında" toast'ı gösteriyordu. **Ürün kararı (kullanıcı):** owner Core'a geçince bilerek EĞİTMENİN ana sayfasını görüyor (kendi admin ana sayfasını değil) — "eğitmenin dashboard'unu deneyimlemek istiyorum" niyetiyle. Satış/Operasyon için ayrı dashboard'lar ileride ayrı iş kalemi. `tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/anasayfa` + `/flexos/egitmen-anasayfa` derlendi). **Test edilmeyen:** tarayıcıda doğrulanmadı, sıradaki oturumda kontrol edilmeli.

### 📋 Yoklama v2 + Finans Modülü — Kararlar (2026-07-02, henüz kod YAZILMADI)

> Kullanıcı Claude Design'da dashboard tasarımı yaptırıyor; paralelde "önce dashboard mı, önce modül taşıma mı" tartışıldı. **Karar: dashboard blocker değil** — dashboard altındaki modüllerin (yoklama/ödev/sertifika) verisini özetler, modüller yokken dashboard'a gerçek içerik konamaz. Sıra: **önce yoklama backend'i**, dashboard paralelde tasarlanabilir ama modül verisine bağlanması en sona kalır.

**Canlıdaki yoklama altyapısı değerlendirmesi (kod+log incelendi):** `AttendancePanel.tsx` (2001 satır) + `attendance-report/page.tsx` (1017 satır) + cron (`auto-close-attendance`). Son kod dokunuşu 2026-06-12 (`957f06b`), o zamandan beri stabil. İş kuralları OLGUN ve defalarca bug-fix'lenmiş (3 gün düzenleme penceresi, 6 saat auto-close, zaman kilidi admin muafiyeti, race condition fix'leri, banner durumları, takvim min/max) — **bunlar yeniden yazılmayacak, referans alınıp portlanacak.** Veri modeli (`design_attendance/{groupId}_{tarih}`, eski `groups`/`students`'a bağlı) taşınamaz — `flexos_attendance` + `Enrollment`/`flexos_groups` üstünde sıfırdan kurulacak (kaçınılmaz, yeni mimari).

**Kullanıcı kararları — yoklama v2 kuralları:**
- **UI aynen taşınır, TEK fark: avatar.** Görsel/illüstrasyon avatar YOK → kurumsal standart **daire + baş harf (gradient)** ([[avatar-stili]] ile aynı kural).
- **Görünürlük üç ayrı sayfa/kitle:**
  - **Yoklama Al + Yoklama Detay** → eğitmen görür, kendi grubunda **3 gün içinde düzenleyebilir** (canlıdaki `withinEditWindow` mantığı aynen).
  - **Yoklama Raporu** → **eğitmende YOK.** Sadece **Eğitim Op** (sınıf durumu + kaç saat yoklama alındı takibi; eğitmenin yetkisi olmayan girişi eğitmen talebiyle yapar/düzenler) ve **Finans** (ay sonu hakediş = yoklama saati × `Trainer.hourlyRate`, zaten `flexos_trainers`'ta var).
- **Veri modeli — en kritik kural:** Person tek kimlik (hem müşteri hem öğrenci); ödeme/enrollment/yoklama arkada ayrı tutulur ama **Öğrenci Kartı'nda TEK ekranda birleşir** (yoklama dahil). [[project-student-card-hub]]'daki Enrollment-bazlı sekme modeliyle (eğitim seçici → alt sekmeler) birebir örtüşüyor — yoklama o sekmelerden biri olacak.
- **İleride (şimdi kapsam dışı, vizyon notu):** Sistem devamsızlık paternini otomatik tespit edip Eğitim Op'u uyaracak ("bu öğrenci bir süredir gelmiyor"). Backend tasarımı buna kapıyı kapatmayacak (entry'ler tarih+durum bazlı sorgulanabilir kalacak) ama şimdi inşa edilmeyecek.

**Finans — YENİ 5. capability paketi (KARAR):** `satis|operasyon|egitmen|admin` → **+`finans`**. Gerekçe: Op'tan ayrı iş/kişi, finansal veri (hakediş/ödeme durumu) Op'a gereksiz sızmasın; paket eklemek mimari olarak ucuz (sadece registry+grant listesi). **Kapsam (kullanıcı):**
1. Ay sonu eğitmen hakediş hesabı (yoklama saati × `hourlyRate`).
2. Tahsilat takibi — ödemesi geciken/yaklaşan öğrencileri görür (zaten [[fatura-billing-modeli]]'nde tanımlıydı).
3. "Ödeme alındı" işaretleme (tık).
4. Ödeme hiç gelmezse **Eğitim Op'a bilgi verir.**
5. Gerekirse öğrenciyi **manuel beklemeye alır** — YENİ bir otomasyon değil, [[project-status-model]]'deki mevcut "askıya alma manuel" mekanizmasının finans tarafından da tetiklenebilir hale gelmesi.

**✅ Yoklama backend BİTTİ (2026-07-02, aynı gün devam):** `domain/core/attendance.ts` (`Attendance`: `id="{groupId}_{date}"`, `entries: Record<personId, {hours, online?}>`, `attendanceClosed`) + `domain/repo/attendance-repo.ts` (port) + `server/attendance-repo.firestore.ts` (`flexos_attendance` koleksiyonu) + `domain/services/attendance-service.ts`:
- `startLesson(actor, {groupId, date}, deps)` — gated `attendance.write`; grubun ders günü (`schedule.days`) + tarih aralığı (`startDate`/`endDate`) doğrular; mevcut kaydın üzerine ASLA yazmaz (canlıdaki `handleStartLesson` güvencesi).
- `saveAttendance(actor, {groupId, date, entries, close?}, deps)` — gated; **org-scope aktör (Op/Finans/Admin) 3 gün penceresini HER ZAMAN bypass eder** (`widestScope(actor,"attendance.write")==="org"`, canlıdaki "admin/yönetici muafiyeti" ile birebir ama capability-driven, `if(role===x)` yok); assigned-scope (standart eğitmen) sadece kendi grubunda ve `isWithinEditWindow(date)` (3 gün, `date`'ten hesaplanır — `closedAt`'tan DEĞİL, canlı kuralı aynen) içinde.
- 3 yeni capability: `attendance.write` (yazma/scope'lu), `attendance.read` (okuma/scope'lu), `attendance.report.read` (yellow+audited, scopable:false — Yoklama Raporu).
- **Paket dağılımı (2026-07-02 kararına birebir):** `egitmen` → `attendance.write`+`attendance.read` (assigned) SADECE — `attendance.report.read` BİLEREK YOK (Yoklama Raporu eğitmende hiç görünmez). `operasyon`+`admin` → üçü de org-scope. **YENİ 5. paket `finans`** (`packages.ts`, `PackageName` genişledi) → `attendance.report.read` + `trainer.rate.read` (hakediş: saat×hourlyRate) + `payment.create/read` + `sale.read` + `person.read` — **`attendance.write` BİLEREK YOK** (Finans tek tek kayıt yazamaz, sadece rapor okur). Not: `person.status.suspend` (manuel beklemeye alma) henüz registry'de yok — Finans'ın bu aksiyonu ileride netleşecek (billing modülü işi, şimdi kapsam dışı).
- Route'lar: `POST /api/flexos/attendance` (başlat), `GET /api/flexos/attendance?groupId=&date=` (tek kayıt+`withinEditWindow` bayrağı) veya `?groupId=&month=` (liste), `PATCH /api/flexos/attendance/[id]` (kaydet/kapat/yeniden aç — body `{groupId,date,entries,close?}`, id gövdeyle uyuşmazsa 400), `GET /api/flexos/attendance/report` (Op+Finans+Admin, gated `attendance.report.read`, groupId/trainerId/month filtreli, join'li — hakediş HESAPLAMASI burada YOK, sadece ham+join'li veri).
- Firestore rules: `flexos_attendance` server-only.
- **18 yeni assertion** (`scripts/assert-attendance.ts`) + mevcut 24+15+7+12 regresyonsuz geçti (toplam 76). `tsc`+ESLint temiz, `npm run build` başarılı (3 yeni route derlendi).
- **HENÜZ YOK (bilerek, sıradaki iş):** UI (Yoklama Al/Detay/Raporu sayfaları — canlıdaki `AttendancePanel.tsx` referans alınıp portlanacak, avatar hariç aynı), auto-close cron (canlıdaki `auto-close-attendance` benzeri — şimdilik `close` manuel), hakediş hesaplama servisi (Finans modülü, saat×hourlyRate), Öğrenci Kartı'na yoklama entegrasyonu ([[project-student-card-hub]]).

**🔧 Netleştirme (2026-07-02, aynı gün devam):** "Yoklama Raporu eğitmende YOK" kuralı **SADECE Full sistem için**. **Core (standalone) modda eğitmenin Yoklama Raporu görüp göremeyeceği HENÜZ KARARLAŞTIRILMADI** — ileride ayrıca karara bağlanacak. Core'da yoklamanın amacı farklı: eğitmen **kendi aylık/senelik ders saati toplamını** görsün ("bu ay/bu sene kaç saat ders verdim") — Op/Finans'ın çapraz-grup `attendance.report.read` raporundan AYRI, kişisel bir özet ihtiyacı. Muhtemelen eğitmenin zaten sahip olduğu `attendance.read` (kendi grupları) üzerinden, `attendance.report.read` açmadan karşılanabilir — henüz endpoint/UI yok, UI aşamasında karar verilecek.

**✅ Yoklama UI — AŞAMA 1 BİTTİ (2026-07-02, aynı gün devam):** `src/app/flexos/yoklama/_shared/AttendanceCore.tsx` (motor bileşen, Yoklama Al + Yoklama Detay ortak, canlıdaki `AttendancePanel.tsx`'ten portlandı) + `src/app/flexos/yoklama/al/page.tsx` (`/flexos/yoklama/al` — BİLEREK FlexSidebar'sız bağımsız sayfa, kendi başlık çubuğu, canlıdaki `/attend` deseni: framer-motion slide ile Yoklama Al↔Detay). Sidebar'daki "Yoklamalar" linki artık gerçek `attendance.write` capability'sine bağlı VE **yeni sekmede açılıyor** (`window.open`, 2026-07-02 kullanıcı kararı — ders başladıktan sonra yanlışlıkla başka sayfaya geçip yarım bırakmasın).
- **Kapsam kararı (kullanıcı, 2026-07-02): "kodun aynı olması önemli değil, UI aynı olmalı."** Aynı Tailwind sınıfları (globals.css `@theme` token'ları paylaşımlı, canlı/FlexOS aynı repo) — banner durumları, 3 gün kilidi, zaman penceresi (15dk önce–6sa sonra), Sınıf Geneli quick-mark, saat/online girişi, lacivert özet bar (Toplam/Yapılan/Kalan Ders başlıkları hep görünür — veri kısmı "—" placeholder, Başlangıç/Bitim gerçek veri) BİREBİR. TEK GÖRSEL FARK: avatarlar (illüstrasyon/foto YOK, `initials`/`avatarStyle` — `siniflar/_shared/groupDisplay.ts` ortak).
- **🐛 Canlıdaki bug DÜZELTİLDİ:** `setHours`/`markAllHours` artık online değerini `prev[personId]?.online ?? person.isOnlineStudent ?? false` ile seed ediyor — canlıda saat girilince kalıcı online öğrencinin işareti `false`'a düşüyordu (sadece `prev`'e bakılıyordu, `isOnlineStudent`'a hiç değil). `Person.isOnlineStudent` alanı eklendi + roster route'una dahil edildi.
- **`deleteAttendance` servis + `DELETE /api/flexos/attendance/[id]`** eklendi ("İptal"/"Temizle" — sadece kapatılmamış kayıtlarda).
- **AŞAMA 1'de BİLEREK ERTELENEN** (kullanıcı onayıyla): aylık planlanan/yapılan ders sayısı + kurs ilerleme donut'u (course-progress), öğrenci detay modalı (devam donut'u), auto-close cron (şimdilik "Dersi Bitir" manuel).
- **20 assertion'a çıktı** (`deleteAttendance` eklendi), `tsc`+ESLint temiz, `npm run build` başarılı.

**✅ "Ders Olmadı" (Ders İstisnası) — UI EKLENDİ, işlevsellik Aşama 2'de (2026-07-02):** Sebep seçim modalı (Eğitmen/Öğrenci/Teknik/Diğer + kapsam — org-scope'a görünür + not), kırmızı istisna banner'ı, ilgili UI kapıları (Sınıf Geneli/öğrenci listesi/alt buton) canlıdan birebir portlandı. **Kayıt SADECE yerel state** (`exceptions` map, sayfa yenilenince kaybolur) — backend persist (`lesson_exceptions` eşdeğeri, öğrenci-kaynaklı otomatik devamsızlık yazımı) Aşama 2'de.

**✅ AŞAMA 2 — İLK ADIM: Senelik Tatiller BİTTİ (2026-07-02, aynı gün devam):** Kullanıcı canlıdaki `GroupBranchPanel.tsx` "Tatiller & İptaller" bölümünü örnek gösterdi. Tam backend: `domain/core/holiday.ts` + repo port + `server/holiday-repo.firestore.ts` (`flexos_holidays` koleksiyonu, canlıdaki `holidays`'e dokunmaz) + `domain/services/holiday-service.ts` (create/update/delete, gated YENİ `holiday.manage` capability, operasyon+admin) + `POST/GET /api/flexos/holidays` + `PATCH/DELETE /api/flexos/holidays/[id]` (GET herkese açık — yoklama takvimi dahil herkesin okuması gerekiyor, sadece yazma kapılı) + Firestore rules. **UI:** `/flexos/egitim-yonetimi/ayarlar/tatil` (ekle/düzenle/sil, ad+başlangıç/bitiş tarih), Eğitim Ayarları hub'daki "Senelik Tatiller" kartı artık bu sayfaya bağlı (`to: null` placeholder kaldırıldı). **Yoklamaya bağlandı:** `AttendanceCore.tsx` artık `GET /api/flexos/holidays`'i okuyup tarih aralığını `Set<string>`'e açıyor — takvimde işaretleniyor (`DayCalendarPopover holidayDates`), o günlerde ders bloklanıyor (`isActiveForDate`/`overlayMessage`/sidebar grup listesi dot'u hepsi tatil-farkında). 9 yeni assertion (`scripts/assert-holiday.ts`). `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 24+15+7+12+20=78 assertion regresyonsuz (toplam 87).

**✅ AŞAMA 2 — 2. ve 3. adım: Kurs ilerleme altyapısı + Ders İstisnası backend'i BİTTİ (2026-07-02, aynı gün devam):** Kullanıcı: "aylık planlanan ders sayısı altyapısı yapılabilir, grup tanımlamak şart değil (Grafik-2 detayları belli olunca gerçek olur); ders istisnası backend'ine engel yok."
- **Lacivert bar gerçek veri:** `AttendanceCore.tsx` artık seçili grubun `educationId`'sinden `GET /api/flexos/educations/[id]` ile `totalHours` çekiyor + `GET /api/flexos/attendance?groupId=` (ay filtresiz → tüm zamanlı) ile gerçek "yapılan ders" sayısını hesaplıyor. **Toplam Ders** `Education.totalHours` boşsa (katalogda henüz tanımlanmadıysa, ör. Grafik-2) "—" kalır — alan doldurulunca otomatik gerçek sayı çıkar, ekstra kod gerekmez. **Yapılan Ders** her zaman gerçek (tüm-zamanlı kapatılmış/dolu kayıt sayısı × sessionHours). **Kalan Ders** = Toplam − Yapılan (Toplam yoksa "—"). Yeni backend/route YOK — mevcut `Education.totalHours` alanı ve mevcut `/attendance` endpoint'i yeniden kullanıldı.
- **Ders İstisnası backend'i TAM BAĞLANDI:** `domain/core/lesson-exception.ts` (`LessonException`: `id="system_{date}"|"{groupId}_{date}"`, `scope`, `reason`, `countsAsLesson`) + repo port + `server/lesson-exception-repo.firestore.ts` (`flexos_lesson_exceptions`) + `domain/services/lesson-exception-service.ts` (`saveLessonException`/`deleteLessonException`/`getLessonException`, gated `attendance.write` — `scope="system"` SADECE org-scope, canlıdaki `isAdmin()` kapısı) + `POST/GET /api/flexos/lesson-exceptions` + `DELETE /api/flexos/lesson-exceptions/[id]` + Firestore rules. **Öğrenci-kaynaklı istisna** (`reason="student"`, ders sayılır) → kayıt yoksa gruptaki TÜM aktif enrollment'lara otomatik devamsızlık yazar (kapatılmış `Attendance`, `createdByException:true`); istisna silinince bu kayıt da silinir (canlıdaki `createdByException` mantığı birebir). `AttendanceCore.tsx`'teki yerel `exceptions` map kaldırıldı, artık API'den yükleniyor/kaydediliyor.
- **28 yeni assertion** (10 lesson-exception, önceki 20 attendance zaten `deleteAttendance` içeriyordu) — mevcut 78 regresyonsuz geçti (toplam 97: 24+15+7+12+20+9+10). `tsc`+ESLint temiz, `npm run build` başarılı.

**✅ Yoklama Raporu UI BİTTİ (2026-07-02, aynı gün devam):** Backend zaten vardı (`GET /api/flexos/attendance/report`), sadece sayfa eksikti — kullanıcı "en mantıklısı bu" dedi, öncelik sırasını netleştirdi (Rapor → Hakediş → aylık stat kartları → auto-close cron → Core "kendi ders saatim"). `/flexos/yoklama/rapor` — gated `attendance.report.read` (Op+Finans+Admin, eğitmende YOK), FlexSidebar'a "Yoklama Raporu" linki eklendi (`IC.barChart`, `active="yoklama-raporu"` — mevcut eğitmen-facing "Yoklamalar" linkinden AYRI, farklı capability). İki bölüm: **(1) Eğitmen Bazlı Özet** — seçili ayda eğitmen başına ders sayısı+toplam saat (client-side aggregate, Finans'ın hakediş hesabı için ham girdi — çarpım/hourlyRate henüz YOK, ayrı iş) **(2) Kayıtlar** — tarih/grup/eğitim/eğitmen/saat/öğrenci/durum tablosu (Op'un sınıf takibi için). Filtreler: ay (varsayılan bu ay)/grup/eğitmen. Yeni backend YOK — sadece görüntüleme. `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 97 assertion regresyonsuz (bu iş assertion gerektirmedi, saf UI).

**🔧 DÜZELTME — Yoklama Raporu doğru portlandı + sidebar 3 alt menüye kavuştu (2026-07-02, aynı gün devam):** Kullanıcı ilk "Yoklama Raporu UI" denemesini (kendi tasarımım) reddetti: **"kafana göre yoklama raporu yapma, canlıda bir yoklama raporu var, oradan alacaksın birebir."** Gerçek dosya `src/app/dashboard/attendance-report/page.tsx` (1017 satır, `AttendanceSummaryPage`, admin-only) — LORE'daki eski isimlendirme yanıltıcıydı (dosya adı "attendance-report" ama içeriği tam "Yoklama Raporu"). Birebir portlandı: **3 panel, hepsi TEMBEL YÜKLENİR** (kullanıcı vurgusu — onlarca eğitmen yoklama girince her şeyi baştan çekmemek): (1) eğitmen bazlı tablo (Planlanan/Verdi/İptal/**Toplam Ders**[=hakediş kaynağı]/tamamlama%) + branş/grup/eğitmen filtre + grup-kodu arama (sadece eşleşen ≤5 grubun geçmişi çekilir) + tarih aralığı + özet stat kartları; (2) split view — sol eğitmenin grupları, sağ SEÇİLEN grubun TAM geçmişi (`GET /api/flexos/attendance?groupId=`, SADECE tıklanınca); (3) seçilen günün detayı (`AttendanceCore` salt-okunur, SADECE tıklanınca). Veri modeli çevirisi: canlının holiday-aware `estimatedEndDate` hesaplaması yerine FlexOS'un zaten var olan `Group.schedule.endDate` alanı kullanıldı (daha basit, aynı sonuç). **Backend eklemeleri:** `LessonExceptionRepo.list()` + `GET /api/flexos/lesson-exceptions` artık list-mode destekliyor (groupId/date yoksa `attendance.report.read` gated, `from`/`to` filtreli — cancelled/studentCancelled aggregate için); `GET /api/flexos/attendance/report`'a `from`/`to` + `createdByException` alanı eklendi. `AttendanceCore.tsx`'e `initialDate` prop'u eklendi (Panel 3'ün belirli bir tarihte açılması için).
- **Yeni sayfa `/flexos/yoklama/detay`** — canlıdaki `/dashboard/attendance` karşılığı (grup önceden seçili değil, `AttendanceCore mode="detail"` doğrudan).
- **Sidebar düzeltmesi:** "Yoklamalar" artık **akordiyon ana başlık** (Eğitim Yönetimi/Aktivite Merkezi ile aynı desen) → **Yoklama Al + Yoklama Detay** (`attendance.write`, eğitmen dahil, yeni sekmede açılır) + **Yoklama Raporu** (`attendance.report.read`, SADECE Op/Finans/Admin — eğitmende YOK, normal navigasyon). Önceki hatalı yapı (flat "Yoklamalar" + ayrı flat "Yoklama Raporu" item'ı) kaldırıldı.
- `tsc`+ESLint temiz, `npm run build` başarılı, mevcut 97 assertion regresyonsuz (bu iş yeni assertion gerektirmedi, saf UI+küçük backend genişlemeleri).

**✅ Yoklama Raporu cila + Görünüm Anahtarı kısayol serüveni (2026-07-02, aynı gün devam, tarayıcıda DOĞRULANDI):**
- Rapor tablosu: başlıklar `uppercase` CSS (Türkçe karakter uyumlu) + "Verdi"→"Verilen".
- Rapor'a diğer FlexOS sayfalarıyla aynı header eklendi (ikon kutusu solda, zil+kullanıcı sağda) — isim DİNAMİK (`users/{uid}`, statik "Alparslan Şentürk" değil, Yoklama Al'daki fix'le aynı desen). İkonlar lucide-react'e çevrildi (`TrendingUp`/`Clock`/`CheckCircle2`/`XCircle`, canlıyla aynı renkler) — placeholder emoji kaldırıldı.
- Header genişliği içerikle hizalandı (sabit `maxWidth:1920` yerine panellerle aynı Tailwind breakpoint'leri) + panel içindeki tekrarlayan "Yoklama Raporu" başlığı kaldırıldı (header'da zaten var, kalabalık azaldı).
- **Sidebar: Yoklama Detay artık yeni sekmede açılmıyor** — sadece Yoklama Al yeni sekmede (kullanıcı düzeltmesi, sadece Al'ın "yarım kalmasın" koruması gerekiyordu).
- **Görünüm Anahtarı kısayolu 3 kez değişti, sonunda bulunup çözüldü:** `Ctrl+Shift+M` (Chrome'un profil değiştirme kısayoluyla çakışıyordu, tarayıcı seviyesinde yakalanıyor) → `Ctrl+Shift+K` (görünürde çalışmadı, "hiç hareket yok") → **teşhis logu eklenip kök neden bulundu: hem `QuickSearch.tsx`'in kendi `Ctrl+K`'sı Shift/Alt'a bakmadan tetikleniyordu (düzeltildi: artık sadece SAF Ctrl+K'de açılıyor) HEM DE gerçek "k" tuşu tarayıcıya hiç ulaşmıyordu (muhtemelen arka planda çalışan başka bir uygulamanın global kısayolu — Grammarly/1Password/Notion/overlay türü).** Kullanıcı `Ctrl+Alt+M`'yi istedi → **tarayıcıda test edildi, ÇALIŞIYOR** ("bu oldu bak"). Teşhis logu temizlendi. Tüm UI metinleri (`kullanicilar/page.tsx` PIN açıklaması, `anasayfa`/`egitmen-anasayfa` doc yorumları) güncel kısayola göre güncellendi.
- `tsc`+ESLint temiz, `npm run build` başarılı, 97 assertion regresyonsuz her adımda.

**Durum:** Yoklama Aşama-1 (UI) + Aşama-2'nin büyük kısmı (Tatil günleri, kurs ilerleme altyapısı, Ders İstisnası backend'i, Yoklama Raporu doğru portlanmış hali, sidebar 3-alt-menü, Görünüm Anahtarı kısayolu) BİTTİ VE **Görünüm Anahtarı tarayıcıda doğrulandı** (`Ctrl+Alt+M`, gerçekten mod değiştiriyor). **Aşama-2'den HENÜZ YOK (öncelik sırasına göre):** Hakediş hesaplama (Finans, saat×hourlyRate — Rapor sayfasındaki eğitmen özeti üzerine kurulacak), aylık (bu-ay-özel) planlanan/yapılan stat kartları + course-progress donut (canlıdaki "detailed" mod büyük kartı — Yoklama Al/Detay'da, Rapor'da DEĞİL), auto-close cron, Core'da eğitmenin "kendi ders saatim" görünümü (tasarım kararı bekliyor). Öğrenci detay modalı düşük öncelik (kullanıcı zaten canlıda yapmıştı). **Yoklama Al/Detay/Rapor'un kendisi (asıl akış — grup seç/ders başlat/saat gir/kaydet/kapat, drill-down rapor) bu oturumda tarayıcıda UÇTAN UCA test edilmedi** — sadece Görünüm Anahtarı kısayolu doğrulandı. Sıradaki oturumda mutlaka gerçek bir yoklama alınıp denenmeli. Detaylı not: Claude memory `project_attendance_v2_rules.md`.

**✅ "Yoklama Detay" gerçek landing sayfasına kavuştu — canlıdan doğru portlandı (2026-07-02, aynı gün devam, Mac):** Kullanıcı fark etti: `/flexos/yoklama/detay` aslında `/flexos/yoklama/al`'ın (Yoklama Al) neredeyse birebir aynısıydı — çünkü ikisi de sadece `AttendanceCore`'u farklı `mode` prop'uyla render ediyordu. Ama canlıda "Yoklama Detay" tamamen AYRI ve çok daha zengin bir sayfa: `AttendanceDetailContent.tsx` (710 satır, `src/app/components/dashboard/attendance/`, host route `/dashboard/attendance-detail`) — stat kartları (Planlanan/Verilen/İptal/Toplam Ders saat), 24 aylık ay seçici, eğitmen/branş/grup filtreleri, grup kodu arama (tarih aralığıyla, eşleşen ≤5 grubun tüm geçmişi), grup listesi + Bu Ay İlerleme + Kurs İlerleme progress bar'ları; bir gruba "Detay" tıklanınca ancak o zaman tekil grup oturum listesi açılıyor. Bu katman FlexOS'a hiç taşınmamıştı.

**Port edildi:** `src/app/flexos/yoklama/_shared/AttendanceDetailList.tsx` (yeni) — aynı desen ("kodun aynı olması önemli değil, UI aynı olmalı", aynı Tailwind sınıfları) ama veri katmanı Firestore-direct `onSnapshot` yerine FlexOS REST API'leri: `GET /branches`, `/trainers` (sadece `attendance.report.read` sahipleri — Op/Finans/Admin), `/holidays`, `/educations` (totalHours map), `/groups` (zaten actor-scope'lu — eğitmen sadece kendi gruplarını görür, ekstra kod gerekmedi), ve her filtreli grup için TEK `GET /attendance?groupId=X` çağrısı (tüm-zamanlı kayıt, hem aylık hem all-time istatistik AYNI payload'dan türetiliyor — canlının 2-sorgulu deseninden daha verimli). **İptal istatistiği** (`lesson_exceptions` aggregate) SADECE `attendance.report.read` sahipleri için çalışır (o uç eğitmende yok, tenor gated) — eğitmen görünümünde "İptal" her zaman "—" kalır, geri kalan tüm istatistikler (Planlanan/Verilen/Toplam/İlerleme) eğitmen için de tam çalışır (kendi gruplarıyla sınırlı). Instructor filtresi de aynı capability'yle gate'lendi (`isOrgWide`).

**`/flexos/yoklama/detay/page.tsx` yeniden yazıldı:** artık `/flexos/yoklama/al`'daki AYNI framer-motion slide deseni — sol panelde `AttendanceDetailList` (landing), bir grupta "Detay"a tıklanınca sağdan `AttendanceCore mode="detail" preSelectedGroupId initialDate` slide-in (route değişimi değil, `onBackToAttend` ile geri dönülüyor — `AttendanceCore`'un zaten var olan generic "geri" callback'i, Al sayfasındakiyle aynı prop). Grup durumu (Aktif/Kapalı sekmesi) FlexOS domain status'una göre eşlendi (`status==="completed"|"archived"|"cancelled"` → kapalı).

`tsc`+ESLint temiz, `npm run build` başarılı (`/flexos/yoklama/detay` derlendi), mevcut 97 assertion regresyonsuz (bu iş saf UI+API-tüketimi, yeni assertion gerektirmedi — mevcut attendance/holiday/lesson-exception endpoint'leri olduğu gibi kullanıldı). **Test edilmeyen:** tarayıcıda uçtan uca doğrulanmadı (grup listesi/istatistikler/arama/detay slide-in) — sıradaki oturumda kontrol edilmeli.

**🔧 2 düzeltme daha (aynı gün devam, kullanıcı fark etti):**
1. **Sidebar+header eksikti:** İlk portta `/flexos/yoklama/detay` yanlışlıkla Yoklama Al'ın BAĞIMSIZ sayfa desenini (FlexSidebar yok, mini topbar) kopyalamıştı. Ama canlı kaynağı (`src/app/dashboard/attendance-detail/page.tsx`) tekrar kontrol edilince görüldü: Yoklama Detay standalone DEĞİL, normal `Sidebar`+`Header` içinde çalışıyor (sadece Yoklama Al standalone — "ders başlarken dikkat dağılmasın" amacıyla BİLEREK öyle). Sayfa Yoklama Raporu'nun (zaten doğru yapılmış) `FlexSidebar active="yoklama-detay"` + aynı header deseniyle (ikon kutusu+başlık solda, zil+kullanıcı sağda) yeniden yazıldı.
2. **Duplicate başlık:** `AttendanceDetailList` kendi içinde de "Yoklama Detay" h1'i çiziyordu — artık sayfa header'ında olduğu için içerideki tekrar kaldırıldı (Yoklama Raporu'nda daha önce yapılan aynı düzeltme). İçeride sadece filtre bağlamı (varsa eğitmen/branş adı) + ay seçici kaldı.

`tsc`+ESLint temiz, `npm run build` başarılı.

**✅ "Detail" mod tam donatıldı — canlıdaki 3-stat+donut bloğu portlandı (aynı gün devam):** Kullanıcı bir gruba "Detay" tıklayınca canlıda gördüğü katmanın (aylık Planlanan/Yapılan/Kalan 3 stat kartı + sağda kurs ilerleme donut'u + en son yapılan dersin salt-okunur açılıp "Düzenle" ile açılması) FlexOS'ta eksik olduğunu belirtti — bu, AŞAMA 1'de bilerek ertelenmiş bir kalemdi (`AttendanceCore.tsx` doc yorumunda not düşülmüştü), şimdi yapıldı. Derin inceleme (agent, `AttendancePanel.tsx` satır 1320-1538) doğruladı: canlıda `mode==="simple"` sadece lacivert özet bar gösterir, `mode==="detailed"` (varsayılan) ise bar YERİNE 3 stat kartı + donut gösterir — iki blok birbirini DIŞLAR, üst üste değil.

**Port edilen:** `AttendanceCore.tsx`'e `mode==="simple"` ⟺ mevcut lacivert bar (değişmedi), `mode==="detail"` ⟺ yeni blok: 3 stat kartı (Bu Ay Planlanan/Yapılan/Kalan Toplam Ders — `countWeekdaysInMonth` yeni yerel helper + `holidayDates` + `schedule.startDate/endDate`, `AttendanceDetailList.tsx`'teki aynı mantığın küçük bir kopyası) + kurs ilerleme donut'u (custom SVG `stroke-dasharray`/`stroke-dashoffset`, CSS transition'lı — framer-motion'a gerek kalmadı, `courseTotalHours`/`courseDoneHours`/`courseRemainingHours` zaten hesaplanıyordu, sadece görselleştirilmedi) + İptal ders sayısı (SADECE `attendance.report.read` sahipleri, `lesson-exceptions` aggregate'ten — eğitmende gizli, tıpkı `AttendanceDetailList`'teki gibi). Veri kaynağı: mevcut `allTimeDoneCount` state'i `allTimeRecords` (tam kayıt dizisi) olarak genişletildi, aylık/tüm-zamanlı sayılar AYNI payload'dan `useMemo` ile türetiliyor (ekstra network isteği yok, sadece İptal için ayrı bir org-scope-only çağrı var).

**Bilerek ertelenen (kullanıcı bunları sormadı, kapsam dışı bırakıldı):** `groupMode` (Aktif/Kapalı grup listesi filtresi — Yoklama Al'dan gelen slide-in ile Yoklama Detay listesinden gelen arasındaki canlıdaki tek gerçek fark buydu, donut'un kendisi değil) ve `filterMonth`/3-aylık geçmiş tam-kilit mantığı FlexOS'a henüz taşınmadı — agent raporu bunları da net olarak işaretledi, ihtiyaç olursa hızlıca eklenebilir.

`tsc`+ESLint temiz (1 küçük `exhaustive-deps` uyarısı da giderildi — `selectedWeekDays` artık `useMemo`'lu), `npm run build` başarılı, mevcut 20 (attendance) + 10 (lesson-exception) assertion regresyonsuz.

**🔧 Donut boyut/tasarım düzeltmesi (kullanıcı canlıdan ekran görüntüsü attı, aynı gün devam):** İlk versiyon çok küçüktü (64px) ve legend donut'un ALTINDA tek satır metin halindeydi — canlıda donut büyük (~110px), ortada BÜYÜK saat sayısı (iki satır: sayı + "saat"), legend SAĞINDA 2×2 renkli-nokta grid (Toplam/Yapılan/Kalan/İptal, her biri kendi rengiyle: mavi/yeşil/turuncu/kırmızı). 3 stat kartına da ikon kutuları eklendi (mavi/yeşil/turuncu, canlıdaki gibi) + alt metin "(X ders)" yerine canlıdaki gibi "X gün". %100 tamamlanan kurslarda halka rengi yeşile dönüyor (canlıdaki gibi). **Bir grupta donut hiç görünmüyor** gözlemi muhtemelen o grubun `Education.totalHours` alanının katalogda henüz boş olmasından (var olan tasarım: totalHours yoksa donut/Kalan alanı gösterilmez, "—" mantığı) — kod bug'ı değil, veri eksikliği olabilir; ilk açılışta kısa bir yüklenme gecikmesi de olası (fetch async).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı, sıradaki oturumda kontrol edilmeli.

**✅ Tahminle uğraşmayı bırakıp CANLI KAYNAK BİREBİR portlandı (kullanıcı: "canlıdaki sayfayı aynen copy paste edemiyor musun, kodları var zaten"):** Ekran görüntüsünden tahmin etmek yerine `AttendancePanel.tsx` satır 1320-1538'i (gerçek "detailed" mod bloğu) doğrudan okuyup class'ı class'ına, satırı satırına FlexOS'a taşıdım. Gerçek yapı tahminimden hayli farklıymış:
- **Grup bilgi kartı ayrı, üstte, tam genişlik** — yeşil nokta + kod + "X saat/ders" rozeti solda, ay rozeti sağda, altında "Başlangıç Tarihi: ... | Tahmini Bitiş: ..." — bunu hiç yapmamıştım (sadece küçük bir breadcrumb vardı).
- **Layout: sol sütun (grup kartı üstte + 3 stat kartı altta, `flex flex-col gap-3`) | sağ sütun (donut kartı, `items-stretch` ile SOL sütunla AYNI toplam yüksekliğe geriliyor — "dikey/yüksek" görünümün sebebi buydu, benim donut kartım ayrı/kısa bir satırdaydı).
- **Donut:** SVG boyutu 130×130 (viewBox 164×164, r=58, strokeWidth=24 — benim kullandığım 110px/tek renkti), **gradient** dolgu (`linearGradient`, %100 tamamlanınca koyu yeşil→açık yeşil, değilse lacivert→açık mavi — ben düz tek renk kullanmıştım), merkez metin mutlak konumlu (`top:68,left:65`) iki satır (büyük sayı + "saat"), legend donut kartının İÇİNDE ALTINDA (ben ayrı yandaydı).
- **3 stat kartı ikonları:** Timer (mavi), CheckCheck (yeşil), CalendarClock (turuncu) — `lucide-react`'e eklendi (Clock/CheckCircle2/CalendarCheck kullanmıştım, yanlış ikonlardı).
- **"İptal Edilen" legend'i HER ZAMAN görünür** (canlıda org-scope ayrımı yok) — benim `isOrgScope` şartını kaldırdım, artık her zaman gösteriliyor (değer eğitmende hâlâ sadece org-scope aggregate fetch edildiğinde doğru geliyor, bilinen küçük sınırlama).
- Geri (`Yoklama Al`) linki artık detail bloğunun İÇİNDE, sağa yaslı, üstte (`flex justify-end pb-3`) — ayrı bir üst satır değil.

`tsc`+ESLint temiz, `npm run build` başarılı, mevcut 20+10 assertion regresyonsuz. **Test edilmeyen:** tarayıcıda doğrulanmadı — sıradaki oturumda mutlaka kontrol edilmeli (bu iş 3 tur ekran-görüntüsü-karşılaştırmalı düzeltme gerektirdi, dördüncü turda gerçek kaynağı okumak çok daha hızlı ve doğru sonuç verdi — **ders: görsel port işlerinde tahmin yerine baştan gerçek kaynağı okumalı**).

**🐛 Gerçek race condition fix — "ilk açılışta donut yok, gruptan gruba geçince geliyor" (aynı gün devam):** Kullanıcı doğru tespit etti: `courseTotalHours`'ı çeken effect `[selectedGroupId]`'e bağlıydı ama içeride `selectedGroup?.educationId` (yani `groups` dizisinden `.find()`) okuyordu. `preSelectedGroupId` ile sayfa ilk açıldığında bu effect `groups` henüz yüklenmeden çalışıyor → `educationId` o an `undefined` geliyor → `courseTotalHours` `null` kalıyor (donut hiç render edilmiyor) → `groups` sonradan yüklense de effect'i tetikleyen dep değişmediği için bir daha ASLA düzelmiyordu. Başka gruba geçince `selectedGroupId` değiştiği için effect tekrar çalışıyor, o an `groups` zaten yüklenmiş oluyor → doğru geliyor; aynı gruba dönünce de `selectedGroupId` yine değiştiği için (id değişimi A→B→A hepsi tetikler) düzeliyordu — kullanıcının gözlemlediği tam olarak bu. **Fix:** effect dependency'sine `selectedGroup?.educationId` eklendi — `groups` yüklenip `educationId` `undefined`'dan gerçek değere dönünce effect otomatik tekrar tetikleniyor, gruba geçmeye gerek kalmadan ilk açılışta doğru sonuç geliyor.

`tsc`+ESLint temiz (uyarı da gitti), `npm run build` başarılı, 20 assertion regresyonsuz.

**🔧 Yanlış "geri" butonu — canlı kaynak (`Header.tsx` `onBack`) tekrar incelendi (aynı gün devam):** `/flexos/yoklama/detay/page.tsx` grup detayına HER ZAMAN `onBackToAttend` geçiyordu → `AttendanceCore` içinde "← Yoklama Al" linki gösteriyordu. Ama kullanıcı doğrudan Yoklama Detay listesinden bir gruba girince "Yoklama Al"a dönmek anlamsız (oradan hiç gelinmedi) — canlıda da (`dashboard/attendance-detail/page.tsx`) bu call site `onBackToAttend`/`onBack` geçmiyor, bunun yerine PAGE-LEVEL `Header`'ın kendi `onBack` prop'u (sol üstte ok butonu, ikon kutusunun solunda) listeye dönüyor. **Fix:** `AttendanceCore`'a artık `onBackToAttend` geçilmiyor (o linki hiç render etmiyor), bunun yerine `/flexos/yoklama/detay/page.tsx`'in kendi header'ına canlıdaki `Header.tsx` deseniyle birebir aynı bir geri oku eklendi (`ArrowLeft`, sadece `showDetail=true` iken görünür, ikon kutusunun solunda, başlığı sağa iter) — `setShowDetail(false)` ile listeye döner. **Yoklama Al sayfası DEĞİŞMEDİ** — orada `onBackToAttend` hâlâ doğru şekilde "← Yoklama Al" gösteriyor (oradan girilen detay için mantıklı).

`tsc`+ESLint temiz, `npm run build` başarılı. **Test edilmeyen:** tarayıcıda doğrulanmadı.

---

- [x] Mimari 4 dosyadan tek `FLEXOS.md`'ye birleştirildi (2026-06-15)
- [x] **Tip katmanı yazıldı** — `src/app/lib/domain/` (`core/`: Person, Enrollment, Group, PersonNote · `education/`: Grade · `eduos/` dikiş: Education, **Track**, Sale, Payment) · `tsc` temiz · canlıya dokunmadı
- [x] **Hiyerarşi netleşti** — Branş → Eğitim (Grafik-1) → **Track** (Temel Photoshop, satılabilir, eski "Modül") → Grup. `Module` tipi silindi, `Group.trackId` + `Enrollment.trackScope` eklendi
- [x] **Yetki omurgası yazıldı** — `src/app/lib/domain/access/` (capability registry ~22 + `Scope`/`Sensitivity`/`Actor` tipleri + 4 paket Satış/Op/Eğitmen/Admin + `can()`/`hasCapability()`/`widestScope()`). `person.pii.write` eklendi; eğitmen paketinde PII YOK. `tsc` temiz
- [x] **Person backend yazıldı** — `domain/repo/person-repo.ts` (port) + `domain/services/person-service.ts` (`createPerson`, gated: PII'ı `can()` ile sunucuda siler) + `server/person-repo.firestore.ts` (Firestore adapter, yeni `persons` koleksiyonu) + `domain/errors.ts`. 7 assertion doğrulama geçti (eğitmen PII silindi / satış korundu / yetkisiz reddedildi). `tsc` temiz
- [x] **API route + auth köprüsü yazıldı** — `POST /api/flexos/persons` (`withAuth` → `actorFromCaller`: eski rol→paket, tek kiracı "default") → `createPerson`; hata→HTTP (403/400/500). `server/auth-actor.ts`. Firestore rules: `persons`/`enrollments` server-only (`if false`, Admin SDK). Actor köprüsü doğrulandı (admin pii.write var / eğitmen yok). `tsc` temiz
- [x] **Enrollment service + çoklu-grup fix** — `domain/services/enrollment-service.ts` (`createEnrollment`, gated; aynı kişi FARKLI gruplara SERBEST = eski çoklu-grup bug'ı yapısal çözüldü, aynı grupta çift kayıt engelli) + `domain/repo/enrollment-repo.ts` (port, `findActive`) + `server/enrollment-repo.firestore.ts`. Eğitmen paketi **genişletildi** (group.create/edit/assign_student/activate — standalone Classroom için). 5 assertion geçti, `tsc` temiz
- [x] **Öğrenci-ekle TAM callable** — `POST /api/flexos/persons` + `POST /api/flexos/enrollments`. `groupIds` token claim'i Actor'a bağlandı (`with-auth.ts` Caller.groupIds) → assigned scope gerçek: eğitmen kendi grubuna kayıt yapar, başkasınınkine YAPAMAZ. Doğrulandı
- [x] **Grup backend** — `domain/services/group-service.ts` (`createGroup`, gated `group.create`, validation) + repo port + `server/group-repo.firestore.ts` (yeni `flexos_groups` koleksiyonu — canlı `groups` çakışmasın) + `POST /api/flexos/groups` + Firestore rules. 6 assertion geçti, `tsc` temiz
### ✅ Tamamlanan (write-side backend, hepsi gated + doğrulandı, ~26 assertion)
- **Öğrenci ekle:** `POST /api/flexos/persons` (PII gated) + `POST /api/flexos/enrollments` (çoklu-grup, scope) → BİTTİ (callable). Sadece UI eksik.
- **Grup ekle (temel):** `POST /api/flexos/groups` → grup oluşturma BİTTİ (callable). Sadece UI + katalog eksik.

### ⏳ SIRADAKİ İŞLER
- [x] **Katalog backend (Branş/Eğitim/Track)** — `domain/services/catalog-service.ts` (createBranch/Education/Track, gated) + `eduos/branch.ts` + `repo/catalog-repo.ts` + `server/catalog-repo.firestore.ts` (flexos_branches/educations/tracks) + 3 route (`/api/flexos/{branches,educations,tracks}`) + capability'ler (branch/education/track.create → operasyon+admin) + rules. `tsc` temiz
- [x] **Okuma/liste uçları** — `GET /api/flexos/{branches,educations?branchId,tracks?educationId,groups?trainerId}` (kiracı filtreli, repo `list`). `tsc` temiz
- [x] **Referans bütünlüğü** — servisler artık deps-bag alır: `createGroup(actor, input, {groups, educations?, tracks?})` verilen educationId/trackId katalogda var mı + track o eğitime mi bağlı (tutarlılık) doğrular; katalog repo verilmezse atlar (standalone). `createEnrollment(actor, input, {enrollments, persons, groups})` personId+groupId aynı kiracıda gerçekten var mı doğrular. Route'lar firestore repo'larını enjekte eder. 9 assertion geçti (jiti), `tsc` temiz
- [x] **Eğitim Yönetimi katalog SAYFASI (ilk UI)** — `src/app/flexos/egitim-yonetimi/page.tsx` (route `/flexos/egitim-yonetimi`). Claude Design tasarımı React'e portlandı (kaynak `_design/egitim-yonetimi`). Liste = **Eğitimler** (Track değil; Track eğitimin alt parçası, "Eğitim Ekle"de tanımlanacak). Branş filtresi + tablo gerçek GET'ten; fiyat (`listPrice`)/durum (`onSale`→Satışta/Taslak) bağlı. Font Inter, `authStateReady()` korumalı. Commit 023a38f, PUSH EDİLDİ.
  - **Placeholder (Education tipinde alan YOK → "Eğitim Ekle"de eklenecek):** Toplam Saat, Teslim Modu (online/in_person), Tip (bireysel/kurumsal). Page'de opsiyonel alan olarak okunuyor, dolunca otomatik görünür.
  - **Henüz bağlanmadı (şimdilik "yakında" toast):** Eğitim Ekle, satır düzenle/sil, toplu sil, sidebar menü linkleri.
  - **AÇIK SORU (ileride):** Track'ler bu listede ayrıca görünecek mi? (kullanıcı "sonra konuşuruz" dedi)
- [x] **"Eğitim Ekle" formu (UI + yerel etkileşim) bitti** — `src/app/flexos/egitim-yonetimi/ekle/page.tsx` (route `/flexos/egitim-yonetimi/ekle`). Tasarım `_design/egitim-ekle` (`Eğitim Ekle.dc.html`) React'e birebir portlandı, katalogla aynı desen (inline S/IC, Inter, authStateReady). **4 sekme tam çalışır (yerel state):** Genel Bilgiler · İçerikler (saat→bölüm&track ağacı / gün→gün planlayıcı) · Fiyat (havuz + KDV→net matrah) · Sertifikasyon (kurumsal statik / bireysel dinamik) + Satışa Başlat barı + sekme bazlı Kaydet. Katalogdaki "Eğitim Ekle" butonu buraya bağlandı. `tsc` temiz.
  - **Branş seçici eklendi (2026-06-17):** Genel sekmesinde Eğitim Adı'nın ÜSTÜNE "Branş" dropdown'ı kondu (`bransId` state). Şimdilik BOŞ (sadece "Branş seçin…" placeholder). KARAR: branş buradan eklenmez; merkezî listeden (`GET /api/flexos/branches`) çağrılıp seçilir. Backend bağlanınca dropdown gerçek branşlarla dolacak.
  - ~~HENÜZ BACKEND YOK~~ → **BAĞLANDI (2026-06-18).**
- [x] **HİYERARŞİ + WIRING + FAZ-1 DÜZENLE BİTTİ (2026-06-18)** — **Branş → Eğitim → Bölüm(Section) → Track** (4 seviye KESİN). Bölüm = YENİ entity `eduos/section.ts` (kendi grup/yoklama/sertifika + satılabilir); Track = granül, Bölüm grubu İÇİNDE işlenir; çapraz kullanım (AutoCAD→Photoshop) `enrollment.trackScope` ile (katalog ağacı tek-evli). Domain: `Education.audience(individual/corporate)`+`structure(single/sectioned)`+`outline`, `Track.sectionId`, `Group.sectionId`, `updateEducation`. Capability `section.create`+`education.edit`. Backend: `createSection`, POST/GET `/sections`, GET+PATCH `/educations/[id]`, referans bütünlüğü. UI: **Branş Havuzu** (`/egitim-yonetimi/branslar`) + **Eğitim Ayarları hub** (`/ayarlar`: Branş/Tatil/Sertifika/Sözleşme) + paylaşımlı **FlexSidebar** (akordiyon, framer-motion) + **FlexModal**. **Eğitim Ekle DB'ye yazıyor:** branş dropdown=GET; Kaydet=Taslak(POST onSale:false)+Track Bazlı'da sections/tracks POST; Satışa Başlat(onSale:true PATCH/POST)↔Satışı Kapat; modal onayı; yayın validasyonu (branş+ad+içerik+ana fiyat eksikse kilit, durum çubuğu eksikleri listeler). **İçerikler matrisi:** Bireysel+Standart=RichText düz-metin / Bireysel+Track=bölüm&track ağacı (üstte oto "Eğitim Adı · toplam saat") / Kurumsal=gün planlayıcı; Süre tipi Eğitim Tipi'nden türetilir (Bireysel=Saat, Kurumsal=Gün). **Faz-1 Düzenle:** katalog satır/✏️ tıkla→`/ekle?id=`→`prefillForm` (GET edu+sections+tracks, server→local id remap); scalar alanlar PATCH ile persist. NOT: görsel sonra Claude Design'da elden geçirilecek (sayfalar işlevsel/sade).
- [x] **Faz-2 Düzenle (içerik yapısı) BİTTİ (2026-06-19)** — Düzenleme modunda bölüm/track değişiklikleri artık DB'ye persist ediliyor. Strateji: **delete-all + recreate** (`syncEducationContent`). Repo: `SectionRepo.deleteByEducation` + `TrackRepo.deleteByEducation`. Firestore: batch delete. Servis: `syncEducationContent(actor, educationId, sections[], deps)` — mevcut bölüm/track'leri siler, yeni ağacı oluşturur (capability: `education.edit`). Route: `PUT /api/flexos/educations/[id]/content` (body `{ sections: [...] }` full tree). UI: edit modunda Kaydet → scalar PATCH + content PUT (Track Bazlı ise). 6 assertion geçti, `tsc` temiz.
- [x] **"Satış Yap" sayfası — UI + KATALOĞA BAĞLI (2026-06-19, iş "A" bitti)** — Sidebar'a **Satışlar** akordiyonu (`FlexSidebar`: `satis-yap`/`satis-liste` navkey) + alt linkler (Satış Yap → `/flexos/satislar/satis-yap`, Satış Listesi → yakında). Sayfa `src/app/flexos/satislar/satis-yap/page.tsx`, tasarım `_design/Satış Yap.dc.html` portu, Inter/authStateReady/FlexSidebar deseni. **2 sekme** (Genel Bilgiler · Eğitim; "Ödeme" kilitli). **Eğitim sekmesi GERÇEK KATALOĞA BAĞLI:** branş/eğitim `GET /api/flexos/{branches,educations?branchId}`, eğitim seçilince `GET /api/flexos/{sections,tracks}?educationId` → bölüm→track ağacı (sectionId grupla, order sırala). **Satış Modeli** = `education.structure`: `sectioned` → "Track Bazlı" açık (bölüm+track tek tek seçilir, **lacivert checkbox**, parent/child toggle, canlı saat sayacı); `single` → "Full Paket" kilitli. Statik COURSE_CATALOG/paket kavramı kaldırıldı (katalogda paket entity yok). **Genel sekmesi:** Ad/Soyad **ayrı** (`Person.firstName/lastName`); 18 altı → framer-motion açılır/kapanır **Veli Sözleşmesi** kartı (Veli Adı tek alan + TC). KARARLAR: [[18 yaş altı veli modeli]] (Person=öğrenci→listede, veli=Sale alanı) + [[fatura/billing modeli]] (Sale'de fatura tarafı bloğu). UI düzeltmeleri: footer padding 32px eşit, scroll jitter `scrollbar-gutter: stable`. `tsc` temiz. **BACKEND YAZMA YOK:** "Devam Et" sekme değiştirir; satış DB'ye düşmüyor.
- [x] **"Öğrenci Havuzu" sayfası — UI (2026-06-20, demo veriyle)** — Sidebar'a **Öğrenciler** akordiyonu (`FlexSidebar`: `ogrenci-havuzu`/`kayitli-ogrenciler`/`mezunlar` navkey; Satışlar↔Sınıflar arası) + alt linkler (Öğrenci Havuzu → `/flexos/ogrenciler/havuz`, Kayıtlı Öğrenciler + Mezunlar → yakında). Sayfa `src/app/flexos/ogrenciler/havuz/page.tsx`, tasarım `_design/Öğrenci Havuzu.dc.html` portu, Inter/authStateReady/FlexSidebar deseni. **Filtre paneli:** 7 durum checkbox (pending→Filtrele'de uygula deseni), Şube + Branş dropdown, Temizle. **Tablo:** Ad/Email/Telefon/Durum/Şube/Branş/Grup + İşlem; branş hover popup (+N rozeti); sayfalama; boş durum. **Grup kolonu = branş gibi (KULLANICI KARARI):** 0→*Atanmadı* · 1→grup ismi çipi · 2+→`N Grup`+sayı rozeti, hover'da grup isimleri (branşıyla) popup, detayda hepsi. **MİMARİ ONAY:** Havuz = enrollment listesi + filtre; satış yapılınca createSale→Person+Enrollment buraya düşer ([[öğrenci-havuzu-tasarımı]]). `tsc` temiz. **DEMO VERİYLE (24 öğrenci):** gerçek veri ayağı sıradaki etap. **MODEL BOŞLUKLARI (wiring'de):** (1) "Şube" (Kadıköy/Pendik…) domain'de YOK — Person/Tenant'a eklenecek/eşlenecek; (2) 7 zengin durum (beklemede/grupsuz/tekrar/donduruldu…) domain `PersonStatus`=3 (prospect/active/passive) — enrollment/ödeme durumundan türetilecek; (3) `GET /api/flexos/persons` (enrollment→grup→bölüm→eğitim→branş read-time join) HENÜZ YOK.
- [x] **`createSale` backend BİTTİ (2026-06-21)** — Sale tipi güncellendi: `Guardian` (veli ad+TC, 18 altı) + `BillingParty` (fatura tarafı) + `educationId` (tek) + `trackIds` (track bazlı seçim). `sale.create`+`sale.read` capability → registry + satis/operasyon/admin paketleri. `sale-repo.ts` port + `sale-repo.firestore.ts` adapter (`flexos_sales` koleksiyonu). **`sale-service.ts` orchestrator:** tek `createSale` çağrısıyla Person(active) + Sale + Enrollment(grupsuz, havuzda) oluşur; PII gating, yetki kontrolü, veli/fatura alanları. `POST /api/flexos/sales` route. Firestore rules eklendi. **20 assertion geçti** (satış/admin/op başarılı, eğitmen reddedildi, track bazlı, guardian, validasyonlar). `tsc` temiz.
- [x] **Satış Yap UI bağlandı + `GET /api/flexos/persons` BİTTİ (2026-06-21)** — "Satış Yap" formu `POST /api/flexos/sales`'e bağlandı (Kaydet butonu, validasyon, saving state, başarıda havuza yönlendir). `GET /api/flexos/persons` yazıldı: server-side read-time join (Person+Enrollment+Education+Branch+Group), PII gating (`person.read.pii`), enrollment'dan havuz durumu türetme (aktif/grupsuz/beklemede/donduruldu/mezun/pasif). PersonRepo+EnrollmentRepo'ya `list()` eklendi. `tsc` temiz.
  - **⚠️ DÜZELTME (2026-06-22):** Bu girişte "Öğrenci Havuzu gerçek API'ye bağlandı" deniyordu ama **commit'lenmemiş/uygulanmamış** — havuz sayfası commit geçmişinde HEP demo veriydi (`DEMO.map`→`DUMMY`). Gerçek bağlama 2026-06-22'de yapıldı (aşağıdaki girişe bak).
- [x] **Sınıflar — "Grup Ekle" sayfası BİTTİ (2026-06-21)** — `src/app/flexos/siniflar/page.tsx` (route `/flexos/siniflar`), Claude Design `Sınıf Ekle.dc.html` portlandı. Sidebar'a **Sınıflar** akordiyonu (Grup Ekle/Tüm Gruplar/Seans Takvimi). **Form:** Eğitim Formatı segmented (Grup/Özel Ders/Kurumsal — kurumsal uyarı notu + form gizle), 3-kolon grid (Şube/Branş/Eğitim/**koşullu Bölüm**/Grup Kodu/Başlangıç/Eğitmen), seans custom popup, ders saati/toplam saat/kontenjan. **Bölüm dropdown koşullu:** eğitim `sectioned` ise GET sections → Bölüm görünür; `single` ise gizli. **Branş/Eğitim/Bölüm gerçek katalog API'ye bağlı.** POST `/api/flexos/groups` ile kayıt. **Grup Listesi:** demo veri, Liste/Kart görünüm toggle, durum filtresi (Tümü/Açılacak/Aktif/Mezun), doluluk barı, sayfalama, düzenle/sil + silme onay modalı. **Uppercase kaldırıldı.** `tsc` temiz.
- [x] **GRUBA ATA + HAVUZ GERÇEK VERİ + SINIFLAR GERÇEK LİSTE + LIFECYCLE PERSIST BİTTİ (2026-06-22)** — Uçtan uca zincir **satış → havuz (grupsuz) → Gruba Ata → grupta görünür** tıklanarak çalışıyor.
  - **A · Gruba Ata backend:** `assignToGroup` servisi (`enrollment-service.ts`) — grupsuz aktif kaydı gruba yerleştirir, gated `group.assign_student`; zaten-gruplu/aktif-değil/çift-kayıt/grup-var-mı kontrolleri; `educationId` grup'tan denormalize. `EnrollmentRepo.getById` (port+firestore). `PATCH /api/flexos/enrollments/[id]` (body `{ groupId }`). `GET /persons` → grupsuz öğrencinin `assignableEnrollmentId`'si dışa veriliyor. Eğitmen şartı YOK (grupta eğitmen opsiyonel/dummy). **12 assertion geçti.**
  - **C8 · Gruba Ata UI + havuz gerçek veri:** `ogrenciler/havuz/page.tsx` artık `GET /api/flexos/persons`'tan yükleniyor (DUMMY kaldırıldı). "Gruba Ata" butonu (eskiden `soon` toast'ı) → grup seçme modal'ı (`GET /groups`+`/educations`, kod+eğitim adıyla) → `PATCH` → başarıda liste yenilenir (grupsuz→aktif). Demo 24 öğrenci gitti; veri görmek için satış yapılmış olmalı.
  - **B5 · Sınıflar listesi gerçek veri:** `GET /api/flexos/groups` zenginleştirildi (eğitim adı + branş join + **doluluk**=aktif enrollment sayısı; ham alanlar korundu). `siniflar/page.tsx` demo 16 grup kaldırıldı, listeyi `GET /groups`'tan çekiyor; durum eşlemesi (planned/enrolling→Açılacak, active→Aktif, completed→Mezun, archived/cancelled→İptal), ISO→TR tarih, grup id `number`→`string`, grup oluşturunca liste auto-refresh.
  - **Lifecycle persist:** `updateGroupStatus` servisi + `PATCH /api/flexos/groups/[id]` (gated `group.edit`). Sınıflar'daki Başlat/Bitir/İptal/Geri Al artık DB'ye yazıyor (**10 assertion**). `tsc`+ESLint temiz.
  - ~~**MODEL BOŞLUKLARI:** Seans saati saklanmıyor / Grup Sil client-only~~ → **İKİSİ DE ÇÖZÜLDÜ (2026-06-22 PC):** seans saati `GroupSchedule.startTime/endTime` olarak persist + listede gösteriliyor; Grup Sil backend hazır.
- [x] **ŞUBE Aşama-1 (göster+kaydet, scope-hazır) BİTTİ (2026-06-22)** — Şube = fiziksel ofis (≠ branş). Paylaşımlı sabit liste **stabil id'lerle** `src/app/lib/branch-offices.ts` (kadikoy/pendik/umraniye/besiktas/sirinevler + `officeName()`). Sınıflar formu → `Group.branchOfficeId`'ye yazıyor; `GET /groups` `branchOfficeId`+`branchOffice` döndürüyor → Sınıflar listesinde şube görünür. `GET /persons` → `subeler[]` öğrencinin **gruplarından türetilir**; havuz şube filtresi çalışır (grupsuz öğrencide şube boş — satışa şube eklenmedi, istenirse +10dk). **YETKİ FİLTRESİ YOK** (Aşama-2): `can()` branch scope + `Actor.branchIds` zaten hazır (`access/can.ts:40-43`), enforcement "Kullanıcılar" ekranıyla gelecek ([[project-sube-scope]]). İsim ayrımı: şube=`branchOffice`/`officeId`, branş=`branch`. `tsc`+ESLint temiz.
- [x] **Grup Sil backend BİTTİ (2026-06-22, PC)** — `group.delete` capability (operasyon/egitmen/admin) + `deleteGroup` servisi (**aktif kayıtlı grup silinmez** güvenliği; iptal/transfer engel değil) + `DELETE /api/flexos/groups/[id]` + `GroupRepo.delete` + `EnrollmentRepo.listByGroup` (roster için de kullanılacak). Sınıflar `confirmDelete` API'ye bağlandı (UI butonu zaten yalnız boş+açılacak grupta görünüyor). **7 assertion**, `tsc`+ESLint temiz.
- [x] **Seans saati persist BİTTİ (2026-06-22 PC)** — `GroupSchedule.startTime/endTime` eklendi; `createGroup` persist ediyor (form zaten gönderiyordu), `GET /groups` döndürüyor, Sınıflar listesi seans saatini gösteriyor (yoksa ders saatine düşer). `tsc`+ESLint temiz.
- [x] **Roster (sınıf listesi, salt görüntüleme) BİTTİ (2026-06-22 PC)** — `GET /api/flexos/groups/[id]/roster` (enrollment listByGroup→person join, PII gated, sadece aktif kayıt) + Sınıflar'da sağ açılır panel (gruba tıkla / kart "Öğrenciler" → öğrenci listesi: ad, e-posta/tel, atanma tarihi; boş/yükleniyor durumları). **Aktar/çıkar YOK** (grup değişimi=yeni satış kararı bekliyor — [[project-group-change-sale]]). `tsc`+ESLint temiz.
- [x] **EĞİTMEN BACKEND + UI WIRING BİTTİ (2026-06-23)** — Eğitmen kadrosu sıfırdan, Group/Person dikey kesitiyle aynı desende. **Domain:** `core/trainer.ts` (Trainer: name/email/phone/branchOffices/status/competencies/**hourlyRate**/availability/notes; ücret = **saatlik/ders saati başına**, aylık tutar ileride yoklama×hourlyRate ile finansta) + `repo/trainer-repo.ts` port + `services/trainer-service.ts` (`createTrainer`/`updateTrainer`/`deleteTrainer`, gated). **Ücret = PII deseni:** `hourlyRate` yalnız `trainer.rate.write` varsa yazılır (yoksa düşürülür, `rateDropped`), `trainer.rate.read` yoksa GET'te `null` maskeli. **Capability'ler:** trainer.create/read/edit/delete/rate.read/rate.write → operasyon+admin tümü; **egitmen yalnız `trainer.read`** (ücret YOK). **Server:** `trainer-repo.firestore.ts` (yeni `flexos_trainers` koleksiyonu) + Firestore rules server-only. **Route'lar:** `POST`/`GET /api/flexos/trainers` (GET = grup join: Group.trainerId==trainer.id → kod/eğitim adı/doluluk + ücret maskeleme) · `PATCH`/`DELETE /api/flexos/trainers/[id]`. **19 assertion geçti** (yetki, ücret gating create+update, validasyon, kiracı izolasyonu, silme). **UI bağlandı:** `egitmenler/page.tsx` demo veri (`buildDemoTrainers`) KALDIRILDI → `GET /api/flexos/trainers`; Ekle/Düzenle formu POST/PATCH, silme DELETE, hepsi başarıda `loadTrainers()` refetch + saving/loading durumları. Trainer.id UI sıralı index (palet), `docId` = Firestore id (API). `tsc`+ESLint temiz. ~~AÇIK: Not ekle/sabitle client-only~~ → **2026-06-29'da persist edildi** (`UpdateTrainerInput.notes` + PATCH bağlandı; `addNote`/`togglePin` artık Firestore'a yazıyor). ~~Eğitmen silme grup engeli yok~~ → **2026-06-29'da eklendi** (`deleteTrainer` GroupRepo deps alıyor; planned/enrolling/active/postponed grubu olan eğitmen silinemez). **KALAN AÇIK:** müsaitlik düzenleme UI yok (entity destekliyor).
- [x] **SATIŞ "ÖDEME" SEKMESİ — FAZ-1 (UI) BİTTİ (2026-06-24)** — `satislar/satis-yap/page.tsx` artık **3 sekme** (Genel · Eğitim · **Ödeme**; eski kilit kaldırıldı). Tasarım `_design`/handoff `Satış Yap.dc.html` Ödeme sekmesi React'e portlandı. **Finansal özet:** Brüt (gerçek katalog `listPrice`'ından türetilir — track bazlıda seçili track toplamı, sectioned full'da education.listPrice ?? Σ section.listPrice, single'da education.listPrice) → Kampanya indirimi (statik %20/%15/%10 map) → Yönetici/satışçı ek indirimi (**%/TL toggle**, segSm) → **NET**. **Ödeme girişi:** çok satırlı (Nakit/Kredi Kartı/Havale-EFT/Senet + Alınan Tutar + Taksit Sayısı; taksit yalnız KK/Senet'te açık), satır ekle/sil, canlı **Toplam/Ödenen/Kalan** şeridi (kalan=0 → yeşil). **"Tekrar Öğrencisi / Sınıf Değişimi" → 0 TL kilit** (brüt 0, indirim+ödeme inputları disabled). Footer 3 adımlı (Geri ödeme→eğitim, "Satışı Tamamla"). **Kaydet:** `onSave` body'sine **`soldPrice: net`** eklendi → `POST /api/flexos/sales` (createSale `soldPrice` zaten destekliyordu). `tsc`+ESLint temiz. **FAZ-2 (EKSİK):** Payment persist YOK — `payment.ts` hâlâ sadece TİP; ödeme/taksit satırları DB'ye yazılmıyor (PaymentRepo + `flexos_payments` + createSale wiring gerekecek). Kampanya hâlâ statik (katalogda kampanya/bundle entity yok).
- [x] **KAPSAM NETLEŞTİ — yol haritası revize (2026-06-24, kullanıcı kararı; aşağıdaki eski SIRADAKİ önceliklerini EZER):**
  1. **Öğrenci yüzeyi TEK = Öğrenci Havuzu** — ayrı "Kayıtlı Öğrenciler"/"Mezunlar" sayfaları İPTAL; havuz statü filtreleriyle (aktif/grupsuz/beklemede/mezun/**iptal**) tek yüzey + güçlü search; iptal/mezun öğrenci de havuzda görünür, iletişim korunur → remarketing/kampanya. ([[project-student-pool]])
  2. **Faturalandırma YOK** (Logo/muhasebe değiliz) — finans yardımı yalnız: **tahsilat takibi + "ödemesi gelecek/geçen öğrenci" hatırlatması** + **eğitmen aylık hakediş = yoklama × hourlyRate**. `Sale.billing` dormant; vergi/fatura makinesi yok → eski 2026-06-19 fatura kararı GERİ ALINDI. ([[project-invoicing-billing]])
  - **2b. STATÜ MODELİ (2026-06-24, ⚠️ açık madde ÇÖZÜLDÜ):** Öğrenci durumu ≠ ödeme durumu — **iki AYRI eksen.** Öğrenci: Aktif/Beklemede/Pasif/Mezun/İptal. Ödeme (TÜRETİLİR, saklanmaz): Planlandı/Yaklaşıyor/Gecikti/Kısmi Ödendi/Tamamlandı. **Satışta öğrenci direkt Aktif** (`createSale` zaten doğru; tasarım footer "Beklemede" yazısı YANLIŞ→Aktif). Tarih geçince sistem sadece "Gecikti" UYARIR, otomatik beklemeye ALMAZ; Beklemede = operasyon MANUEL (yoklamada görünmeye devam eder). "2 ay erteleme" = sadece `dueDate` düzenle. Durum muhtemelen Enrollment'ta (Person rollup) — ONAY BEKLİYOR. Tam model → [[project-status-model]].
  3. **Kullanıcı/rol/yetki sıfırdan** = şart, onaylandı (yetki motoru hazır; eksik = flexos_users + UI + kullanıcı→Actor). ([[project-sube-scope]])
  4. **Satış Listesi = yüksek öncelik** — ay/2ay/yıl toplam satış raporu (`soldPrice` agregasyon) + **satış iptali buradan**: iptal **SOFT** (`Sale.status` active|cancelled +cancelledAt/by/reason, silme DEĞİL = audit+remarketing); cascade → gruba atanmışsa enrollment non-active (roster sadece aktif gösterdiği için sınıftan otomatik düşer), havuzdaysa "iptal" statü; Person/Enrollment SİLİNMEZ, havuzda "İptal" filtresinde görünür. ([[project-sales-list-cancel]])
  5. **Eğitmen v2 = SEÇİCİ yeniden yazım** — canlıdan alınabilenler AYNEN; **🔒 ASLA BOZMA: Google Drive yükleme + OAuth token (yeniden token YOK), ödev sistemi, Brave**; Not/Sınıflar Ligi/Sertifika not-ver canlıdan copy; **🔨 asıl inşa = Yoklama** (hakediş entegrasyon noktası). ([[project-trainer-rebuild]])
  - **REVİZE ÖNCELİK SIRASI:** (1) Ödeme FAZ-2 (ödeme planı + tahsilat + türetilen ödeme durumu + Gecikti uyarısı + hatırlatma) → (2) Satış Listesi + iptal(cascade) + rapor → (3) Kullanıcı/rol/yetki → (4) Eğitmen v2.
- [x] **STATÜ MODELİ UYGULANDI — Enrollment.status hizalandı (2026-06-24):** `EnrollmentStatus` = `active`/`on_hold`/`passive`/`completed`/`cancelled` (Türkçe etiket: Aktif/Beklemede/Pasif/Mezun/İptal; `frozen`+`transferred` kaldırıldı). `GET /persons` `derivePoolStatus` artık **enrollment-merkezli** (Person.status'tan değil; rollup aktif[grupsuz öne]>beklemede>mezun>pasif>iptal). **"Satışı Tamamla" → öğrenci Aktif** (createSale zaten `active` yazıyor, ek kod gerekmedi). `tsc`+ESLint temiz, COMMIT BEKLİYOR. **`on_hold`=Beklemede:** yalnız op MANUEL alır; **gruptan çıkarılmaz** (`groupId` korunur), **yoklamada görünür** (aktif sayılmaz). **⚠️ FAZ-2 takip:** roster/yoklama şu an `active`-only filtreliyor → `on_hold`'u DAHİL etmeli (Eğitmen v2'de). Tam model [[project-status-model]].
- [x] **ÖDEME FAZ-2 BACKEND BİTTİ + DOĞRULANDI (2026-06-24, 30 assertion):** Tahsilat/taksit Firestore'a iniyor. **Domain:** `eduos/payment.ts` genişletildi (Payment: method[cash/card/transfer/senet]/amount/installmentNo/installmentTotal/dueDate/paidAt; durum SAKLANMAZ) + `Sale.financingFee` (senet vade farkı = ayrı gelir). **Servis `payment-service.ts`:** `buildPayments` (peşin satırları→paidAt dolu; senet→**kalana** [net−peşin] FLAT vade farkı: `vade farkı=kalan×aylık%×N`, eşit taksit, aylık dueDate, son taksit yuvarlama yutar) + `derivePaymentStatus`/`derivePaymentRollup` (Planlandı/Yaklaşıyor[≤7gün]/Gecikti/Kısmi/Tamamlandı — okuma anında, `totalExpected=soldPrice+financingFee`'ye karşı) + `addMonths` (ay-sonu kıstırma). **Repo:** `payment-repo.ts` port + `payment-repo.firestore.ts` (`flexos_payments`, batch saveMany, eşitlik-only sorgu=index'siz). **Capability:** `payment.create/read` → satış/op/admin (eğitmen YOK — para görmez). **createSale wiring:** `input.payment` (peşin+senet) → Payment dokümanları üretip yazar, `financingFee`'yi Sale'e koyar, gated `payment.create`; route `firestorePaymentRepo` enjekte (`POST /sales` → paymentCount+financingFee döndürür). Firestore rules `flexos_payments` server-only. `tsc`+ESLint temiz, COMMIT BEKLİYOR. **EKSİK (FAZ-2b = UI):** (1) Satış formu henüz `payment` göndermiyor (peşin satırları=odemeSatirlari map + **senet vade farkı % inputu eklenecek**); (2) tahsilat okuma ucu (`GET /sales/[id]/payments` veya persons'a ödeme durumu) + havuz/satış-listesinde ödeme durumu rozeti. Model [[project-invoicing-billing]] (senet formülü) + [[project-status-model]].
- [x] **ÖĞRENCİ HAVUZU DETAY DRAWER — sekmeli + PII düzenleme + read-only ödeme + eğitim seçici BİTTİ (2026-06-25):** Drawer grup-ekleme **bottom-sheet** desenine geçti (`fx-sheet`/`fx-sheet-ov`, framer-motion slide-up, **50vh**, sidebar açıkta). **2 sekme:** **Bilgiler** (düzenlenebilir: ad/soyad/**telefon[formatlı]**/e-posta/**TC/doğum tarihi/adres**/cinsiyet + **veli** [varsa; Sale alanı]) · **Ödeme & Satış** (**SALT GÖRÜNTÜLEME**: Toplam/Ödenen/Kalan + rollup rozeti + ödeme planı taksit tablosu). **"Satın aldığı eğitimler" SELECTOR** (tek eğitim→**disabled**, 2+→**aktif**; her eğitim=enrollment; seçilen eğitime göre ödeme süzülür → [[project-student-card-hub]]). **Backend:** `GET /api/flexos/persons/[id]` (detay: tam PII + satışlar + ödeme planı, alan-bazlı kapılı) + `PATCH /api/flexos/sales/[id]` (veli, gated `person.pii.write`). **🐛 BUG FIX:** PATCH /persons/[id] `person.write` istiyordu (registry'de YOK → herkese 403, düzenleme hiç çalışmıyordu) → **`person.edit`**. **Test verisi:** `scripts/seed-flexos-test-student.mjs` ("Zeynep Test", 2 eğitim + 6 ödeme satırı [peşin+senet, gecikti/yaklaşıyor/planlı] + veli; `--clean` siler). **Ayrıca:** Eğitim Ekle "Satışa Başlat" butonu → **Grup Ekle turuncusu** (`#FF8D28→#D66500`); glow/shimmer animasyonları + ölü kod kaldırıldı. tsc+ESLint temiz (ekle'de 2 pre-existing lint hariç).
- **DURUM DÜZELTME (2026-06-25):** **Ödeme FAZ-2 esasen BİTTİ** — satış formu `payment` (peşin+senet) gönderiyor (`satis-yap` satır 343-369 → `flexos_payments` persist); eski "satış formu payment göndermiyor" notu **GEÇERSİZ**. Havuz listesinde ödeme rozeti YAPILMAYACAK (karar 2026-06-29); ödeme yalnız Finans modülünde.
- [x] **SATIŞ İPTALİ — soft + cascade BİTTİ (2026-06-26):** `sale.cancel` capability (red, audited) → registry + satis/operasyon/admin paketleri (eğitmen YOK). **Domain:** `Sale.cancelledAt/cancelledBy/cancelReason` alanları. **Servis:** `cancelSale(actor, {saleId, reason?}, deps)` — Sale→cancelled + bağlı TÜM enrollment'ları→cancelled cascade; zaten iptal olan enrollment atlanır; Person/Enrollment SİLİNMEZ (audit/remarketing). `EnrollmentRepo.listBySale` eklendi (port+firestore). **Route:** `POST /api/flexos/sales/[id]/cancel` (body `{reason?}`). **UI:** Satış Listesi'ne "İşlem" kolonu + "İptal Et" butonu (yalnız aktif satışlarda) + **iptal onay modalı** (uyarı notu + opsiyonel sebep textarea + "Satışı İptal Et" / "Vazgeç"). Başarıda liste yenilenir, toast. **12 assertion geçti** (admin/satis/op başarılı, eğitmen reddedildi, zaten-iptal/varolmayan ValidationError, çoklu-enrollment cascade [2/3 iptal — 1 zaten iptal atlandı], sebepsiz iptal OK). `tsc` temiz.
- [x] **KULLANICILAR CRUD BİTTİ (2026-06-27):** `flexos_users` koleksiyonu + tam CRUD backend (POST/GET/PATCH/DELETE `/api/flexos/users`) + domain (FlexosUser tipi, 6 rol, repo, servis) + UI (liste [personel/öğrenci sekmeleri] + ekle + düzenle + sil + durum toggle) + `role.manage` capability (admin-only) + sidebar linki. **Commit:** 08bedb7 + 51164e9.
- [x] **AKTİVİTE MERKEZİ BACKEND BİTTİ (2026-06-29)** — CRM/Talep altyapısı sıfırdan. **Domain (crm/):** `case.ts` (Talep: channel/type/status/activityCount/outcome) + `activity.ts` (Aktivite: tip/note/nextAction/appointmentId) + `appointment.ts` (Randevu: ayrı koleksiyon, takvim modülü migration'sız bağlanacak). **Repo portları:** `case-repo.ts` (listOpenByPerson dedup için) + `activity-repo.ts` (listByCase) + `appointment-repo.ts`. **Capability:** `case.create/read/edit`, `activity.create/read`, `appointment.create/read` → registry + satis/admin tümü, operasyon okur. **Servis `case-service.ts`:** `createCase` (dedup: açık talep varsa hata — aynı kişi aktif listede ~1 kez, kapalı talep→yeni talep açılabilir), `addActivity` (talep güncelle/activityCount++/lastActivityAt; randevu→status=randevu_olusturuldu; closeCase→outcome), `updateCase`. **Firestore:** `flexos_cases`+`flexos_activities`+`flexos_appointments` koleksiyonları; 3 adapter. **Route'lar:** `GET/POST /api/flexos/cases` (POST: personId veya personData[TC dedup→prospect Person otomatik] kabul eder; GET: personName join) + `GET/PATCH /api/flexos/cases/[id]` (tekil+aktivite timeline) + `POST /api/flexos/activities` (aktivite ekle+randevu+kapat). `tsc` temiz. **UI BEKLENIYOR** (Claude Design çıktısı gelince port edilecek).
- [x] ~~SIRADAKİ (aşağıdaki madde 2026-06-29 tarihliydi, o tarihten sonra Yoklama v2, Ödev Verme, Grade backend, Sertifikasyon, 3 oyunlaştırılmış ödev BİTTİ — bu madde ARTIK ESKİ, referans için bırakıldı, GÜNCEL AÇIK İŞLER için dosyanın EN ÜSTÜNDEKİ (en yeni tarihli) girdilere bak, buraya değil)~~ — Yetki katmanı geçişi (flexos_users rolleri → Actor mapping) · Şube Aşama-2 · Finans modülü · Kurumsal Firmalar · Katalogda ayrı liste · Canlı trainer rebuild — bunların HİÇBİRİ o tarihten beri ele alınmadı, hâlâ teknik olarak açık ama **öncelik sırası değil** (aşağıya bkz).

### ⏳ GÜNCEL AÇIK İŞLER (2026-07-08 GÜNCELLENDİ — Ödev Verme + Not turu bitti, bu blok tek doğru "sıradaki" kaynağıdır)
- [x] ~~"Ödev Dosyası Yükle"~~ → **BİTTİ (2026-07-08)** — hem Ödev Oluştur (Classroom deneyimi, kaydedince yükler) hem Ödevi Düzenle'de sürükle-bırak gerçek çalışıyor, bkz yukarı "Ödev Verme + Not" girdisi.
- [x] ~~Ghost kart "Ödev Ver"/Aktif kart "Detay"~~ → **BİTTİ (2026-07-08)** — gerçek sayfalara yönlendiriyor (Ödev Teslimi/Ödev Notu), "Ödevi Düzenle" de paylaşımlı modalla gerçek.
- [x] ~~Kullanıcı Ayarları (rol tanımları + yetki toggle)~~ → **BİTTİ (2026-07-08, ayrı oturum)** — bkz yukarı "Kullanıcı Ayarları (Rol Tanımları)" girdisi.
- [x] ~~flexos_users hesap bağlama (authUid)~~ → **BİTTİ (2026-07-08, 3. oturum)** — gerçek Firebase Auth hesabı + aktivasyon akışı, bkz yukarı "Gerçek hesap/aktivasyon akışı" girdisi.
- [x] ~~Gerçek yetki bağlama (RoleDef.permModules → `can()`)~~ → **BİTTİ (2026-07-08, 3. oturum)** — `actorFromCaller` async, 116 çağrı noktası geçirildi, bkz yukarı girdi. **TARAYICI TESTİ HENÜZ YAPILMADI** (kullanıcı toplu test edecek, canlıya almadan önce).
- [ ] **Bilinen sınır:** Çoklu rol (egitmen + ofis rolü aynı kişide) — ikisi TEK actor'da birleşmiyor, eğitmen tarafı hep eski canlı-claim yolundan geliyor. Nadir senaryo, ertelendi.
- [ ] `.env.local`'de `NEXT_PUBLIC_APP_URL` eksikti (yerelde aktivasyon/reset mail linkleri yanlış domaine gider) — kullanıcıya söylendi, eklendiği TEYİT EDİLMEDİ.
- [x] ~~Satış Yap: hibrit eğitim "Teslim Şekli" (Yüz Yüze/Online)~~ → **BİTTİ (2026-07-08)** — Full Paket'te `deliveryOptions`'a göre ayrı fiyat seçilebiliyor artık, Track Bazlı hariç (kapsam dışı).
- [ ] **PLANLANAN — Sistem Ayarları (SADECE TARTIŞMA, kod YOK):** Sidebar'a Çıkış'ın üstüne **Ayarlar** akordiyonu — Sistem Logları+Sistem Modu (admin), **Sistem Ayarları**=SADECE süper admin (admin verme paneli, e-posta ile Firebase hesabı arayıp claim veriyor; süper admin>admin hiyerarşisi, admin süper admini göremez/admin veremez), **Backup Kontrol** (hem online/Firestore-içi hem gerçek local JSON export — ikisi de), **Log sistemi** (satış/mail/sms logları, canlı `dashboard/logs` deseni referans). Hiçbiri öncelik değil. Süper admin e-postası (`alparslan.sennturk@gmail.com` mı `flexos.platform@gmail.com` mı) TEYİT EDİLMEDİ.
- [ ] **Tarayıcı testi eksik** — 3 oyunlaştırılmış ödev (Kolaj Bahçesi/Kitap Dünyası/Reklam Tasarımı) + bugünkü Ödev/Not turu (Revize İste/Onayla, dosya yükleme, Ödev Notu otomatik puanlama) kod tarafı bitti ama hiçbiri bu ortamda uçtan uca tarayıcıda denenmedi — kullanıcı kendi test edecek ("test ederken çıkan hataları çöze çöze ilerleriz").
- [ ] **"Sertifika Bastır" akışı** — tam vizyon konuşuldu (2026-07-08, PDF+fiziksel baskı+mail/SMS bildirimi) ama KULLANICI KARARIYLA "acelesi yok", HİÇ kod yazılmadı. Bu, Not'taki kişi-bazlı kilidin de asıl tetikleyicisi olacak (`Grade.locked`, mimarisi hazır ama şu an hiçbir şey tetiklemiyor). Bkz proje hafızası `project_certificate_issuance_vision`.
- [ ] Tam-ekran dosya önizleme (canlıdaki `/preview` sayfası) — portlanmadı, dosyalar Drive linkiyle açılıyor (muhtemelen yeterli).
- [ ] Öğrenci "Ayarlar" (ses bildirimi) sayfası — hiç portlanmadı.
- [ ] **Eski, hâlâ açık ama düşük öncelikli:** ~~Yetki katmanı geçişi~~ ARTIK BİTTİ (yukarı bkz) · Şube Aşama-2 (yetki filtresi) · Finans modülü (tahsilat/hakediş) · Kurumsal Firmalar · Katalogda bireysel/kurumsal ayrı liste · Backfill (`students`→`persons`, tek yönlü — gerçek eğitmen FlexOS'a girebiliyor ama backfill olmadığı için canlı verisini görmüyor). Kalan ~33 sayfaya `FlexPageContent` yayılması (tek tek, kör toplu değişiklik YOK — kullanıcı kararı).
- [ ] **PLANLANAN — Öğrenci Profili tam-sayfa hub (karar 2026-06-25):** Öğrenci kartı ileride `/flexos/ogrenciler/[id]` TAM SAYFA olacak; havuzdaki 50vh drawer hızlı bakış/temel düzenleme için kalır ("Tüm profili aç →" linki). **Model: her eğitim = bir Enrollment kaydı** (1 Person → N Enrollment, her biri kendi grup/yoklama/not/sertifika/**o satışın ödemesi** + kendi status'ü; öğrenci Grafik'te Mezun, Web'de Aktif olabilir — [[project-status-model]] ile uyumlu). **UI kuralı:** üst sekmeler **Bilgiler (kimlik, GLOBAL — seçiciden bağımsız)** + **Eğitimler**; Eğitimler sekmesinde "satın aldığı eğitimler" **seçici** = enrollment listesi → **tek eğitimde DISABLED, 2+ eğitimde AKTİF** (seçilen eğitime geçilir, alt sekmeler [Genel/Yoklama/Notlar/Ödeme/Sertifika] o enrollment bağlamıyla dolar). Kimlik (ad/TC/tel/adres/veli) global; sadece eğitim-bağlamlı veri seçince değişir. Bonus: bugünkü "Ödeme & Satış" sekmesi (şu an tüm satışları topluyor) bu modelde eğitim-bazlı olur. **Asıl değer yoklama/not domaini gelince** çıkar → o etapta kurulacak ([[project-trainer-rebuild]], [[project-student-pool]]).
- [ ] **(eski, artık BİTTİ 2026-06-18)** Eğitim Ekle eksikleri + backend'e bağla:
  1. **"Bölüm" kavramı kararı** — form hiyerarşisi Eğitim→**Bölüm**→Track ama domain Branş→Eğitim→Track (Bölüm YOK). Üç ihtimal: (a) Bölüm = sadece UI gruplama, DB'ye yazılmaz Track'ler düz Education altına (en hızlı, domain değişmez); (b) Bölüm = Eğitim, üst "Eğitim Adı" = şemsiye/paket; (c) Bölüm = yeni 4. seviye entity (en çok iş). Kullanıcı henüz seçmedi — wiring'den önce karar şart.
  2. **Branş dropdown'ını gerçek veriye bağla** (`GET /api/flexos/branches`).
  3. **Education tipini büyüt** — audience (bireysel/kurumsal — ayrı havuz için şart), deliveryMode, durationType (saat/gün), gunSayisi, contractType, description, salesModel.
  4. **Gün-bazlı içerik** (günler+konular) domain karşılığı yok → nereye yazılacak kararı.
  5. Form→DTO map + `POST /api/flexos/educations` + Track (çift seviye fiyat, commit 1ef8e56). Sonra katalog listesi otomatik dolar. NİHAİ HEDEF: gerçek eğitimleri girmeye başlamak.
- [ ] **Katalog işlevsellik bekleyenler (kullanıcı kararları 2026-06-17):**
  - **Kurumsal ≠ Bireysel ayrı gelir havuzu** → kataloğta kurumsal/bireysel eğitimleri **ayrı liste veya ayrı filtre** ile göster (AYRI SAYFA DEĞİL — aynı "Eğitim Ekle" ekranından eklenir, sadece listeleme/filtre ayrışır). Sebep: gelirler ileride ayrı havuzda toplanacak.
  - **Sözleşme yönetimi (ileride)** → "Sözleşme Tipi" şu an statik option listesi; ileride kendi sözleşme metinlerimizi ekleyeceğimiz bir alan/modül olacak. Şu an elde gerçek sözleşme yok, ertelendi.
- [x] ~~Öğrenci ekle + Grup ekle UI~~ → BİTTİ (Satış Yap + Sınıflar/Grup Ekle sayfaları üzerinden, bkz yukarı)
- [x] ~~Havuz görünümü (enrollment listesi + grupsuz/gruplu filtre) + "gruba yerleştir"~~ → BİTTİ (Öğrenci Havuzu + Gruba Ata, 2026-06-22)
- [ ] Backfill (`students`→`persons`, `groups`→`flexos_groups`, tek yönlü) — hâlâ açık, bkz GÜNCEL AÇIK İŞLER

---

## İçindekiler

1. [Vizyon, Felsefe ve Modül Haritası](#1-vizyon-felsefe-ve-modül-haritası)
2. [Veri Modeli ve Mimari Katmanlar](#2-veri-modeli-ve-mimari-katmanlar)
3. [Capability & Yetki Modeli](#3-capability--yetki-modeli)
4. [MVP Çekirdek Akış (Blueprint)](#4-mvp-çekirdek-akış-blueprint)
5. [Süreç Sorumlulukları, Öğrenci Kartı ve Güvenlik](#5-süreç-sorumlulukları-öğrenci-kartı-ve-güvenlik)
6. [Yol Haritası ve İnşa Sırası](#6-yol-haritası-ve-inşa-sırası)

---

# 1. Vizyon, Felsefe ve Modül Haritası

## Temel Felsefe

Flex, bir eğitim kurumunun tüm işlemlerini yapacağı bir **işletim sistemidir**.

**Öğrenci merkezli sistem.** Öğrenci gruba, eğitime veya satışa bağlı düşünülmez.
Öğrenci sistemin ana varlığıdır. Satışlar, ürünler, eğitimler, gruplar ve sertifikalar öğrenci etrafında şekillenir.

```
Kişi (Öğrenci)
↓
Satış
↓
Ürün / Paket
↓
Eğitim Kayıtları (Enrollment)
↓
Gruplar
↓
Eğitim Süreci (Yoklama / Not / Sertifika)
```

### Kök Felsefe — Person ≠ Enrollment

**Person (insan) ≠ Enrollment (gruptaki katılım).** Sınıfa özel her şey (devam, not, ödev, sertifika) Enrollment'ta tutulur. Aynı insan birden çok gruba (eş zamanlı dahil) katılabilir → **1 Person + N Enrollment**. Mevcut sistemde `students` aslında bir üyelik kaydı; bu yüzden "aynı insan için çok doküman", "aynı mail", "eş zamanlı grup" sorunları çıkıyor. Çözüm: kişiyi üyelikten ayır.

**"Eğitime göre öğrenci, kuruma göre müşteri"** — bu bir tip değil, bakış açısı. Aynı kişi satış için müşteri, eğitmen için öğrenci.

## Platform Vizyonu (Monorepo)

**Flex**, tasarım eğitim ekosistemi için çok uygulamalı bir platform. Şu an tek Next.js repo içinde yaşıyor; ileride Turborepo monorepo'ya bölünebilir.

```
flex-platform/
  packages/shared/     → ortak tipler, Firebase config, bildirim tipleri
  apps/
    trainer/   ← ŞU AN BURADAYIZ — eğitmen + admin + öğrenci aynı repoda
    portal/    → yeni öğrenci portalı (ileride)
    ops/       → Eğitim Operasyon (ileride)
    crm/       → Satış (ileride)
    connect/   → Teams benzeri iletişim (ileride)
```

**Flex-Trainer tamamlanma kriteri:** Yoklama modülü ✅ + Sertifikasyon akışı (devam ediyor).

> **Deployment notu:** Bugün tek root, tek Next.js uygulaması; modüller route bazlı ayrılır.
> Separate repo veya Turborepo bugün **gerekmez** — auth, veri ve UI ortak, ekip küçük, overhead gereksiz.
> Monorepo'ya bölme ancak uygulamalar gerçekten ayrıştığında yapılır.

## Mevcut Durum (Geçici)

Eğitim Operasyonu ve Satış modülleri henüz geliştirilmediği için grup yönetimi **geçici olarak** eğitmen tarafında yapılmaktadır.

Eğitmen şu an: grup oluşturuyor · öğrenci ekliyor · yoklama alıyor · proje notu giriyor.

Bu yapı geçicidir. Uzun vadede **eğitmen grup yönetemez**; bu sorumluluk Eğitim Operasyonu'na geçecektir.

## Modül Haritası

```
flex/
├── trainer/       ← Eğitmen Paneli (mevcut, neredeyse tamamlandı)
├── operation/     ← Eğitim Operasyonu (sıradaki büyük modül)
├── sales/         ← Satış
├── finance/       ← Muhasebe
└── shared/        ← Ortak sistemler (öğrenci, bildirim, sertifika, arama)
```

| Modül | Alt süreçler |
|-------|--------------|
| **Trainer** (Eğitmen) | dashboard · attendance · projects · students* · certificates · grading |
| **Operation** (Eğitim Op) | groups · planning · schedules · trainers · certificates |
| **Sales** (Satış) | leads · sales · products · enrollments |
| **Finance** (Muhasebe) | payments · contracts · collections |
| **Shared** (Ortak) | students · notifications · quick-search · certificates |

\* `trainer/students` geçicidir, ileride `operation`'a geçer.

## Önemli Prensip — Veri Tekrarı Yok

Yanlış: `trainer/students` + `operation/students` + `sales/students` (aynı veri üç yerde).
Doğru: **`shared/students`** — tek kaynak, tüm modüller buraya erişir.

Rol klasörleri **ekran ve süreç** ayrımı içindir. Veri yapıları ve ortak sistemler **shared** altındadır.

```
Trainer / Operation / Sales / Finance   = süreç
Students / Quick Search / Notifications / Certificates   = ortak veri & servis
```

---

# 2. Veri Modeli ve Mimari Katmanlar

> **Durum:** Tasarım/tartışma kilitlendi (2026-06-09). Kod yazılmadı.

## 2.1 Ayrılabilirlik Kısıtı (en kritik mimari kural)

Eğitmen tarafı ileride **"Flex Classroom"** olarak ayrı ticari ürün çıkabilmeli. Bu yüzden iki katman:

| Katman | İçerik | Bağımlılık |
|--------|--------|------------|
| **Core (Classroom)** | Person, Enrollment, Group, Module + eğitim verisi (yoklama/not/ödev/sertifika sonucu) | Kendi kendine yeter, üst katmanı **bilmez** |
| **FlexOS (üst katman)** | Education (ürün), Sale, Payment, Account (firma), Quota, Branş, Şube, gelir raporu | Core'u besler, Core'a bağımlı |

**Demir kural:** Bağımlılık tek yönlü → `FlexOS → Core`. Core, FlexOS'tan import etmez.
Üst katmandan gelen tüm alanlar Core'da **opsiyonel/nullable** (`Enrollment.saleId?`, `Person.accountId?`).
Klasör: `lib/domain/core` ve `lib/domain/eduos`.

**İki kapı:** Enrollment iki yoldan doğabilir:
1. **Eğitmen quick-add (Core):** satış YOK, grup+öğrenci manuel. Standalone Classroom böyle çalışır.
2. **Satış (FlexOS):** Sale → Person + Enrollment.

## 2.2 Hiyerarşi

```
ŞUBE (lokasyon: Kadıköy/Şirinevler/Pendik — satış ekibi buraya bağlı)
BRANŞ (disiplin/genel ad: Grafik Tasarım, Yazılım)
   └─ EĞİTİM (branşa ait eğitim: Grafik-1, Grafik-2, Python)
        └─ TRACK (eğitimin AYRI SATILABİLİR parçası: Temel Photoshop, Temel Illustrator — fiyat/satış burada; eski "Modül"ün yeri)
             └─ GRUP / SINIF (eğitmen, takvim, kontenjan, type)
                  ├─ Attendance (Yoklama)
                  ├─ Grades (Not / XP)
                  └─ Certificate (Sertifika sonucu)
```

- **Şube ≠ Branş.** Şube = fiziksel lokasyon + satış ekibi. Branş = disiplin. Gelir raporu ikisini de ister → Sale her ikisini taşır (şube doğrudan, branş eğitim üzerinden).
- **Eğitim = branşa ait eğitim (Grafik-1, Grafik-2); Track = eğitimin satılan parçası (Temel Photoshop).** (2026-06-15 netleşti.) Track, eski "Modül"ün yerini alır — artık ayrı satılabilir. Fiyat/satış **Track** seviyesinde. Paket = birden çok Track'in (veya tüm eğitimin) tek total fiyatla satılması.
- **Grup = somut sınıf.** Branş + Eğitim + Track seçilerek tanımlanır (eğitmen, takvim, kontenjan, type).
- **Track'ler "Eğitim Ekle" modülünün İçerik sekmesinde tanımlanır** (add-to-list: track adı+içerik gir → Ekle → listeye eklenir). **Çift seviye fiyat:** tüm eğitim fiyatı (`Education.listPrice`) AYRI + her track fiyatı (`Track.listPrice`) AYRI. Track tek başına satılabilir; `Track.sellable` toggle ile "track satışını kapat". Satış liste fiyatını görür, kampanya (% indirim) liste üzerinden uygulanır → `Sale.soldPrice`.

### Ortak Track (cross-education)
Bir Track farklı eğitimlerin öğrencilerine **ortak sınıfta** verilebilir. Örnek: AutoCAD/sosyal medya öğrencisi "Temel Photoshop" track'ini mevcut Grafik-1 grubunun ilgili haftalarına katılarak alır (ayrı sınıf açılmaz). Track bitince mezun edilir, yoklaması kilitlenir.

## 2.3 Varlıklar ve Alanlar

> Katman etiketi: **(Core)** = Classroom çekirdeği, **(FlexOS)** = üst katman.

### Person (Core) — merkez, kalıcı
`id, kimlik{tip: tc|pasaport|yabancı, no}, ad, soyad, telefon, email, cinsiyet, adres`
- **Kimlik = benzersiz anahtar.** Herkesin bir belgesi var (TC yoksa pasaport/yabancı kimlik).
- Sert benzersiz kısıt yerine: ekleme sırasında email/tel/kimlik ile **yumuşak eşleştirme** → "bu kişi zaten var olabilir, mevcut olanı mı kullanıyorsun?" insan onayı. Mail = yardımcı sinyal, sert kilit değil.
- **Grup/eğitim verisi YOK** (o Enrollment'ta).
- Sistemden **silinmez.** Öğrenci kurumun en değerli verisidir: birden fazla eğitim alabilir, birden fazla paket satın alabilir, farklı yıllarda geri dönebilir; geçmiş eğitimleri/grupları/sertifikaları korunur. (KVKK silme talebi → anonimleştir, eğitim geçmişi kalır.)

### Enrollment (Core) — kişinin bir GRUPTAKİ katılımı (kritik köprü)
Sistemin kritik köprü varlığı: Sale ile Group arasındaki bağ.

`id, personId, educationId, groupId?, trackScope?, başlangıçTarihi, bitişTarihi?, durum, saleId?`

```
Enrollment {
  personId
  saleId?           ← Core'da opsiyonel (standalone Classroom'da boş; FlexOS'ta zorunlu)
  educationId       ← paketteki hangi eğitim
  groupId?          ← hangi gruba yerleşti (boş = grupsuz havuzda bekliyor)
  trackScope?       ← boş = grubun eğitiminin tüm track'leri; dolu = sadece o Track(ler)
  durum             ← aktif | dondurulmuş | mezun | tamamlandı | transfer | tekrar | bıraktı
  transferHistory[] ← grup değişiklik geçmişi

  // ── Donmuş sonuç (sınıf bitince yazılır, kalıcı) ──
  result {
    finalNot          ← eğitmenin notundan hesaplanan nihai not
    projeNot
    odevPuani
    groupCode         ← hangi sınıfta alındı (denormalize)
    module            ← hangi modül/eğitim
    branch
    donem             ← hangi dönem/yıl
  }
  certificate {
    durum             ← bekliyor | hak_kazandı | kalamadı | verildi
    tip               ← Katılım | Başarı | MEB
    kod               ← belge no (verilince)
    verilisTarihi
  }
}
```

- **Yoklama / not / ödev** grup seviyesinde tutulur (mevcut sistem: `design_attendance` grup bazlı, `gradedTasks` classId bazlı — **DEĞİŞMİYOR**).
- **Not + Sertifika sonucu Enrollment'ta DONAR.** Eğitmenin girdiği not, sınıf bitince (modül finalize / mezuniyet) nihai nota hesaplanır ve **o anda enrollment'a snapshot'lanır** — sonradan ödev/ağırlık değişse veya grup silinse bile **değişmez**. Sertifika dondurulmuş bir gerçektir, her açılışta yeniden hesaplanmaz.
- **Her eğitim ayrı saklanır.** Bir Person birden çok Enrollment taşır; her birinin notu, sertifikası ve sınıf bilgisi ayrı ayrı durur. Aynı kişinin Grafik-1 notu ile Grafik-2 notu bağımsızdır.
- **Sertifika verilmesi kurumun işidir, eğitmenin değil.** Eğitmen yalnızca notu besler (`certificate.durum = hak_kazandı`). Basım/dağıtım Eğitim Operasyonu'nda ayrı adımdır (bkz. §5 Sertifika Akışı).

> Bugünkü sistem notu canlı hesaplayıp `projectGrades`'e yazıyor; donmuş per-enrollment sonuç + sertifika alanları **sıfırdan inşada** eklenecek. 1. etapta sertifika üretilmez ama şema baştan bu alanları taşır.

### Group / Sınıf (Core)
`id, educationId, instructorId, takvim, kontenjan, type, şubeId, durum`
- `type`: standart | özel_ders | kurumsal (teslim formatı).
- `instructorId`: gruba atanan eğitmen. Öğrenci gruba girince bu eğitmenin altına düşer.
- **Gruplar geçicidir.** İsimler değiştirilmez, yeni grup oluşturulur; öğrenciler eski gruptan seçilerek yeni gruba aktarılır → geçmiş yoklama/not/sertifika korunur.

**Grup yaşam döngüsü:**
```
Planlandı → Kayıt Alıyor → Aktif → Ertelendi → Tamamlandı → Sertifika Sürecinde → Arşiv
```

### Module (Core)
`id, educationId, ad, sıra, saat`

### Education / Eğitim (FlexOS) — satılan ürün
`id, ad, branşId, listeFiyatı, kdv, satışaAçık, modules[], sertifikaTanımı`
- `listeFiyatı`: ürün fiyatı (+KDV otomatik). Değişince satış ekranı görür.
- `sertifikaTanımı`: hangi sertifika (Katılım/Başarı/MEB) + koşullar (min devam %, min not, MEB belge bilgisi). **Şu an yanlış yerde** (`users/{instructorId}.certSettings`) → buraya taşınacak.
- Paket = bundle-tipi Education (içinde N education referansı, tek total fiyat).
- Ödeme **ürün seviyesinde** tutulur, devam **eğitim seviyesinde** tutulur. Tek eğitim satışı da, paket satışı da desteklenir.

### Sale / İşlem (FlexOS) — enrollment hareket defteri
`id, tip, customerType, personId, accountId?, educationId(ler), satışFiyatı, salespersonId, şubeId, tarih`
- `tip`: yeni_satış | transfer | tekrar | yerleştirme.
- **Her öğrenci hareketi bir Sale ile başlar — tutar 0 TL olsa bile** (Bilge Adam deseni: güvenlik/denetim, tek giriş kapısı, headcount-gelir tutarlılığı). Transfer/tekrar = çoğu 0 TL.
- `satışFiyatı`: kampanya/indirim sonrası **fiilen satılan** tutar. Gelir raporu bundan çıkar (≠ liste fiyatı).
- `customerType`: bireysel | kurumsal. Özel ders = bireyselin içinde bir tip (Grup.type).
- Paket satışı → 1 Sale → N Enrollment.

### Account / Müşteri (FlexOS) — kurumsal
`id, firmaAdı, yetkili, telefon, ...` → 1 firma N Person.
- Bireyselde ödeyen = kişinin kendisi (ayrı Account yok).
- **Kurumsal en baştan ayrı:** ayrı panel, ayrı firma/yetkili verisi, ayrı gelir (rapor istenirse birleştirilir).

### Payment (FlexOS)
Taksit/tahsilat. `tutar, taksit, durum`. (1. etap dışı, alan hazır.)

### Quota (FlexOS)
**Gelir bazlı** (örn "ay 200k"). Satışçı bazlı + genel.

## 2.4 Akışlar

### Bireysel satış → grup → eğitmen (1. ETAP HEDEFİ)
```
1. SATIŞ      Satışçı eğitim seçer + kişi (yeni/mevcut)
              → Person + Sale + Enrollment(groupId boş, durum=havuzda)
2. GRUBA EKLE Eğitim op havuzdaki enrollment'ı uygun gruba atar
              → groupId set, durum=aktif
3. EĞİTMEN    Grup zaten bir eğitmene ait (Group.instructorId)
              → öğrenci o eğitmenin altına düşer
```

### Ortak Track / dış öğrenci (Ahmet AutoCAD → Temel Photoshop)
Eğitim op uygun (yeni başlayan) Grafik-1 grubu bulur → Ahmet'i yerleştirir (ek satış veya 0 TL transfer) → Track bitince mezun eder → yoklama kilitlenir, enrollment kapanır. `trackScope = "Temel Photoshop"`.

### Transfer / tekrar
Eski enrollment'ı kapatan + yeni enrollment açan 0 TL'lik Sale (tip=transfer/tekrar). Eski veri (yoklama/not/sertifika) silinmez — eski grubun anahtarıyla ayrı kayıtlarda durur.

## 2.5 Non-Functional Kriterler ("1 sene sonra da çalışsın")

1. **Veri şişmesi:** Person dokümanı küçük; yoklama/not/ödev Enrollment'ın alt-koleksiyonlarında ayrı dokümanlar. Doküman-içi sınırsız array/map YOK (mevcut `gradedTasks` map'i bu hatanın örneği). "Tek alanda gör" = okuma-zamanı birleştirme, tek dev doküman değil.
2. **Firestore ölçek/maliyet:** Bu ölçekte (yüzler–binler öğrenci, yıllar) yeterli. Sınır boyut değil okuma-sayısı. Full-collection `onSnapshot` YOK → `where`+`limit`+sayfalama. Raporlamada aggregation sorgusu veya aylık rollup dokümanı (şube+branş+ay → toplam). İndeks: şube, branş, tarih.
3. **Security:** Veriyi concern'e göre ayrı koleksiyonlara böl (satış/ödeme/eğitim). Rules modelle BİRLİKTE tasarlanır. Person/Enrollment ayrımı güvenliği kolaylaştırır (öğrenci kendi enrollment'ı, eğitmen kendi grubunun enrollment'ları, finans ödeme).

---

# 3. Capability & Yetki Modeli

> Departman-agnostik domain ve atomik yetki (capability) referansı.
> Yetki sisteminin, modüler mimarinin ve AI entegrasyonunun temelidir.
> Yeni bir modül/ekran/eylem eklerken önce buraya bakılır, capability buradan türetilir.

## 3.1 Tasarım İlkeleri

**1. Capability = bir domain üzerinde atomik eylem.** Departmana değil, işe bağlı.
Kodda asla `if (role === "satış")` yok; her zaman `can("student.create")`.

**2. İsimlendirme:** `domain.action` veya `domain.subdomain.action` — küçük harf, nokta ayraç, fiil sonda. Örn: `attendance.write`, `certificate.issue`, `person.note.read`.

**3. Scope ayrı bir eksen — capability'yi şişirmez.** Her yetki *grant*'i bir kapsam taşır:

| Scope | Anlamı | Tipik |
|-------|--------|-------|
| `self` | Sadece kendi kaydı | Öğrenci portalı |
| `assigned` | Atanmış grup/öğrenci | Eğitmen |
| `branch` | Şube geneli | Şube müdürü |
| `org` | Tüm kurum | Admin / Operasyon |

`attendance.write @assigned` (eğitmen) ile `attendance.write @org` (operasyon) **aynı capability, farklı scope**.

**4. Rol/Departman = capability+scope paketinin isimlendirilmiş hali.** Veride sabit değil, düzenlenebilir. "Eğitmen", "Satış", "Kıdemli Eğitmen" hepsi birer paket. Departman→yetki eşleşmesi kuruma göre değişir; bu yüzden sabitlenmez.

**5. Hassasiyet seviyesi** her capability'nin metadata'sı — audit, ekstra onay ve AI gating'i belirler:
- 🟢 **Normal**
- 🟡 **Hassas** — PII/scope kritik, audit'lenir
- 🔴 **Kritik** — geri alınamaz / maliyetli / hukuki → zorunlu audit + insan onayı

**6. Capability Registry şeması** (kayıt başına):

```ts
{
  key: string;            // "assignment.cancel"
  domain: string;         // "assignment"
  label: string;          // "Ödevi İptal Et"  (TR — AI grounding)
  description: string;    // ne yaptığı (TR)
  sensitivity: "green" | "yellow" | "red";
  write: boolean;         // okuma mı yazma mı (audit + AI güvenliği)
  scopable: boolean;      // scope ekseni uygulanır mı
  audited: boolean;       // audit log'a düşer mi
}
```

Bu tek şema 4 şeyi birden besler: **yetki UI'ı · middleware · audit log · AI tool yüzeyi.**

## 3.2 Domain Haritası

| # | Domain | Rol |
|---|--------|-----|
| 1 | `person` (Öğrenci/Kişi) | Merkezi varlık |
| 2 | `enrollment` (Eğitim Kaydı) | Köprü |
| 3 | `group` (Grup) | Süreç kabı |
| 4 | `attendance` (Yoklama) | Eğitim süreci |
| 5 | `grade` (Not) | Eğitim süreci |
| 6 | `assignment` (Ödev/Çekiliş) | Eğitim süreci |
| 7 | `certificate` (Sertifika) | Çıktı |
| 8 | `task` (Görev — operasyonel) | İş akışı |
| 9 | `notification` (Bildirim) | Kanal |
| 10 | `sms` / `email` (İletişim) | Kanal |
| 11 | `system` (user/role/audit/import) | Çapraz |

> **Kapsam dışı (sonraki tur):** `sale`, `payment`, `contract` — Satış/Finans domain'leri. Eğitim Operasyonu'na geçmeden ele alınmayacak.

## 3.3 Capability Tabloları

### 1. `person` — Öğrenci / Kişi
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `person.create` | Yeni kişi kaydı aç | 🟡 | – |
| `person.read` | Temel bilgi (ad, durum, grup) | 🟢 | ✓ |
| `person.read.pii` | TC, telefon, e-posta, adres | 🟡 | ✓ |
| `person.edit` | Temel bilgileri düzenle | 🟡 | ✓ |
| `person.deactivate` | Pasife al (mezun/ayrıldı) | 🟢 | ✓ |
| `person.anonymize` | KVKK silme → anonimleştir | 🔴 | – |
| `person.merge` | Çift kayıtları birleştir (legacy dedup) | 🔴 | – |
| `person.note.read` | Eğitmen notlarını gör (blur açma) | 🟡 | ✓ |
| `person.note.write` | Eğitmen notu ekle/düzenle | 🟢 | ✓ |
| `person.history.read` | Grup/enrollment geçmişi | 🟢 | ✓ |
| `person.consent.manage` | KVKK rıza durumu | 🔴 | – |
| `person.export` | Liste/kişi verisi dışa aktar | 🟡 | ✓ |
| `person.search` | Ctrl+K global arama | 🟢 | ✓ |

### 2. `enrollment` — Eğitim Kaydı (köprü)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `enrollment.create` | Kişiyi bir eğitime kaydet | 🟡 | – |
| `enrollment.read` | Kayıt + donmuş sonucu gör | 🟢 | ✓ |
| `enrollment.edit` | Kayıt alanlarını düzenle | 🟡 | ✓ |
| `enrollment.transfer` | Grup değiştir (geçmiş korunur) | 🟡 | ✓ |
| `enrollment.freeze` | Dondur | 🟢 | ✓ |
| `enrollment.resume` | Dondurulmuşu aktif et | 🟢 | ✓ |
| `enrollment.complete` | Mezuniyet → **sonucu DONDUR** | 🔴 | ✓ |
| `enrollment.cancel` | Kaydı iptal et | 🟡 | ✓ |

### 3. `group` — Grup
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `group.create` | Grup oluştur | 🟢 | ✓ |
| `group.read` | Grup detayı | 🟢 | ✓ |
| `group.edit` | İsim/branş/seans düzenle | 🟢 | ✓ |
| `group.archive` | Arşive al | 🟡 | ✓ |
| `group.delete` | Kalıcı sil | 🔴 | ✓ |
| `group.assign_student` | Öğrenci yerleştir | 🟡 | ✓ |
| `group.remove_student` | Öğrenci çıkar | 🟡 | ✓ |
| `group.assign_trainer` | Eğitmen ata | 🟡 | ✓ |
| `group.activate` | Planlandı → Aktif (yoklama açılır) | 🟡 | ✓ |
| `group.postpone` | Ertele | 🟢 | ✓ |
| `group.complete` | Tamamlandı'ya al | 🟡 | ✓ |
| `group.schedule.edit` | Takvim/tatil yönetimi | 🟢 | ✓ |
| `group.league.toggle` | Lig sistemini aç/kapat | 🟢 | ✓ |

### 4. `attendance` — Yoklama
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `attendance.read` | Yoklama kayıtlarını gör | 🟢 | ✓ |
| `attendance.start` | Dersi başlat | 🟢 | ✓ |
| `attendance.write` | Yoklama al/işaretle | 🟢 | ✓ |
| `attendance.close` | Dersi bitir/kapat | 🟢 | ✓ |
| `attendance.edit_past` | Geçmiş yoklama düzelt (zaman-kilidi aşımı) | 🟡 | ✓ |
| `attendance.report.read` | Yoklama raporları | 🟢 | ✓ |
| `attendance.export` | Rapor dışa aktar | 🟡 | ✓ |

### 5. `grade` — Not
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `grade.read` | Notları gör | 🟢 | ✓ |
| `grade.write` | Proje notu / XP gir | 🟢 | ✓ |
| `grade.settings.edit` | Ağırlıklar, certSettings | 🟡 | ✓ |
| `grade.finalize` | Modülü bitir → **not donar** | 🔴 | ✓ |
| `grade.report.read` | Not raporları | 🟢 | ✓ |

### 6. `assignment` — Ödev (Çekiliş + Teslim)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `assignment.create` | Ödev tanımla/ata | 🟢 | ✓ |
| `assignment.read` | Ödev/arşiv gör | 🟢 | ✓ |
| `assignment.edit` | Ödev düzenle | 🟢 | ✓ |
| `assignment.draw` | Çekiliş yap | 🟢 | ✓ |
| `assignment.cancel` | Ödevi iptal et (cascade) | 🟡 | ✓ |
| `assignment.archive.delete` | Arşiv kaydını kalıcı sil | 🔴 | ✓ |
| `assignment.pool.manage` | Havuz (marka/kitap/kategori) tanımları | 🟡 | – |
| `assignment.submission.read` | Öğrenci teslimlerini gör | 🟢 | ✓ |
| `assignment.submission.grade` | Teslimi puanla | 🟢 | ✓ |

### 7. `certificate` — Sertifika
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `certificate.eligibility.read` | Hak ediş hesabını gör | 🟢 | ✓ |
| `certificate.read` | Sertifika durumu/kaydı | 🟢 | ✓ |
| `certificate.issue` | **Bastır → durum=verildi** (kurum yetkisi) | 🔴 | – |
| `certificate.revoke` | Sertifikayı iptal et | 🔴 | – |
| `certificate.template.manage` | Şablon/MEB bilgileri | 🟡 | – |
| `certificate.export` | PDF üret | 🟡 | ✓ |

> Mimari kuralı: **eğitmende `certificate.*` yazma yok**, sadece `grade.*`.
> Hak ediş `grade.finalize` ile beslenir, basım `certificate.issue` ile kurumda.

### 8. `task` — Görev (operasyonel iş akışı)
> Öğrenci ödevinden (`assignment`) farklı: personele atanan iç işler — "şu öğrenciyi ara", talep/şikayet, grup açma talebi.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `task.create` | Görev oluştur | 🟢 | ✓ |
| `task.read` | Görevleri gör | 🟢 | ✓ |
| `task.assign` | Birine/departmana ata | 🟢 | ✓ |
| `task.update` | Durum/içerik güncelle | 🟢 | ✓ |
| `task.complete` | Tamamla | 🟢 | ✓ |
| `task.delete` | Sil | 🟡 | ✓ |
| `task.comment` | Yorum ekle | 🟢 | ✓ |

### 9. `notification` — Bildirim (uygulama içi)
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `notification.read` | Kendi bildirimlerini gör | 🟢 | `self` |
| `notification.send` | Tekil/grup bildirimi gönder | 🟢 | ✓ |
| `notification.broadcast` | Toplu bildirim | 🟡 | – |
| `notification.template.manage` | Şablon yönetimi | 🟡 | – |

### 10. `sms` / `email` — İletişim Kanalları
> Kanal = maliyet/hukuk taşır. Toplu gönderim ayrı ve kritik.

| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `sms.send` | Tekil SMS | 🟡 | ✓ |
| `sms.bulk_send` | Toplu SMS (maliyet) | 🔴 | – |
| `email.send` | Tekil e-posta (ödev maili vb.) | 🟢 | ✓ |
| `email.bulk_send` | Toplu e-posta | 🟡 | – |
| `messaging.template.manage` | SMS/e-posta şablonları | 🟡 | – |
| `messaging.log.read` | Gönderim logları | 🟡 | ✓ |

### 11. `system` — Çapraz / Yönetim
| Capability | Ne yapar | Hassas | Scope |
|---|---|---|---|
| `user.create` | Personel hesabı aç | 🟡 | ✓ |
| `user.edit` | Personel düzenle | 🟡 | ✓ |
| `user.deactivate` | Personeli pasife al | 🟡 | ✓ |
| `role.manage` | **Capability paketlerini düzenle** (meta yetki) | 🔴 | – |
| `capability.grant` | Kişiye tekil yetki ver/al | 🔴 | – |
| `audit.read` | Audit log oku | 🟡 | ✓ |
| `settings.platform.manage` | Platform ayarları | 🔴 | – |
| `import.run` | Legacy/veri içe aktarım | 🔴 | – |

### Kabaca Sayılar
~75 atomik capability · 11 domain · 4 scope · 3 hassasiyet seviyesi. Bundan **sınırsız rol** türetilir:
- Eğitmen ≈ 12 capability `@assigned`
- Operasyon ≈ 40 capability `@org`
- Satış ≈ `enrollment` + `person` + (sonra `sale`) paketi
- Admin ≈ tümü `@org`

## 3.4 AI-Ready Foundations

> Hedef: ileride AI-destekli, **kimsede olmayan** bir yapı. Farkı yaratan AI modeli değil,
> **her eylemin AI tarafından adreslenebilir olması.** Bunu bugün ucuza kurulan bir omurga sağlar.
> AI bugün yazılmaz; sadece kemikleri AI-hazır yapılır.

### Omurga: Action (Komut) Katmanı
Her mutasyon tek bir isimli, doğrulanan, capability-korumalı sunucu fonksiyonundan geçer:

```
İnsan UI ─┐
          ├─► executeAction("assignment.cancel", { taskId }, actor)
AI ajanı ─┘        → can(actor, capability, scope)?
                   → validate(args)
                   → write
                   → emitEvent(actor, capability, entity, before/after)
```

İnsan da AI de **aynı kapıdan** geçer: aynı yetki kontrolü, aynı doğrulama, aynı audit.
AI eklendiğinde yeni iş mantığı yazılmaz — ajan var olan action'ları çağırır.
**Yan fayda:** dağınık client yazımının yol açtığı veri-kaybı bug sınıfı (bkz. `FLEX_CORE_LOG` §187–188 çekiliş bug'ları) yapısal olarak biter. Yani AI-hazırlık ile kod kalitesi aynı yatırımdır.

### Bugün ucuza kurulacak 6 temel
| # | Karar | Bugün | AI'da getirisi |
|---|-------|-------|----------------|
| 1 | **Capability registry** (bu bölüm) | Düşük | AI tool yüzeyi + güvenlik bayrakları hazır |
| 2 | **Action katmanı** — yazımlar tek kapıdan | Orta (kademeli) | AI insanla aynı yolu kullanır |
| 3 | **Event/Audit stream** — her action yapısal olay üretir (actor, capability, entity, öncesi/sonrası, zaman) | Düşük | AI'nın hafızası + bağlamı; KVKK audit |
| 4 | **Actor tipi** — `human \| system \| ai` | Çok düşük | AI birinci sınıf aktör, kendi grant'i + audit'i |
| 5 | **Türkçe capability açıklamaları** | Sıfır (yazıldı) | "Şu öğrenciye sertifika bastır" → `certificate.issue` grounding'i |
| 6 | **Temiz/denormalize read model** — Person-merkezli donmuş gerçekler | Karar verildi | AI temiz fact'ler üzerinden doğru muhakeme (RAG zemini) |

3 ve 4'ü sonradan eklemek acı, bugün eklemek bir alan + bir helper.

### Güvenlik declarative gelir
AI'nın neye dokunabileceği registry metadata'sından türetilir:
- **🔴 kritik + `write`** → AI **kendi başına yapamaz**: sadece taslak hazırlar, insan onayı şart (`sms.bulk_send`, `certificate.issue`, `enrollment.complete`, `group.delete`)
- **`read` capability'leri** → AI scope'a göre sorgular ("550'nin devamsızlık raporunu çıkar")
- **🟢/🟡 + `write`** → onaylı/loglu otomasyon ("yeni ödev maili gönder")
- **`audited: true`** olan her AI eylemi audit log'a `actor.type = ai` olarak düşer

### Tangible senaryolar (hepsi omurgayla çalışır)
- *"550'nin durumunu özetle"* → read capability + event stream
- *"Devamsızlığı artan öğrencileri bul, velilerine SMS taslağı hazırla"* → read + `sms.send` (🔴 taslak → insan onayı)
- *"Bu öğrenci sertifikayı hak etti mi?"* → `certificate.eligibility.read`
- **Proaktif:** AI örüntü fark eder → personele `task.create` açar (actor: ai)
- *"Grafik-2 grubunu aktif yap"* → `group.activate`

### Şimdi YAPMA
- AI modeli, chatbot, embedding, RAG — erken, pahalı, değişken.
- "AI" diye ayrı modül. AI ayrı bir şey değil; **omurganın bir tüketicisi.**

Sadece omurgayı (action + event + actor + capability) disiplinle kur; gerisi geldiğinde kendiliğinden oturur.

## 3.5 Core / Vertical Pack Katmanlaması

> Hedef: model ileride eğitim dışı sektörlere de uyarlanabilsin. Kural: **soyutlamayı inşa etme, sınırı çiz.**
> Bugün eğitimi mükemmel yap; dikişleri doğru yere koy ki başka sektöre geçiş bir refactor olsun, rewrite değil.

```
core/                    ← sektör-bağımsız (değişmez)
  person · engagement · org-unit · task
  notification · messaging · audit · user/role/capability · import
  [executeAction + emitEvent + actor + registry mekanizması]

packs/
  education/             ← eğitime özel (çıkarılabilir/değiştirilebilir)
    attendance · grade · certificate · assignment · league
    + terminoloji + varsayılan rol paketleri
  fitness/   (gelecek)   ← membership · session · checkin · workout
  clinic/    (gelecek)   ← appointment · treatment · prescription
```

**Hangi domain nerede:**

| Core (generic) | Education Pack (özel) |
|----------------|------------------------|
| `person`, `task`, `notification`, `sms/email`, `audit`, `user/role/capability`, `import` | `attendance`, `grade`, `certificate`, `assignment`, `league` |
| `engagement` (generic köprü) | |
| `org-unit` (generic kap; eğitim "group" adını verir) | |

**3 mekanizma (yarı-hazır):**
1. **Registry açık/genişletilebilir.** Core kendi capability'lerini kayıtlar; pack *ek* domain+capability register eder. Registry veri, hardcode değil. Yeni sektör = yeni tanım + handler + ekran; core'a dokunmadan.
2. **Generic varlık + tipli uzantı.** `person` generic; "kişinin bağlı olduğu şey" generic `engagement` — `type` ve payload sektöre göre değişir (Eğitim: enrollment→group · Klinik: appointment→treatment · Spor: membership→class). **Donmuş-sonuç deseni generalleşir:** "engagement outcome snapshot" (eğitimde not/sertifika, sürücü kursunda sınav sonucu).
3. **Terminoloji sözlüğü.** Aynı `person` → "Öğrenci/Hasta/Üye/Müvekkil". Vertical config domain→etiket eşler. Çok ucuz, aynı kodu N sektöre koşturur.

**Bugün yapılacak (disiplin, ucuz):** Core'a eğitim kelimesi sokma (`person` içinde "öğrenci/branş/modül" geçmesin); eğitime özel domain'leri ayrı katmanda tut; registry'yi veri-driven tut; plugin altyapısı **kurma**, sadece katman sınırını koru.

**Strateji:** En kolay ilk genişleme eğitim-komşusu sektörler (sürücü/müzik/dil kursu, spor/PT) — `attendance + certificate + grade` pack'ini neredeyse aynen kullanır.

## 3.6 Ticari / Multi-Tenant Mimari

> Hedef: FlexOS satılabilir bir SaaS. Bu, **tek yeni yapısal eksen** ekler: `tenant` (müşteri kurum).
> `actor.type` ve `audit` ile aynı kategoride — **bugün bir alan, sonra retrofit cehennemi.**

**Tenant ekseni:** Her entity, her capability grant, her action, her event bir `tenantId` taşır. Onsuz asla sorgu atılmaz; security rules tenant izolasyonunu zorunlu kılar.

**İki katmanlı yetki** (capability işini aynen tekrar kullanır):
```
Tenant Entitlement   →  müşteri NE satın aldı (Education pack + AI add-on)
        ×                → bu tenant şu capability'leri KULLANABİLİR
User Grant           →  tenant içinde kullanıcıya NE atandı
        ×
Scope                →  self / assigned / branch / org

Etkin yetki = Entitlement ∩ Grant ∩ Scope
```

- **Entitlement** = lisans/paket (satıcı belirler): "Bu tenant Education pack aldı, AI add-on almadı."
- **Grant** = tenant kendi içinde dağıtır (müşteri yönetir): `role.manage` + `capability.grant` müşteriye açık ürün özelliği olur.
- **AI** = bir entitlement bayrağı — paralı katman, tenant bazında aç/kapa.

**Zamanlama — kaçırma:** `tenantId`, öğrenci/grup veri modeli **sıfırdan yazılırken** basılacak (Person≠Enrollment ile aynı tur). Boş sistemde bedava, dolu sistemde korkunç.

**Tuzak (en büyüğü):** Çok-tenant SaaS'ı mutlu kullanan ilk müşteri olmadan kurmak ölümcül.
> **Tenant-zero = kendi kurumun.** Onun için inşa et, ama tenant izolasyonuyla — böylece **müşteri #2 bir config olur, fork değil.** Billing/provisioning/self-serve → müşteri #2 kapıdayken.

---

# 4. MVP Çekirdek Akış (Blueprint)

> Hedef: temel akışı uçtan uca çalıştırmak. Satış kayıt açar → öğrenci oluşur →
> grup oluşturulur/atanır → eğitmen kendi öğrencilerini görür → not girer → operasyon takip eder.
> AI ve ileri otomasyon **kapsam dışı**; sadece mimari dikişler (tenantId, Person≠Enrollment, donmuş sonuç) bırakılır.

## 4.1 Kapsam — bu 4 domain
`person` (öğrenci) · `group` (grup) · `enrollment` (öğrenci–grup ilişkisi) · `grade` (not).
Attendance, certificate, assignment, sale **bu turda değil** (akış için gerekmiyor).

**En kritik kural:** Person grup/not taşımaz. Grup ve not ilişkisi `enrollment`'ta yaşar.
Bu, hem "eğitmen sadece kendi öğrencilerini görür"ü hem "aynı kişi farklı yıllarda geri döner"i çözer.

## 4.2 Veri Modeli (hedef Firestore şema)

> Tüm dokümanlar `tenantId` taşır (multi-tenant dikişi — boşken bedava, sonra korkunç).
> Bugünkü `students`/`groups` koleksiyonlarının yeniden-yazımıdır; eski alanlar migrasyonla taşınır.

### `persons/{personId}` — Öğrenci/Kişi (merkez, kalıcı)
```
tenantId
firstName, lastName
pii: { tcNo?, phone?, email? }
status: "prospect" | "active" | "passive"
consentKVKK: boolean
authUid?                  // öğrenci portalı için (varsa)
createdAt, createdBy
// ⛔ groupId YOK · grade YOK — bunlar enrollment'ta
```

### `groups/{groupId}` — Grup (süreç kabı; generic "org-unit"un eğitim adı)
```
tenantId
code                      // "550"
branch                    // "grafik"
module                    // "GRAFIK_1"
status: "planned" | "enrolling" | "active" | "postponed" | "completed" | "archived"
trainerId                 // atanmış eğitmen (uid)
schedule: { startDate, days[], sessionHours, endDate? }
createdAt, createdBy
```

### `enrollments/{enrollmentId}` — KÖPRÜ (Person ↔ Group), akışın kalbi
```
tenantId
personId                  // FK → persons
groupId                   // FK → groups (güncel grup)
saleId?                   // FK → sale (sonra; şimdilik opsiyonel)
status: "active" | "frozen" | "completed" | "transferred" | "cancelled"
enrolledAt, enrolledBy
transferHistory: [{ fromGroupId, toGroupId, at, by }]

// ── Donmuş sonuç — modül/mezuniyet bitince yazılır, DEĞİŞMEZ ──
result?: {
  finalGrade, projectGrade, assignmentScore,
  groupCode, module, branch, term,
  finalizedAt
}
```

### `grades/{enrollmentId}` — Canlı not (enrollment'a bağlı, donmadan önce mutable)
```
tenantId
enrollmentId, personId, groupId   // sorgu kolaylığı için denormalize
projectGrade
assignmentScore                   // çekiliş ödev XP'sinden (sonra)
components: { ... }
updatedAt, updatedBy
// grade.finalize → hesaplanır, enrollment.result'a snapshot'lanır, orası kilitlenir
```

**Kaynak-of-truth ayrımı:** Canlı not `grades`'te düzenlenir; **resmi sonuç** `enrollment.result`'ta donar. Ödev ağırlığı sonradan değişse veya grup silinse bile `result` değişmez.

## 4.3 Uçtan Uca Akış → Capability Eşlemesi

| # | Adım | Eylem (capability) | Kim (grant) |
|---|------|--------------------|-------------|
| 1 | Satış öğrenci kaydı oluşturur | `person.create` | Satış **veya** Operasyon* |
| 2 | Öğrenci sistemde oluşur (havuza düşer) | (1'in sonucu) + `person.search` | — |
| 3a | Yeni grup oluşturulur | `group.create`, `group.assign_trainer`, `group.activate` | Operasyon |
| 3b | Öğrenci gruba atanır | `enrollment.create` (groupId set) / `group.assign_student` | Operasyon |
| 4 | Eğitmen kendi öğrencilerini görür | `person.read @assigned` + `enrollment.read @assigned` + `group.read @assigned` | Eğitmen |
| 5 | Eğitmen not girer | `grade.read @assigned`, `grade.write @assigned`, `grade.finalize @assigned` | Eğitmen |
| 6 | Operasyon süreci takip eder | `enrollment.read @org`, `group.read @org`, `grade.report.read @org` | Operasyon |

\* **Modülerliğin kanıtı:** Adım 1'i kim yapar sabit değil — kanonik akışta Satış, sizin kurumda Operasyon. **Aynı `person.create` capability'si, farklı grant.** Kodda `if (role==="satış")` yok; sadece kimin pakette `person.create` olduğu değişir.

## 4.4 "Eğitmen kendi öğrencilerini görür" — kilit mekanizma

```
JWT claim:  { groupIds: ["550", "598"] }      // eğitmenin atanmış grupları

query enrollments
  where tenantId == myTenant
  where groupId in myGroupIds
  where status == "active"
→ personId listesi
→ join persons (read @assigned)
```

Bu yüzden Person'da `groupId` tutmuyoruz: bir kişi birden çok enrollment taşıyabilir, eğitmen yalnızca **kendi grubundaki enrollment** üzerinden o kişiyi görür. Scope `assigned` = `groupIds` claim'i.

## 4.5 Minimum Capability Listesi (sadece bu akış)

| Domain | Capability | Hassas |
|--------|-----------|--------|
| person | `person.create` · `person.read` · `person.read.pii` · `person.edit` · `person.search` | 🟡/🟢 |
| enrollment | `enrollment.create` · `enrollment.read` · `enrollment.transfer` | 🟡 |
| group | `group.create` · `group.read` · `group.edit` · `group.assign_student` · `group.assign_trainer` · `group.activate` | 🟢/🟡 |
| grade | `grade.read` · `grade.write` · `grade.finalize` · `grade.report.read` | 🟢/🔴 |
| system | `role.manage` · `capability.grant` (paketleri kurmak için, admin) | 🔴 |

~18 capability. Attendance/certificate/assignment bu akışta yok.

## 4.6 Modül Sınırları (capability paketleri)

> Paket = isimlendirilmiş capability+scope seti. Departman değil, paket.

- **Satış paketi:** `person.create`, `person.read`, `person.read.pii`, `person.edit`, `person.search`, `enrollment.create` — scope `@org` (veya `@branch`).
- **Operasyon paketi:** `group.*`, `enrollment.*`, `group.assign_trainer`, `group.activate`, tüm read'ler `@org`, `grade.report.read @org`.
- **Eğitmen paketi:** `person.read @assigned`, `enrollment.read @assigned`, `group.read @assigned`, `grade.read/write @assigned`, `grade.finalize @assigned`.
- **Admin paketi:** Tümü `@org` + `role.manage`, `capability.grant`.

> Açık karar: `grade.finalize` (not donar) eğitmende mi operasyonda mı? MVP'de **eğitmen @assigned** (bugünkü "Modülü Bitir" davranışı). İleride operasyona alınabilir — sadece grant değişir.

## 4.7 Bugün bırakılan dikişler (AI/gelecek için ucuz)

1. **`tenantId` her dokümanda** + her sorguda + security rules zorunlu.
2. **Mutasyonlar service fonksiyonlarında**, bileşen içine saçılmaz (çekiliş bug sınıfının kökü buydu — `FLEX_CORE_LOG` §187-188). İleride bunlar `executeAction` olur.
3. **`enrollment.result` donmuş snapshot** deseni baştan şemada.
4. **`can(capability, scope)` helper'ı** — başta basit rol→paket eşlemesiyle dolu olsa bile, çağrı noktaları registry'ye hazır.

> Bu dördü dışında AI/otomasyon/multi-vertical mekanizması **kurulmaz**. Sadece çekirdek akış koşar.

---

# 5. Süreç Sorumlulukları, Öğrenci Kartı ve Güvenlik

## 5.1 Modüller Arası Sorumluluk Dağılımı

### Eğitim Operasyonu — İşin Beyni
- Branş, eğitim, grup tanımlar
- Grup tarihlerini ve takvimini belirler
- Eğitmen ataması yapar
- Grubu "Aktif" statüsüne alır → eğitmene yoklama açılır
- Öğrenci taleplerini ve şikayetleri yönetir
- Sertifika süreçlerini yönetir; sertifika basılınca SMS + e-posta otomatik gönderilir

### Satış
- Açılacak grupları ve ürün kataloğunu görür
- Ürün / paket satışı yapar
- Öğrenciyi sisteme kaydeder → havuza düşer
- Havuzdan ilgili gruba yerleştirir

### Eğitmen — Sadece Eğitim
- Grup oluşturamaz, düzenleyemez · öğrenci satışı yapamaz
- Sadece: ders verir, yoklama alır, proje notu girer, eğitmen notu ekler
- Atanmış grupları görür, öğrenciler zaten yerleştirilmiş gelir

## 5.2 Sertifika Verme Akışı (Eğitim Operasyonu)

Hedef: kurumu rahatlatan, uçtan uca otomatik akış. Eğitmen yalnızca notu besler; gerisini sistem + Eğitim Op tek ekrandan yürütür.

```
1. Eğitmen notu verir
        ↓
2. Sistem sertifika notunu hesaplar (proje + ödev ağırlıkları)
   → nota göre hak edilen sertifika türü belirlenir: Başarı | Katılım
        ↓
3. Eğitim Op ekranı — sınıfın "Sertifika Not" listesi
   Her öğrenci satırında: not + hak kazandığı sertifika türü + [Sertifika Bastır]
        ↓
4. [Sertifika Bastır] → otomatik yazıcıdan basılır
   + aynı anda öğrenciye mail/SMS: "Sertifikanız hazır, gelip alabilirsiniz."
        ↓
5. İl dışı / gelemiyorsa → dijital PDF kopyası öğrenciye gönderilir
        ↓
6. enrollment.certificate.durum = verildi + kod + verilisTarihi (kalıcı)
```

- **Sertifika türü karara bağlı:** Eğitim tanımındaki koşullar (min devam %, min not) öğrencinin notuyla kıyaslanır → Başarı mı Katılım mı otomatik belirlenir. Eğitim Op onaylar, sistem türü önerir.
- **Kanal:** Fiziksel basım (yazıcı) **varsayılan**; PDF **opsiyonel/uzaktan** alternatif. İkisi de aynı butondan tetiklenir, durum `verildi`ye döner.
- **Otomatik bildirim:** Basım anında mail + SMS tetiklenir (mevcut `send-*` + bildirim altyapısı pattern'i).

> Tümü Eğitim Operasyonu modülünde, sıfırdan inşada gelecek. Eğitmen tarafında **hiçbir sertifika butonu olmayacak** — sadece not girişi.

## 5.3 Rol + Yetki Modeli (geçiş / bugünkü)

> Hedef model §3'te (capability + scope). Aşağısı bugünkü/geçiş yaklaşımı.

Sadece role kontrolü yetmez. Role + Permission modeli kullanılır.

```
user {
  role: "trainer"
  permissions: ["attendance.read", "attendance.write", "students.read"]
}
```

Middleware ikisini birden kontrol eder: `hasRole("trainer") && hasPermission("attendance.write")`.

**Neden:** İleride şu varyasyonlar çıkacak — Admin · Şube Müdürü · Kıdemli Eğitmen · Eğitmen · Stajyer Eğitmen · Satış+Eğitmen (çift yetki). Bir elemana ek yetki tıkla verilip alınabilmelidir (örn. eğitmene `sales` permission → satış modülü açılır).

### Route Koruması (Middleware)
```
/trainer/*    → role: trainer | admin
/operation/*  → role: operation | admin
/sales/*      → role: sales | admin | permission: sales
/finance/*    → role: finance | admin | permission: finance
```

## 5.4 Öğrenci Kartı

Sistemin merkezidir. **Tek kart** vardır, role göre görünen sekmeler değişir.

| Sekme | Eğitmen | Operasyon | Satış | Muhasebe |
|-------|---------|-----------|-------|----------|
| Eğitim Durumu | ✓ (default) | ✓ | | |
| Lig | ✓ | | | |
| Eğitimler / Gruplar | | ✓ | ✓ | |
| Sertifikalar | ✓ | ✓ | | |
| Eğitmen Notları | ✓ | | | |
| Ödemeler / Sözleşme | | | | ✓ |

- **Eğitmen Notları:** Varsayılan blur. Butona basınca görünür (öğrenci yanında ekran açılabilir).
- **shared altındadır.** Her modülden açılabilir, Ctrl+K ile erişilebilir.

### Ctrl+K — Global Arama
Tüm modüllerin merkezi erişim noktası: `Ctrl+K → "Ege" yaz → Öğrenci Kartı açılır`. Role göre filtrelenir (eğitmen sadece kendi öğrencilerini görür). Shared altında.

## 5.5 Oyunlaştırma (Lig Sistemi)
Kaldırılmayacak. Korunacak. **Opsiyonel.** Eğitmen sınıf ligini açarsa anlam kazanır; öğrenci kartında ayrı "Lig" sekmesi. Default sekme "Eğitim Durumu".

## 5.6 Güvenlik

### Firestore Rules — Katman Katman
```
Trainer    → sadece kendi atanmış groupId'lerine ait dökümanlar
Operation  → tüm gruplar, enrollment'lar
Sales      → products, groups (read) | persons, sales (write)
Finance    → payment dökümanları, contracts
```

### PII & KVKK
- Öğrenci adı, telefon, e-posta hassas veridir; KVKK rızası kayıt altına alınır
- Veri erişim logu tutulur
- **"Öğrenci silinmez"** — silme talebi gelirse kişisel veri anonimleştirilir, eğitim geçmişi korunur

### Audit Log
Her kritik işlem izlenebilir: `Kim → Ne yaptı → Hangi kayıtta → Ne zaman`.
Not girme, sertifika basma, ödeme kaydı, öğrenci transferi, grup statü değişikliği — hepsi loglanır.

### JWT Claims
```
{ role: "trainer", permissions: ["sales"], groupIds: ["550", "598"] }
```
API route'lar claim'e göre izin verir. Client-side kontrole güvenilmez.

### Deployment Stratejisi
Tek root, tek Next.js uygulaması; modüller route bazlı ayrılır.
- `main` → `flex.vercel.app` — stable, eğitmen kullanır
- `dev` → `flex-dev.vercel.app` — geliştirme, ayrı Firebase projesi

---

# 6. Yol Haritası ve İnşa Sırası

## 6.1 İnşa Sırası (veri modeli yeniden-inşa)

1. **Core tiplerini kilitle** (Person, Enrollment, Group, Module) + FlexOS tipleri (Education, Sale, Branş, Şube) — **+ `tenantId` aynı turda.**
2. **Backfill:** mevcut `students` → Person + Enrollment (groupId'den) + `group_history`'den geçmiş enrollment'lar. **Hiçbir şey silinmez.**
3. **İlk dikey dilim:** bireysel satış → gruba ekleme → eğitmene atama (1. etap).
4. Yazım + liste + yoklama + grading sorgularını enrollment-aware repoint.
5. `student.groupId` bağımlılığını kaldır.
6. EduOps (eğitim/grup tanımı) → Satış → Kurumsal → Finans/rapor.

> **Sıra notu:** Ayrılabilirlik kısıtı yüzünden eğitmen tarafının Core'a taşınması, sales'ten ÖNCE — Core'un standalone yettiğini kanıtlamak için.

## 6.2 Capability/Action Omurgası — Sonraki Adımlar

1. `Capability`, `Scope`, `Sensitivity`, `Actor` (+ `tenantId`) TypeScript tipleri + sabit capability listesi (registry iskeleti).
2. `executeAction()` çekirdeği + `emitEvent()` audit helper'ı (önce 1-2 domain'de pilot) — tenantId + actor baştan dahil.
3. Veri modeli yeniden yazımı: Person≠Enrollment **+ tenantId** aynı turda.
4. Core / Education-pack katman sınırının kodda kurulması (eğitim domain'leri ayrı).
5. İki katmanlı yetki: entitlement (tenant) × grant (user) × scope.
6. Rol paketlerinin tanımı (Eğitmen / Operasyon / Satış / Admin → capability+scope setleri).
7. Mevcut hardcoded kontrollerin (`PERMISSIONS.MANAGEMENT_PANEL`, `role === instructor`) registry'ye taşınması.

## 6.3 MVP — Yarın İlk Adım

1. `persons` / `groups` / `enrollments` / `grades` koleksiyon şemalarını + `tenantId`'yi sabitle.
2. `can(capability, scope)` helper'ı + 4 paketi (Satış/Operasyon/Eğitmen/Admin) tanımla.
3. Akışın 1→6 adımını en kısa yoldan uçtan uca koştur (UI minimal, mantık service'te).
4. Çalışınca → Eğitim Operasyonu modülüne geç.

## 6.4 Modül Geliştirme Sırası (büyük resim)

1. **Eğitmen Paneli** — neredeyse tamamlandı (not girme, StudentDetailModal, yönetim paneli, profil ayarları)
2. **Eğitim Operasyonu** — sıradaki büyük modül (rol+permission genişletme, grup yaşam döngüsü, eğitmen atama, grup başlatma → yoklama aktivasyonu)
3. **Satış** — sonraki modül
4. **Finance** — sonraki modül
5. **Öğrenci Portalı** — en sona (Eğitim Operasyonu olmadan eksik kalır)

## 6.5 Kapsam Dışı (1. etap) — alanlar şemada hazır, mantık sonra

Payment/taksit, kurumsal Account, paket çoklu-enrollment, kota takibi, gelir raporlama, sertifika üretimi. Hepsinin alanı şemada baştan var ("temeli sağlam at"), mantığı sonraki etaplarda dolar.
