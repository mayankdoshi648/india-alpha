"use client";

import { useEffect, useState } from "react";
import type {
  BreadthCircle,
  DashboardSnapshot,
  DeskAlert,
  IndexTile,
  PatternHit,
  StockRow,
} from "@/lib/types";
import { PATTERN_LABEL, compact, inr, signed, SWING_STATUS } from "@/lib/format";
import { Chg, EmaPills, Sparkline } from "@/components/dashboard/primitives";
import { SectorMatrix } from "@/components/dashboard/sector-matrix";
import { UniverseTable } from "@/components/dashboard/universe-table";
import { DeskErrorBoundary } from "@/components/dashboard/error-boundary";
import { FoDesk } from "@/components/dashboard/fo-desk";
import { cn } from "@/lib/utils";
import { Bell, Landmark, Layers, LayoutList, Table2 } from "lucide-react";

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
      <h2 className="shrink-0 border-b border-white/8 bg-[#121b2c] px-3 py-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
        {title}
      </h2>
      <div className="p-3 pb-8">{children}</div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">{title}</p>
      {children}
    </div>
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
  snap,
  onOpen,
}: {
  snap: DashboardSnapshot;
  onOpen: (s: string) => void;
}) {
  return (
    <DeskErrorBoundary>
      <FoDesk snap={snap} onOpen={onOpen} />
    </DeskErrorBoundary>
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

type DeskGroup = "indices" | "equity" | "sector" | "fno" | "alerts";

const DESK_NAV: {
  id: DeskGroup;
  label: string;
  hint: string;
  Icon: typeof Landmark;
}[] = [
  { id: "indices", label: "Indices", hint: "Tiles & breadth", Icon: Landmark },
  { id: "equity", label: "Equity", hint: "Price, vol, RSI", Icon: Table2 },
  { id: "sector", label: "Sector", hint: "Rotation & heat", Icon: LayoutList },
  { id: "fno", label: "F&O", hint: "Streaks & OI", Icon: Layers },
  { id: "alerts", label: "Alerts", hint: "Flags & swings", Icon: Bell },
];

const PANE_TO_GROUP: Record<string, DeskGroup> = {
  closes: "equity",
  universe: "equity",
  volume: "equity",
  rsi: "equity",
  earnings: "equity",
  gaps: "equity",
  heat: "sector",
  sectors: "sector",
  indices: "indices",
  breadth: "indices",
  fno: "fno",
  alerts: "alerts",
  swings: "alerts",
};

function readDeskGroup(): DeskGroup {
  try {
    const group = localStorage.getItem("imd-desk-group");
    if (DESK_NAV.some((n) => n.id === group)) return group as DeskGroup;
    const pane = localStorage.getItem("imd-desk-pane");
    if (pane && PANE_TO_GROUP[pane]) return PANE_TO_GROUP[pane];
  } catch {
    // ignore
  }
  return "equity";
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
  const [group, setGroup] = useState<DeskGroup>("equity");
  const gainers = [...data.stocks].sort((a, b) => b.change1d - a.change1d).slice(0, 5);
  const losers = [...data.stocks].sort((a, b) => a.change1d - b.change1d).slice(0, 5);
  const active = DESK_NAV.find((n) => n.id === group) ?? DESK_NAV[1];

  useEffect(() => {
    setGroup(readDeskGroup());
  }, []);

  const pickGroup = (id: DeskGroup) => {
    setGroup(id);
    document.getElementById("desk-scroll")?.scrollTo({ top: 0 });
    try {
      localStorage.setItem("imd-desk-group", id);
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
          const on = group === item.id;
          return (
            <button
              key={item.id}
              type="button"
              id={`desk-nav-${item.id}`}
              aria-label={item.label}
              title={`${item.label} · ${item.hint}`}
              onClick={() => pickGroup(item.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-left sm:justify-start",
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
        {group === "indices" ? (
          <div className="space-y-6">
            <Block title="Index tiles">
              <WatchStrip data={data} />
            </Block>
            <Block title="Index tape">
              <IndexList tiles={data.indices} />
            </Block>
            <Block title="Breadth">
              <BreadthBars gauges={data.breadthGauges} />
            </Block>
          </div>
        ) : null}
        {group === "equity" ? (
          <UniverseTable
            key={data.universe}
            rows={data.stocks}
            watch={watch}
            onToggleWatch={onToggleWatch}
            onOpen={onOpen}
            embedded
          />
        ) : null}
        {group === "sector" ? (
          <div className="space-y-6">
            <Block title="Rotation">
              <DeskErrorBoundary>
                <SectorMatrix sectors={data.sectors} heatmap={data.heatmap} compact heading={false} onOpen={onOpen} />
              </DeskErrorBoundary>
            </Block>
            <Block title="Heat">
              <Mosaic rows={data.stocks} onOpen={onOpen} />
              <div className="grid grid-cols-2 gap-3">
                <MoveCol title="Up" rows={gainers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
                <MoveCol title="Down" rows={losers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
              </div>
            </Block>
          </div>
        ) : null}
        {group === "fno" ? (
          <FoWatch snap={data} onOpen={onOpen} />
        ) : null}
        {group === "alerts" ? (
          <div className="space-y-6">
            <Block title="Desk flags">
              <AlertList alerts={data.alerts ?? []} onPick={onOpen} />
            </Block>
            <Block title="Swings">
              <SetupList hits={data.patterns} onPick={onOpen} />
            </Block>
          </div>
        ) : null}
      </Pane>
    </div>
  );
}
