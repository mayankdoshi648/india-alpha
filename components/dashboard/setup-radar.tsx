"use client";

import { PATTERN_LABEL, PATTERN_TONE, inr, signed } from "@/lib/format";
import type { PatternHit, PatternKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/dashboard/primitives";

const ORDER: PatternKind[] = [
  "breakout",
  "stage2",
  "volume_surge",
  "vcp",
  "bullish_div",
  "hidden_bullish_div",
  "bearish_div",
  "hidden_bearish_div",
  "pivot_reclaim",
  "oversold_pullback",
];

export function SetupRadar({
  hits,
  onPick,
}: {
  hits: PatternHit[];
  onPick: (symbol: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-5 gap-1.5 md:grid-cols-10">
        {ORDER.map((kind) => {
          const n = hits.filter((h) => h.kind === kind).length;
          return (
            <Panel key={kind} className="py-2">
              <p className="truncate text-[10px] text-muted-foreground">{PATTERN_LABEL[kind]}</p>
              <p className="font-mono text-lg tabular-nums">{n}</p>
            </Panel>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {hits.slice(0, 12).map((h) => (
          <button
            key={`${h.symbol}-${h.kind}`}
            type="button"
            onClick={() => onPick(h.symbol)}
            className="rounded-xl border border-white/8 bg-card/70 p-3 text-left transition hover:border-cyan-500/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{h.symbol}</p>
                <p className="text-[11px] text-muted-foreground">{h.name}</p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  PATTERN_TONE[h.kind],
                )}
              >
                {PATTERN_LABEL[h.kind]}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{h.detail}</p>
            <div className="mt-2 flex items-center justify-between font-mono text-xs tabular-nums">
              <span>{inr(h.cmp)}</span>
              <span className={h.change1d >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {signed(h.change1d)}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
