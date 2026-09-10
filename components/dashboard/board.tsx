"use client";

import { useEffect, useState } from "react";
import type {
  BreadthCircle,
  DashboardSnapshot,
  DerivativesRadar,
  DeskAlert,
  IndexTile,
  PatternHit,
  StockRow,
} from "@/lib/types";
import { PATTERN_LABEL, compact, fmtDate, inr, signed, SWING_STATUS } from "@/lib/format";
import { Chg, EmaPills, Sparkline } from "@/components/dashboard/primitives";
import { SectorMatrix } from "@/components/dashboard/sector-matrix";
import { UniverseTable } from "@/components/dashboard/universe-table";
import { DeskErrorBoundary } from "@/components/dashboard/error-boundary";
import { StockFoList } from "@/components/dashboard/stock-fo";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bell,
  CalendarDays,
  ChartColumnIncreasing,
  ChevronsUpDown,
  Gauge,
  LayoutGrid,
  LayoutList,
  Landmark,
  Layers,
  Percent,
  Table2,
  TrendingUp,
} from "lucide-react";

function Pane({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex min-h-full min-w-0 flex-1 flex-col rounded-xl border border-white/10 bg-[#121b2c]",
        className,
      )}
    >
      <h2 className="shrink-0 border-b border-white/8 px-3 py-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
        {title}
      </h2>
      <div className="p-3 pb-8">{children}</div>
    </section>
  );
}

