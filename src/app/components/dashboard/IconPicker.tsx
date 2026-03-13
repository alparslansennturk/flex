"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { Search, ChevronDown, X } from "lucide-react";
import { TaskType, TYPE_GRADIENT } from "./taskTypes";

// ~150 ikonluk seçilmiş liste — label Türkçe (arama için)
const RAW_ICON_LIST = [
  // Tasarım & Sanat
  { key: "Palette",        label: "Palet" },
  { key: "PenTool",        label: "Kalem Ucu" },
  { key: "Brush",          label: "Fırça" },
  { key: "Pencil",         label: "Kurşunkalem" },
  { key: "Pen",            label: "Kalem" },
  { key: "Edit3",          label: "Düzenle" },
  { key: "Image",          label: "Görsel" },
  { key: "Images",         label: "Görseller" },
  { key: "Camera",         label: "Kamera" },
  { key: "Frame",          label: "Çerçeve" },
  { key: "Layers",         label: "Katmanlar" },
  { key: "Layout",         label: "Yerleşim" },
  { key: "LayoutGrid",     label: "Izgara Yerleşim" },
  { key: "LayoutTemplate", label: "Şablon" },
  { key: "Scissors",       label: "Makas" },
  { key: "Type",           label: "Yazı Tipi" },
  { key: "Maximize2",      label: "Büyüt" },
  { key: "Crop",           label: "Kırp" },
  { key: "Wand2",          label: "Sihir Değneği" },
  { key: "Sparkles",       label: "Parıltı" },
  { key: "Pipette",        label: "Damlalık" },
  { key: "Eraser",         label: "Silgi" },
  { key: "Aperture",       label: "Diyafram" },
  { key: "ScanLine",       label: "Tarama" },
  // Eğitim & Bilim
  { key: "GraduationCap",  label: "Mezuniyet" },
  { key: "BookOpen",       label: "Açık Kitap" },
  { key: "Book",           label: "Kitap" },
  { key: "BookMarked",     label: "İşaretli Kitap" },
  { key: "BookCopy",       label: "Kopya Kitap" },
  { key: "Library",        label: "Kütüphane" },
  { key: "Trophy",         label: "Kupa" },
  { key: "Medal",          label: "Madalya" },
  { key: "Award",          label: "Ödül" },
  { key: "Star",           label: "Yıldız" },
  { key: "Lightbulb",      label: "Fikir" },
  { key: "FlaskConical",   label: "Deney Tüpü" },
  { key: "Microscope",     label: "Mikroskop" },
  { key: "Calculator",     label: "Hesap Makinesi" },
  { key: "Ruler",          label: "Cetvel" },
  { key: "Sigma",          label: "Sigma" },
  { key: "Brain",          label: "Beyin" },
  { key: "Atom",           label: "Atom" },
  // İş & Proje
  { key: "Briefcase",      label: "Çanta" },
  { key: "Clipboard",      label: "Pano" },
  { key: "ClipboardList",  label: "Liste Pano" },
  { key: "ClipboardCheck", label: "Onay Pano" },
  { key: "FileText",       label: "Belge" },
  { key: "File",           label: "Dosya" },
  { key: "FilePlus",       label: "Dosya Ekle" },
  { key: "Folder",         label: "Klasör" },
  { key: "FolderOpen",     label: "Açık Klasör" },
  { key: "Archive",        label: "Arşiv" },
  { key: "Package",        label: "Paket" },
  { key: "Tag",            label: "Etiket" },
  { key: "Tags",           label: "Etiketler" },
  { key: "ListChecks",     label: "Kontrol Listesi" },
  { key: "CheckSquare",    label: "Onay Kutusu" },
  { key: "Kanban",         label: "Kanban" },
  // Zaman
  { key: "Clock",          label: "Saat" },
  { key: "Timer",          label: "Zamanlayıcı" },
  { key: "Calendar",       label: "Takvim" },
  { key: "CalendarDays",   label: "Takvim Günleri" },
  { key: "CalendarCheck",  label: "Takvim Onay" },
  { key: "AlarmClock",     label: "Alarm" },
  { key: "Hourglass",      label: "Kum Saati" },
  // İletişim
  { key: "MessageSquare",  label: "Mesaj" },
  { key: "MessageCircle",  label: "Mesaj Balonu" },
  { key: "Mail",           label: "E-posta" },
  { key: "Send",           label: "Gönder" },
  { key: "Share2",         label: "Paylaş" },
  { key: "Link",           label: "Bağlantı" },
  { key: "Bell",           label: "Zil" },
  { key: "BellRing",       label: "Zil Çalıyor" },
  // Kişiler
  { key: "User",           label: "Kullanıcı" },
  { key: "Users",          label: "Kullanıcılar" },
  { key: "UserCheck",      label: "Onaylı Kullanıcı" },
  { key: "UserPlus",       label: "Kullanıcı Ekle" },
  // Teknoloji
  { key: "Monitor",        label: "Ekran" },
  { key: "Smartphone",     label: "Telefon" },
  { key: "Tablet",         label: "Tablet" },
  { key: "Laptop",         label: "Laptop" },
  { key: "Code",           label: "Kod" },
  { key: "Code2",          label: "Kod 2" },
  { key: "Terminal",       label: "Terminal" },
  { key: "Cpu",            label: "İşlemci" },
  { key: "Database",       label: "Veritabanı" },
  { key: "Globe",          label: "Dünya" },
  { key: "Wifi",           label: "WiFi" },
  { key: "Server",         label: "Sunucu" },
  { key: "HardDrive",      label: "Disk" },
  { key: "Bot",            label: "Robot" },
  // Araçlar
  { key: "Settings",       label: "Ayarlar" },
  { key: "Settings2",      label: "Ayarlar 2" },
  { key: "Wrench",         label: "Anahtar" },
  { key: "Hammer",         label: "Çekiç" },
  { key: "Zap",            label: "Enerji" },
  { key: "Flame",          label: "Alev" },
  { key: "Rocket",         label: "Roket" },
  { key: "Target",         label: "Hedef" },
  { key: "Flag",           label: "Bayrak" },
  { key: "Map",            label: "Harita" },
  { key: "MapPin",         label: "Konum" },
  { key: "Navigation",     label: "Navigasyon" },
  { key: "Compass",        label: "Pusula" },
  // Doğa
  { key: "Leaf",           label: "Yaprak" },
  { key: "Flower2",        label: "Çiçek" },
  { key: "Sun",            label: "Güneş" },
  { key: "Moon",           label: "Ay" },
  { key: "Cloud",          label: "Bulut" },
  { key: "Snowflake",      label: "Kar" },
  { key: "Wind",           label: "Rüzgar" },
  { key: "Droplets",       label: "Su Damlası" },
  { key: "Mountain",       label: "Dağ" },
  { key: "Waves",          label: "Dalgalar" },
  // Yaşam & Eğlence
  { key: "Heart",          label: "Kalp" },
  { key: "Music",          label: "Müzik" },
  { key: "Headphones",     label: "Kulaklık" },
  { key: "Coffee",         label: "Kahve" },
  { key: "Home",           label: "Ev" },
  { key: "Gamepad2",       label: "Oyun Kolu" },
  { key: "Dices",          label: "Zarlar" },
  { key: "Bike",           label: "Bisiklet" },
  { key: "Plane",          label: "Uçak" },
  { key: "Car",            label: "Araba" },
  // Güvenlik
  { key: "Shield",         label: "Kalkan" },
  { key: "Lock",           label: "Kilit" },
  { key: "Key",            label: "Anahtar" },
  { key: "Eye",            label: "Göz" },
  // Şekiller
  { key: "Circle",         label: "Daire" },
  { key: "Square",         label: "Kare" },
  { key: "Triangle",       label: "Üçgen" },
  { key: "Diamond",        label: "Elmas" },
  { key: "Hexagon",        label: "Altıgen" },
  { key: "Pentagon",       label: "Beşgen" },
  { key: "Octagon",        label: "Sekizgen" },
  // Finans
  { key: "DollarSign",     label: "Dolar" },
  { key: "TrendingUp",     label: "Yükseliş" },
  { key: "BarChart2",      label: "Grafik" },
  { key: "PieChart",       label: "Pasta Grafik" },
  { key: "LineChart",      label: "Çizgi Grafik" },
  // Medya
  { key: "Play",           label: "Oynat" },
  { key: "Video",          label: "Video" },
  { key: "Film",           label: "Film" },
  { key: "Mic",            label: "Mikrofon" },
  { key: "Radio",          label: "Radyo" },
  { key: "Volume2",        label: "Ses" },
  // Diğer
  { key: "Grid3X3",        label: "Izgara" },
  { key: "List",           label: "Liste" },
  { key: "Filter",         label: "Filtre" },
  { key: "Sliders",        label: "Kaydırıcılar" },
  { key: "RefreshCw",      label: "Yenile" },
  { key: "Download",       label: "İndir" },
  { key: "Upload",         label: "Yükle" },
  { key: "Infinity",       label: "Sonsuzluk" },
  { key: "Anchor",         label: "Çıpa" },
  { key: "Activity",       label: "Aktivite" },
];

