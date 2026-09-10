"use client";

import { useMemo, useState } from "react";
import type { StockRow } from "@/lib/types";
import {
  FO_BUILD_LABEL,
  FO_BUILD_ORDER,
  FO_TAG_LABEL,
  type FoBuildKind,
  type FoBuildupStreak,
  type FoChipTone,
  type FoTagId,
  buildupStreaks,
  foStandouts,
} from "@/lib/fo-radar";
import { signed } from "@/lib/format";
import { indiaSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const CHIP_CLASS: Record<FoChipTone, string> = {
  "short-build": "border-rose-500/40 bg-rose-950/80 text-rose-200",
  "long-build": "border-emerald-500/35 bg-emerald-950/70 text-emerald-200",
  "short-cover": "border-amber-500/40 bg-amber-950/70 text-amber-200",
  "long-unwind": "border-orange-500/35 bg-[#3a1d18] text-orange-200",
  neutral: "border-white/10 bg-white/5 text-slate-400",
};

const BUILD_BADGE: Record<FoBuildKind, string> = {
  "short-build": "border-rose-500/30 bg-rose-500/20 text-rose-200",
  "long-build": "border-emerald-500/30 bg-emerald-500/20 text-emerald-200",
  "long-unwind": "border-orange-500/30 bg-orange-500/20 text-orange-200",
  "short-cover": "border-amber-500/30 bg-amber-500/20 text-amber-200",
};

const BUILD_COUNT: Record<FoBuildKind, string> = {
  "short-build": "border-rose-500/30 bg-rose-950/70 text-rose-200",
  "long-build": "border-emerald-500/30 bg-emerald-950/70 text-emerald-200",
  "long-unwind": "border-orange-500/30 bg-orange-950/70 text-orange-200",
  "short-cover": "border-amber-500/30 bg-amber-950/70 text-amber-200",
};

const TAG_CLASS: Record<FoTagId, string> = {
  "volume-spike": "bg-teal-500/20 text-teal-200",
  "oi-surge": "bg-emerald-500/20 text-emerald-200",
  "price-shock": "bg-violet-500/25 text-violet-200",
  idiosyncratic: "bg-fuchsia-500/20 text-fuchsia-200",
  "gap-open": "bg-amber-700/35 text-amber-100",
  "range-expansion": "bg-indigo-500/25 text-indigo-200",
  "options-frenzy": "bg-orange-700/40 text-orange-100",
  "pcr-shift": "bg-cyan-500/20 text-cyan-200",
  "block-prints": "bg-sky-500/20 text-sky-200",
};

type FilterKind = FoBuildKind | "all";

export function FoRadar({
  rows,
  asOf,
  niftyChange = 0,
  onOpen,
}: {
  rows: StockRow[];
  asOf: string;
  niftyChange?: number;
  onOpen: (symbol: string) => void;
}) {
  const [kind, setKind] = useState<FilterKind>("all");
  const groups = useMemo(
    () => FO_BUILD_ORDER.map((k) => ({ kind: k, rows: buildupStreaks(rows, asOf, k) })),
    [rows, asOf],
  );
  const standouts = useMemo(() => foStandouts(rows, 8, niftyChange), [rows, niftyChange]);
  const visible = kind === "all" ? groups : groups.filter((g) => g.kind === kind);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const sessionClosed = !indiaSession().open;
  const pxLabel = sessionClosed ? "close" : "px";
  const stacked = kind === "all";

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            id="fo-build-tab-all"
            onClick={() => setKind("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              kind === "all"
                ? "border-white/25 bg-white/10 text-slate-100"
                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            All
            <span className="ml-1.5 font-mono tabular-nums opacity-80">{total}</span>
          </button>
          {groups.map((g) => {
            const on = g.kind === kind;
            return (
              <button
                key={g.kind}
                type="button"
                id={`fo-build-tab-${g.kind}`}
                onClick={() => setKind(g.kind)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px]",
                  on ? BUILD_COUNT[g.kind] : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )}
              >
                {FO_BUILD_LABEL[g.kind]}
                <span className="ml-1.5 font-mono tabular-nums opacity-80">{g.rows.length}</span>
              </button>
            );
          })}
        </div>
        {stacked ? (
          <p className="mb-3 text-[11px] text-slate-500">
            Consecutive sessions of the same price + OI print. A quiet last bar does not wipe the
            run. After the close, the last chip is the session vs previous close.
          </p>
        ) : (
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-medium text-slate-200">{FO_BUILD_LABEL[kind]} streaks</h3>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", BUILD_COUNT[kind])}>
              {visible[0]?.rows.length ?? 0} · ≥3 days back-to-back
            </span>
          </div>
        )}
        {total === 0 ? (
          <p className="rounded-xl border border-white/8 px-3 py-4 text-sm text-slate-500">
            No F&O names with 3 or more back-to-back buildup or unwinding sessions on this tape.
          </p>
        ) : (
          <div className="space-y-5">
            {visible.map((g) => (
              <StreakTape
                key={g.kind}
                kind={g.kind}
                rows={g.rows}
                stacked={stacked}
                pxLabel={pxLabel}
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-medium text-slate-200">What stands out</h3>
        {standouts.length ? (
          <div className="divide-y divide-white/8 rounded-xl border border-white/10 bg-[#0d1524]">
            {standouts.map((s) => (
              <button
                key={s.symbol}
                type="button"
                id={`fo-standout-${s.symbol}`}
                onClick={() => onOpen(s.symbol)}
                className="w-full px-3 py-2.5 text-left hover:bg-white/5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold tracking-wide text-white">{s.symbol}</span>
                  <span className="text-[11px] text-slate-500">stock · score {s.score.toFixed(1)}</span>
                  <span className="flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", TAG_CLASS[t])}
                      >
                        {FO_TAG_LABEL[t]}
                      </span>
                    ))}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-5 text-slate-400">{s.blurb}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/8 px-3 py-4 text-sm text-slate-500">
            No F&O outliers on this tape yet.
          </p>
        )}
      </section>
    </div>
  );
}

function StreakTape({
  kind,
  rows,
  stacked,
  pxLabel,
  onOpen,
}: {
  kind: FoBuildKind;
  rows: FoBuildupStreak[];
  stacked: boolean;
  pxLabel: string;
  onOpen: (symbol: string) => void;
}) {
  return (
    <div>
      {stacked ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-slate-200">{FO_BUILD_LABEL[kind]}</h3>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", BUILD_COUNT[kind])}>
            {rows.length}
            {rows.length ? " · ≥3 days" : ""}
          </span>
        </div>
      ) : null}
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((s) => (
            <button
              key={`${kind}-${s.symbol}`}
              type="button"
              id={`fo-streak-${kind}-${s.symbol}`}
              onClick={() => onOpen(s.symbol)}
              className="w-full rounded-xl border border-white/10 bg-[#0d1524] px-3 py-2.5 text-left hover:border-white/16 hover:bg-[#111b2e]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold tracking-wide text-white">{s.symbol}</span>
                <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-medium", BUILD_BADGE[kind])}>
                  {FO_BUILD_LABEL[kind]} x{s.days}
                </span>
                <span className="text-[10px] tracking-[0.14em] text-slate-500 uppercase">FUTSTK</span>
              </div>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {s.chips.map((c) => (
                    <span
                      key={c.date}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                        CHIP_CLASS[c.tone],
                      )}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
                <p className="font-mono text-[11px] leading-4 text-slate-400 tabular-nums">
                  {pxLabel} {signed(s.pxPct)}%
                  <br />
                  OI {signed(s.oiPct)}%
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-white/8 px-3 py-3 text-[13px] text-slate-500">
          No F&O names with 3 or more back-to-back {FO_BUILD_LABEL[kind].toLowerCase()} sessions on
          this tape.
        </p>
      )}
    </div>
  );
}
