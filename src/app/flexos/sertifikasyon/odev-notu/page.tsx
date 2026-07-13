"use client";

/**
 * FlexOS · Ödev Notu — Claude Design çıktısından (`Ödev Notu Verme.dc.html`) BİREBİR
 * UI portu. İki görünüm: (1) grup seç + ödev listesi (durum özeti), (2) seçili ödev
 * için öğrenci bazlı puanlama (teslim durumu + gecikme cezası + net puan).
 *
 * Sidebar konumu (2026-07-08 kararı): eski ölü "Ödev Değerlendirme" linki KALDIRILDI —
 * "Ödev Değerlendirme" zaten bu ekranın kendisi, o yüzden bu sayfa Sertifikasyon
 * menüsünden "Ödevler" akordiyonuna TAŞINDI (bkz. `FlexSidebar.tsx`). URL değişmedi.
 *
 * **2026-07-06 kararı — PER-ASSIGNMENT gerçek saklama:** "Notları Kaydet" her
 * öğrencinin net puanını DOĞRUDAN o öğrencinin `Submission.grade` alanına yazar
 * (`PATCH /api/flexos/submissions/[id]/grade`, gated `submission.grade`) — eskiden
 * `Grade.assignmentScore`'a (enrollment başına TEK alan) yazılıyordu, bu birden fazla
 * ödevin birbirinin üzerine yazmasına sebep oluyordu; o kısıt ORTADAN KALKTI. Her
 * ödevin kendi `maxPuan`'ı var (100/200/300 gibi, `Assignment.maxPuan`, girilmemişse
 * 100). **Sertifika Notu'ndaki Ödev Notu BURADAN OTOMATİK HESAPLANIR**
 * (`computeOdevYuzdeleri`, `submission-service.ts`) — grup içindeki TÜM yayınlanmış
 * ödevlerin `maxPuan` toplamı payda, kazanılan puan toplamı pay; bir öğrencinin
 * notlanmamış/teslim etmediği ödev payda'ya girer ama pay'a katkı YAPMAZ (0 sayılır),
 * yani ortalamayı düşürür — hariç TUTULMAZ.
 *
 * **2026-07-08 kararı — taban puan artık HİÇ elle girilmiyor:** eski serbest "Ödev
 * Puanı" input'u (0-`maxPuan` arası elle yazılan sayı) TAMAMEN KALDIRILDI. Taban puan
 * HER ZAMAN `Assignment.maxPuan` — net puan = `maxPuan × (1 − gecikme cezası%)`
 * (`CEZA_ORANI`: teslim=%0, 1 hafta=%10, 2 hafta+=%20, teslim etmedi=%100→0 puan).
 * Teslim durumu gerçek `Submission`'dan ön-doluyor (var olan teslim → "Teslim etti",
 * yoksa "Teslim etmedi") — eğitmen SADECE istisnai durumlar (tatil/mazeret gecikmesi
 * vb.) için durumu elle düzeltebilir, kullanıcı kararı: "sonradan gerekirse
 * düzeltebileyim". Sadece GERÇEK teslimi olan öğrenci notlandırılabilir (teslim yoksa
 * puanlanacak `Submission` dokümanı da yok).
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Award, BookOpen, Check, ArrowLeft, ClipboardList, ChevronRight, Clock, Loader2 } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import type { RosterItem } from "../../siniflar/_shared/groupDisplay";
import { useRealtimeSync } from "../../_shared/useRealtimeSync";

interface GroupItem { id: string; code: string; branch: string; enrolled: number }
interface AssignmentItem { id: string; title: string; dueDate?: string; status: string; maxPuan?: number; kind?: "normal" | "proje" }
interface SubmissionRow { id: string; personId: string; status: string; grade?: number; submittedAt: string; isLate: boolean }

/** Teslim durumunu GERÇEK teslim zamanından otomatik türetir — `Submission.isLate` +
 * `submittedAt` ile `Assignment.dueDate` arasındaki gün farkına göre 1/2+ hafta kademesi
 * belirlenir (2026-07-08 kararı: eskiden HERHANGİ bir teslim varsa körlemesine "teslim etti"
 * yazılıyordu, gerçek gecikme hiç hesaba katılmıyordu). */
function durumFromSubmission(sub: SubmissionRow | undefined, dueDate?: string): TeslimDurum {
  if (!sub) return "yok";
  if (!sub.isLate || !dueDate) return "teslim";
  const diffDays = Math.ceil((new Date(sub.submittedAt).getTime() - new Date(dueDate).getTime()) / 86400000);
  return diffDays > 7 ? "gec2" : "gec1";
}

