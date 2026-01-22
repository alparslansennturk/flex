import { Route, Palette, Briefcase, BookOpen, Clock, ChevronRight } from "lucide-react";

function ParkourCard({ title, desc, tag, iconGradient, icon, disabled = false, tagStyles, status, duration }: any) {
  return (
    <div className="bg-white p-7 rounded-[32px] border border-[#E2E5EA] flex flex-col justify-between transition-all duration-300 hover:shadow-[15px_30px_60px_-15px_rgba(16,41,76,0.08)] hover:-translate-y-1 h-full cursor-default group">
      <div className="flex justify-between items-start mb-5">
        <div className={`w-12 h-12 ${iconGradient} rounded-[14px] flex items-center justify-center text-white shadow-lg shrink-0`}>{icon}</div>
        <span className={`px-4 py-1.5 rounded-full text-[11px] font-bold ${tagStyles}`}>{tag}</span>
      </div>
      <div className="mb-5">
        <h4 className="text-[20px] text-[#10294C] font-bold mb-1.5 leading-tight">{title}</h4>
        <p className="text-[13px] text-[#8E95A3] leading-relaxed line-clamp-2">{desc}</p>
      </div>
      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-6 border border-[#EEF0F3]">
        <div className="flex flex-col">
          <span className="text-[11px] text-[#8E95A3]">Durum</span>
          <span className={`text-[13px] font-bold mt-0.5 ${status === 'Aktif' ? 'text-[#009F3E]' : 'text-[#AEB4C0]'}`}>{status}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] text-[#8E95A3]">Teslim süresi</span>
          <div className="flex items-center gap-1.5 mt-0.5 text-[#10294C]">
            <Clock size={12} />
            <span className="text-[13px] font-bold">{duration}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-5">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button disabled={disabled} className={`px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 cursor-pointer ${disabled ? 'bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed' : 'bg-[#6F74D8] text-white hover:bg-[#5E63C2]'}`}>
          Ödev ver <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function DesignParkour() {
  return (
    <section className="mt-[48px] space-y-[24px]">
      <div className="flex items-center gap-3 text-[#10294C] px-2"><Route size={22} className="text-[#FF8D28]" /><h3 className="text-[22px] font-bold cursor-default">Tasarım parkuru</h3></div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <ParkourCard title="Kolaj Bahçesi" desc="Sürrealist kompozisyon teknikleri." tag="Ödev" iconGradient="bg-gradient-to-b from-pink-500 to-[#B80E57]" icon={<Palette size={22} />} tagStyles="bg-pink-100 text-pink-700" status="Aktif" duration="Son 2 Gün" />
        <ParkourCard title="Marka Kimliği" desc="Kurumsal kimlik ve logo sistemi." tag="Proje" iconGradient="bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]" icon={<Briefcase size={22} />} tagStyles="bg-cyan-100 text-cyan-700" status="Aktif" duration="Son 5 Gün" />
        <ParkourCard title="Kitap Dünyası" desc="Kitap kapağı ve tasarımı" tag="Ödev" iconGradient="bg-gradient-to-b from-[#FF8D28] to-[#D35400]" disabled icon={<BookOpen size={22} />} tagStyles="bg-orange-100 text-[#FF8D28]" status="Pasif" duration="Süre doldu" />
      </div>
    </section>
  );
}