"use client";

/**
 * FlexOS · Paylaşımlı sol menü (sidebar).
 * Tek kaynak — tüm FlexOS sayfaları bunu kullanır. Alt menü destekli:
 * "Eğitim Yönetimi" ana başlık → "Eğitimler" + "Eğitim Ayarları" alt başlıkları.
 *
 * NOT: Görsel sonra Claude Design'da elden geçirilecek; şimdilik işlevsel/sade.
 */

import React, { CSSProperties, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import FlexLogo from "@/app/components/ui/FlexLogo";
import ViewPinModal from "./ViewPinModal";
import { FlexSpinner, isAppBooted, markAppBooted } from "./FlexSpinner";

/**
 * Core/Full — SADECE `/api/flexos/me`'nin `mode` alanından okunur (bkz. o route'taki
 * yorum). 2026-07-11 öncesi burada localStorage tabanlı ayrı bir kaynak vardı
 * (`viewMode.ts`, silindi) — sunucudaki gerçek moddan bağımsız kayabiliyordu (ör.
 * admin'e dönünce sidebar hâlâ eğitmen sanıp Sistem Ayarları'nı gizliyordu).
 */
type ViewMode = "core" | "full";

// Sayfa değişince FlexSidebar yeniden mount olur (paylaşımlı layout yok) — capability
// listesini modül-seviyesinde önbelleğe alarak her navigasyonda "menü boşal-dolsun"
// yanıp sönmesini (flaş) önler. İlk yüklemede bir kez fetch edilir, sonrasında cache'ten okunur.
let capsCache: Set<string> | null = null;
// 2026-07-13 bug fix (1. tur, YETERSİZ): `caps` cache'leniyordu ama `mode` her mount'ta
// "full"a resetleniyordu. Modül-cache eklendi AMA cache soğukken (ilk mount, ya da önceki
// sayfa fetch'i tamamlanmadan hızlı geçiş — `cancelled` o fetch'i iptal eder) varsayılan hâlâ
// "full" idi — yani bilinmeyen durumda EN AÇIK (permissive) hali varsayıyordu, tam tersi olması
// gerekirken. Kullanıcı fix sonrası hâlâ aynı flaşı gördü (2026-07-13, aynı gün, sonraki oturum).
// 2. tur GERÇEK fix: `caps` için zaten var olan kural ("yüklenene kadar boş/gizli") `mode`'a da
// uygulandı — bilinmeyen mod artık "full" değil `null`, `canSee`'deki `mode === "full"` katı
// eşitliği null'da otomatik false döner (enterprise öğe gizli kalır), sunucu gerçekten "full"
// diyene kadar hiçbir full-only öğe ASLA görünmez (ne kısa an ne uzun) — modül-cache artık sadece
// bir OPTİMİZASYON, doğruluk artık ona bağımlı değil.
let modeCache: "core" | "full" | null = null;

export type FlexNavKey =
  | "ana"
  | "egitimler"
  | "ayarlar"
  | "satis-yap"
  | "satis-liste"
  | "paket-yonetimi"
  | "kampanya-yonetimi"
  | "ogrenci-havuzu"
  | "siniflar"
  | "odev-yonetimi"
  | "odev-teslimi"
  | "egitmenler"
  | "kullanicilar"
  | "kullanici-ayarlari"
  | "aktivite-merkezi"   // eskiyle uyum (aktiviteler ile aynı davranır)
  | "aktiviteler"
  | "randevu-takvimi"
  | "yoklamalar"
  | "yoklama-al"
  | "yoklama-detay"
  | "yoklama-raporu"
  | "sertifika-notu"
  | "odev-notu"
  | "sertifika-ayarlari"
  | "sistem-ayarlari";

export default function FlexSidebar({ active }: { active?: FlexNavKey }) {
  const router = useRouter();
  const soon = () => toast.info("Bu özellik yakında.");
  const go = (to: string | null) => () => (to ? router.push(to) : soon());

  const eduActive = active === "egitimler" || active === "ayarlar";
  const [eduOpen, setEduOpen] = useState(eduActive); // aktif alt sayfadaysak başta açık

  const salesActive = active === "satis-yap" || active === "satis-liste" || active === "paket-yonetimi" || active === "kampanya-yonetimi";
  const [salesOpen, setSalesOpen] = useState(salesActive);

  const aktiviteActive = active === "aktivite-merkezi" || active === "aktiviteler" || active === "randevu-takvimi";
  const [aktiviteOpen, setAktiviteOpen] = useState(aktiviteActive);

  const yoklamaActive = active === "yoklamalar" || active === "yoklama-al" || active === "yoklama-detay" || active === "yoklama-raporu";
  const [yoklamaOpen, setYoklamaOpen] = useState(yoklamaActive);

  const odevActive = active === "odev-yonetimi" || active === "odev-teslimi" || active === "odev-notu";
  const [odevOpen, setOdevOpen] = useState(odevActive);

  const sertifikaActive = active === "sertifika-notu" || active === "sertifika-ayarlari";
  const [sertifikaOpen, setSertifikaOpen] = useState(sertifikaActive);

  const kullanicilarActive = active === "kullanicilar" || active === "kullanici-ayarlari";
  const [kullanicilarOpen, setKullanicilarOpen] = useState(kullanicilarActive);

  // ── Menü kuralı: öğe görünür ⟺ can(actor,yetki) VE (core-grubu VEYA view=Full) ──
  // Capability listesi yüklenene kadar boş küme = kapılı öğeler geçici gizli (kozmetik flaş yok).
  const [uid, setUid] = useState<string | null>(null);
  const [caps, setCaps] = useState<Set<string>>(() => capsCache ?? new Set());
  // Bilinmeyen (henüz sunucudan doğrulanmamış) mod artık "full" DEĞİL — `canSee`'nin
  // `mode === "full"` katı eşitliği null'da false döner, yani full-only öğeler mod
  // ONAYLANANA kadar hiç görünmez (bkz. modeCache yorumu).
  const [mode, setMode] = useState<ViewMode | null>(() => modeCache);
  // 2026-07-14 (4. tur — SICAK-CACHE İYİMSERLİĞİ TAMAMEN KALDIRILDI): önceki turda
  // `ready` modül-cache doluysa baştan `true` başlıyordu ("navigasyon akıcılığı" için)
  // — ama kullanıcı BUNU DA reddetti: "Eğitimlere giriyorum, sidebar 1sn bile olsa
  // full oluyor sonra gizleniyor". Kök neden: cache'teki (önceki sayfadan miras kalan)
  // değer anlık doğru gösteriliyordu, SONRA arka planda sessizce yenilenen fetch
  // düzeltiyordu — cache YANLIŞSA (ya da geçiciyse) bu tam olarak "1 saniye yanlış,
  // sonra doğru" görüntüsü verir. Kullanıcının talebi KESİN: sidebar/site kendi
  // NİHAİ cevabına sahip olmadan HİÇ görünmeyecek — tek bir doğru render, asla iki
  // aşamalı değil. Çözüm: `ready` HER mount'ta `false` başlar (cache ne olursa olsun),
  // SADECE bu mount'un KENDİ fetch'i bitince true olur. Bunun bedeli: her navigasyonda
  // kısa bir tam-ekran yükleme kapanışı (aşağıdaki `!ready` early-return, bkz. render) —
  // kullanıcı bunu "akıcılığa" tercih etti, kabul edilebilir.
  const [ready, setReady] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  // Sistem-geneli "Eğitmen Tek Başına" (standaloneMode) — Kişisel Görünüm Modu'ndan
  // (mode/Core-Full) TAMAMEN AYRI. 2026-07-11 kullanıcı bulgusu: standalone açıkken bile
  // admin/Full sidebar'da Satışlar/Aktivite Merkezi/Öğrenciler görünüyordu, çünkü hiçbir
  // yerde standaloneMode kontrol edilmiyordu — sadece "egitmen" paketinin kendi grant'lerini
  // etkiliyordu (resolvePackages), admin/satis/operasyon paketlerini hiç etkilemiyordu.
  // Standalone = tek-eğitmenlik/classroom kurulumu; satış/aktivite katmanı HERKES için
  // (admin dahil) anlamsız, o yüzden burada sidebar seviyesinde ayrıca gizleniyor.
  const [standaloneMode, setStandaloneMode] = useState(false);

  useEffect(() => {
    // 2026-07-14 (4. tur — bir önceki turun kendi REGRESYONU düzeltildi): `if (ready)
    // return` ile fetch'i tamamen atlamak, sıcak cache'teki bir değerin YANLIŞ olduğu
    // (ör. view-mode dokümanı bir istekte okunamayıp geçici olarak "full"a düşen bir
    // sunucu tarafı hatası) durumda ASLA düzelmemesine yol açtı — kullanıcı "Satışlar
    // geldi ve gitmedi" diye bildirdi, çünkü artık hiçbir mount yeniden doğrulamıyordu.
    // Doğrusu: skeleton'ı SADECE "hiç onaylanmamışken" göster (ready), ama fetch'i HER
    // mount'ta arka planda (sessizce, skeleton'a dönmeden) çalıştırmaya devam et — SWR
    // deseni. Cache doğruysa görünürde hiçbir şey değişmez; yanlışsa bir sonraki
    // sayfada (hatta aynı sayfada state güncellenince) kendi kendine düzelir, hiç
    // kalıcı yanlış durumda TAKILI KALMAZ.
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user || cancelled) return;
      setUid(user.uid);
      try {
        const token = await user.getIdToken();
        const [meRes, settingsRes] = await Promise.all([
          fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
          fetch("/api/flexos/settings", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        ]);
        if (meRes.ok && !cancelled) {
          const json = await meRes.json();
          const next = new Set<string>(json.capabilities ?? []);
          capsCache = next;
          setCaps(next);
          const nextMode: ViewMode = json.mode === "core" ? "core" : "full";
          modeCache = nextMode;
          setMode(nextMode);
        }
        if (settingsRes.ok && !cancelled) {
          const json = await settingsRes.json();
          setStandaloneMode(!!json.standaloneMode);
        }
      } catch {
        // sessiz — menüde kapılı öğeler gizli kalır, sayfa fonksiyonelliğini etkilemez
      } finally {
        // Başarı ya da hata fark etmez: bu mount artık NİHAİ bir cevaba sahip —
        // ready=true olmadan nav hiç çizilmiyordu (bkz. render), sonsuza kadar
        // iskelette takılı kalmasın diye başarısızlıkta da (auth yok, network
        // hatası) kapanıyor; o durumda caps boş/mode null kalır, canSee zaten
        // güvenli tarafta (hiçbir kapılı öğe görünmez).
        if (!cancelled) {
          setReady(true);
          markAppBooted();
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const canToggleView = caps.has("view.toggle");

  // Sunucudaki gerçek yetkiyi de (admin↔eğitmen) mod'a göre değiştirir — sadece
  // görünüm anahtarı sahibinde etkili (bkz. auth-actor.ts VIEW_TOGGLE_OWNER_EMAIL).
  // Kaydettikten sonra ilgili modun kendi ana sayfasına GİDER (reload değil) —
  // aksi halde admin-only bir sayfadayken (ör. Kullanıcılar) eğitmene düşünce o
  // sayfa 403 verip çirkin bir hata gösteriyordu. Yeni URL'e gitmek ayrıca her
  // önceki cache sorununu da kökten bypass eder (hiç istenmemiş taze bir istek).
  const persistModeAndReload = async (next: "core" | "full") => {
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/flexos/view-access/mode", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      // 2026-07-11: POST başarısızsa artık SESSİZCE yutup yine de navigate ETMİYORUZ —
      // önceki davranış sunucu tarafını değiştirmeden client'ı "değişti" sanan bir sayfaya
      // götürüyordu, sonraki hard-reload'larda bile eski moda takılı kalınabiliyordu
      // (gerçek bir "stuck in core mode" vakasının kök nedeniydi). Şimdi hata görünür.
      if (!res.ok) {
        toast.error("Görünüm değiştirilemedi, tekrar dener misin?");
        return;
      }
    } catch {
      toast.error("Görünüm değiştirilemedi (bağlantı hatası), tekrar dener misin?");
      return;
    }
    toast.success(next === "core" ? "Görünüm: Eğitmen" : "Görünüm: Full");
    // 2026-07-13 fix: "full" moda geçince `/flexos/anasayfa`'ya (admin dashboard'u HENÜZ
    // İNŞA EDİLMEDİ, boş "yakında" placeholder'ı) gidiyordu — kullanıcı bulgusu: admin'e
    // her geçişte dead-end'e düşüyordu. Aşağıdaki `homeHref` (Ana Sayfa nav öğesi/logo)
    // zaten owner için HER İKİ modda da `/flexos/egitmen-anasayfa`'ya gidiyor (canToggleView
    // true olduğu sürece) — mod değişimindeki bu tek YÖNLENDİRME o mantıkla TUTARLI hale
    // getirildi, aynı gerçek sayfaya gider.
    window.location.href = "/flexos/egitmen-anasayfa";
  };

  // Gizli kısayol — Ctrl/Cmd+Alt+T (platformun kendi doğal modifier'ı: Mac'te Cmd,
  // PC'de Ctrl). Owner değilse tamamen no-op (sıfır iz).
  // NOT: Sırasıyla Ctrl+Shift+M (Chrome profil değiştirme), Ctrl+Shift+K (arka
  // planda çalışan başka bir uygulamanın global kısayolu) ve Ctrl/Cmd+Alt+M
  // (Mac'te Cmd+Option+M = macOS'un native "Tüm Pencereleri Küçült" kısayolu,
  // OS seviyesinde yakalanıyor, tarayıcıya hiç ulaşmıyor) ile çakıştı.
  // 2026-07-11: harf M'den T'ye değişti (Cmd+Option+T bilinen bir OS/tarayıcı
  // kısayolu değil). PC'de Ctrl+Alt+T'nin boş olduğu doğrulanmalı (Linux'ta
  // GNOME Terminal kısayolu ama Windows'ta varsayılan değil).
  // 2026-07-11 (devam): e.key DEĞİL e.code kullanılıyor — macOS'ta Option basılıyken
  // e.key harf yerine özel karakter üretir (Option+T → "†" gibi, klavye düzenine
  // göre değişir), bu yüzden "t" karşılaştırması Mac'te hiç eşleşmiyordu. e.code
  // fiziksel tuş konumunu verir (modifier/klavye düzeninden bağımsız, "KeyT").
  useEffect(() => {
    if (!canToggleView) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyT")) return;
      e.preventDefault();
      if (mode === "full") {
        void persistModeAndReload("core");
      } else {
        setPinOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canToggleView, mode, uid, caps]);

  const onPinVerified = () => {
    setPinOpen(false);
    void persistModeAndReload("full");
  };

  /** cap yoksa hiç görünmez; core-grup her zaman, enterprise-grup sadece Full'de. */
  const canSee = (cap: string, core: boolean) => caps.has(cap) && (core || mode === "full");

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/flexos/giris");
  };

  // "Kim girdiyse onun ana sayfası" hedefi — hem logo hem "Ana Sayfa" nav öğesi aynı
  // hedefe gider (bkz. aşağıdaki nav öğesindeki uzun açıklama).
  const homeHref = caps.has("role.manage")
    ? (canToggleView ? "/flexos/egitmen-anasayfa" : "/flexos/anasayfa")
    : caps.has("education.create")
      ? "/flexos/egitim-operasyon-anasayfa"
      : caps.has("sale.create")
        ? "/flexos/satislar/dashboard"
        : "/flexos/egitmen-anasayfa";

  // 2026-07-14: `ready` false iken sidebar'ın YERİNE değil, TÜM SAYFANIN ÜSTÜNE tam
  // ekran bir kapatma katmanı döndürülüyor — kullanıcı açıkça "sidebar render olmadan
  // SİTEYİ gösterme" dedi, yani altındaki asıl sayfa içeriği (aynı anda mount olmuş
  // olsa bile) görsel olarak hiç görünmemeli. Nav'ın kendisi de (canlı öğe listesi)
  // sadece bu erken dönüşten SONRA, `ready` kesinleşince tek seferde render edilir —
  // iki aşamalı (önce yanlış/eksik, sonra doğru) bir render asla olmaz.
  if (!ready) {
    // 2026-07-14: lacivert zemin + logo kullanıcı tarafından beğenilmedi ("hoş
    // olmamış") — projenin zaten HER YERDE kullandığı paylaşımlı yükleme deseni
    // (FlexSpinner.tsx::FlexPageLoader, açık gri zemin + dönen spinner) burada da
    // aynen kullanılıyor, tutarlılık için. `position:fixed` + `inset:0` KORUNUYOR —
    // FlexPageLoader'ın kendisi sabit-konumlu değil (kendi 100vh'lik bloğu), o yüzden
    // burada aynen import edip kullanmak yerine AYNI görsel içerik fixed sarmalayıcı
    // içinde tekrarlanıyor — amaç (sayfayı tam kapatmak) FlexPageLoader'ın normal
    // akıştaki halinden farklı, o yüzden birebir import yerine.
    // 2026-07-17: açılışta (RootPage → hedef sayfa → burası) hâlâ yazılı "Flex
    // Yükleniyor" ekranından yazısız spinner'a aniden dönüyordu — kullanıcı bunu tek
    // sürekli yazılı ekran istedi. Uygulama bu sekmede daha önce bir kez tam yüklendiyse
    // (sayfa geçişi) yazı yok, ilk açılışta (henüz hiç `ready` olmadıysa) yazı var.
    const booted = isAppBooted();
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#EEF0F3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <FlexSpinner size={48} />
        {!booted ? (
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF" }}>Flex Yükleniyor</p>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="fs-sidebar" style={S.sidebar}>
      <style>{css}</style>
      {/* 2026-07-12 kullanıcı isteği: logo sabit duruyordu, artık tıklanınca Ana Sayfa'yla
          aynı hedefe gidiyor. */}
      <div
        onClick={go(homeHref)}
        style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 52px", cursor: "pointer", width: "fit-content" }}
      >
        <FlexLogo variant="white" width={72} />
      </div>

      {/* 2026-07-16 kullanıcı bulgusu: `<nav>` ile alttaki "Sistem Ayarları/Çıkış" bloğu
          arasında `marginTop:auto` boş alanı TAMAMEN yutuyordu — uzun ekranda menü öğeleri
          birbirinden anlamsızca uzak duruyordu, KISA ekranda ise (sidebar hiç scroll
          olmadığından) toplam içerik 100% yüksekliği aşınca alt blok üstteki öğelere
          neredeyse yapışıyordu. `<nav>` artık `flex:1 + overflowY:auto` — taşarsa KENDİSİ
          scroll olur, alt blok her zaman kendi doğal boyutunda hemen altında durur. */}
      <nav className="fs-nav" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Ana Sayfa = tek nav öğesi, hedefi role'e göre değişir (menü değil, "kim girdiyse
            onun ana sayfası" mantığı): role.manage → admin ana sayfa (`/flexos/anasayfa`
            henüz placeholder — sistem SAHİBİ için `canToggleView`/`view.toggle` özel: "Benim
            dashboardum şimdilik eğitmen dashboard olsun" kararı, 2026-07-10 — SADECE owner'ı
            etkiler, ileride gerçek bir Genel Müdür hâlâ placeholder'a gider); education.create
            (Operasyon paketine özgü — satış/eğitmen'de hiç yok, standalone eğitmende de
            yok, bkz. packages.ts) → Eğitim Operasyon Dashboard; sale.create (ve
            role.manage/education.create YOK, yani gerçek satış çalışanı) → Satış Dashboard;
            yoksa (eğitmen veya owner'ın Core görünümü) → eğitmen ana sayfa. */}
        <Item
          icon={IC.home}
          label="Ana Sayfa"
          active={active === "ana"}
          onClick={go(homeHref)}
        />

        {/* Eğitim Yönetimi — akordiyon ana başlık (framer-motion geçişli).
            "Eğitimler" (katalog CRUD) enterprise: sadece Full. "Eğitim Ayarları" (Branş
            Havuzu+Tatil+Sertifika+Sözleşme) her iki modda da açık — katalog kurulumu
            (en az 1 branş/eğitim) Core'daki eğitmenin grup açabilmesi için şart, admin
            Core'dan çıkmadan halledebilsin diye. */}
        {(canSee("education.create", false) || canSee("branch.create", true)) && (
          <>
            <a className="fs-navlink" style={eduActive ? S.parentActive : S.navItem} onClick={() => { setEduOpen((o) => !o); setSalesOpen(false); setOdevOpen(false); setKullanicilarOpen(false); setAktiviteOpen(false); setYoklamaOpen(false); setSertifikaOpen(false); }}>
              <span style={{ display: "inline-flex", color: eduActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.book }} />
              <span style={{ flex: 1 }}>Eğitim Yönetimi</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: eduOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {eduOpen && (
                <motion.div
                  key="edu-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    {canSee("education.create", false) && <SubItem label="Eğitimler" active={active === "egitimler"} onClick={go("/flexos/egitim-yonetimi")} />}
                    {canSee("branch.create", true) && <SubItem label="Eğitim Ayarları" active={active === "ayarlar"} onClick={go("/flexos/egitim-yonetimi/ayarlar")} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Satışlar — akordiyon ana başlık. Enterprise: sadece Full. Her alt-menü KENDİ
            capability'siyle ayrı gated (2026-07-10 kullanıcı kararı) — bir role Satış
            Yap kapalı, Satış Listesi açık şeklinde tanımlanabilsin diye. Ana başlık
            alt menülerden EN AZ BİRİ varsa görünür. Standalone'da (2026-07-11) admin
            dahil KİMSE görmez — Satış katmanı standalone kurulumda anlamsız. */}
        {!standaloneMode && (canSee("sale.create", false) || canSee("sale.read", false) || canSee("bundle.read", false) || canSee("campaign.read", false)) && (
          <>
            <a className="fs-navlink" style={salesActive ? S.parentActive : S.navItem} onClick={() => { setSalesOpen((o) => !o); setEduOpen(false); setOdevOpen(false); setKullanicilarOpen(false); setAktiviteOpen(false); setYoklamaOpen(false); setSertifikaOpen(false); }}>
              <span style={{ display: "inline-flex", color: salesActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.tag }} />
              <span style={{ flex: 1 }}>Satışlar</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: salesOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {salesOpen && (
                <motion.div
                  key="sales-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    {canSee("sale.create", false) && <SubItem label="Satış Yap" active={active === "satis-yap"} onClick={go("/flexos/satislar/satis-yap")} />}
                    {canSee("sale.read", false) && <SubItem label="Satış Listesi" active={active === "satis-liste"} onClick={go("/flexos/satislar/satis-liste")} />}
                    {canSee("bundle.read", false) && <SubItem label="Paket Yönetimi" active={active === "paket-yonetimi"} onClick={go("/flexos/satislar/paket-yonetimi")} />}
                    {canSee("campaign.read", false) && <SubItem label="Kampanya Yönetimi" active={active === "kampanya-yonetimi"} onClick={go("/flexos/satislar/kampanya-yonetimi")} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Öğrenci Havuzu = admin/satış/operasyon işi — eğitmen (Full'da da Core sistem
            modunda da) burayı hiç görmez, kendi öğrencilerini Sınıflar'daki "Öğrencilerim"
            bölümünden ekler/görür. `person.read` eğitmen paketinde (hiçbir modda) yok.
            ÖNCEDEN `sale.read`'e bağlıydı (2026-07-10 düzeltme: Eğitim Koordinatörü'nün
            satış modülü yok ama kayıt/grup atama işi öğrenci havuzundan yapılıyor —
            `person.read` her ofis rolünde ortak, doğru gate bu). Standalone'da (2026-07-11
            kullanıcı kararı) ayrı bir Öğrenci Havuzu YOK — öğrenci listesi Sınıflar'ın
            içinde (Classroom mantığı), admin dahil kimse bu linki görmez. */}
        {!standaloneMode && canSee("person.read", false) && <Item icon={IC.users} label="Öğrenciler" active={active === "ogrenci-havuzu"} onClick={go("/flexos/ogrenciler/havuz")} />}
        {/* Core: eğitmen günlük işi — mode'dan bağımsız her zaman görünür. */}
        {canSee("group.read", true) && <Item icon={IC.graduation} label="Sınıflar" active={active === "siniflar"} onClick={go("/flexos/siniflar")} />}

        {/* Ödevler — akordiyon: Ödev Teslimi (oluşturma DAHİL — canlıda da aynı ekrandı,
            ayrı bir "yönetim" grup-kart sayfası kaldırıldı) + Ödev Notu (en sona bırakıldı —
            "Ödev Değerlendirme" ölü linki KALDIRILDI, aynı kavram olduğu için Sertifikasyon'daki
            gerçek "Ödev Notu" sayfası buraya TAŞINDI, 2026-07-08 kullanıcı kararı). Yoklama/not
            gibi çekirdek öğretmenlik işi, standalone-only DEĞİL. */}
        {canSee("assignment.read", true) && (
          <>
            <a className="fs-navlink" style={odevActive ? S.parentActive : S.navItem} onClick={() => { setOdevOpen((o) => !o); setEduOpen(false); setSalesOpen(false); setKullanicilarOpen(false); setAktiviteOpen(false); setYoklamaOpen(false); setSertifikaOpen(false); }}>
              <span style={{ display: "inline-flex", color: odevActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.clipboard }} />
              <span style={{ flex: 1 }}>Ödevler</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: odevOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {odevOpen && (
                <motion.div
                  key="odev-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    <SubItem label="Ödev Yönetimi" active={active === "odev-yonetimi"} onClick={go("/flexos/odevler/yonetim")} />
                    <SubItem label="Ödev Teslimi" active={active === "odev-teslimi"} onClick={go("/flexos/odevler/teslim")} />
                    <SubItem label="Ödev Notu" active={active === "odev-notu"} onClick={go("/flexos/sertifikasyon/odev-notu")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Eğitmenler — tam CRUD sayfa (/flexos/egitmenler, müsaitlik/ücret/not).
            2026-07-10'da Kullanıcılar'ın sekmesine taşınmıştı, kullanıcı geri istedi
            ("Eğitmenler diye başlı başına bir menü vardı orada") — Kullanıcılar'daki
            "Eğitmenler" sekmesi (hafif özet) AYRICA duruyor, bu ikisi farklı görünümler. */}
        {canSee("trainer.read", false) && <Item icon={IC.trainer} label="Eğitmenler" active={active === "egitmenler"} onClick={go("/flexos/egitmenler")} />}

        {/* Kullanıcılar — akordiyon: Kullanıcı Listesi (Personel/Eğitmenler/Öğrenciler 3 sekmesi) +
            Kullanıcı Ayarları (rol/yetki tanımları, SADECE role.manage — aşağıda ayrıca kapılı). */}
        {(canSee("role.manage", false) || canSee("trainer.read", false) || canSee("person.read", false)) && (
          <>
            <a className="fs-navlink" style={kullanicilarActive ? S.parentActive : S.navItem} onClick={() => { setKullanicilarOpen((o) => !o); setEduOpen(false); setSalesOpen(false); setOdevOpen(false); setAktiviteOpen(false); setYoklamaOpen(false); setSertifikaOpen(false); }}>
              <span style={{ display: "inline-flex", color: kullanicilarActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.shield }} />
              <span style={{ flex: 1 }}>Kullanıcılar</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: kullanicilarOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {kullanicilarOpen && (
                <motion.div
                  key="kullanicilar-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    <SubItem label="Kullanıcı Listesi" active={active === "kullanicilar"} onClick={go("/flexos/kullanicilar")} />
                    {canSee("role.manage", false) && <SubItem label="Kullanıcı Ayarları" active={active === "kullanici-ayarlari"} onClick={go("/flexos/kullanicilar/ayarlar")} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Aktivite Merkezi — akordiyon. Enterprise: sadece Full. Standalone'da (2026-07-11)
            admin dahil kimse görmez — Satış/Op pipeline'ı standalone'da yok. */}
        {!standaloneMode && canSee("case.read", false) && (
          <>
            <a className="fs-navlink" style={aktiviteActive ? S.parentActive : S.navItem} onClick={() => { setAktiviteOpen((o) => !o); setEduOpen(false); setSalesOpen(false); setOdevOpen(false); setKullanicilarOpen(false); setYoklamaOpen(false); setSertifikaOpen(false); }}>
              <span style={{ display: "inline-flex", color: aktiviteActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.activity }} />
              <span style={{ flex: 1 }}>Aktivite Merkezi</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: aktiviteOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {aktiviteOpen && (
                <motion.div
                  key="aktivite-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    <SubItem label="Aktiviteler" active={active === "aktiviteler" || active === "aktivite-merkezi"} onClick={go("/flexos/aktivite-merkezi")} />
                    <SubItem label="Randevu Takvimi" active={active === "randevu-takvimi"} onClick={go("/flexos/randevu-takvimi")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Yoklamalar — akordiyon: Yoklama Al + Yoklama Detay (attendance.write, eğitmen
            dahil Core'da da her zaman) + Yoklama Raporu (attendance.report.read, SADECE
            Op/Finans/Admin — eğitmende BİLEREK YOK, 2026-07-02 kararı). SADECE Yoklama Al
            YENİ SEKMEDE açılır (ders başladıktan sonra yanlışlıkla başka sayfaya geçip
            yarım bırakmasın); Detay + Rapor normal navigasyon (2026-07-02 düzeltmesi). */}
        {(canSee("attendance.write", true) || canSee("attendance.report.read", false)) && (
          <>
            <a className="fs-navlink" style={yoklamaActive ? S.parentActive : S.navItem} onClick={() => { setYoklamaOpen((o) => !o); setEduOpen(false); setSalesOpen(false); setOdevOpen(false); setKullanicilarOpen(false); setAktiviteOpen(false); setSertifikaOpen(false); }}>
              <span style={{ display: "inline-flex", color: yoklamaActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.calendar }} />
              <span style={{ flex: 1 }}>Yoklamalar</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: yoklamaOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {yoklamaOpen && (
                <motion.div
                  key="yoklama-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    {canSee("attendance.write", true) && <SubItem label="Yoklama Al" active={active === "yoklama-al"} onClick={() => window.open("/flexos/yoklama/al", "_blank")} />}
                    {canSee("attendance.write", true) && <SubItem label="Yoklama Detay" active={active === "yoklama-detay"} onClick={go("/flexos/yoklama/detay")} />}
                    {canSee("attendance.report.read", false) && <SubItem label="Yoklama Raporu" active={active === "yoklama-raporu"} onClick={go("/flexos/yoklama/rapor")} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {/* Sertifikasyon — akordiyon: Sertifika Notu (grup bazlı not girişi) + Sertifika Ayarları. */}
        {canSee("grade.finalize", true) && (
          <>
            <a className="fs-navlink" style={sertifikaActive ? S.parentActive : S.navItem} onClick={() => { setSertifikaOpen((o) => !o); setEduOpen(false); setSalesOpen(false); setOdevOpen(false); setKullanicilarOpen(false); setAktiviteOpen(false); setYoklamaOpen(false); }}>
              <span style={{ display: "inline-flex", color: sertifikaActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.award }} />
              <span style={{ flex: 1 }}>Sertifikasyon</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: sertifikaOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {sertifikaOpen && (
                <motion.div
                  key="sertifika-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    <SubItem label="Sertifika Notu" active={active === "sertifika-notu"} onClick={go("/flexos/sertifikasyon/not")} />
                    <SubItem label="Sertifika Ayarları" active={active === "sertifika-ayarlari"} onClick={go("/flexos/sertifikasyon/ayarlar")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </nav>

      {/* ALT BÖLÜM — canlıdaki "Yönetim Paneli + Çıkış" deseniyle aynı: admin-only tek link
          (Sistem Ayarları) + ayraç + Çıkış.
          2026-07-11 kullanıcı isteği: Core'dayken (Görünüm Anahtarı sahibi eğitmen paketine
          düşünce role.manage'i kaybeder) Sistem Ayarları hiç görünmüyordu — sayfanın kendisi
          artık view.toggle sahibi için Core'da da açılıyor (bkz. sistem-ayarlari/page.tsx
          `allowed` gate'i + kendi içindeki "Görünüm Modu" switch'i), o yüzden link HER ZAMAN
          gerçek sayfaya gider (PIN'e sarmalamaya gerek yok, sayfa kendi PIN akışını içeriyor).
          Gerçek eğitmen (view.toggle'ı olmayan) bu linki hiç görmez.
          Bu blok yukarıdaki `if (!ready) return ...` sayesinde her zaman `ready===true`
          iken çalışır — ayrıca koşullamaya gerek yok. */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {(caps.has("role.manage") || canToggleView) && (
          <>
            <Item icon={IC.settings} label="Sistem Ayarları" active={active === "sistem-ayarlari"} onClick={go("/flexos/sistem-ayarlari")} />
            <div style={{ margin: "4px 8px", borderTop: "1px solid rgba(255,255,255,.1)" }} />
          </>
        )}
        <Item icon={IC.logout} label="Çıkış" onClick={handleLogout} />
      </div>

      <ViewPinModal open={pinOpen} onClose={() => setPinOpen(false)} onVerified={onPinVerified} />
    </aside>
  );
}

/** Öğrenci sidebar'ı da (StudentSidebar.tsx) BİREBİR aynı görsel dili kullanır — 2026-07-13
 *  kullanıcı kararı: "öğrencide eğitmendeki gibi olacak" (gradient, genişlik, Item stili). */
export function Item({ icon, label, onClick, active }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
  return (
    <a className="fs-navlink" style={active ? S.itemActive : S.navItem} onClick={onClick}>
      <span style={{ display: "inline-flex", color: active ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: icon }} />
      <span style={{ flex: 1 }}>{label}</span>
    </a>
  );
}

function SubItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <a className="fs-navlink" style={active ? S.subActive : S.subItem} onClick={onClick}>
      {active && <span style={S.subBar} />}
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "#fb923c" : "#5b7298", flex: "0 0 auto" }} />
      <span style={{ flex: 1 }}>{label}</span>
    </a>
  );
}

export const S: Record<string, CSSProperties> = {
  sidebar: { height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "9px 13px", borderRadius: 11, color: "#c3d1e6", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  parentActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "9px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  itemActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "9px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.2),rgba(249,115,22,.03))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.22)" },
  subItem: { position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "7px 13px", borderRadius: 10, color: "#c3d1e6", textDecoration: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  subActive: { position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "7px 13px", borderRadius: 10, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.22),rgba(249,115,22,.05))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.28)" },
  subBar: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: "0 3px 3px 0", background: "#fb923c" },
};

const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const IC = {
  home: sv('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  book: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  tag: sv('<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  award: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
  graduation: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
  clipboard: sv('<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
  trainer: sv('<path d="M14 22v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"/><path d="M18 14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2"/><circle cx="9" cy="9" r="3"/><path d="M17 21v-1a2 2 0 0 0-2-2"/>'),
  shield: sv('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
  chevDown: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke-width="2.3"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="15" height="15" stroke-width="2.3"'),
  activity: sv('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  barChart: sv('<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>'),
  settings: sv('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  logout: sv('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'),
  chat: sv('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
};

export const css = `
/* Responsive genişlik: küçük ekranda dar, büyükte kademeli geniş (canlının 320 sıçraması yok) */
.fs-sidebar{width:248px;flex:0 0 248px}
@media(min-width:1536px){.fs-sidebar{width:272px;flex-basis:272px}}
@media(min-width:2560px){.fs-sidebar{width:300px;flex-basis:300px}}
.fs-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
.fs-nav{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}
.fs-nav::-webkit-scrollbar{width:5px}
.fs-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
`;
