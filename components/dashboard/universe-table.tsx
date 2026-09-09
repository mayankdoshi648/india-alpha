"use client";

import { useMemo, useState } from "react";
import type { PatternKind, RotationQuadrant, StockRow } from "@/lib/types";
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

const QUAD: Record<RotationQuadrant, string> = {
  leading: "Leading",
  improving: "Improving",
  weakening: "Weakening",
  lagging: "Lagging",
};

const QUAD_COLOR: Record<RotationQuadrant, string> = {
  leading: "#34d399",
  improving: "#22d3ee",
  weakening: "#fbbf24",
  lagging: "#fb7185",
};

const QUADS: RotationQuadrant[] = ["leading", "improving", "weakening", "lagging"];

const HEADERS = [
  "",
  "Stock",
  "N50",
  "Cap",
  "Sector",
  "Sector RS",
  "CMP",
  "Day H",
  "Day L",
  "Range pos",
  "1D",
  "1W",
  "1M",
  "3M",
  "Streak",
  "Beta",
  "RSI",
  "RSI>MA",
  "7D trend",
  "Volume",
  "Avg vol",
  "Turnover",
  "Vol 1D/9D",
  "ATR %",
  "RV 20d",
  "CMF",
  "Gap %",
  "vs VWAP",
  "EMAs",
  "Daily stack",
  "Weekly stack",
  "Days >20",
  "% vs 20",
  "% vs 50",
  "% vs 200",
  "Pivot",
  "10/20 cross",
  "Delivery %",
  "RS vs Nifty",
  "OI build",
  "52W pos",
  "52W high",
  "52W low",
  "% below 52W H",
  "% above 52W L",
  "Stage 2",
  "Days to earn",
  "Prev earnings",
  "Earn day",
  "Next earnings",
  "Setups",
];

