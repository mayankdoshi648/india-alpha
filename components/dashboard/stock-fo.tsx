"use client";

import type { StockFo } from "@/lib/types";
import { compact, inr, signed } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StockFoLadder({ fo }: { fo: StockFo }) {
  const maxOi = Math.max(1, ...fo.ladder.map((s) => Math.max(s.callOi, s.putOi)));
  const atm = fo.ladder[Math.floor(fo.ladder.length / 2)]?.strike;
  return (
    <div className="space-y-1">
      {fo.ladder.map((s) => (
        <div
          key={s.strike}
          className={cn("grid grid-cols-[1fr_56px_1fr] items-center gap-1 text-[11px]", s.strike === atm && "rounded bg-sky-400/10")}
        >
          <div className="h-1.5 overflow-hidden rounded bg-white/10">
            <div className="ml-auto h-full bg-rose-400" style={{ width: `${(s.callOi / maxOi) * 100}%` }} />
          </div>
          <span className={cn("text-center font-mono tabular-nums", s.strike === atm ? "text-sky-200" : "text-slate-200")}>
            {inr(s.strike, s.strike % 1 ? 1 : 0)}
          </span>
          <div className="h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-emerald-400" style={{ width: `${(s.putOi / maxOi) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-slate-500">
        Call wall {inr(fo.callWall, 0)} · put wall {inr(fo.putWall, 0)} · {fo.source}
      </p>
    </div>
  );
}

export function StockFoPanel({ fo }: { fo: StockFo }) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#121b2c] p-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-cyan-400/80 uppercase">Stock F&O</p>
          <p className="text-sm text-slate-300">Expiry {fo.expiry} · {fo.source}</p>
        </div>
        <p className="font-mono text-lg tabular-nums text-white">PCR {fo.pcr.toFixed(2)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <FoMeta k="ATM IV" v={`${fo.atmIv.toFixed(1)}%`} />
        <FoMeta k="IV skew" v={signed(fo.ivSkew)} />
        <FoMeta k="Straddle" v={inr(fo.straddle)} />
        <FoMeta k="Expected move" v={`${fo.expectedMovePct}%`} />
        <FoMeta k="Fut premium" v={`${signed(fo.futPremiumPct)}%`} />
        <FoMeta k="Max pain" v={inr(fo.maxPain, 0)} />
        <FoMeta k="Call OI" v={compact(fo.callOi)} />
        <FoMeta k="Put OI" v={compact(fo.putOi)} />
        <FoMeta k="OI build" v={fo.oiBuild.replace("-", " ")} />
      </div>
      <StockFoLadder fo={fo} />
    </div>
  );
}

function FoMeta({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-white/8 px-2.5 py-1.5">
      <p className="text-[11px] text-slate-500">{k}</p>
      <p className="font-mono capitalize tabular-nums text-slate-100">{v}</p>
    </div>
  );
}

export function StockFoList({
  rows,
  onOpen,
}: {
  rows: { symbol: string; fo: StockFo | null; change1d: number }[];
  onOpen: (symbol: string) => void;
}) {
  const listed = rows.filter((r) => r.fo?.listed).slice();
  const ranked = listed
    .sort((a, b) => Math.abs((b.fo?.pcr ?? 1) - 1) - Math.abs((a.fo?.pcr ?? 1) - 1))
    .slice(0, 6);
  if (!ranked.length) return <p className="text-sm text-slate-500">No stock F&O on this tape.</p>;
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-400">Stock F&O · PCR / IV / OI</p>
      {ranked.map((r) => {
        const fo = r.fo!;
        return (
          <button
            key={r.symbol}
            type="button"
            id={`fo-stock-${r.symbol}`}
            onClick={() => onOpen(r.symbol)}
            className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white/5"
          >
            <span className="w-[76px] truncate text-[13px] font-medium text-white">{r.symbol}</span>
            <span className="font-mono text-[12px] tabular-nums text-slate-300">PCR {fo.pcr.toFixed(2)}</span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">{fo.atmIv.toFixed(0)}% IV</span>
            <span className="ml-auto truncate text-[11px] capitalize text-slate-400">{fo.oiBuild.replace("-", " ")}</span>
          </button>
        );
      })}
    </div>
  );
}
