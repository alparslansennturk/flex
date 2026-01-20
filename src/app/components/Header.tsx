import { Bell, ChevronDown, ChevronRight } from "lucide-react";

export default function Header({ config }: any) {
  return (
    <header className="h-20 bg-white border-b border-surface-200 px-6 md:px-10 flex items-center justify-between sticky top-0 z-40 w-full">
      <div className="truncate pr-4">
        <h1 className="text-[18px] text-[#10294C] truncate font-bold">Hoş geldin, Alparslan</h1>
        <p className="text-[12px] text-text-tertiary hidden sm:block">Bugün yeni bir perspektif keşfetmeye ne dersin?</p>
      </div>

      <div className="flex items-center shrink-0">
        <div className="relative text-text-secondary cursor-pointer hover:text-[#3A7BD5] mr-6 group">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF4D4D] text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">3</span>
        </div>

        <div className="flex items-center gap-4 border-l border-surface-200 pl-6">
          <div className="text-right hidden md:block">
            <p className="text-[14px] text-[#10294C] font-bold leading-none mb-1">Alparslan Şentürk</p>
            <p className="text-[11px] text-text-tertiary font-medium">Eğitmen | Arı Bilgi</p>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-[#FF8D28] p-0.5 shrink-0 cursor-pointer overflow-hidden bg-surface-50 transition-transform hover:scale-105">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alparslan" alt="Avatar" className="rounded-full w-full h-full object-cover" />
          </div>
        </div>

        {config.showBranchSelect && (
          <div className="flex items-center gap-1 ml-[32px] cursor-pointer group select-none">
            <span className="text-[13px] font-medium text-text-tertiary group-hover:text-text-primary transition-colors">Kadıköy Şb.</span>
            <ChevronDown size={14} className="text-text-tertiary group-hover:text-[#3A7BD5]" />
          </div>
        )}

        {config.isLinkedToFlex && (
          <div className="flex items-center gap-2 ml-[32px] cursor-pointer group select-none font-inter">
            <span className="text-[22px] font-semibold text-[#3A7BD5] tracking-tight">flex</span>
            <ChevronRight size={18} className="text-[#3A7BD5] group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>
    </header>
  );
}