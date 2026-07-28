"use client";

/**
 * Recharts donut halkası — `satislar/dashboard/page.tsx` ve `egitim-operasyon-anasayfa/page.tsx`
 * birebir aynı `<ResponsiveContainer><PieChart><Pie>` bloğunu kopyalamıştı (2026-07-28'de
 * fark edildi). Ayrıca bu dosya `next/dynamic` ile `ssr: false` olarak yükleniyor —
 * `recharts` (ağır kütüphane) artık her sayfanın ilk yüklemesine değil, sadece bu
 * donut'u GERÇEKTEN render eden sayfalara dahil oluyor.
 */
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export default function DonutRing({ pieData, revealProgress }: { pieData: DonutSlice[]; revealProgress: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 216, height: 216 }}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={108}
          startAngle={90}
          endAngle={90 - 360 * revealProgress}
          paddingAngle={0}
          stroke="#fff"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
