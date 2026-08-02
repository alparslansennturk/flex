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
import FlexHeader from "../../_components/FlexHeader";
import FlexModal from "../../_components/FlexModal";
import Footer from "@/app/components/layout/Footer";
import { authHeadersJson } from "@/app/lib/client/auth-headers";
import type { Track, Bolum, DayData, PriceRow, TabKey, FormState, PoolOpt } from "./_shared/types";
import { INITIAL } from "./_shared/types";
import { SYMBOLS, S, IC, TABS, tabStyle, tabNumStyle, globalCss } from "./_shared/constants";
import { GenelTab } from "./_shared/GenelTab";
import { FiyatTab } from "./_shared/FiyatTab";
import { SertifikasyonTab } from "./_shared/SertifikasyonTab";
import { BolumTrackYoneticisi } from "./_shared/BolumTrackYoneticisi";
import { StandartPaketIcerik } from "./_shared/StandartPaketIcerik";
import { GunPlanlayici } from "./_shared/GunPlanlayici";

export default function EgitimEklePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [s, setForm] = useState<FormState>(INITIAL);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [eduId, setEduId] = useState<string | null>(null); // ilk kayıttan sonra dolu → günceller
  const [busy, setBusy] = useState(false);
  const [editReady, setEditReady] = useState(false);
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
          if (!cancelled) setEditReady(true);
        } else {
          if (!cancelled) setEditReady(true);
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
    edu: { name?: string; mebName?: string; branchId?: string; audience?: string; structure?: string; outline?: string[]; deliveryMode?: string; contractType?: string; salesModel?: string; totalHours?: number; vatRate?: number; listPrice?: number; onSale?: boolean; certType?: string; deliveryOptions?: Array<{ mode: string; listPrice: number }> },
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
    const isEditHibrit = edu.deliveryMode === "hybrid";
    if (isEditHibrit && edu.deliveryOptions?.length) {
      const yy = edu.deliveryOptions.find((o) => o.mode === "in_person");
      const on = edu.deliveryOptions.find((o) => o.mode === "online");
      if (yy) priceRows.push({ id: seq++, key: "__main__yy", name: (edu.name ?? "") + " — Yüz Yüze", kind: "Ana Paket · Yüz Yüze", liste: String(yy.listPrice), deliveryMode: "in_person" });
      if (on) priceRows.push({ id: seq++, key: "__main__on", name: (edu.name ?? "") + " — Online", kind: "Ana Paket · Online", liste: String(on.listPrice), deliveryMode: "online" });
    } else if (edu.listPrice != null) {
      priceRows.push({ id: seq++, key: "__main", name: edu.name ?? "", kind: "Ana Paket", liste: String(edu.listPrice) });
    }
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
    const deliveryMap: Record<string, string> = { in_person: "Yüz Yüze", online: "Online", hybrid: "Hibrit" };
    setForm((f) => ({
      ...f,
      egitimAdi: edu.name ?? "",
      mebAdi: edu.mebName ?? "",
      bransId: edu.branchId ?? "",
      egitimTipi: edu.audience === "corporate" ? "Kurumsal" : "Bireysel",
      egitimYapisi: edu.structure === "sectioned" ? "Track Bazlı" : "Standart Paket",
      icerikMetni: edu.outline?.[0] ?? "",
      egitimOrtami: edu.deliveryMode ? (deliveryMap[edu.deliveryMode] ?? "Yüz Yüze") : f.egitimOrtami,
      egitimSuresi: edu.totalHours != null ? String(edu.totalHours) : "",
      sozlesmeTipi: edu.contractType ?? f.sozlesmeTipi,
      satisModeli: edu.salesModel ?? f.satisModeli,
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
  const onTrackTargetChange = (val: string) =>
    setForm((f) => {
      const b = f.bolumler.find((b) => b.id === Number(val));
      const used = b ? b.tracks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0) : 0;
      const rem = b ? Math.max(0, (Number(b.hours) || 0) - used) : 0;
      return { ...f, dTrackTarget: val, dTrackSaat: rem > 0 ? String(rem) : "", saved: false };
    });
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
  const isHibrit = s.egitimOrtami === "Hibrit";
  const poolList = (): PoolOpt[] => {
    const items: PoolOpt[] = [];
    const mainName = s.egitimAdi.trim() || "Ana Paket";
    if (isHibrit) {
      items.push({ value: "__main__yy", label: mainName + " — Yüz Yüze", kind: "Ana Paket · Yüz Yüze", deliveryMode: "in_person" });
      items.push({ value: "__main__on", label: mainName + " — Online", kind: "Ana Paket · Online", deliveryMode: "online" });
    } else {
      items.push({ value: "__main", label: mainName + " (Ana Paket)", kind: "Ana Paket" });
    }
    s.bolumler.forEach((b) => {
      if (isHibrit) {
        items.push({ value: "b" + b.id + "__yy", label: b.name + " — Yüz Yüze", kind: "Bölüm · Yüz Yüze", hours: b.hours, deliveryMode: "in_person" });
        items.push({ value: "b" + b.id + "__on", label: b.name + " — Online", kind: "Bölüm · Online", hours: b.hours, deliveryMode: "online" });
      } else {
        items.push({ value: "b" + b.id, label: b.name + " (Bölüm)", kind: "Bölüm", hours: b.hours });
      }
      b.tracks.forEach((t) => {
        if (t.sellable) {
          if (isHibrit) {
            items.push({ value: "t" + t.id + "__yy", label: "  " + t.name + " — Yüz Yüze", kind: "Track · Yüz Yüze", hours: t.hours, deliveryMode: "in_person" });
            items.push({ value: "t" + t.id + "__on", label: "  " + t.name + " — Online", kind: "Track · Online", hours: t.hours, deliveryMode: "online" });
          } else {
            items.push({ value: "t" + t.id, label: "  " + t.name + " (Track)", kind: "Track", hours: t.hours });
          }
        }
      });
    });
    return items;
  };
  const totalHours = () => s.bolumler.reduce((sum, b) => sum + (Number(b.hours) || 0), 0);
  const sureFor = (key: string) => {
    const isGunVal = s.egitimTipi === "Kurumsal";
    const baseKey = key.replace(/__yy$|__on$/, "");
    if (baseKey === "__main") return isGunVal ? `${s.gunSayisi} Gün` : `${totalHours() || s.egitimSuresi} Saat`;
    if (baseKey.startsWith("b")) {
      const bid = Number(baseKey.slice(1));
      const b = s.bolumler.find((x) => x.id === bid);
      return b ? b.hours + " Saat" : "";
    }
    const tid = Number(baseKey.slice(1));
    let h = 0;
    s.bolumler.forEach((b) => b.tracks.forEach((t) => { if (t.id === tid) h = t.hours; }));
    return h + " Saat";
  };
  const addPriceRow = () => {
    const sel = poolOptions.some((o) => o.value === s.poolSel) ? s.poolSel : (poolOptions[0]?.value ?? "");
    if (!sel) return;
    if (s.priceRows.some((r) => r.key === sel)) return;
    const opt = poolOptions.find((o) => o.value === sel);
    if (!opt) return;
    setForm((f) => {
      const id = f.seq;
      return {
        ...f,
        priceRows: [...f.priceRows, { id, key: opt.value, name: opt.label.replace(/\s*\((Ana Paket|Track|Bölüm)\)$/, ""), kind: opt.kind, liste: "", deliveryMode: opt.deliveryMode }],
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
  // poolSel havuzda yoksa ilk seçeneğe düş (hibrit ↔ tekli geçişlerinde key değişir)
  const effectivePoolSel = poolOptions.some((o) => o.value === s.poolSel) ? s.poolSel : (poolOptions[0]?.value ?? "");
  if (effectivePoolSel !== s.poolSel) { setTimeout(() => patch({ poolSel: effectivePoolSel }), 0); }
  const alreadyAdded = s.priceRows.some((r) => r.key === effectivePoolSel);
  const canAddPrice = !!effectivePoolSel && !alreadyAdded;

  // İçerik yeterliliği: Kurumsal → en az bir günün başlığı dolu; Bireysel+Track Bazlı → en az bir bölüm;
  // Bireysel+Standart Paket → paket başlı başına yeterli.
  const contentOk = isKurumsal
    ? days.some((n) => (getDay(n).ad || "").trim().length > 0)
    : !yapiStd
    ? hasBolum
    : s.icerikMetni.replace(/<[^>]*>/g, "").trim().length > 0; // Standart Paket: içerik metni dolu olmalı
  // Ana paket fiyatı (yayın için zorunlu) — hibrit: en az bir teslim modu fiyatlı olmalı
  const mainPriceVal = (() => {
    if (isHibrit) {
      const yy = s.priceRows.find((x) => x.key === "__main__yy");
      const on = s.priceRows.find((x) => x.key === "__main__on");
      return Math.max(yy ? Number(yy.liste) || 0 : 0, on ? Number(on.liste) || 0 : 0);
    }
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
    : publishBlockers.length > 0
    ? "Taslak — satışa açmak için eksik: " + publishBlockers.join(", ")
    : "Taslak";
  const statusDot = s.published ? "#22c55e" : "#cbd5e1";

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

  const publishStyle: CSSProperties = s.published
    ? { ...S.publishBase, cursor: "pointer", background: "#fef2f2", color: "#dc2626", boxShadow: "inset 0 0 0 1px #fecaca" }
    : canPublish
    ? { ...S.publishBase, cursor: "pointer", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }
    : { ...S.publishBase, cursor: "not-allowed", background: "#e8edf4", color: "#a9b4c4" };

  // ── DB kaydetme (Taslak / Satışa Başlat / Satışı Kapat) ──
  /** Fiyat satırı varsa sayısal değer, yoksa/boşsa null (DB'den silmek için). */
  const priceForKey = (key: string): number | null => {
    const r = s.priceRows.find((x) => x.key === key);
    return r && String(r.liste).trim() !== "" ? Number(r.liste) || 0 : null;
  };
  
  /** Eğitimi DB'ye yazar (yoksa oluşturur, varsa günceller). publish = satışa açık mı. */
  const saveEducation = async (publish: boolean): Promise<boolean> => {
    if (!s.egitimAdi.trim()) { toast.error("Eğitim adı zorunludur."); return false; }
    if (!s.bransId) { toast.error("Önce branş seçin."); return false; }
    if (publish && !s.published && !canPublish) { toast.error("Satışa başlatmak için eksik: " + publishBlockers.join(", ")); return false; }
    setBusy(true);
    try {
      const headers = await authHeadersJson();
      const audience = isKurumsal ? "corporate" : "individual";
      const structure = isBireysel && !yapiStd ? "sectioned" : "single";
      const outline = isBireysel && yapiStd && s.icerikMetni.trim() ? [s.icerikMetni] : undefined;
      const deliveryModeMap: Record<string, "in_person" | "online" | "hybrid"> = { "Yüz Yüze": "in_person", "Online": "online", "Hibrit": "hybrid" };
      const deliveryMode = deliveryModeMap[s.egitimOrtami] ?? "in_person";
      const totalHoursNum = Number(s.egitimSuresi) || undefined;
      // Hibrit eğitimlerde deliveryOptions dizisi oluştur
      const yyPrice = priceForKey("__main__yy");
      const onPrice = priceForKey("__main__on");
      const deliveryOptions = isHibrit ? ([
        ...(yyPrice != null ? [{ mode: "in_person" as const, listPrice: yyPrice }] : []),
        ...(onPrice != null ? [{ mode: "online" as const, listPrice: onPrice }] : []),
      ] as Array<{ mode: "in_person" | "online"; listPrice: number }>) : null;
      // Hibrit'te listPrice = en yüksek fiyat (referans); tekli modlarda direkt; yoksa null (DB'den sil)
      const mainListPrice = isHibrit
        ? (Math.max(yyPrice ?? 0, onPrice ?? 0) || null)
        : priceForKey("__main");
      const sharedFields = { name: s.egitimAdi.trim(), mebName: s.mebAdi.trim() || undefined, branchId: s.bransId, audience, structure, outline, deliveryMode, contractType: s.sozlesmeTipi, salesModel: s.satisModeli, totalHours: totalHoursNum, listPrice: mainListPrice, vatRate: kdv, onSale: publish, deliveryOptions };

      if (!eduId) {
        const certType = s.sertTipi === "Proje Bazlı" ? "project" as const : "exam" as const;
        const res = await fetch("/api/flexos/educations", {
          method: "POST", headers,
          body: JSON.stringify({ ...sharedFields, certType }),
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
          body: JSON.stringify({ ...sharedFields, certType }),
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
    save: { title: "Kaydet", message: <>Değişiklikler kaydedilecek. Satışa başlatmadığın sürece eğitim <strong>taslak</strong> olarak kalır.</>, confirmLabel: "Kaydet", tone: "primary" as const },
    publish: { title: "Satışa başlat", message: <>Eğitim <strong>satışa açılacak</strong> ve satış kataloğunda &quot;Satışta&quot; görünecek. Emin misin?</>, confirmLabel: "Satışa Başlat", tone: "publish" as const },
    unpublish: { title: "Satışı kapat", message: <>Eğitim satıştan kaldırılıp <strong>taslağa</strong> alınacak. Devam edilsin mi?</>, confirmLabel: "Satışı Kapat", tone: "danger" as const },
  };

  if (authed === null || !editReady) {
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
        <FlexHeader
          left={
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
          }
        />

        <div style={{ padding: "26px 36px 64px", maxWidth: 1080, margin: "0 auto", width: "100%", minWidth: 0, boxSizing: "border-box", overflowX: "clip", flex: 1 }}>

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
                <GenelTab s={s} branches={branches} onChange={onChange} patch={patch} isBireysel={isBireysel} isKurumsal={isKurumsal} yapiStd={yapiStd} />
              )}

              {/* ===== TAB 2: İÇERİKLER ===== */}
              {s.activeTab === "icerikler" && (
                <>
                  {/* BİREYSEL + TRACK BAZLI → bölüm & track ağacı (ultra esnek mod) */}
                  {isBireysel && !yapiStd && (
                    <BolumTrackYoneticisi
                      s={s}
                      onChange={onChange}
                      canAddBolum={canAddBolum}
                      addBolum={addBolum}
                      hasBolum={hasBolum}
                      trackLocked={trackLocked}
                      canAddTrack={canAddTrack}
                      addTrack={addTrack}
                      targetBolum={targetBolum}
                      remainingHours={remainingHours}
                      toggleTrackSell={toggleTrackSell}
                      onTrackTargetChange={onTrackTargetChange}
                      removeBolum={removeBolum}
                      removeTrack={removeTrack}
                      editingTrack={editingTrack}
                      setEditingTrack={setEditingTrack}
                      startEditTrack={startEditTrack}
                      saveEditTrack={saveEditTrack}
                      cancelEditTrack={cancelEditTrack}
                      dragTrack={dragTrack}
                      dragBolum={dragBolum}
                      onTrackDragStart={onTrackDragStart}
                      onTrackDragOver={onTrackDragOver}
                      onTrackDrop={onTrackDrop}
                      onBolumDragStart={onBolumDragStart}
                      onBolumDragOver={onBolumDragOver}
                      onBolumDrop={onBolumDrop}
                      setDragBolum={setDragBolum}
                      setDragTrack={setDragTrack}
                      totalHours={totalHours}
                    />
                  )}

                  {/* BİREYSEL + STANDART PAKET → tek paket; düz metin içerik (web sitesinden yapıştır) */}
                  {isBireysel && yapiStd && (
                    <StandartPaketIcerik icerikMetni={s.icerikMetni} onChange={(html) => patch({ icerikMetni: html })} />
                  )}

                  {/* KURUMSAL → gün gün program (1. Gün, 2. Gün… — düz metin başlıklar) */}
                  {isKurumsal && (
                    <GunPlanlayici days={days} getDay={getDay} setDay={setDay} addKonu={addKonu} removeKonu={removeKonu} />
                  )}
                </>
              )}

              {/* ===== TAB 3: FİYAT ===== */}
              {s.activeTab === "fiyat" && (
                <FiyatTab
                  s={s}
                  onChange={onChange}
                  isGun={isGun}
                  poolOptions={poolOptions}
                  canAddPrice={canAddPrice}
                  addPriceRow={addPriceRow}
                  kdv={kdv}
                  fmtCurrency={fmtCurrency}
                  getSymbol={getSymbol}
                  sureFor={sureFor}
                  setListe={setListe}
                  removePriceRow={removePriceRow}
                />
              )}

              {/* ===== TAB 4: SERTİFİKASYON ===== */}
              {s.activeTab === "sertifikasyon" && (
                <SertifikasyonTab isKurumsal={isKurumsal} isBireysel={isBireysel} sertTipi={s.sertTipi} onSertTipiChange={onChange("sertTipi")} sertText={sertText} />
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
        <Footer mini />
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
