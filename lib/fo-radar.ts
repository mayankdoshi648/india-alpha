import { pct, round } from "@/lib/indicators";
import type { ChartPoint, OiBuild, StockFo, StockRow } from "@/lib/types";

export type FoChipTone = OiBuild;

export type FoTagId =
  | "volume-spike"
  | "oi-surge"
  | "price-shock"
  | "idiosyncratic"
  | "gap-open"
  | "range-expansion"
  | "options-frenzy"
  | "pcr-shift"
  | "block-prints";

export interface FoDayChip {
  date: string;
  label: string;
  tone: FoChipTone;
}

export type FoBuildKind = Exclude<OiBuild, "neutral">;

export interface FoBuildupStreak {
  symbol: string;
  kind: FoBuildKind;
  days: number;
  pxPct: number;
  oiPct: number;
  chips: FoDayChip[];
}

export const FO_BUILD_ORDER: FoBuildKind[] = ["short-build", "long-build", "long-unwind", "short-cover"];

export const FO_BUILD_LABEL: Record<FoBuildKind, string> = {
  "short-build": "Short Buildup",
  "long-build": "Long Buildup",
  "long-unwind": "Long Unwinding",
  "short-cover": "Short Unwinding",
};

export interface FoStandout {
  symbol: string;
  score: number;
  tags: FoTagId[];
  blurb: string;
  volX: number;
  volZ: number;
  oiPct: number;
  oiZ: number;
  pxPct: number;
  pxZ: number;
  vsNifty: number;
  optX: number;
  pcr: number | null;
  pcrZ: number | null;
  ticketX: number;
}

export const FO_TAG_LABEL: Record<FoTagId, string> = {
  "volume-spike": "Volume spike",
  "oi-surge": "OI surge",
  "price-shock": "Price shock",
  idiosyncratic: "Idiosyncratic move",
  "gap-open": "Gap open",
  "range-expansion": "Range expansion",
  "options-frenzy": "Options frenzy",
  "pcr-shift": "PCR shift",
  "block-prints": "Block prints",
};

const CHIP_WINDOW = 10;
const STREAK_MIN = 3;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function chipDateLabel(iso: string): string {
  const parts = iso.slice(0, 10).split("-");
  if (parts.length < 3) return iso;
  const day = parts[2];
  const month = MONTHS[Number(parts[1]) - 1] ?? parts[1];
  return `${day} ${month}`;
}

export function oiChangePct(fo: StockFo | null | undefined): number {
  if (!fo) return 0;
  if (typeof fo.oiChgPct === "number" && Number.isFinite(fo.oiChgPct)) return fo.oiChgPct;
  const callChg = fo.ladder.reduce((s, x) => s + (x.callOiChg || 0), 0);
  const putChg = fo.ladder.reduce((s, x) => s + (x.putOiChg || 0), 0);
  const den = fo.callOi + fo.putOi;
  if (!den) return 0;
  return round(((callChg + putChg) / den) * 100, 2);
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 1;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v) || 1;
}

function zScore(xs: number[], value: number): number {
  return round((value - mean(xs)) / stdev(xs), 1);
}