type TeslimDurum = "teslim" | "gec1" | "gec2" | "yok";
/** Taban puan artık BURADA girilmiyor — her zaman `Assignment.maxPuan` (2026-07-08 kararı,
 * eski serbest "puan" alanı KALDIRILDI). Tek değişken teslim durumu; net puan = maxPuan × (1 − ceza%). */
interface StudentGradeState { durum: TeslimDurum }

const CEZA_ORANI: Record<TeslimDurum, number> = { teslim: 0, gec1: 0.10, gec2: 0.20, yok: 1 };
const DURUM_META: Record<TeslimDurum, { label: string; color: string; bg: string; dot: string }> = {
  teslim: { label: "Teslim etti", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" },
  gec1: { label: "1 hafta gecikmeli", color: "#8A5A00", bg: "#FFF3DC", dot: "#FFB020" },
  gec2: { label: "2 hafta+ gecikmeli", color: "#C2410C", bg: "#FFEAD7", dot: "#F97316" },
  yok: { label: "Teslim etmedi", color: "#C22B2B", bg: "#FDE1E1", dot: "#E53935" },
};

const GROUP_COLORS = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#1CB5AE", "#F91079"];
// Öğrenci avatarları — ÖNCEDEN 2 renkli gradyan (AVATAR_PALETTES) kullanıyordu, kullanıcı
// tek renk + sistem paletinden (GROUP_COLORS'la AYNI 6 renk) istedi (2026-07-11 kararı).
function groupColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}
function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toLocaleUpperCase("tr");
}
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

// ── Dummy veri — kullanıcı isteği: gerçek veri yok/boşken (veya Firestore
// bağlantı sorununda) sayfayı görsel olarak deneyebilmek için. Gerçek veri
// varsa hiç kullanılmaz (sadece boş/hatalı yanıtta devreye girer). ──
const DUMMY_GROUPS: GroupItem[] = [
  { id: "dummy-grp-01", code: "GRP-01", branch: "Grafik Tasarım", enrolled: 7 },
  { id: "dummy-grp-02", code: "GRP-02", branch: "Yazılım", enrolled: 6 },
  { id: "dummy-grp-03", code: "GRP-03", branch: "Veri Bilimi", enrolled: 5 },
  { id: "dummy-grp-04", code: "GRP-04", branch: "İngilizce", enrolled: 8 },
];

const DUMMY_ASSIGNMENTS_BY_BRANCH: Record<string, { title: string; dueDate: string }[]> = {
  "Grafik Tasarım": [
    { title: "Kolaj Ödevi", dueDate: "2026-07-12" },
    { title: "Kitap Kapak Ödevi", dueDate: "2026-07-19" },
    { title: "Poster Ödevi", dueDate: "2026-07-26" },
    { title: "Logo Tasarım Ödevi", dueDate: "2026-08-02" },
  ],
  "Yazılım": [
    { title: "Algoritma Ödevi", dueDate: "2026-07-12" },
    { title: "API Projesi", dueDate: "2026-07-20" },
    { title: "Final Projesi", dueDate: "2026-07-28" },
  ],
  "Veri Bilimi": [
    { title: "Veri Temizleme Ödevi", dueDate: "2026-07-14" },
    { title: "Görselleştirme Ödevi", dueDate: "2026-07-22" },
    { title: "Model Projesi", dueDate: "2026-07-30" },
  ],
  "İngilizce": [
    { title: "Essay Ödevi", dueDate: "2026-07-15" },
    { title: "Sunum Ödevi", dueDate: "2026-07-23" },
  ],
};

const DUMMY_NAMES_BY_GROUP: Record<string, string[]> = {
  "dummy-grp-01": ["Mert Yılmaz", "Zeynep Kaya", "Ali Demir", "Selin Arslan", "Burak Şen", "Naz Güler", "Emre Çelik"],
  "dummy-grp-02": ["Buse Kara", "Tolga Arslan", "Elif Doğan", "Kaan Öztürk", "İrem Güneş", "Deniz Koç"],
  "dummy-grp-03": ["Yusuf Polat", "Merve Şahin", "Ceren Aydın", "Onur Taş", "Pelin Ak"],
  "dummy-grp-04": ["Ece Yıldız", "Barış Er", "Sude Çetin", "Mert Can", "Gizem Ünal", "Ahmet Yüce", "Leyla Bulut", "Kerem Ay"],
};

