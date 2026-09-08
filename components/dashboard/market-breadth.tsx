"use client";

import type { MarketBreadth, TrendFilters } from "@/lib/types";
import { Panel } from "@/components/dashboard/primitives";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CARDS: { key: keyof Omit<MarketBreadth, "history" | "advancing" | "declining" | "unchanged" | "adRatio">; label: string; unit: string }[] = [
  { key: "ema10", label: "EMA 10 participation", unit: "%" },
  { key: "ema20", label: "EMA 20 participation", unit: "%" },
  { key: "ema50", label: "EMA 50 participation", unit: "%" },
  { key: "ema200", label: "EMA 200 participation", unit: "%" },
  { key: "rsiStrength", label: "RSI strength (>50)", unit: "%" },
  { key: "pivotPosture", label: "Pivot posture", unit: "%" },
];

export function BreadthSection({
  breadth,
  trend,
}: {
  breadth: MarketBreadth;
  trend: TrendFilters;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <p className="text-xs text-muted-foreground">Advance / Decline</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">
            {breadth.advancing}
            <span className="text-muted-foreground"> / </span>
            {breadth.declining}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Ratio {breadth.adRatio} · {breadth.unchanged} unchanged
          </p>
        </Panel>
        {CARDS.slice(0, 3).map((c) => (
          <Panel key={c.key}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-mono text-2xl tabular-nums">{breadth[c.key]}{c.unit}</p>
          </Panel>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel className="h-64">
          <p className="mb-2 text-sm">Advance-decline line</p>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={breadth.history}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
              <Line dataKey="adLine" stroke="#22d3ee" dot={false} strokeWidth={1.6} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel className="h-64">
          <p className="mb-2 text-sm">EMA participation · RSI · pivots</p>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={breadth.history}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
              <Line dataKey="ema10" stroke="#34d399" dot={false} />
              <Line dataKey="ema20" stroke="#22d3ee" dot={false} />
              <Line dataKey="ema50" stroke="#fbbf24" dot={false} />
              <Line dataKey="ema200" stroke="#fb7185" dot={false} />
              <Line dataKey="rsiStrength" stroke="#a78bfa" dot={false} />
              <Line dataKey="pivotPosture" stroke="#e2e8f0" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Mini label="EMA stack bullish" value={trend.emaStackBullish} />
        <Mini label="EMA stack bearish" value={trend.emaStackBearish} />
        <Mini label="Converging EMAs" value={trend.converging} />
        <Mini label="Bullish 10/20 crosses" value={trend.bullishCrosses} />
        <Mini label="RSI above its MA" value={trend.rsiAboveMa} />
        <Mini label="Weekly stack bullish" value={trend.weeklyStackBullish} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <Panel className="py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-xl tabular-nums">{value}</p>
    </Panel>
  );
}
