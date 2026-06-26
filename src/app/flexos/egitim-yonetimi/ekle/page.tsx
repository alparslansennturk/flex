"use client";

/**
 * FlexOS · Eğitim Yönetimi — "Yeni Eğitim Ekle" formu.
 * Tasarım: _design/egitim-ekle (Claude Design — "Eğitim Ekle.dc.html") React'e portlandı.
 *
 * DURUM: UI + TÜM yerel etkileşim çalışır (4 sekme, bölüm/track ağacı, gün planlayıcı,
 * fiyat havuzu + KDV hesabı). Backend'e (POST /api/flexos/educations) HENÜZ BAĞLI DEĞİL —
 * "Kaydet" ve "Satışa Başlat" şimdilik tasarımdaki gibi yereldir. İşlevsellik sonra.
 *
 * Katalog sayfasıyla birebir aynı desen: inline S/IC, Inter, authStateReady korumalı.
 */

import React, { useEffect, useRef, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexModal from "../../_components/FlexModal";

// ── model tipleri (yerel; backend'e bağlanınca DTO'ya map'lenecek) ────────────
interface Track {
  id: number;
  name: string;
  sellable: boolean;
  hours: number;
}
interface Bolum {
  id: number;
  name: string;
  hours: number;
  tracks: Track[];
}
interface DayData {
  ad: string;
  konular: string[];
  draft: string;
}
interface PriceRow {
  id: number;
  key: string;
  name: string;
  kind: string;
  liste: string;
}
type TabKey = "genel" | "icerikler" | "fiyat" | "sertifikasyon";

interface FormState {
  activeTab: TabKey;
  published: boolean;
  saved: boolean;
  bransId: string;
  egitimAdi: string;
  egitimYapisi: "Standart Paket" | "Track Bazlı";
  egitimTipi: "Bireysel" | "Kurumsal";
  satisModeli: string;
  egitimOrtami: string;
  sozlesmeTipi: string;
  kdvOrani: string;
  aciklama: string;
  icerikMetni: string; // Standart Paket: web sitesinden yapıştırılan düz içerik metni
  gunSayisi: string;
  bolumler: Bolum[];
  dBolumAd: string;
  dBolumSaat: string;
  dTrackAd: string;
  dTrackSell: boolean;
  dTrackSaat: string;
  dTrackTarget: string;
  days: Record<number, DayData>;
  priceRows: PriceRow[];
  poolSel: string;
  sertTipi: string;
  paraBirimi: "TL" | "USD" | "EUR";
  seq: number;
}

const INITIAL: FormState = {
  activeTab: "genel",
  published: false,
  saved: false,
  bransId: "",
  egitimAdi: "",
  egitimYapisi: "Standart Paket",
  egitimTipi: "Bireysel",
  satisModeli: "Grup Eğitimi",
  egitimOrtami: "Yüz Yüze",
  sozlesmeTipi: "Mesafeli Satış Sözleşmesi",
  kdvOrani: "10",
  aciklama: "",
  icerikMetni: "",
  gunSayisi: "3",
  bolumler: [],
  dBolumAd: "",
  dBolumSaat: "",
  dTrackAd: "",
  dTrackSell: false,
  dTrackSaat: "",
  dTrackTarget: "",
  days: {},
  priceRows: [],
  poolSel: "__main",
  sertTipi: "Sınav Bazlı",
  paraBirimi: "TL",
  seq: 1,
};

const SYMBOLS: Record<string, string> = { TL: "TL", USD: "$", EUR: "€" };

export default function EgitimEklePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [s, setForm] = useState<FormState>(INITIAL);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [eduId, setEduId] = useState<string | null>(null); // ilk kayıttan sonra dolu → günceller
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "save" | "publish" | "unpublish">(null);
  const [editingTrack, setEditingTrack] = useState<{ bId: number; tId: number; name: string; hours: string; sellable: boolean } | null>(null);
  const [dragTrack, setDragTrack] = useState<{ bId: number; tId: number } | null>(null);
  const [dragBolum, setDragBolum] = useState<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }
      if (!cancelled) setAuthed(true);
      try {
        const token = await user.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        // Branş havuzu (Eğitim Ayarları → Branş Havuzu'ndan eklenenler)
        const res = await fetch("/api/flexos/branches", { headers });
        if (res.ok) {
          const j = await res.json();
          if (!cancelled) setBranches(j.items ?? []);
        }
        // Düzenleme modu — ?id varsa eğitimi + bölüm/track'leri forma geri doldur
        const editId = new URLSearchParams(window.location.search).get("id");
        if (editId) {
          const [eRes, sRes, tRes] = await Promise.all([
            fetch(`/api/flexos/educations/${editId}`, { headers }),
            fetch(`/api/flexos/sections?educationId=${editId}`, { headers }),
            fetch(`/api/flexos/tracks?educationId=${editId}`, { headers }),
          ]);
          if (eRes.ok && !cancelled) {
            const edu = (await eRes.json()).item;
            const secList = sRes.ok ? (await sRes.json()).items ?? [] : [];
            const trkList = tRes.ok ? (await tRes.json()).items ?? [] : [];
            if (!cancelled) { prefillForm(edu, secList, trkList); setEduId(editId); }
          }
        }
      } catch (e) {
        console.error("[egitim-ekle] veri yüklenemedi:", e);
      }
    })();
    return () => {
      cancelled = true;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [router]);

  // ── state yardımcıları (design'daki set/setState eşleri) ──
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p, saved: false })); // değişiklik = kaydedilmedi
  const selectTab = (t: TabKey) => setForm((f) => ({ ...f, activeTab: t, saved: false }));
  const flashSaved = () => {
    setForm((f) => ({ ...f, saved: true }));
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setForm((f) => ({ ...f, saved: false })), 1800);
  };

  // ── Düzenleme: API verisini forma geri doldur (server id → local id remap) ──
  const prefillForm = (
    edu: { name?: string; branchId?: string; audience?: string; structure?: string; outline?: string[]; vatRate?: number; listPrice?: number; onSale?: boolean; certType?: string },
    secList: Array<{ id: string; name: string; hours?: number; listPrice?: number; sellable?: boolean }>,
    trkList: Array<{ id: string; name: string; sectionId?: string; hours?: number; listPrice?: number; sellable?: boolean }>,
  ) => {
    let seq = 1;
    const secLocal = new Map<string, number>();
    const bolumler: Bolum[] = secList.map((sec) => {
      const localId = seq++;
      secLocal.set(sec.id, localId);
      return { id: localId, name: sec.name, hours: Number(sec.hours) || 0, tracks: [] as Track[] };
    });
    const bolumByLocal = new Map(bolumler.map((b) => [b.id, b]));
    const priceRows: PriceRow[] = [];
    if (edu.listPrice != null) priceRows.push({ id: seq++, key: "__main", name: edu.name ?? "", kind: "Ana Paket", liste: String(edu.listPrice) });
    secList.forEach((sec) => {
      const localId = secLocal.get(sec.id);
      if (localId != null && sec.sellable && sec.listPrice != null) priceRows.push({ id: seq++, key: "b" + localId, name: sec.name, kind: "Bölüm", liste: String(sec.listPrice) });
    });
    trkList.forEach((trk) => {
      const localId = seq++;
      const b = trk.sectionId ? bolumByLocal.get(secLocal.get(trk.sectionId) ?? -1) : undefined;
      if (b) {
        b.tracks.push({ id: localId, name: trk.name, hours: Number(trk.hours) || 0, sellable: !!trk.sellable });
        if (trk.sellable && trk.listPrice != null) priceRows.push({ id: seq++, key: "t" + localId, name: trk.name, kind: "Track", liste: String(trk.listPrice) });
      }
    });
    setForm((f) => ({
      ...f,
      egitimAdi: edu.name ?? "",
      bransId: edu.branchId ?? "",
      egitimTipi: edu.audience === "corporate" ? "Kurumsal" : "Bireysel",
      egitimYapisi: edu.structure === "sectioned" ? "Track Bazlı" : "Standart Paket",
      icerikMetni: edu.outline?.[0] ?? "",
      kdvOrani: edu.vatRate != null ? String(edu.vatRate) : f.kdvOrani,
      sertTipi: edu.certType === "project" ? "Proje Bazlı" : "Sınav Bazlı",
      published: edu.onSale ?? false,
      bolumler,
      priceRows,
      seq: seq + 1,
      saved: false,
    }));
  };

  const getSymbol = () => SYMBOLS[s.paraBirimi] || "TL";
  const fmtCurrency = (n: number) =>
    (Number(n) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " " + getSymbol();

  // ── bölüm & track aksiyonları ──
  const addBolum = () => {
    const ad = s.dBolumAd.trim();
    if (!ad) return;
    setForm((f) => {
      const id = f.seq;
      return {
        ...f,
        bolumler: [...f.bolumler, { id, name: ad, hours: Number(f.dBolumSaat) || 0, tracks: [] }],
        dBolumAd: "",
        dBolumSaat: "",
        dTrackTarget: f.dTrackTarget || String(id),
        dTrackSaat: !f.dTrackTarget ? String(Number(f.dBolumSaat) || 0) : f.dTrackSaat,
        seq: f.seq + 1,
        saved: false,
      };
    });
  };
  const removeBolum = (id: number) =>
    setForm((f) => {
      const bolumler = f.bolumler.filter((b) => b.id !== id);
      let dTrackTarget = f.dTrackTarget;
      if (String(id) === String(dTrackTarget)) dTrackTarget = bolumler.length ? String(bolumler[0].id) : "";
      return { ...f, bolumler, dTrackTarget, saved: false };
    });
  const toggleTrackSell = () =>
    setForm((f) => ({ ...f, dTrackSell: !f.dTrackSell, dTrackSaat: f.dTrackSell ? "" : f.dTrackSaat, saved: false }));
  // Hedef bölümün kalan saati (toplam - mevcut track'lerin saatleri)
  const targetBolum = s.bolumler.find((b) => b.id === Number(s.dTrackTarget));
  const usedHours = targetBolum ? targetBolum.tracks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0) : 0;
  const remainingHours = targetBolum ? Math.max(0, (Number(targetBolum.hours) || 0) - usedHours) : 0;

  const addTrack = () => {
    const ad = s.dTrackAd.trim();
    const target = Number(s.dTrackTarget);
    if (!ad || !target) return;
    const hrs = Number(s.dTrackSaat) || 0;
    if (hrs <= 0) return;
    if (hrs > remainingHours && remainingHours > 0) { toast.error(`Kalan saat ${remainingHours}. Fazla giremezsiniz.`); return; }
    setForm((f) => {
      const id = f.seq;
      return {
        ...f,
        bolumler: f.bolumler.map((b) =>
          b.id === target
            ? { ...b, tracks: [...b.tracks, { id, name: ad, sellable: f.dTrackSell, hours: hrs }] }
            : b,
        ),
        dTrackAd: "",
        dTrackSell: false,
        dTrackSaat: (() => {
          const b = f.bolumler.find((b) => b.id === target);
          if (!b) return "";
          const newUsed = b.tracks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0) + hrs;
          const rem = Math.max(0, (Number(b.hours) || 0) - newUsed);
          return rem > 0 ? String(rem) : "";
        })(),
        seq: f.seq + 1,
        saved: false,
      };
    });
  };
  const removeTrack = (bId: number, tId: number) =>
    setForm((f) => ({
      ...f,
      bolumler: f.bolumler.map((b) => (b.id === bId ? { ...b, tracks: b.tracks.filter((t) => t.id !== tId) } : b)),
      saved: false,
    }));

  // ── track düzenle ──
  const startEditTrack = (bId: number, t: Track) =>
    setEditingTrack({ bId, tId: t.id, name: t.name, hours: String(t.hours), sellable: t.sellable });
  const saveEditTrack = () => {
    if (!editingTrack) return;
    const { bId, tId, name, hours, sellable } = editingTrack;
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Track adı boş olamaz."); return; }
    const hrs = Number(hours) || 0;
    if (hrs <= 0) { toast.error("Track saati 0'dan büyük olmalı."); return; }
    // kalan saat kontrolü (düzenlenen track'in kendi saati hariç)
    const bolum = s.bolumler.find((b) => b.id === bId);
    if (bolum) {
      const otherHours = bolum.tracks.filter((t) => t.id !== tId).reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
      const remaining = Math.max(0, (Number(bolum.hours) || 0) - otherHours);
      if (hrs > remaining && remaining > 0) { toast.error(`Kalan saat ${remaining}. Fazla giremezsiniz.`); return; }
    }
    setForm((f) => ({
      ...f,
      bolumler: f.bolumler.map((b) =>
        b.id === bId
          ? { ...b, tracks: b.tracks.map((t) => (t.id === tId ? { ...t, name: trimmed, hours: hrs, sellable } : t)) }
          : b,
      ),
      saved: false,
    }));
    setEditingTrack(null);
  };
  const cancelEditTrack = () => setEditingTrack(null);

  // ── track sürükle-bırak sıralama ──
  const onTrackDragStart = (bId: number, tId: number) => setDragTrack({ bId, tId });
  const onTrackDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onTrackDrop = (bId: number, targetTId: number) => {
    if (!dragTrack || dragTrack.bId !== bId || dragTrack.tId === targetTId) { setDragTrack(null); return; }
    setForm((f) => {
      const bolumler = f.bolumler.map((b) => {
        if (b.id !== bId) return b;
        const tracks = [...b.tracks];
        const fromIdx = tracks.findIndex((t) => t.id === dragTrack.tId);
        const toIdx = tracks.findIndex((t) => t.id === targetTId);
        if (fromIdx === -1 || toIdx === -1) return b;
        const [moved] = tracks.splice(fromIdx, 1);
        // Aşağı sürüklemede splice sonrası index 1 kayar
        const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
        tracks.splice(insertIdx, 0, moved);
        return { ...b, tracks };
      });
      return { ...f, bolumler, saved: false };
    });
    setDragTrack(null);
  };

  // ── bölüm sürükle-bırak sıralama ──
  const onBolumDragStart = (bId: number) => setDragBolum(bId);
  const onBolumDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onBolumDrop = (targetBId: number) => {
    if (dragBolum === null || dragBolum === targetBId) { setDragBolum(null); return; }
    setForm((f) => {
      const bolumler = [...f.bolumler];
      const fromIdx = bolumler.findIndex((b) => b.id === dragBolum);
      const toIdx = bolumler.findIndex((b) => b.id === targetBId);
      if (fromIdx === -1 || toIdx === -1) return f;
      const [moved] = bolumler.splice(fromIdx, 1);
      const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
      bolumler.splice(insertIdx, 0, moved);
      return { ...f, bolumler, saved: false };
    });
    setDragBolum(null);
  };

  // ── gün planlayıcı ──
  const getDay = (n: number): DayData => s.days[n] || { ad: "", konular: [], draft: "" };
  const setDay = (n: number, p: Partial<DayData>) =>
    setForm((f) => {
      const cur = f.days[n] || { ad: "", konular: [], draft: "" };
      return { ...f, days: { ...f.days, [n]: { ...cur, ...p } }, saved: false };
    });
  const addKonu = (n: number) => {
    const d = getDay(n);
    const t = (d.draft || "").trim();
    if (!t) return;
    setDay(n, { konular: [...d.konular, t], draft: "" });
  };
  const removeKonu = (n: number, idx: number) => {
    const d = getDay(n);
    setDay(n, { konular: d.konular.filter((_, i) => i !== idx) });
  };

  // ── fiyat havuzu ──
  interface PoolOpt { value: string; label: string; kind: string; hours?: number }
  const poolList = (): PoolOpt[] => {
    const main: PoolOpt = { value: "__main", label: (s.egitimAdi.trim() || "Ana Paket") + " (Ana Paket)", kind: "Ana Paket" };
    const items: PoolOpt[] = [main];
    s.bolumler.forEach((b) => {
      items.push({ value: "b" + b.id, label: b.name + " (Bölüm)", kind: "Bölüm", hours: b.hours });
      b.tracks.forEach((t) => {
        if (t.sellable) items.push({ value: "t" + t.id, label: "  " + t.name + " (Track)", kind: "Track", hours: t.hours });
      });
    });
    return items;
  };
  const totalHours = () => s.bolumler.reduce((sum, b) => sum + (Number(b.hours) || 0), 0);
  const sureFor = (key: string) => {
    const isGun = s.egitimTipi === "Kurumsal";
    if (key === "__main") return isGun ? `${s.gunSayisi} Gün` : `${totalHours()} Saat`;
    const tid = Number(key.slice(1));
    let h = 0;
    s.bolumler.forEach((b) => b.tracks.forEach((t) => { if (t.id === tid) h = t.hours; }));
    return h + " Saat";
  };
  const addPriceRow = () => {
    if (!s.poolSel) return;
    if (s.priceRows.some((r) => r.key === s.poolSel)) return;
    const opt = poolList().find((o) => o.value === s.poolSel);
    if (!opt) return;
    setForm((f) => {
      const id = f.seq;
      return {
        ...f,
        priceRows: [...f.priceRows, { id, key: opt.value, name: opt.label.replace(/\s*\((Ana Paket|Track)\)$/, ""), kind: opt.kind, liste: "" }],
        seq: f.seq + 1,
        saved: false,
      };
    });
  };
  const removePriceRow = (id: number) => setForm((f) => ({ ...f, priceRows: f.priceRows.filter((r) => r.id !== id), saved: false }));
  const setListe = (id: number, val: string) =>
    setForm((f) => ({ ...f, priceRows: f.priceRows.map((r) => (r.id === id ? { ...r, liste: val } : r)), saved: false }));

  // ── türetilmiş değerler ──
  const isBireysel = s.egitimTipi === "Bireysel";
  const isKurumsal = s.egitimTipi === "Kurumsal";
  // Süre tipi artık Eğitim Tipi'nden türetilir: Bireysel=Saat, Kurumsal=Gün.
  const isSaat = isBireysel;
  const isGun = isKurumsal;
  const kdv = Number(s.kdvOrani) || 0;
  const yapiStd = s.egitimYapisi === "Standart Paket";
  const hasBolum = s.bolumler.length > 0;
  const trackLocked = !hasBolum;
  const canAddBolum = s.dBolumAd.trim().length > 0 && Number(s.dBolumSaat) > 0;
  const canAddTrack = hasBolum && s.dTrackAd.trim().length > 0 && Number(s.dTrackSaat) > 0;

  const gun = Math.max(1, Math.min(60, Number(s.gunSayisi) || 1));
  const days = Array.from({ length: gun }, (_, i) => i + 1);

  const poolOptions = poolList();
  const alreadyAdded = s.priceRows.some((r) => r.key === s.poolSel);
  const canAddPrice = !!s.poolSel && !alreadyAdded;

  // İçerik yeterliliği: Kurumsal → en az bir günün başlığı dolu; Bireysel+Track Bazlı → en az bir bölüm;
  // Bireysel+Standart Paket → paket başlı başına yeterli.
  const contentOk = isKurumsal
    ? days.some((n) => (getDay(n).ad || "").trim().length > 0)
    : !yapiStd
    ? hasBolum
    : s.icerikMetni.replace(/<[^>]*>/g, "").trim().length > 0; // Standart Paket: içerik metni dolu olmalı
  // Ana paket fiyatı (yayın için zorunlu)
  const mainPriceVal = (() => {
    const r = s.priceRows.find((x) => x.key === "__main");
    return r ? Number(r.liste) || 0 : 0;
  })();
  // Yayın engelleri — hepsi temizlenmeden "Satışa Başlat" açılmaz
  const publishBlockers: string[] = [];
  if (!s.bransId) publishBlockers.push("Branş");
  if (!s.egitimAdi.trim()) publishBlockers.push("Eğitim adı");
  if (!contentOk) publishBlockers.push(isKurumsal ? "Gün planı" : !yapiStd ? "Bölüm/Track" : "İçerik metni");
  if (!(mainPriceVal > 0)) publishBlockers.push("Ana paket fiyatı");
  const canPublish = publishBlockers.length === 0;
  const publishActive = canPublish || s.published;

  const statusText = s.published
    ? "Yayında — satış kataloğunda"
    : canPublish
    ? "Yayına hazır"
    : "Taslak — eksik: " + publishBlockers.join(", ");
  const statusDot = s.published ? "#22c55e" : canPublish ? "#f59e0b" : "#cbd5e1";

  const saveHints: Record<TabKey, string> = {
    genel: "Genel bilgileri kaydedin.",
    icerikler: "İçerik yapısını kaydedin.",
    fiyat: "Fiyat listesini kaydedin.",
    sertifikasyon: "Sertifikasyon ayarlarını kaydedin.",
  };
  const sertText = "Katılım Sertifikası veya Başarı Sertifikası";

  // bir alanı değiştiren generic input handler kestirmesi
  const onChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    patch({ [key]: e.target.value } as Partial<FormState>);

  const soon = () => toast.info("Bu özellik yakında — şimdilik form yerel çalışıyor (backend bağlanmadı).");

  // dinamik buton stili (etkin/pasif)
  const addBtn = (enabled: boolean, accent: string): CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none",
    fontFamily: "inherit", fontSize: "13.5px", fontWeight: 700, whiteSpace: "nowrap",
    cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? accent : "#e8edf4", color: enabled ? "#fff" : "#a9b4c4",
    boxShadow: enabled ? "0 6px 14px -7px rgba(67,56,202,.6)" : "none",
  });

  const publishStyle: CSSProperties = s.published
    ? { ...S.publishBase, cursor: "pointer", background: "#fef2f2", color: "#dc2626", boxShadow: "inset 0 0 0 1px #fecaca" }
    : canPublish
    ? { ...S.publishBase, cursor: "pointer", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }
    : { ...S.publishBase, cursor: "not-allowed", background: "#e8edf4", color: "#a9b4c4" };

  // ── DB kaydetme (Taslak / Satışa Başlat / Satışı Kapat) ──
  const priceForKey = (key: string): number | undefined => {
    const r = s.priceRows.find((x) => x.key === key);
    return r && String(r.liste).trim() !== "" ? Number(r.liste) || 0 : undefined;
  };
  const authHeaders = async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  /** Eğitimi DB'ye yazar (yoksa oluşturur, varsa günceller). publish = satışa açık mı. */
  const saveEducation = async (publish: boolean): Promise<boolean> => {
    if (!s.egitimAdi.trim()) { toast.error("Eğitim adı zorunludur."); return false; }
    if (!s.bransId) { toast.error("Önce branş seçin."); return false; }
    if (publish && !canPublish) { toast.error("Satışa başlatmak için eksik: " + publishBlockers.join(", ")); return false; }
    setBusy(true);
    try {
      const headers = await authHeaders();
      const audience = isKurumsal ? "corporate" : "individual";
      const structure = isBireysel && !yapiStd ? "sectioned" : "single";
      const outline = isBireysel && yapiStd && s.icerikMetni.trim() ? [s.icerikMetni] : undefined;

      if (!eduId) {
        const certType = s.sertTipi === "Proje Bazlı" ? "project" as const : "exam" as const;
        const res = await fetch("/api/flexos/educations", {
          method: "POST", headers,
          body: JSON.stringify({ name: s.egitimAdi.trim(), branchId: s.bransId, audience, structure, outline, listPrice: priceForKey("__main"), vatRate: kdv, onSale: publish, certType }),
        });
        if (res.status !== 201) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Kaydedilemedi."); return false; }
        const { id } = await res.json();
        setEduId(id);
        // Track Bazlı → bölüm + track kayıtları (ilk kayıtta oluşturulur)
        if (isBireysel && !yapiStd) {
          for (let i = 0; i < s.bolumler.length; i++) {
            const b = s.bolumler[i];
            const sres = await fetch("/api/flexos/sections", {
              method: "POST", headers,
              body: JSON.stringify({ name: b.name, educationId: id, order: i, hours: b.hours, listPrice: priceForKey("b" + b.id), sellable: priceForKey("b" + b.id) !== undefined }),
            });
            const secId = sres.status === 201 ? (await sres.json()).id : undefined;
            for (let j = 0; j < b.tracks.length; j++) {
              const trk = b.tracks[j];
              await fetch("/api/flexos/tracks", {
                method: "POST", headers,
                body: JSON.stringify({ name: trk.name, educationId: id, sectionId: secId, order: j, hours: trk.hours, sellable: trk.sellable, listPrice: priceForKey("t" + trk.id) }),
              });
            }
          }
        }
      } else {
        // Scalar alanları güncelle
        const certType = s.sertTipi === "Proje Bazlı" ? "project" as const : "exam" as const;
        const res = await fetch(`/api/flexos/educations/${eduId}`, {
          method: "PATCH", headers,
          body: JSON.stringify({ name: s.egitimAdi.trim(), branchId: s.bransId, audience, structure, outline, listPrice: priceForKey("__main"), vatRate: kdv, onSale: publish, certType }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Güncellenemedi."); return false; }
        // Bölüm/Track ağacını senkronize et (Track Bazlı ise)
        if (isBireysel && !yapiStd && s.bolumler.length > 0) {
          const syncBody = {
            sections: s.bolumler.map((b, i) => ({
              name: b.name,
              order: i,
              hours: b.hours || undefined,
              listPrice: priceForKey("b" + b.id),
              sellable: priceForKey("b" + b.id) !== undefined,
              tracks: b.tracks.map((trk, j) => ({
                name: trk.name,
                order: j,
                hours: trk.hours || undefined,
                listPrice: priceForKey("t" + trk.id),
                sellable: trk.sellable,
              })),
            })),
          };
          const cRes = await fetch(`/api/flexos/educations/${eduId}/content`, {
            method: "PUT", headers,
            body: JSON.stringify(syncBody),
          });
          if (!cRes.ok) { const j = await cRes.json().catch(() => ({})); toast.error(j.error || "İçerik kaydedilemedi."); return false; }
        }
      }
      setForm((f) => ({ ...f, published: publish }));
      flashSaved();
      return true;
    } catch (e) {
      console.error("[egitim-ekle] kaydetme hatası:", e);
      toast.error("Bağlantı hatası — kaydedilemedi.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runModal = async () => {
    const kind = modal;
    if (!kind) return;
    const ok = await saveEducation(kind === "publish" ? true : kind === "unpublish" ? false : s.published);
    if (ok) {
      setModal(null);
      toast.success(kind === "publish" ? "Eğitim satışa açıldı." : kind === "unpublish" ? "Satış kapatıldı — taslağa alındı." : "Taslak kaydedildi.");
    }
  };

  const modalCfg = {
    save: { title: "Taslak olarak kaydet", message: <>Eğitim <strong>taslak</strong> olarak kaydedilecek. Katalogda “Taslak” görünür, henüz satışa açılmaz.</>, confirmLabel: "Kaydet", tone: "primary" as const },
    publish: { title: "Satışa başlat", message: <>Eğitim <strong>satışa açılacak</strong> ve satış kataloğunda “Satışta” görünecek. Emin misin?</>, confirmLabel: "Satışa Başlat", tone: "publish" as const },
    unpublish: { title: "Satışı kapat", message: <>Eğitim satıştan kaldırılıp <strong>taslağa</strong> alınacak. Devam edilsin mi?</>, confirmLabel: "Satışı Kapat", tone: "danger" as const },
  };

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="ee-spin" />
        <style>{globalCss}</style>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="egitimler" />

      {/* ============ MAIN ============ */}
      <main style={S.main}>
        {/* header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <a className="ee-iconbtn" style={S.backBtn} title="Kataloğa dön" onClick={() => router.push("/flexos/egitim-yonetimi")}>
              <span dangerouslySetInnerHTML={{ __html: IC.back }} />
            </a>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>
                <span>Eğitim Yönetimi</span>
                <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                <span style={{ color: "#f97316" }}>{eduId ? "Düzenle" : "Yeni Kayıt"}</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#0f1f3d" }}>{eduId ? "Eğitimi Düzenle" : "Yeni Eğitim Ekle"}</h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button className="ee-iconbtn" style={S.bellBtn} onClick={soon}>
              <span dangerouslySetInnerHTML={{ __html: IC.bell }} />
              <span style={S.bellDot} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #e2e8f1" }}>
              <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f1f3d" }}>Alparslan Şentürk</div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>Yönetici · Eğitmen</div>
              </div>
              <div style={S.avatar}>AŞ</div>
            </div>
          </div>
        </header>

        <div style={{ padding: "26px 36px 64px", maxWidth: 1080, margin: "0 auto", width: "100%", minWidth: 0, boxSizing: "border-box", overflowX: "hidden" }}>
          {/* published banner */}
          {s.published && (
            <div style={S.banner}>
              <span style={S.bannerIcon} dangerouslySetInnerHTML={{ __html: IC.checkBanner }} />
              <div style={{ fontSize: 14, color: "#15803d", fontWeight: 600 }}>
                Eğitim satış ekiplerinin kataloğuna gönderildi — şu an <strong>satışta</strong>.
              </div>
            </div>
          )}

          {/* top action row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", flex: "0 0 auto", background: statusDot }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#64748b" }}>{statusText}</span>
            </div>
            <button style={publishStyle} disabled={!publishActive} onClick={() => publishActive && setModal(s.published ? "unpublish" : "publish")}>
              <span style={{ position: "relative", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: s.published ? IC.stop : IC.rocket }} />
              <span style={{ position: "relative" }}>{s.published ? "Satışı Kapat" : "Satışa Başlat"}</span>
            </button>
          </div>

          {/* tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid #e2e8f1", marginBottom: 24, overflowX: "auto" }}>
            {TABS.map((t) => {
              const active = s.activeTab === t.key;
              return (
                <button key={t.key} onClick={() => selectTab(t.key)} style={tabStyle(active)}>
                  <span style={tabNumStyle(active)}>{t.num}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* ============ CARD ============ */}
          <div style={{ ...S.card, width: "100%" }}>
            <div style={{ padding: "30px 32px 26px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
              {/* ===== TAB 1: GENEL ===== */}
              {s.activeTab === "genel" && (
                <div style={{ maxWidth: 580 }}>
                  {/* Branş — merkezî branş listesinden seçilir (ileride GET /api/flexos/branches'e bağlanacak). Şimdilik boş. */}
                  <div style={{ marginBottom: 22 }}>
                    <label style={S.label}>Branş</label>
                    <div style={{ position: "relative" }}>
                      <select className="ee-select" value={s.bransId} onChange={onChange("bransId")} style={S.select}>
                        <option value="">{branches.length ? "Branş seçin…" : "Branş yok — Eğitim Ayarları › Branş Havuzu'ndan ekleyin"}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <label style={S.label}>Eğitim Adı</label>
                    <input className="ee-input" type="text" value={s.egitimAdi} onChange={onChange("egitimAdi")} placeholder="Örn: Python ile Yapay Zeka" style={S.input} />
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <label style={{ ...S.label, display: "flex", alignItems: "center", gap: 7 }}>
                      Eğitim Adı (MEB)
                      <span style={S.mirrorChip}>
                        <span dangerouslySetInnerHTML={{ __html: IC.copy }} />
                        otomatik aynalanır
                      </span>
                    </label>
                    <input type="text" value={s.egitimAdi} readOnly placeholder="Eğitim Adı yazıldıkça buraya kopyalanır" style={S.inputMirror} />
                  </div>

                  {/* Eğitim Yapısı yalnız Bireysel'de anlamlı (Kurumsal = gün bazlı program). */}
                  {isBireysel && (
                    <div style={{ marginBottom: 22 }}>
                      <label style={S.label}>Eğitim Yapısı</label>
                      <div style={S.segWrap}>
                        <button onClick={() => patch({ egitimYapisi: "Standart Paket" })} style={yapiStd ? S.segOn : S.segOff}>Standart Paket</button>
                        <button onClick={() => patch({ egitimYapisi: "Track Bazlı" })} style={yapiStd ? S.segOff : S.segOn}>Track Bazlı</button>
                      </div>
                      <p style={{ margin: "7px 2px 0", fontSize: 12, color: "#94a3b8" }}>Standart Paket = tek satış. Track Bazlı = bölüm/track olarak parça parça satış.</p>
                    </div>
                  )}

                  <div style={{ marginBottom: 22 }}>
                    <label style={S.label}>Eğitim Tipi</label>
                    <div style={{ position: "relative" }}>
                      <select className="ee-select" value={s.egitimTipi} onChange={onChange("egitimTipi")} style={S.select}>
                        <option value="Bireysel">Bireysel</option>
                        <option value="Kurumsal">Kurumsal</option>
                      </select>
                      <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
                    </div>
                  </div>

                  {/* Satış Modeli (Kurumsal'da pasif) */}
                  <div style={{ marginBottom: 22, opacity: isBireysel ? 1 : 0.55, pointerEvents: isBireysel ? "auto" : "none", transition: "opacity .18s" }}>
                    <label style={{ ...S.label, display: "flex", alignItems: "center", gap: 7 }}>
                      Satış Modeli
                      {isBireysel ? <span style={S.pillIndigo}>bireysel</span> : <span style={S.pillGray}>kurumsal</span>}
                    </label>
                    <div style={{ position: "relative" }}>
                      <select className="ee-select" value={s.satisModeli} onChange={onChange("satisModeli")} disabled={isKurumsal} style={{ ...S.select, cursor: isBireysel ? "pointer" : "not-allowed", opacity: isBireysel ? 1 : 0.65 }}>
                        <option value="Grup Eğitimi">Grup Eğitimi</option>
                        <option value="Özel Ders">Özel Ders</option>
                      </select>
                      <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <label style={S.label}>Eğitim Ortamı</label>
                    <div style={{ position: "relative" }}>
                      <select className="ee-select" value={s.egitimOrtami} onChange={onChange("egitimOrtami")} style={S.select}>
                        <option value="Yüz Yüze">Yüz Yüze</option>
                        <option value="Online">Online</option>
                        <option value="Hibrit">Hibrit</option>
                      </select>
                      <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
                    </div>
                  </div>

                  {/* Kurumsal = gün bazlı program → gün sayısı (Süre tipi Eğitim Tipi'nden türetilir). */}
                  {isKurumsal && (
                    <div style={{ marginBottom: 22, animation: "ee-slide .25s ease", overflow: "hidden" }}>
                      <label style={S.label}>Toplam Gün Sayısı</label>
                      <input className="ee-input" type="number" min={1} max={60} value={s.gunSayisi} onChange={onChange("gunSayisi")} style={{ ...S.input, width: 160 }} />
                      <p style={{ margin: "7px 2px 0", fontSize: 12, color: "#94a3b8" }}>İçerikler sekmesinde gün gün planlama kartları oluşturur.</p>
                    </div>
                  )}

                  <div style={{ marginBottom: 22 }}>
                    <label style={S.label}>Sözleşme Tipi</label>
                    <div style={{ position: "relative" }}>
                      <select className="ee-select" value={s.sozlesmeTipi} onChange={onChange("sozlesmeTipi")} style={S.select}>
                        <option value="Mesafeli Satış Sözleşmesi">Mesafeli Satış Sözleşmesi</option>
                        <option value="Kurumsal Hizmet Sözleşmesi">Kurumsal Hizmet Sözleşmesi</option>
                        <option value="Bireysel Eğitim Sözleşmesi">Bireysel Eğitim Sözleşmesi</option>
                        <option value="Ön Kayıt Protokolü">Ön Kayıt Protokolü</option>
                      </select>
                      <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <label style={S.label}>KDV Oranı (%)</label>
                    <input className="ee-input" type="number" min={0} max={100} value={s.kdvOrani} onChange={onChange("kdvOrani")} style={{ ...S.input, width: 160 }} />
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <label style={S.label}>
                      Açıklama <span style={{ color: "#94a3b8", fontWeight: 500 }}>· web sitesi pazarlama metni</span>
                    </label>
                    <div className="ee-editor" style={{ border: "1px solid #e3e8f0", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "7px 10px", borderBottom: "1px solid #eef1f6", background: "#fafbfd" }}>
                        <span className="ee-fmt" style={{ ...S.fmtBtn, fontWeight: 800 }}>B</span>
                        <span className="ee-fmt" style={{ ...S.fmtBtn, fontStyle: "italic" }}>I</span>
                        <span className="ee-fmt" style={{ ...S.fmtBtn, textDecoration: "underline" }}>U</span>
                        <span style={{ width: 1, height: 18, background: "#e2e8f1", margin: "0 6px" }} />
                        <span className="ee-fmt" style={S.fmtBtn} dangerouslySetInnerHTML={{ __html: IC.list }} />
                        <span className="ee-fmt" style={S.fmtBtn} dangerouslySetInnerHTML={{ __html: IC.link }} />
                      </div>
                      <textarea value={s.aciklama} onChange={onChange("aciklama")} rows={4} placeholder="Eğitimin kazanımlarını, hedef kitlesini ve içeriğini pazarlama diliyle anlatın…" style={S.textarea} />
                    </div>
                  </div>
                </div>
              )}

              {/* ===== TAB 2: İÇERİKLER ===== */}
              {s.activeTab === "icerikler" && (
                <>
                  {/* BİREYSEL + TRACK BAZLI → bölüm & track ağacı (ultra esnek mod) */}
                  {isBireysel && !yapiStd && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Bölüm &amp; Track Yöneticisi</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", background: "#f3e8ff", padding: "3px 10px", borderRadius: 999 }}>track bazlı · parçalanabilir</span>
                      </div>

                      {/* Bölüm Ekle */}
                      <div style={S.panel}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 11, letterSpacing: ".01em" }}>Bölüm Ekle</div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <input className="ee-input" type="text" value={s.dBolumAd} onChange={onChange("dBolumAd")} placeholder="Bölüm adı — örn: Grafik-1" style={S.inputSm} />
                          </div>
                          <div style={{ width: 140 }}>
                            <input className="ee-input" type="number" min={0} value={s.dBolumSaat} onChange={onChange("dBolumSaat")} placeholder="Toplam saat" style={S.inputSm} />
                          </div>
                          <button onClick={addBolum} disabled={!canAddBolum} style={addBtn(canAddBolum, "#4f46e5")}>
                            <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} />
                            Bölüm Ekle
                          </button>
                        </div>
                      </div>

                      {/* Track Ekle */}
                      <div style={{ ...S.panel, opacity: trackLocked ? 0.6 : 1, transition: "opacity .18s" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 11 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Track Ekle</div>
                          {trackLocked && (
                            <span style={S.lockChip}>
                              <span dangerouslySetInnerHTML={{ __html: IC.lock }} />
                              Önce en az bir bölüm ekleyin
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ width: 190 }}>
                            <div style={{ position: "relative" }}>
                              <select className="ee-select" value={s.dTrackTarget} onChange={(e) => {
                                const val = e.target.value;
                                setForm((f) => {
                                  const b = f.bolumler.find((b) => b.id === Number(val));
                                  const used = b ? b.tracks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0) : 0;
                                  const rem = b ? Math.max(0, (Number(b.hours) || 0) - used) : 0;
                                  return { ...f, dTrackTarget: val, dTrackSaat: rem > 0 ? String(rem) : "", saved: false };
                                });
                              }} disabled={trackLocked} style={S.selectSm}>
                                {hasBolum
                                  ? s.bolumler.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)
                                  : <option value="">Önce bölüm ekleyin</option>}
                              </select>
                              <span style={S.selChevSm} dangerouslySetInnerHTML={{ __html: IC.selChevSm }} />
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 170 }}>
                            <input className="ee-input" type="text" value={s.dTrackAd} onChange={onChange("dTrackAd")} disabled={trackLocked} placeholder="Track adı — örn: Adobe Photoshop" style={S.inputSm} />
                          </div>
                          <button onClick={addTrack} disabled={!canAddTrack} style={addBtn(canAddTrack, "#4f46e5")}>
                            <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} />
                            Track Ekle
                          </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 13, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Track Saati</span>
                            <input className="ee-input" type="number" min={1} max={remainingHours > 0 ? remainingHours : undefined} value={s.dTrackSaat} onChange={onChange("dTrackSaat")} disabled={trackLocked} placeholder="zorunlu" style={S.inputTrackHours} />
                            {targetBolum && <span style={{ fontSize: 12, fontWeight: 600, color: remainingHours > 0 ? "#16a34a" : "#dc2626" }}>Kalan: {remainingHours} saat</span>}
                          </div>
                          <div onClick={() => !trackLocked && toggleTrackSell()} style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: trackLocked ? "not-allowed" : "pointer", userSelect: "none" }}>
                            <span style={{ ...S.checkbox, border: s.dTrackSell ? "1.5px solid #4f46e5" : "1.5px solid #cbd5e1", background: s.dTrackSell ? "#4f46e5" : "#fff" }}>
                              {s.dTrackSell && <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />}
                            </span>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>Bu Track tek başına satılabilir</span>
                          </div>
                          {s.dTrackSell && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, animation: "ee-fade .2s ease" }}>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ağaç görünümü */}
                      <div style={{ marginTop: 20 }}>
                        {/* otomatik ana başlık — eğitim adı + toplam saat (bölümlerin toplamı) */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px 14px", borderBottom: "2px solid #eef1f6", marginBottom: 14 }}>
                          <span style={{ fontSize: 19, fontWeight: 800, color: "#0f1f3d", letterSpacing: "-.3px" }}>
                            {s.egitimAdi.trim() || "Eğitim Adı"}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#4338ca", background: "#e8ecfd", padding: "4px 12px", borderRadius: 999 }}>
                            {totalHours()} Saat
                          </span>
                        </div>
                        {!hasBolum && (
                          <div style={S.emptyBox}>
                            <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.folderBig }} />
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155" }}>Henüz bölüm yok</div>
                            <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 300 }}>Yukarıdan ilk bölümü ekleyin; ardından altına track tanımlayabilirsiniz.</div>
                          </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {s.bolumler.map((b) => (
                            <div
                              key={b.id}
                              onDragOver={onBolumDragOver}
                              onDrop={(e) => { e.preventDefault(); if (dragBolum !== null) onBolumDrop(b.id); }}
                              style={{ border: "1px solid #e9edf4", borderRadius: 14, overflow: "hidden", opacity: dragBolum === b.id ? 0.4 : 1, transition: "opacity .15s" }}
                            >
                              <div
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); onBolumDragStart(b.id); }}
                                onDragEnd={() => setDragBolum(null)}
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "#f8fafc", borderBottom: "1px solid #eef1f6", cursor: "grab" }}
                              >
                                <span style={{ ...S.bolumIcon, cursor: "grab" }} dangerouslySetInnerHTML={{ __html: IC.folder }} />
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#0f1f3d", flex: 1 }}>{b.name}</span>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", background: "#eef2f8", padding: "4px 11px", borderRadius: 999 }}>{(Number(b.hours) || 0)} Saat</span>
                                <button className="ee-del" title="Bölümü sil" style={S.smDelBtn} onClick={() => removeBolum(b.id)}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.trashSm }} />
                                </button>
                              </div>
                              <div style={{ padding: "8px 16px 8px 30px" }}>
                                {b.tracks.length === 0 && <div style={{ fontSize: 12.5, color: "#94a3b8", padding: "8px 4px" }}>Bu bölümde henüz track yok.</div>}
                                {b.tracks.map((t) => {
                                  const isEditing = editingTrack?.bId === b.id && editingTrack?.tId === t.id;
                                  const isDragging = dragTrack?.bId === b.id && dragTrack?.tId === t.id;
                                  return isEditing ? (
                                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: "1px solid #f4f6fa", background: "#f0f4ff", borderRadius: 8 }}>
                                      <span style={S.trackIcon} dangerouslySetInnerHTML={{ __html: IC.file }} />
                                      <input className="ee-input" type="text" value={editingTrack.name} onChange={(e) => setEditingTrack({ ...editingTrack, name: e.target.value })} style={{ ...S.inputSm, flex: 1, fontSize: 13.5 }} autoFocus />
                                      <input className="ee-input" type="number" min={1} value={editingTrack.hours} onChange={(e) => setEditingTrack({ ...editingTrack, hours: e.target.value })} style={{ ...S.inputTrackHours, width: 70 }} />
                                      <span style={{ fontSize: 12, color: "#64748b" }}>saat</span>
                                      <div onClick={() => setEditingTrack({ ...editingTrack, sellable: !editingTrack.sellable })} style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none" }}>
                                        <span style={{ ...S.checkbox, width: 16, height: 16, border: editingTrack.sellable ? "1.5px solid #4f46e5" : "1.5px solid #cbd5e1", background: editingTrack.sellable ? "#4f46e5" : "#fff" }}>
                                          {editingTrack.sellable && <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />}
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Satılabilir</span>
                                      </div>
                                      <button onClick={saveEditTrack} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Kaydet</button>
                                      <button onClick={cancelEditTrack} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>İptal</button>
                                    </div>
                                  ) : (
                                    <div
                                      key={t.id}
                                      draggable
                                      onDragStart={(e) => { e.stopPropagation(); onTrackDragStart(b.id, t.id); }}
                                      onDragOver={(e) => { e.stopPropagation(); onTrackDragOver(e); }}
                                      onDrop={(e) => { e.stopPropagation(); onTrackDrop(b.id, t.id); }}
                                      onDragEnd={() => { setDragTrack(null); setDragBolum(null); }}
                                      style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 4px", borderBottom: "1px solid #f4f6fa", opacity: isDragging ? 0.4 : 1, cursor: "grab", transition: "opacity .15s" }}
                                    >
                                      <span style={{ ...S.trackIcon, cursor: "grab" }} dangerouslySetInnerHTML={{ __html: IC.file }} />
                                      <span style={{ fontSize: 14, fontWeight: 600, color: "#334155", flex: 1 }}>{t.name}</span>
                                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>{(Number(t.hours) || 0)} Saat</span>
                                      {t.sellable && (
                                        <span style={S.sellChip}>
                                          <span dangerouslySetInnerHTML={{ __html: IC.sellSm }} />
                                          Satışa Açık
                                        </span>
                                      )}
                                      <button title="Track düzenle" style={{ ...S.xsDelBtn, color: "#4f46e5" }} onClick={() => startEditTrack(b.id, t)}>
                                        <span dangerouslySetInnerHTML={{ __html: IC.editSm }} />
                                      </button>
                                      <button className="ee-del" title="Track sil" style={S.xsDelBtn} onClick={() => removeTrack(b.id, t.id)}>
                                        <span dangerouslySetInnerHTML={{ __html: IC.xSm }} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BİREYSEL + STANDART PAKET → tek paket; düz metin içerik (web sitesinden yapıştır) */}
                  {isBireysel && yapiStd && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>İçerik</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", background: "#e0f2fe", padding: "3px 10px", borderRadius: 999 }}>standart paket</span>
                      </div>
                      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5 }}>
                        Tek paket olarak satılır. Web sitesindeki müfredat/içerik metnini buraya yapıştırın.
                        Parçalara ayırıp bölüm/track bazlı satmak isterseniz Genel Bilgiler'den <strong>Eğitim Yapısı → Track Bazlı</strong> yapın.
                      </p>
                      <RichText value={s.icerikMetni} onChange={(html) => patch({ icerikMetni: html })} />
                    </div>
                  )}

                  {/* KURUMSAL → gün gün program (1. Gün, 2. Gün… — düz metin başlıklar) */}
                  {isKurumsal && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Gün Gün Planlama Paneli</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#c2410c", background: "#ffedd5", padding: "3px 10px", borderRadius: 999 }}>gün bazlı</span>
                      </div>
                      <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#94a3b8" }}>Her gün standart 6 saattir (10:00 – 16:00). Gün sayısını Genel Bilgiler sekmesinden değiştirebilirsiniz.</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {days.map((n) => {
                          const d = getDay(n);
                          return (
                            <div key={n} style={{ border: "1px solid #e9edf4", borderRadius: 14, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "#f8fafc", borderBottom: "1px solid #eef1f6" }}>
                                <span style={S.dayIcon} dangerouslySetInnerHTML={{ __html: IC.calDay }} />
                                <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d", flex: 1 }}>{n}. Gün</span>
                                <span style={S.dayTime}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.clock }} />
                                  10:00 – 16:00 · 6 saat
                                </span>
                              </div>
                              <div style={{ padding: "14px 16px" }}>
                                <input className="ee-input" type="text" value={d.ad} onChange={(e) => setDay(n, { ad: e.target.value })} placeholder="Gün başlığı / eğitim adı — örn: Tanışma ve Temel Kavramlar" style={{ ...S.inputSm, marginBottom: 12 }} />
                                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
                                  {d.konular.map((text, idx) => (
                                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 10 }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#cbd5e1", flex: "0 0 auto" }} />
                                      <span style={{ fontSize: 13.5, fontWeight: 500, color: "#334155", flex: 1 }}>{text}</span>
                                      <button className="ee-kondel" style={S.konuDel} onClick={() => removeKonu(n, idx)}>
                                        <span dangerouslySetInnerHTML={{ __html: IC.xSm }} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                  <input className="ee-input" type="text" value={d.draft || ""} onChange={(e) => setDay(n, { draft: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addKonu(n); }} placeholder="Konu başlığı ekle…" style={{ ...S.inputSm, flex: 1, background: "#fff" }} />
                                  <button className="ee-konadd" style={S.konuAdd} onClick={() => addKonu(n)}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.plusXs }} />
                                    Konu Ekle
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ===== TAB 3: FİYAT ===== */}
              {s.activeTab === "fiyat" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Satılabilir Ürün Havuzu</span>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, color: isGun ? "#c2410c" : "#0369a1", background: isGun ? "#ffedd5" : "#e0f2fe" }}>
                        {isGun ? "günlük ücret bazlı" : "saatlik / paket bazlı"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>Para Birimi</span>
                      <div style={{ position: "relative", width: 100 }}>
                        <select className="ee-select" value={s.paraBirimi} onChange={onChange("paraBirimi")} style={S.selectCur}>
                          <option value="TL">TL</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                        </select>
                        <span style={{ ...S.selChevSm, right: 9 }} dangerouslySetInnerHTML={{ __html: IC.selChevSm }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ position: "relative" }}>
                        <select className="ee-select" value={s.poolSel} onChange={onChange("poolSel")} style={S.select}>
                          {poolOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
                      </div>
                    </div>
                    <button onClick={addPriceRow} disabled={!canAddPrice} style={addBtn(canAddPrice, "#4f46e5")}>
                      <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} />
                      Listeye Ekle
                    </button>
                  </div>

                  <div style={{ border: "1px solid #e9edf4", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                        <thead>
                          <tr style={{ background: "#fafbfd", borderBottom: "1px solid #eef1f6" }}>
                            {["Ürün Adı", isGun ? "Süre (Gün)" : "Süre (Saat)", "Liste Fiyatı (KDV Hariç)", "KDV", "Net Matrah (KDV Dahil)", ""].map((h, i) => (
                              <th key={i} style={{ padding: "13px 18px", textAlign: i === 5 ? "right" : "left", fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.priceRows.map((r) => {
                            const net = (Number(r.liste) || 0) * (1 + kdv / 100);
                            return (
                              <tr key={r.id} style={{ borderBottom: "1px solid #f4f6fa" }}>
                                <td style={S.priceCell}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{r.name}</span>
                                  <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>{r.kind}</div>
                                </td>
                                <td style={S.priceCell}><span style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}>{sureFor(r.key)}</span></td>
                                <td style={S.priceCell}>
                                  <div style={{ position: "relative", width: 160 }}>
                                    <input className="ee-input" type="number" min={0} value={r.liste} onChange={(e) => setListe(r.id, e.target.value)} placeholder="0" style={S.priceInput} />
                                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94a3b8", fontWeight: 600, pointerEvents: "none" }}>{getSymbol()}</span>
                                  </div>
                                </td>
                                <td style={S.priceCell}><span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "4px 10px", borderRadius: 8 }}>%{kdv}</span></td>
                                <td style={S.priceCell}><span style={{ fontSize: 14.5, fontWeight: 800, color: "#0f1f3d" }}>{fmtCurrency(net)}</span></td>
                                <td style={{ ...S.priceCell, textAlign: "right" }}>
                                  <button className="ee-del" style={S.smDelBtn} onClick={() => removePriceRow(r.id)}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.trashSm }} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {s.priceRows.length === 0 && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "42px 20px", textAlign: "center" }}>
                        <div style={S.emptyIconSm} dangerouslySetInnerHTML={{ __html: IC.sellBig }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>Fiyat listesi boş</div>
                        <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 300 }}>Yukarıdaki havuzdan ürün seçip “Listeye Ekle” ile fiyatlandırmaya başlayın.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== TAB 4: SERTİFİKASYON ===== */}
              {s.activeTab === "sertifikasyon" && (
                <div style={{ maxWidth: 580 }}>
                  {isKurumsal && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Sertifikasyon</span>
                        <span style={S.pillIndigo}>kurumsal</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 22, border: "1px solid #e9edf4", borderRadius: 16, background: "linear-gradient(135deg,#fafbff,#f5f7ff)" }}>
                        <div style={S.certIcon} dangerouslySetInnerHTML={{ __html: IC.awardBig }} />
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f1f3d" }}>Kurumsal Katılım Sertifikası</div>
                          <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "#64748b", lineHeight: 1.5 }}>Kurumsal eğitimlerde sınav, proje ve puan barajı uygulanmaz. Programı tamamlayan tüm katılımcılara standart katılım sertifikası düzenlenir.</p>
                        </div>
                      </div>
                    </>
                  )}
                  {isBireysel && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Sertifikasyon</span>
                        <span style={S.pillIndigo}>bireysel</span>
                      </div>
                      <div style={{ marginBottom: 22 }}>
                        <label style={S.label}>Sertifikasyon Tipi</label>
                        <div style={{ position: "relative" }}>
                          <select className="ee-select" value={s.sertTipi} onChange={onChange("sertTipi")} style={S.select}>
                            <option value="Sınav Bazlı">Sınav Bazlı</option>
                            <option value="Proje Bazlı">Proje Bazlı</option>
                          </select>
                          <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={S.label}>Verilecek Sertifika</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f1f5f9" }}>
                          <span style={{ flex: "0 0 auto", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.awardGreen }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{sertText}</span>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8", lineHeight: 1.55 }}>Ufak Not: Kurum yönetmeliği gereğince ilgili ölçüm tipinden 90 ve üzeri puan alanlar Başarı, 50 ve üzeri puan alanlar Katılım Sertifikası almaya hak kazanır.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* sekme bazlı Kaydet footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 32px", borderTop: "1px solid #eef1f6", background: "#fafbfd" }}>
              <span style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500 }}>{saveHints[s.activeTab]}</span>
              <button onClick={() => setModal("save")} disabled={busy} style={s.saved ? S.saveOk : S.saveBtn}>
                <span dangerouslySetInnerHTML={{ __html: s.saved ? IC.checkSave : IC.save }} />
                <span>{s.saved ? "Kaydedildi" : eduId ? "Güncelle" : "Kaydet"}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {modal !== null && (
        <FlexModal
          open
          title={modalCfg[modal].title}
          message={modalCfg[modal].message}
          confirmLabel={modalCfg[modal].confirmLabel}
          tone={modalCfg[modal].tone}
          busy={busy}
          onConfirm={runModal}
          onCancel={() => !busy && setModal(null)}
        />
      )}
    </div>
  );
}

