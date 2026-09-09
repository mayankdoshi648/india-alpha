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

type ColId =
  | "watch" | "stock" | "n50" | "cap" | "sector" | "quad" | "cmp"
  | "dayH" | "dayL" | "range" | "d1" | "w1" | "m1" | "m3" | "streak" | "beta"
  | "rsi" | "rsiMa" | "spark" | "vol" | "avgVol" | "turn" | "volx" | "atr" | "rv"
  | "cmf" | "gap" | "vwap" | "emas" | "stack" | "weekly" | "days20"
  | "vs20" | "vs50" | "vs200" | "pivot" | "cross" | "deliv" | "rs" | "oi"
  | "pos52" | "high52" | "low52" | "belowH" | "aboveL" | "s2"
  | "earnDays" | "prevEarn" | "earnDay" | "nextEarn" | "setups";

type Preset = "core" | "tape" | "structure" | "flow" | "earnings" | "all";

const PRESET_COLS: Record<Preset, Set<ColId> | "*"> = {
  core: new Set(["watch", "stock", "n50", "sector", "quad", "cmp", "d1", "w1", "rsi", "volx", "stack", "vs20", "pos52", "s2", "setups"]),
  tape: new Set(["watch", "stock", "n50", "sector", "quad", "cmp", "dayH", "dayL", "range", "d1", "w1", "m1", "m3", "streak", "beta", "rsi", "spark", "volx", "gap"]),
  structure: new Set(["watch", "stock", "sector", "cmp", "emas", "stack", "weekly", "days20", "vs20", "vs50", "vs200", "pivot", "cross", "pos52", "high52", "low52", "s2"]),
  flow: new Set(["watch", "stock", "sector", "cmp", "d1", "vol", "avgVol", "turn", "volx", "atr", "rv", "cmf", "vwap", "deliv", "oi", "rs"]),
  earnings: new Set(["watch", "stock", "sector", "cmp", "d1", "rsi", "s2", "earnDays", "prevEarn", "earnDay", "nextEarn", "setups"]),
  all: "*",
};

const COLS: { id: ColId; label: string }[] = [
  { id: "watch", label: "" },
  { id: "stock", label: "Stock" },
  { id: "n50", label: "N50" },
  { id: "cap", label: "Cap" },
  { id: "sector", label: "Sector" },
  { id: "quad", label: "Sector RS" },
  { id: "cmp", label: "CMP" },
  { id: "dayH", label: "Day H" },
  { id: "dayL", label: "Day L" },
  { id: "range", label: "Range pos" },
  { id: "d1", label: "1D" },
  { id: "w1", label: "1W" },
  { id: "m1", label: "1M" },
  { id: "m3", label: "3M" },
  { id: "streak", label: "Streak" },
  { id: "beta", label: "Beta" },
  { id: "rsi", label: "RSI" },
  { id: "rsiMa", label: "RSI>MA" },
  { id: "spark", label: "7D trend" },
  { id: "vol", label: "Volume" },
  { id: "avgVol", label: "Avg vol" },
  { id: "turn", label: "Turnover" },
  { id: "volx", label: "Vol 1D/9D" },
  { id: "atr", label: "ATR %" },
  { id: "rv", label: "RV 20d" },
  { id: "cmf", label: "CMF" },
  { id: "gap", label: "Gap %" },
  { id: "vwap", label: "vs VWAP" },
  { id: "emas", label: "EMAs" },
  { id: "stack", label: "Daily stack" },
  { id: "weekly", label: "Weekly stack" },
  { id: "days20", label: "Days >20" },
  { id: "vs20", label: "% vs 20" },
  { id: "vs50", label: "% vs 50" },
  { id: "vs200", label: "% vs 200" },
  { id: "pivot", label: "Pivot" },
  { id: "cross", label: "10/20 cross" },
  { id: "deliv", label: "Delivery %" },
  { id: "rs", label: "RS vs Nifty" },
  { id: "oi", label: "OI build" },
  { id: "pos52", label: "52W pos" },
  { id: "high52", label: "52W high" },
  { id: "low52", label: "52W low" },
  { id: "belowH", label: "% below 52W H" },
  { id: "aboveL", label: "% above 52W L" },
  { id: "s2", label: "Stage 2" },
  { id: "earnDays", label: "Days to earn" },
  { id: "prevEarn", label: "Prev earnings" },
  { id: "earnDay", label: "Earn day" },
  { id: "nextEarn", label: "Next earnings" },
  { id: "setups", label: "Setups" },
];