function dummyAssignmentsFor(group: GroupItem): AssignmentItem[] {
  const list = DUMMY_ASSIGNMENTS_BY_BRANCH[group.branch] ?? [];
  return list.map((a, i) => ({ id: `${group.id}-odev-${i}`, title: a.title, dueDate: a.dueDate, status: "published" }));
}

function dummyRosterFor(groupId: string): RosterItem[] {
  const names = DUMMY_NAMES_BY_GROUP[groupId] ?? [];
  return names.map((name, i) => ({
    enrollmentId: `${groupId}-enr-${i}`,
    personId: `${groupId}-p${i}`,
    name,
    email: "",
    phone: "",
    isOnlineStudent: false,
    assignedAt: new Date().toISOString(),
  }));
}

export default function OdevNotuPage() {
  // Ödev Parkuru "Not Ver"den deep-link — 2026-07-11 kullanıcı bulgusu: önceden bu sayfa
  // parametresiz açılıyordu, eğitmen grubu/ödevi elle tekrar bulup seçmek zorunda kalıyordu.
  const searchParams = useSearchParams();
  const deepLinkGroupId = searchParams.get("groupId");
  const deepLinkAssignmentId = searchParams.get("assignmentId");
  const [autoOpened, setAutoOpened] = useState(false);
  // 2026-07-12 fix: `loadingGroups`/`loadingAssignments` her biri AYRI bir render/effect
  // turunda false olur — aradaki commit'te ikisi de false olabildiği an VIEW 1 (gruplar
  // listesi) gerçek veriyle bir kare/an için görünüp hemen otomatik-açılışla kayboluyordu
  // ("gruplar göründü, boşaldı, başka sayfaya gitti gibi oldu"). Bu flag deep-link'in TÜM
  // adımları (grup yükle → ödev+roster yükle → aç) boyunca aralıksız true kalır, sadece
  // hedef bulunamayınca (geçersiz/silinmiş link) elle false'a çekilir.
  const [deepLinkPending, setDeepLinkPending] = useState(!!deepLinkAssignmentId);

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [loadingGrading, setLoadingGrading] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  // Son kaydetme başarılıydı ve o zamandan beri hiçbir not değiştirilmedi mi — buton
  // rengi/metni bunu yansıtır (2026-07-12 kullanıcı isteği: mavi "Notları Kaydet" →
  // kaydedince yeşil "Notlar Kaydedildi").
  const [justSaved, setJustSaved] = useState(false);
  // assignmentId -> (personId -> state) — her ödev için ayrı, sekmeler arası korunur
  const [gradesByAssignment, setGradesByAssignment] = useState<Record<string, Record<string, StudentGradeState>>>({});
  // assignmentId -> (personId -> submissionId) — "Notları Kaydet" hangi Submission'a
  // yazacağını buradan bulur (teslim yoksa kişi bu haritada yoktur, notlanamaz).
  const [submissionIdsByAssignment, setSubmissionIdsByAssignment] = useState<Record<string, Record<string, string>>>({});

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      const items = res.ok ? (await res.json() as { items: GroupItem[] }).items : [];
      const finalItems = items.length > 0 ? items : DUMMY_GROUPS;
      setGroups(finalItems);
      const deepLinkMatch = deepLinkGroupId && finalItems.some((g) => g.id === deepLinkGroupId) ? deepLinkGroupId : null;
      setSelectedGroupId((cur) => cur ?? deepLinkMatch ?? finalItems[0]?.id ?? null);
    } catch {
      setGroups(DUMMY_GROUPS);
      setSelectedGroupId((cur) => cur ?? DUMMY_GROUPS[0].id);
    } finally {
      setLoadingGroups(false);
    }
  }, [deepLinkGroupId]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı grup/eğitim ekleyip
  // düzenlediğinde SSE üzerinden haber alınır, grup listesi tekrar çekilir. (Deep-link
  // auto-open state'i kırılgan olduğu için ödev/roster effect'i kasıtlı olarak buraya
  // bağlanmadı — bu sayfa zaten notun GİRİLDİĞİ ekran, pasif tüketici değil.)
  useRealtimeSync(["groups.changed", "educations.changed"], loadGroups);

  useEffect(() => {
    if (!selectedGroupId) return;
    setActiveAssignmentId(null);
    (async () => {
      setLoadingAssignments(true);
      try {
        const headers = await authHeaders();
        const [assignRes, rosterRes] = await Promise.all([
          fetch(`/api/flexos/assignments?groupId=${selectedGroupId}`, { headers }),
          fetch(`/api/flexos/groups/${selectedGroupId}/roster`, { headers }),
        ]);
        const assignItems = assignRes.ok ? (await assignRes.json() as { items: AssignmentItem[] }).items : [];
        const rosterItems = rosterRes.ok ? (await rosterRes.json() as { items: RosterItem[] }).items : [];
        // 2026-07-13 fix: GERÇEK veri kullanılır — eskiden ödevi olmayan grupta sahte
        // `dummyAssignmentsFor` demo ödevleri gösteriliyordu (kullanıcı bug'ı: yeni açılan
        // gerçek Grup 784, DB'de 0 ödevi varken 4 uydurma ödev gösteriyordu). Boşsa boş.
        setAssignments(assignItems);
        setRoster(rosterItems);
        // Deep-link: doğru grup + doğru ödev yüklendiyse puanlama ekranını OTOMATİK aç
        // (sadece ilk deep-link'te — sonraki manuel grup değişimlerinde tekrar tetiklenmez).
        if (!autoOpened && deepLinkAssignmentId && selectedGroupId === deepLinkGroupId && assignItems.some((a) => a.id === deepLinkAssignmentId)) {
          setAutoOpened(true);
          void openAssignment(deepLinkAssignmentId, rosterItems, assignItems);
        } else if (deepLinkPending && !autoOpened) {
          // Bu turda deep-link hedefine ulaşılamadı (yanlış grup ya da grupta öyle bir
          // ödev yok — silinmiş/geçersiz link) — sonsuza dek loader'da beklemek yerine
          // normal VIEW 1'e düş.
          setDeepLinkPending(false);
        }
      } catch {
        setAssignments([]);
        setRoster([]);
      } finally {
        setLoadingAssignments(false);
      }
    })();
  }, [selectedGroupId, groups]);

  // `rosterOverride`/`assignmentsOverride`: deep-link otomatik açılışta component state'i
  // henüz commit olmadan (setRoster/setAssignments async) hemen çağrıldığı için stale
  // closure okumaması diye — normal (butona tıklayarak) açılışta undefined kalır, state
  // kullanılır (2026-07-11).
  async function openAssignment(assignmentId: string, rosterOverride?: RosterItem[], assignmentsOverride?: AssignmentItem[]) {
    setActiveAssignmentId(assignmentId);
    setJustSaved(false);
    if (gradesByAssignment[assignmentId]) return; // zaten yüklendi/düzenlendi

    const effRoster = rosterOverride ?? roster;
    const effAssignments = assignmentsOverride ?? assignments;

    setLoadingGrading(true);
    try {
      const isDummy = assignmentId.startsWith("dummy-");
      let submissions: SubmissionRow[] = [];
      if (!isDummy) {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/submissions?assignmentId=${assignmentId}`, { headers });
        submissions = res.ok ? (await res.json() as { items: SubmissionRow[] }).items : [];
      }
      const byPerson = new Map(submissions.map((s) => [s.personId, s]));
      const dueDate = effAssignments.find((a) => a.id === assignmentId)?.dueDate;
      const dummyPreset: TeslimDurum[] = ["teslim", "gec1", "teslim", "gec2", "yok", "teslim", "gec1", "teslim"];
      const initial: Record<string, StudentGradeState> = {};
      const submissionIds: Record<string, string> = {};
      effRoster.forEach((r, i) => {
        if (isDummy) {
          initial[r.personId] = { durum: dummyPreset[i % dummyPreset.length] };
        } else {
          const sub = byPerson.get(r.personId);
          initial[r.personId] = { durum: durumFromSubmission(sub, dueDate) };
          if (sub) submissionIds[r.personId] = sub.id;
        }
      });
      setGradesByAssignment((prev) => ({ ...prev, [assignmentId]: initial }));
      setSubmissionIdsByAssignment((prev) => ({ ...prev, [assignmentId]: submissionIds }));
    } finally {
      setLoadingGrading(false);
    }
  }

  async function saveGrades() {
    if (!activeAssignmentId || roster.length === 0) return;
    setSavingGrades(true);
    try {
      const activeGrades = gradesByAssignment[activeAssignmentId] ?? {};
      const assignmentMaxPuan = assignments.find((a) => a.id === activeAssignmentId)?.maxPuan ?? 100;
      const isDummy = activeAssignmentId.startsWith("dummy-");

      // 2026-07-13 kota fix — TOPLU notlama: eskiden öğrenci başına ayrı grade/manual-grade
      // isteği + taze submissions GET + ayrı arşiv PATCH atılıyordu (N+2 istek, her biri
      // grup+ödev+kimlik'i yeniden okuyordu). Artık TEK `batch-grade` isteği: roster'da state'i
      // olan her öğrenci gönderilir, SUNUCU (gradeBatch) teslim listesini bir kez okuyup gerçek
      // teslimi olanı günceller / elle işaretleneni dosyasız açar / dokunulmamış "teslim etmedi"
      // (net 0 + teslimi yok) olanı ATLAR. Böylece stale `submissionIdsByAssignment` sorunu da
      // kökten kalkar (sunucu taze listeyi kendi okur).
      const items = roster
        .map((r) => {
          const state = activeGrades[r.personId];
          if (!state) return null;
          // Taban puan HER ZAMAN ödevin maxPuan'ı; net = maxPuan × (1 − gecikme cezası).
          const net = Math.round(assignmentMaxPuan * (1 - CEZA_ORANI[state.durum]));
          return { personId: r.personId, grade: net, isLate: state.durum !== "teslim" };
        })
        .filter((j): j is { personId: string; grade: number; isLate: boolean } => j != null);

      if (isDummy) {
        // demo ödev — sunucuya gitmez, sadece yerel olarak "kaydedildi" gösterilir.
        toast.success("Notlar kaydedildi.");
        setJustSaved(true);
        setAssignments((prev) => prev.map((a) => (a.id === activeAssignmentId ? { ...a, status: "archived" } : a)));
        return;
      }

      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/submissions/batch-grade`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        // archive:true → notlama sonrası ödev "archived" olur: Ana Sayfa Ödev Parkuru'ndan
        // kalkar ama bu sayfada listede kalır, tekrar açılıp düzenlenebilir (2026-07-11 kararı).
        body: JSON.stringify({ assignmentId: activeAssignmentId, groupId: selectedGroupId, items, archive: true }),
      });
      if (!res.ok) {
        toast.error("Kaydedilemedi.");
        return;
      }
      const result = (await res.json()) as { graded: number; created: number; skipped: number; archived: boolean };
      if (result.created > 0) {
        toast.warning(`${result.created} öğrenci gerçek teslim kaydı olmadan elle notlandı (dijital iz yok). Notlar yine de kaydedildi.`);
      } else if (result.graded > 0) {
        toast.success("Notlar kaydedildi.");
      } else {
        toast.success("Teslim eden olmadı, ödev tamamlandı olarak işaretlendi.");
      }
      setJustSaved(true);
      setAssignments((prev) => prev.map((a) => (a.id === activeAssignmentId ? { ...a, status: "archived" } : a)));
    } catch {
      toast.error("Kaydedilemedi.");
    } finally {
      setSavingGrades(false);
    }
  }

  function setDurum(assignmentId: string, personId: string, durum: TeslimDurum) {
    setGradesByAssignment((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], [personId]: { durum } },
    }));
    setJustSaved(false); // kaydedilmiş halden sapıldı — buton tekrar "Notları Kaydet"e döner
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const activeAssignment = assignments.find((a) => a.id === activeAssignmentId) ?? null;
  const MAX_PUAN = activeAssignment?.maxPuan ?? 100;
  const activeGrades = activeAssignmentId ? gradesByAssignment[activeAssignmentId] ?? {} : {};

  function assignmentStatusMeta(assignmentId: string): { label: string; color: string; bg: string; dot: string } {
    // 2026-07-13 fix — DB gerçeğini önce kullan: "Notları Kaydet" ödevi "archived"a çekiyor
    // (notlaması bitti demek). Client `gradesByAssignment` SADECE ödev açılınca dolduğu için,
    // açılmamış ama notlanmış ödevler (özellikle Ana Sayfa'dan girip kaydedilenler) eskiden
    // yanlışlıkla "Bekliyor" görünüyordu — kullanıcı bug'ı. Artık archived → her zaman
    // "Tamamlandı" (tekrar açıp kaydetmeye gerek yok).
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (assignment?.status === "archived") {
      return { label: "Tamamlandı", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" };
    }
    const grades = gradesByAssignment[assignmentId];
    if (!grades) return { label: "Bekliyor", color: "#8E95A3", bg: "#F2F4F7", dot: "#AEB4C0" };
    const puanlanan = roster.filter((r) => grades[r.personId]).length;
    if (puanlanan === 0) return { label: "Bekliyor", color: "#8E95A3", bg: "#F2F4F7", dot: "#AEB4C0" };
    if (puanlanan === roster.length) return { label: "Tamamlandı", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" };
    return { label: `${puanlanan}/${roster.length} puanlandı`, color: "#8A5A00", bg: "#FFF3DC", dot: "#FFB020" };
  }

  let girilenSayisi = 0;
  for (const r of roster) if (activeGrades[r.personId]) girilenSayisi++;

  // Deep-link hedefi henüz açılmamışken (bkz. `deepLinkPending`) VIEW 1'i HİÇ göstermeyip
  // tek bir loader gösteriyoruz — ara adımlardaki flash/"başka sayfaya gitti" hissi için.
  const awaitingDeepLink = deepLinkPending && !activeAssignmentId;
  // 2026-07-12 fix #2: VIEW 2 daha önce `activeAssignmentId` set edilir edilmez (grades
  // henüz gelmeden) render oluyordu — üst kart hemen dolu görünüyor ama tablo bir an
  // "Yükleniyor…" boş hâliyle gösterilip hemen ardından satırlar "pat" diye doluyordu
  // (kullanıcı: "önce boş container sonra içi doldu"). Artık `loadingGrading` true iken
  // (hem deep-link hem elle tıklama akışında) VIEW 2 hiç render edilmiyor, aynı loader
  // devam ediyor — puanlama ekranı ancak TAMAMEN dolu veriyle bir kerede beliriyor.
  const showLoader = awaitingDeepLink || (!!activeAssignmentId && loadingGrading);

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="odev-notu" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<Award size={20} color="#fff" />}
          title="Ödev Notu"
          subtitle="Grup ve ödev seçin, teslim durumuna göre puanlayın."
          roleLabel="Eğitmen"
        />

        {showLoader ? (
          /* ===== Yükleniyor: hedef görünüm (deep-link ya da puanlama) TAM veriyle hazır
             olana kadar ara/eksik hâl hiç gösterilmez ===== */
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={26} className="animate-spin text-[#AEB4C0]" />
          </div>
        ) : !activeAssignmentId ? (
          /* ===== VIEW 1: Grup + Ödev Seçimi ===== */
          <div style={{ padding: "26px 30px 48px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter">
            <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr", alignItems: "start" }}>

              {/* SOL: gruplar */}
              <div className="bg-white border border-[#E2E5EA] rounded-[20px] p-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] sticky" style={{ top: 96 }}>
                <div className="flex items-center gap-[9px] mb-4">
                  <div className="w-8 h-8 rounded-[10px] bg-[#DDE8F8] text-[#205297] flex items-center justify-center">
                    <BookOpen size={17} />
                  </div>
                  <div>
                    <div className="text-[14px] font-extrabold text-[#1E222B] tracking-tight">Gruplar</div>
                    <div className="text-[11px] text-[#8E95A3] font-medium">Ödevleri görmek için seçin</div>
                  </div>
                </div>
                <div className="flex flex-col gap-[7px]">
                  {loadingGroups ? (
                    <p className="text-[12px] text-[#8E95A3] py-4 text-center">Yükleniyor…</p>
                  ) : groups.length === 0 ? (
                    <p className="text-[12px] text-[#8E95A3] py-4 text-center">Henüz grup yok.</p>
                  ) : (
                    groups.map((g) => {
                      const active = g.id === selectedGroupId;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setSelectedGroupId(g.id)}
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

              {/* SAĞ: ödev listesi */}
              <div className="flex flex-col gap-4 min-w-0">
                <div className="flex items-center gap-[13px] bg-white border border-[#E2E5EA] rounded-[18px] py-4 px-5 shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)]">
                  <div className="rounded-full shrink-0" style={{ width: 5, alignSelf: "stretch", minHeight: 40, background: selectedGroup ? groupColor(selectedGroup.id) : "#CDD2DA" }} />
                  <div>
                    <div className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">{selectedGroup?.code ?? "—"} Ödevleri</div>
                    <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{selectedGroup ? `${selectedGroup.branch} • ${roster.length} öğrenci` : ""} — puanlamak için bir ödev seçin</div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E5EA] rounded-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-hidden">
                  <div className="grid gap-3.5 items-center py-3.5 px-[22px] border-b border-[#EEF0F3] bg-[#FBFCFD]" style={{ gridTemplateColumns: "2.2fr 1fr 1.3fr 90px" }}>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Ödev</div>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Puan</div>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Durum</div>
                    <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-right">İşlem</div>
                  </div>

                  {loadingAssignments ? (
                    <div className="py-10 text-center text-[13px] text-[#8E95A3]">Yükleniyor…</div>
                  ) : assignments.length === 0 ? (
                    <div className="py-10 text-center text-[13px] text-[#8E95A3]">Bu gruba ait ödev yok.</div>
                  ) : (
                    assignments.map((a, i) => {
                      const meta = assignmentStatusMeta(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => openAssignment(a.id)}
                          className="w-full text-left grid gap-3.5 items-center py-3.5 px-[22px] cursor-pointer bg-white hover:bg-[#FBFCFD] transition-colors"
                          style={{ gridTemplateColumns: "2.2fr 1fr 1.3fr 90px", borderBottom: i < assignments.length - 1 ? "1px solid #F2F4F7" : "none" }}
                        >
                          <div className="flex items-center gap-[13px] min-w-0">
                            <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-[#DDE8F8] text-[#205297]">
                              <ClipboardList size={20} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="text-[14.5px] font-extrabold text-[#1E222B] tracking-tight truncate">{a.title}</div>
                                {a.kind === "proje" && (
                                  <span className="shrink-0 rounded-full text-[9.5px] font-bold uppercase tracking-wide" style={{ padding: "2px 7px", color: "#6B29A8", background: "#EDE4FB" }}>
                                    Proje
                                  </span>
                                )}
                              </div>
                              <div className="text-[11.5px] text-[#8E95A3] font-medium mt-0.5">Son teslim: {fmtDate(a.dueDate)}</div>
                            </div>
                          </div>
                          <div className="flex items-baseline gap-1 justify-center">
                            <span className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">{a.maxPuan ?? 100}</span>
                            <span className="text-[11px] font-bold text-[#8E95A3]">puan</span>
                          </div>
                          <div className="flex items-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-bold" style={{ padding: "4px 11px", color: meta.color, background: meta.bg }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[12.5px] font-bold text-[#205297] whitespace-nowrap">
                            Puanla <ChevronRight size={14} strokeWidth={2.6} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===== VIEW 2: Ödev Puanlama ===== */
          <div style={{ padding: "26px 30px 48px" }} className="font-inter flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveAssignmentId(null)}
                className="inline-flex items-center gap-[7px] py-2.5 px-[15px] rounded-[11px] border border-[#E2E5EA] bg-white text-[#414B59] text-[13px] font-bold cursor-pointer hover:bg-[#F7F8FA] transition-colors"
              >
                <ArrowLeft size={15} strokeWidth={2.5} /> Geri
              </button>
              <div className="text-[12.5px] text-[#8E95A3] font-semibold">
                {selectedGroup?.code} <span className="text-[#CDD2DA]">/</span> <span className="text-[#414B59] font-bold">{activeAssignment?.title}</span>
              </div>
            </div>

            <div className="bg-white border border-[#E2E5EA] rounded-[18px] py-[18px] px-[22px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-[46px] h-[46px] rounded-[13px] shrink-0 flex items-center justify-center bg-[#DDE8F8] text-[#205297]">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <div className="text-[17px] font-extrabold text-[#1E222B] tracking-tight">{activeAssignment?.title}</div>
                  <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{selectedGroup?.code} • {selectedGroup?.branch} • Son teslim: {fmtDate(activeAssignment?.dueDate)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 py-[9px] px-3.5 rounded-[11px] bg-[#EFF5FE] border border-[#D3E3F8]">
                  <span className="text-[11px] font-bold text-[#6F7B87]">Ödev Puanı</span>
                  <span className="text-[14px] font-extrabold text-[#205297]">{MAX_PUAN}</span>
                </div>
                <div className="flex items-center gap-2 py-[9px] px-3.5 rounded-[11px] bg-[#FFF3E9] border border-[#F7D9BF]">
                  <Clock size={15} color="#C2410C" />
                  <span className="text-[11.5px] font-bold text-[#C2410C]">Gecikme cezası: her kademe %10</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E2E5EA] rounded-[18px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-hidden">
              <div className="grid gap-3 items-center py-[15px] px-[22px] border-b border-[#EEF0F3] bg-[#FBFCFD]" style={{ gridTemplateColumns: "1.9fr 1.7fr 1fr 1fr" }}>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Öğrenci</div>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Teslim Durumu</div>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Gecikme Cezası</div>
                <div className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide text-center">Net Puan</div>
              </div>

              {roster.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-[#8E95A3]">Bu grupta öğrenci yok.</div>
              ) : (
                roster.map((r, i) => {
                  const state = activeGrades[r.personId] ?? { durum: "teslim" as TeslimDurum };
                  const dm = DURUM_META[state.durum];
                  const teslimEtmedi = state.durum === "yok";
                  const oran = CEZA_ORANI[state.durum];
                  // Taban puan HER ZAMAN ödevin maxPuan'ı — elle giriş yok (2026-07-08 kararı).
                  const ceza = teslimEtmedi ? null : Math.round(MAX_PUAN * oran);
                  const net = Math.round(MAX_PUAN * (1 - oran));
                  const avatarColor = GROUP_COLORS[i % GROUP_COLORS.length];

                  return (
                    <div key={r.personId} className="grid gap-3 items-center py-[13px] px-[22px]" style={{ gridTemplateColumns: "1.9fr 1.7fr 1fr 1fr", borderBottom: i < roster.length - 1 ? "1px solid #F2F4F7" : "none" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-[13.5px] font-bold" style={{ background: avatarColor }}>
                          {initials(r.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-[#1E222B] truncate">{r.name}</div>
                        </div>
                      </div>
                      <div className="relative">
                        <select
                          value={state.durum}
                          onChange={(e) => setDurum(activeAssignmentId, r.personId, e.target.value as TeslimDurum)}
                          className="w-full py-2.5 pl-3.5 pr-8 rounded-[10px] text-[12.5px] font-bold outline-none cursor-pointer appearance-none"
                          style={{ border: `1px solid ${state.durum === "teslim" ? "#E2E5EA" : dm.dot + "80"}`, background: state.durum === "teslim" ? "#fff" : dm.bg, color: dm.color }}
                        >
                          <option value="teslim">Teslim etti</option>
                          <option value="gec1">1 hafta gecikmeli</option>
                          <option value="gec2">2 hafta+ gecikmeli</option>
                          <option value="yok">Teslim etmedi</option>
                        </select>
                        <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" color="#8E95A3" />
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="text-[12.5px] font-bold" style={{ color: teslimEtmedi ? "#C22B2B" : ceza ? "#C2410C" : "#AEB4C0" }}>
                          {teslimEtmedi ? "Teslim yok" : ceza === 0 ? "Ceza yok" : `−${ceza}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-center">
                        <span
                          className="inline-flex items-baseline gap-0.5 justify-center rounded-[10px] font-extrabold"
                          style={{ minWidth: 58, padding: "7px 12px", fontSize: 15, letterSpacing: "-.3px", color: teslimEtmedi ? "#C22B2B" : "#1E222B", background: teslimEtmedi ? "#FDE1E1" : "#EFF5FE" }}
                        >
                          {net}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="flex items-center justify-between gap-4 py-4 px-[22px] border-t border-[#EEF0F3] bg-[#FBFCFD] flex-wrap">
                <div className="text-[12.5px] text-[#6F7B87] font-semibold">{girilenSayisi} / {roster.length} öğrenci değerlendirildi</div>
                <div className="flex items-center gap-2.5">
                  {/* "Taslak Kaydet" kaldırıldı (2026-07-11 kullanıcı kararı: hiç işlevi
                      yoktu, sadece "yakında" toast'ı gösteriyordu — "saçma") — tek gerçek
                      aksiyon "Notları Kaydet". */}
                  <button
                    onClick={saveGrades}
                    disabled={savingGrades || activeAssignmentId?.startsWith("dummy-")}
                    className="inline-flex items-center gap-1.5 py-[11px] px-5 rounded-[11px] border-none text-white text-[13px] font-extrabold cursor-pointer transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={
                      justSaved
                        ? { background: "linear-gradient(135deg,#1F9D57,#0E7A3E)", boxShadow: "0 10px 20px -8px rgba(14,122,62,.5)" }
                        : { background: "linear-gradient(135deg,#2867bd,#205297)", boxShadow: "0 10px 20px -8px rgba(32,82,151,.5)" }
                    }
                  >
                    <Check size={16} strokeWidth={2.4} />
                    {savingGrades ? "Kaydediliyor…" : justSaved ? "Notlar Kaydedildi" : "Notları Kaydet"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}
