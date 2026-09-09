"use client";

import { useMemo, useState } from "react";
import type { ChartPatternHit, Timeframe } from "@/lib/types";
import { CHART_PATTERN_LABEL, CHART_PATTERN_TONE, inr, signed } from "@/lib/format";
import { cn } from "@/lib/utils";

type TfFilter = "ALL" | Timeframe;
type BiasFilter = "ALL" | "bullish" | "bearish";

export function ChartPatternBoard({
  hits,
  universe,
  onOpen,
}: {
  hits: ChartPatternHit[];
  universe: "nifty50" | "nifty500";
  onOpen: (symbol: string) => void;
}) {
  const [tf, setTf] = useState<TfFilter>("ALL");
  const [bias, setBias] = useState<BiasFilter>("ALL");

  const filtered = useMemo(() => {
    return hits.filter((h) => (tf === "ALL" || h.timeframe === tf) && (bias === "ALL" || h.bias === bias));
  }, [hits, tf, bias]);

  const shown = filtered.slice(0, universe === "nifty500" ? 16 : 12);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["ALL", "D", "W", "M"] as TfFilter[]).map((id) => (
          <button
            key={id}
            type="button"
            id={`chart-pattern-tf-${id}`}
            onClick={() => setTf(id)}
            className={cn(
              "h-6 rounded-md border px-2 text-[11px]",
              tf === id ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-slate-400 hover:bg-white/5",
            )}
          >
            {id === "ALL" ? "All TF" : id === "D" ? "Daily" : id === "W" ? "Weekly" : "Monthly"}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {(["ALL", "bullish", "bearish"] as BiasFilter[]).map((id) => (
          <button
            key={id}
            type="button"
            id={`chart-pattern-bias-${id}`}
            onClick={() => setBias(id)}
            className={cn(
              "h-6 rounded-md border px-2 text-[11px]",
              bias === id ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-slate-400 hover:bg-white/5",
            )}
          >
            {id === "ALL" ? "Long + short" : id === "bullish" ? "Long" : "Short"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          {shown.length} of {filtered.length} on {universe === "nifty500" ? "Nifty 500" : "Nifty 50"}
        </span>
      </div>
      <p className="text-[11px] leading-snug text-slate-500">
        Triangles, flags, wedges, H&amp;S, double/triple. Volume on the break plus RSI / divergence. Click a name for the
        chart. This is a scanner, not an order.
      </p>
      {!shown.length ? (
        <p className="text-sm text-slate-500">No triangle / flag / wedge / H&amp;S setups on this tape and filter.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((h) => (
            <button
              key={`${h.symbol}-${h.kind}-${h.timeframe}`}
              type="button"
              id={`chart-pattern-${h.symbol}-${h.kind}-${h.timeframe}`}
              onClick={() => onOpen(h.symbol)}
              className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left hover:border-cyan-400/35 hover:bg-cyan-400/5"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[13px] font-semibold text-white">{h.symbol}</span>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-px text-[10px]",
                        CHART_PATTERN_TONE[h.kind],
                      )}
                    >
                      {CHART_PATTERN_LABEL[h.kind]}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                      {h.timeframe} · {h.role} · {h.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-400">{h.rationale}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                    buy/sell {inr(h.entry, 1)} · stop {inr(h.stop, 1)} · TP {inr(h.target, 1)} · {h.rr.toFixed(1)}R
                    {h.divergence ? ` · ${h.divergence.replaceAll("_", " ")} RSI` : ""} · vol {h.volX.toFixed(1)}x
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[13px] text-white tabular-nums">{inr(h.cmp, 1)}</p>
                  <span className={cn("font-mono text-[11px] tabular-nums", h.change1d >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {signed(h.change1d)}%
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartPatternMini({ hits }: { hits: ChartPatternHit[] }) {
  if (!hits.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] tracking-[0.16em] text-slate-400 uppercase">Chart patterns</p>
      {hits.map((h) => (
        <div key={`${h.kind}-${h.timeframe}`} className="rounded-lg border border-white/8 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border px-1.5 py-px text-[10px]", CHART_PATTERN_TONE[h.kind])}>
              {CHART_PATTERN_LABEL[h.kind]}
            </span>
            <span className="text-[11px] text-slate-500">
              {h.timeframe} · {h.bias} · {h.status}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-slate-300">{h.rationale}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
            {inr(h.entry, 1)} / stop {inr(h.stop, 1)} / TP {inr(h.target, 1)}
          </p>
        </div>
      ))}
    </div>
  );
}
