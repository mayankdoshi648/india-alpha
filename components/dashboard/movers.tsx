"use client";

import type { StockRow } from "@/lib/types";
import { Chg, Panel } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

function List({
  title,
  rows,
  onOpen,
  metric,
}: {
  title: string;
  rows: StockRow[];
  onOpen: (symbol: string) => void;
  metric: (r: StockRow) => React.ReactNode;
}) {
  return (
    <Panel className="min-w-0 py-2.5">
      <p className="mb-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <button
            key={r.symbol}
            type="button"
            onClick={() => onOpen(r.symbol)}
            className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-white/5"
          >
            <span className="truncate font-medium text-[12px]">{r.symbol}</span>
            {metric(r)}
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function Movers({
  rows,
  onOpen,
}: {
  rows: StockRow[];
  onOpen: (symbol: string) => void;
}) {
  const gainers = [...rows].sort((a, b) => b.change1d - a.change1d).slice(0, 6);
  const losers = [...rows].sort((a, b) => a.change1d - b.change1d).slice(0, 6);
  const volume = [...rows].sort((a, b) => b.volSpike - a.volSpike).slice(0, 6);
  const oversold = [...rows].filter((r) => r.rsi < 35).sort((a, b) => a.rsi - b.rsi).slice(0, 6);

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      <List title="Gainers" rows={gainers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
      <List title="Losers" rows={losers} onOpen={onOpen} metric={(r) => <Chg value={r.change1d} />} />
      <List
        title="Volume spike"
        rows={volume}
        onOpen={onOpen}
        metric={(r) => (
          <span className="font-mono text-[11px] text-cyan-300 tabular-nums">{r.volSpike.toFixed(1)}x</span>
        )}
      />
      <List
        title="RSI oversold"
        rows={oversold}
        onOpen={onOpen}
        metric={(r) => (
          <span className="font-mono text-[11px] text-lime-300 tabular-nums">{r.rsi.toFixed(0)}</span>
        )}
      />
    </div>
  );
}

function heat(chg: number) {
  if (chg >= 2) return "bg-emerald-500/80 text-emerald-50";
  if (chg >= 0.6) return "bg-emerald-500/45 text-emerald-50";
  if (chg >= 0) return "bg-emerald-500/20 text-emerald-100";
  if (chg > -0.6) return "bg-rose-500/20 text-rose-100";
  if (chg > -2) return "bg-rose-500/45 text-rose-50";
  return "bg-rose-600/80 text-rose-50";
}

export function NameMosaic({
  rows,
  onOpen,
}: {
  rows: StockRow[];
  onOpen: (symbol: string) => void;
}) {
  const names = rows.filter((r) => r.nifty50);
  const tape = names.length ? names : rows.slice(0, 50);
  return (
    <Panel className="py-2.5">
      <p className="mb-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
        {names.length ? "Nifty 50 mosaic" : "Universe mosaic"} · 1D heat
      </p>
      <div className="grid grid-cols-5 gap-0.5 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12">
        {tape.map((r) => (
          <button
            key={r.symbol}
            type="button"
            id={`mosaic-${r.symbol}`}
            onClick={() => onOpen(r.symbol)}
            className={cn("truncate rounded px-1 py-1 text-left font-mono text-[10px] leading-tight", heat(r.change1d))}
            title={`${r.name} ${r.change1d >= 0 ? "+" : ""}${r.change1d.toFixed(2)}%`}
          >
            {r.symbol}
          </button>
        ))}
      </div>
    </Panel>
  );
}