export function WatchStrip({ data }: { data: DashboardSnapshot }) {
  const nifty = data.indices.find((i) => i.id === "nifty");
  const nifty500 = data.indices.find((i) => i.id === "nifty500");
  const bank = data.indices.find((i) => i.id === "banknifty");
  const lead =
    data.universe === "nifty500" && nifty500
      ? { k: "Nifty 500", v: inr(nifty500.cmp, 2), chg: nifty500.changePct, spark: nifty500.spark }
      : nifty
        ? { k: "Nifty 50", v: inr(nifty.cmp, 2), chg: nifty.changePct, spark: nifty.spark }
        : null;
  const cards = [
    lead,
    bank ? { k: "Bank Nifty", v: inr(bank.cmp, 2), chg: bank.changePct, spark: bank.spark } : null,
    data.universe === "nifty500" && nifty
      ? { k: "Nifty 50", v: inr(nifty.cmp, 2), chg: nifty.changePct, spark: nifty.spark }
      : nifty500
        ? { k: "Nifty 500", v: inr(nifty500.cmp, 2), chg: nifty500.changePct, spark: nifty500.spark }
        : null,
    { k: "India VIX", v: data.derivatives.indiaVix.toFixed(2), chg: data.derivatives.indiaVixChangePct },
    { k: "Nifty PCR", v: data.derivatives.niftyPcr.toFixed(2), chg: null as number | null },
    {
      k: "Advance / Decline",
      v: `${data.breadth.advancing} / ${data.breadth.declining}`,
      chg: data.breadth.adRatio >= 1 ? 1 : -1,
    },
    { k: "FII net", v: `${compact(data.derivatives.fiiNet)} cr`, chg: data.derivatives.fiiNet },
  ].filter(Boolean) as { k: string; v: string; chg: number | null; spark?: number[] }[];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => {
        const up = (c.chg ?? 0) >= 0;
        return (
          <div
            key={c.k}
            className={cn(
              "rounded-xl border border-white/10 bg-[#121b2c] px-3 py-2.5",
              c.chg === null ? "" : up ? "shadow-[inset_3px_0_0_#34d399]" : "shadow-[inset_3px_0_0_#fb7185]",
            )}
          >
            <p className="text-[11px] text-slate-400">{c.k}</p>
            <p className="mt-0.5 font-mono text-xl tracking-tight text-white tabular-nums">{c.v}</p>
            {c.spark && c.spark.length > 1 ? (
              <Sparkline values={c.spark} width={88} height={22} markLast />
            ) : null}
            {c.chg !== null && c.k !== "Advance / Decline" && c.k !== "FII net" ? (
              <Chg value={c.chg} />
            ) : c.k === "FII net" && c.chg !== null ? (
              <span className={cn("font-mono text-sm tabular-nums", up ? "text-emerald-400" : "text-rose-400")}>
                {signed(c.chg, 0)} cr
              </span>
            ) : c.k === "Advance / Decline" ? (
              <span className={cn("text-sm", up ? "text-emerald-400" : "text-rose-400")}>
                ratio {data.breadth.adRatio}
              </span>
            ) : (
              <p className="text-sm text-slate-500">spot vs pain {signed(data.derivatives.maxPainDistancePct)}%</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IndexList({ tiles }: { tiles: IndexTile[] }) {
  return (
    <div className="divide-y divide-white/6">
      {tiles.map((t) => (
        <div key={t.id} className="flex items-center gap-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{t.name}</p>
            <EmaPills emas={t.emas} />
          </div>
          <Sparkline values={t.spark ?? []} width={72} height={24} markLast />
          <div className="text-right">
            <p className="font-mono text-[15px] text-white tabular-nums">{inr(t.cmp, 2)}</p>
            <Chg value={t.changePct} />
            {t.asOf ? <p className="font-mono text-[10px] text-slate-500 tabular-nums">{t.asOf}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function heat(chg: number) {
  if (chg >= 2) return "bg-emerald-500 text-emerald-50";
  if (chg >= 0.5) return "bg-emerald-500/70 text-white";
  if (chg >= 0) return "bg-emerald-500/25 text-emerald-100";
  if (chg > -0.5) return "bg-rose-500/25 text-rose-100";
  if (chg > -2) return "bg-rose-500/70 text-white";
  return "bg-rose-600 text-white";
}

function CloseTape({ rows, onOpen }: { rows: StockRow[]; onOpen: (s: string) => void }) {
  const sorted = [...rows].sort((a, b) => b.change1d - a.change1d);
  return (
    <div id="close-tape" className="min-w-0">
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_5rem_6.5rem] gap-x-2 bg-[#152033] px-1 py-2 text-[11px] tracking-wide text-slate-400 uppercase">
        <div className="font-medium">Stock</div>
        <div className="text-right font-medium">1D %</div>
        <div className="text-right font-medium">Price</div>
      </div>
      {sorted.map((r) => (
        <button
          key={r.symbol}
          type="button"
          className="grid w-full grid-cols-[minmax(0,1fr)_5rem_6.5rem] gap-x-2 border-t border-white/8 px-1 py-2 text-left hover:bg-white/5"
          onClick={() => onOpen(r.symbol)}
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold text-white">{r.symbol}</p>
            <p className="truncate text-[11px] text-slate-500">{r.name}</p>
          </div>
          <div className="flex items-center justify-end whitespace-nowrap">
            <Chg value={r.change1d} icon={false} size="md" />
          </div>
          <p className="self-center text-right font-mono text-[15px] text-white tabular-nums">{inr(r.cmp)}</p>
        </button>
      ))}
    </div>
  );
}

function ScanList({
  rows,
  onOpen,
  metricLabel,
  metric,
}: {
  rows: StockRow[];
  onOpen: (s: string) => void;
  metricLabel: string;
  metric: (r: StockRow) => React.ReactNode;
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">Nothing in this cut.</p>;
  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_7.5rem_5rem] gap-x-2 bg-[#152033] px-1 py-2 text-[11px] tracking-wide text-slate-400 uppercase">
        <div className="font-medium">Stock</div>
        <div className="text-right font-medium">{metricLabel}</div>
        <div className="text-right font-medium">1D %</div>
      </div>
      {rows.map((r) => (
        <button
          key={r.symbol}
          type="button"
          className="grid w-full grid-cols-[minmax(0,1fr)_7.5rem_5rem] gap-x-2 border-t border-white/8 px-1 py-2 text-left hover:bg-white/5"
          onClick={() => onOpen(r.symbol)}
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold text-white">{r.symbol}</p>
            <p className="truncate text-[11px] text-slate-500">{r.name}</p>
          </div>
          <div className="flex items-center justify-end text-right">{metric(r)}</div>
          <div className="flex items-center justify-end">
            <Chg value={r.change1d} icon={false} size="md" />
          </div>
        </button>
      ))}
    </div>
  );
}

function VolumeTool({ rows, onOpen }: { rows: StockRow[]; onOpen: (s: string) => void }) {
  const sorted = [...rows].sort((a, b) => b.volSpike - a.volSpike);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">Volume versus the 20-day average. Highest spike first.</p>
      <ScanList
        rows={sorted}
        onOpen={onOpen}
        metricLabel="Vol x"
        metric={(r) => (
          <span className="font-mono text-[13px] text-cyan-300 tabular-nums">
            {r.volSpike.toFixed(2)}x
            <span className="mt-0.5 block text-[11px] text-slate-500">{compact(r.volume)}</span>
          </span>
        )}
      />
    </div>
  );
}

function RsiTool({ rows, onOpen }: { rows: StockRow[]; onOpen: (s: string) => void }) {
  const oversold = [...rows].filter((r) => r.rsi <= 40).sort((a, b) => a.rsi - b.rsi);
  const overbought = [...rows].filter((r) => r.rsi >= 60).sort((a, b) => b.rsi - a.rsi);
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] text-slate-500">Oversold · RSI 40 or below</p>
        <ScanList
          rows={oversold}
          onOpen={onOpen}
          metricLabel="RSI"
          metric={(r) => <span className="font-mono text-[13px] text-lime-300 tabular-nums">{r.rsi.toFixed(1)}</span>}
        />
      </div>
      <div>
        <p className="mb-2 text-[11px] text-slate-500">Overbought · RSI 60 or above</p>
        <ScanList
          rows={overbought}
          onOpen={onOpen}
          metricLabel="RSI"
          metric={(r) => <span className="font-mono text-[13px] text-rose-300 tabular-nums">{r.rsi.toFixed(1)}</span>}
        />
      </div>
    </div>
  );
}

function EarningsTool({ rows, onOpen }: { rows: StockRow[]; onOpen: (s: string) => void }) {
  const upcoming = [...rows]
    .filter((r) => r.daysToEarnings != null)
    .sort((a, b) => (a.daysToEarnings ?? 99) - (b.daysToEarnings ?? 99));
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">Next result date on this universe, nearest first.</p>
      <ScanList
        rows={upcoming}
        onOpen={onOpen}
        metricLabel="In"
        metric={(r) => (
          <span className="font-mono text-[13px] text-sky-200 tabular-nums">
            {r.daysToEarnings === 0 ? "today" : `${r.daysToEarnings}d`}
            <span className="mt-0.5 block text-[11px] text-slate-500">{fmtDate(r.nextEarningDate)}</span>
          </span>
        )}
      />
    </div>
  );
}

function GapsTool({ rows, onOpen }: { rows: StockRow[]; onOpen: (s: string) => void }) {
  const up = [...rows].filter((r) => r.gapPct > 0).sort((a, b) => b.gapPct - a.gapPct);
  const down = [...rows].filter((r) => r.gapPct < 0).sort((a, b) => a.gapPct - b.gapPct);
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] text-slate-500">Gap up versus prior close</p>
        <ScanList
          rows={up}
          onOpen={onOpen}
          metricLabel="Gap"
          metric={(r) => <Chg value={r.gapPct} icon={false} size="md" />}
        />
      </div>
      <div>
        <p className="mb-2 text-[11px] text-slate-500">Gap down versus prior close</p>
        <ScanList
          rows={down}
          onOpen={onOpen}
          metricLabel="Gap"
          metric={(r) => <Chg value={r.gapPct} icon={false} size="md" />}
        />
      </div>
    </div>
  );
}

function Mosaic({ rows, onOpen }: { rows: StockRow[]; onOpen: (s: string) => void }) {
  const tape = rows;
  const dense = tape.length > 80;
  return (
    <div className={cn("grid gap-1", dense ? "grid-cols-8 sm:grid-cols-10" : "grid-cols-5")}>
      {tape.map((r) => (
        <button
          key={r.symbol}
          type="button"
          id={`mosaic-${r.symbol}`}
          onClick={() => onOpen(r.symbol)}
          className={cn("rounded-md px-1 text-left", dense ? "py-1" : "py-1.5", heat(r.change1d))}
          title={`${r.name} ${signed(r.change1d)}%`}
        >
          <p className={cn("truncate font-mono font-semibold", dense ? "text-[10px]" : "text-[11px]")}>{r.symbol}</p>
          <p className={cn("font-mono font-medium tabular-nums", dense ? "text-[10px]" : "text-[11px]")}>
            {signed(r.change1d)}%
          </p>
        </button>
      ))}
    </div>
  );
}

function MoveCol({
  title,
  rows,
  onOpen,
  metric,
}: {
  title: string;
  rows: StockRow[];
  onOpen: (s: string) => void;
  metric: (r: StockRow) => React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-slate-400">{title}</p>
      {rows.map((r) => (
        <button
          key={r.symbol}
          type="button"
          onClick={() => onOpen(r.symbol)}
          className="flex w-full items-center justify-between gap-2 rounded-md py-0.5 text-left hover:bg-white/5"
        >
          <span className="truncate text-[13px] text-white">{r.symbol}</span>
          {metric(r)}
        </button>
      ))}
    </div>
  );
}

function AlertList({ alerts, onPick }: { alerts: DeskAlert[]; onPick: (s: string) => void }) {
  if (!alerts.length) return <p className="text-sm text-slate-500">Quiet tape.</p>;
  return (
    <div className="space-y-1.5">
      {alerts.slice(0, 5).map((a) => (
        <button
          key={a.id}
          type="button"
          id={a.symbol ? `alert-${a.symbol}` : undefined}
          onClick={() => a.symbol && onPick(a.symbol)}
          className={cn(
            "w-full rounded-lg border px-2.5 py-2 text-left",
            a.tone === "warn" && "border-amber-400/35 bg-amber-500/10",
            a.tone === "setup" && "border-sky-400/35 bg-sky-500/10",
            a.tone === "info" && "border-white/10 bg-white/4",
          )}
        >
          <p className="text-[13px] font-medium text-white">{a.title}</p>
          <p className="line-clamp-2 text-[12px] text-slate-400">{a.detail}</p>
        </button>
      ))}
    </div>
  );
}

function SetupList({ hits, onPick }: { hits: PatternHit[]; onPick: (s: string) => void }) {
  if (!hits.length) return <p className="text-sm text-slate-500">No qualified setups.</p>;
    const swingRank = (h: PatternHit) =>
      h.swing?.status === "triggered" ? 0 :
      h.swing?.status === "throwback" ? 1 :
      h.swing?.status === "at_pivot" ? 2 :
      h.swing?.status === "coiling" ? 3 :
      4;
    const swing = hits
      .filter((h) => h.kind === "vcp" || h.kind === "breakout")
      .sort((a, b) => swingRank(a) - swingRank(b) || b.score - a.score);
    const rest = hits.filter((h) => h.kind !== "vcp" && h.kind !== "breakout");
  const ordered = [...swing, ...rest].slice(0, 12);
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] leading-snug text-slate-500">
        VCP: tighter pullbacks, buy stop above the last pivot. Breakout: 55d high, volume, stop under the handle. Click a name for legs, 1R/2R and the checklist.
      </p>
      {ordered.map((h) => (
        <button
          key={`${h.symbol}-${h.kind}`}
          type="button"
          id={`setup-${h.kind}-${h.symbol}`}
          onClick={() => onPick(h.symbol)}
          className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left hover:bg-white/5"
        >
          <span className="w-[76px] shrink-0 truncate text-[13px] font-medium text-white">{h.symbol}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-slate-200">{PATTERN_LABEL[h.kind]}</span>
            <span className="block truncate text-[11px] text-slate-500">
              {h.swing
                ? `${SWING_STATUS[h.swing.status] ?? h.swing.status} · buy ${inr(h.swing.entry, 0)} · stop ${inr(h.swing.stop, 0)} · ${h.swing.rr.toFixed(1)}R`
                : h.detail}
            </span>
            {h.swing ? (
              <span className="mt-0.5 block line-clamp-2 text-[11px] text-slate-400">{h.swing.nextAction}</span>
            ) : null}
          </span>
          <Chg value={h.change1d} />
        </button>
      ))}
    </div>
  );
}

function FoWatch({
  data,
  stocks,
  onOpen,
}: {
  data: DerivativesRadar;
  stocks: StockRow[];
  onOpen: (s: string) => void;
}) {
  const maxOi = Math.max(1, ...(data.ladder ?? []).map((s) => Math.max(s.callOi, s.putOi)));
  const rows = (data.ladder ?? []).slice(0, 7);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[11px] text-slate-400">Max pain</p>
          <p className="font-mono tabular-nums text-white">{inr(data.maxPain, 0)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Nifty PCR</p>
          <p className="font-mono tabular-nums text-white">{data.niftyPcr.toFixed(2)}</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Call wall {inr(data.callWall, 0)} · put wall {inr(data.putWall, 0)}
      </p>
      <div className="space-y-0.5">
        {rows.map((s) => {
          const atm = Math.abs(s.strike - data.spot) <= 25;
          return (
            <div
              key={s.strike}
              className={cn("grid grid-cols-[1fr_52px_1fr] items-center gap-1 text-[11px]", atm && "rounded bg-sky-400/10")}
            >
              <div className="h-1.5 overflow-hidden rounded bg-white/10">
                <div className="ml-auto h-full bg-rose-400" style={{ width: `${(s.callOi / maxOi) * 100}%` }} />
              </div>
              <span className={cn("text-center font-mono tabular-nums", atm && "text-sky-200")}>{inr(s.strike, 0)}</span>
              <div className="h-1.5 overflow-hidden rounded bg-white/10">
                <div className="h-full bg-emerald-400" style={{ width: `${(s.putOi / maxOi) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <StockFoList rows={stocks} onOpen={onOpen} />
    </div>
  );
}

function BreadthBars({ gauges }: { gauges: BreadthCircle[] }) {
  return (
    <div className="space-y-2">
      {gauges.map((g) => (
        <div key={g.period}>
          <div className="mb-0.5 flex justify-between text-[12px]">
            <span className="text-slate-400">{g.label}</span>
            <span className="font-mono text-white tabular-nums">{g.daily.toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full", g.daily >= 55 ? "bg-emerald-400" : g.daily >= 40 ? "bg-amber-400" : "bg-rose-400")}
              style={{ width: `${Math.min(100, g.daily)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type DeskPane =
  | "closes"
  | "universe"
  | "heat"
  | "sectors"
  | "indices"
  | "volume"
  | "rsi"
  | "earnings"
  | "gaps"
  | "alerts"
  | "swings"
  | "fno"
  | "breadth";

const DESK_NAV: {
  id: DeskPane;
  label: string;
  hint: string;
  Icon: typeof Percent;
}[] = [
  { id: "closes", label: "Closes", hint: "Price & 1D %", Icon: Percent },
  { id: "universe", label: "Universe", hint: "Full tape", Icon: Table2 },
  { id: "heat", label: "Heat", hint: "1D mosaic", Icon: LayoutGrid },
  { id: "sectors", label: "Sectors", hint: "Rotation", Icon: LayoutList },
  { id: "indices", label: "Indices", hint: "Top tiles", Icon: Landmark },
  { id: "volume", label: "Volume", hint: "Vol spike", Icon: ChartColumnIncreasing },
  { id: "rsi", label: "RSI", hint: "OB / OS", Icon: Gauge },
  { id: "earnings", label: "Earnings", hint: "Next result", Icon: CalendarDays },
  { id: "gaps", label: "Gaps", hint: "Open vs close", Icon: ChevronsUpDown },
  { id: "alerts", label: "Alerts", hint: "Desk flags", Icon: Bell },
  { id: "swings", label: "Swings", hint: "VCP / BO", Icon: TrendingUp },
  { id: "fno", label: "F&O", hint: "OI & PCR", Icon: Layers },
  { id: "breadth", label: "Breadth", hint: "EMA %", Icon: Activity },
];

function readDeskPane(): DeskPane {
  try {
    const saved = localStorage.getItem("imd-desk-pane");
    if (DESK_NAV.some((n) => n.id === saved)) return saved as DeskPane;
  } catch {
    // ignore
  }
  return "closes";
}

export function DeskBoard({
  data,
  watch,
  onToggleWatch,
  onOpen,
}: {
  data: DashboardSnapshot;
  watch: Set<string>;
  onToggleWatch: (symbol: string) => void;
  onOpen: (symbol: string) => void;
}) {
  const [pane, setPane] = useState<DeskPane>("closes");
  const gainers = [...data.stocks].sort((a, b) => b.change1d - a.change1d).slice(0, 5);
  const losers = [...data.stocks].sort((a, b) => a.change1d - b.change1d).slice(0, 5);
  const active = DESK_NAV.find((n) => n.id === pane) ?? DESK_NAV[0];

  useEffect(() => {
    setPane(readDeskPane());
  }, []);

  const pick = (id: DeskPane) => {
    setPane(id);
    document.getElementById("desk-scroll")?.scrollTo({ top: 0 });
    try {
      localStorage.setItem("imd-desk-pane", id);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex min-h-full items-start gap-2.5">
      <nav
        id="desk-nav"
        className="sticky top-0 flex max-h-[calc(100dvh-5rem)] w-11 shrink-0 flex-col gap-0.5 overflow-y-auto self-start sm:w-44"
        aria-label="Desk sections"
      >
        {DESK_NAV.map((item) => {
          const on = pane === item.id;
          return (
            <button
              key={item.id}
              type="button"
              id={`desk-nav-${item.id}`}
              aria-label={item.label}
              title={`${item.label} · ${item.hint}`}
              onClick={() => pick(item.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-left sm:justify-start",
                on ? "bg-cyan-400/15 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <item.Icon className="size-4 shrink-0" />
              <span className="hidden min-w-0 sm:block">
                <span className="block text-[13px] font-medium">{item.label}</span>
                <span className="text-[11px] text-slate-500">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <Pane title={active.label} className="min-w-0 flex-1">
        {pane === "closes" ? <CloseTape rows={data.stocks} onOpen={onOpen} /> : null}
        {pane === "universe" ? (
          <UniverseTable
            key={data.universe}
            rows={data.stocks}
            watch={watch}
            onToggleWatch={onToggleWatch}
            onOpen={onOpen}
            embedded
          />
        ) : null}
        {pane === "heat" ? (
          <div className="space-y-4">
            <Mosaic rows={data.stocks} onOpen={onOpen} />
            <div className="grid grid-cols-2 gap-3">
              <MoveCol title="Up" rows={gainers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
              <MoveCol title="Down" rows={losers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
            </div>
          </div>
        ) : null}
        {pane === "sectors" ? (
          <DeskErrorBoundary>
            <SectorMatrix sectors={data.sectors} heatmap={data.heatmap} compact heading={false} onOpen={onOpen} />
          </DeskErrorBoundary>
        ) : null}
        {pane === "indices" ? (
          <div className="space-y-4">
            <WatchStrip data={data} />
            <IndexList tiles={data.indices} />
          </div>
        ) : null}
        {pane === "volume" ? <VolumeTool rows={data.stocks} onOpen={onOpen} /> : null}
        {pane === "rsi" ? <RsiTool rows={data.stocks} onOpen={onOpen} /> : null}
        {pane === "earnings" ? <EarningsTool rows={data.stocks} onOpen={onOpen} /> : null}
        {pane === "gaps" ? <GapsTool rows={data.stocks} onOpen={onOpen} /> : null}
        {pane === "alerts" ? <AlertList alerts={data.alerts ?? []} onPick={onOpen} /> : null}
        {pane === "swings" ? <SetupList hits={data.patterns} onPick={onOpen} /> : null}
        {pane === "fno" ? <FoWatch data={data.derivatives} stocks={data.stocks} onOpen={onOpen} /> : null}
        {pane === "breadth" ? <BreadthBars gauges={data.breadthGauges} /> : null}
      </Pane>
    </div>
  );
}
