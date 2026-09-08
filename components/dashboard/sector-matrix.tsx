"use client";

import { useMemo, useState } from "react";
import type { HeatCell, SectorTile } from "@/lib/types";
import { Chg, EmaPills, Panel } from "@/components/dashboard/primitives";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const QUAD: Record<string, string> = {
  leading: "Leading",
  weakening: "Weakening",
  lagging: "Lagging",
  improving: "Improving",
};

export function SectorMatrix({
  sectors,
  heatmap,
}: {
  sectors: SectorTile[];
  heatmap: HeatCell[];
}) {
  const [sector, setSector] = useState<string | null>(sectors[0]?.name ?? null);
  const cells = heatmap.filter((h) => !sector || h.sector === sector);
  const points = useMemo(
    () =>
      sectors.map((s) => ({
        x: s.rs3m,
        y: s.rsMomentum,
        name: s.name,
        quadrant: s.quadrant,
      })),
    [sectors],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sectors.map((s) => {
          const up = s.changePct >= 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSector(s.name)}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                sector === s.name
                  ? "border-cyan-400/50 bg-card"
                  : "border-white/8 bg-card/70 hover:border-white/20",
                up ? "ring-1 ring-emerald-500/15" : "ring-1 ring-rose-500/15",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{s.name}</p>
                <Chg value={s.changePct} />
              </div>
              <p className="mt-1 font-mono text-lg tabular-nums">{inr(s.cmp, 0)}</p>
              <div className="mt-2 flex items-center justify-between">
                <EmaPills emas={s.emas} />
                <span className="text-[10px] text-muted-foreground">{QUAD[s.quadrant]}</span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                A/D {s.advances}/{s.declines} · CMF {s.cmf.toFixed(2)} · {s.turnoverShare}% turnover
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Panel className="xl:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              Sector constituents {sector ? `· ${sector}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">1D % heat · click a sector tile</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
            {cells.map((c) => (
              <div
                key={c.symbol}
                className={cn(
                  "rounded-md px-2 py-2",
                  c.changePct >= 1.5
                    ? "bg-emerald-500/80 text-emerald-50"
                    : c.changePct >= 0.4
                      ? "bg-emerald-500/40 text-emerald-50"
                      : c.changePct >= 0
                        ? "bg-emerald-500/20 text-emerald-100"
                        : c.changePct > -0.4
                          ? "bg-rose-500/20 text-rose-100"
                          : c.changePct > -1.5
                            ? "bg-rose-500/40 text-rose-50"
                            : "bg-rose-600/80 text-rose-50",
                )}
                title={`${c.name} RSI ${c.rsi}`}
              >
                <p className="truncate text-[11px] font-medium">{c.symbol}</p>
                <p className="font-mono text-[11px] tabular-nums">
                  {c.changePct >= 0 ? "+" : ""}
                  {c.changePct.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-2">
          <p className="text-sm font-medium">Sector rotation · 4 quadrants</p>
          <p className="mb-2 text-[11px] text-muted-foreground">
            X: 3M relative strength vs Nifty · Y: RS momentum
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" dataKey="x" name="RS 3M" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="RS mom" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <ReferenceLine x={0} stroke="#64748b" />
                <ReferenceLine y={0} stroke="#64748b" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
                  formatter={(v, name) => [Number(v).toFixed(2), String(name)]}
                  labelFormatter={(_, p) => (p?.[0]?.payload as { name?: string })?.name ?? ""}
                />
                <Scatter data={points} fill="#22d3ee" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
            <span>NW Improving</span>
            <span className="text-right">NE Leading</span>
            <span>SW Lagging</span>
            <span className="text-right">SE Weakening</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