// ── basit zengin-metin editörü (contentEditable + execCommand, kütüphanesiz) ──
function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // İçeriği yalnız ilk montajda DOM'a bas (controlled etmiyoruz → imleç zıplamaz).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sync = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const cmd = (c: string, arg?: string) => {
    document.execCommand(c, false, arg);
    ref.current?.focus();
    sync();
  };
  // mousedown'da preventDefault → seçim kaybolmaz
  const btn = (label: string, title: string, run: () => void, extra?: CSSProperties) => (
    <span
      className="ee-fmt"
      title={title}
      style={{ ...S.fmtBtn, ...extra }}
      onMouseDown={(e) => { e.preventDefault(); run(); }}
    >
      {label}
    </span>
  );
  return (
    <div className="ee-editor" style={{ border: "1px solid #e3e8f0", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "7px 10px", borderBottom: "1px solid #eef1f6", background: "#fafbfd", flexWrap: "wrap" }}>
        {btn("B", "Kalın", () => cmd("bold"), { fontWeight: 800 })}
        {btn("Başlık", "Başlık (semibold)", () => cmd("formatBlock", "h3"), { width: "auto", padding: "0 9px", fontWeight: 700, fontSize: 12.5 })}
        {btn("I", "İtalik", () => cmd("italic"), { fontStyle: "italic" })}
        {btn("U", "Altı çizili", () => cmd("underline"), { textDecoration: "underline" })}
        <span style={{ width: 1, height: 18, background: "#e2e8f1", margin: "0 6px" }} />
        {btn("A", "Küçük yazı", () => cmd("fontSize", "2"), { fontSize: 11, fontWeight: 700 })}
        {btn("A", "Normal yazı", () => cmd("fontSize", "3"), { fontSize: 14, fontWeight: 700 })}
        {btn("A", "Büyük yazı", () => cmd("fontSize", "5"), { fontSize: 17, fontWeight: 700 })}
        <span style={{ width: 1, height: 18, background: "#e2e8f1", margin: "0 6px" }} />
        <span className="ee-fmt" title="Madde listesi" style={S.fmtBtn} onMouseDown={(e) => { e.preventDefault(); cmd("insertUnorderedList"); }} dangerouslySetInnerHTML={{ __html: IC.list }} />
        {btn("Temizle", "Biçimi temizle", () => cmd("removeFormat"), { width: "auto", padding: "0 9px", fontSize: 12 })}
      </div>
      <div
        ref={ref}
        className="ee-rt"
        contentEditable
        suppressContentEditableWarning
        data-ph="Eğitim içeriğini buraya yapıştırın — kazanımlar, müfredat başlıkları, modüller…"
        onInput={sync}
        style={{ minHeight: 240, padding: "14px 16px", fontSize: 14, lineHeight: 1.6, color: "#1e293b", outline: "none", overflowY: "auto" }}
      />
    </div>
  );
}

