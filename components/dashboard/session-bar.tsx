"use client";

import { useEffect, useState } from "react";
import type { DashboardSnapshot } from "@/lib/types";
import { indiaSession, tokenAgeLabel } from "@/lib/session";
import { cn } from "@/lib/utils";

export function SessionBar({
  data,
  token,
}: {
  data: DashboardSnapshot;
  token: string;
}) {
  const [now, setNow] = useState(() => indiaSession());
  const [age, setAge] = useState("");

  useEffect(() => {
    const tick = () => {
      setNow(indiaSession());
      const generated = Date.parse(data.generatedAt);
      if (Number.isFinite(generated)) {
        const sec = Math.max(0, Math.round((Date.now() - generated) / 1000));
        setAge(sec < 60 ? `${sec}s ago` : `${Math.floor(sec / 60)}m ago`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data.generatedAt]);

  const phaseTone =
    now.phase === "open"
      ? "text-emerald-300"
      : now.phase === "preopen"
        ? "text-amber-300"
        : "text-muted-foreground";

  const tokenLabel = token ? tokenAgeLabel(token) : null;
  const tokenTone = tokenLabel?.includes("expired") ? "text-rose-300" : tokenLabel?.match(/^token [0-2]h/) ? "text-amber-300" : "text-cyan-200";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
      <span className={cn("font-medium uppercase tracking-wide", phaseTone)}>
        NSE {now.phase}
      </span>
      <span className="font-mono tabular-nums">{now.clock}</span>
      <span>tape {data.asOf}</span>
      <span className="text-cyan-200">
        {data.universe === "nifty500" ? "Nifty 500" : "Nifty 50"} · {data.stocks.length} names
      </span>
      <span>quotes {age || "—"} · {data.sources.quotes}</span>
      <span>F&O {data.sources.derivatives}</span>
      <span>flow {data.sources.flows}</span>
      {tokenLabel ? <span className={tokenTone}>{tokenLabel}</span> : <span>Dhan disconnected</span>}
      {now.open ? (
        <span className="text-cyan-300">auto-refresh 60s</span>
      ) : now.postClose ? (
        <span className="text-cyan-300">post-close · locking session %</span>
      ) : (
        <span>session close · 1D % vs prev close</span>
      )}
    </div>
  );
}
