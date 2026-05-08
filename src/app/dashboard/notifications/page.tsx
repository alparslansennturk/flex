"use client";

import { useState } from "react";
import { auth } from "@/app/lib/firebase";
import { Bell, Send, Users, GraduationCap, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import Header from "@/app/components/layout/Header";
import Sidebar from "@/app/components/layout/Sidebar";

type Audience = "students" | "instructors" | "all";

const AUDIENCE_OPTIONS: { value: Audience; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "students",    label: "Tüm Öğrenciler",  desc: "Sadece öğrenci hesaplarına gönderilir",       icon: <Users size={18} /> },
  { value: "instructors", label: "Tüm Eğitmenler",  desc: "Admin ve eğitmen hesaplarına gönderilir",     icon: <GraduationCap size={18} /> },
  { value: "all",         label: "Herkes",           desc: "Sistemdeki tüm kullanıcılara gönderilir",    icon: <Globe size={18} /> },
];

export default function NotificationsPage() {
  const [title,      setTitle]      = useState("");
  const [preview,    setPreview]    = useState("");
  const [audience,   setAudience]   = useState<Audience>("students");
  const [actionUrl,  setActionUrl]  = useState("/");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const canSend = title.trim().length > 0 && preview.trim().length > 0;

  const handleSend = async () => {
    setShowConfirm(false);
    setLoading(true);
    setResult(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Oturum bulunamadı.");

      const res = await fetch("/api/notifications/broadcast", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ title: title.trim(), preview: preview.trim(), audience, actionUrl: actionUrl.trim() || "/" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gönderim başarısız.");
      setResult({ type: "success", msg: `Bildirim ${data.sent} kullanıcıya gönderildi.` });
      setTitle("");
      setPreview("");
      setActionUrl("/");
    } catch (err: any) {
      setResult({ type: "error", msg: err.message ?? "Bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">
      <div className="w-[260px] shrink-0 h-full"><Sidebar /></div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Başlık */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#10294C] rounded-xl flex items-center justify-center shrink-0">
                <Bell size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-[#10294C]">Sistem Bildirimi Gönder</h2>
                <p className="text-[13px] text-[#8E95A3]">Seçilen kullanıcılara anlık bildirim iletilir.</p>
              </div>
            </div>

            {/* Kart */}
            <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6 space-y-5">

              {/* Hedef kitle */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#10294C]">Hedef Kitle</label>
                <div className="grid grid-cols-3 gap-3">
                  {AUDIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAudience(opt.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-center
                        ${audience === opt.value
                          ? "border-[#10294C] bg-[#10294C]/5 text-[#10294C]"
                          : "border-[#EEF0F3] text-[#8E95A3] hover:border-[#10294C]/30"}`}
                    >
                      {opt.icon}
                      <span className="text-[12px] font-bold leading-tight">{opt.label}</span>
                      <span className="text-[10px] opacity-70 leading-snug">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Başlık */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[13px] font-bold text-[#10294C]">Başlık</label>
                  <span className={`text-[11px] ${title.length > 180 ? "text-red-500" : "text-[#AEB4C0]"}`}>{title.length}/200</span>
                </div>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="örn. Sistem güncellemesi yapıldı"
                  className="w-full h-11 px-4 border border-[#EEF0F3] rounded-xl text-[14px] text-[#10294C] outline-none focus:border-[#10294C]/40 transition-colors bg-[#F7F8FA]"
                />
              </div>

              {/* Mesaj */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[13px] font-bold text-[#10294C]">Mesaj</label>
                  <span className={`text-[11px] ${preview.length > 90 ? "text-red-500" : "text-[#AEB4C0]"}`}>{preview.length}/100</span>
                </div>
                <textarea
                  value={preview}
                  maxLength={100}
                  onChange={e => setPreview(e.target.value)}
                  placeholder="Bildirimde görünecek kısa mesaj..."
                  rows={3}
                  className="w-full px-4 py-3 border border-[#EEF0F3] rounded-xl text-[14px] text-[#10294C] outline-none focus:border-[#10294C]/40 transition-colors bg-[#F7F8FA] resize-none"
                />
              </div>

              {/* Yönlendirme URL */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#10294C]">Tıklandığında Git <span className="text-[#AEB4C0] font-normal">(isteğe bağlı)</span></label>
                <input
                  type="text"
                  value={actionUrl}
                  onChange={e => setActionUrl(e.target.value)}
                  placeholder="/"
                  className="w-full h-11 px-4 border border-[#EEF0F3] rounded-xl text-[14px] text-[#10294C] outline-none focus:border-[#10294C]/40 transition-colors bg-[#F7F8FA] font-mono text-[13px]"
                />
              </div>

              {/* Önizleme */}
              {(title || preview) && (
                <div className="border border-[#EEF0F3] rounded-xl p-4 bg-[#F7F8FA] space-y-1">
                  <p className="text-[10px] font-bold text-[#AEB4C0] uppercase tracking-wider mb-2">Önizleme</p>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#10294C] flex items-center justify-center shrink-0">
                      <Bell size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#10294C]">{title || "Başlık..."}</p>
                      <p className="text-[12px] text-[#8E95A3] mt-0.5">{preview || "Mesaj..."}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sonuç mesajı */}
              {result && (
                <div className={`flex items-center gap-3 p-4 rounded-xl ${result.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {result.type === "success"
                    ? <CheckCircle2 size={18} className="shrink-0" />
                    : <AlertCircle size={18} className="shrink-0" />}
                  <span className="text-[13px] font-semibold">{result.msg}</span>
                </div>
              )}

              {/* Gönder butonu */}
              {!showConfirm ? (
                <button
                  disabled={!canSend || loading}
                  onClick={() => setShowConfirm(true)}
                  className="w-full h-12 bg-[#10294C] text-white rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-[#0d2140] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send size={16} />
                  Gönder
                </button>
              ) : (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                  <p className="text-[13px] font-bold text-amber-800 text-center">
                    {AUDIENCE_OPTIONS.find(o => o.value === audience)?.label} hedefine bildirim gönderilecek. Emin misin?
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowConfirm(false)} className="flex-1 h-10 border border-[#EEF0F3] rounded-xl text-[13px] font-bold text-[#5C6370] hover:bg-[#F7F8FA] transition-colors cursor-pointer">İptal</button>
                    <button onClick={handleSend} disabled={loading} className="flex-1 h-10 bg-[#10294C] text-white rounded-xl text-[13px] font-bold hover:bg-[#0d2140] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
                      {loading ? <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4" /> : <Send size={14} />}
                      {loading ? "Gönderiliyor..." : "Evet, Gönder"}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
