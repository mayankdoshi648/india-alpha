"use client";

import type { DeskAlert } from "@/lib/types";
import { Panel } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

export function DeskAlerts({
  alerts,
  onPick,
}: {
  alerts: DeskAlert[];
  onPick: (symbol: string) => void;
}) {
  if (!alerts.length) {
    return (
      <Panel className="text-sm text-muted-foreground">
        No active desk alerts. Breadth, FII flow and scanner names look quiet on this tape.
      </Panel>
    );
  }
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {alerts.map((a) => (
        <button
          key={a.id}
          type="button"
          id={a.symbol ? `alert-${a.symbol}` : undefined}
          onClick={() => a.symbol && onPick(a.symbol)}
          className={cn(
            "rounded-xl border px-3 py-3 text-left",
            a.tone === "warn" && "border-amber-400/30 bg-amber-500/8",
            a.tone === "setup" && "border-cyan-400/30 bg-cyan-500/8",
            a.tone === "info" && "border-white/10 bg-white/4",
            a.symbol && "hover:border-cyan-300/50",
          )}
        >
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{a.tone}</p>
          <p className="text-sm font-medium">{a.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
        </button>
      ))}
    </div>
  );
}
