import { LayoutDashboard, Users, BookOpen, Trophy, Settings, LogOut } from "lucide-react";

export default function Sidebar({ activeTab, setActiveTab }: any) {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-[#10294C] text-white flex-col z-50">
      <div className="p-8 text-nowrap" onClick={() => setActiveTab('dashboard')}>
        <div className="flex items-center gap-1 cursor-pointer">
          <span className="text-[20px] font-semibold text-[#FF8D28] tracking-tight">tasarım</span>
          <span className="text-[20px] font-bold text-white tracking-tight">atölyesi</span>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-12 space-y-1 overflow-y-auto">
        <SidebarLink 
          icon={<LayoutDashboard size={15} />} 
          label="Atölye Özeti" 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
        />
        <SidebarLink 
          icon={<Users size={15} />} 
          label="Öğrencilerim" 
          active={activeTab === 'management'} 
          onClick={() => setActiveTab('management')} 
        />
        <SidebarLink icon={<BookOpen size={15} />} label="Ödev Havuzu" />
        <SidebarLink icon={<Trophy size={15} />} label="Sınıf Ligi" />
        <SidebarLink icon={<Settings size={15} />} label="Atölye Ayarları" />
      </nav>

      <div className="p-6 mt-auto border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 text-white cursor-pointer hover:bg-white/5 transition-colors text-[15px] group rounded-xl font-medium">
          <LogOut size={15} className="group-hover:text-[#FF8D28] transition-colors" />
          <span>Çıkış Yap</span>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ icon, label, active, onClick }: any) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 cursor-pointer group ${active ? 'bg-white/5 text-white' : 'text-white hover:bg-white/5'}`}>
      <span className={`transition-colors duration-200 ${active ? 'text-[#FF8D28]' : 'group-hover:text-[#FF8D28]'}`}>{icon}</span>
      <span className="text-[15px] font-medium tracking-wide">{label}</span>
    </div>
  );
}