"use client";

/**
 * FlexOS · Bildirim Sesi ayar kartı — TEK kaynak, hem eğitmen/admin `sistem-ayarlari`
 * sayfasının "Bildirim Ayarları" sekmesinde hem de öğrenci `student/[personId]/ayarlar`
 * sayfasında kullanılır (2026-07-24 kullanıcı isteği: "standart olmalı" — ikisi ayrı ayrı
 * yazılınca ton seçenekleri/görünüm farklılaşmıştı). Tamamen `notificationSound.ts`
 * (localStorage) üzerinden çalışır, Firestore/API çağrısı yok, cihaz bazlı ayar.
 */

import { useEffect, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import {
  getSoundEnabled, setSoundEnabled,
  getSoundTone, setSoundTone,
  playNotificationSound,
  SOUND_TONES, type SoundTone,
} from "@/app/lib/notificationSound";

export default function NotificationSoundSettings() {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [soundTone, setSoundToneState] = useState<SoundTone>("ding");

  useEffect(() => {
    // localStorage okuma — lazy `useState` initializer'a taşırsak SSR (window yok →
    // varsayılan) ile client hydration (gerçek kayıtlı değer) arasında hydration
    // mismatch oluşur; mount-sonrası effect'te okumak bilinçli.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#F0F4FF] rounded-xl flex items-center justify-center shrink-0">
            {soundEnabled
              ? <Volume2 size={16} className="text-base-primary-600" />
              : <VolumeX size={16} className="text-text-tertiary" />}
          </div>
          <div>
            <p className="text-[14px] font-bold text-text-primary">Bildirim Sesi</p>
            <p className="text-[12px] text-text-tertiary">Yeni bildirim gelince bu cihazda ses çalsın</p>
          </div>
        </div>
        <button type="button"
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
              <button type="button"
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
  );
}
