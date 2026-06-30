"use client";

/**
 * FlexOS · Aktivite Merkezi
 * Tasarım: _design "Aktivite Merkezi.dc.html" (Claude Design) React'e portlandı.
 * Aynı desen: inline S/IC, Inter, authStateReady korumalı, FlexSidebar.
 *
 * KARARLAR (2026-06-30):
 *  - Talepler dış kanallardan (web/IG/WhatsApp) otomatik düşer.
 *  - Manuel giriş için "Aktivite Ekle" butonu var — hafif modal (Ad/Soyad/Tel/Kanal/Not).
 *  - TC, e-posta, eğitim dropdown'ı yok.
 *  - Expand panelde: aksiyon notu + sonraki adım + Tarih + Saat (eklendi) + Sorumlu devralma.
 *  - Randevu ekleme ayrı sayfa — ileride yapılacak.
 *  - Demo veriyle çalışıyor; API bağlantısı sonraki etapta (GET/POST /api/flexos/cases).
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState, CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { auth, db } from "@/app/lib/firebase";
import {
  collection, doc, addDoc, updateDoc,
  getDocs, onSnapshot, writeBatch,
} from "firebase/firestore";
import FlexSidebar from "../_components/FlexSidebar";

// ─── Sözlükler ────────────────────────────────────────────────────────────────

type KanalKey = "telefon" | "websitesi" | "instagram" | "whatsapp" | "email" | "tavsiye" | "walkin";
type TipKey   = "arama" | "mesaj" | "randevu" | "not" | "satis";
type DurumKey = "aksiyon_alinacak" | "yeni" | "iletisimde" | "arandi" | "yanit" | "mesaj_gonderildi" | "teklif_gonderildi" | "randevu_planli" | "randevu" | "kazanildi" | "vazgecti";
type TipCat   = "satis_oncesi" | "satis_sonrasi" | "destek";

const KANALS: Record<KanalKey, { label: string; bg: string; color: string }> = {
  telefon:   { label: "Telefon",    bg: "#E6F5ED", color: "#007A30" },
  websitesi: { label: "Web Sitesi", bg: "#DDE8F8", color: "#205297" },
  instagram: { label: "Instagram",  bg: "#FED7E9", color: "#B80E57" },
  whatsapp:  { label: "WhatsApp",   bg: "#E6F5ED", color: "#1a7a40" },
  email:     { label: "Email",      bg: "#FFECEC", color: "#B42318" },
  tavsiye:   { label: "Tavsiye",    bg: "#EDE9FE", color: "#5B21B6" },
  walkin:    { label: "Walk-in",    bg: "#FFF3DC", color: "#8A5A00" },
};

const TIPLER: Record<TipKey, { label: string; color: string; bg: string }> = {
  arama:   { label: "Arama",            color: "#205297", bg: "#DDE8F8" },
  mesaj:   { label: "Mesaj",            color: "#0E5D59", bg: "#AFF3F0" },
  randevu: { label: "Randevu",          color: "#4D52A6", bg: "#DDE0FA" },
  not:     { label: "Not",              color: "#6F7B87", bg: "#EEF0F3" },
  satis:   { label: "Satışa Dönüştür", color: "#007A30", bg: "#E6F5ED" },
};

const DURUMLAR: Record<DurumKey, { label: string; color: string; bg: string; dot: string }> = {
  aksiyon_alinacak: { label: "Aksiyon Alınacak", color: "#6F7B87", bg: "#EEF0F3", dot: "#AEB4C0" },
  yeni:             { label: "Yeni",              color: "#6F7B87", bg: "#EEF0F3", dot: "#AEB4C0" },
  iletisimde: { label: "Aranacak",   color: "#8A5A00", bg: "#FFF3DC", dot: "#FFB020" },
  arandi:     { label: "Arandı",     color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  yanit:           { label: "Yanıt Bekliyor",    color: "#8A5A00", bg: "#FFF3DC", dot: "#FFE2A8" },
  mesaj_gonderildi:{ label: "Mesaj Gönderildi", color: "#0E5D59", bg: "#AFF3F0", dot: "#14B8A6" },
  teklif_gonderildi:{ label: "Teklif Gönderildi", color: "#5B21B6", bg: "#EDE9FE", dot: "#8B5CF6" },
  randevu_planli: { label: "Randevu Oluşturulacak", color: "#4D52A6", bg: "#EDE9FE", dot: "#8B91E6" },
  randevu:        { label: "Randevu Oluşturuldu",   color: "#205297", bg: "#DDE8F8", dot: "#3A7BD5" },
  kazanildi:  { label: "Kayıt Oldu",           color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" },
  vazgecti:   { label: "Vazgeçti",            color: "#B42318", bg: "#FFECEC", dot: "#E5484D" },
};

const TIP_CATS: [string, string][] = [
  ["Tümü",        "Tüm Tipler"],
  ["satis_oncesi","Satış Öncesi"],
  ["satis_sonrasi","Satış Sonrası"],
  ["destek",      "Destek"],
];

const SONRAKI = [
  "Tekrar Aranacak", "Mesaj Gönderilecek", "Randevu Oluşturulacak",
  "Teklif Gönderilecek", "Kayıt Oldu", "Vazgeçti",
];

// Checkbox İŞARETSİZ kaydedilince durum
const SONRAKI_DURUM: Partial<Record<string, DurumKey>> = {
  "Tekrar Aranacak":       "iletisimde",
  "Randevu Oluşturulacak": "randevu_planli",
  "Kayıt Oldu":            "kazanildi",
  "Vazgeçti":              "vazgecti",
};

// Checkbox İŞARETLİ kaydedilince → tamamlandı versiyonu
const GONDERILECEK: Record<string, { tip: string; durum: DurumKey }> = {
  "Randevu Oluşturulacak": { tip: "Randevu Oluşturuldu",  durum: "randevu" },
  "Mesaj Gönderilecek":    { tip: "Mesaj Gönderildi",     durum: "mesaj_gonderildi" },
  "Teklif Gönderilecek":   { tip: "Teklif Gönderildi",    durum: "teklif_gonderildi" },
};

const SORUMLU_LIST = ["Alparslan Şentürk", "Merve Kaya"]; // TODO: API'den kullanıcılar

const getInitials = (name: string) => {
  const words = name.trim().split(" ");
  return words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : words[0].slice(0, 2).toUpperCase();
};

const AV_PAL: [string, string][] = [
  ["#689adf","#2867bd"], ["#FFA352","#FF7800"], ["#67B5B6","#1CB5AE"],
  ["#8B91E6","#4D52A6"], ["#F76FA3","#F91079"],
];

const PAGE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AktiviteRow {
  _docId?: string;
  id: number;
  kanal: KanalKey;
  tip: TipKey;
  tipCat: TipCat;
  ozet: string;
  ad: string;
  iletisim: string;
  durum: DurumKey;
  tarih: string;
  saat: string;
  sorumlu: string;
  musteriMesaji: string;
  aksiyonNotu: string;
  sonrakiTip: string;
  sonrakiTarih: string;
  sonrakiSaat: string;
  gelecekRandevu: string;
  aktiviteSayisi: number;
}

interface EkleForm {
  ad: string; soyad: string; telefon: string;
  kanal: KanalKey; not: string;
}
const EMPTY_EKLE: EkleForm = { ad: "", soyad: "", telefon: "", kanal: "telefon", not: "" };

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO: AktiviteRow[] = [
  { id:1,  kanal:"telefon",   tip:"arama",   tipCat:"satis_oncesi", ozet:"Python eğitimi için detaylı bilgi istiyor",          ad:"Ali Yılmaz",    iletisim:"0533 412 77 89",      durum:"iletisimde", tarih:"29.06.2026", saat:"14:20", sorumlu:"Alparslan Şentürk", musteriMesaji:"Python eğitimi hakkında bilgi almak istiyorum, kurs içeriği ve fiyatlar hakkında detay verir misiniz?", aksiyonNotu:"Öğrenci arandı. İçerik ve fiyat bilgisi paylaşıldı. Cumartesi görüşmek istiyor.", sonrakiTip:"Randevu",          sonrakiTarih:"2026-07-05", sonrakiSaat:"10:00", gelecekRandevu:"Cumartesi 10:00", aktiviteSayisi:3 },
  { id:2,  kanal:"websitesi", tip:"mesaj",   tipCat:"satis_oncesi", ozet:"UI/UX grubu başlangıç tarihi sorguluyor",            ad:"Zeynep Arslan", iletisim:"0542 881 32 10",      durum:"iletisimde", tarih:"29.06.2026", saat:"13:45", sorumlu:"Merve Kaya",      musteriMesaji:"UI/UX eğitimini almak istiyorum, gruplar ne zaman başlıyor?",                                          aksiyonNotu:"",                                                                                                     sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"",           sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
  { id:3,  kanal:"instagram", tip:"mesaj",   tipCat:"satis_oncesi", ozet:"Veri bilimi kursu hakkında soru",                   ad:"Masael Baran",  iletisim:"0531 996 44 56",      durum:"yanit",      tarih:"29.06.2026", saat:"12:30", sorumlu:"Alparslan Şentürk", musteriMesaji:"Instagram'dan gördüm, veri bilimi kursu var mı? Ücret nasıl?",                                                aksiyonNotu:"Broşür gönderildi. Yanıt bekleniyor.",                                                                 sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"2026-07-03", sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:2 },
  { id:4,  kanal:"telefon",   tip:"randevu", tipCat:"satis_oncesi", ozet:"Grafik tasarım tanışma randevusu",                  ad:"Atdri Kandev",  iletisim:"0537 224 65 43",      durum:"randevu",    tarih:"28.06.2026", saat:"11:15", sorumlu:"Merve Kaya",      musteriMesaji:"Grafik tasarım eğitimi hakkında randevu almak istiyorum.",                                                aksiyonNotu:"Randevu oluşturuldu. Salı 14:00'a kadar.",                                                             sonrakiTip:"Randevu Oluşturulacak", sonrakiTarih:"2026-07-01", sonrakiSaat:"14:00", gelecekRandevu:"Salı 14:00",   aktiviteSayisi:2 },
  { id:5,  kanal:"whatsapp",  tip:"satis",   tipCat:"satis_oncesi", ozet:"Full-stack web programına kayıt yaptırdı",          ad:"Ali Yılmaz",    iletisim:"0533 412 77 89",      durum:"kazanildi",  tarih:"28.06.2026", saat:"16:40", sorumlu:"Alparslan Şentürk", musteriMesaji:"",                                                                                                             aksiyonNotu:"Full-stack Web Geliştirme programına kayıt oldu. Ödeme alındı.",                                       sonrakiTip:"Vazgeçti",        sonrakiTarih:"",           sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:3 },
  { id:6,  kanal:"email",     tip:"mesaj",   tipCat:"destek",       ozet:"Yazılım eğitimi bilgi talebi yanıtsız kaldı",       ad:"Hasan Kara",    iletisim:"hasan.kara@mail.com", durum:"vazgecti",   tarih:"28.06.2026", saat:"15:10", sorumlu:"Merve Kaya",      musteriMesaji:"Yazılım eğitimleriniz hakkında bilgi almak istiyorum.",                                                   aksiyonNotu:"3 kez arandı. İletişim kurulamadı.",                                                                   sonrakiTip:"Vazgeçti",        sonrakiTarih:"",           sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
  { id:7,  kanal:"tavsiye",   tip:"arama",   tipCat:"satis_oncesi", ozet:"Arkadaş tavsiyesi — finans eğitimi",               ad:"Elif Doğan",    iletisim:"0544 773 21 09",      durum:"iletisimde", tarih:"27.06.2026", saat:"10:00", sorumlu:"Alparslan Şentürk", musteriMesaji:"Arkadaşım tavsiye etti. Finans eğitimi almak istiyorum.",                                                  aksiyonNotu:"İlk temas yapıldı. Olumlu.",                                                                           sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"2026-07-05", sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
  { id:8,  kanal:"walkin",    tip:"not",     tipCat:"satis_oncesi", ozet:"Ofise bizzat geldi, materyaller aldı",              ad:"Kaan Öztürk",   iletisim:"0538 651 88 22",      durum:"yanit",      tarih:"27.06.2026", saat:"14:30", sorumlu:"Merve Kaya",      musteriMesaji:"",                                                                                                             aksiyonNotu:"Broşür ve fiyat listesi verildi. Kararını bildireceğini söyledi.",                                     sonrakiTip:"Mesaj Gönderilecek",sonrakiTarih:"2026-07-07", sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
  { id:9,  kanal:"websitesi", tip:"mesaj",   tipCat:"satis_oncesi", ozet:"Tasarım + yazılım combo var mı?",                  ad:"Selin Yıldız",  iletisim:"0532 444 56 78",      durum:"yeni",       tarih:"27.06.2026", saat:"09:15", sorumlu:"Alparslan Şentürk", musteriMesaji:"Hem tasarım hem yazılım eğitimi almak istiyorum, kombine paket var mı?",                                   aksiyonNotu:"",                                                                                                     sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"",           sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
  { id:10, kanal:"instagram", tip:"arama",   tipCat:"satis_oncesi", ozet:"Grafik tasarım fiyat sorguluyor",                  ad:"Burak Şen",     iletisim:"0546 320 14 55",      durum:"iletisimde", tarih:"26.06.2026", saat:"11:50", sorumlu:"Merve Kaya",      musteriMesaji:"Instagram'dan gördüm, grafik tasarım kursu ne kadar?",                                                    aksiyonNotu:"Fiyat bilgisi verildi. Düşüneceğini söyledi.",                                                         sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"2026-07-06", sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
  { id:11, kanal:"whatsapp",  tip:"mesaj",   tipCat:"satis_oncesi", ozet:"Yazılım bootcamp detayları",                       ad:"Naz Güler",     iletisim:"0539 770 29 43",      durum:"yanit",      tarih:"26.06.2026", saat:"16:20", sorumlu:"Alparslan Şentürk", musteriMesaji:"Yazılım bootcamp hakkında bilgi verir misiniz?",                                                          aksiyonNotu:"Detaylı bilgi gönderildi.",                                                                             sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"2026-07-05", sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:2 },
  { id:12, kanal:"telefon",   tip:"randevu", tipCat:"satis_oncesi", ozet:"Finans eğitimi değerlendirme toplantısı",          ad:"Tolga Arslan",  iletisim:"0530 182 74 61",      durum:"randevu",    tarih:"25.06.2026", saat:"13:00", sorumlu:"Merve Kaya",      musteriMesaji:"Finans eğitimi hakkında daha fazla bilgi almak istiyorum.",                                               aksiyonNotu:"Randevu oluşturuldu. Çarşamba 15:00.",                                                                 sonrakiTip:"Randevu Oluşturulacak", sonrakiTarih:"2026-07-02", sonrakiSaat:"15:00", gelecekRandevu:"Çarşamba 15:00",aktiviteSayisi:2 },
  { id:13, kanal:"email",     tip:"not",     tipCat:"satis_sonrasi",ozet:"Mevcut öğrenci ek modül soruyor",                  ad:"Buse Yılmaz",   iletisim:"buse.yilmaz@mail.com",durum:"iletisimde", tarih:"25.06.2026", saat:"10:45", sorumlu:"Alparslan Şentürk", musteriMesaji:"Devam eden eğitimime ek modül ekleyebilir miyim?",                                                       aksiyonNotu:"Eğitim danışmanına yönlendirildi.",                                                                     sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"2026-07-01", sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
  { id:14, kanal:"telefon",   tip:"arama",   tipCat:"destek",       ozet:"Teknik sorun, LMS erişim problemi",                ad:"Emre Çelik",    iletisim:"0542 736 50 82",      durum:"iletisimde", tarih:"24.06.2026", saat:"15:30", sorumlu:"Merve Kaya",      musteriMesaji:"LMS'e giriş yapamıyorum, şifremi sıfırladım ama hâlâ olmadı.",                                           aksiyonNotu:"IT birimine iletildi.",                                                                                 sonrakiTip:"Tekrar Aranacak",  sonrakiTarih:"2026-06-30", sonrakiSaat:"",      gelecekRandevu:"",             aktiviteSayisi:1 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AktiviteMerkeziPage() {
  const [ready, setReady]           = useState(false);
  const [acts, setActs]             = useState<AktiviteRow[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // expand panel draft
  const [draftNote,       setDraftNote]       = useState("");
  const [draftSonrakiTip, setDraftSonrakiTip] = useState("Tekrar Aranacak");
  const [draftTarih,      setDraftTarih]      = useState("");
  const [draftSaat,       setDraftSaat]       = useState("");
  const [draftSorumlu,    setDraftSorumlu]    = useState("");
  const [draftGonderildi, setDraftGonderildi] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draftSonrakiTip === "Randevu Oluşturulacak") {
      setTimeout(() => {
        try { dateInputRef.current?.showPicker(); } catch {}
      }, 260);
    }
  }, [draftSonrakiTip]);

  // filters
  const [fKanal,   setFKanal]   = useState("Tümü");
  const [fTip,     setFTip]     = useState("Tümü");
  const [fDurum,   setFDurum]   = useState("Tümü");
  const [fSorumlu, setFSorumlu] = useState("Tümü");
  const [openDd,   setOpenDd]   = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);

  // "Diğer Aktiviteler" accordion (expand panel içinde)
  const [digerOpenId, setDigerOpenId] = useState<number | null>(null);

  // "Aktivite Ekle" modal
  const [ekleOpen,   setEkleOpen]   = useState(false);
  const [ekleForm,   setEkleForm]   = useState<EkleForm>(EMPTY_EKLE);
  const [ekleSaving, setEkleSaving] = useState(false);

  useEffect(() => {
    let unsubSnap: (() => void) | null = null;
    const col = collection(db, "flexos_prospects");

    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) { setReady(true); return; }

      // Seed yoksa DEMO'yu Firestore'a yaz
      const snap = await getDocs(col);
      if (snap.empty) {
        const batch = writeBatch(db);
        DEMO.forEach(row => {
          const { _docId: _, ...data } = row as AktiviteRow & { _docId?: string };
          batch.set(doc(col), data);
        });
        await batch.commit();
      }

      // Gerçek zamanlı dinle — ilk snapshot gelince ekranı aç
      unsubSnap = onSnapshot(col, (s) => {
        const rows = s.docs.map(d => ({ ...(d.data() as AktiviteRow), _docId: d.id }));
        rows.sort((a, b) => b.id - a.id);
        setActs(rows);
        setReady(true);
      });
    });

    return () => { unsubAuth(); unsubSnap?.(); };
  }, []);

  const expand = useCallback((a: AktiviteRow) => {
    if (expandedId === a.id) { setExpandedId(null); return; }
    setExpandedId(a.id);
    setDraftNote(a.aksiyonNotu);
    const preAction = a.durum === "aksiyon_alinacak" || a.durum === "iletisimde";
    setDraftSonrakiTip(preAction ? "" : (a.sonrakiTip || ""));
    setDraftTarih(a.sonrakiTarih || "");
    setDraftSaat(a.sonrakiSaat || "");
    setDraftSorumlu(a.sorumlu);
    setDraftGonderildi(false);
  }, [expandedId]);

  const saveAct = useCallback(async (id: number, docId?: string) => {
    if (!draftSonrakiTip) { toast.error("Durum seçiniz."); return; }
    const gonderildiMap = GONDERILECEK[draftSonrakiTip];
    const effectiveTip  = draftGonderildi && gonderildiMap ? gonderildiMap.tip : draftSonrakiTip;
    const newDurum      = draftGonderildi && gonderildiMap ? gonderildiMap.durum : SONRAKI_DURUM[draftSonrakiTip];
    const updates: Partial<AktiviteRow> = {
      aksiyonNotu:  draftNote,
      sonrakiTip:   effectiveTip,
      sonrakiTarih: draftTarih,
      sonrakiSaat:  draftSaat,
      sorumlu:      draftSorumlu,
      ...(newDurum ? { durum: newDurum } : {}),
    };
    if (docId) {
      await updateDoc(doc(db, "flexos_prospects", docId), updates);
    } else {
      setActs(prev => prev.map(a => a.id !== id ? a : { ...a, ...updates }));
    }
    setExpandedId(null);
    toast.success("Aksiyon kaydedildi.");
  }, [draftNote, draftSonrakiTip, draftTarih, draftSaat, draftSorumlu, draftGonderildi]);

  const handleEkle = async () => {
    if (!ekleForm.ad.trim() || !ekleForm.soyad.trim() || !ekleForm.telefon.trim()) {
      toast.error("Ad, soyad ve telefon zorunlu.");
      return;
    }
    setEkleSaving(true);
    const now = new Date();
    const newRow = {
      id:            Date.now(),
      kanal:         ekleForm.kanal,
      tip:           "arama" as const,
      tipCat:        "satis_oncesi" as const,
      ozet:          ekleForm.not || "Yeni talep",
      ad:            `${ekleForm.ad.trim()} ${ekleForm.soyad.trim()}`,
      iletisim:      ekleForm.telefon.trim(),
      durum:         "aksiyon_alinacak" as const,
      tarih:         now.toLocaleDateString("tr-TR"),
      saat:          now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      sorumlu:       "Alparslan Şentürk",
      musteriMesaji: "",
      aksiyonNotu:   ekleForm.not,
      sonrakiTip:    "",
      sonrakiTarih:  "", sonrakiSaat: "", gelecekRandevu: "",
      aktiviteSayisi: 1,
    };
    try {
      await addDoc(collection(db, "flexos_prospects"), newRow);
      setEkleForm(EMPTY_EKLE);
      setEkleOpen(false);
      toast.success("Talep oluşturuldu.");
    } catch {
      toast.error("Kayıt başarısız.");
    } finally {
      setEkleSaving(false);
    }
  };

  const filtered = useMemo(() => {
    let r = acts;
    if (fKanal   !== "Tümü") r = r.filter(a => a.kanal   === fKanal);
    if (fTip     !== "Tümü") r = r.filter(a => a.tipCat  === fTip);
    if (fDurum   !== "Tümü") r = r.filter(a => a.durum   === fDurum);
    if (fSorumlu !== "Tümü") r = r.filter(a => a.sorumlu === fSorumlu);
    return r;
  }, [acts, fKanal, fTip, fDurum, fSorumlu]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageActs   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const anyFilter  = fKanal !== "Tümü" || fTip !== "Tümü" || fDurum !== "Tümü" || fSorumlu !== "Tümü";
  const showDatetime = draftSonrakiTip === "Tekrar Aranacak" || draftSonrakiTip === "Randevu Oluşturulacak";

  if (!ready) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: FONT }}>
        <FlexSidebar active="aktivite-merkezi" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
          <span style={{ color: "#8E95A3", fontSize: 14 }}>Yükleniyor…</span>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: FONT }}>
      <style>{CSS}</style>
      <FlexSidebar active="aktivite-merkezi" />

      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3" }}>

        {/* ── HEADER ── */}
        <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px", background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px" }}>Aktivite Merkezi</h1>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6F7B87", fontWeight: 500 }}>Tüm talepler ve aktiviteler tek ekranda.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button className="am-icon-btn" style={{ position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              <span style={{ position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" }} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #E2E5EA" }}>
              <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Alparslan Şentürk</div>
                <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Yönetici · Eğitmen</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" }}>AŞ</div>
            </div>
          </div>
        </header>

        <div style={{ padding: "28px 36px 56px", maxWidth: 1560, margin: "0 auto" }}>

          {/* ── FILTER BAR ── */}
          <div style={{ position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

              {/* Kanal */}
              <Dd
                label={fKanal === "Tümü" ? "Tüm Kanallar" : KANALS[fKanal as KanalKey]?.label}
                open={openDd === "kanal"}
                onToggle={() => setOpenDd(d => d === "kanal" ? null : "kanal")}
              >
                {(["Tümü", ...Object.keys(KANALS)] as string[]).map(k => (
                  <DdItem key={k}
                    label={k === "Tümü" ? "Tüm Kanallar" : KANALS[k as KanalKey].label}
                    active={fKanal === k}
                    onClick={() => { setFKanal(k); setOpenDd(null); setPage(1); }}
                  />
                ))}
              </Dd>

              {/* Tip kategorisi */}
              <Dd
                label={TIP_CATS.find(x => x[0] === fTip)?.[1] ?? "Tüm Tipler"}
                open={openDd === "tip"}
                onToggle={() => setOpenDd(d => d === "tip" ? null : "tip")}
              >
                {TIP_CATS.map(([k, l]) => (
                  <DdItem key={k} label={l} active={fTip === k} onClick={() => { setFTip(k); setOpenDd(null); setPage(1); }} />
                ))}
              </Dd>

              {/* Durum */}
              <Dd
                label={fDurum === "Tümü" ? "Tüm Durumlar" : DURUMLAR[fDurum as DurumKey]?.label}
                open={openDd === "durum"}
                onToggle={() => setOpenDd(d => d === "durum" ? null : "durum")}
              >
                {(["Tümü", ...Object.keys(DURUMLAR)] as string[]).map(k => {
                  const d = DURUMLAR[k as DurumKey];
                  return (
                    <DdItem key={k} active={fDurum === k} onClick={() => { setFDurum(k); setOpenDd(null); setPage(1); }}
                      label={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {d && <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.dot, flex: "0 0 auto" }} />}
                        {k === "Tümü" ? "Tüm Durumlar" : d?.label}
                      </span>}
                    />
                  );
                })}
              </Dd>

              {/* Sorumlu */}
              <Dd
                label={fSorumlu === "Tümü" ? "Tüm Sorumlular" : fSorumlu}
                open={openDd === "sorumlu"}
                onToggle={() => setOpenDd(d => d === "sorumlu" ? null : "sorumlu")}
              >
                {["Tümü", ...SORUMLU_LIST].map(v => (
                  <DdItem key={v} label={v === "Tümü" ? "Tüm Sorumlular" : v} active={fSorumlu === v}
                    onClick={() => { setFSorumlu(v); setOpenDd(null); setPage(1); }} />
                ))}
              </Dd>

              {anyFilter && (
                <button className="am-clear-btn" onClick={() => { setFKanal("Tümü"); setFTip("Tümü"); setFDurum("Tümü"); setFSorumlu("Tümü"); setPage(1); setOpenDd(null); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  Temizle
                </button>
              )}
            </div>

            {/* Aktivite Ekle */}
            <button className="am-orange-btn" onClick={() => setEkleOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              Aktivite Ekle
            </button>
          </div>

          {/* ── TABLE ── */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                    <th style={{ ...S.th, paddingLeft: 22, width: 40 }}>#</th>
                    <th style={S.th}>Kanal</th>
                    <th style={S.th}>Aktivite Tipi</th>
                    <th style={S.th}>Müşteri</th>
                    <th style={S.th}>Durum</th>
                    <th style={S.th}>Tarih / Saat</th>
                    <th style={S.th}>Sorumlu</th>
                    <th style={{ ...S.th, textAlign: "right", paddingRight: 22, width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pageActs.map((a, idx) => {
                    const k = KANALS[a.kanal];
                    const t = TIPLER[a.tip];
                    const d = DURUMLAR[a.durum];
                    const expanded = expandedId === a.id;
                    const pal = AV_PAL[(a.id - 1) % AV_PAL.length];
                    return (
                      <React.Fragment key={a.id}>
                        {/* ── main row ── */}
                        <tr className="am-tr" style={{ cursor: "pointer", borderBottom: "1px solid #EEF0F3", background: expanded ? "#EFF3FA" : "transparent" }} onClick={() => expand(a)}>
                          <td style={{ padding: "15px 14px 15px 22px", verticalAlign: "middle", width: 40 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#AEB4C0" }}>{(safePage - 1) * PAGE_SIZE + idx + 1}</span>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <span style={{ width: 34, height: 34, borderRadius: 9, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", fontSize: 13, fontWeight: 800 }}>
                                {k.label.charAt(0)}
                              </span>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1E222B", whiteSpace: "nowrap" }}>{k.label}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 280 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, color: t.color, background: t.bg, whiteSpace: "nowrap", width: "fit-content" }}>
                                {t.label}
                              </span>
                              <span style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.ozet}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{a.ad}</span>
                                {a.aktiviteSayisi > 1 && (
                                  <span
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (expandedId !== a.id) expand(a);
                                      setDigerOpenId(id => id === a.id ? null : a.id);
                                    }}
                                    className="am-badge-btn"
                                    style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#64748b", minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "0 5px", cursor: "pointer", flexShrink: 0 }}>
                                    {a.aktiviteSayisi}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{a.iletisim}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px 5px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: d.color, background: d.bg, whiteSpace: "nowrap" }}>
                              {a.durum === "kazanildi" ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="M20 6 9 17l-5-5"/></svg>
                              ) : a.durum === "vazgecti" ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="M18 6 6 18M6 6l12 12"/></svg>
                              ) : (
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.dot, flex: "0 0 auto" }} />
                              )}
                              {d.label}
                            </span>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>{a.tarih}</span>
                              <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 600 }}>{a.saat}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${pal[0]},${pal[1]})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flex: "0 0 auto" }}>
                                {getInitials(a.sorumlu)}
                              </span>
                              <span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 600 }}>{a.sorumlu}</span>
                            </div>
                          </td>
                          <td style={{ padding: "15px 22px 15px 14px", textAlign: "right", width: 48, verticalAlign: "middle" }}>
                            <button className="am-chev-btn" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: expanded ? "#DDE8F8" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: expanded ? "#205297" : "#8E95A3" }}>
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                {expanded ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
                              </svg>
                            </button>
                          </td>
                        </tr>

                        {/* ── expand panel ── */}
                        <tr style={{ background: "#F5F8FF", borderBottom: expanded ? "2px solid #c0d5ef" : "none" }}>
                          <td colSpan={8} style={{ padding: 0 }}>
                            <AnimatePresence initial={false}>
                              {expanded && (
                                <motion.div
                                  key="panel"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                                  style={{ overflow: "hidden" }}
                                >
                              <div style={{ padding: "20px 28px 22px" }}>

                                {/* Müşteri mesajı + gelecek randevu */}
                                {(a.musteriMesaji || a.gelecekRandevu) && (
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
                                    {a.musteriMesaji && (
                                      <div style={{ flex: 1, minWidth: 240 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 5 }}>Müşteri Mesajı:</div>
                                        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, fontWeight: 500 }}>{a.musteriMesaji}</div>
                                      </div>
                                    )}
                                    {a.gelecekRandevu && (
                                      <div style={{ flex: "0 0 auto" }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 5 }}>Gelecek Randevu:</div>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 10, background: "#DDE8F8", color: "#205297", fontSize: 13, fontWeight: 700, border: "1px solid #c0d5ef" }}>
                                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                                          {a.gelecekRandevu}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Aksiyon notu */}
                                <div style={{ marginBottom: 18 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 7 }}>Aksiyon:</div>
                                  <textarea
                                    value={draftNote}
                                    onChange={e => setDraftNote(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    placeholder="Aksiyon notunu buraya yazın…"
                                    style={{ width: "100%", minHeight: 78, resize: "vertical", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, outline: "none", fontFamily: FONT }}
                                  />
                                </div>

                                {/* Controls row */}
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>

                                  {/* Durum dropdown */}
                                  <LabeledField label="Durum">
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{ position: "relative" }}>
                                        <select value={draftSonrakiTip} onChange={e => { setDraftSonrakiTip(e.target.value); setDraftGonderildi(false); }} onClick={e => e.stopPropagation()} style={{ ...S.sel, minWidth: 200, color: draftSonrakiTip ? "#1E222B" : "#8E95A3" }}>
                                          <option value="" disabled>— Durum seçin —</option>
                                          {SONRAKI.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                      </div>
                                      <AnimatePresence initial={false}>
                                        {GONDERILECEK[draftSonrakiTip] && (
                                          <motion.label
                                            key="gonderildi-cb"
                                            initial={{ opacity: 0, x: -6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -6 }}
                                            transition={{ duration: 0.18 }}
                                            onClick={e => e.stopPropagation()}
                                            style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={draftGonderildi}
                                              onChange={e => setDraftGonderildi(e.target.checked)}
                                              style={{ width: 15, height: 15, accentColor: "#2867bd", cursor: "pointer" }}
                                            />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: draftGonderildi ? "#2867bd" : "#6B7280" }}>
                                              {draftGonderildi ? GONDERILECEK[draftSonrakiTip]?.tip : "Gönderildi mi?"}
                                            </span>
                                          </motion.label>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </LabeledField>

                                  {/* Tarih + Saat — her zaman görünür, ilgisizse disabled */}
                                  <LabeledField label="Tarih">
                                    <input ref={dateInputRef} type="date" value={draftTarih} onChange={e => setDraftTarih(e.target.value)} onClick={e => e.stopPropagation()}
                                      disabled={!showDatetime}
                                      style={{ ...S.sel, minWidth: 160, padding: "10px 14px", opacity: showDatetime ? 1 : 0.38, cursor: showDatetime ? "auto" : "not-allowed" }} />
                                  </LabeledField>
                                  <LabeledField label="Saat">
                                    <input type="time" value={draftSaat} onChange={e => setDraftSaat(e.target.value)} onClick={e => e.stopPropagation()}
                                      disabled={!showDatetime}
                                      style={{ ...S.sel, minWidth: 120, padding: "10px 14px", opacity: showDatetime ? 1 : 0.38, cursor: showDatetime ? "auto" : "not-allowed" }} />
                                  </LabeledField>

                                  {/* Sorumlu devralma */}
                                  <LabeledField label="Sorumlu">
                                    <div style={{ position: "relative" }}>
                                      <select value={draftSorumlu || a.sorumlu} onChange={e => setDraftSorumlu(e.target.value)} onClick={e => e.stopPropagation()} style={{ ...S.sel, minWidth: 150 }}>
                                        {SORUMLU_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                      <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                    </div>
                                  </LabeledField>

                                  {/* İptal + Kaydet */}
                                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                                    <button onClick={e => { e.stopPropagation(); setExpandedId(null); }} className="am-cancel-btn"
                                      style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                                      İptal
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); saveAct(a.id, a._docId); }} className="am-save-btn"
                                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(32,82,151,.55)" }}>
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                      Kaydet
                                    </button>
                                  </div>
                                </div>

                                {/* ── Diğer Aktiviteler ── */}
                                {(() => {
                                  const diger = acts.filter(x => x.iletisim === a.iletisim && x.id !== a.id);
                                  if (diger.length === 0) return null;
                                  const digerOpen = digerOpenId === a.id;
                                  return (
                                    <div style={{ marginTop: 18, borderTop: "1px solid #D8E3F0" }}>
                                      <button
                                        onClick={e => { e.stopPropagation(); setDigerOpenId(id => id === a.id ? null : a.id); }}
                                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                                      >
                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#4D52A6" }}>
                                          Diğer Aktiviteler
                                        </span>
                                        <motion.span
                                          animate={{ rotate: digerOpen ? 180 : 0 }}
                                          transition={{ duration: 0.2 }}
                                          style={{ display: "inline-flex", color: "#4D52A6" }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                        </motion.span>
                                      </button>
                                      <AnimatePresence initial={false}>
                                        {digerOpen && (
                                          <motion.div
                                            key="diger"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                            style={{ overflow: "hidden" }}
                                          >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4, paddingTop: 6 }}>
                                              {diger.sort((x, y) => y.id - x.id).map(d => {
                                                const dk = KANALS[d.kanal];
                                                const dd = DURUMLAR[d.durum];
                                                return (
                                                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "#EDF2FB", border: "1px solid #D0DCEE" }}>
                                                    {/* Kanal chip */}
                                                    <span style={{ width: 28, height: 28, borderRadius: 7, background: dk.bg, color: dk.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "0 0 auto" }}>
                                                      {dk.label.charAt(0)}
                                                    </span>
                                                    {/* Özet */}
                                                    <span style={{ flex: 1, fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.ozet}</span>
                                                    {/* Tarih */}
                                                    <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 600, whiteSpace: "nowrap" }}>{d.tarih} · {d.saat}</span>
                                                    {/* Durum */}
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: dd.color, background: dd.bg, whiteSpace: "nowrap", flex: "0 0 auto" }}>
                                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dd.dot }} />
                                                      {dd.label}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })()}

                              </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {pageActs.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#414B59" }}>Aktivite bulunamadı</div>
                <div style={{ fontSize: 13, color: "#8E95A3" }}>Filtreleri değiştirip tekrar deneyin.</div>
              </div>
            )}

            {/* Pagination */}
            {pageActs.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "15px 22px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
                <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
                  Toplam <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filtered.length}</strong> aktivite
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <button className="am-pag-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                    style={{ ...S.pagBtn, cursor: safePage <= 1 ? "not-allowed" : "pointer", opacity: safePage <= 1 ? 0.4 : 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className="am-pag-btn" onClick={() => setPage(p)}
                      style={{ ...S.pagBtn, border: p === safePage ? "1px solid #2867bd" : "1px solid #E2E5EA", background: p === safePage ? "#2867bd" : "#fff", color: p === safePage ? "#fff" : "#414B59", fontWeight: p === safePage ? 700 : 600 }}>
                      {p}
                    </button>
                  ))}
                  <button className="am-pag-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                    style={{ ...S.pagBtn, cursor: safePage >= totalPages ? "not-allowed" : "pointer", opacity: safePage >= totalPages ? 0.4 : 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dropdown click-away */}
      {openDd && <div onClick={() => setOpenDd(null)} style={{ position: "fixed", inset: 0, zIndex: 15 }} />}

      {/* ── AKTİVİTE EKLE MODAL ── */}
      <AnimatePresence>
        {ekleOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            onClick={() => setEkleOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px -12px rgba(15,31,61,.3)", width: "100%", maxWidth: 460, padding: "28px 28px 24px" }}
            >
              {/* Modal header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E222B" }}>Yeni Talep</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Manuel olarak talep kaydı oluştur.</p>
                </div>
                <button onClick={() => setEkleOpen(false)} className="am-icon-btn"
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8E95A3" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Ad + Soyad */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={S.label}>Ad <Req /></label>
                    <input value={ekleForm.ad} onChange={e => setEkleForm(f => ({ ...f, ad: e.target.value }))} placeholder="Ad" style={S.inp} />
                  </div>
                  <div>
                    <label style={S.label}>Soyad <Req /></label>
                    <input value={ekleForm.soyad} onChange={e => setEkleForm(f => ({ ...f, soyad: e.target.value }))} placeholder="Soyad" style={S.inp} />
                  </div>
                </div>
                {/* Telefon */}
                <div>
                  <label style={S.label}>Telefon <Req /></label>
                  <input value={ekleForm.telefon} onChange={e => setEkleForm(f => ({ ...f, telefon: e.target.value }))} placeholder="0xxx xxx xx xx" style={S.inp} type="tel" />
                </div>
                {/* Kanal */}
                <div>
                  <label style={S.label}>Kaynak Kanal</label>
                  <div style={{ position: "relative" }}>
                    <select value={ekleForm.kanal} onChange={e => setEkleForm(f => ({ ...f, kanal: e.target.value as KanalKey }))} style={{ ...S.inp, paddingRight: 36, appearance: "none" }}>
                      {(Object.entries(KANALS) as [KanalKey, typeof KANALS[KanalKey]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                </div>
                {/* Not */}
                <div>
                  <label style={S.label}>Not <span style={{ color: "#AEB4C0", fontWeight: 400 }}>(opsiyonel)</span></label>
                  <textarea value={ekleForm.not} onChange={e => setEkleForm(f => ({ ...f, not: e.target.value }))} placeholder="İlgilendiği eğitim, ek bilgi…"
                    style={{ ...S.inp, minHeight: 72, resize: "vertical" }} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, paddingTop: 18, borderTop: "1px solid #EEF0F3" }}>
                <button onClick={() => setEkleOpen(false)} className="am-cancel-btn"
                  style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  İptal
                </button>
                <button onClick={handleEkle} disabled={ekleSaving} className="am-orange-btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: ekleSaving ? "not-allowed" : "pointer", opacity: ekleSaving ? 0.7 : 1, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" }}>
                  {ekleSaving ? "Kaydediliyor…" : "Talep Oluştur"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Dd({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <button className="am-dd-btn" onClick={onToggle}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" }}>
        {label}
        <ChevIcon />
      </button>
      {open && <div style={S.ddPanel}>{children}</div>}
    </div>
  );
}

function DdItem({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? "#205297" : "#414B59", background: active ? "#E2EAF3" : "transparent" }}>
      <span>{label}</span>
      {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#205297" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>{label}</span>
      {children}
    </div>
  );
}

function ChevIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

function Req() {
  return <span style={{ color: "#E5484D" }}>*</span>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FONT = "'Inter', system-ui, sans-serif";

const S: Record<string, CSSProperties> = {
  th:     { padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  td:     { padding: "15px 14px", verticalAlign: "middle" },
  ddPanel:{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 190, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "ddIn .15s cubic-bezier(.2,.8,.3,1)", maxHeight: 280, overflowY: "auto" },
  sel:    { padding: "10px 36px 10px 13px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, color: "#1E222B", outline: "none", cursor: "pointer", appearance: "none" as const },
  pagBtn: { minWidth: 36, height: 36, padding: "0 10px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 13.5, transition: "all .14s" },
  label:  { display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 },
  inp:    { width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontFamily: FONT, outline: "none" },
};

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: #CDD2DA; border-radius: 10px; border: 2px solid #EEF0F3; }
  ::-webkit-scrollbar-thumb:hover { background: #AEB4C0; }
  @keyframes ddIn { from { opacity: 0; transform: translateY(-8px) scale(.985); } to { opacity: 1; transform: none; } }
  textarea, select, input { font-family: 'Inter', system-ui, sans-serif; }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: .5; }
  .am-tr:hover { background: #FAFBFC !important; }
  .am-dd-btn:hover { border-color: #CDD2DA !important; background: #F7F8FA !important; }
  .am-chev-btn:hover { background: #F0F4FA !important; }
  .am-pag-btn:hover { background: #F7F8FA !important; }
  .am-icon-btn:hover { background: #F7F8FA !important; color: #1E222B !important; }
  .am-cancel-btn:hover { background: #F7F8FA !important; }
  .am-save-btn:hover { filter: brightness(1.07); }
  .am-orange-btn:hover { filter: brightness(1.06); }
  .am-clear-btn:hover { background: #FFECEC !important; }
  .am-badge-btn:hover { background: #C8CFF5 !important; }
`;
