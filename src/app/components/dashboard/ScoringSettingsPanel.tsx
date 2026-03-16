"use client";

import React, { useState, useEffect } from "react";
import {
  Settings, Trophy, Award, Clock, Zap,
  AlertTriangle, CheckCircle2, RefreshCw, Save,
  TrendingUp, Sparkles,
} from "lucide-react";
import { useScoring } from "@/app/context/ScoringContext";
import { ScoringSettings, calculateXP, getLevelXP, getLatePenalty } from "@/app/lib/scoring";

// ─── Ana Panel ────────────────────────────────────────────────────────────────
export default function ScoringSettingsPanel() {
  const { settings, loading, saveSettings } = useScoring();
  const [local,   setLocal]   = useState<ScoringSettings>(settings);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [saved,   setSaved]   = useState(false);

  // Önizleme
  const [previewLevel,     setPreviewLevel]     = useState("Seviye-2");
  const [previewWeeksLate, setPreviewWeeksLate] = useState(0);

  useEffect(() => { setLocal(settings); }, [settings]);

  const weightSum   = parseFloat((local.certificateWeights.project + local.certificateWeights.assignment).toFixed(4));
  const weightValid = Math.abs(weightSum - 1.0) < 0.001;
  const isDirty     = JSON.stringify(local) !== JSON.stringify(settings);

  const previewXP  = calculateXP(previewLevel, previewWeeksLate, local);
  const baseXP     = getLevelXP(previewLevel, local);
  const penaltyMul = getLatePenalty(previewWeeksLate, local);

  const handleSave = async () => {
    if (!weightValid) { setError("Sertifika ağırlıkları toplamı tam olarak 1.00 olmalıdır."); return; }
    setSaving(true); setError("");
    try {
      await saveSettings(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch {
      setError("Kayıt sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-8 h-8 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="relative bg-base-primary-900 rounded-3xl p-8 overflow-hidden">
        {/* Dekoratif arka plan katmanları */}
        <div className="absolute inset-0 bg-gradient-to-br from-designstudio-secondary-900/60 via-base-primary-900 to-base-primary-900" />
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-designstudio-secondary-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 left-1/3 w-48 h-48 bg-designstudio-primary-500/10 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-white leading-none tracking-tight">Puanlama Kontrol Merkezi</h2>
              <p className="text-[12px] text-white/40 mt-1">Tüm XP ve sıralama kuralları buradan yönetilir — sıfır hard-code</p>
            </div>
          </div>

          {/* Quick stat kartları */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Min. Bölücü",    value: local.leaderboard.minTaskDivisor,                              Icon: TrendingUp, color: "text-designstudio-primary-400" },
              { label: "Proje Ağırlığı", value: `${(local.certificateWeights.project * 100).toFixed(0)}%`,    Icon: Award,      color: "text-designstudio-secondary-300" },
              { label: "Maks XP",        value: local.difficultyXP.level4,                                    Icon: Zap,        color: "text-designstudio-primary-300" },
              { label: "Geç Ceza Min.",  value: `${(local.latePenalty.week3plus * 100).toFixed(0)}%`,         Icon: Clock,      color: "text-[#FFB020]" },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/8 hover:bg-white/8 transition-colors">
                <Icon size={15} className={`${color} mb-2.5`} />
                <p className="text-[22px] font-bold text-white leading-none">{value}</p>
                <p className="text-[11px] text-white/35 mt-1.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AYAR KARTLARı 2×2 GRID ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">

        {/* 1. Leaderboard Algoritması */}
        <SettingCard
          Icon={Trophy} iconBg="bg-designstudio-primary-50" iconColor="text-designstudio-primary-500"
          title="Leaderboard Algoritması"
          description="Sıralama puanı nasıl hesaplanır"
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-bold text-surface-500">Minimum Görev Bölücüsü</label>
                <span className="text-[20px] font-bold text-base-primary-900 leading-none">{local.leaderboard.minTaskDivisor}</span>
              </div>
              <input
                type="range" min={1} max={10} step={1}
                value={local.leaderboard.minTaskDivisor}
                onChange={e => setLocal(p => ({ ...p, leaderboard: { minTaskDivisor: Number(e.target.value) } }))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-100
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-base-primary-900
                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                style={{
                  background: `linear-gradient(to right, #10294c ${(local.leaderboard.minTaskDivisor - 1) / 9 * 100}%, #EEF0F3 ${(local.leaderboard.minTaskDivisor - 1) / 9 * 100}%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-surface-300 mt-1 font-medium">
                <span>1</span><span>10</span>
              </div>
            </div>

            {/* Formül kutusu */}
            <div className="bg-base-primary-50 rounded-2xl p-4 border border-base-primary-100">
              <p className="text-[10px] font-bold text-base-primary-400 uppercase tracking-wider mb-2">Formül</p>
              <p className="text-[13px] font-mono text-base-primary-700">
                score = totalXP ÷ Math.max(
                <br />
                <span className="ml-4">completedTasks, <strong className="text-base-primary-900">{local.leaderboard.minTaskDivisor}</strong></span>
                <br />)
              </p>
            </div>
            <p className="text-[11px] text-surface-400 leading-relaxed">
              Az ödev yapan kullanıcıların aşırı yüksek puan almasını önler.
            </p>
          </div>
        </SettingCard>

        {/* 2. Sertifika Ağırlıkları */}
        <SettingCard
          Icon={Award} iconBg="bg-designstudio-secondary-50" iconColor="text-designstudio-secondary-500"
          title="Sertifika Ağırlıkları"
          description="Proje ve ödev puanlarının toplam skora katkı oranı"
        >
          <div className="space-y-4">
            {/* Stacked progress bar */}
            <div className="h-3 rounded-full overflow-hidden flex gap-0.5 bg-surface-100">
              <div
                className="bg-designstudio-secondary-500 rounded-full transition-all duration-300"
                style={{ width: `${local.certificateWeights.project * 100}%` }}
              />
              <div
                className="bg-designstudio-primary-500 rounded-full flex-1 transition-all duration-300"
              />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-surface-400 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-designstudio-secondary-500 inline-block" />Proje</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-designstudio-primary-500 inline-block" />Ödev</span>
            </div>

            <WeightRow
              label="Proje" color="bg-designstudio-secondary-500"
              value={local.certificateWeights.project}
              onChange={v => setLocal(p => ({ ...p, certificateWeights: { project: v, assignment: parseFloat((1 - v).toFixed(2)) } }))}
            />
            <WeightRow
              label="Ödev" color="bg-designstudio-primary-500"
              value={local.certificateWeights.assignment}
              onChange={v => setLocal(p => ({ ...p, certificateWeights: { assignment: v, project: parseFloat((1 - v).toFixed(2)) } }))}
            />

            {/* Toplam göstergesi */}
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-colors ${
              weightValid
                ? "bg-status-success-100 border-status-success-500/20"
                : "bg-status-danger-50 border-status-danger-500/20"
            }`}>
              <span className="text-[12px] font-bold text-surface-600">Toplam</span>
              <div className="flex items-center gap-2">
                {weightValid
                  ? <CheckCircle2 size={14} className="text-status-success-500" />
                  : <AlertTriangle size={14} className="text-status-danger-500" />}
                <span className={`text-[14px] font-bold ${weightValid ? "text-status-success-500" : "text-status-danger-500"}`}>
                  {weightSum.toFixed(2)} / 1.00
                </span>
              </div>
            </div>
          </div>
        </SettingCard>

        {/* 3. Geç Teslim Cezası */}
        <SettingCard
          Icon={Clock} iconBg="bg-[#FFF9EB]" iconColor="text-[#FFB020]"
          title="Geç Teslim Cezası"
          description="Gecikmeli teslimde uygulanacak XP çarpanı"
        >
          <div className="space-y-4">
            {([
              { key: "week1",    label: "1. Hafta",  trackColor: "#FFB020" },
              { key: "week2",    label: "2. Hafta",  trackColor: "#FF8D28" },
              { key: "week3plus",label: "3+ Hafta",  trackColor: "#FF4D4D" },
            ] as const).map(({ key, label, trackColor }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-surface-500">{label}</label>
                  <span className="text-[15px] font-bold" style={{ color: trackColor }}>
                    {Math.round(local.latePenalty[key] * 100)}%
                  </span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={local.latePenalty[key]}
                  onChange={e => setLocal(p => ({ ...p, latePenalty: { ...p.latePenalty, [key]: parseFloat(e.target.value) } }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                  style={{
                    background: `linear-gradient(to right, ${trackColor} ${local.latePenalty[key] * 100}%, #EEF0F3 ${local.latePenalty[key] * 100}%)`,
                    ["--thumb-color" as string]: trackColor,
                  }}
                />
              </div>
            ))}
            <p className="text-[11px] text-surface-400 leading-relaxed">
              Zamanında teslimde ceza uygulanmaz (×1.00). Çarpan yükseldikçe ceza azalır.
            </p>
          </div>
        </SettingCard>

        {/* 4. Zorluk XP Değerleri */}
        <SettingCard
          Icon={Zap} iconBg="bg-base-primary-50" iconColor="text-base-primary-500"
          title="Zorluk XP Değerleri"
          description="Her seviye için kazanılacak temel XP miktarı"
        >
          <div className="space-y-3">
            {([
              { key: "level1", label: "Seviye 1", dot: "bg-status-success-500",          maxXP: 200  },
              { key: "level2", label: "Seviye 2", dot: "bg-designstudio-primary-500",    maxXP: 400  },
              { key: "level3", label: "Seviye 3", dot: "bg-designstudio-secondary-500",  maxXP: 800  },
              { key: "level4", label: "Seviye 4", dot: "bg-status-danger-500",           maxXP: 2000 },
            ] as const).map(({ key, label, dot, maxXP }) => (
              <div key={key} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
                <span className="text-[12px] font-bold text-surface-600 w-16 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dot} transition-all duration-300`}
                    style={{ width: `${Math.min((local.difficultyXP[key] / maxXP) * 100, 100)}%` }}
                  />
                </div>
                <input
                  type="number" min={0} max={9999} step={10}
                  value={local.difficultyXP[key]}
                  onChange={e => setLocal(p => ({ ...p, difficultyXP: { ...p.difficultyXP, [key]: Number(e.target.value) || 0 } }))}
                  className="w-20 h-9 px-2 rounded-xl border border-surface-200 bg-surface-50 text-[13px] font-bold text-base-primary-900 outline-none focus:border-base-primary-500 focus:bg-white transition-all text-right"
                />
                <span className="text-[11px] text-surface-400 w-5 shrink-0 font-medium">XP</span>
              </div>
            ))}
            <p className="text-[11px] text-surface-400 leading-relaxed mt-1">
              Bu değerler <strong className="text-surface-500">geç ceza çarpanıyla</strong> çarpılarak final XP hesaplanır.
            </p>
          </div>
        </SettingCard>
      </div>

      {/* ── XP ÖNİZLEME ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-surface-100 shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-designstudio-secondary-50 flex items-center justify-center">
            <Sparkles size={18} className="text-designstudio-secondary-500" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-base-primary-900">Canlı XP Önizleme</h3>
            <p className="text-[12px] text-surface-400">Seçilen koşullara göre kazanılacak XP'yi gerçek zamanlı gör</p>
          </div>
        </div>

        <div className="flex items-stretch gap-6">
          {/* Seviye seçici */}
          <div className="flex-1 space-y-1.5">
            <label className="text-[12px] font-bold text-surface-500">Zorluk Seviyesi</label>
            <div className="grid grid-cols-2 gap-2">
              {["Seviye-1","Seviye-2","Seviye-3","Seviye-4"].map(l => (
                <button
                  key={l}
                  onClick={() => setPreviewLevel(l)}
                  className={`h-10 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                    previewLevel === l
                      ? "bg-base-primary-900 text-white border-base-primary-900"
                      : "bg-surface-50 text-surface-500 border-surface-200 hover:border-surface-400"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Gecikme seçici */}
          <div className="flex-1 space-y-1.5">
            <label className="text-[12px] font-bold text-surface-500">Gecikme Durumu</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 0, label: "Zamanında" },
                { v: 1, label: "1 Hf. Geç" },
                { v: 2, label: "2 Hf. Geç" },
                { v: 3, label: "3+ Hf. Geç" },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setPreviewWeeksLate(v)}
                  className={`h-10 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                    previewWeeksLate === v
                      ? v === 0
                        ? "bg-status-success-500 text-white border-status-success-500"
                        : "bg-status-danger-500 text-white border-status-danger-500"
                      : "bg-surface-50 text-surface-500 border-surface-200 hover:border-surface-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* XP sonuç kartı */}
          <div className="shrink-0 flex flex-col items-center justify-center bg-gradient-to-br from-base-primary-900 via-designstudio-secondary-900 to-base-primary-900 rounded-2xl px-10 py-6 shadow-xl min-w-[180px]">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Kazanılacak XP</p>
            <p className="text-[48px] font-bold text-white leading-none">{previewXP}</p>
            {previewWeeksLate > 0 ? (
              <p className="text-[11px] text-white/40 mt-2">
                {baseXP} × {Math.round(penaltyMul * 100)}%
              </p>
            ) : (
              <p className="text-[11px] text-status-success-500 mt-2 font-bold">Tam puan ✓</p>
            )}
          </div>
        </div>
      </div>

      {/* ── KAYDET FOOTER ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-surface-100 px-6 py-4 shadow-sm">
        <div className="min-h-[20px]">
          {error ? (
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-status-danger-500 shrink-0" />
              <span className="text-[13px] font-bold text-status-danger-500">{error}</span>
            </div>
          ) : saved ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
              <CheckCircle2 size={14} className="text-status-success-500" />
              <span className="text-[13px] font-bold text-status-success-500">
                Kaydedildi. Tüm leaderboard puanları güncellendi.
              </span>
            </div>
          ) : isDirty ? (
            <p className="text-[13px] text-[#FFB020] font-medium">Kaydedilmemiş değişiklikler var.</p>
          ) : (
            <p className="text-[13px] text-surface-300">Ayarlar güncel.</p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !weightValid || !isDirty}
          className="flex items-center gap-2.5 h-11 px-8 rounded-xl bg-designstudio-primary-500 text-white text-[13px] font-bold
            hover:bg-designstudio-primary-600 active:scale-95 transition-all cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-designstudio-primary-500/25"
        >
          {saving
            ? <><RefreshCw size={14} className="animate-spin" />Hesaplanıyor...</>
            : <><Save size={14} />Ayarları Güncelle</>}
        </button>
      </div>
    </div>
  );
}

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function SettingCard({
  Icon, iconBg, iconColor, title, description, children,
}: {
  Icon: React.ElementType;
  iconBg: string; iconColor: string;
  title: string; description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-surface-100 shadow-lg p-7 flex flex-col gap-5 hover:shadow-xl transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div className="pt-0.5">
          <h3 className="text-[15px] font-bold text-base-primary-900 leading-snug">{title}</h3>
          <p className="text-[12px] text-surface-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function WeightRow({
  label, color, value, onChange,
}: {
  label: string; color: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />
      <span className="text-[12px] font-bold text-surface-600 w-12 shrink-0">{label}</span>
      <input
        type="number" min={0} max={1} step={0.05}
        value={value}
        onChange={e => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= 0 && v <= 1) onChange(v);
        }}
        className="w-20 h-9 px-2 rounded-xl border border-surface-200 bg-surface-50 text-[13px] font-bold text-base-primary-900 outline-none focus:border-base-primary-500 focus:bg-white transition-all text-center"
      />
      <span className="text-[12px] font-bold text-base-primary-900 w-10 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}
