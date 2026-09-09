"use client";

import { useMemo, useState } from "react";
import type { HeatCell, RotationQuadrant, SectorTile } from "@/lib/types";
import { Chg, Panel } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";
import { ChartFit } from "@/components/dashboard/chart-fit";
import { LayoutList } from "lucide-react";
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

function rotationScore(s: SectorTile): number {
  const names = Math.max(1, s.advances + s.declines);
  const breadth = ((s.advances - s.declines) / names) * 40;
  const flow = Math.max(-25, Math.min(25, s.cmf * 80));
  const session = Math.max(-25, Math.min(25, s.changePct * 5));
  const mom = Math.max(-20, Math.min(20, s.rsMomentum));
  const weight = Math.max(0, Math.min(15, s.turnoverShare * 0.4));
  return breadth + flow + session + mom + weight;
}

function SectorDot(color: string, onPick: (name: string) => void) {
  return function Shape(props: { cx?: number; cy?: number; payload?: Point }) {
    const { cx = 0, cy = 0, payload } = props;
    const name = payload?.name ?? "";
    const goLeft = (payload?.x ?? 0) < 0;
    const tx = goLeft ? cx - 11 : cx + 11;
    const ty = cy + 4 + (payload?.nudge ?? 0);
    return (
      <g
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          if (name) onPick(name);
        }}
      >
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

function heatTone(chg: number) {
  if (chg >= 1.5) return "bg-emerald-500/80 text-emerald-50";
  if (chg >= 0.4) return "bg-emerald-500/40 text-emerald-50";
  if (chg >= 0) return "bg-emerald-500/20 text-emerald-100";
  if (chg > -0.4) return "bg-rose-500/20 text-rose-100";
  if (chg > -1.5) return "bg-rose-500/40 text-rose-50";
  return "bg-rose-600/80 text-rose-50";
}

export function SectorMatrix({
  sectors,
  heatmap,
  compact = false,
  heading = true,
  onOpen,
}: {
  sectors: SectorTile[];
  heatmap: HeatCell[];
  compact?: boolean;
  heading?: boolean;
  onOpen?: (symbol: string) => void;
}) {
  const ranked = useMemo(
    () =>
      sectors
        .filter((s) => s.constituents.length)
        .map((s) => ({ ...s, score: rotationScore(s) }))
        .sort((a, b) => b.score - a.score),
    [sectors],
  );
  const [sector, setSector] = useState<string | null>(ranked[0]?.name ?? sectors[0]?.name ?? null);
  const cells = heatmap
    .filter((h) => !sector || h.sector === sector)
    .sort((a, b) => b.changePct - a.changePct);
  const points = useMemo(
    () =>
      nudgeLabels(
        ranked.map((s) => ({
          x: s.rs3m,
          y: s.rsMomentum,
          name: s.name,
          quadrant: s.quadrant,
        })),
      ),
    [ranked],
  );
  const span = useMemo(() => {
    const xs = points.map((p) => Math.abs(p.x));
    const ys = points.map((p) => Math.abs(p.y));
    const x = Math.max(4, ...(xs.length ? xs : [4])) * 1.35;
    const y = Math.max(2, ...(ys.length ? ys : [2])) * 1.4;
    return { xMin: -x, xMax: x, yMin: -y, yMax: y };
  }, [points]);

  return (
    <div className={cn("space-y-3", compact && "-m-1")}>
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5">
          <LayoutList className="size-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          {heading ? (
            <h3 className="text-[13px] font-semibold tracking-tight text-white">Sector rotation</h3>
          ) : null}
          <p className="text-[12px] leading-snug text-slate-400">
            Sector ranking, turnover share, advance/decline flow, and Chaikin Money Flow — to see where strength is rotating.
          </p>
        </div>
      </div>

      <div className="max-h-[240px] overflow-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead className="sticky top-0 bg-[#152033] text-[10px] tracking-wide text-slate-400 uppercase">
            <tr>
              <th className="px-2 py-1.5 font-medium">#</th>
              <th className="px-2 py-1.5 font-medium">Sector</th>
              <th className="px-2 py-1.5 font-medium text-right">Close %</th>
              <th className="px-2 py-1.5 font-medium text-right">A/D</th>
              <th className="px-2 py-1.5 font-medium text-right">Turn %</th>
              <th className="px-2 py-1.5 font-medium text-right">CMF</th>
              <th className="px-2 py-1.5 font-medium">Quad</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s, i) => {
              const ad = s.advances + s.declines;
              const selected = sector === s.name;
              return (
                <tr
                  key={s.id}
                  className={cn(
                    "cursor-pointer border-t border-white/8",
                    selected ? "bg-cyan-400/10" : "hover:bg-white/5",
                  )}
                  onClick={() => setSector(s.name)}
                >
                  <td className="px-2 py-1.5 font-mono text-slate-500 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-1.5 font-medium text-white">{s.name}</td>
                  <td className="px-2 py-1.5 text-right">
                    <Chg value={s.changePct} />
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right font-mono tabular-nums",
                      s.advances >= s.declines ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {s.advances}/{s.declines}
                    <span className="ml-1 text-[10px] text-slate-500">
                      {ad ? `${Math.round((s.advances / ad) * 100)}%` : ""}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-200 tabular-nums">
                    {s.turnoverShare.toFixed(1)}%
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right font-mono tabular-nums",
                      s.cmf >= 0 ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {s.cmf >= 0 ? "+" : ""}
                    {s.cmf.toFixed(3)}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5" style={{ color: QUAD_COLOR[s.quadrant] }}>
                      <span className="size-1.5 rounded-full" style={{ background: QUAD_COLOR[s.quadrant] }} />
                      {QUAD[s.quadrant]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="text-[12px] font-medium text-white">
            {sector ? `${sector} closes` : "Stock closes"}
            <span className="ml-1.5 font-normal text-slate-500">1D % above / below previous close</span>
          </p>
          <p className="text-[11px] text-slate-500">{cells.length} names</p>
        </div>
        <div className={cn("grid gap-1 overflow-auto", compact ? "max-h-[168px] grid-cols-3 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 xl:grid-cols-5")}>
          {cells.map((c) => {
            const up = c.changePct >= 0;
            return (
              <button
                key={c.symbol}
                type="button"
                onClick={() => onOpen?.(c.symbol)}
                className={cn("rounded-md px-1.5 py-1.5 text-left", heatTone(c.changePct))}
                title={`${c.name} ${up ? "+" : ""}${c.changePct.toFixed(2)}%`}
              >
                <p className="truncate font-mono text-[11px] font-semibold">{c.symbol}</p>
                <p className="font-mono text-[12px] font-medium tabular-nums">
                  {up ? "+" : ""}
                  {c.changePct.toFixed(2)}%
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {compact ? null : (
        <Panel>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium">Relative-strength map</p>
              <p className="text-[11px] text-muted-foreground">
                X = 3-month RS vs Nifty · Y = RS momentum. Click a dot to load constituents.
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
          <div className="h-80">
            <ChartFit className="h-full w-full">
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
                      shape={SectorDot(QUAD_COLOR[q], setSector)}
                      isAnimationActive={false}
                      onClick={(item) => {
                        const name = (item as { payload?: Point } | undefined)?.payload?.name;
                        if (name) setSector(name);
                      }}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </ChartFit>
          </div>
        </Panel>
      )}
    </div>
  );
}
