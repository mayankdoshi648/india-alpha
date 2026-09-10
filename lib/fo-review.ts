import { FO_BUILD_LABEL, FO_BUILD_ORDER, foListed, oiChangePct, type FoBuildKind } from "@/lib/fo-radar";
import { round } from "@/lib/indicators";
import type { DerivativesRadar, OiBuild, StockRow } from "@/lib/types";

export type FoTableSort =
  | "symbol"
  | "close"
  | "oi"
  | "pcr"
  | "iv"
  | "move"
  | "prem"
  | "rv"
  | "ivGap";

export interface FoTableRow {
  symbol: string;
  change1d: number;
  oiPct: number;
  oiBuild: OiBuild;
  pcr: number;
  atmIv: number;
  expectedMovePct: number;
  futPremiumPct: number;
  rv20: number;
  ivGap: number;
  volSpike: number;
}

export interface UnusualFoRow extends FoTableRow {
  why: string;
}

export function parseExpiryIso(expiry: string): string | null {
  if (!expiry) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(expiry)) return expiry.slice(0, 10);
  const ms = Date.parse(expiry);
  if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  return null;
}

export function daysToExpiry(asOf: string, expiry: string): number | null {
  const iso = parseExpiryIso(expiry);
  if (!iso || !asOf) return null;
  const a = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export function expiryHint(days: number | null): string {
  if (days == null) return "Expiry date on this tape is not parsed.";
  if (days <= 0) return "Expiry session — price often pins toward max pain.";
  if (days <= 2) return "Weekly expiry is close — respect walls, don’t buy far OTM.";
  if (days <= 7) return "Inside this week’s series. Check whether names are rolling.";
  return "Further-dated series. Current-week walls still drive the pin.";
}

export function foTableRows(rows: StockRow[]): FoTableRow[] {
  const out: FoTableRow[] = [];
  for (const row of rows) {
    if (!foListed(row) || !row.fo) continue;
    const atmIv = row.fo.atmIv;
    out.push({
      symbol: row.symbol,
      change1d: row.change1d,
      oiPct: oiChangePct(row.fo),
      oiBuild: row.fo.oiBuild,
      pcr: row.fo.pcr,
      atmIv,
      expectedMovePct: row.fo.expectedMovePct,
      futPremiumPct: row.fo.futPremiumPct,
      rv20: row.rv20,
      ivGap: row.rv20 >= 5 && row.rv20 <= 80 ? round(atmIv - row.rv20, 1) : Number.NaN,
      volSpike: row.volSpike,
    });
  }
  return out;
}

export function sortFoTable(rows: FoTableRow[], sort: FoTableSort, dir: "asc" | "desc"): FoTableRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const val = (r: FoTableRow): number | string => {
    if (sort === "symbol") return r.symbol;
    if (sort === "close") return r.change1d;
    if (sort === "oi") return r.oiPct;
    if (sort === "pcr") return r.pcr;
    if (sort === "iv") return r.atmIv;
    if (sort === "move") return r.expectedMovePct;
    if (sort === "prem") return r.futPremiumPct;
    if (sort === "rv") return r.rv20;
    return r.ivGap;
  };
  return [...rows].sort((a, b) => {
    const av = val(a);
    const bv = val(b);
    if (typeof av === "string" && typeof bv === "string") return sign * av.localeCompare(bv);
    return sign * ((av as number) - (bv as number));
  });
}

export function unusualFoRows(rows: FoTableRow[], limit = 10): UnusualFoRow[] {
  return [...rows]
    .map((r) => {
      const score = Math.abs(r.oiPct) * 0.45 + Math.max(0, r.volSpike - 1) * 7 + Math.abs(r.change1d) * 1.6;
      const bits = [
        `${r.oiBuild.replace("-", " ")}`,
        `OI ${r.oiPct >= 0 ? "+" : ""}${r.oiPct.toFixed(1)}%`,
        `vol ${r.volSpike.toFixed(1)}×`,
      ];
      return { ...r, score, why: bits.join(" · ") };
    })
    .filter((r) => Math.abs(r.oiPct) >= 1.2 || r.volSpike >= 1.6 || Math.abs(r.change1d) >= 1.4)
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit)
    .map(({ score: _s, ...row }) => row);
}

export function premiumTape(rows: FoTableRow[], take = 6) {
  const ranked = [...rows].sort((a, b) => b.futPremiumPct - a.futPremiumPct);
  return {
    contango: ranked.slice(0, take),
    backwardation: [...ranked].reverse().slice(0, take),
  };
}

export function ivVsRealized(rows: FoTableRow[], take = 6) {
  const ranked = [...rows].filter((r) => Number.isFinite(r.ivGap)).sort((a, b) => b.ivGap - a.ivGap);
  return {
    rich: ranked.filter((r) => r.ivGap > 0).slice(0, take),
    cheap: [...ranked].reverse().filter((r) => r.ivGap < 0).slice(0, take),
  };
}

export function rolloverWatch(rows: FoTableRow[], days: number | null, take = 8): FoTableRow[] {
  if (days == null || days > 4) return [];
  return [...rows]
    .filter((r) => Math.abs(r.futPremiumPct) >= 0.25)
    .sort((a, b) => Math.abs(b.futPremiumPct) - Math.abs(a.futPremiumPct))
    .slice(0, take);
}

export function buildCounts(rows: StockRow[]): Record<FoBuildKind | "neutral", number> {
  const counts: Record<FoBuildKind | "neutral", number> = {
    "short-build": 0,
    "long-build": 0,
    "long-unwind": 0,
    "short-cover": 0,
    neutral: 0,
  };
  for (const row of rows) {
    if (!foListed(row)) continue;
    const k = row.fo?.oiBuild ?? row.oiBuild;
    if (k in counts) counts[k] += 1;
  }
  return counts;
}

export function bookLine(counts: Record<FoBuildKind | "neutral", number>): string {
  const short = counts["short-build"];
  const long = counts["long-build"];
  if (short >= long * 2 && short >= 6) return "Book is short-heavy — don’t fade the index short from one green name.";
  if (long >= short * 2 && long >= 6) return "Book is long-heavy — dips are more likely bought than sold.";
  return "Mixed book — stock-pick from streaks, don’t take a Nifty side from F&O alone.";
}

export { FO_BUILD_LABEL, FO_BUILD_ORDER };

export function sessionOiPath(radar: DerivativesRadar): number[] {
  return (radar.pcrHistory ?? []).slice(-20).map((p) => p.pcr);
}
