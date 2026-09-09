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
      <Panel className="py-2 text-sm text-muted-foreground">
        No active desk alerts on this tape.
      </Panel>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {alerts.map((a) => (
        <button
          key={a.id}
          type="button"
          id={a.symbol ? `alert-${a.symbol}` : undefined}
          onClick={() => a.symbol && onPick(a.symbol)}
          className={cn(
            "min-w-[220px] shrink-0 rounded-lg border px-2.5 py-2 text-left",
            a.tone === "warn" && "border-amber-400/30 bg-amber-500/8",
            a.tone === "setup" && "border-cyan-400/30 bg-cyan-500/8",
            a.tone === "info" && "border-white/10 bg-white/4",
            a.symbol && "hover:border-cyan-300/50",
          )}
        >
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{a.tone}</p>
          <p className="truncate text-[12px] font-medium">{a.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{a.detail}</p>
        </button>
      ))}
    </div>
  );
}
