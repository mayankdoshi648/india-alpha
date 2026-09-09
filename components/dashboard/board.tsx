"use client";

import type {
  BreadthCircle,
  DashboardSnapshot,
  DerivativesRadar,
  DeskAlert,
  IndexTile,
  PatternHit,
  StockRow,
} from "@/lib/types";
import { PATTERN_LABEL, compact, inr, signed } from "@/lib/format";
import { Chg, EmaPills } from "@/components/dashboard/primitives";
import { SectorMatrix } from "@/components/dashboard/sector-matrix";
import { UniverseTable } from "@/components/dashboard/universe-table";
import { cn } from "@/lib/utils";

function Pane({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121b2c]",
        className,
      )}
    >
      <h2 className="shrink-0 border-b border-white/8 px-3 py-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </section>
  );
}

export function WatchStrip({ data }: { data: DashboardSnapshot }) {
  const nifty = data.indices.find((i) => i.id === "nifty");
  const bank = data.indices.find((i) => i.id === "banknifty");
  const cards = [
    nifty ? { k: "Nifty 50", v: inr(nifty.cmp, 2), chg: nifty.changePct } : null,
    bank ? { k: "Bank Nifty", v: inr(bank.cmp, 2), chg: bank.changePct } : null,
    { k: "India VIX", v: data.derivatives.indiaVix.toFixed(2), chg: data.derivatives.indiaVixChangePct },
    { k: "Nifty PCR", v: data.derivatives.niftyPcr.toFixed(2), chg: null as number | null },
    {
      k: "Advance / Decline",
      v: `${data.breadth.advancing} / ${data.breadth.declining}`,
      chg: data.breadth.adRatio >= 1 ? 1 : -1,
    },
    { k: "FII net", v: `${compact(data.derivatives.fiiNet)} cr`, chg: data.derivatives.fiiNet },
  ].filter(Boolean) as { k: string; v: string; chg: number | null }[];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
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
          <p className="font-mono text-[15px] text-white tabular-nums">{inr(t.cmp, 0)}</p>
          <Chg value={t.changePct} />
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
  const tape = rows.filter((r) => r.nifty50).slice(0, 50);
  return (
    <div className="grid grid-cols-5 gap-1">
      {tape.map((r) => (
        <button
          key={r.symbol}
          type="button"
          id={`mosaic-${r.symbol}`}
          onClick={() => onOpen(r.symbol)}
          className={cn("rounded-md px-1 py-1.5 text-left", heat(r.change1d))}
          title={`${r.name} ${signed(r.change1d)}%`}
        >
          <p className="truncate font-mono text-[11px] font-semibold">{r.symbol}</p>
          <p className="font-mono text-[10px] tabular-nums">{signed(r.change1d)}%</p>
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
  return (
    <div className="space-y-1">
      {hits.slice(0, 8).map((h) => (
        <button
          key={`${h.symbol}-${h.kind}`}
          type="button"
          onClick={() => onPick(h.symbol)}
          className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white/5"
        >
          <span className="w-[88px] truncate text-[13px] font-medium text-white">{h.symbol}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-slate-400">{PATTERN_LABEL[h.kind]}</span>
          <Chg value={h.change1d} />
        </button>
      ))}
    </div>
  );
}

function FoWatch({ data }: { data: DerivativesRadar }) {
  const maxOi = Math.max(1, ...(data.ladder ?? []).map((s) => Math.max(s.callOi, s.putOi)));
  const rows = (data.ladder ?? []).slice(0, 9);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[11px] text-slate-400">FII / DII</p>
          <p className={cn("font-mono tabular-nums", data.fiiNet >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {signed(data.fiiNet, 0)} / {signed(data.diiNet, 0)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Max pain</p>
          <p className="font-mono tabular-nums text-white">{inr(data.maxPain, 0)}</p>
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
  const gainers = [...data.stocks].sort((a, b) => b.change1d - a.change1d).slice(0, 5);
  const losers = [...data.stocks].sort((a, b) => a.change1d - b.change1d).slice(0, 5);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <WatchStrip data={data} />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 xl:grid-cols-[20rem_minmax(0,1fr)_22rem] xl:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-2.5">
          <Pane title="Index tape" className="xl:max-h-[34%]">
            <IndexList tiles={data.indices} />
          </Pane>
          <Pane title="Nifty 50 · 1D heat" className="xl:flex-1">
            <Mosaic rows={data.stocks} onOpen={onOpen} />
          </Pane>
          <Pane title="Gainers & losers" className="xl:max-h-[28%]">
            <div className="grid grid-cols-2 gap-3">
              <MoveCol title="Up" rows={gainers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
              <MoveCol title="Down" rows={losers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
            </div>
          </Pane>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <Pane title="Sector rotation" className="h-[280px] xl:h-auto xl:flex-[0_0_42%]">
            <SectorMatrix sectors={data.sectors} heatmap={data.heatmap} compact />
          </Pane>
          <Pane title="Universe" className="xl:flex-1">
            <UniverseTable
              key={data.universe}
              rows={data.stocks}
              watch={watch}
              onToggleWatch={onToggleWatch}
              onOpen={onOpen}
              embedded
            />
          </Pane>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <Pane title="Alerts" className="xl:max-h-[26%]">
            <AlertList alerts={data.alerts ?? []} onPick={onOpen} />
          </Pane>
          <Pane title="Setups" className="xl:max-h-[22%]">
            <SetupList hits={data.patterns} onPick={onOpen} />
          </Pane>
          <Pane title="F&O · OI around ATM" className="xl:flex-1">
            <FoWatch data={data.derivatives} />
          </Pane>
          <Pane title="EMA breadth" className="xl:max-h-[22%]">
            <BreadthBars gauges={data.breadthGauges} />
          </Pane>
        </div>
      </div>
    </div>
  );
}
