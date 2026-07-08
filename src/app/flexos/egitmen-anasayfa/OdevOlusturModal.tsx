"use client";

/**
 * FlexOS · Ödev Oluştur — Claude Design çıktısından (`Ödev Oluştur.dc.html`) BİREBİR
 * UI portu. Ödev Parkuru'ndaki "+Ödev Ver" butonuna bağlı (egitmen-anasayfa/page.tsx).
 * Gerçek backend: `POST /api/flexos/assignments` (`maxPuan`+`kind` dahil — 2026-07-06
 * eklenen alanlar), "Taslak Kaydet" → status=draft, "Ödevi Başlat" → status=published.
 *
 * **Şablon olarak kaydet** — KİŞİSEL kütüphane (2026-07-06 kararı: her eğitmen kendi
 * ödevini şablon olarak kaydedebilir, admine özel değil). `POST /api/flexos/assignment-
 * templates` — aktörün `template.manage` yetkisi self-scope olduğu için servis otomatik
 * `scope:"personal"` yazar (bkz. `assignment-service.ts::createTemplate`).
 *
 * **Geçiş animasyonu** — canlıdaki modal deseniyle AYNI (`management-components/
 * Modals.tsx`: backdrop fade + panel scale/y), FlexOS'un kendi paylaşımlı `FlexModal.tsx`
 * ile birebir aynı framer-motion değerleri (0.18s backdrop, 0.22s panel cubic-bezier).
 *
 * **`document.body`'ye portal (2026-07-06 düzeltme):** Ödev Parkuru kartlarındaki
 * `hover:-translate-y-1` gibi transform'lar üst elemanda `position:fixed`'in containing
 * block'unu değiştirip modalı viewport yerine o elemana göre (çarpık/kaymış) konumlandırıyordu.
 * Portal ile modal doğrudan `body` altına render edilir, bu sorun kökten ortadan kalkar.
 *
 * **Yükseklik: `dvh` + outer scroll KALDIRILDI (2026-07-06, 2. düzeltme):** `100vh` yerine
 * `100dvh` kullanılıyor (tarayıcı chrome'u genişleyip daraldıkça `vh` değişip modalı kaydırıyordu).
 * Ayrıca backdrop'un KENDİ `overflow-y-auto`'su kaldırıldı — modal zaten `dvh`'ye göre sınırlı,
 * backdrop'un scroll'a hiç ihtiyacı yok; backdrop'ta scrollbar belirip kaybolması (özellikle
 * "scrollbar'ları hep göster" ayarı açık Mac'lerde, ~15px genişlik) küçük bir yatay/dikey kayma
 * hissi yaratıyordu. İçerik taşarsa SADECE modalın kendi body'si (`overflow-y-auto` +
 * `scrollbarGutter:"stable"`) kayar, dış katman asla kaymaz.
 *
 * **Sabit `height` → `maxHeight` (2026-07-06, 3. düzeltme) → GERİ `height` (2026-07-06,
 * 4. düzeltme, kullanıcı: "genişlik ve yükseklik aynen korunmalı, oynamamalı asla"):**
 * `maxHeight` (auto-fit) denemesi yeni bir sorun açtı — ikon seçimi popup'ı açılınca
 * içerik büyüyüp modalın TAMAMI (panel) büyüyordu, kullanıcı bunu istemiyor. Kullanıcı
 * kararı: modal boyutu (genişlik+yükseklik) HER ZAMAN sabit kalmalı; içerik (ikon seçici
 * gibi) sığmazsa SADECE body kendi içinde scroll etsin, panel'in kendisi asla büyümesin/
 * küçülmesin. Çözüm: `height: min(820px, calc(100dvh-32px))` — sabit 820px (önceki 770'in
 * yetersiz çıkmasından ders alınarak ikon picker'ı da hesaba katan bolluk payıyla), viewport
 * gerçekten dar olduğunda hâlâ `dvh-32`'ye küçülür. Body'nin `flex-1 min-h-0 overflow-y-auto`'su
 * KORUNDU — ikon picker açıkken içerik 820px'i aşarsa SADECE body'de scroll çıkar, panel'in
 * boyutu değişmez. İkon picker kapalıyken normal içerik 820px'in altında kaldığı için scroll
 * hiç görünmez.
 *
 * **"Ödev Dosyası Yükle" BİTTİ (2026-07-08):** Classroom'daki gibi — dosya(lar) burada
 * SEÇİLİR ama HENÜZ yüklenmez (assignmentId henüz yok, ödev kaydedilmedi). "Taslak
 * Kaydet"/"Ödevi Başlat"a basınca SIRAYLA: (1) `POST /api/flexos/assignments` ödevi
 * oluşturur, (2) dönen `id` ile seçili dosyalar `uploadAssignmentAttachment` (paylaşımlı,
 * `EditAssignmentModal`'la AYNI fonksiyon) üzerinden Drive'a yüklenir. Kullanıcı tek bir
 * "Ödevi Başlat" tıklamasıyla hem ödevi hem dosyalarını göndermiş olur.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X, PenLine, BookOpen, LayoutGrid, ChevronDown, Check, Plus,
  UploadCloud, FileText, Loader2,
} from "lucide-react";
import { auth } from "@/app/lib/firebase";
import { ASSIGNMENT_ICONS, ASSIGNMENT_ICON_KEYS, ASSIGNMENT_KIND_OPTIONS } from "../odevler/_shared/assignmentIcons";
import { uploadAssignmentAttachment, ATTACHMENT_MAX_MB } from "../odevler/_shared/uploadAssignmentAttachment";

interface GroupItem { id: string; code: string; branch: string }

const ICONS = ASSIGNMENT_ICONS;
const ICON_KEYS = ASSIGNMENT_ICON_KEYS;

const PUAN_HIZLI = [100, 150, 200, 250, 300];
const TURLER = ASSIGNMENT_KIND_OPTIONS;

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

/** Kütüphane'den "Ödevi Başlat" ile açılınca şablonun alanlarıyla ön-doldurma. */
export interface AssignmentPrefill {
  templateId: string;
  title: string;
  subtitle?: string;
  description: string;
  icon?: string;
  kind?: "normal" | "proje";
  maxPuan?: number;
  /** Doluysa "Ödevi Başlat" normal teslim akışı yerine çekiliş ekranına yönlendirir. */
  gamifiedType?: "kolaj" | "kitap" | "sosyal";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  prefill?: AssignmentPrefill;
}

