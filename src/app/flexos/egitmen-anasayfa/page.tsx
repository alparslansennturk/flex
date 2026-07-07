"use client";

/**
 * FlexOS · Eğitmen Ana Sayfa — canlı `src/app/dashboard/page.tsx`'ten BİREBİR UI portu
 * (kullanıcı: "aynen copy paste et"). Banner/Hızlı Aksiyon/Aktivite bölümleri gerçek
 * FlexOS verisine bağlı (groups/persons/attendance/holidays).
 *
 * "Ödev Parkuru" GERÇEK veriye bağlı (canlıdaki `DesignParkour.tsx` kart mantığı):
 * gerçek aktif ödevler (en yeni solda) + kullanılmamış şablonlardan "ghost" kart
 * (soluk/pasif stil, deterministik karıştırma) + kalan slotlar boş placeholder.
 *
 * **"+Ödev Ver" BAĞLANDI (2026-07-06):** `OdevOlusturModal` — Claude Design çıktısından
 * (`Ödev Oluştur.dc.html`) birebir port, gerçek `POST /api/flexos/assignments`'e yazar
 * (`maxPuan`+`kind` dahil). "Şablon olarak kaydet" → eğitmenin KİŞİSEL kütüphanesine
 * ekler (`template.manage` self-scope, 2026-07-06 kararı — admine özel değil).
 * Ghost kart üzerindeki "Ödev ver" (şablonu aktive et) ve "Detay" hâlâ "yakında" —
 * ayrı, daha küçük bir iş.
 *
 * **Ödev Kütüphanesi EKLENDİ (2026-07-06, kullanıcı: "canlıya bak, sağa sola kaydırılabilir
 * scrolling mantığında olan kütüphaneyi istiyorum"):** canlıdaki `AssignmentLibrary.tsx`'in
 * portu — Ödev Parkuru'nun altında, yatay kaydırmalı kart listesi (overflow varsa sol/sağ
 * ok butonları). Kişisel/Global sekme ayrımı YOK (kullanıcı kararı) — sadece branş seçici
 * (>1 branş varsa). "Ödevi Başlat" butonu `OdevOlusturModal`'ı şablonun alanlarıyla ÖN-
 * DOLU açar (`AssignmentPrefill` — modal artık hem boş "+Ödev Ver" hem şablondan başlatma
 * için tek kod yolu), eğitmen sadece grup+tarih seçip onaylıyor.
 *
 * **Semantik DEĞİŞTİ (2026-07-07):** `visible` artık Kütüphane'nin filtresi — Şablon
 * Yönetimi'nden onaylanmayan (X) şablon Kütüphane'de listelenmez. Ödev Parkuru'nun
 * ghost-slot'u ise artık `visible`e bakmıyor, TÜM şablonlardan otomatik/deterministik-
 * rastgele dolduruluyor (bir satır gerçek/aktif ödevle dolmuyorsa). Branş dropdown'ı da
 * artık şablonlarda GEÇEN branşlardan değil, eğitmenin KENDİ gruplarından (canlıdaki
 * `user.branches` deseninin karşılığı) türetiliyor — henüz o branşta şablon yoksa da
 * seçenek görünür.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck, ClipboardList, Award, Activity, Users, UsersRound,
  Route, Plus, ChevronRight, LibraryBig, ChevronLeft, ChevronDown, PlusCircle,
} from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader, { FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../_components/FlexHeader";
import { FlexPageLoader } from "../_components/FlexSpinner";
import Footer from "@/app/components/layout/Footer";
import OdevOlusturModal, { type AssignmentPrefill } from "./OdevOlusturModal";
import { ASSIGNMENT_ICONS } from "../odevler/_shared/assignmentIcons";

// ── API şekilleri ──
interface GroupItem {
  id: string;
  code: string;
  status: string;
  schedule?: { days: number[]; startTime?: string; endTime?: string };
}
interface HolidayItem { startDate: string; endDate: string }

const ATTEND_BEFORE_MIN = 15; // canlıyla aynı (dashboard/page.tsx)
const ATTEND_AFTER_MIN = 180;

function parseTimeToMin(t?: string): number | null {
  if (!t) return null;
  const m = t.match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function todayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Banner ───────────────────────────────────────────────────────────────────
function StatBox({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl flex flex-col items-center justify-center text-center py-5 px-2">
      <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-white/50 mb-2">
        {icon}
      </div>
      <span className="text-[10px] text-white/40 font-semibold mb-1 tracking-tight">{label}</span>
      <span className="text-[22px] font-bold text-white leading-none tracking-tighter">{value}</span>
    </div>
  );
}

function HomeBanner({ groupCount, studentCount }: { groupCount: number; studentCount: number }) {
  return (
    <div className="bg-[#10294C] rounded-2xl p-8 text-white relative overflow-hidden border border-white/5 shadow-lg w-full">
      <div className="absolute top-0 right-0 w-56 h-56 bg-[#FF8D28]/10 blur-[90px] -mr-24 -mt-24 pointer-events-none" />
      <div className="relative z-10">
        <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full border border-white/10 text-[#FF8D28] font-bold tracking-widest">
          Atölye Özeti
        </span>
        <h2 className="text-[22px] font-semibold tracking-tight leading-tight mt-2 mb-4">
          Atölyendeki güncel <span className="text-[#FF8D28]">istatistikler.</span>
        </h2>
        <div className="grid grid-cols-3 gap-6">
          <StatBox label="Sınıf" value={groupCount} icon={<UsersRound size={16} />} />
          <StatBox label="Öğrenci" value={studentCount} icon={<Users size={16} />} />
          <StatBox label="Ödev" value="—" icon={<ClipboardList size={16} />} />
        </div>
      </div>
    </div>
  );
}

// ─── Hızlı Eylem Kartı ────────────────────────────────────────────────────────
function QuickActionCard({
  icon, label, href, meta, statusText,
  statusColor = "bg-[#10294C] text-white",
  iconBg = "bg-[#F7F8FA]",
  iconColor = "text-[#8E95A3]",
  pulse = false,
  onBeforeNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  href: string | null;
  meta?: string;
  statusText: string;
  statusColor?: string;
  iconBg?: string;
  iconColor?: string;
  pulse?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => {
        onBeforeNavigate?.();
        if (href) router.push(href);
        else toast.info("Bu özellik yakında.");
      }}
      className="bg-white rounded-2xl border border-transparent flex flex-col cursor-pointer min-h-[155px] xl:min-h-[194px] overflow-hidden
                 hover:shadow-[0_16px_48px_-12px_rgba(16,41,76,0.16)] hover:-translate-y-1
                 transition-all duration-200 select-none group"
    >
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-auto">
          <div className={`w-11 h-11 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200`}>
            {icon}
          </div>
          <p className="text-[15px] xl:text-[19px] font-bold text-[#10294C] leading-snug">{label}</p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-4">
          {meta && <span className="text-[12px] text-[#64748B] font-medium min-w-0 truncate">{meta}</span>}
          <div className="relative ml-auto shrink-0">
            {pulse && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#009F3E] rounded-full animate-ping opacity-75" />}
            <span className={`text-[12px] xl:text-[15px] font-semibold px-4 xl:px-5 py-1.5 xl:py-2 rounded-full ${statusColor} whitespace-nowrap block`}>
              {statusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Aktivite Paneli (FlexOS'ta eğitmenin sınıf-aktivite log'u henüz yok — boş durum) ──
function ActivityFeedPlaceholder() {
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F0F2F6] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#10294C] flex items-center justify-center shrink-0">
            <Activity size={16} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#10294C] leading-none">En Son Aktiviteler</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-none">Atölyendeki son hareketler</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-[#10294C]/10 px-2.5 py-1 rounded-full">
          <div className="relative w-1.5 h-1.5">
            <span className="absolute inset-0 bg-[#009F3E] rounded-full animate-ping opacity-75" />
            <span className="relative block w-1.5 h-1.5 bg-[#009F3E] rounded-full" />
          </div>
          <span className="text-[10px] font-bold text-[#10294C]">Canlı</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center text-[12px] text-[#9CA3AF]">
        Henüz aktivite yok
      </div>
    </div>
  );
}

// ─── Ödev Parkuru — canlıdaki `DesignParkour.tsx` kart mantığı (gerçek aktif ödev +
// kullanılmamış şablon "ghost" kartı + boş placeholder), sadece GÖRÜNÜM portu —
// aksiyonlar (Ödev Ver / Ödevi Başlat) kullanıcı kararıyla bu turda "yakında" toast.
const MAX_PARKOUR_SLOTS = 4;

interface ParkourAssignment { id: string; title: string; subtitle?: string; description: string; dueDate?: string; status: string; createdAt?: string; templateId?: string }
interface ParkourTemplate { id: string; title: string; description: string; visible?: boolean }

function getDuration(dueDate?: string): { text: string; expired: boolean; noDate: boolean } {
  if (!dueDate) return { text: "Süresiz", expired: false, noDate: true };
  const end = new Date(dueDate); end.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { text: "Süresi Doldu", expired: true, noDate: false };
  if (diff === 0) return { text: "Bugün!", expired: false, noDate: false };
  if (diff <= 3) return { text: `Son ${diff} Gün`, expired: false, noDate: false };
  const dd = String(end.getDate()).padStart(2, "0");
  const mm = String(end.getMonth() + 1).padStart(2, "0");
  return { text: `${dd}.${mm}.${end.getFullYear()}`, expired: false, noDate: false };
}

/** Gerçek aktif ödev kartı — canlıdaki `TaskParkourCard` (compact) karşılığı. */
function ActiveParkourCard({ assignment }: { assignment: ParkourAssignment }) {
  const dur = getDuration(assignment.dueDate);
  return (
    <div className="bg-white p-4 rounded-24 border border-[#CDD2DA] flex flex-col justify-between h-full transition-all duration-300 hover:shadow-[15px_30px_60px_-15px_rgba(16,41,76,0.08)] hover:-translate-y-1">
      <div className="flex justify-between items-start mb-3">
        <div className="w-9 h-9 bg-gradient-to-b from-pink-500 to-[#B80E57] rounded-12 flex items-center justify-center text-white shadow-lg shrink-0">
          <ClipboardList size={16} />
        </div>
        <span className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-pink-100 text-pink-700">Ödev</span>
      </div>
      <div className="mb-3">
        <h4 className="text-[17px] text-[#10294C] font-bold leading-tight truncate">{assignment.title}</h4>
        {assignment.subtitle && <p className="text-[12.5px] text-[#6F7B87] font-semibold truncate mt-0.5">{assignment.subtitle}</p>}
        {assignment.description && <p className="text-[13px] text-[#8E95A3] leading-relaxed line-clamp-2 mt-1">{assignment.description}</p>}
      </div>
      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-3 border border-[#EEF0F3]">
        <div className="flex flex-col">
          <span className="text-[11px] text-[#8E95A3]">Durum</span>
          <span className={`text-[13px] font-bold mt-0.5 ${dur.expired ? "text-[#AEB4C0]" : "text-[#009F3E]"}`}>{dur.expired ? "Süresi Doldu" : "Aktif"}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] text-[#8E95A3]">Teslim süresi</span>
          <span className="text-[13px] font-bold text-[#10294C] mt-0.5">{dur.text}</span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-3">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold">Ödev Atölyesi</span>
        <button
          onClick={() => toast.info("Bu özellik yakında.")}
          className="h-8 px-4 flex items-center gap-1 rounded-full text-[11px] font-semibold bg-[#6F74D8] text-white hover:bg-[#5E63C2] transition-all cursor-pointer"
        >
          Detay <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

/** Kullanılmamış şablon "ghost" kartı — canlıdaki `GhostParkourCard` (compact, soluk stil). */
function GhostParkourCard({ template }: { template: ParkourTemplate }) {
  return (
    <div className="bg-white p-4 rounded-24 border border-dashed border-[#D0D5DE] flex flex-col justify-between h-full opacity-90">
      <div className="flex justify-between items-start mb-3">
        <div className="w-9 h-9 bg-gradient-to-b from-pink-500 to-[#B80E57] rounded-12 flex items-center justify-center text-white shadow-lg shrink-0">
          <ClipboardList size={16} />
        </div>
        <span className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-pink-100 text-pink-700">Ödev</span>
      </div>
      <div className="mb-3">
        <h4 className="text-[17px] text-[#10294C] font-bold leading-tight truncate">{template.title}</h4>
        {template.description && <p className="text-[13px] text-[#8E95A3] leading-relaxed line-clamp-2">{template.description}</p>}
      </div>
      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-3 border border-[#EEF0F3]">
        <div className="flex flex-col"><span className="text-[11px] text-[#8E95A3]">Durum</span><span className="text-[13px] font-bold mt-0.5 text-[#AEB4C0]">Pasif</span></div>
        <div className="flex flex-col items-end"><span className="text-[11px] text-[#8E95A3]">Teslim süresi</span><span className="text-[13px] font-bold text-[#AEB4C0] mt-0.5">—</span></div>
      </div>
      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-3">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold">Ödev Atölyesi</span>
        <button
          onClick={() => toast.info("Bu özellik yakında.")}
          className="h-8 px-4 flex items-center gap-1 rounded-full text-[11px] font-semibold bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed"
        >
          Ödev ver <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

function PlaceholderParkourCard() {
  return (
    <div className="bg-white/50 p-4 rounded-24 border border-dashed border-[#E2E5EA] flex flex-col justify-between h-full cursor-default opacity-40">
      <div className="flex justify-between items-start mb-3">
        <div className="w-9 h-9 bg-[#F7F8FA] radius-12 shrink-0" />
        <span className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-[#F7F8FA] text-[#AEB4C0]">—</span>
      </div>
      <div className="mb-3">
        <div className="h-5 w-36 bg-[#F7F8FA] rounded-lg mb-2" />
        <div className="h-3 w-full bg-[#F7F8FA] rounded mb-1.5" />
        <div className="h-3 w-3/4 bg-[#F7F8FA] rounded" />
      </div>
      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-3 border border-[#EEF0F3]">
        <div className="flex flex-col gap-1.5">
          <div className="h-2.5 w-8 bg-[#E2E5EA] rounded" />
          <div className="h-3 w-12 bg-[#E2E5EA] rounded" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="h-2.5 w-16 bg-[#E2E5EA] rounded" />
          <div className="h-3 w-10 bg-[#E2E5EA] rounded" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-3">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold opacity-60">Ödev Atölyesi</span>
        <button disabled className="h-8 text-[11px] px-4 flex items-center gap-1 rounded-full font-semibold bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed">
          Ödev ver
        </button>
      </div>
    </div>
  );
}

function OdevParkuru() {
  const [assignments, setAssignments] = useState<ParkourAssignment[]>([]);
  const [templates, setTemplates] = useState<ParkourTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalAcik, setModalAcik] = useState(false);

  const loadData = useCallback(async () => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [assignRes, tplRes] = await Promise.all([
        fetch("/api/flexos/assignments", { headers }),
        fetch("/api/flexos/assignment-templates", { headers }),
      ]);
      if (assignRes.ok) setAssignments((await assignRes.json()).items ?? []);
      if (tplRes.ok) setTemplates((await tplRes.json()).items ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Aktif ödevler — en yeni solda (canlıdaki createdAt DESC sıralaması)
  const activeAssignments = assignments
    .filter((a) => a.status === "published")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  // Kullanılmamış şablonlar — deterministik karıştırma (canlıdaki id-hash %7 deseni)
  const usedTemplateIds = new Set(assignments.filter((a) => a.templateId).map((a) => a.templateId));
  const ghostCount = Math.max(0, MAX_PARKOUR_SLOTS - activeAssignments.length);
  // Bir satır (MAX_PARKOUR_SLOTS) gerçek/aktif ödevle dolmuyorsa kalan slotlar
  // TÜM şablonlardan otomatik/deterministik-rastgele doldurulur (2026-07-07 kararı —
  // artık manuel bir "Ana sayfada göster" onayına bağlı değil, `visible` Kütüphane'nin
  // filtresi oldu).
  const availableTemplates = templates.filter((t) => !usedTemplateIds.has(t.id));
  const ghostTemplates = [...availableTemplates]
    .sort((a, b) => {
      const ha = Array.from(a.id).reduce((s, c) => s + c.charCodeAt(0), 0);
      const hb = Array.from(b.id).reduce((s, c) => s + c.charCodeAt(0), 0);
      return (ha % 7) - (hb % 7);
    })
    .slice(0, ghostCount);
  const placeholderCount = Math.max(0, ghostCount - ghostTemplates.length);

  return (
    <section className="mt-[48px] space-y-[24px]">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3 text-[#10294C]">
          <Route size={22} className="text-[#FF8D28]" />
          <h3 className="text-[22px] font-bold cursor-default">Ödev Parkuru</h3>
        </div>
        <button
          onClick={() => setModalAcik(true)}
          className="flex items-center gap-1 h-10 px-5 rounded-xl text-white text-[13px] font-semibold active:scale-95 transition-all cursor-pointer"
          style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Ödev Ver
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {!loaded ? (
          Array.from({ length: 4 }).map((_, i) => <PlaceholderParkourCard key={i} />)
        ) : (
          <>
            {activeAssignments.slice(0, MAX_PARKOUR_SLOTS).map((a) => <ActiveParkourCard key={a.id} assignment={a} />)}
            {ghostTemplates.map((t) => <GhostParkourCard key={t.id} template={t} />)}
            {Array.from({ length: placeholderCount }).map((_, i) => <PlaceholderParkourCard key={`ph-${i}`} />)}
          </>
        )}
      </div>
      <OdevOlusturModal
        open={modalAcik}
        onClose={() => setModalAcik(false)}
        onCreated={loadData}
      />
    </section>
  );
}

// ─── Ödev Kütüphanesi — canlıdaki `AssignmentLibrary.tsx` portu (2026-07-06, kullanıcı:
// "canlıya bak, sağa sola kaydırılabilir scrolling mantığında olan kütüphaneyi istiyorum").
// Kişisel/Global sekme ayrımı YOK (kullanıcı kararı) — GET zaten eğitmenin kendi kişisel +
// tüm global şablonlarını tek listede döndürüyor (listTemplates). Yerine sadece BRANŞ
// seçici var (çoklu branşlı eğitmen kütüphaneler arası geçiş yapar) — şablonlarda fiilen
// bulunan branşlardan türetilir, >1 branş varsa gösterilir. `visible` (Ana Sayfa/Ödev
// Parkuru ghost-slot'u ARTIK `visible`e bakmıyor (otomatik/rastgele doldurma,
// 2026-07-07 kararıyla değişti) — `visible` ŞİMDİ Kütüphane'nin filtresi: eğitmen
// Şablon Yönetimi'nden onaylamadan (Check) şablon Kütüphane'de listelenmez.
interface LibTemplate { id: string; title: string; subtitle?: string; description: string; branch?: string; icon?: string; kind?: "normal" | "proje"; maxPuan?: number; visible?: boolean; gamifiedType?: "kolaj" | "kitap" }

function LibraryCard({ t, onStart }: { t: LibTemplate; onStart: (t: LibTemplate) => void }) {
  const Icon = (t.icon && ASSIGNMENT_ICONS[t.icon]) || ClipboardList;
  return (
    <div className="min-w-[calc((100%-80px)/4.3)] snap-start bg-white p-6 rounded-20 border border-[#EEF0F3] flex flex-col justify-between h-[210px] transition-all duration-500 hover:shadow-[15px_40px_80px_-20px_rgba(16,41,76,0.08)] hover:-translate-y-2">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#F7F8FA] text-[#8E95A3] rounded-xl flex items-center justify-center shrink-0">
          <Icon size={18} />
        </div>
        <div className="truncate flex-1 min-w-0">
          <h5 className="text-[15px] font-bold text-[#10294C] mb-0.5 truncate">{t.title}</h5>
          <p className="text-[11px] text-[#8E95A3] line-clamp-2">{t.subtitle || t.description || "Açıklama yok"}</p>
        </div>
      </div>
      <div className="border-t border-[#EEF0F3] my-4" />
      <div className="flex items-center justify-between gap-2">
        {/* Oyunlaştırılmış (mor rozet) FlexOS'ta henüz yok — o özellik gelince buraya
            canlıdaki gibi eklenecek (bkz. proje memory'si). Branş adı DÜZ metin (renksiz,
            kullanıcı: "kütüphane kısmı renksiz olsun") — branşı yoksa "Global". */}
        <span className="text-[10px] text-[#AEB4C0] italic font-semibold opacity-60">{t.branch || "Global"}</span>
        <button
          onClick={() => onStart(t)}
          className="px-4 py-1.5 bg-[#F7F8FA] text-[#10294C] rounded-xl text-[11px] font-bold flex items-center gap-2 hover:bg-[#10294C] hover:text-white transition-all cursor-pointer shrink-0"
        >
          <PlusCircle size={14} /> Ödevi Başlat
        </button>
      </div>
    </div>
  );
}

function OdevKutuphanesi() {
  const [templates, setTemplates] = useState<LibTemplate[]>([]);
  const [myBranches, setMyBranches] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeBranch, setActiveBranch] = useState("all");
  const [hasOverflow, setHasOverflow] = useState(false);
  const [startTemplate, setStartTemplate] = useState<LibTemplate | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    const headers = { Authorization: `Bearer ${token}` };
    try {
      // trainerId=kendi uid'i EXPLICIT gönderiliyor — org-scope aktör (admin/owner)
      // parametresiz istekte TÜM tenant'ın gruplarını görür, ama bu widget "eğitmenin
      // KENDİ kütüphanesi" kavramı; kim görüntülüyorsa sadece kendi branşlarını görmeli.
      const [tplRes, groupsRes] = await Promise.all([
        fetch("/api/flexos/assignment-templates", { headers }),
        fetch(`/api/flexos/groups?trainerId=${u?.uid ?? ""}`, { headers }),
      ]);
      const templateItems: LibTemplate[] = tplRes.ok ? (await tplRes.json()).items ?? [] : [];
      setTemplates(templateItems);

      const groupBranches: string[] = groupsRes.ok
        ? ((await groupsRes.json()).items ?? []).map((g: { branch?: string }) => g.branch).filter((b: string | undefined): b is string => !!b)
        : [];
      // Branş filtresi: gerçek gruplarım ∪ şablonlarımın branşları (canlıdaki sabit
      // user.branches listesine en yakın karşılık — FlexOS'ta öyle bir alan yok, henüz
      // gerçek grubu olmayan ama şablonu olan bir branş da filtrede görünmeli).
      const templateBranches = templateItems.map((t) => t.branch).filter((b): b is string => !!b);
      setMyBranches(Array.from(new Set([...groupBranches, ...templateBranches])));
    } finally {
      setLoaded(true);
    }
  }, []);

  // Şablon Yönetimi'nde onay/kaldır değişikliği başka bir sekme/sayfada yapılabiliyor —
  // client Firestore listener'ı yok (bkz. flexos_* server-only rules), o yüzden
  // egitim-operasyon-anasayfa'daki aynı desen: 60sn polling + sekmeye geri dönünce anında
  // yenile (activities polling ile aynı desen).
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!interval) interval = setInterval(loadData, 60000); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else { loadData(); start(); }
    };
    loadData();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [loadData]);

  const approvedTemplates = templates.filter((t) => t.visible === true);
  const branchOptions = myBranches;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [templates, activeBranch]);

  function handleScroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -420 : 420, behavior: "smooth" });
  }

  const visibleTemplates = activeBranch === "all" ? approvedTemplates : approvedTemplates.filter((t) => t.branch === activeBranch);

  const prefill: AssignmentPrefill | undefined = startTemplate
    ? { templateId: startTemplate.id, title: startTemplate.title, subtitle: startTemplate.subtitle, description: startTemplate.description, icon: startTemplate.icon, kind: startTemplate.kind, maxPuan: startTemplate.maxPuan, gamifiedType: startTemplate.gamifiedType }
    : undefined;

  return (
    <section className="mt-[48px] mb-[64px] space-y-[24px]">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3 text-[#5C6370]">
          <LibraryBig size={22} />
          <h3 className="text-[22px] font-bold text-[#5C6370] cursor-default">Ödev Kütüphanesi</h3>
        </div>
        {branchOptions.length > 1 && (
          <div className="relative">
            <select
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value)}
              className="h-9 pl-4 pr-9 rounded-[12px] border border-[#EEF0F3] bg-[#F7F8FA] text-[13px] font-semibold text-[#5C6370] outline-none focus:border-orange-400 cursor-pointer appearance-none"
            >
              <option value="all">Tüm Branşlar</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A3] pointer-events-none" />
          </div>
        )}
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center h-32 rounded-2xl border border-dashed border-[#D0D5DE] text-[#8E95A3] text-[13px] font-medium">
          Yükleniyor…
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className="flex items-center justify-center h-32 rounded-2xl border border-dashed border-[#D0D5DE] text-[#8E95A3] text-[13px] font-medium">
          Henüz şablonunuz yok — Ödev Yönetimi&apos;nden şablon oluşturabilirsiniz.
        </div>
      ) : (
        <div className="relative overflow-visible">
          {hasOverflow && (
            <>
              <button onClick={() => handleScroll("left")} className="absolute -left-5 top-[105px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronLeft size={24} /></button>
              <button onClick={() => handleScroll("right")} className="absolute -right-5 top-[105px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronRight size={24} /></button>
            </>
          )}
          <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x py-10 -my-10">
            {visibleTemplates.map((t) => <LibraryCard key={t.id} t={t} onStart={setStartTemplate} />)}
          </div>
        </div>
      )}

      <OdevOlusturModal
        open={startTemplate !== null}
        onClose={() => setStartTemplate(null)}
        onCreated={() => setStartTemplate(null)}
        prefill={prefill}
      />
    </section>
  );
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────
export default function EgitmenAnaSayfaPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [groupCount, setGroupCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [attendMeta, setAttendMeta] = useState("");
  const [attendPulse, setAttendPulse] = useState(false);

  const activeGroupsRef = useRef<GroupItem[]>([]);
  const holidayDatesRef = useRef<Set<string>>(new Set());
  const todayKeyRef = useRef("");

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const computeAttendPulse = useCallback(async () => {
    const key = todayKeyRef.current;
    if (holidayDatesRef.current.has(key)) { setAttendMeta(""); setAttendPulse(false); return; }
    if (typeof window !== "undefined" && localStorage.getItem(`flexos_attend_dismissed_${key}`)) {
      setAttendMeta(""); setAttendPulse(false); return;
    }
    const now = new Date();
    const todayDay = now.getDay();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const candidates = activeGroupsRef.current.filter((g) => {
      const days = g.schedule?.days ?? [];
      if (!days.includes(todayDay)) return false;
      const start = parseTimeToMin(g.schedule?.startTime);
      const end = parseTimeToMin(g.schedule?.endTime);
      if (start == null || end == null) return false;
      return nowMins >= start - ATTEND_BEFORE_MIN && nowMins <= end + ATTEND_AFTER_MIN;
    });
    if (candidates.length === 0) { setAttendMeta(""); setAttendPulse(false); return; }

    const headers = await authHeaders();
    const pendingCodes: string[] = [];
    for (const g of candidates) {
      try {
        const res = await fetch(`/api/flexos/attendance?groupId=${g.id}&date=${key}`, { headers });
        const j = res.ok ? await res.json() : { record: null };
        if (!j.record) pendingCodes.push(g.code);
      } catch { /* ağ hatasında sessizce atla */ }
    }
    if (pendingCodes.length === 0) { setAttendMeta(""); setAttendPulse(false); }
    else if (pendingCodes.length === 1) { setAttendMeta(pendingCodes[0]); setAttendPulse(true); }
    else { setAttendMeta(`${pendingCodes.length} grup`); setAttendPulse(true); }
  }, [authHeaders]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);

      todayKeyRef.current = todayKeyOf(new Date());
      const headers = await authHeaders();
      try {
        const [groupsRes, personsRes, holidaysRes] = await Promise.all([
          fetch("/api/flexos/groups", { headers, signal: ac.signal }),
          fetch("/api/flexos/persons", { headers, signal: ac.signal }),
          fetch("/api/flexos/holidays", { headers, signal: ac.signal }),
        ]);
        if (ac.signal.aborted) return;

        const groupItems: GroupItem[] = groupsRes.ok ? ((await groupsRes.json()).items ?? []) : [];
        const activeGroups = groupItems.filter((g) => g.status === "active");
        setGroupCount(activeGroups.length);
        activeGroupsRef.current = activeGroups;

        if (personsRes.ok) setStudentCount(((await personsRes.json()).items ?? []).length);

        if (holidaysRes.ok) {
          const items: HolidayItem[] = (await holidaysRes.json()).items ?? [];
          const dates = new Set<string>();
          for (const h of items) {
            const cur = new Date(h.startDate + "T12:00:00");
            const end = new Date(h.endDate + "T12:00:00");
            while (cur <= end) { dates.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
          }
          holidayDatesRef.current = dates;
        }

        await computeAttendPulse();
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Veriler yüklenemedi.");
      }
    })();
    const interval = setInterval(computeAttendPulse, 60_000);
    return () => { ac.abort(); clearInterval(interval); };
  }, [router, authHeaders, computeAttendPulse]);

  if (authed === null) return <FlexPageLoader />;

  const today = new Date();
  const todayFormatted = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="ana" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader greeting subtitle="Bugün atölyende neler oluyor? İşte son durum." roleLabel="Eğitmen" maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS} />

        <div style={{ margin: "0 auto", boxSizing: "border-box", flex: 1 }} className={`${FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS} pt-6 pb-8`}>
          <div className="flex flex-col xl:flex-row gap-5">
            <div className="flex-1 min-w-0 flex flex-col gap-5">
              <HomeBanner groupCount={groupCount} studentCount={studentCount} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <QuickActionCard
                  icon={<CalendarCheck size={20} />}
                  label="Hızlı Yoklama"
                  href="/flexos/yoklama/al"
                  meta={attendMeta || todayFormatted}
                  statusText="Derse Git"
                  statusColor="bg-[#009F3E] text-white"
                  iconBg="bg-[#EEF4FD]"
                  iconColor="text-[#3A7BD5]"
                  pulse={attendPulse}
                  onBeforeNavigate={() => {
                    localStorage.setItem(`flexos_attend_dismissed_${todayKeyRef.current}`, "1");
                    setAttendPulse(false);
                    setAttendMeta("");
                  }}
                />
                <QuickActionCard
                  icon={<ClipboardList size={20} />}
                  label="Ödev Teslimi"
                  href="/flexos/odevler/teslim"
                  statusText="İncele"
                  statusColor="bg-[#FF8D28] text-white"
                  iconBg="bg-[#FFF4EB]"
                  iconColor="text-[#FF8D28]"
                />
                <QuickActionCard
                  icon={<Award size={20} />}
                  label="Sertifikasyon"
                  href={null}
                  meta="Yakında"
                  statusText="Not Gir"
                  statusColor="bg-[#6F74D8] text-white"
                  iconBg="bg-[#F1F2FD]"
                  iconColor="text-[#6F74D8]"
                />
              </div>
            </div>
            <div className="w-full xl:w-[360px] shrink-0">
              <ActivityFeedPlaceholder />
            </div>
          </div>

          <OdevParkuru />
          <OdevKutuphanesi />
        </div>

        <Footer mini containerClassName={`${FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS} mx-auto`} />
      </main>
    </div>
  );
}
