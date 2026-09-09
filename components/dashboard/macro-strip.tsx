"use client";

import type { MacroTile } from "@/lib/types";
import { Chg, Panel } from "@/components/dashboard/primitives";

export function MacroStrip({ tiles }: { tiles: MacroTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
      {tiles.map((t) => (
        <Panel key={t.id} className="py-3">
          <p className="text-[11px] text-muted-foreground">{t.name}</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {t.unit === "pct" ? `${t.changePct.toFixed(2)}%` : t.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <Chg value={t.changePct} />
          <p className="mt-1 text-[10px] text-muted-foreground">{t.hint}</p>
        </Panel>
      ))}
    </div>
  );
}
