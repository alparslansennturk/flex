"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/app/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import {
  Bell, Send, Users, GraduationCap, Globe, CheckCircle2,
  AlertCircle, BookOpen, ChevronDown, Volume2, VolumeX, Play,
} from "lucide-react";
import {
  getSoundEnabled, setSoundEnabled,
  getSoundTone, setSoundTone,
  playNotificationSound,
  SOUND_TONES, type SoundTone,
} from "@/app/lib/notificationSound";

type Audience = "students" | "instructors" | "all" | "group" | "my-groups";

interface Group { id: string; code: string; branch: string; status: string; instructorId?: string; }

interface NotificationPanelProps {
  userRole?: string;
  instructorUid?: string;
}

// Admin: üst sıra geniş hedefler, alt sıra grup bazlı
const ADMIN_BROADCAST_OPTIONS: { value: Audience; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "students",    label: "Tüm Öğrenciler", desc: "Tüm öğrenci hesapları",       icon: <Users size={18} /> },
  { value: "instructors", label: "Tüm Eğitmenler", desc: "Admin ve eğitmen hesapları",  icon: <GraduationCap size={18} /> },
  { value: "all",         label: "Herkes",          desc: "Sistemdeki tüm kullanıcılar", icon: <Globe size={18} /> },
];

const GROUP_OPTIONS: { value: Audience; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "my-groups", label: "Tüm Gruplarım",  desc: "Size atanmış tüm sınıflar",  icon: <GraduationCap size={18} /> },
  { value: "group",     label: "Belirli Grup",   desc: "Tek bir sınıf seç",          icon: <BookOpen size={18} /> },
];

