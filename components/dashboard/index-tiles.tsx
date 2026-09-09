"use client";

import type { IndexTile } from "@/lib/types";
import { inr } from "@/lib/format";
import { Chg, EmaPills, Panel, Sparkline } from "@/components/dashboard/primitives";

export function IndexTiles({ tiles }: { tiles: IndexTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => {
        const up = t.changePct >= 0;
        return (
          <Panel key={t.id} glow={up ? "up" : "down"} className="relative overflow-hidden py-2.5">
            <div
              className={`pointer-events-none absolute inset-0 ${
                up
                  ? "bg-linear-to-br from-emerald-500/10 to-transparent"
                  : "bg-linear-to-br from-rose-500/10 to-transparent"
              }`}
            />
            <div className="relative flex items-start justify-between gap-2">
              <p className="truncate text-[11px] font-medium">{t.name}</p>
              <Chg value={t.changePct} />
            </div>
            <p className="relative mt-0.5 font-mono text-lg tracking-tight tabular-nums">
              {inr(t.cmp, 2)}
            </p>
            <div className="relative mt-1 flex items-end justify-between gap-2">
              <Sparkline values={t.spark ?? []} width={96} height={28} />
              {t.asOf ? (
                <p className="font-mono text-[10px] text-slate-500 tabular-nums">{t.asOf}</p>
              ) : null}
            </div>
            <div className="relative mt-1.5">
              <EmaPills emas={t.emas} />
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