const WIDTH: Record<Preset, string> = {
  core: "min-w-[1180px]",
  tape: "min-w-[1680px]",
  structure: "min-w-[1580px]",
  flow: "min-w-[1480px]",
  earnings: "min-w-[1180px]",
  all: "min-w-[3200px]",
};

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
  const [preset, setPreset] = useState<Preset>("core");
  const shownCol = (id: ColId) => {
    const cols = PRESET_COLS[preset];
    return cols === "*" || cols.has(id);
  };
  const hide = (id: ColId) => (shownCol(id) ? "" : "hidden");

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
      <div id="universe-quad-counts" className="grid grid-cols-4 gap-1.5 xl:grid-cols-8">
        {QUADS.map((q) => (
          <button
            key={q}
            type="button"
            aria-pressed={quad === q}
            onClick={() => setQuad(quad === q ? "all" : q)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-left",
              quad === q ? "border-white/30 bg-white/5" : "border-white/8 bg-card/60",
            )}
          >
            <p className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: QUAD_COLOR[q] }}>
              <span className="size-1.5 rounded-full" style={{ background: QUAD_COLOR[q] }} />
              {QUAD[q]}
            </p>
            <p className="font-mono text-base tabular-nums">{stats.counts[q]}</p>
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
        <span>
          {stats.n} names in view
          {quad !== "all" ? ` · ${QUAD[quad]} only` : ""}
          {sector !== "all" ? ` · ${sector}` : ""}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {(["core", "tape", "structure", "flow", "earnings", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] capitalize",
                preset === p ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-muted-foreground",
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            id="export-universe-csv"
            onClick={() => downloadCsv("india-desk-universe.csv", exportUniverseCsv(shown))}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 hover:bg-white/5"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </span>
      </p>
      <div className="overflow-auto rounded-lg border border-white/8">
        <table className={cn("w-full border-collapse text-left text-xs", WIDTH[preset])}>
          <thead className="sticky top-0 z-10 bg-[#0b1424] text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              {COLS.map((h) => (
                <th
                  key={h.id}
                  className={cn("border-b border-white/8 px-2 py-2 font-medium whitespace-nowrap", hide(h.id))}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-10 text-center text-muted-foreground">
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
                  <td className={cn("sticky left-0 bg-[#0e1728] px-2 py-1.5", hide("watch"))}>
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
                  <td className={cn("sticky left-9 bg-[#0e1728] px-2 py-1.5", hide("stock"))}>
                    <button type="button" onClick={() => onOpen(r.symbol)} className="text-left hover:text-cyan-300">
                      <p className="font-medium underline-offset-2 hover:underline">{r.symbol}</p>
                      <p className="max-w-40 truncate text-[10px] text-muted-foreground">{r.name}</p>
                    </button>
                  </td>
                  <td className={cn("px-2 py-1.5", hide("n50"))}>{r.nifty50 ? "Y" : ""}</td>
                  <td className={cn("px-2 py-1.5 capitalize", hide("cap"))}>{r.cap}</td>
                  <td className={cn("px-2 py-1.5 whitespace-nowrap", hide("sector"))}>{r.sector}</td>
                  <td className={cn("px-2 py-1.5 whitespace-nowrap", hide("quad"))}>
                    <span className="inline-flex items-center gap-1 capitalize" style={{ color: QUAD_COLOR[r.sectorQuad] }}>
                      <span className="size-1.5 rounded-full" style={{ background: QUAD_COLOR[r.sectorQuad] }} />
                      {r.sectorQuad}
                    </span>
                  </td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("cmp"))}>{inr(r.cmp)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("dayH"))}>{inr(r.dayHigh)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("dayL"))}>{inr(r.dayLow)}</td>
                  <td className={cn("px-2 py-1.5", hide("range"))}><RangeBar value={r.rangePos} /></td>
                  <td className={cn("px-2 py-1.5", hide("d1"))}><Chg value={r.change1d} /></td>
                  <td className={cn("px-2 py-1.5", hide("w1"))}><Chg value={r.change1w} /></td>
                  <td className={cn("px-2 py-1.5", hide("m1"))}><Chg value={r.change1m} /></td>
                  <td className={cn("px-2 py-1.5", hide("m3"))}><Chg value={r.change3m} /></td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("streak"), r.streak > 0 ? "text-emerald-300" : r.streak < 0 ? "text-rose-300" : "")}>
                    {r.streak > 0 ? `+${r.streak}` : r.streak}
                  </td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("beta"))}>{r.beta.toFixed(2)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("rsi"), r.rsi < 30 ? "text-lime-300" : r.rsi > 70 ? "text-rose-300" : "")}>
                    {r.rsi.toFixed(1)}
                  </td>
                  <td className={cn("px-2 py-1.5", hide("rsiMa"))}>{r.rsiAboveMa ? "Yes" : "No"}</td>
                  <td className={cn("px-2 py-1.5", hide("spark"))}><Sparkline values={r.spark} /></td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("vol"))}>{compact(r.volume)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("avgVol"))}>{compact(r.avgVolume)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("turn"))}>{compact(r.turnover)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("volx"), r.volSpike >= 1.5 && "text-cyan-300")}>
                    {r.volSpike.toFixed(2)}x
                  </td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("atr"))}>{r.atrPct.toFixed(2)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("rv"))}>{r.rv20.toFixed(1)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("cmf"), r.cmf > 0 ? "text-emerald-300" : "text-rose-300")}>
                    {r.cmf.toFixed(2)}
                  </td>
                  <td className={cn("px-2 py-1.5", hide("gap"))}><Chg value={r.gapPct} /></td>
                  <td className={cn("px-2 py-1.5", hide("vwap"))}><Chg value={r.vwapDist} /></td>
                  <td className={cn("px-2 py-1.5", hide("emas"))}><EmaPills emas={r.emas} /></td>
                  <td className={cn("px-2 py-1.5 capitalize", hide("stack"))}>{r.emaStack}</td>
                  <td className={cn("px-2 py-1.5 capitalize", hide("weekly"))}>{r.weeklyStack}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("days20"))}>{r.daysAbove20}</td>
                  <td className={cn("px-2 py-1.5", hide("vs20"))}><Chg value={r.distFrom20Ema} /></td>
                  <td className={cn("px-2 py-1.5", hide("vs50"))}><Chg value={r.distFrom50} /></td>
                  <td className={cn("px-2 py-1.5", hide("vs200"))}><Chg value={r.distFrom200} /></td>
                  <td className={cn("px-2 py-1.5", hide("pivot"))}>{r.abovePivot ? "Above" : "Below"}</td>
                  <td className={cn("px-2 py-1.5", hide("cross"))}>{r.bullishCross ? "Bullish" : "—"}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("deliv"))}>{r.deliveryPct.toFixed(1)}%</td>
                  <td className={cn("px-2 py-1.5", hide("rs"))}><Chg value={r.rsNifty} /></td>
                  <td className={cn("px-2 py-1.5 capitalize whitespace-nowrap", hide("oi"))}>{r.oiBuild.replace("-", " ")}</td>
                  <td className={cn("px-2 py-1.5", hide("pos52"))}>
                    <RangeBar value={r.pos52w} tone="cyan" />
                  </td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("high52"))}>{inr(r.high52)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("low52"))}>{inr(r.low52)}</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("belowH"))}>{r.below52wHigh.toFixed(1)}%</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("aboveL"))}>{r.above52wLow.toFixed(1)}%</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("s2"))}>{r.stage2Score}/7</td>
                  <td className={cn("px-2 py-1.5 font-mono tabular-nums", hide("earnDays"))}>{r.daysToEarnings ?? "—"}</td>
                  <td className={cn("px-2 py-1.5 whitespace-nowrap", hide("prevEarn"))}>{fmtDate(r.prevEarningDate)}</td>
                  <td className={cn("px-2 py-1.5", hide("earnDay"))}>
                    {r.earningsImpactPct === null ? "—" : <Chg value={r.earningsImpactPct} />}
                  </td>
                  <td className={cn("px-2 py-1.5 whitespace-nowrap", hide("nextEarn"))}>{fmtDate(r.nextEarningDate)}</td>
                  <td className={cn("px-2 py-1.5", hide("setups"))}>
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
