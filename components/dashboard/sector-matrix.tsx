"use client";

import { useMemo, useState } from "react";
import type { HeatCell, RotationQuadrant, SectorTile } from "@/lib/types";
import { Chg, EmaPills, Panel } from "@/components/dashboard/primitives";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const QUAD: Record<RotationQuadrant, string> = {
  leading: "Leading",
  weakening: "Weakening",
  lagging: "Lagging",
  improving: "Improving",
};

const QUAD_COLOR: Record<RotationQuadrant, string> = {
  leading: "#34d399",
  improving: "#22d3ee",
  weakening: "#fbbf24",
  lagging: "#fb7185",
};

const QUADS: RotationQuadrant[] = ["leading", "improving", "weakening", "lagging"];

type Point = {
  x: number;
  y: number;
  name: string;
  quadrant: RotationQuadrant;
  nudge: number;
};

function SectorDot(color: string) {
  return function Shape(props: { cx?: number; cy?: number; payload?: Point }) {
    const { cx = 0, cy = 0, payload } = props;
    const name = payload?.name ?? "";
    const goLeft = (payload?.x ?? 0) < 0;
    const tx = goLeft ? cx - 11 : cx + 11;
    const ty = cy + 4 + (payload?.nudge ?? 0);
    return (
      <g>
        <circle cx={cx} cy={cy} r={7.5} fill={color} stroke="#070b14" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3} fill="#070b14" opacity={0.35} />
        <text
          x={tx}
          y={ty}
          textAnchor={goLeft ? "end" : "start"}
          fill="#f8fafc"
          fontSize={12}
          fontWeight={600}
          stroke="#070b14"
          strokeWidth={3.5}
          paintOrder="stroke"
          style={{ pointerEvents: "none" }}
        >
          {name}
        </text>
      </g>
    );
  };
}

function nudgeLabels(raw: Omit<Point, "nudge">[]): Point[] {
  const sorted = [...raw].sort((a, b) => b.y - a.y || a.x - b.x);
  const placed: Point[] = [];
  for (const p of sorted) {
    let nudge = 0;
    for (const other of placed) {
      const sameSide = (p.x < 0) === (other.x < 0);
      if (!sameSide) continue;
      const closeX = Math.abs(p.x - other.x) < 4.5;
      const closeY = Math.abs(p.y + nudge / 18 - other.y - other.nudge / 18) < 1.4;
      if (closeX && closeY) nudge += p.y >= other.y ? -14 : 14;
    }
    placed.push({ ...p, nudge });
  }
  const byName = new Map(placed.map((p) => [p.name, p]));
  return raw.map((p) => byName.get(p.name) ?? { ...p, nudge: 0 });
}

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
      nudgeLabels(
        sectors.map((s) => ({
          x: s.rs3m,
          y: s.rsMomentum,
          name: s.name,
          quadrant: s.quadrant,
        })),
      ),
    [sectors],
  );
  const span = useMemo(() => {
    const xs = points.map((p) => Math.abs(p.x));
    const ys = points.map((p) => Math.abs(p.y));
    const x = Math.max(4, ...(xs.length ? xs : [4])) * 1.35;
    const y = Math.max(2, ...(ys.length ? ys : [2])) * 1.4;
    return { xMin: -x, xMax: x, yMin: -y, yMax: y };
  }, [points]);

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
                <p className="inline-flex items-center gap-2 text-sm font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: QUAD_COLOR[s.quadrant] }} />
                  {s.name}
                </p>
                <Chg value={s.changePct} />
              </div>
              <p className="mt-1 font-mono text-lg tabular-nums">{inr(s.cmp, 0)}</p>
              <div className="mt-2 flex items-center justify-between">
                <EmaPills emas={s.emas} />
                <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: QUAD_COLOR[s.quadrant] }}>
                  {QUAD[s.quadrant]}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                A/D {s.advances}/{s.declines} · CMF {s.cmf.toFixed(2)} · {s.turnoverShare}% turnover
              </p>
            </button>
          );
        })}
      </div>

      <Panel>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium">Sector rotation · four coloured quadrants</p>
            <p className="text-[11px] text-muted-foreground">
              Each coloured dot is a sector, labelled by name. X = 3-month RS vs Nifty · Y = RS momentum
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-[12px]">
            {QUADS.map((q) => (
              <span key={q} className="inline-flex items-center gap-1.5 font-medium" style={{ color: QUAD_COLOR[q] }}>
                <span className="size-2.5 rounded-full" style={{ background: QUAD_COLOR[q] }} />
                {QUAD[q]}
              </span>
            ))}
          </div>
        </div>
        <div className="h-[28rem]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 28, right: 120, left: 48, bottom: 28 }}>
              <ReferenceArea
                x1={0}
                x2={span.xMax}
                y1={0}
                y2={span.yMax}
                fill={QUAD_COLOR.leading}
                fillOpacity={0.22}
                label={{ value: "Leading", fill: QUAD_COLOR.leading, position: "insideTopRight", fontSize: 13, fontWeight: 700 }}
              />
              <ReferenceArea
                x1={span.xMin}
                x2={0}
                y1={0}
                y2={span.yMax}
                fill={QUAD_COLOR.improving}
                fillOpacity={0.2}
                label={{ value: "Improving", fill: QUAD_COLOR.improving, position: "insideTopLeft", fontSize: 13, fontWeight: 700 }}
              />
              <ReferenceArea
                x1={span.xMin}
                x2={0}
                y1={span.yMin}
                y2={0}
                fill={QUAD_COLOR.lagging}
                fillOpacity={0.2}
                label={{ value: "Lagging", fill: QUAD_COLOR.lagging, position: "insideBottomLeft", fontSize: 13, fontWeight: 700 }}
              />
              <ReferenceArea
                x1={0}
                x2={span.xMax}
                y1={span.yMin}
                y2={0}
                fill={QUAD_COLOR.weakening}
                fillOpacity={0.2}
                label={{ value: "Weakening", fill: QUAD_COLOR.weakening, position: "insideBottomRight", fontSize: 13, fontWeight: 700 }}
              />
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis
                type="number"
                dataKey="x"
                name="RS 3M"
                domain={[span.xMin, span.xMax]}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                label={{ value: "3M RS vs Nifty →", position: "insideBottom", offset: -18, fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="RS mom"
                domain={[span.yMin, span.yMax]}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                label={{ value: "RS momentum →", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
              />
              <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1.2} />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
                formatter={(v, name) => [Number(v).toFixed(2), String(name)]}
                labelFormatter={(_, p) => {
                  const row = p?.[0]?.payload as Point | undefined;
                  return row?.name ? `${row.name} · ${QUAD[row.quadrant]}` : "";
                }}
              />
              {QUADS.map((q) => (
                <Scatter
                  key={q}
                  name={QUAD[q]}
                  data={points.filter((p) => p.quadrant === q)}
                  fill={QUAD_COLOR[q]}
                  shape={SectorDot(QUAD_COLOR[q])}
                  isAnimationActive={false}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/8 pt-3">
          {points.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setSector(p.name)}
              className="inline-flex items-center gap-1.5 text-[12px] hover:text-white"
            >
              <span className="size-2.5 rounded-full" style={{ background: QUAD_COLOR[p.quadrant] }} />
              <span className={cn(sector === p.name && "text-white underline decoration-white/30 underline-offset-2")}>
                {p.name}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">
            Sector constituents {sector ? `· ${sector}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground">1D % heat · click a sector tile or a named dot</p>
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
    </div>
  );
}
