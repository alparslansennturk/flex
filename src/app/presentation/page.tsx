"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ==========================================
// ORTAK PREMIUM BİLEŞENLER
// ==========================================

const GridCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`border-2 border-white/[0.08] bg-slate-900/50 backdrop-blur-3xl rounded-[32px] p-10 shadow-2xl relative overflow-hidden group hover:border-white/[0.18] transition-colors duration-300 ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    {children}
  </div>
);

// ==========================================
// SLAYTLAR (SCENES)
// ==========================================

// Slayt 1: Kapak
const CoverScene = () => (
  <div className="w-full flex flex-col items-center justify-center text-center min-h-[50vh]">
    <div className="relative flex flex-col items-center">
      <div className="absolute inset-[-40px] opacity-25 pointer-events-none grid grid-cols-2 grid-rows-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <motion.div 
            key={i} 
            initial={{ scale: 0.6, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ delay: i * 0.1, duration: 1, ease: "easeOut" }} 
            className="border-2 border-emerald-500/20 rounded-2xl"
          />
        ))}
      </div>
      <motion.img 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.9, ease: "easeOut" }}
        src="/assets/flex-logo-white.svg" 
        className="w-[350px] md:w-[440px] h-auto relative z-10 filter drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]" 
        alt="Flex Logo" 
      />
      <motion.p 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.5, duration: 0.8 }} 
        className="text-2xl md:text-3xl text-emerald-400 font-medium tracking-wide mt-12 max-w-4xl"
      >
        Eğitim Operasyon Platformu
      </motion.p>
    </div>
  </div>
);

// Slayt 2: Karmaşıklığın Büyümesi (Dil Daha da Sadeleştirildi)
const GrowthScene = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center justify-center mx-auto max-w-6xl">
    <div className="lg:col-span-6 space-y-8 text-center lg:text-left">
      <div className="text-base md:text-lg font-mono text-purple-400 font-medium border-l-4 border-purple-500 pl-4 inline-block lg:block">Ölçek etkisi</div>
      <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">Eğitim büyür.<br />Süreçler büyür.<br /><span className="text-purple-400">Karmaşıklık katlanarak büyür.</span></h2>
    </div>
    <div className="lg:col-span-6 relative h-[450px] w-full flex items-center justify-center mx-auto">
      <div className="absolute inset-0 border-2 border-dashed border-white/5 rounded-[40px] bg-slate-950/20 overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ repeat: Infinity, duration: 4 + i * 2, ease: "easeInOut" }}
            className="absolute inset-0 border border-purple-500/10 rounded-[40px]"
            style={{ margin: `${(i + 1) * 40}px` }}
          />
        ))}
      </div>
      <motion.div
        animate={{ y: [0, -12, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="text-2xl font-mono text-slate-500 z-10"
      >
        Katlanarak Genişleyen Yapı
      </motion.div>
    </div>
  </div>
);

// Slayt 3: Doğal Karmaşıklık
const ComplexityScene = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center justify-center mx-auto max-w-6xl">
    <div className="lg:col-span-5 space-y-8 text-center lg:text-left">
      <div className="text-base md:text-lg font-mono text-red-400 font-medium border-l-4 border-red-500 pl-4 inline-block lg:block">Operasyonel riskler</div>
      <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">Bilgi dağılır.<br />Zaman kaybolur.<br />Kontrol zorlaşır.</h2>
    </div>
    <div className="lg:col-span-7 relative h-[500px] w-full border-2 border-dashed border-white/5 rounded-[40px] flex items-center justify-center overflow-hidden bg-slate-950/20 mx-auto">
      <motion.div animate={{ y: [0, -15, 0], x: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 6 }} className="absolute top-16 left-16 p-6 bg-red-500/10 border-2 border-red-500/20 rounded-2xl text-base md:text-lg font-medium text-red-400 shadow-2xl">⏳ Kopuk Veri Kümeleri</motion.div>
      <motion.div animate={{ y: [0, 20, 0], x: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 7, delay: 0.5 }} className="absolute bottom-20 left-20 p-6 bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl text-base md:text-lg font-medium text-amber-400 shadow-2xl">🔄 Görünmeyen Kayıplar</motion.div>
      <motion.div animate={{ y: [0, -10, 0], x: [0, -25, 0] }} transition={{ repeat: Infinity, duration: 5, delay: 1 }} className="absolute top-36 right-16 p-6 bg-orange-500/10 border-2 border-orange-500/20 rounded-2xl text-base md:text-lg font-medium text-orange-400 shadow-2xl">📉 Yaşlanan Monolit Yapı</motion.div>
      <div className="text-4xl font-black tracking-widest text-white/[0.01] select-none">Doğal Dağınıklık</div>
    </div>
  </div>
);

// Slayt 4: Büyük Soru
const BigQuestionScene = () => (
  <div className="w-full flex flex-col items-center justify-center text-center space-y-12 max-w-5xl mx-auto">
    <div className="text-base md:text-lg font-mono text-emerald-400 font-medium border-b-2 border-emerald-500 pb-2 px-4 inline-block">Yeni bir yaklaşım</div>
    <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-relaxed max-w-4xl mx-auto px-4">
      Peki tüm eğitim süreçleri <br />
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 leading-normal">tek bir ekosistemde buluşsaydı?</span>
    </h2>
    <div className="flex flex-wrap justify-center gap-4 pt-6 max-w-4xl mx-auto">
      {["Öğrenciler", "Eğitmenler", "Gruplar", "Sertifikalar", "Operasyonlar"].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1, y: [0, i % 2 === 0 ? 7 : -7, 0] }}
          transition={{
            opacity: { delay: i * 0.1, duration: 0.4 },
            scale:   { delay: i * 0.1, duration: 0.4 },
            y: { delay: 0.4 + i * 0.15, repeat: Infinity, duration: 3 + i * 0.35, ease: "easeInOut" },
          }}
          className="px-8 py-4 border-2 border-white/10 bg-slate-900/40 rounded-2xl text-xl font-medium text-slate-300 shadow-lg"
        >
          {item}
        </motion.div>
      ))}
    </div>
  </div>
);

// Slayt 5: Flex Nedir?
const FlexDefinitionScene = () => {
  const modules = [
    { name: "İnsanlar",    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.07]" },
    { name: "Süreçler",    color: "text-blue-400    border-blue-500/30    bg-blue-500/[0.07]"    },
    { name: "Bilgi",       color: "text-purple-400  border-purple-500/30  bg-purple-500/[0.07]"  },
    { name: "İletişim",   color: "text-orange-400  border-orange-500/30  bg-orange-500/[0.07]"  },
    { name: "Operasyon",   color: "text-teal-400    border-teal-500/30    bg-teal-500/[0.07]"    },
    { name: "Sertifikalar",color: "text-amber-400   border-amber-500/30   bg-amber-500/[0.07]"   },
  ];
  const radius = 190;
  return (
    <div className="w-full text-center space-y-8 max-w-5xl mx-auto">
      <div className="space-y-3">
        <div className="text-base font-mono text-emerald-400 font-medium">Bütünleşik yapı</div>
        <h2 className="text-2xl md:text-3xl font-light text-slate-300 leading-relaxed max-w-3xl mx-auto">
          Flex; insanları, süreçleri ve bilgiyi tek ekosistemde birleştiren{" "}
          <span className="text-white font-bold border-b-2 border-emerald-400 pb-0.5 leading-loose">modüler bir eğitim operasyon platformudur.</span>
        </h2>
      </div>
      {/* Küçük ekranda ölçeklenir, büyük ekranda tam boyut */}
      <div className="relative h-[440px] w-full flex items-center justify-center scale-[0.6] xs:scale-[0.7] sm:scale-[0.85] md:scale-100 origin-center">
        {/* Dönen dış halka */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
          className="absolute w-[400px] h-[400px] rounded-full border border-dashed border-white/[0.07]"
        />
        {/* Sabit iç halka */}
        <div className="absolute w-[400px] h-[400px] rounded-full border border-white/[0.04]" />
        {/* Merkez */}
        <div className="w-36 h-36 rounded-[28px] bg-[#030712] z-20 flex items-center justify-center shadow-[0_0_70px_rgba(16,185,129,0.45)] border-2 border-emerald-500/50">
          <img src="/assets/flex-logo-white.svg" className="w-20 h-auto" alt="Flex" />
        </div>
        {/* Modüller — dış div pozisyonu tutar, iç motion.div float animasyonu yapar */}
        {modules.map((mod, i) => {
          const angle = (360 / modules.length) * i - 90;
          const rad = (angle * Math.PI) / 180;
          const x = Math.round(Math.cos(rad) * radius);
          const y = Math.round(Math.sin(rad) * radius);
          const floatDir = i % 2 === 0 ? 7 : -7;
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: "50%", top: "50%", transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.6, y: 0 }}
                animate={{ opacity: 1, scale: 1, y: [0, floatDir, 0] }}
                transition={{
                  opacity: { delay: 0.15 + i * 0.1, duration: 0.5, ease: "easeOut" },
                  scale:   { delay: 0.15 + i * 0.1, duration: 0.5, ease: "easeOut" },
                  y: { delay: 0.6 + i * 0.15, repeat: Infinity, duration: 3 + i * 0.4, ease: "easeInOut" },
                }}
                className={`px-5 py-2.5 border-2 rounded-xl font-semibold text-sm md:text-base shadow-lg whitespace-nowrap ${mod.color}`}
              >
                {mod.name}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Slayt 6: Eğitmen Deneyimi
const InstructorExperienceScene = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center justify-center mx-auto max-w-6xl">
    <div className="lg:col-span-5 space-y-8 text-center lg:text-left">
      <div className="text-base md:text-lg font-mono text-emerald-400 font-medium border-l-4 border-emerald-500 pl-4 inline-block lg:block">Saha verimliliği</div>
      <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">Daha az tıklama.<br />Daha verimli çalışma.</h2>
      <p className="text-xl md:text-2xl text-slate-400 font-light leading-relaxed">Eğitmenler arayüz hantallığıyla boğuşmaz. Yoklama, öğrenci takibi ve değerlendirme tek bir akıcı merkezden yönetilir.</p>
    </div>
    <div className="lg:col-span-7 grid grid-cols-2 gap-6 mx-auto w-full">
      {["Yoklama", "Öğrenci Takibi", "Değerlendirme", "Eğitim Süreçleri"].map((item, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, i % 2 === 0 ? 7 : -7, 0] }}
          transition={{ repeat: Infinity, duration: 3.5 + i * 0.4, ease: "easeInOut", delay: i * 0.25 }}
        >
          <GridCard>
            <div className="text-sm text-slate-500 font-mono mb-4">Süreç Modülü // 0{i+1}</div>
            <div className="text-2xl md:text-3xl font-bold text-white leading-normal">{item}</div>
          </GridCard>
        </motion.div>
      ))}
    </div>
  </div>
);

// Slayt 7: Öğrenci Merkezli Yapı
const StudentCentricScene = () => (
  <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-16 mx-auto max-w-6xl">
    <div className="flex-1 space-y-8 text-center lg:text-left">
      <div className="text-base md:text-lg font-mono text-teal-400 font-medium border-l-4 border-teal-500 pl-4 inline-block lg:block">Yapısal mimari</div>
      <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">Merkezde grup değil,<br />öğrenci var.</h2>
      <p className="text-xl md:text-2xl text-slate-400 font-light leading-relaxed">Öğrenci birden fazla eğitim alabilir, yıllar sonra tekrar dönebilir. Tüm kurumsal geçmişi tek bir kartta kalıcı olarak korunur.</p>
    </div>
    <div className="flex-1 relative w-full h-[500px] flex items-center justify-center bg-slate-950/10 rounded-[40px] border border-white/5 mx-auto">
      <div className="w-80 p-10 border-2 border-emerald-500/20 bg-slate-900 rounded-[36px] text-center z-20 shadow-[0_0_50px_rgba(0,0,0,0.6)]">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full mx-auto mb-6 flex items-center justify-center text-emerald-400 font-bold text-xl">ID</div>
        <div className="font-bold text-white text-3xl">Öğrenci kartı</div>
      </div>
      {[
        { name: "Çoklu Eğitim Desteği", x: -240, y: -130, color: "text-blue-400 border-blue-500/20 bg-blue-500/5" },
        { name: "Kesintisiz Geçmiş Takibi", x: 240, y: -130, color: "text-orange-400 border-orange-500/20 bg-orange-500/5" },
        { name: "Yıllar Boyu Portfolyo", x: -240, y: 130, color: "text-purple-400 border-purple-500/20 bg-purple-500/5" },
        { name: "Akademik Gelişim Eğrisi", x: 240, y: 130, color: "text-teal-400 border-teal-500/20 bg-teal-500/5" },
      ].map((edu, i) => (
        <motion.div
          key={i}
          initial={{ y: edu.y }}
          animate={{ y: [edu.y, edu.y + (i % 2 === 0 ? 6 : -6), edu.y] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: i * 0.4 }}
          className={`absolute px-6 py-4 border-2 rounded-2xl font-bold text-base md:text-lg shadow-xl backdrop-blur-sm whitespace-nowrap leading-normal ${edu.color}`}
          style={{ x: edu.x }}
        >
          {edu.name}
        </motion.div>
      ))}
    </div>
  </div>
);

// Slayt 8: Hızlı Erişim
const QuickSearchScene = () => (
  <div className="w-full flex flex-col items-center justify-center space-y-12 max-w-4xl mx-auto">
    <div className="text-center space-y-4">
      <div className="text-base md:text-lg font-mono text-emerald-400 font-medium inline-block">Kahraman özellik</div>
      <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">Hızlı Arama ile ışık hızında erişim</h2>
    </div>
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="w-full bg-slate-900/90 border-2 border-white/10 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-3xl mx-auto">
      <div className="p-8 flex items-center gap-6 border-b-2 border-white/5 text-2xl md:text-3xl text-slate-400 leading-normal">
        <span className="bg-white/10 px-4 py-2 rounded-xl text-base text-white font-black shadow-xl">⌘ K</span>
        <motion.span initial={{ width: 0 }} animate={{ width: "auto" }} transition={{ duration: 1, delay: 0.8 }} className="overflow-hidden whitespace-nowrap inline-block text-white border-r-4 border-emerald-400 pr-2 font-medium">Ara. Bul. Aç.</motion.span>
      </div>
      <div className="p-8 bg-slate-950/40 space-y-4 text-left">
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="p-6 bg-white/[0.03] border-2 border-white/5 rounded-2xl flex justify-between items-center shadow-xl"
        >
          <div>
            <div className="font-bold text-emerald-400 text-xl md:text-2xl leading-normal">Aranan Bilgi</div>
            <div className="text-base text-slate-400 mt-2 leading-relaxed">Saniyeler içinde verilere tam erişim.</div>
          </div>
          <span className="text-sm bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 font-bold">Işık Hızı</span>
        </motion.div>
      </div>
    </motion.div>
  </div>
);

// Slayt 9: Oyunlaştırma
const GamificationScene = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center justify-center mx-auto max-w-6xl">
    <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
      <div className="text-base md:text-lg font-mono text-purple-400 font-medium border-l-4 border-purple-500 pl-4 inline-block lg:block">Görünür süreçler</div>
      <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">Katılım, başarı ve süreklilik</h2>
      <p className="text-xl md:text-2xl text-slate-400 font-light leading-relaxed">Öğrenme ve katılım metriklerini oyunlaştırma dinamikleriyle birleştirerek motivasyonu en üst düzeyde canlı tutuyoruz.</p>
    </div>
    <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6 w-full mx-auto">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
        className="col-span-1 md:col-span-2"
      >
        <GridCard>
          <div className="flex justify-between items-center mb-6 border-b-2 border-white/5 pb-4 text-base md:text-lg text-slate-400 font-medium">
            <span>Akademik Lig Sistemleri</span>
            <span className="text-emerald-400 font-bold">Performans</span>
          </div>
          <div className="space-y-4 text-lg md:text-xl leading-relaxed">
            <div className="flex justify-between py-3 bg-white/[0.02] px-6 rounded-xl"><span className="text-slate-200">Grup Sıralamaları ve Rekabet</span><span className="text-emerald-400 font-black">Live</span></div>
            <div className="flex justify-between py-3 px-6"><span className="text-slate-400">Gelişim Puanları (XP)</span><span className="text-slate-300 font-bold">Aktif</span></div>
          </div>
        </GridCard>
      </motion.div>
      <motion.div animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: 0.3 }}>
        <GridCard><div className="text-sm font-mono text-slate-500 mb-3">Süreklilik Metrikleri</div><div className="text-2xl font-bold text-white leading-normal">Devam Serileri</div></GridCard>
      </motion.div>
      <motion.div animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.6 }}>
        <GridCard><div className="text-sm font-mono text-slate-500 mb-3">Başarı Kriterleri</div><div className="text-2xl font-bold text-purple-400 leading-normal">Dijital Rozetler</div></GridCard>
      </motion.div>
    </div>
  </div>
);

// Slayt 10: Büyüyen Platform
const GrowingPlatformScene = () => (
  <div className="w-full text-center space-y-16 max-w-6xl mx-auto">
    <div className="space-y-6">
      <div className="text-base md:text-lg font-mono text-purple-400 font-medium inline-block">Platform ekosistemi</div>
      <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight">Zamanla genişleyen modüler mimari</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mx-auto text-left">
      {[
        { title: "Operasyon", desc: "Temel planlama ve ders dağıtım algoritmaları." },
        { title: "Satış", desc: "Öğrenci dönüşüm hunileri ve paket yönetimi." },
        { title: "Finans", desc: "Esnek sözleşmeler ve muhasebe entegrasyonu." },
        { title: "Sertifikalar", desc: "Otomatik sertifikasyon ve entegre kanallar." }
      ].map((mod, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, i % 2 === 0 ? -8 : 8, 0] }}
          transition={{ repeat: Infinity, duration: 3.5 + i * 0.5, ease: "easeInOut", delay: i * 0.2 }}
          className="border-2 border-purple-500/10 bg-purple-500/[0.02] p-10 rounded-[32px] flex flex-col justify-between shadow-2xl relative overflow-hidden group min-h-[250px]"
        >
          <div className="absolute top-0 right-0 p-4 font-mono text-xs bg-purple-500/10 text-purple-400 rounded-bl-2xl border-l-2 border-b-2 border-purple-500/10 font-bold">Modül</div>
          <h3 className="text-2xl md:text-3xl font-black text-white mb-4 tracking-tight leading-normal">{mod.title}</h3>
          <p className="text-base text-slate-400 font-light leading-relaxed">{mod.desc}</p>
        </motion.div>
      ))}
    </div>
  </div>
);

// Slayt 11: Bugün
const CurrentStatusScene = () => (
  <div className="w-full text-center space-y-16 max-w-6xl mx-auto">
    <div className="space-y-6">
      <div className="text-base md:text-lg font-mono text-emerald-400 font-medium inline-block">Üretim aşaması</div>
      <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight">Çalışan ürün. Ölçeklenebilir temel.</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full mx-auto text-left">
      {["Çalışan Ürün Çekirdeği", "Gerçek Zamanlı Altyapı", "Gelişmiş Yetkilendirme", "Öğrenci Yönetimi Mimarisi", "Yeni Nesil Yoklama Altyapısı", "Anlık Bildirim Altyapısı"].map((item, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, i % 2 === 0 ? -6 : 6, 0] }}
          transition={{ repeat: Infinity, duration: 3.5 + i * 0.3, ease: "easeInOut", delay: i * 0.15 }}
        >
          <GridCard>
            <div className="flex items-center gap-5 py-4">
              <span className="w-9 h-9 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-black">✓</span>
              <span className="font-bold text-slate-100 text-xl md:text-2xl tracking-wide leading-normal">{item}</span>
            </div>
          </GridCard>
        </motion.div>
      ))}
    </div>
  </div>
);

// Slayt 12: Vizyon (Kapanış)
const VisionScene = () => (
  <div className="text-center flex flex-col items-center justify-center relative w-full min-h-[60vh] max-w-6xl mx-auto">
    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
    <motion.h1 initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} className="text-4xl md:text-7xl font-light tracking-tight max-w-5xl leading-[1.3] text-slate-200 relative z-10 px-4">
      "Eğitim kurumlarının <br />
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 font-black filter drop-shadow-[0_0_30px_rgba(16,185,129,0.2)] leading-normal">dijital işletim sistemi.</span>"
    </motion.h1>
    <motion.div 
      initial={{ opacity: 0, y: 30 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
      className="mt-20 flex flex-col items-center space-y-8 relative z-10"
    >
      <motion.img 
        animate={{ scale: [0.97, 1.03, 0.97] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        src="/assets/flex-logo-white.svg" 
        className="w-48 md:w-64 h-auto filter drop-shadow-[0_0_50px_rgba(255,255,255,0.1)]" 
        alt="Flex Logo" 
      />
      <span className="text-sm md:text-base font-mono tracking-widest text-slate-500 font-bold">
        FLEX // 2026
      </span>
    </motion.div>
  </div>
);

// ==========================================
// ANA SUNUM MOTORU (MAIN ENGINE)
// ==========================================

const SCENES = [
  "cover", "growth", "complexity", "big-question", "definition", 
  "instructor", "student", "search", "gamification", "growing-platform", "current", "vision"
];

export default function PresentationPage() {
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Başa dönme ve döngüsel (loop) geçiş mekanizması kuruldu
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % SCENES.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + SCENES.length) % SCENES.length);
    };
    window.addEventListener("keydown", handleKeyDown);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Tam ekran moduna geçilemedi: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <main className="h-screen w-full bg-[#030712] text-slate-100 overflow-hidden relative font-sans select-none flex items-center justify-center">
      {/* Global Mühendislik Grid Dokusu */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none" 
        style={{ 
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: '120px 120px' 
        }} 
      />
      
      {/* Neon Glow Işık Sızıntıları */}
      <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-emerald-500/[0.06] blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[1000px] h-[1000px] bg-purple-500/[0.06] blur-[200px] rounded-full pointer-events-none" />

      {/* İlerleme Çubuğu */}
      <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-purple-500 transition-all duration-500 z-50" style={{ width: `${((index + 1) / SCENES.length) * 100}%` }} />

      {/* Tam Ekran Kontrol Butonu */}
      <button 
        onClick={toggleFullscreen}
        className="absolute top-6 right-8 z-50 border border-white/[0.08] bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white transition-all duration-300 rounded-xl px-5 py-2.5 text-sm font-medium tracking-wide flex items-center gap-2 backdrop-blur-md shadow-xl"
      >
        {isFullscreen ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6m0 0v6m0-6L9 15" />
            </svg>
            Pencere Modu
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
            </svg>
            Tam Ekran yap
          </>
        )}
      </button>

      {/* Ana Sahne Yapısı */}
      <div className="w-full max-w-7xl px-8 md:px-16 z-10 flex items-center justify-center min-h-[85vh] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={SCENES[index]}
            initial={{ opacity: 0, scale: 0.97, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.03, y: -15 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex items-center justify-center mx-auto"
          >
            {index === 0 && <CoverScene />}
            {index === 1 && <GrowthScene />}
            {index === 2 && <ComplexityScene />}
            {index === 3 && <BigQuestionScene />}
            {index === 4 && <FlexDefinitionScene />}
            {index === 5 && <InstructorExperienceScene />}
            {index === 6 && <StudentCentricScene />}
            {index === 7 && <QuickSearchScene />}
            {index === 8 && <GamificationScene />}
            {index === 9 && <GrowingPlatformScene />}
            {index === 10 && <CurrentStatusScene />}
            {index === 11 && <VisionScene />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}