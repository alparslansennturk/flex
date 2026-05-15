// ── Bildirim Sesi Ayarları ────────────────────────────────────────────────────
// localStorage'da tutulur — kullanıcı başına, Firestore yazımı gerekmez.

const KEY_ENABLED = "flex_notif_sound_enabled";
const KEY_TONE    = "flex_notif_sound_tone";

export type SoundTone = "ding" | "soft" | "alert" | "pop";

export const SOUND_TONES: { value: SoundTone; label: string; desc: string }[] = [
  { value: "ding",  label: "Ding",   desc: "Klasik çan (varsayılan)" },
  { value: "soft",  label: "Soft",   desc: "Yumuşak, alçak ton"      },
  { value: "alert", label: "Çift",   desc: "İki kısa bip"            },
  { value: "pop",   label: "Pop",    desc: "Hızlı, keskin"           },
];

export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(KEY_ENABLED);
  return v === null ? true : v === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(KEY_ENABLED, String(enabled));
}

export function getSoundTone(): SoundTone {
  if (typeof window === "undefined") return "ding";
  return (localStorage.getItem(KEY_TONE) as SoundTone) || "ding";
}

export function setSoundTone(tone: SoundTone): void {
  localStorage.setItem(KEY_TONE, tone);
}

/** Seçili ton ile ses çalar. `preview=true` ise ayar bakılmaksızın çalar (önizleme). */
export function playNotificationSound(preview = false): void {
  if (!preview && !getSoundEnabled()) return;
  const tone = getSoundTone();

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    const beep = (startDelay: number, freqStart: number, freqEnd: number, dur: number, vol = 0.28) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime + startDelay);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + startDelay + dur * 0.5);
      gain.gain.setValueAtTime(vol, ctx.currentTime + startDelay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + dur);
      osc.start(ctx.currentTime + startDelay);
      osc.stop(ctx.currentTime + startDelay + dur);
    };

    switch (tone) {
      case "ding":  beep(0, 880, 440, 0.40); break;
      case "soft":  beep(0, 528, 440, 0.65, 0.14); break;
      case "alert": beep(0, 880, 880, 0.13); beep(0.22, 1100, 1100, 0.13); break;
      case "pop":   beep(0, 1200, 600, 0.14); break;
    }
  } catch {
    // Ses API desteklenmiyorsa sessiz devam et
  }
}
