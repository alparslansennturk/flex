"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/app/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Bell, Send, Users, GraduationCap, Globe, CheckCircle2, AlertCircle, BookOpen, ChevronDown } from "lucide-react";

type Audience = "students" | "instructors" | "all" | "group";

interface Group { id: string; code: string; branch: string; status: string; }

const BASE_OPTIONS: { value: Audience; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "students",    label: "Tüm Öğrenciler", desc: "Sadece öğrenci hesapları",    icon: <Users size={18} /> },
  { value: "instructors", label: "Tüm Eğitmenler", desc: "Admin ve eğitmen hesapları",  icon: <GraduationCap size={18} /> },
  { value: "all",         label: "Herkes",          desc: "Sistemdeki tüm kullanıcılar", icon: <Globe size={18} /> },
  { value: "group",       label: "Gruba Özel",      desc: "Belirli bir sınıf",           icon: <BookOpen size={18} /> },
];

export default function NotificationPanel() {
  const [title,          setTitle]          = useState("");
  const [preview,        setPreview]        = useState("");
  const [audience,       setAudience]       = useState<Audience>("students");
  const [actionUrl,      setActionUrl]      = useState("/");
  const [loading,        setLoading]        = useState(false);
  const [result,         setResult]         = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [groups,         setGroups]         = useState<Group[]>([]);
  const [selectedGroup,  setSelectedGroup]  = useState<string>("");
  const [groupsLoading,  setGroupsLoading]  = useState(false);

  useEffect(() => {
    setGroupsLoading(true);
    getDocs(query(collection(db, "groups"), orderBy("code")))
      .then(snap => setGroups(
        snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<Group, "id">) }))
          .filter(g => g.status !== "archived")
      ))
      .catch(() => {})
      .finally(() => setGroupsLoading(false));
  }, []);

  const canSend = title.trim().length > 0 &&
    preview.trim().length > 0 &&
    (audience !== "group" || selectedGroup !== "");

  const audienceLabel = audience === "group"
    ? (groups.find(g => g.id === selectedGroup)?.code ?? "Seçili Grup")
    : BASE_OPTIONS.find(o => o.value === audience)?.label ?? "";

  const handleSend = async () => {
    setShowConfirm(false);
    setLoading(true);
    setResult(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Oturum bulunamadı.");

      const body: Record<string, string> = {
        title:     title.trim(),
        preview:   preview.trim(),
        audience,
        actionUrl: actionUrl.trim() || "/",
      };
      if (audience === "group") body.groupId = selectedGroup;

      const res = await fetch("/api/notifications/broadcast", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gönderim başarısız.");

      setResult({ type: "success", msg: `Bildirim ${data.sent} kullanıcıya iletildi.` });
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
    <div className="px-8 py-8">
      <div className="max-w-2xl space-y-6">

        {/* Başlık */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#10294C] rounded-xl flex items-center justify-center shrink-0">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#10294C]">Sistem Bildirimi Gönder</h2>
            <p className="text-[13px] text-[#8E95A3]">Seçilen kullanıcılara anlık bildirim iletilir.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6 space-y-5">

          {/* Hedef kitle */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#10294C]">Hedef Kitle</label>
            <div className="grid grid-cols-2 gap-3">
              {BASE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all cursor-pointer text-left
                    ${audience === opt.value
                      ? "border-[#10294C] bg-[#10294C]/5 text-[#10294C]"
                      : "border-[#EEF0F3] text-[#8E95A3] hover:border-[#10294C]/30"}`}
                >
                  <span className="shrink-0">{opt.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold leading-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-70 leading-snug mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Grup Seçici */}
          {audience === "group" && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#10294C]">Sınıf Seç</label>
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  disabled={groupsLoading}
                  className="w-full h-11 pl-4 pr-10 border border-[#EEF0F3] rounded-xl text-[14px] text-[#10294C] outline-none focus:border-[#10294C]/40 transition-colors bg-[#F7F8FA] appearance-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">— Grup seçin —</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.code}{g.branch ? ` · ${g.branch}` : ""}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#AEB4C0] pointer-events-none" />
              </div>
            </div>
          )}

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
              placeholder="örn. Yeni özellik eklendi"
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
            <label className="text-[13px] font-bold text-[#10294C]">
              Tıklandığında Git <span className="text-[#AEB4C0] font-normal">(isteğe bağlı)</span>
            </label>
            <input
              type="text"
              value={actionUrl}
              onChange={e => setActionUrl(e.target.value)}
              placeholder="/"
              className="w-full h-11 px-4 border border-[#EEF0F3] rounded-xl text-[13px] font-mono text-[#10294C] outline-none focus:border-[#10294C]/40 transition-colors bg-[#F7F8FA]"
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

          {/* Sonuç */}
          {result && (
            <div className={`flex items-center gap-3 p-4 rounded-xl ${result.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {result.type === "success"
                ? <CheckCircle2 size={18} className="shrink-0" />
                : <AlertCircle size={18} className="shrink-0" />}
              <span className="text-[13px] font-semibold">{result.msg}</span>
            </div>
          )}

          {/* Gönder */}
          {!showConfirm ? (
            <button
              disabled={!canSend || loading}
              onClick={() => setShowConfirm(true)}
              className="w-full h-12 bg-[#10294C] text-white rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-[#0d2140] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send size={16} /> Gönder
            </button>
          ) : (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
              <p className="text-[13px] font-bold text-amber-800 text-center">
                "{audienceLabel}" hedefine bildirim gönderilecek. Emin misin?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 h-10 border border-[#EEF0F3] rounded-xl text-[13px] font-bold text-[#5C6370] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="flex-1 h-10 bg-[#10294C] text-white rounded-xl text-[13px] font-bold hover:bg-[#0d2140] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading
                    ? <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4" />
                    : <Send size={14} />}
                  {loading ? "Gönderiliyor..." : "Evet, Gönder"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
