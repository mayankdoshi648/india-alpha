"use client";

import type { MacroTile } from "@/lib/types";
import { Chg, Panel } from "@/components/dashboard/primitives";

export function MacroStrip({ tiles }: { tiles: MacroTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">
      {tiles.map((t) => (
        <Panel key={t.id} className="py-2">
          <p className="truncate text-[10px] text-muted-foreground">{t.name}</p>
          <p className="mt-0.5 font-mono text-[15px] tabular-nums">
            {t.unit === "pct" ? `${t.changePct.toFixed(2)}%` : t.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <Chg value={t.changePct} />
        </Panel>
      ))}
    </div>
  );
}
