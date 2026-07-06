"use client";

/**
 * FlexOS · Sertifika Notu — Claude Design çıktısından (`Sertifika Notu Verme.dc.html`)
 * BİREBİR UI portu. `Grade` domain'i backend'e bağlandı (repo/servis/route/16
 * assertion — `grade-service.ts`): grup seçilince Sertifika Notu `GET /api/flexos/grades`
 * ile ön-dolduruluyor, "Taslak Kaydet" `POST /api/flexos/grades` ile kalıcı yazıyor
 * (gated `grade.write`). "Notları Gönder" (finalize/kilitleme) henüz YOK — o,
 * `Enrollment.result` snapshot'lamayı gerektiren ayrı bir iş (`grade.finalize`),
 * bu turda "yakında" toast'ı kalıyor. Ağırlık (Sertifika/Ödev %) artık SABİT
 * DEĞİL — `GET /api/flexos/certificate-settings`'ten okunuyor (Sertifika
 * Ayarları'ndan değişince buraya otomatik yansır). Grup/öğrenci listesi GERÇEK
 * veri — sahte veri yok.
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
import { Award, BookOpen, Check } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import type { RosterItem } from "../../siniflar/_shared/groupDisplay";

interface GroupItem { id: string; code: string; branch: string; enrolled: number; certType?: "exam" | "project" }

interface GradeDoc { personId: string; projectGrade?: number }
interface OdevKategori { totalMaxPuan: number; earnedByPerson: Record<string, number> }
interface OdevData { normal: OdevKategori; proje: OdevKategori }
interface Weighting { odevAktif: boolean; sertifikaPct: number }

const ODEV_KATEGORI_BOS: OdevKategori = { totalMaxPuan: 0, earnedByPerson: {} };
const ODEV_DATA_BOS: OdevData = { normal: ODEV_KATEGORI_BOS, proje: ODEV_KATEGORI_BOS };
// submission-service.ts::ODEV_TUR_AGIRLIK ile AYNI sabit — SABİT iş kuralı (2026-07-06).
const ODEV_TUR_AGIRLIK = { normal: 30, proje: 70 };

const GROUP_COLORS = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#1CB5AE", "#F91079"];
const AVATAR_PALETTES: [string, string][] = [
  ["#689adf", "#2867bd"], ["#F76FA3", "#F91079"], ["#67B5B6", "#1CB5AE"],
  ["#C79BF0", "#8B44D6"], ["#F9B36F", "#E8830F"], ["#7FCE8E", "#2E9E4A"],
];

function groupColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}
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

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/certificate-settings", { headers });
      if (res.ok) {
        const data = await res.json() as { project: Weighting; exam: Weighting };
        setSettings({ project: data.project, exam: data.exam });
      }
    })();
  }, []);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) {
        const data = await res.json() as { items: GroupItem[] };
        setGroups(data.items);
        if (data.items.length > 0) setSelectedId((cur) => cur ?? data.items[0].id);
      }
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoadingRoster(true);
      setSertifikaNotlari({});
      setOdevData(ODEV_DATA_BOS);
      try {
        const headers = await authHeaders();
        const [rosterRes, gradesRes] = await Promise.all([
          fetch(`/api/flexos/groups/${selectedId}/roster`, { headers }),
          fetch(`/api/flexos/grades?groupId=${selectedId}`, { headers }),
        ]);
        setRoster(rosterRes.ok ? (await rosterRes.json() as { items: RosterItem[] }).items : []);
        if (gradesRes.ok) {
          const { items, odev } = await gradesRes.json() as { items: GradeDoc[]; odev: OdevData };
          const prefilled: Record<string, string> = {};
          for (const g of items) {
            if (g.projectGrade != null) prefilled[g.personId] = String(g.projectGrade);
          }
          setSertifikaNotlari(prefilled);
          setOdevData(odev);
        }
      } finally {
        setLoadingRoster(false);
      }
    })();
  }, [selectedId]);

  function setSertifikaNotu(personId: string, raw: string) {
    setSertifikaNotlari((prev) => ({ ...prev, [personId]: clamp100(raw) }));
  }

  /**
   * Ödev Notu yüzdesi — hesaplanır, elle girilmez. `normal` %30 + `proje` %70
   * ağırlıklı (`submission-service.ts::combineOdevYuzdesi` ile AYNI formül).
   * Bir kategori hiç yoksa ağırlık diğerine kayar; ikisi de yoksa `null` (veri yok).
   */
  function odevYuzdesi(personId: string): number | null {
    const { normal, proje } = odevData;
    const normalOran = normal.totalMaxPuan > 0 ? (normal.earnedByPerson[personId] ?? 0) / normal.totalMaxPuan : null;
    const projeOran = proje.totalMaxPuan > 0 ? (proje.earnedByPerson[personId] ?? 0) / proje.totalMaxPuan : null;
    if (normalOran == null && projeOran == null) return null;
    if (normalOran == null) return Math.round(projeOran! * 100);
    if (projeOran == null) return Math.round(normalOran * 100);
    return Math.round(normalOran * ODEV_TUR_AGIRLIK.normal + projeOran * ODEV_TUR_AGIRLIK.proje);
  }

  const odevVerisiVarMi = odevData.normal.totalMaxPuan > 0 || odevData.proje.totalMaxPuan > 0;

  async function saveDraft() {
    if (!selectedId || roster.length === 0) return;
    setSaving(true);
    try {
      const entries = roster.map((r) => ({
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

  const selected = groups.find((g) => g.id === selectedId) ?? null;
  // Hangi ağırlık bloğu kullanılacak — grubun bağlı olduğu Education.certType belirler
  // (varsayılan "project"). Etiket HER ZAMAN "Sertifika Notu" — certType sadece ağırlığı seçer.
  const { odevAktif: odevAyarAktif, sertifikaPct } = settings[selected?.certType ?? "project"];
  // Grupta hiç ödev yoksa (veri yok) ayar açık olsa bile Ödev Notu hesaba KATILMAZ.
  const odevAktif = odevAyarAktif && odevVerisiVarMi;

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
  const gridCols = odevAktif ? "1.6fr 1fr 1fr 1fr 1fr" : "1.8fr 1.2fr 1.2fr 1.2fr";

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="sertifika-notu" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<Award size={20} color="#fff" />}
          title="Sertifika Notu"
          subtitle="Grup seçin, öğrencilere sertifika notu girin."
          roleLabel="Eğitmen"
        />

        <div style={{ padding: "26px 30px 48px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter">
          <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr", alignItems: "start" }}>

            {/* ===== SOL: Grup seçimi ===== */}
            <div className="bg-white border border-[#E2E5EA] rounded-[20px] p-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] sticky" style={{ top: 96 }}>
              <div className="flex items-center gap-[9px] mb-4">
                <div className="w-8 h-8 rounded-[10px] bg-[#DDE8F8] text-[#205297] flex items-center justify-center">
                  <BookOpen size={17} />
                </div>
                <div>
                  <div className="text-[14px] font-extrabold text-[#1E222B] tracking-tight">Gruplar</div>
                  <div className="text-[11px] text-[#8E95A3] font-medium">Not vermek için seçin</div>
                </div>
              </div>
              <div className="flex flex-col gap-[7px]">
                {loadingGroups ? (
                  <p className="text-[12px] text-[#8E95A3] py-4 text-center">Yükleniyor…</p>
                ) : groups.length === 0 ? (
                  <p className="text-[12px] text-[#8E95A3] py-4 text-center">Henüz grup yok.</p>
                ) : (
                  groups.map((g) => {
                    const active = g.id === selectedId;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setSelectedId(g.id)}
                        className="w-full flex items-center gap-[11px] py-[11px] px-3 rounded-[13px] cursor-pointer transition-all"
                        style={{
                          border: active ? "1px solid #AECBF2" : "1px solid #EEF0F3",
                          background: active ? "#EFF5FE" : "#fff",
                          boxShadow: active ? "0 4px 14px -8px rgba(32,82,151,.4)" : "none",
                        }}
                      >
                        <div className="rounded-full shrink-0" style={{ width: 4, alignSelf: "stretch", minHeight: 30, background: groupColor(g.id) }} />
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-[13.5px] font-extrabold text-[#1E222B] tracking-tight">{g.code}</div>
                          <div className="text-[11px] text-[#8E95A3] font-medium mt-0.5">{g.branch} • {g.enrolled} öğrenci</div>
                        </div>
                        {active && <Check size={16} strokeWidth={2.6} color="#205297" className="shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ===== SAĞ: Not tablosu ===== */}
            <div className="flex flex-col gap-4 min-w-0">

              {/* toolbar */}
              <div className="bg-white border border-[#E2E5EA] rounded-[18px] py-4 px-5 shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] flex items-center justify-between gap-4 flex-wrap">
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

              {/* table */}
              <div className="bg-white border border-[#E2E5EA] rounded-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-hidden">
                <div className="grid gap-3 items-center py-[15px] px-[22px] border-b border-[#EEF0F3] bg-[#FBFCFD]" style={{ gridTemplateColumns: gridCols }}>
                  <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Öğrenci</div>
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
                    return (
                      <div
                        key={r.personId}
                        className="grid gap-3 items-center py-[13px] px-[22px]"
                        style={{ gridTemplateColumns: gridCols, borderBottom: i < roster.length - 1 ? "1px solid #F2F4F7" : "none" }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-[13.5px] font-bold"
                            style={{ background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}
                          >
                            {initials(r.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-bold text-[#1E222B] truncate">{r.name}</div>
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <input
                            className="gradeInput w-[78px] text-center py-2 px-2 rounded-[10px] border border-[#E2E5EA] bg-white text-[14px] font-bold text-[#1E222B] outline-none"
                            type="number" min={0} max={100} placeholder="0-100"
                            value={sertifikaNotlari[r.personId] ?? ""}
                            onChange={(e) => setSertifikaNotu(r.personId, e.target.value)}
                          />
                        </div>
                        {odevAktif && (
                          <div className="flex justify-center">
                            <span
                              className="inline-flex items-center justify-center rounded-[10px] font-bold text-[14px]"
                              style={{ minWidth: 60, padding: "8px 10px", color: "#6F7B87", background: "#F7F8FA" }}
                              title="Grup içindeki tüm ödevlerden otomatik hesaplanır"
                            >
                              {odev == null ? "—" : `%${odev}`}
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
                      {saving ? "Kaydediliyor…" : "Taslak Kaydet"}
                    </button>
                    <button
                      onClick={() => toast.info("Bu özellik yakında.")}
                      className="inline-flex items-center gap-1.5 py-[11px] px-5 rounded-[11px] border-none text-white text-[13px] font-extrabold cursor-pointer transition-transform hover:-translate-y-0.5"
                      style={{ background: "linear-gradient(135deg,#1F9D57,#0E7A3E)", boxShadow: "0 10px 20px -8px rgba(14,122,62,.5)" }}
                    >
                      <Check size={16} strokeWidth={2.4} />
                      Notları Gönder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}