// Kurulu Lucide versiyonunda gerçekten var olanları filtrele
// forwardRef ikonlar "object" tipinde gelir, "function" değil — ikisini de kabul et
const ICON_LIST = RAW_ICON_LIST.filter(({ key }) => {
  const c = (LucideIcons as any)[key];
  return c != null && (typeof c === "function" || typeof c === "object");
});

interface IconPickerProps {
  value: string;
  onChange: (key: string) => void;
  type: TaskType;
}

export default function IconPicker({ value, onChange, type }: IconPickerProps) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const triggerRef            = useRef<HTMLButtonElement>(null);
  const dropdownRef           = useRef<HTMLDivElement>(null);
  const searchRef             = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Konumu trigger butonun gerçek viewport rect'inden hesapla
  // Portal kullandığımız için transform'lu ancestor'lardan etkilenmez
  const calcPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropH = 260;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= dropH) {
      return { top: rect.bottom + 6, left: rect.left, width: rect.width };
    } else {
      return { bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width };
    }
  };

  const handleOpen = () => {
    const pos = calcPosition();
    if (pos) setDropdownStyle(pos);
    setOpen(true);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  // Dışarı tıklama → kapat
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return ICON_LIST;
    return ICON_LIST.filter(
      ({ key, label }) =>
        label.toLowerCase().includes(q) || key.toLowerCase().includes(q)
    );
  }, [search]);

  // Seçili ikonun label'ı
  const currentLabel = ICON_LIST.find(i => i.key === value)?.label ?? value;

  const renderIcon = (key: string, size: number) => {
    const Comp = (LucideIcons as any)[key] as React.ComponentType<{ size?: number }>;
    if (!Comp) return null;
    return <Comp size={size} />;
  };

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`w-full h-14 px-4 rounded-xl border text-[14px] font-medium flex items-center gap-3 transition-all cursor-pointer ${
          open
            ? "border-base-primary-500 bg-white shadow-sm"
            : "border-surface-200 bg-surface-50 hover:border-surface-300"
        }`}
      >
        <div className={`w-8 h-8 rounded-lg ${TYPE_GRADIENT[type]} flex items-center justify-center text-white shrink-0`}>
          {renderIcon(value, 16)}
        </div>
        <span className="flex-1 text-left text-text-primary truncate">{currentLabel}</span>
        <ChevronDown size={16} className={`text-surface-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown — createPortal ile document.body'ye render edilir.
          Bu sayede modal'ın transform/overflow'undan tamamen bağımsızdır. */}
      {mounted && open && createPortal(
        <div
          ref={dropdownRef}
          style={{ ...dropdownStyle, position: "fixed" }}
          className="z-9999 bg-white rounded-2xl border border-surface-100 shadow-[0_8px_40px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col"
        >
          {/* Search */}
          <div className="px-3 pt-3 pb-2 border-b border-surface-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="İkon ara..."
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-surface-50 border border-surface-200 text-[13px] text-text-primary placeholder:text-text-placeholder outline-none focus:border-base-primary-500 focus:bg-white transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-300 hover:text-surface-500 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <p className="text-[11px] text-surface-400 mt-1.5 ml-0.5">{filtered.length} ikon</p>
          </div>

          {/* Icon Grid */}
          <div className="overflow-y-auto p-2.5" style={{ maxHeight: 200 }}>
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-surface-400">Sonuç bulunamadı</div>
            ) : (
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
                {filtered.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => { onChange(key); setOpen(false); }}
                    className={`w-full aspect-square flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                      value === key
                        ? `${TYPE_GRADIENT[type]} text-white border-transparent shadow-md`
                        : "bg-surface-50 text-surface-500 border-surface-100 hover:border-surface-300 hover:text-surface-800 hover:bg-white"
                    }`}
                  >
                    {renderIcon(key, 15)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
