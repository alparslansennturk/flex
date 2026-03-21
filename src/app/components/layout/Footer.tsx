"use client";

export default function Footer({ setActiveTab }: any) {
  const socialIcons = [
    { name: 'linkedin', src: '/icons/linkedin.svg' },
    { name: 'facebook', src: '/icons/facebook.svg' },
    { name: 'x', src: '/icons/x.svg' },
    { name: 'instagram', src: '/icons/instagram.svg' }
  ];

  return (
    /* mt-auto: İçerik az olduğunda Footer'ı sayfanın en altına iter. 
       Zaten lacivert zemin ve beyaz border-t ile Tasarım Atölyesi kimliğinde. */
    <footer className="w-full bg-[#10294C] border-t border-white/5 mt-auto font-inter">
      {/* İÇ HİZALAMA KUTUSU: Header ve Main ile milimetrik aynı hiza */}
      <div className="w-[94%] mx-auto py-6 min-h-[80px] flex items-center justify-between transition-all duration-500 max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[2000px]">
        
        {/* LOGO BÖLÜMÜ */}
        <div 
          className="flex items-center gap-1 select-none cursor-pointer" 
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="text-[20px] font-semibold text-[#FF8D28] tracking-tight">tasarım</span>
          <span className="text-[20px] font-bold text-white tracking-tight">atölyesi</span>
        </div>

        {/* SOSYAL MEDYA VE COPYRIGHT */}
        <div className="flex flex-col items-end justify-center">
          <div className="flex items-center gap-4 mb-3">
            {socialIcons.map((icon) => (
              <div 
                key={icon.name} 
                className="w-6 h-6 flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95"
              >
                <img src={icon.src} className="w-full h-full object-contain brightness-0 invert" alt={icon.name} />
              </div>
            ))}
          </div>
          <p className="text-[12px] font-normal text-white/80 tracking-wide">
            Copyright @ Alparslan Şentürk 2026. Tüm Hakları Saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}