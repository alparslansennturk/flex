import { Trophy, Repeat, ArrowBigUpDash, ArrowBigDownDash, ChevronRight } from "lucide-react";

function LeaderRow({ rank, name, status, statusType, xp, avatar, gender, viewMode }: any) {
  const avatarUrl = `https://api.dicebear.com/7.x/${gender === 'female' ? 'lorelei' : 'avataaars'}/svg?seed=${avatar}`;
  const displayStatus = viewMode === 'Tümü' ? "Kadıköy Şubesi" : status;

  return (
    <div className="flex items-center justify-between p-2 -mx-2 rounded-xl hover:bg-[#F7F8FA] transition-colors cursor-pointer group">
      <div className="flex items-center flex-1 min-w-0 mr-2">
        <span className={`text-[15px] font-bold w-8 shrink-0 ${rank === 1 ? 'text-[#FF8D28]' : 'text-[#AEB4C0]'}`}>{rank}</span>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full border border-[#E2E5EA] p-0.5 overflow-hidden bg-[#F7F8FA] shrink-0">
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-[clamp(14px,1vw,16px)] text-[#1E222B] font-bold whitespace-nowrap overflow-hidden leading-none mb-1">{name}</p>
            <p className={`text-[11px] font-semibold truncate ${rank === 1 ? 'text-[#FF8D28]' : 'text-[#8E95A3]'}`}>
              {displayStatus}
            </p>
          </div>
        </div>
        <div className="ml-4 w-8 flex justify-center items-center shrink-0">
             {statusType === 'stable' && <div className="w-4 h-0.5 bg-[#FF8D28] rounded-full" />}
             {statusType === 'rising' && <ArrowBigUpDash size={18} className="text-[#FF8D28]" />}
             {statusType === 'falling' && <ArrowBigDownDash size={18} className="text-[#AEB4C0] opacity-50" />}
        </div>
      </div>
      <span className="text-[14px] font-bold text-[#10294C] whitespace-nowrap shrink-0">
        {xp}<span className="text-[clamp(11px,0.7vw,13px)] text-[#8E95A3] font-bold uppercase ml-0">XP</span>
      </span>
    </div>
  );
}

export default function LeaderboardWidget({ viewMode, setViewMode }: any) {
  return (
    <div className="col-span-12 xl:col-span-4 bg-white rounded-[32px] p-6 border border-[#E2E5EA] flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-bold text-[#10294C] flex items-center gap-2"><Trophy size={16} className="text-[#FF8D28]" /> Sınıflar ligi</h3>
        <button onClick={() => setViewMode(viewMode === 'Sınıflarım' ? 'Şubem' : viewMode === 'Şubem' ? 'Tümü' : 'Sınıflarım')} className="flex items-center justify-center gap-2 text-[#3A7BD5] bg-[#F7F8FA] px-3 h-8 rounded-xl border border-[#EEF0F3] cursor-pointer active:scale-95 transition-all">
          <span className="text-[clamp(12px,0.8vw,14px)] font-bold whitespace-nowrap">{viewMode}</span>
          <Repeat size={12} />
        </button>
      </div>
      <div className="space-y-3 flex-1">
        <LeaderRow rank={1} name="Mert Demir" status="Zirvede" statusType="stable" xp="2.850" avatar="Mert" gender="male" viewMode={viewMode} />
        <LeaderRow rank={2} name="Selin Yılmaz" status="Yükselişte" statusType="rising" xp="2.720" avatar="Selin" gender="female" viewMode={viewMode} />
        <LeaderRow rank={3} name="Caner Aydın" status="Düşüşte" statusType="falling" xp="2.450" avatar="Caner" gender="male" viewMode={viewMode} />
      </div>
      <button className="mt-6 w-full h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#6F74D8] text-white font-bold text-[13px] hover:bg-[#5E63C2] transition-all shadow-sm cursor-pointer">
        Tüm sonuçları gör <ChevronRight size={16} />
      </button>
    </div>
  );
}