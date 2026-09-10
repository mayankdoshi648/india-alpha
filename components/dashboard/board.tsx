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
import { PATTERN_LABEL, compact, inr, signed, SWING_STATUS } from "@/lib/format";
import { Chg, EmaPills, Sparkline } from "@/components/dashboard/primitives";
import { SectorMatrix } from "@/components/dashboard/sector-matrix";
import { UniverseTable } from "@/components/dashboard/universe-table";
import { DeskErrorBoundary } from "@/components/dashboard/error-boundary";
import { StockFoList } from "@/components/dashboard/stock-fo";
import { cn } from "@/lib/utils";

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
        "flex flex-col rounded-xl border border-white/10 bg-[#121b2c] xl:min-h-0 xl:overflow-hidden",
        className,
      )}
    >
      <h2 className="shrink-0 border-b border-white/8 px-3 py-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
        {title}
      </h2>
      <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-auto">{children}</div>
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
    <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5 xl:grid xl:grid-cols-7 xl:overflow-visible">
      {cards.map((c) => {
        const up = (c.chg ?? 0) >= 0;
        return (
          <div
            key={c.k}
            className={cn(
              "min-w-[9.5rem] shrink-0 rounded-xl border border-white/10 bg-[#121b2c] px-3 py-2.5 xl:min-w-0",
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
    <section className="shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#121b2c]">
      <h2 className="border-b border-white/8 px-3 py-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
        Stock close · price and 1D %
      </h2>
      <div className="max-h-[min(56vh,32rem)] overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-[#152033] text-[11px] tracking-wide text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">1D %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.symbol}
                className="cursor-pointer border-t border-white/8 hover:bg-white/5"
                onClick={() => onOpen(r.symbol)}
              >
                <td className="px-3 py-2">
                  <p className="font-mono text-[13px] font-semibold text-white">{r.symbol}</p>
                  <p className="truncate text-[11px] text-slate-500">{r.name}</p>
                </td>
                <td className="px-3 py-2 text-right font-mono text-[15px] text-white tabular-nums">{inr(r.cmp)}</td>
                <td className="px-3 py-2 text-right">
                  <Chg value={r.change1d} icon={false} size="md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
    <div className="flex flex-1 flex-col gap-2.5 xl:min-h-0">
      <WatchStrip data={data} />
      <CloseTape rows={data.stocks} onOpen={onOpen} />
      <div className="grid grid-cols-1 gap-2.5 xl:min-h-[42rem] xl:flex-1 xl:grid-cols-[20rem_minmax(0,1fr)_22rem] xl:grid-rows-[minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5 xl:min-h-0">
          <Pane title="Index tape" className="hidden xl:flex xl:max-h-[34%]">
            <IndexList tiles={data.indices} />
          </Pane>
          <Pane title={data.universe === "nifty500" ? `Nifty 500 · 1D heat · ${data.stocks.length}` : "Nifty 50 · 1D heat"} className="xl:flex-1">
            <Mosaic rows={data.stocks} onOpen={onOpen} />
          </Pane>
          <Pane title="Gainers & losers" className="xl:max-h-[28%]">
            <div className="grid grid-cols-2 gap-3">
              <MoveCol title="Up" rows={gainers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
              <MoveCol title="Down" rows={losers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
            </div>
          </Pane>
        </div>

        <div className="flex flex-col gap-2.5 xl:min-h-0">
          <Pane title={data.universe === "nifty500" ? `Universe · Nifty 500 · ${data.stocks.length}` : "Universe · Nifty 50"} className="min-h-[360px] xl:flex-1 xl:min-h-[320px]">
            <UniverseTable
              key={data.universe}
              rows={data.stocks}
              watch={watch}
              onToggleWatch={onToggleWatch}
              onOpen={onOpen}
              embedded
            />
          </Pane>
          <Pane title="Sector rotation" className="min-h-[220px] xl:max-h-[40%] xl:min-h-[220px]">
            <DeskErrorBoundary>
              <SectorMatrix sectors={data.sectors} heatmap={data.heatmap} compact heading={false} onOpen={onOpen} />
            </DeskErrorBoundary>
          </Pane>
        </div>

        <div className="flex flex-col gap-2.5 xl:min-h-0">
          <Pane title="Alerts" className="xl:max-h-[26%]">
            <AlertList alerts={data.alerts ?? []} onPick={onOpen} />
          </Pane>
          <Pane title="Swing · VCP / breakout" className="xl:max-h-[34%]">
            <SetupList hits={data.patterns} onPick={onOpen} />
          </Pane>
          <Pane title="F&O · index + stocks" className="xl:flex-1">
            <FoWatch data={data.derivatives} stocks={data.stocks} onOpen={onOpen} />
          </Pane>
          <Pane title="EMA breadth" className="xl:max-h-[22%]">
            <BreadthBars gauges={data.breadthGauges} />
          </Pane>
        </div>
      </div>
    </div>
  );
}
