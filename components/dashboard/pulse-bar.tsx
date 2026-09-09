"use client";

import type { DashboardSnapshot } from "@/lib/types";
import { compact, inr, signed } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PulseBar({ data }: { data: DashboardSnapshot }) {
  const nifty = data.indices.find((i) => i.id === "nifty");
  const bank = data.indices.find((i) => i.id === "banknifty");
  const items: { k: string; v: string; chg: number | null }[] = [
    nifty ? { k: "Nifty", v: inr(nifty.cmp, 0), chg: nifty.changePct } : null,
    bank ? { k: "BankN", v: inr(bank.cmp, 0), chg: bank.changePct } : null,
    { k: "VIX", v: data.derivatives.indiaVix.toFixed(1), chg: data.derivatives.indiaVixChangePct },
    { k: "PCR", v: data.derivatives.niftyPcr.toFixed(2), chg: null },
    {
      k: "A/D",
      v: `${data.breadth.advancing}/${data.breadth.declining}`,
      chg: data.breadth.adRatio >= 1 ? 1 : -1,
    },
    { k: "FII", v: `${compact(data.derivatives.fiiNet)} cr`, chg: data.derivatives.fiiNet },
  ].filter((x): x is { k: string; v: string; chg: number | null } => x !== null);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-px overflow-x-auto rounded-md border border-white/8 bg-black/30">
      {items.map((it) => (
        <div key={it.k} className="flex min-w-fit items-baseline gap-1.5 px-2.5 py-1">
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{it.k}</span>
          <span
            className={cn(
              "font-mono text-[12px] tabular-nums",
              it.k === "PCR" || it.chg === null
                ? "text-slate-100"
                : it.chg >= 0
                  ? "text-emerald-300"
                  : "text-rose-300",
            )}
          >
            {it.v}
          </span>
          {it.chg !== null && it.k !== "A/D" && it.k !== "FII" ? (
            <span className={cn("font-mono text-[11px] tabular-nums", it.chg >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {signed(it.chg)}%
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
