"use client";

/**
 * FlexOS · Sertifika Notu — Claude Design çıktısından (`Sertifika Notu Verme.dc.html`)
 * BİREBİR UI portu. `Grade` domain'i backend'e bağlandı (repo/servis/route/16
 * assertion — `grade-service.ts`): grup seçilince Sertifika Notu `GET /api/flexos/grades`
 * ile ön-dolduruluyor, "Notu Kaydet" `POST /api/flexos/grades` ile kalıcı yazıyor
 * (gated `grade.write`). Ağırlık (Sertifika/Ödev %) SABİT DEĞİL — `GET /api/flexos/
 * certificate-settings`'ten okunuyor (Sertifika Ayarları'ndan değişince buraya otomatik
 * yansır). Grup/öğrenci listesi GERÇEK veri — sahte veri yok.
 *
 * **Kilit KİŞİ-bazlı, GRUP-genelinde DEĞİL (2026-07-08, kararla iki kez düzeltildi):**
 * ilk denemede grup-genelinde bir "Notları Gönder" (toplu kilitleme) butonu vardı —
 * kullanıcı düzeltti: "biz sertifika notlarını topluca girmiyoruz ki, biri bugün öteki
 * 6 ay sonra getiriyor" — grup-genelinde kilit YANLIŞ model. Doğrusu: kilidin tetikleyicisi
 * Eğitim Op'un o KİŞİYE özel "Sertifika Bastır" aksiyonu (henüz YOK, ayrı/ertelenmiş iş —
 * bkz. proje hafızası) — sadece o kişinin `Grade.locked` alanı true olur, roster'daki
 * diğerleri etkilenmez. `Enrollment.result` snapshot'lama da YOK (kullanıcı kararı: "notu
 * kaydet desek bile admin/yetkili düzenleyebilir" — ayrı bir donmuş/mezuniyet kaydı
 * gerekmiyor). Kilitliyken **assigned scope (eğitmen) o KİŞİYİ düzenleyemez** (`saveGrades`
 * o kaydı sessizce atlar, roster'daki DİĞERLERİNİ engellemez), **org scope (admin/yetkili)
 * her zaman düzenleyebilir**. Satırda yeşil onay tiki gösterilir (input GRİLEŞTİRİLMEZ,
 * sadece `readOnly` — kullanıcı: "silik falan olmasın, tik koyarız, eğitmen anlar süreç
 * tamamlanmış"), tıklanınca "Bu kişiye sertifikası basıldı..." bilgi toast'ı çıkar. Bugün
 * hiçbir `Grade.locked` true olamaz (tetikleyici Sertifika Bastır henüz yok) — mimari
 * hazır, gerçek kilitleme o özellik gelince devreye girecek.
 *
 * **`certType` (2026-07-06, DÜZELTME):** Eğitim katalogda "Sınav Bazlı"/"Proje Bazlı"
 * seçilir (`Education.certType`). Bu alanın adı HER ZAMAN "Sertifika Notu" kalır —
 * ayrı bir "Sınav Notu" kavramı YOK (kullanıcı kararı: sınav notu gelir, sertifika
 * notunu OLUŞTURUR; ileride sınav modülü de aynı `Grade.projectGrade` alanına yazacak).
 * `certType` yalnız HANGİ AĞIRLIK BLOĞUNUN (`CertificateSettings.project`/`.exam`)
 * kullanılacağını belirler — sınav bazlı branşta varsayılan Ödev Notu KAPALI (%100),
 * proje bazlıda AÇIK (%70/%30), ama Sertifika Ayarları'ndan ikisi de bağımsız
 * değiştirilebilir (certType hesaplamayı KISITLAMAZ, sadece varsayılanı belirler).
 *
 * **Ödev Notu ARTIK MANUEL DEĞİL (2026-07-06 kararı):** eski editable "Ödev Notu"
 * inputu ve `Grade.assignmentScore` alanı KALDIRILDI. Ödev Notu artık grup içindeki
 * TÜM yayınlanmış ödevlerin `maxPuan` toplamına (payda) karşı öğrencinin kazandığı
 * `Submission.grade` toplamının (pay) yüzdesi olarak OKUMA ANINDA hesaplanır
 * (`computeOdevYuzdeleri`, `submission-service.ts`) — `GET /api/flexos/grades`'in
 * `odev` alanından türetilir, salt-okunur rozet olarak gösterilir.
 *
 * **Ödev Notu'nun İÇ ağırlıklandırması (2026-07-06, ayrı karar):** ödevler `kind`'a
 * göre `normal`/`proje` diye ikiye ayrılır — normal ödevler %30, proje ödevler %70
 * ağırlıkla nihai Ödev Notu'na katkı yapar (`ODEV_TUR_AGIRLIK`, `submission-service.ts`
 * — bu SABİT bir iş kuralı, Sertifika Ayarları'ndaki dışsal Sertifika/Ödev ağırlığından
 * TAMAMEN AYRI bir eksen). Bir kategori hiç yoksa ağırlık diğerine tamamen kayar,
 * ikisi de yoksa (grupta hiç ödev yok) Ödev Notu toplam hesaba HİÇ girmez — sadece
 * Sertifika Notu esas alınır (`CertificateSettings` ağırlığı ne olursa olsun).
 * `odevYuzdesi()` burada `combineOdevYuzdesi()`'nin AYNI formülünü client-side
 * uyguluyor (saf/I/O'suz fonksiyon, tekrar yazmak import karmaşasından daha basit).
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Award, BookOpen, Check, ArrowLeft } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import type { RosterItem } from "../../siniflar/_shared/groupDisplay";
import { useRealtimeSync } from "../../_shared/useRealtimeSync";
import { GroupSelectPanel, groupColor, firstActiveGroupId } from "../_shared/GroupSelectPanel";
import { StudentDetailModal } from "../../ogrenciler/_shared/StudentDetailModal";
import { StudentDetailPanel } from "../../ogrenciler/_shared/StudentDetailPanel";

const PANEL_T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

interface GroupItem { id: string; code: string; branch: string; enrolled: number; certType?: "exam" | "project"; status?: string }

interface GradeDoc { personId: string; projectGrade?: number; locked?: boolean; components?: Record<string, number> }
interface OdevKategori { totalMaxPuan: number; earnedByPerson: Record<string, number> }
interface OdevData { normal: OdevKategori; proje: OdevKategori }
interface Weighting { odevAktif: boolean; sertifikaPct: number }

const ODEV_KATEGORI_BOS: OdevKategori = { totalMaxPuan: 0, earnedByPerson: {} };
const ODEV_DATA_BOS: OdevData = { normal: ODEV_KATEGORI_BOS, proje: ODEV_KATEGORI_BOS };
// submission-service.ts::ODEV_TUR_AGIRLIK ile AYNI sabit — SABİT iş kuralı (2026-07-06).
const ODEV_TUR_AGIRLIK = { normal: 30, proje: 70 };

const AVATAR_PALETTES: [string, string][] = [
  ["#689adf", "#2867bd"], ["#F76FA3", "#F91079"], ["#67B5B6", "#1CB5AE"],
  ["#C79BF0", "#8B44D6"], ["#F9B36F", "#E8830F"], ["#7FCE8E", "#2E9E4A"],
];

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toLocaleUpperCase("tr");
}
function clamp100(raw: string): string {
  if (raw === "") return "";
  const n = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
  return String(n);
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function SertifikaNotuPage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  // Bu sayfada AÇ/KAPA switch'i BİLEREK YOK — "Sertifika Ayarları"ndan yönetilir,
  // `CertificateSettings` kaydından okunur (gerçek backend, `certificate-settings-service.ts`).
  // İki blok birlikte gelir (`project`/`exam`); hangisinin kullanılacağı seçili grubun
  // `certType`'ına göre aşağıda `odevAktif`/`sertifikaPct` türetilirken belirlenir.
  const [settings, setSettings] = useState<{ project: Weighting; exam: Weighting }>({
    project: { odevAktif: true, sertifikaPct: 70 },
    exam: { odevAktif: false, sertifikaPct: 100 },
  });
  const [sertifikaNotlari, setSertifikaNotlari] = useState<Record<string, string>>({});
  const [odevData, setOdevData] = useState<OdevData>(ODEV_DATA_BOS);
  const [saving, setSaving] = useState(false);
  const [odevWarnOpen, setOdevWarnOpen] = useState(false);
  const [disablingOdev, setDisablingOdev] = useState(false);
  // Kilit KİŞİ-bazlı (2026-07-08 kararı, ileride "Sertifika Bastır" tetikleyecek — henüz
  // o özellik yok, bu yüzden `lockedByPerson` bugün her zaman boş çıkar ama mimari hazır):
  // roster gerçekte tek seferde değil kişi kişi doldurulur (biri bugün, öteki 6 ay sonra),
  // o yüzden kilit GRUP-genelinde değil sadece o kişiye özel. `canOverrideLock` (org
  // scope/yetkili) true ise kilit bu aktörü hiç bağlamaz.
  const [lockedByPerson, setLockedByPerson] = useState<Record<string, boolean>>({});
  const [canOverrideLock, setCanOverrideLock] = useState(false);
  // Geçmiş/backfill kayıtları için — `Grade.components.odevNotu` doluysa, canlı ödev/teslim
  // verisi olmayan (veya eksik) tarihi kayıtlarda ÖNCEDEN HESAPLANMIŞ yüzdeyi doğrudan
  // gösterir (2026-07-09, kullanıcı kararı: "sertifika not kısmında zaten hesaplanmış ödev
  // notları var, onu al"). Aktif/canlı gruplarda bu alan hiç dolmaz, davranış değişmez.
  const [odevNotuOverride, setOdevNotuOverride] = useState<Record<string, number>>({});

  // 2026-07-16 kullanıcı isteği: öğrenciye tıklayınca Öğrenci Bilgi açılır — eğitmen için
  // modal (Sınıflar'daki AYNI desen), admin/eğitim-op (`canOverrideLock` — bu sayfada zaten
  // var olan org-scope sinyali) için Yoklama Detay'daki "liste→detay" kayma paneli (aynısı).
  const [modalPersonId, setModalPersonId] = useState<string | null>(null);
  const [panelPersonId, setPanelPersonId] = useState<string | null>(null);
  const [showStudentPanel, setShowStudentPanel] = useState(false);
  const openStudent = (personId: string) => {
    if (canOverrideLock) { setPanelPersonId(personId); setShowStudentPanel(true); }
    else setModalPersonId(personId);
  };

  const loadSettings = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch("/api/flexos/certificate-settings", { headers });
    if (res.ok) {
      const data = await res.json() as { project: Weighting; exam: Weighting };
      setSettings({ project: data.project, exam: data.exam });
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // 2026-07-12 — Sertifika Ayarları'ndaki "Ödev Etkisi" değişince (başka sekme/kullanıcı
  // dahil) bu sayfa açıkken bile SSE üzerinden anında yeniden çekilir, yenileme gerekmez.
  useRealtimeSync(["settings.changed"], loadSettings);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) {
        const data = await res.json() as { items: GroupItem[] };
        setGroups(data.items);
        const defaultId = firstActiveGroupId(data.items);
        if (defaultId) setSelectedId((cur) => cur ?? defaultId);
      }
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı grup/eğitim ekleyip
  // düzenlediğinde SSE üzerinden haber alınır, grup listesi tekrar çekilir.
  useRealtimeSync(["groups.changed", "educations.changed"], loadGroups);

  const loadRosterAndGrades = useCallback(async () => {
    if (!selectedId) return;
    setLoadingRoster(true);
    setSertifikaNotlari({});
    setOdevData(ODEV_DATA_BOS);
    setLockedByPerson({});
    setCanOverrideLock(false);
    setOdevNotuOverride({});
    try {
      const headers = await authHeaders();
      const [rosterRes, gradesRes] = await Promise.all([
        fetch(`/api/flexos/groups/${selectedId}/roster`, { headers }),
        fetch(`/api/flexos/grades?groupId=${selectedId}`, { headers }),
      ]);
      setRoster(rosterRes.ok ? (await rosterRes.json() as { items: RosterItem[] }).items : []);
      if (gradesRes.ok) {
        const { items, odev, canOverrideLock: override } = await gradesRes.json() as { items: GradeDoc[]; odev: OdevData; canOverrideLock: boolean };
        const prefilled: Record<string, string> = {};
        const lockedMap: Record<string, boolean> = {};
        const odevOverrideMap: Record<string, number> = {};
        for (const g of items) {
          if (g.projectGrade != null) prefilled[g.personId] = String(g.projectGrade);
          if (g.locked) lockedMap[g.personId] = true;
          if (typeof g.components?.odevNotu === "number") odevOverrideMap[g.personId] = g.components.odevNotu;
        }
        setSertifikaNotlari(prefilled);
        setOdevData(odev);
        setLockedByPerson(lockedMap);
        setCanOverrideLock(override);
        setOdevNotuOverride(odevOverrideMap);
      }
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedId]);

  useEffect(() => { void loadRosterAndGrades(); }, [loadRosterAndGrades]);

  // 2026-07-12 — başka bir kullanıcı öğrenci ekleyip/kaydını değiştirdiğinde ya da not/
  // ödev notu girdiğinde SSE üzerinden haber alınır, roster+notlar tekrar çekilir.
  useRealtimeSync(["students.changed", "grades.changed"], loadRosterAndGrades);

  function setSertifikaNotu(personId: string, raw: string) {
    setSertifikaNotlari((prev) => ({ ...prev, [personId]: clamp100(raw) }));
  }

  /**
   * Ödev Notu yüzdesi — hesaplanır, elle girilmez. `normal` %30 + `proje` %70
   * ağırlıklı (`submission-service.ts::combineOdevYuzdesi` ile AYNI formül).
   * Bir kategori hiç yoksa ağırlık diğerine kayar; ikisi de yoksa `null` (veri yok).
   *
   * 2026-07-16 GERÇEK BUG (Grup 330, İlayda Arslanoğlu — canlı veriyle kanıtlandı):
   * `odevNotuOverride` (backfill script'inin 2026-07-09'da bıraktığı ESKİ snapshot,
   * `Grade.components.odevNotu`) grup GERÇEK canlı ödev/teslim verisine sahip olsa
   * BİLE koşulsuz önceliklendiriliyordu — öğrenci 8 ödevin hepsinden 100 alsa da
   * (gerçek hesap %100) eski %80 snapshot'ı gösteriliyordu (24 puan yerine 30 olması
   * gerekiyordu). Override SADECE grupta hiç canlı ödev/teslim izi yoksa (tamamen
   * migrasyon verisi, dijital iz yok) kullanılmalı — grupta gerçek `Assignment` varsa
   * güncel hesap her zaman kazanmalı.
   */
  function odevYuzdesi(personId: string): number | null {
    const { normal, proje } = odevData;
    const hasLiveData = normal.totalMaxPuan > 0 || proje.totalMaxPuan > 0;
    if (!hasLiveData && personId in odevNotuOverride) return odevNotuOverride[personId];
    const normalOran = normal.totalMaxPuan > 0 ? (normal.earnedByPerson[personId] ?? 0) / normal.totalMaxPuan : null;
    const projeOran = proje.totalMaxPuan > 0 ? (proje.earnedByPerson[personId] ?? 0) / proje.totalMaxPuan : null;
    if (normalOran == null && projeOran == null) return null;
    if (normalOran == null) return Math.round(projeOran! * 100);
    if (projeOran == null) return Math.round(normalOran * 100);
    return Math.round(normalOran * ODEV_TUR_AGIRLIK.normal + projeOran * ODEV_TUR_AGIRLIK.proje);
  }

  const selected = groups.find((g) => g.id === selectedId) ?? null;
  // Hangi ağırlık bloğu kullanılacak — grubun bağlı olduğu Education.certType belirler
  // (varsayılan "project"). Etiket HER ZAMAN "Sertifika Notu" — certType sadece ağırlığı seçer.
  // 2026-07-08 kararı: ayar açıksa (odevAktif) kolon HER ZAMAN görünür ve hesaba katılır —
  // bir öğrencinin KENDİ ödevi yoksa `odevYuzdesi` onun için `null`→0 sayılır (haklı ceza,
  // "ödev yapmadı" anlamına gelir). Ama GRUBUN TAMAMINDA hiç ödev notu girilmemişse
  // (`odevVerisiVarMi` false) bu 0'lar YANLIŞ bir sinyal olabilir — eğitmen ayarı yanlışlıkla
  // açık unutmuş/hiç ödev vermemiş olabilir; bu durumda `saveDraft` sessizce 0'layıp
  // kaydetmek yerine uyarı modalı açar (aşağıda).
  const { odevAktif, sertifikaPct } = settings[selected?.certType ?? "project"];
  const odevVerisiVarMi = odevData.normal.totalMaxPuan > 0 || odevData.proje.totalMaxPuan > 0 || Object.keys(odevNotuOverride).length > 0;

  async function performSaveDraft() {
    setSaving(true);
    try {
      const entries = roster
        .filter((r) => canOverrideLock || !lockedByPerson[r.personId]) // kilitliyi client'ta da gönderme (server zaten atlar)
        .map((r) => ({
          enrollmentId: r.enrollmentId,
          personId: r.personId,
          projectGrade: sertifikaNotlari[r.personId] ? Number(sertifikaNotlari[r.personId]) : null,
        }));
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/grades", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedId, entries }),
      });
      if (res.ok) toast.success("Taslak kaydedildi.");
      else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Kaydedilemedi.");
      }
    } catch {
      toast.error("Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  function saveDraft() {
    if (!selectedId || roster.length === 0) return;
    // Ayar açık ama bu grupta HİÇ KİMSEDE ödev notu yoksa — muhtemelen yanlışlıkla açık
    // unutulmuş, sessizce herkesi 0'layıp kaydetme; eğitmene sor.
    if (odevAktif && !odevVerisiVarMi) { setOdevWarnOpen(true); return; }
    void performSaveDraft();
  }

  async function disableOdevNotu() {
    if (!selected) return;
    setDisablingOdev(true);
    try {
      const certType = selected.certType ?? "project";
      const nextSettings = { ...settings, [certType]: { ...settings[certType], odevAktif: false } };
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/certificate-settings", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      if (res.ok) {
        setSettings(nextSettings);
        toast.success("Ödev Notu ayarı devre dışı bırakıldı.");
        setOdevWarnOpen(false);
      } else {
        toast.error("Ayar güncellenemedi.");
      }
    } finally {
      setDisablingOdev(false);
    }
  }

  function computeTotal(personId: string): number | null {
    const s = sertifikaNotlari[personId] === "" || sertifikaNotlari[personId] == null ? null : Number(sertifikaNotlari[personId]);
    if (odevAktif) {
      if (s == null) return null;
      const o = odevYuzdesi(personId) ?? 0;
      return Math.round((s * sertifikaPct + o * (100 - sertifikaPct)) / 100);
    }
    return s == null ? null : Math.round(s);
  }

  const odevPct = 100 - sertifikaPct;
  const girilenCount = roster.filter((r) => computeTotal(r.personId) != null).length;
  // Diğer kolonlar SABİT genişlikte (px) — sadece "Öğrenci" (1fr) esnek. Eskiden hepsi
  // `fr` idi: Ödev Notu kolonu kapanınca kalan kolonlar orantılı büyüyüp küçük input/rozet
  // kutularının etrafında büyük boşluklar bırakıyordu ("boşluk" şikayeti, 2026-07-08).
  // Şimdi Ödev Notu açılıp kapansa da diğer kolonların genişliği DEĞİŞMİYOR, sadece
  // "Öğrenci" kolonu boşalan/dolan alanı alıyor.
  // "Öğrenci" kolonu ASLA `0`'a küçülmez — `minmax(0,1fr)` idi, dar ekranlarda diğer sabit
  // kolonlar sıkıştırınca isim 2-3 harfe kadar kesiliyordu (2026-07-09 bug). Artık 170px
  // TABAN var, isim asla ezilmeyecek. Sertifika Notu'ndan başlayan blok isme fazla yakın
  // duruyordu — 16px'lik boş spacer kolon bu bloğu sağa kaydırıyor. Son kolon (Srtf. onay
  // tiki) her zaman EN SONDA, GÖRÜNÜR kalmalı (2026-07-09, "Srtf kayboldu" şikayeti — bir
  // önceki denemede toplam genişlik bütçesi ekran genişliğini aşıp son kolonu görünür
  // alanın dışına itmişti) — bu yüzden toplam sabit genişlik+gap bütçesi kasıtlı DAR
  // tutuldu, `overflow-x-auto` sadece son çare (aşırı dar ekran) güvenlik ağı.
  const gridCols = odevAktif ? "minmax(170px,1fr) 16px 100px 100px 84px 150px 36px" : "minmax(170px,1fr) 16px 100px 84px 150px 36px";

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="sertifika-notu" />
      <main style={{ flex: 1, height: "100%", overflow: "hidden", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<Award size={20} color="#fff" />}
          title="Sertifika Notu"
          subtitle="Grup seçin, öğrencilere sertifika notu girin."
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
          left={showStudentPanel ? (
            <div className="flex items-center gap-[15px]">
              <button
                onClick={() => setShowStudentPanel(false)}
                className="w-[46px] h-[46px] rounded-[13px] flex items-center justify-center cursor-pointer shrink-0"
                style={{ background: "linear-gradient(135deg,#2867bd,#205297)", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}
              >
                <ArrowLeft size={21} color="#fff" />
              </button>
              <div>
                <h1 className="m-0 text-[18px] font-extrabold tracking-tight text-[#1E222B]">Öğrenci Bilgisi</h1>
                <p className="m-0 mt-0.5 text-[12px] text-[#6F7B87] font-medium">Sertifika Notu / Profil</p>
              </div>
            </div>
          ) : undefined}
        />

        {/* `panelArea` — Yoklama Detay'daki (`yoklama/detay/page.tsx`) AYNI "liste↔detay
            kayması" deseni: sidebar/header sabit, sadece bu alan içindeki iki panel kayar. */}
        <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
          <motion.div initial={false} animate={{ x: showStudentPanel ? "-100%" : 0 }} transition={PANEL_T}
            className="absolute inset-0 flex flex-col overflow-hidden">
            {/* İçerik satırı (2026-07-16): header'ın ALTINDA, footer'ın ÜSTÜNDE — Gruplar
                paneli SADECE bu satırın yüksekliği kadar (üstten sağdaki toolbar'la aynı
                hizada, alttan footer'dan önce biter), 100vh DEĞİL. Satır kendi sabit
                yüksekliğine (`flex:1` + `minHeight:0` + `overflow:hidden`) sahip; SOL
                (Gruplar) hiç kaymaz, SAĞ kendi `overflow-y-auto`'suyla bağımsız kayar. */}
            <div
              className={`${FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS} flex`}
              style={{ margin: "0 auto", boxSizing: "border-box", flex: 1, minHeight: 0, overflow: "hidden", padding: "26px 0 32px", gap: 20 }}
            >
          <GroupSelectPanel
            groups={groups} loading={loadingGroups} selectedId={selectedId} onSelect={setSelectedId}
            subtitle="Not vermek için seçin"
          />

          <div className="flex-1 min-w-0 h-full min-h-0 flex flex-col gap-4 font-inter">

              {/* toolbar — sabit, KAYMIYOR (2026-07-16: sticky değil, scroll'un tamamen
                  dışında — sadece aşağıdaki tablo kutusu kayıyor). `shrink-0` ŞART
                  (aynı gün bulunan gerçek bug): flex-col kapsayıcıda varsayılan
                  flex-shrink:1 yüzünden bu kutu sıkışıp küçülüyordu. */}
              <div className="bg-white border border-[#E2E5EA] rounded-[18px] py-4 px-5 shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] flex items-center justify-between gap-4 flex-wrap shrink-0">
                <div className="flex items-center gap-[13px] min-w-0">
                  <div className="rounded-full shrink-0" style={{ width: 5, alignSelf: "stretch", minHeight: 40, background: selected ? groupColor(selected.id) : "#CDD2DA" }} />
                  <div>
                    <div className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">{selected?.code ?? "—"}</div>
                    <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{selected ? `${selected.branch} • ${roster.length} öğrenci` : ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                  <div className="flex items-center gap-2 py-2 px-[13px] rounded-[11px] bg-[#F7F8FA] border border-[#EEF0F3]">
                    <span className="text-[11px] font-bold text-[#6F7B87]">Ağırlık</span>
                    <span className="text-[12px] font-extrabold text-[#205297]">{odevAktif ? `Sertifika %${sertifikaPct} · Ödev %${odevPct}` : "Sertifika %100"}</span>
                  </div>
                </div>
              </div>

              {/* table — TEK kayan alan, toolbar'dan bağımsız */}
              <div className="bg-white border border-[#E2E5EA] rounded-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-y-auto overflow-x-auto flex-1 min-h-0">
                <div className="grid gap-6 items-center py-[15px] px-[22px] border-b border-[#EEF0F3] bg-[#FBFCFD]" style={{ gridTemplateColumns: gridCols }}>
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Öğrenci</div>
                  <div aria-hidden />
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">
                    Sertifika Notu<br /><span className="text-[10px] font-semibold normal-case text-[#AEB4C0]">{odevAktif ? `%${sertifikaPct}` : "%100"}</span>
                  </div>
                  {odevAktif && (
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">
                      Ödev Notu (otomatik)<br /><span className="text-[10px] font-semibold normal-case text-[#AEB4C0]">{`%${odevPct}`}</span>
                    </div>
                  )}
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Toplam Not</div>
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-left">Durum</div>
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center" title="Sertifikası basılmış öğrenciler kilitli olarak işaretlenir">Srtf.</div>
                </div>

                {loadingRoster ? (
                  <div className="py-10 text-center text-[13px] text-[#8E95A3]">Yükleniyor…</div>
                ) : roster.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[#8E95A3]">Bu grupta öğrenci yok.</div>
                ) : (
                  roster.map((r, i) => {
                    const total = computeTotal(r.personId);
                    const bos = total == null;
                    const gecti = !bos && total >= 50;
                    const pal = AVATAR_PALETTES[i % AVATAR_PALETTES.length];
                    let durumLabel = "", durumColor = "", durumBg = "", dotColor = "";
                    if (!bos && gecti) {
                      if (total >= 90) { durumLabel = "Başarı Srtf."; durumColor = "#007A30"; durumBg = "#E6F5ED"; dotColor = "#009F3E"; }
                      else { durumLabel = "Katılım Srtf."; durumColor = "#205297"; durumBg = "#DDE8F8"; dotColor = "#3A7BD5"; }
                    }
                    const odev = odevYuzdesi(r.personId);
                    const rowLocked = lockedByPerson[r.personId] === true;
                    const rowReadOnly = rowLocked && !canOverrideLock;
                    return (
                      <div
                        key={r.personId}
                        className="grid gap-6 items-center py-[13px] px-[22px]"
                        style={{ gridTemplateColumns: gridCols, borderBottom: i < roster.length - 1 ? "1px solid #F2F4F7" : "none" }}
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 cursor-pointer group w-fit"
                          onClick={() => openStudent(r.personId)}
                        >
                          <span
                            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-[13.5px] font-bold"
                            style={{ background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}
                          >
                            {initials(r.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-bold text-[#1E222B] truncate group-hover:text-[#205297] transition-colors">{r.name}</div>
                          </div>
                        </div>
                        <div aria-hidden />
                        <div className="flex justify-center">
                          <input
                            className="gradeInput w-[78px] text-center py-2 px-2 rounded-[10px] border border-[#E2E5EA] bg-white text-[14px] font-bold text-[#1E222B] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            type="number" min={0} max={100} placeholder="0-100"
                            value={sertifikaNotlari[r.personId] ?? ""}
                            onChange={(e) => setSertifikaNotu(r.personId, e.target.value)}
                            readOnly={rowReadOnly}
                            onClick={() => { if (rowReadOnly) toast.info("Bu kişiye sertifikası basıldı, bu nedenle not artık girilemez."); }}
                            style={rowReadOnly ? { cursor: "not-allowed" } : undefined}
                          />
                        </div>
                        {odevAktif && (
                          <div className="flex justify-center">
                            <span
                              className="inline-flex items-center justify-center rounded-[10px] border border-[#E2E5EA] bg-white font-bold text-[14px] text-[#1E222B]"
                              style={{ minWidth: 60, padding: "8px 10px" }}
                              title="Grup içindeki tüm ödevlerden otomatik hesaplanır (canlıdaki gibi ağırlıklı puan, yüzde değil)"
                            >
                              {Math.round(((odev ?? 0) * odevPct) / 100)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-center">
                          <span
                            className="inline-flex items-center justify-center rounded-[10px] font-extrabold"
                            style={{
                              minWidth: 48, padding: "7px 12px", fontSize: 15, letterSpacing: "-.3px",
                              color: bos ? "#AEB4C0" : gecti ? "#007A30" : "#C22B2B",
                              background: bos ? "#F7F8FA" : gecti ? "#E6F5ED" : "#FDE1E1",
                            }}
                          >
                            {bos ? "—" : total}
                          </span>
                        </div>
                        <div className="flex items-center justify-start">
                          {durumLabel ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap" style={{ padding: "4px 12px", color: durumColor, background: durumBg }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                              {durumLabel}
                            </span>
                          ) : (
                            <span className="w-[22px] h-[3px] rounded-[2px] bg-[#CDD2DA] shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          {rowLocked && (
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center bg-[#E6F5ED] text-[#009F3E] shrink-0"
                              title="Sertifikası basıldı — bu kişinin notu tamamlandı, artık girilemez"
                            >
                              <Check size={13} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="flex items-center justify-between gap-4 py-4 px-[22px] border-t border-[#EEF0F3] bg-[#FBFCFD] flex-wrap">
                  <div className="text-[12.5px] text-[#6F7B87] font-semibold">{girilenCount} / {roster.length} öğrenciye not girildi</div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={saveDraft}
                      disabled={saving || roster.length === 0}
                      className="py-[11px] px-[18px] rounded-[11px] border border-[#E2E5EA] bg-white text-[#414B59] text-[13px] font-bold cursor-pointer hover:bg-[#F7F8FA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Kaydediliyor…" : "Notu Kaydet"}
                    </button>
                  </div>
                </div>
              </div>
          </div>
            </div>
          </motion.div>

          <motion.div initial={false} animate={{ x: showStudentPanel ? 0 : "100%" }} transition={PANEL_T}
            className="absolute inset-0 overflow-y-auto bg-[#EEF0F3]">
            <StudentDetailPanel personId={panelPersonId} className="font-inter pt-6 pb-8" />
          </motion.div>
        </div>

        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>

      {modalPersonId && <StudentDetailModal personId={modalPersonId} onClose={() => setModalPersonId(null)} />}

      {odevWarnOpen && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-base-primary-900/40 backdrop-blur-md" onClick={() => setOdevWarnOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
              <BookOpen size={26} className="text-orange-500" />
            </div>
            <div>
              <p className="text-[16px] font-bold text-[#1E222B] mb-1.5">Bu grupta hiç ödev notu verilmemiş</p>
              <p className="text-[13px] text-[#6F7B87] leading-relaxed">
                Eğer ödev vermediyseniz ya da ödev notunun sertifika puanı hesabında kullanılmasını
                istemiyorsanız lütfen Ödev Notu ayarını devre dışı bırakın.
              </p>
            </div>
            <div className="flex gap-2.5 w-full mt-2">
              <button
                onClick={() => setOdevWarnOpen(false)}
                className="flex-1 h-11 rounded-xl border border-[#E2E5EA] text-[13px] font-bold text-[#414B59] hover:bg-[#F7F8FA] transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={disableOdevNotu}
                disabled={disablingOdev}
                className="flex-1 h-11 rounded-xl text-white text-[13px] font-bold cursor-pointer disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)" }}
              >
                {disablingOdev ? "Kaydediliyor…" : "Devre Dışı Bırak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
