"use client";

import type { IndexTile } from "@/lib/types";
import { inr } from "@/lib/format";
import { Chg, EmaPills, Panel } from "@/components/dashboard/primitives";

export function IndexTiles({ tiles }: { tiles: IndexTile[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((t) => {
        const up = t.changePct >= 0;
        return (
          <Panel key={t.id} glow={up ? "up" : "down"} className="relative overflow-hidden">
            <div
              className={`pointer-events-none absolute inset-0 ${
                up
                  ? "bg-linear-to-br from-emerald-500/10 to-transparent"
                  : "bg-linear-to-br from-rose-500/10 to-transparent"
              }`}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{t.symbol}</p>
                <h3 className="text-sm font-medium">{t.name}</h3>
              </div>
              <Chg value={t.changePct} />
            </div>
            <p className="relative mt-2 font-mono text-2xl tracking-tight tabular-nums">
              {inr(t.cmp, 2)}
            </p>
            <div className="relative mt-3 flex items-center justify-between gap-2">
              <EmaPills emas={t.emas} />
              <p className="text-[10px] text-muted-foreground">
                10/20/50/200 · green = CMP above
              </p>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
