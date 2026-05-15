"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { Volume2, VolumeX, Play } from "lucide-react";
import StudentSidebar from "@/app/components/student/StudentSidebar";
import StudentHeader from "@/app/components/layout/StudentHeader";
import {
  getSoundEnabled, setSoundEnabled,
  getSoundTone, setSoundTone,
  playNotificationSound,
  SOUND_TONES, type SoundTone,
} from "@/app/lib/notificationSound";

interface StudentInfo {
  name: string;
  lastName: string;
  gender?: string;
  avatarId?: number;
  groupCode?: string;
}

export default function StudentSettingsPage() {
  const { studentId } = useParams<{ studentId: string }>();

  const [student,     setStudent]         = useState<StudentInfo | null>(null);
  const [activeTab,   setActiveTab]       = useState<"profile" | "notifications">("notifications");
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [soundTone,    setSoundToneState]    = useState<SoundTone>("ding");

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
    setSoundToneState(getSoundTone());
  }, []);

  useEffect(() => {
    if (!studentId) return;
    getDoc(doc(db, "students", studentId)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setStudent({
        name:      d.name      ?? "",
        lastName:  d.lastName  ?? "",
        gender:    d.gender,
        avatarId:  d.avatarId,
        groupCode: d.groupCode ?? "",
      });
    });
  }, [studentId]);

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

  const studentFullName = student ? `${student.name} ${student.lastName}`.trim() : "";

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">

      <aside className="hidden lg:flex h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-base-primary-900">
        <StudentSidebar studentId={studentId} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <StudentHeader
          studentName={studentFullName}
          groupCode={student?.groupCode}
          gender={student?.gender}
          avatarId={student?.avatarId}
        />

        {/* Tab Bar */}
        <div className="border-b border-surface-200 bg-white shrink-0">
          <div className="px-8 flex items-center h-14 gap-1">
            {([
              { id: "profile",       label: "Profil Ayarları" },
              { id: "notifications", label: "Bildirimler"     },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative h-full px-5 text-[14px] font-semibold transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "text-base-primary-600"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 w-full h-[3px] bg-base-primary-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable] bg-surface-50/20 relative">
          <div className="px-8 py-8">

            {/* Profil Ayarları */}
            {activeTab === "profile" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-[15px] font-semibold text-text-secondary">Profil ayarları yakında eklenecek</p>
                  <p className="text-[13px] text-text-tertiary">Ad, soyad, avatar ve şifre değiştirme burada yer alacak.</p>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
            <div className="max-w-2xl space-y-6">

              {/* Bildirim Sesi */}
              <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#F0F4FF] rounded-xl flex items-center justify-center shrink-0">
                      {soundEnabled
                        ? <Volume2 size={16} className="text-base-primary-600" />
                        : <VolumeX  size={16} className="text-text-tertiary" />}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-text-primary">Bildirim Sesi</p>
                      <p className="text-[12px] text-text-tertiary">Yeni bildirim gelince ses çalsın</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSoundToggle}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${soundEnabled ? "bg-base-primary-600" : "bg-[#D1D5DB]"}`}
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
                              ? "border-base-primary-500 bg-base-primary-50 text-base-primary-600"
                              : "border-[#EEF0F3] text-[#8E95A3] hover:border-base-primary-300 hover:text-base-primary-600"}`}
                        >
                          <Play size={13} className="shrink-0" />
                          <span className="text-[11px] font-bold leading-none">{t.label}</span>
                          <span className="text-[9px] opacity-70 leading-snug text-center">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#AEB4C0]">Tona tıklayınca önizleme çalar. Ayar bu cihaza kaydedilir.</p>
                  </div>
                )}
              </div>

            </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