function RangeBar({ value, tone = "amber" }: { value: number; tone?: "amber" | "cyan" }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded bg-white/10">
        <div
          className={cn("h-full rounded", tone === "cyan" ? "bg-cyan-400" : "bg-amber-300")}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

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
  const [sector, setSector] = useState("all");
  const [quad, setQuad] = useState<RotationQuadrant | "all">("all");

  const sectors = useMemo(
    () => [...new Set(rows.map((r) => r.sector))].sort(),
    [rows],
  );

  const shown = useMemo(() => {
    return rows.filter((r) => {
      if (cap !== "all" && r.cap !== cap) return false;
      if (sector !== "all" && r.sector !== sector) return false;
      if (quad !== "all" && r.sectorQuad !== quad) return false;
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
  }, [rows, q, filter, cap, sector, quad, watch]);

  const stats = useMemo(() => {
    const counts: Record<RotationQuadrant, number> = { leading: 0, improving: 0, weakening: 0, lagging: 0 };
    let above200 = 0;
    let bull = 0;
    let stage2 = 0;
    let earnSoon = 0;
    let oversold = 0;
    for (const r of shown) {
      counts[r.sectorQuad]++;
      if (r.distFrom200 >= 0) above200++;
      if (r.emaStack === "bullish") bull++;
      if (r.stage2Score >= 5) stage2++;
      if (r.daysToEarnings != null && r.daysToEarnings <= 14) earnSoon++;
      if (r.rsi < 30) oversold++;
    }
    return { n: shown.length, counts, above200, bull, stage2, earnSoon, oversold };
  }, [shown]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {QUADS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuad(quad === q ? "all" : q)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left",
              quad === q ? "border-white/30 bg-white/5" : "border-white/8 bg-card/60",
            )}
          >
            <p className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: QUAD_COLOR[q] }}>
              <span className="size-2 rounded-full" style={{ background: QUAD_COLOR[q] }} />
              {QUAD[q]}
            </p>
            <p className="font-mono text-lg tabular-nums">{stats.counts[q]}</p>
          </button>
        ))}
        <div className="rounded-xl border border-white/8 bg-card/60 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Above 200 EMA</p>
          <p className="font-mono text-lg tabular-nums">{stats.above200}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-card/60 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Bullish stack</p>
          <p className="font-mono text-lg tabular-nums">{stats.bull}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-card/60 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Stage 2 ≥5</p>
          <p className="font-mono text-lg tabular-nums">{stats.stage2}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-card/60 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Earn ≤14d · RSI&lt;30</p>
          <p className="font-mono text-lg tabular-nums">
            {stats.earnSoon} · {stats.oversold}
          </p>
        </div>
      </div>
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
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSector("all")}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px]",
            sector === "all" ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-muted-foreground",
          )}
        >
          All sectors
        </button>
        {sectors.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSector(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              sector === s ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-muted-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{stats.n} names in view</span>
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
        <table className="min-w-[3200px] w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0b1424] text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              {HEADERS.map((h) => (
                <th key={h || "watch"} className="border-b border-white/8 px-2 py-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-10 text-center text-muted-foreground">
                  No names match these filters. Clear sector, cap or setup chips to widen the tape.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
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
                  <td className="px-2 py-2">{r.nifty50 ? "Y" : ""}</td>
                  <td className="px-2 py-2 capitalize">{r.cap}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.sector}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 capitalize" style={{ color: QUAD_COLOR[r.sectorQuad] }}>
                      <span className="size-1.5 rounded-full" style={{ background: QUAD_COLOR[r.sectorQuad] }} />
                      {r.sectorQuad}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums">{inr(r.cmp)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{inr(r.dayHigh)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{inr(r.dayLow)}</td>
                  <td className="px-2 py-2"><RangeBar value={r.rangePos} /></td>
                  <td className="px-2 py-2"><Chg value={r.change1d} /></td>
                  <td className="px-2 py-2"><Chg value={r.change1w} /></td>
                  <td className="px-2 py-2"><Chg value={r.change1m} /></td>
                  <td className="px-2 py-2"><Chg value={r.change3m} /></td>
                  <td className={cn("px-2 py-2 font-mono tabular-nums", r.streak > 0 ? "text-emerald-300" : r.streak < 0 ? "text-rose-300" : "")}>
                    {r.streak > 0 ? `+${r.streak}` : r.streak}
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.beta.toFixed(2)}</td>
                  <td className={cn("px-2 py-2 font-mono tabular-nums", r.rsi < 30 ? "text-lime-300" : r.rsi > 70 ? "text-rose-300" : "")}>
                    {r.rsi.toFixed(1)}
                  </td>
                  <td className="px-2 py-2">{r.rsiAboveMa ? "Yes" : "No"}</td>
                  <td className="px-2 py-2"><Sparkline values={r.spark} /></td>
                  <td className="px-2 py-2 font-mono tabular-nums">{compact(r.volume)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{compact(r.avgVolume)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{compact(r.turnover)}</td>
                  <td className={cn("px-2 py-2 font-mono tabular-nums", r.volSpike >= 1.5 && "text-cyan-300")}>
                    {r.volSpike.toFixed(2)}x
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.atrPct.toFixed(2)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.rv20.toFixed(1)}</td>
                  <td className={cn("px-2 py-2 font-mono tabular-nums", r.cmf > 0 ? "text-emerald-300" : "text-rose-300")}>
                    {r.cmf.toFixed(2)}
                  </td>
                  <td className="px-2 py-2"><Chg value={r.gapPct} /></td>
                  <td className="px-2 py-2"><Chg value={r.vwapDist} /></td>
                  <td className="px-2 py-2"><EmaPills emas={r.emas} /></td>
                  <td className="px-2 py-2 capitalize">{r.emaStack}</td>
                  <td className="px-2 py-2 capitalize">{r.weeklyStack}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.daysAbove20}</td>
                  <td className="px-2 py-2"><Chg value={r.distFrom20Ema} /></td>
                  <td className="px-2 py-2"><Chg value={r.distFrom50} /></td>
                  <td className="px-2 py-2"><Chg value={r.distFrom200} /></td>
                  <td className="px-2 py-2">{r.abovePivot ? "Above" : "Below"}</td>
                  <td className="px-2 py-2">{r.bullishCross ? "Bullish" : "—"}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.deliveryPct.toFixed(1)}%</td>
                  <td className="px-2 py-2"><Chg value={r.rsNifty} /></td>
                  <td className="px-2 py-2 capitalize whitespace-nowrap">{r.oiBuild.replace("-", " ")}</td>
                  <td className="px-2 py-2">
                    <RangeBar value={r.pos52w} tone="cyan" />
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums">{inr(r.high52)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{inr(r.low52)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.below52wHigh.toFixed(1)}%</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.above52wLow.toFixed(1)}%</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.stage2Score}/7</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{r.daysToEarnings ?? "—"}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