// ── sekme stilleri ──
const tabStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer",
  fontFamily: "inherit", fontSize: "14.5px", fontWeight: active ? 700 : 600, color: active ? "#0f1f3d" : "#64748b",
  borderBottom: active ? "2.5px solid #f97316" : "2.5px solid transparent", marginBottom: -1, whiteSpace: "nowrap", transition: "color .14s",
});
const tabNumStyle = (active: boolean): CSSProperties => ({
  width: 22, height: 22, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, fontWeight: 700, color: active ? "#fff" : "#94a3b8", background: active ? "#f97316" : "#eef2f8",
});

// ── stiller ──
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif", background: "#eef2f8" },
  sidebar: { width: 252, flex: "0 0 252px", height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  logoBox: { width: 38, height: 38, borderRadius: 11, background: "#0a1c38", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#9fb2cd", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  navActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.22),rgba(249,115,22,.05))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.28)" },
  navActiveBar: { position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: "0 3px 3px 0", background: "#fb923c" },
  main: { flex: 1, minWidth: 0, height: "100%", overflowY: "scroll", overflowX: "hidden", background: "#eef2f8" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 1080px) / 2 + 36px))", background: "#fff", borderBottom: "1px solid #e2e8f1", boxShadow: "0 2px 6px rgba(15,31,61,.04)" },
  backBtn: { width: 46, height: 46, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", textDecoration: "none", transition: "all .14s" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  banner: { display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(90deg,#dcfce7,#ecfdf5)", border: "1px solid #bbf7d0", borderRadius: 14, padding: "13px 18px", marginBottom: 18, animation: "ee-fadeup .25s ease" },
  bannerIcon: { width: 30, height: 30, borderRadius: 9, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  publishBase: { position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 22px", borderRadius: 13, border: "none", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700 },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", overflow: "hidden" },
  label: { display: "block", fontSize: 13.5, fontWeight: 600, color: "#334155", marginBottom: 8 },
  input: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  inputMirror: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px dashed #cbd5e1", background: "#f1f5f9", fontSize: 14.5, fontFamily: "inherit", color: "#64748b", outline: "none" },
  inputSm: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#fff", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  inputTrackHours: { width: 110, padding: "9px 12px", borderRadius: 10, border: "1px solid #fcd9b6", background: "#fff7ed", fontSize: 13.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  select: { width: "100%", padding: "12px 42px 12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selectSm: { width: "100%", padding: "11px 36px 11px 14px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#fff", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selectCur: { width: "100%", padding: "9px 36px 9px 11px", borderRadius: 10, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 13.5, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selChev: { position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" },
  selChevSm: { position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" },
  textarea: { width: "100%", border: "none", padding: "13px 15px", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", resize: "vertical", background: "#fff", lineHeight: 1.6 },
  segWrap: { display: "inline-flex", background: "#f1f5f9", border: "1px solid #e3e8f0", borderRadius: 12, padding: 4, gap: 4 },
  segOn: { padding: "8px 16px", border: "none", borderRadius: 9, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", background: "#fff", color: "#0f1f3d", boxShadow: "0 1px 3px rgba(15,31,61,.12)" },
  segOff: { padding: "8px 16px", border: "none", borderRadius: 9, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "transparent", color: "#64748b" },
  mirrorChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "2px 8px", borderRadius: 999 },
  pillIndigo: { fontSize: 11, fontWeight: 600, color: "#4338ca", background: "#e8ecfd", padding: "2px 8px", borderRadius: 999 },
  pillGray: { fontSize: 11, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "2px 8px", borderRadius: 999 },
  fmtBtn: { width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", cursor: "pointer", fontSize: 14 },
  panel: { background: "#f8fafc", border: "1px solid #e9edf4", borderRadius: 14, padding: 16, marginBottom: 14 },
  lockChip: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#b45309", background: "#fef3c7", padding: "3px 10px", borderRadius: 999 },
  checkbox: { position: "relative", width: 19, height: 19, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  emptyBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 11, padding: "48px 20px", textAlign: "center", border: "1.5px dashed #d8e0ec", borderRadius: 14 },
  emptyIcon: { width: 50, height: 50, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  emptyIconSm: { width: 46, height: 46, borderRadius: 13, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  bolumIcon: { width: 34, height: 34, borderRadius: 10, background: "#e8ecfd", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  trackIcon: { width: 28, height: 28, borderRadius: 8, background: "#f1f5f9", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  dayIcon: { width: 34, height: 34, borderRadius: 10, background: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  dayTime: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "4px 11px", borderRadius: 999 },
  sellChip: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "3px 9px", borderRadius: 999 },
  smDelBtn: { width: 32, height: 32, borderRadius: 9, border: "1px solid #e6eaf1", background: "#fff", color: "#94a3b8", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .13s" },
  xsDelBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid #e6eaf1", background: "#fff", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .13s" },
  konuDel: { width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  konuAdd: { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 15px", borderRadius: 10, border: "1px solid #d8def0", background: "#fff", color: "#4338ca", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  priceCell: { padding: "13px 18px", verticalAlign: "middle" },
  priceInput: { width: "100%", padding: "9px 34px 9px 12px", borderRadius: 10, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", fontWeight: 600 },
  certIcon: { width: 54, height: 54, borderRadius: 14, background: "#e8ecfd", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  saveBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#0f1f3d", color: "#fff", boxShadow: "0 6px 14px -7px rgba(15,31,61,.7)" },
  saveOk: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#dcfce7", color: "#15803d" },
};

// ── ikonlar (lucide, design'dan birebir) ──
const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  home: sv('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  book: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  clipboard: sv('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
  award: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
  trophy: sv('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  user: sv('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>'),
  panel: sv('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>'),
  back: sv('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 'width="21" height="21" stroke-width="2.1"'),
  crumb: sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="#94a3b8" stroke-width="2.3"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  checkBanner: sv('<path d="M20 6 9 17l-5-5"/>', 'width="17" height="17" stroke="#fff" stroke-width="2.6"'),
  copy: sv('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', 'width="11" height="11" stroke-width="2.4"'),
  selChev: sv('<path d="m6 9 6 6 6-6"/>', 'width="17" height="17" stroke="#94a3b8" stroke-width="2.3"'),
  selChevSm: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#94a3b8" stroke-width="2.3"'),
  lock: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="12" height="12" stroke-width="2.2"'),
  plusSm: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="16" height="16" stroke-width="2.4"'),
  plusXs: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="14" height="14" stroke-width="2.4"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="12" height="12" stroke="#fff" stroke-width="3.2"'),
  folder: sv('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>', 'width="18" height="18"'),
  folderBig: sv('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>', 'width="24" height="24" stroke-width="1.8"'),
  file: sv('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>', 'width="15" height="15"'),
  sellSm: sv('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', 'width="12" height="12" stroke-width="2.2"'),
  sellBig: sv('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', 'width="22" height="22" stroke-width="1.8"'),
  trashSm: sv('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', 'width="15" height="15"'),
  xSm: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.2"'),
  editSm: sv('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', 'width="14" height="14" stroke-width="2.2"'),
  calDay: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 'width="18" height="18"'),
  clock: sv('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 'width="12" height="12" stroke-width="2.2"'),
  awardBig: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>', 'width="26" height="26" stroke-width="1.9"'),
  awardGreen: sv('<path d="M15.477 12.89 17 21l-5-3-5 3 1.523-8.11"/><circle cx="12" cy="8" r="6"/>', 'width="18" height="18" stroke="#16a34a"'),
  rocket: sv('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>', 'width="18" height="18" stroke-width="2.1"'),
  stop: sv('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 9h6v6H9z"/>', 'width="18" height="18" stroke-width="2.1"'),
  save: sv('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>', 'width="16" height="16"'),
  checkSave: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke-width="2.5"'),
  list: sv('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>', 'width="15" height="15"'),
  link: sv('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', 'width="15" height="15"'),
};

const TABS: Array<{ key: TabKey; label: string; num: string }> = [
  { key: "genel", label: "Genel Bilgiler", num: "1" },
  { key: "icerikler", label: "İçerikler", num: "2" },
  { key: "fiyat", label: "Fiyat", num: "3" },
  { key: "sertifikasyon", label: "Sertifikasyon", num: "4" },
];

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes ee-fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ee-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ee-slide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes ee-spin{to{transform:rotate(360deg)}}
.ee-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:ee-spin 1s linear infinite}
.ee-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
.ee-iconbtn:hover{background:#f8fafc;color:#0f172a}
.ee-input:focus{border-color:#a5b4fc;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.ee-select:focus{border-color:#a5b4fc;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.ee-editor:focus-within{border-color:#a5b4fc;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.ee-fmt:hover{background:#eef2f8}
.ee-rt:empty:before{content:attr(data-ph);color:#94a3b8}
.ee-rt h3{font-size:15.5px;font-weight:600;color:#0f1f3d;margin:10px 0 4px}
.ee-rt ul{margin:6px 0;padding-left:22px}
.ee-rt:focus{outline:none}
.ee-del:hover{border-color:#fca5a5;color:#dc2626;background:#fef2f2}
.ee-kondel:hover{color:#dc2626;background:#fef2f2}
.ee-konadd:hover{background:#f5f6ff;border-color:#a5b4fc}
`;
