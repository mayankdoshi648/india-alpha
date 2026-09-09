"use client";

import { useMemo, useState } from "react";
import type { PatternKind, StockRow } from "@/lib/types";
import { PATTERN_LABEL, PATTERN_TONE, compact, fmtDate, inr } from "@/lib/format";
import { Chg, EmaPills, Sparkline } from "@/components/dashboard/primitives";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Bookmark, Download, Search } from "lucide-react";
import { downloadCsv, exportUniverseCsv } from "@/lib/export";

const FILTERS: { id: PatternKind | "all" | "watch"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "watch", label: "Watchlists" },
  { id: "breakout", label: "Breakout" },
  { id: "stage2", label: "Stage 2" },
  { id: "volume_surge", label: "Vol surge" },
  { id: "vcp", label: "VCP" },
  { id: "bullish_div", label: "Bullish div" },
  { id: "oversold_pullback", label: "Oversold" },
];

export function UniverseTable({
  rows,
  watch,
  onToggleWatch,
  onOpen,
}: {
  rows: StockRow[];
  watch: Set<string>;
  onToggleWatch: (symbol: string) => void;
  onOpen: (symbol: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [cap, setCap] = useState<"all" | "large" | "mid" | "small">("all");

  const shown = useMemo(() => {
    return rows.filter((r) => {
      if (cap !== "all" && r.cap !== cap) return false;
      if (filter === "watch" && !watch.has(r.symbol)) return false;
      if (filter !== "all" && filter !== "watch" && !r.patterns.includes(filter)) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!r.symbol.toLowerCase().includes(s) && !r.name.toLowerCase().includes(s) && !r.sector.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, q, filter, cap, watch]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, symbol, sector"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "large", "mid", "small"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCap(c)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] capitalize",
                cap === c ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px]",
                filter === f.id ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{shown.length} names in view</span>
        <button
          type="button"
          id="export-universe-csv"
          onClick={() => downloadCsv("india-desk-universe.csv", exportUniverseCsv(shown))}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 hover:bg-white/5"
        >
          <Download className="size-3.5" />
          Export CSV
        </button>
      </p>
      <div className="overflow-auto rounded-xl border border-white/8">
        <table className="min-w-[1980px] w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0b1424] text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              {[
                "",
                "Stock",
                "Cap",
                "Sector",
                "CMP",
                "1D",
                "1W",
                "1M",
                "RSI",
                "7D trend",
                "Volume",
                "Vol 1D/9D",
                "Gap %",
                "EMAs",
                "% vs 20",
                "Delivery %",
                "RS vs Nifty",
                "OI build",
                "% below 52W H",
                "% above 52W L",
                "Prev earnings",
                "Earn day",
                "Next earnings",
                "Setups",
              ].map((h) => (
                <th key={h} className="border-b border-white/8 px-2 py-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.symbol}
                id={`stock-${r.symbol}`}
                className="cursor-pointer border-b border-white/5 hover:bg-white/4"
                onClick={() => onOpen(r.symbol)}
              >
                <td className="sticky left-0 bg-[#0e1728] px-2 py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatch(r.symbol);
                    }}
                    className={cn("rounded p-1", watch.has(r.symbol) ? "text-amber-300" : "text-muted-foreground")}
                    aria-label="Watchlist"
                  >
                    <Bookmark className={cn("size-4", watch.has(r.symbol) && "fill-amber-300")} />
                  </button>
                </td>
                <td className="sticky left-9 bg-[#0e1728] px-2 py-2">
                  <button type="button" onClick={() => onOpen(r.symbol)} className="text-left hover:text-cyan-300">
                    <p className="font-medium underline-offset-2 hover:underline">{r.symbol}</p>
                    <p className="max-w-40 truncate text-[10px] text-muted-foreground">Open note · {r.name}</p>
                  </button>
                </td>
                <td className="px-2 py-2 capitalize">{r.cap}</td>
                <td className="px-2 py-2 whitespace-nowrap">{r.sector}</td>
                <td className="px-2 py-2 font-mono tabular-nums">{inr(r.cmp)}</td>
                <td className="px-2 py-2"><Chg value={r.change1d} /></td>
                <td className="px-2 py-2"><Chg value={r.change1w} /></td>
                <td className="px-2 py-2"><Chg value={r.change1m} /></td>
                <td className={cn("px-2 py-2 font-mono tabular-nums", r.rsi < 30 ? "text-lime-300" : r.rsi > 70 ? "text-rose-300" : "")}>
                  {r.rsi.toFixed(1)}
                </td>
                <td className="px-2 py-2"><Sparkline values={r.spark} /></td>
                <td className="px-2 py-2 font-mono tabular-nums">{compact(r.volume)}</td>
                <td className={cn("px-2 py-2 font-mono tabular-nums", r.volSpike >= 1.5 && "text-cyan-300")}>
                  {r.volSpike.toFixed(2)}x
                </td>
                <td className="px-2 py-2"><Chg value={r.gapPct} /></td>
                <td className="px-2 py-2"><EmaPills emas={r.emas} /></td>
                <td className="px-2 py-2"><Chg value={r.distFrom20Ema} /></td>
                <td className="px-2 py-2 font-mono tabular-nums">{r.deliveryPct.toFixed(1)}%</td>
                <td className="px-2 py-2"><Chg value={r.rsNifty} /></td>
                <td className="px-2 py-2 capitalize whitespace-nowrap">{r.oiBuild.replace("-", " ")}</td>
                <td className="px-2 py-2 font-mono tabular-nums">{r.below52wHigh.toFixed(1)}%</td>
                <td className="px-2 py-2 font-mono tabular-nums">{r.above52wLow.toFixed(1)}%</td>
                <td className="px-2 py-2 whitespace-nowrap">{fmtDate(r.prevEarningDate)}</td>
                <td className="px-2 py-2">
                  {r.earningsImpactPct === null ? "—" : <Chg value={r.earningsImpactPct} />}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{fmtDate(r.nextEarningDate)}</td>
                <td className="px-2 py-2">
                  <div className="flex max-w-56 flex-wrap gap-1">
                    {r.patterns.slice(0, 3).map((p) => (
                      <span key={p} className={cn("rounded border px-1.5 py-0.5 text-[10px]", PATTERN_TONE[p])}>
                        {PATTERN_LABEL[p]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
