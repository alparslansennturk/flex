"use client";

/**
 * Satış Kotası kartının içindeki Recharts AreaChart — `next/dynamic` ile `ssr:false`
 * yüklenir, `recharts` sadece bu kart GERÇEKTEN render olunca client'a iner
 * (2026-07-28, code-splitting turu — bkz. `DonutRing.tsx` aynı gerekçe).
 */
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";

export default function KotaAreaChart({
  chartData, firstDay, lastDay, maxValue, compact,
}: {
  chartData: Array<{ day: number; gerceklesen: number }>;
  firstDay: number;
  lastDay: number;
  maxValue: number;
  compact: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 240, height: compact ? 72 : 96 }}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }} onContextMenu={(_, e) => e.preventDefault()}>
        <defs>
          <linearGradient id="kotaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6F74D8" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6F74D8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal vertical={false} stroke="#EEF0F3" />
        <XAxis
          dataKey="day"
          type="number"
          domain={[firstDay, lastDay]}
          ticks={[firstDay, lastDay]}
          tickFormatter={(d: number) => (d === firstDay ? "Ay başı" : "Bugün")}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10.5, fill: "#8E95A3", fontWeight: 600 }}
          tickMargin={6}
        />
        <YAxis hide domain={[0, maxValue]} />
        <Area
          type="monotone"
          dataKey="gerceklesen"
          stroke="#6F74D8"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="url(#kotaFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
