import { LibraryBig, ChevronLeft, ChevronRight, Palette, PlusCircle } from "lucide-react";

function LibraryCard({ title, desc }: any) {
  return (
    <div className="min-w-[calc((100%-80px)/4.3)] snap-start bg-white p-6 rounded-[28px] border border-[#EEF0F3] flex flex-col justify-between h-[210px] transition-all duration-500 hover:shadow-[15px_40px_80px_-20px_rgba(16,41,76,0.08)] hover:-translate-y-2 cursor-pointer group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-[#F7F8FA] text-[#8E95A3] rounded-xl flex items-center justify-center shrink-0"><Palette size={20} /></div>
        <div className="truncate">
          <h5 className="text-[15px] font-bold text-[#10294C] mb-0.5 truncate">{title}</h5>
          <p className="text-[11px] text-[#8E95A3] line-clamp-2">{desc}</p>
        </div>
      </div>
      <div className="border-t border-[#EEF0F3] my-4"></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button className="px-4 py-1.5 bg-[#F7F8FA] text-[#10294C] rounded-xl text-[11px] font-bold flex items-center gap-2 hover:bg-[#10294C] hover:text-white transition-all cursor-pointer">Ekle <PlusCircle size={14} /></button>
      </div>
    </div>
  );
}

export default function AssignmentLibrary({ scrollRef, handleScroll }: any) {
  return (
    <section className="mt-[48px] mb-[64px] space-y-[24px]">
      <div className="flex items-center gap-3 text-[#8E95A3] px-2"><LibraryBig size={22} /><h3 className="text-[22px] font-bold text-[#8E95A3] cursor-default">Ödev kütüphanesi</h3></div>
      <div className="relative group overflow-visible">
        <button onClick={() => handleScroll('left')} className="absolute -left-5 top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronLeft size={24} /></button>
        <button onClick={() => handleScroll('right')} className="absolute -right-5 top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronRight size={24} /></button>
        <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x py-10 -my-10">
          <LibraryCard title="Ambalaj tasarımı" desc="Görsel kimlik üzerine" />
          <LibraryCard title="Logo challange" desc="Vektörel çizim" />
          <LibraryCard title="Posterini seç" desc="Film poster tasarımı" />
          <LibraryCard title="Broşür tasarla" desc="3 kırımlı broşür" />
          <LibraryCard title="Reklam bulucu" desc="Sosyal medya reklamları" />
        </div>
      </div>
    </section>
  );
}