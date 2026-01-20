export default function Footer({ setActiveTab }: any) {
  const socialIcons = [
    { name: 'linkedin', src: '/icons/linkedin.svg' },
    { name: 'facebook', src: '/icons/facebook.svg' },
    { name: 'x', src: '/icons/x.svg' },
    { name: 'instagram', src: '/icons/instagram.svg' }
  ];

  return (
    <footer className="bg-[#10294C] px-[32px] py-[24px] flex items-center justify-between border-t border-white/5 mt-auto min-h-[74px]">
      <div className="flex items-center gap-1 select-none cursor-pointer" onClick={() => setActiveTab('dashboard')}>
        <span className="text-[20px] font-semibold text-[#FF8D28] tracking-tight">tasarım</span>
        <span className="text-[20px] font-bold text-white tracking-tight">atölyesi</span>
      </div>
      <div className="flex flex-col items-end justify-center">
        <div className="flex items-center gap-[16px] mb-[12px]">
          {socialIcons.map((icon) => (
            <div key={icon.name} className="w-[24px] h-[24px] flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95">
              <img src={icon.src} className="w-full h-full object-contain" alt={icon.name} />
            </div>
          ))}
        </div>
        <p className="text-[12px] font-normal text-white tracking-wide opacity-80">
          Copyright @ Alparslan Şentürk 2026. Tüm Hakları Saklıdır.
        </p>
      </div>
    </footer>
  );
}