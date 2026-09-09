"use client";

import type { DerivativesRadar } from "@/lib/types";
import { compact, inr } from "@/lib/format";
import { Panel } from "@/components/dashboard/primitives";

export function OptionLadder({ data }: { data: DerivativesRadar }) {
  if (!data.ladder?.length) {
    return (
      <Panel className="text-sm text-muted-foreground">
        Option ladder is empty on this tape.
      </Panel>
    );
  }
  const maxOi = Math.max(1, ...data.ladder.map((s) => Math.max(s.callOi, s.putOi)));
  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-cyan-400/80 uppercase">Option ladder</p>
          <h3 className="text-base font-medium">Nifty OI around ATM · expiry {data.expiry}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Call wall {inr(data.callWall, 0)} · put wall {inr(data.putWall, 0)} · IV skew {data.ivSkew.toFixed(1)}
        </p>
      </div>
      <div className="mt-3 space-y-1">
        <div className="grid grid-cols-[1fr_80px_1fr] text-[10px] text-muted-foreground uppercase">
          <span className="text-right">Call OI</span>
          <span className="text-center">Strike</span>
          <span>Put OI</span>
        </div>
        {data.ladder.map((s) => {
          const atm = Math.abs(s.strike - data.spot) <= 25;
          return (
            <div
              key={s.strike}
              className={`grid grid-cols-[1fr_80px_1fr] items-center gap-2 text-[11px] ${atm ? "rounded bg-cyan-400/10" : ""}`}
            >
              <div className="flex items-center justify-end gap-2">
                <span className="font-mono tabular-nums text-rose-300">{compact(s.callOi)}</span>
                <div className="h-1.5 w-24 overflow-hidden rounded bg-white/10">
                  <div
                    className="ml-auto h-full bg-rose-400/80"
                    style={{ width: `${(s.callOi / maxOi) * 100}%` }}
                  />
                </div>
              </div>
              <span className={`text-center font-mono tabular-nums ${atm ? "text-cyan-200" : ""}`}>
                {inr(s.strike, 0)}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded bg-white/10">
                  <div
                    className="h-full bg-emerald-400/80"
                    style={{ width: `${(s.putOi / maxOi) * 100}%` }}
                  />
                </div>
                <span className="font-mono tabular-nums text-emerald-300">{compact(s.putOi)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