export default function OdevOlusturModal({ open, onClose, onCreated, prefill }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [odevAdi, setOdevAdi] = useState("");
  const [altBaslik, setAltBaslik] = useState("");
  const [icon, setIcon] = useState("pen");
  const [iconPickerAcik, setIconPickerAcik] = useState(false);
  const [tur, setTur] = useState<"normal" | "proje">("normal");
  const [groupId, setGroupId] = useState("");
  const [bitisTarihi, setBitisTarihi] = useState("");
  const [puan, setPuan] = useState(100);
  const [aciklama, setAciklama] = useState("");
  const [sablonAktif, setSablonAktif] = useState(false);
  const [sablonAdi, setSablonAdi] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [dosyaDragOver, setDosyaDragOver] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);

  // Kütüphane'den bir şablonla açılınca alanları o şablondan doldur; "+Ödev Ver" ile
  // (prefill yok) her açılışta boş forma dön.
  useEffect(() => {
    if (!open) return;
    setOdevAdi(prefill?.title ?? "");
    setAltBaslik(prefill?.subtitle ?? "");
    setIcon(prefill?.icon ?? "pen");
    setTur(prefill?.kind ?? "normal");
    setAciklama(prefill?.description ?? "");
    setPuan(prefill?.maxPuan ?? 100);
    setBitisTarihi("");
    setSablonAktif(false);
    setSablonAdi("");
    setPickedFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.templateId]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingGroups(true);
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/flexos/groups", { headers });
        if (res.ok) {
          const data = await res.json() as { items: GroupItem[] };
          setGroups(data.items);
          if (data.items.length > 0) setGroupId((cur) => cur || data.items[0].id);
        }
      } finally {
        setLoadingGroups(false);
      }
    })();
  }, [open]);

  async function submit(status: "draft" | "published") {
    if (!odevAdi.trim()) { toast.error("Ödev adı zorunludur."); return; }
    if (!aciklama.trim()) { toast.error("Açıklama zorunludur."); return; }
    if (!groupId) { toast.error("Grup seçin."); return; }

    setSaving(status === "draft" ? "draft" : "publish");
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/assignments", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          templateId: prefill?.templateId,
          title: odevAdi.trim(),
          subtitle: altBaslik.trim() || undefined,
          description: aciklama.trim(),
          dueDate: bitisTarihi || undefined,
          status,
          maxPuan: puan,
          kind: tur,
          icon,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Ödev oluşturulamadı.");
        return;
      }
      const created = await res.json() as { id: string };

      if (sablonAktif) {
        // Şablonun branşı seçili Gruptan otomatik türetilir — Ödev Ekle'de ayrı bir
        // branş seçici YOK (2026-07-06 kararı), branş zaten Grup seçimiyle belli.
        const branch = groups.find((g) => g.id === groupId)?.branch;
        const tplRes = await fetch("/api/flexos/assignment-templates", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: sablonAdi.trim() || odevAdi.trim(),
            description: aciklama.trim(),
            branch,
            subtitle: altBaslik.trim() || undefined,
            icon,
            kind: tur,
            maxPuan: puan,
          }),
        });
        if (!tplRes.ok) toast.error("Ödev oluşturuldu ama şablon kaydedilemedi.");
      }

      // Dosyalar SEÇİLDİĞİ anda değil, ödev gerçekten oluşturulup bir `id` alınca yüklenir
      // (Classroom'daki gibi tek adımmış hissi verir — kullanıcı: "aynı anda yüklüyorum").
      if (pickedFiles.length > 0 && created.id) {
        let failed = 0;
        for (let i = 0; i < pickedFiles.length; i++) {
          setUploadingLabel(`Dosya yükleniyor (${i + 1}/${pickedFiles.length})…`);
          try {
            await uploadAssignmentAttachment(created.id, pickedFiles[i]);
          } catch {
            failed++;
          }
        }
        setUploadingLabel(null);
        if (failed > 0) toast.error(`${failed} dosya yüklenemedi, ödevi Düzenle'den tekrar deneyebilirsiniz.`);
      }

      toast.success(status === "draft" ? "Taslak kaydedildi." : "Ödev başlatıldı.");
      onClose();
      if (prefill?.gamifiedType && created.id) {
        router.push(`/flexos/${prefill.gamifiedType}?assignmentId=${created.id}`);
      } else {
        onCreated();
      }
    } catch {
      toast.error("Ödev oluşturulamadı.");
    } finally {
      setSaving(null);
    }
  }

  const SeciliIcon = ICONS[icon];

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,26,48,.55)", backdropFilter: "blur(2px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full flex flex-col bg-white rounded-[22px] shadow-2xl overflow-hidden font-inter"
            style={{ maxWidth: 860, height: "min(820px, calc(100dvh - 32px))" }}
            initial={{ opacity: 0, scale: 0.98, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
        <div className="flex items-center justify-between gap-4 p-[24px] border-b border-[#EEF0F3]">
          <div className="flex items-center gap-[13px]">
            <div
              className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}
            >
              <PenLine size={22} color="#fff" />
            </div>
            <div>
              <div className="text-[17px] font-extrabold text-[#1E222B] tracking-tight">{prefill ? "Ödevi Başlat" : "Yeni Ödev Oluştur"}</div>
              <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{prefill ? "Şablondan grup ve tarih seçip başlatın" : "Ödev bilgilerini girin ve gruba başlatın"}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-[10px] border border-[#E2E5EA] bg-white flex items-center justify-center text-[#8E95A3] hover:bg-[#F7F8FA] hover:text-[#414B59] transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* body — kompakt: alanlar küçültüldü, Açıklama serbest kalan boşluğu (flex-1)
            doldurup gerçekten 4-5 satırlık bir alan olarak büyüyor, boş alan kalmıyor */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 p-[24px] overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          {/* Ödev Adı (üst) + Alt Başlık (alt) solda; İkon seçimi sağda, dikey/uzun buton */}
          <div className="flex gap-2.5 items-stretch shrink-0">
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div>
                <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Ödev Adı</label>
                <input
                  className="w-full py-2 px-3 rounded-[10px] border border-[#E2E5EA] bg-white text-[13px] font-semibold text-[#1E222B] outline-none"
                  type="text" value={odevAdi} onChange={(e) => setOdevAdi(e.target.value)} placeholder="Örn. Poster Tasarım Ödevi"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Alt Başlık</label>
                <input
                  className="w-full py-2 px-3 rounded-[10px] border border-[#E2E5EA] bg-white text-[13px] font-semibold text-[#1E222B] outline-none"
                  type="text" value={altBaslik} onChange={(e) => setAltBaslik(e.target.value)} placeholder="Kısa bir alt başlık (opsiyonel)"
                />
              </div>
            </div>
            <div className="w-[114px] shrink-0 flex flex-col">
              <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">İkon Seçimi</label>
              <button
                type="button"
                onClick={() => setIconPickerAcik((v) => !v)}
                className="flex-1 rounded-[10px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                style={{ border: `1px solid ${iconPickerAcik ? "#205297" : "#E2E5EA"}`, background: iconPickerAcik ? "#EFF5FE" : "#fff", color: "#205297" }}
              >
                <SeciliIcon size={19} />
                <span className="inline-flex items-center gap-1 text-[10px] font-bold">
                  Seç
                  <ChevronDown size={11} color="#8E95A3" style={{ transform: iconPickerAcik ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
                </span>
              </button>
            </div>
          </div>

          {/* icon picker popup */}
          {iconPickerAcik && (
            <div className="border border-[#E2E5EA] rounded-[12px] p-2.5 bg-[#FBFCFD] shrink-0">
              <div className="text-[10.5px] font-bold text-[#8E95A3] mb-2">Bir ikon seçin</div>
              <div className="grid grid-cols-8 gap-1.5">
                {ICON_KEYS.map((key) => {
                  const Icon = ICONS[key];
                  const aktif = key === icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setIcon(key); setIconPickerAcik(false); }}
                      className="aspect-square rounded-[9px] flex items-center justify-center cursor-pointer transition-all"
                      style={{ border: `1px solid ${aktif ? "#205297" : "#E2E5EA"}`, background: aktif ? "#205297" : "#fff", color: aktif ? "#fff" : "#6F7B87" }}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ödev türü + grup + bitiş tarihi — TEK satır */}
          <div className="flex gap-2.5 flex-wrap shrink-0">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Ödev Türü</label>
              <div className="grid grid-cols-2 gap-1.5">
                {TURLER.map((t) => {
                  const aktif = t.key === tur;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTur(t.key)}
                      className="flex items-center gap-1.5 py-2 px-2.5 rounded-[10px] cursor-pointer transition-all"
                      style={{ border: `1px solid ${aktif ? "#AECBF2" : "#E2E5EA"}`, background: aktif ? "#EFF5FE" : "#fff", color: "#1E222B" }}
                    >
                      <span
                        className="w-6 h-6 rounded-[8px] shrink-0 flex items-center justify-center"
                        style={{ background: aktif ? "#DDE8F8" : "#F2F4F7", color: aktif ? "#205297" : "#8E95A3" }}
                      >
                        {t.key === "proje" ? <LayoutGrid size={12} /> : <PenLine size={12} />}
                      </span>
                      <span className="text-[12px] font-bold">{t.label}</span>
                      {aktif && <Check size={13} strokeWidth={2.6} color="#205297" className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 min-w-[170px]">
              <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Grup</label>
              <div className="relative">
                <select
                  className="w-full py-2 pr-8 pl-3 rounded-[10px] border border-[#E2E5EA] bg-white text-[13px] font-semibold text-[#1E222B] outline-none cursor-pointer appearance-none"
                  value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={loadingGroups}
                >
                  {groups.length === 0 && <option value="">{loadingGroups ? "Yükleniyor…" : "Grup yok"}</option>}
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.branch}</option>)}
                </select>
                <ChevronDown size={14} color="#8E95A3" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Bitiş Tarihi</label>
              <input
                className="w-full py-2 px-3 rounded-[10px] border border-[#E2E5EA] bg-white text-[13px] font-semibold text-[#1E222B] outline-none"
                type="date" value={bitisTarihi} onChange={(e) => setBitisTarihi(e.target.value)}
              />
            </div>
          </div>

          {/* ödev puanı */}
          <div className="shrink-0">
            <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Ödev Puanı</label>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative shrink-0">
                <input
                  className="w-[120px] py-2 pl-3 pr-[42px] rounded-[10px] border border-[#E2E5EA] bg-white text-[14px] font-extrabold text-[#1E222B] outline-none"
                  type="number" min={0} value={puan} onChange={(e) => setPuan(Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#8E95A3] pointer-events-none">puan</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {PUAN_HIZLI.map((p) => {
                  const aktif = puan === p;
                  return (
                    <button
                      key={p} type="button" onClick={() => setPuan(p)}
                      className="py-1 px-2.5 rounded-[9px] text-[11.5px] font-bold cursor-pointer transition-all"
                      style={{ border: `1px solid ${aktif ? "#205297" : "#E2E5EA"}`, background: aktif ? "#EFF5FE" : "#fff", color: aktif ? "#205297" : "#6F7B87" }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* açıklama — sabit 4-5 satır (flex-grow'lu deneme görsel çakışmaya sebep oldu, kaldırıldı) */}
          <div className="shrink-0">
            <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Açıklama</label>
            <textarea
              className="w-full py-2 px-3 rounded-[10px] border border-[#E2E5EA] bg-white text-[13px] font-medium text-[#1E222B] outline-none resize-none"
              rows={4}
              value={aciklama} onChange={(e) => setAciklama(e.target.value)}
              placeholder="Ödevin detaylarını, beklentileri ve teslim koşullarını yazın..."
            />
          </div>

          {/* Ödev Dosyası Yükle (sol — seçilir, ödev kaydedilince yüklenir) + Şablon olarak kaydet (sağda) */}
          <div className="flex gap-2.5 items-stretch shrink-0">
            <div className="flex-1 min-w-0">
              <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Ödev Dosyası Yükle</label>
              <label
                onDragOver={(e) => { e.preventDefault(); setDosyaDragOver(true); }}
                onDragLeave={() => setDosyaDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDosyaDragOver(false);
                  setPickedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
                }}
                className="w-full h-[52px] rounded-[10px] border border-dashed flex items-center justify-start gap-2 px-3.5 cursor-pointer transition-all"
                style={{ borderColor: dosyaDragOver ? "#6F74D8" : "#D3D8E0", background: dosyaDragOver ? "#F2F2FC" : "#FBFCFD", color: dosyaDragOver ? "#6F74D8" : "#8E95A3" }}
              >
                <UploadCloud size={16} className="shrink-0" />
                <span className="text-[11.5px] font-semibold text-left">
                  {pickedFiles.length > 0 ? `${pickedFiles.length} dosya seçildi — daha ekleyin` : `Dosyaları sürükleyin veya seçin (${ATTACHMENT_MAX_MB}MB'a kadar)`}
                </span>
                <input
                  type="file" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) setPickedFiles((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; }}
                />
              </label>
              {pickedFiles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {pickedFiles.map((f, i) => (
                    <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-semibold" style={{ background: "#F2F4F7", color: "#414B59" }}>
                      <FileText size={11} className="shrink-0" />
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      <button type="button" onClick={() => setPickedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="cursor-pointer text-[#AEB4C0] hover:text-[#414B59]">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* Zaten bir şablondan başlatılıyorsa (Kütüphane'den prefill) tekrar şablona
                kaydetmek anlamsız — sadece "+Ödev Ver" (custom ödev) akışında gösterilir. */}
            {!prefill && (
              <div className="w-[200px] shrink-0">
                <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Şablon olarak kaydet</label>
                <button
                  type="button" onClick={() => setSablonAktif((v) => !v)}
                  className="w-full h-[52px] flex items-center justify-between gap-2 px-3 rounded-[10px] cursor-pointer transition-all"
                  style={{ border: `1px solid ${sablonAktif ? "#D8C7EE" : "#E2E5EA"}`, background: sablonAktif ? "#FAF6FE" : "#fff" }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-[26px] h-[26px] rounded-[8px] shrink-0 flex items-center justify-center" style={{ background: "#EDE4FB", color: "#6B29A8" }}>
                      <BookOpen size={13} />
                    </span>
                    <span className="text-[11px] font-bold text-[#1E222B] text-left">Kütüphaneye ekle</span>
                  </span>
                  <span className="relative rounded-full shrink-0" style={{ width: 34, height: 19, background: sablonAktif ? "#6B29A8" : "#CDD2DA" }}>
                    <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: sablonAktif ? 17 : 2, width: 15, height: 15 }} />
                  </span>
                </button>
              </div>
            )}
          </div>

          {!prefill && sablonAktif && (
            <div className="shrink-0">
              <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Şablon Adı</label>
              <input
                className="w-full py-2 px-3 rounded-[10px] border border-[#E2E5EA] bg-white text-[13px] font-semibold text-[#1E222B] outline-none"
                type="text" value={sablonAdi} onChange={(e) => setSablonAdi(e.target.value)} placeholder="Örn. Grafik Tasarım — Poster Şablonu"
              />
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 p-[24px] border-t border-[#EEF0F3] bg-[#FBFCFD]">
          <button
            type="button" onClick={onClose}
            className="py-3 px-5 rounded-xl border border-[#E2E5EA] bg-white text-[#414B59] text-[13.5px] font-bold cursor-pointer hover:bg-[#F2F4F7] transition-colors"
          >
            İptal
          </button>
          {uploadingLabel && (
            <span className="text-[12px] font-semibold text-[#8E95A3] flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> {uploadingLabel}
            </span>
          )}
          <div className="flex items-center gap-2.5">
            <button
              type="button" onClick={() => submit("draft")} disabled={saving !== null}
              className="py-3 px-5 rounded-xl border border-[#E2E5EA] bg-white text-[#414B59] text-[13.5px] font-bold cursor-pointer hover:bg-[#F2F4F7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving === "draft" ? "Kaydediliyor…" : "Taslak Kaydet"}
            </button>
            <button
              type="button" onClick={() => submit("published")} disabled={saving !== null}
              className="inline-flex items-center gap-2 py-3 px-6 rounded-xl border-none text-white text-[13.5px] font-extrabold cursor-pointer transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)", boxShadow: "0 10px 20px -8px rgba(214,101,0,.5)" }}
            >
              <Plus size={16} strokeWidth={2.4} />
              {saving === "publish" ? "Başlatılıyor…" : "Ödevi Başlat"}
            </button>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