function sessionDates(asOf: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${asOf.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return out;
  while (out.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

function classifyPair(prev: ChartPoint, cur: ChartPoint): OiBuild {
  const px = pct(prev.close, cur.close);
  const volUp = cur.volume >= prev.volume;
  if (px <= -0.05 && volUp) return "short-build";
  if (px >= 0.05 && volUp) return "long-build";
  if (px >= 0.05) return "short-cover";
  if (px <= -0.05) return "long-unwind";
  return "neutral";
}

export function classifyChips(row: StockRow, asOf: string): FoDayChip[] {
  const chart = row.chart ?? [];
  if (chart.length >= 2) {
    const window = chart.slice(-(CHIP_WINDOW + 1));
    const chips: FoDayChip[] = [];
    for (let i = 1; i < window.length; i++) {
      const tone = classifyPair(window[i - 1], window[i]);
      chips.push({
        date: window[i].date,
        label: chipDateLabel(window[i].date),
        tone,
      });
    }
    const lastChip = chips[chips.length - 1];
    if (lastChip && row.oiBuild !== "neutral") {
      lastChip.tone = row.oiBuild;
    }
    return chips.slice(-CHIP_WINDOW);
  }

  const dates = sessionDates(asOf || chart[chart.length - 1]?.date || "", CHIP_WINDOW);
  const downDays = row.streak < 0 ? Math.min(CHIP_WINDOW, Math.abs(row.streak)) : 0;
  return dates.map((date, i) => {
    const fromEnd = dates.length - 1 - i;
    let tone: FoChipTone = "neutral";
    if (fromEnd < downDays) {
      tone = row.oiBuild === "long-unwind" ? "long-unwind" : "short-build";
    } else if (row.streak > 0 && fromEnd < Math.min(CHIP_WINDOW, row.streak)) {
      tone = row.oiBuild === "short-cover" ? "short-cover" : "long-build";
    }
    if (i === dates.length - 1 && row.oiBuild !== "neutral") {
      if (isDownTone(tone) && isDownTone(row.oiBuild)) tone = row.oiBuild;
      if (isUpTone(tone) && isUpTone(row.oiBuild)) tone = row.oiBuild;
    }
    return { date, label: chipDateLabel(date), tone };
  });
}

function isDownTone(tone: FoChipTone): boolean {
  return tone === "short-build" || tone === "long-unwind";
}

function isUpTone(tone: FoChipTone): boolean {
  return tone === "long-build" || tone === "short-cover";
}

function trailingKindDays(chips: FoDayChip[], kind: FoBuildKind): number {
  const down = isDownTone(kind);
  let i = chips.length - 1;
  while (i >= 0 && chips[i].tone === "neutral") i--;
  if (i < 0 || chips[i].tone !== kind) return 0;
  let n = 0;
  for (; i >= 0; i--) {
    const tone = chips[i].tone;
    if (tone === "neutral") continue;
    if (down ? isDownTone(tone) : isUpTone(tone)) n++;
    else break;
  }
  return n;
}

export function foListed(row: StockRow): boolean {
  return Boolean(row.fo?.listed);
}

export function buildupStreaks(
  rows: StockRow[],
  asOf: string,
  tone: FoBuildKind,
  minDays = STREAK_MIN,
): FoBuildupStreak[] {
  const out: FoBuildupStreak[] = [];
  for (const row of rows) {
    if (!foListed(row)) continue;
    const chips = classifyChips(row, asOf);
    const days = trailingKindDays(chips, tone);
    if (days < minDays) continue;
    out.push({
      symbol: row.symbol,
      kind: tone,
      days,
      pxPct: row.change1d,
      oiPct: oiChangePct(row.fo),
      chips,
    });
  }
  out.sort((a, b) => b.days - a.days || Math.abs(b.oiPct) - Math.abs(a.oiPct) || a.symbol.localeCompare(b.symbol));
  return out.slice(0, 12);
}

export function shortBuildupStreaks(rows: StockRow[], asOf: string, minDays = STREAK_MIN): FoBuildupStreak[] {
  return buildupStreaks(rows, asOf, "short-build", minDays);
}

function optionActivityX(row: StockRow): number {
  const fo = row.fo;
  const ivMul = fo && fo.atmIv > 0 ? Math.min(2.4, Math.max(0.7, fo.atmIv / 18)) : 1;
  const moveMul = fo && fo.expectedMovePct > 0 ? Math.min(2.2, Math.max(0.7, fo.expectedMovePct / 1.15)) : 1;
  return round(Math.max(0.8, row.volSpike * ivMul * moveMul), 1);
}

function ticketX(row: StockRow): number {
  return round(Math.max(0.4, row.volSpike * (0.72 + Math.min(0.55, Math.abs(row.change1d) / 8))), 1);
}

function pickTags(
  row: StockRow,
  z: {
    vol: number;
    oi: number;
    px: number;
    gap: number;
    rs: number;
    atr: number;
    em: number;
    pcr: number | null;
    turn: number;
    opt: number;
  },
  oiPct: number,
  ticket: number,
): FoTagId[] {
  const tags: FoTagId[] = [];
  if (z.vol >= 1.05 && row.volSpike >= 1.55) tags.push("volume-spike");
  if (Math.abs(z.oi) >= 1.15 && Math.abs(oiPct) >= 3.2) tags.push("oi-surge");
  if (Math.abs(z.px) >= 1.05 && Math.abs(row.change1d) >= 1.5) tags.push("price-shock");
  if (Math.abs(z.rs) >= 1.05 && Math.abs(row.rsNifty) >= 1.6) tags.push("idiosyncratic");
  if (Math.abs(z.gap) >= 1.2 && Math.abs(row.gapPct) >= 0.55) tags.push("gap-open");
  if (z.atr >= 1.15 && row.atrPct >= 2.25) tags.push("range-expansion");
  if (z.em >= 1.05 || (z.opt >= 1.2 && row.volSpike >= 1.7)) tags.push("options-frenzy");
  if (z.pcr != null && Math.abs(z.pcr) >= 1.4) tags.push("pcr-shift");
  if (z.turn >= 1.25 && row.volSpike >= 1.55 && ticket >= 1.2) tags.push("block-prints");
  return tags;
}

function closingLine(row: StockRow, tags: FoTagId[], oiPct: number): string {
  if (tags.includes("block-prints")) {
    return "Average ticket size is unusually large, the footprint of institutional or prop flow rather than retail.";
  }
  if (tags.includes("pcr-shift") && !tags.includes("price-shock")) {
    return "The put-call OI balance moved outside its normal band, so the options crowd repositioned.";
  }
  if (row.oiBuild === "short-build" && row.change1d < 0 && oiPct > 0) {
    return "Aggressive new shorts are pressing the move; conviction is high on the day.";
  }
  if (tags.includes("range-expansion") || tags.includes("price-shock")) {
    return "Intraday volatility expanded well past normal — news or a stop cascade.";
  }
  if (row.oiBuild === "long-build" && row.change1d > 0) {
    return "Fresh longs are being added into strength.";
  }
  if (row.oiBuild === "short-cover") {
    return "Price is up while OI eases — shorts covering rather than a fresh long build.";
  }
  return "The tape printed outside its recent distribution, so positioning is being rewritten.";
}

function standoutBlurb(row: StockRow, item: Omit<FoStandout, "symbol" | "score" | "tags" | "blurb">, tags: FoTagId[]): string {
  const bits = [
    `Futures volume ${item.volX.toFixed(1)}× its baseline (z ${signedZ(item.volZ)})`,
    `OI ${signedPct(item.oiPct)} (z ${signedZ(item.oiZ)})`,
    `price ${signedPct(item.pxPct)} (z ${signedZ(item.pxZ)})`,
    `${signedPct(item.vsNifty)} versus Nifty`,
    `option contracts ${item.optX.toFixed(1)}× baseline`,
  ];
  if (item.pcr != null && item.pcrZ != null && tags.includes("pcr-shift")) {
    bits.push(`OI PCR ${item.pcr.toFixed(2)} (z ${signedZ(item.pcrZ)})`);
  }
  if (tags.includes("block-prints")) {
    bits.push(`average ticket ${item.ticketX.toFixed(1)}× normal`);
  }
  return `${bits.join("; ")}. ${closingLine(row, tags, item.oiPct)}`;
}

function signedPct(n: number): string {
  const v = `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  return v;
}

function signedZ(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}

function standoutScore(
  tags: FoTagId[],
  z: { vol: number; px: number; oi: number; rs: number; em: number },
): number {
  let score = 7.4 + tags.length * 0.55;
  score += Math.min(1.8, Math.max(0, z.vol) * 0.55);
  score += Math.min(1.6, Math.abs(z.px) * 0.4);
  score += Math.min(1.2, Math.abs(z.oi) * 0.35);
  score += Math.min(1.0, Math.abs(z.rs) * 0.25);
  score += Math.min(0.8, Math.max(0, z.em) * 0.3);
  return round(Math.max(8.2, Math.min(13.4, score)), 1);
}

export function foStandouts(rows: StockRow[], limit = 8, niftyChange = 0): FoStandout[] {
  const listed = rows.filter(foListed);
  if (!listed.length) return [];
  const volXs = listed.map((r) => r.volSpike);
  const oiXs = listed.map((r) => oiChangePct(r.fo));
  const pxXs = listed.map((r) => r.change1d);
  const gapXs = listed.map((r) => r.gapPct);
  const rsXs = listed.map((r) => r.rsNifty);
  const atrXs = listed.map((r) => r.atrPct);
  const emXs = listed.map((r) => r.fo?.expectedMovePct ?? 0);
  const pcrXs = listed.filter((r) => r.fo).map((r) => r.fo!.pcr);
  const turnXs = listed.map((r) => r.turnover);
  const optXs = listed.map((r) => optionActivityX(r));

  const scored: FoStandout[] = [];
  for (const row of listed) {
    const oiPct = oiChangePct(row.fo);
    const optX = optionActivityX(row);
    const ticket = ticketX(row);
    const z = {
      vol: zScore(volXs, row.volSpike),
      oi: zScore(oiXs, oiPct),
      px: zScore(pxXs, row.change1d),
      gap: zScore(gapXs, row.gapPct),
      rs: zScore(rsXs, row.rsNifty),
      atr: zScore(atrXs, row.atrPct),
      em: zScore(emXs, row.fo?.expectedMovePct ?? 0),
      pcr: row.fo && pcrXs.length ? zScore(pcrXs, row.fo.pcr) : null,
      turn: zScore(turnXs, row.turnover),
      opt: zScore(optXs, optX),
    };
    const tags = pickTags(row, z, oiPct, ticket);
    if (tags.length < 2) continue;
    const stats = {
      volX: round(row.volSpike, 1),
      volZ: z.vol,
      oiPct: round(oiPct, 1),
      oiZ: z.oi,
      pxPct: round(row.change1d, 1),
      pxZ: z.px,
      vsNifty: round(row.change1d - niftyChange, 1),
      optX,
      pcr: row.fo ? row.fo.pcr : null,
      pcrZ: z.pcr,
      ticketX: ticket,
    };
    const score = standoutScore(tags, z);
    scored.push({
      symbol: row.symbol,
      score,
      tags,
      blurb: standoutBlurb(row, stats, tags),
      ...stats,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));
  return scored.slice(0, limit);
}
