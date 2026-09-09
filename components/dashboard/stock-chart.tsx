"use client";

import type { ChartPoint, EmaStatus } from "@/lib/types";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function StockChart({
  points,
  emas,
}: {
  points: ChartPoint[];
  emas: EmaStatus[];
}) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">Not enough bars to chart.</p>;
  }
  const ema20 = emas.find((e) => e.period === 20)?.value;
  const data = points.map((p) => ({
    ...p,
    ema20,
  }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis yAxisId="p" hide domain={["auto", "auto"]} />
          <YAxis yAxisId="v" orientation="right" hide />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Bar yAxisId="v" dataKey="volume" fill="rgba(34,211,238,0.25)" />
          <Line yAxisId="p" type="monotone" dataKey="close" stroke="#e2e8f8" dot={false} strokeWidth={1.6} />
          <Line yAxisId="p" type="monotone" dataKey="ema20" stroke="#22d3ee" dot={false} strokeWidth={1} strokeDasharray="4 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