export default function NotificationPanel({ userRole = "admin", instructorUid }: NotificationPanelProps) {
  const isInstructor = userRole === "instructor";

  const [title,         setTitle]         = useState("");
  const [preview,       setPreview]       = useState("");
  const [audience,      setAudience]      = useState<Audience>(isInstructor ? "my-groups" : "students");
  const [actionUrl,     setActionUrl]     = useState("/");
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [groups,        setGroups]        = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [soundEnabled,  setSoundEnabledState] = useState(true);
  const [soundTone,     setSoundToneState]    = useState<SoundTone>("ding");

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
    setSoundToneState(getSoundTone());
  }, []);

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
  };

  const handleToneChange = (tone: SoundTone) => {
    setSoundTone(tone);
    setSoundToneState(tone);
    playNotificationSound(true);
  };

  useEffect(() => {
    setGroupsLoading(true);
    getDocs(query(collection(db, "groups"), orderBy("code")))
      .then(snap => {
        const all = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<Group, "id">) }))
          .filter(g => g.status !== "archived");
        setGroups(isInstructor ? all.filter(g => g.instructorId === instructorUid) : all);
      })
      .catch(() => {})
      .finally(() => setGroupsLoading(false));
  }, [isInstructor, instructorUid]);

  const needsGroupSelect = audience === "group";

  const canSend = title.trim().length > 0 &&
    preview.trim().length > 0 &&
    (!needsGroupSelect || selectedGroup !== "");

  const audienceLabel = audience === "group"
    ? (groups.find(g => g.id === selectedGroup)?.code ?? "Seçili Grup")
    : [...ADMIN_BROADCAST_OPTIONS, ...GROUP_OPTIONS].find(o => o.value === audience)?.label ?? "";

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
    } catch (err: unknown) {
      setResult({ type: "error", msg: err instanceof Error ? err.message : "Bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-8 py-8">

      {/* Sayfa başlığı */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-[#10294C] rounded-xl flex items-center justify-center shrink-0">
          <Bell size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-[#10294C]">Bildirim Yönetimi</h2>
          <p className="text-[13px] text-[#8E95A3]">
            {isInstructor ? "Kendi grubunuza bildirim gönderin ve ses tercihlerinizi ayarlayın" : "Kullanıcılara bildirim gönderin ve ses tercihlerinizi ayarlayın"}
          </p>
        </div>
      </div>

      {/* ── İki Kolon Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px] gap-6 items-start">

        {/* ── Sol: Bildirim Gönder Formu ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6 space-y-5">

          <p className="text-[13px] font-bold text-[#10294C] border-b border-[#EEF0F3] pb-4">Bildirim Gönder</p>

          {/* Hedef kitle */}
          <div className="space-y-3">
            <label className="text-[13px] font-semibold text-[#5C6370]">Hedef Kitle</label>

            {/* Admin: geniş yayın seçenekleri */}
            {!isInstructor && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#AEB4C0] uppercase tracking-wider">Sistem Bildirimi</p>
                <div className="grid grid-cols-3 gap-2">
                  {ADMIN_BROADCAST_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAudience(opt.value)}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 transition-all cursor-pointer text-left
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
                <p className="text-[10px] font-bold text-[#AEB4C0] uppercase tracking-wider pt-1">Grup Bazlı</p>
              </div>
            )}

            {/* Hem admin hem eğitmen: grup bazlı seçenekler */}
            <div className="grid grid-cols-2 gap-2">
              {GROUP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setAudience(opt.value); if (opt.value !== "group") setSelectedGroup(""); }}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 transition-all cursor-pointer text-left
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

          {/* Grup Seçici — sadece "Belirli Grup" seçilince */}
          {needsGroupSelect && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#5C6370]">Sınıf Seç</label>
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

          {/* Başlık + Mesaj yan yana */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-[13px] font-semibold text-[#5C6370]">Başlık</label>
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

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-[13px] font-semibold text-[#5C6370]">Mesaj</label>
                <span className={`text-[11px] ${preview.length > 90 ? "text-red-500" : "text-[#AEB4C0]"}`}>{preview.length}/100</span>
              </div>
              <textarea
                value={preview}
                maxLength={100}
                onChange={e => setPreview(e.target.value)}
                placeholder="Bildirimde görünecek kısa mesaj..."
                rows={1}
                className="w-full px-4 py-3 border border-[#EEF0F3] rounded-xl text-[14px] text-[#10294C] outline-none focus:border-[#10294C]/40 transition-colors bg-[#F7F8FA] resize-none"
              />
            </div>
          </div>

          {/* Yönlendirme URL */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#5C6370]">
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

        {/* ── Sağ: Ses Ayarları + Canlı Önizleme ─────────────────────────── */}
        <div className="space-y-5">

          {/* Ses Ayarları */}
          <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#F0F4FF] rounded-xl flex items-center justify-center shrink-0">
                  {soundEnabled
                    ? <Volume2 size={16} className="text-[#3A7BD5]" />
                    : <VolumeX  size={16} className="text-[#AEB4C0]" />}
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#10294C]">Bildirim Sesi</p>
                  <p className="text-[11px] text-[#8E95A3]">Yeni bildirimde çalacak ses</p>
                </div>
              </div>
              <button
                onClick={handleSoundToggle}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${soundEnabled ? "bg-[#3A7BD5]" : "bg-[#D1D5DB]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${soundEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {soundEnabled && (
              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-[#5C6370]">Ton</p>
                <div className="grid grid-cols-4 gap-2">
                  {SOUND_TONES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => handleToneChange(t.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer
                        ${soundTone === t.value
                          ? "border-[#3A7BD5] bg-[#EBF2FF] text-[#3A7BD5]"
                          : "border-[#EEF0F3] text-[#8E95A3] hover:border-[#3A7BD5]/40 hover:text-[#3A7BD5]"}`}
                    >
                      <Play size={13} className="shrink-0" />
                      <span className="text-[11px] font-bold leading-none">{t.label}</span>
                      <span className="text-[9px] opacity-70 leading-snug text-center">{t.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#AEB4C0]">Tona tıklayınca önizleme çalar. Ayar tarayıcıya kaydedilir.</p>
              </div>
            )}
          </div>

          {/* Canlı Önizleme — her zaman görünür */}
          <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6">
            <p className="text-[11px] font-bold text-[#AEB4C0] uppercase tracking-wider mb-4">Canlı Önizleme</p>

            {/* Toast önizleme */}
            <div className="rounded-xl border border-[#EEF0F3] bg-[#F7F8FA] p-4 mb-3">
              <p className="text-[10px] font-semibold text-[#AEB4C0] mb-2">Toast bildirimi</p>
              <div className="bg-white rounded-lg shadow-sm border border-[#EEF0F3] px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#10294C] flex items-center justify-center shrink-0">
                  <Bell size={14} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[#10294C] leading-snug">
                    {title || <span className="text-[#C5C9D0]">Başlık...</span>}
                  </p>
                  <p className="text-[11px] text-[#8E95A3] mt-0.5 leading-relaxed">
                    {preview || <span className="text-[#C5C9D0]">Mesaj...</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Bell dropdown önizleme */}
            <div className="rounded-xl border border-[#EEF0F3] bg-[#F7F8FA] p-4">
              <p className="text-[10px] font-semibold text-[#AEB4C0] mb-2">Bildirim listesinde</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#10294C]/10 flex items-center justify-center shrink-0">
                  <Bell size={18} className="text-[#10294C]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold text-[#AEB4C0]">Az önce</span>
                  </div>
                  <p className="text-[13px] font-bold text-[#10294C] leading-snug">
                    {title || <span className="font-normal text-[#C5C9D0]">Başlık...</span>}
                  </p>
                  <p className="text-[12px] text-[#8E95A3] mt-0.5 leading-relaxed">
                    {preview || <span className="text-[#C5C9D0]">Mesaj...</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
