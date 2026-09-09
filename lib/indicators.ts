import type { EmaStatus, OhlcBar, StrategySettings } from "@/lib/types";

export function round(n: number, d = 2): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

export function pct(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : sum / (i + 1));
  }
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  if (values.length < 2) return values.map(() => 50);
  const out: number[] = [50];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = Math.max(ch, 0);
    const l = Math.max(-ch, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        const ag = gain / period;
        const al = loss / period;
        const rs = al === 0 ? 100 : ag / al;
        out.push(100 - 100 / (1 + rs));
        gain = ag;
        loss = al;
      } else {
        out.push(50);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      const rs = loss === 0 ? 100 : gain / loss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

export function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

export function valueAt(values: number[], offsetFromEnd: number): number {
  return values[Math.max(0, values.length - 1 - offsetFromEnd)] ?? values[0] ?? 0;
}

export function resample(bars: OhlcBar[], tf: "W" | "M"): OhlcBar[] {
  const groups = new Map<string, OhlcBar[]>();
  for (const b of bars) {
    const d = new Date(`${b.date}T00:00:00Z`);
    const key =
      tf === "W"
        ? isoWeekKey(d)
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const g = groups.get(key) ?? [];
    g.push(b);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    date: g[g.length - 1].date,
    open: g[0].open,
    high: Math.max(...g.map((x) => x.high)),
    low: Math.min(...g.map((x) => x.low)),
    close: g[g.length - 1].close,
    volume: g.reduce((s, x) => s + x.volume, 0),
  }));
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function emaStatuses(
  closes: number[],
  settings: StrategySettings,
): EmaStatus[] {
  const price = last(closes);
  return [settings.emaFast, settings.emaShort, settings.emaMid, settings.emaLong].map(
    (period) => {
      const series = ema(closes, period);
      const value = last(series);
      return { period, value: round(value, 2), above: price >= value };
    },
  );
}

export function stackAlignment(statuses: EmaStatus[]): "bullish" | "bearish" | "mixed" {
  const vals = statuses.map((e) => e.value);
  const bull = vals.every((v, i) => i === 0 || vals[i - 1] >= v);
  const bear = vals.every((v, i) => i === 0 || vals[i - 1] <= v);
  if (bull) return "bullish";
  if (bear) return "bearish";
  return "mixed";
}

export function crossedUp(fast: number[], slow: number[], lookback = 3): boolean {
  if (fast.length < 3 || slow.length < 3) return false;
  for (let i = 1; i <= lookback; i++) {
    const a = fast.length - i;
    if (a < 1) break;
    if (fast[a] >= slow[a] && fast[a - 1] < slow[a - 1]) return true;
  }
  return false;
}

export function converging(statuses: EmaStatus[]): boolean {
  if (statuses.length < 2) return false;
  const spread = Math.abs(statuses[0].value - last(statuses).value);
  const mid = Math.abs(statuses[0].value - statuses[1].value);
  return mid < spread * 0.35;
}

export function classicPivot(prev: OhlcBar): { p: number; r1: number; s1: number } {
  const p = (prev.high + prev.low + prev.close) / 3;
  return { p, r1: 2 * p - prev.low, s1: 2 * p - prev.high };
}

export function chaikinMoneyFlow(bars: OhlcBar[], period: number): number {
  const slice = bars.slice(-period);
  let mfv = 0;
  let vol = 0;
  for (const b of slice) {
    const hl = b.high - b.low;
    const mfm = hl === 0 ? 0 : (b.close - b.low - (b.high - b.close)) / hl;
    mfv += mfm * b.volume;
    vol += b.volume;
  }
  return vol === 0 ? 0 : mfv / vol;
}

export function maxPain(strikes: { strike: number; callOi: number; putOi: number }[]): number {
  if (!strikes.length) return 0;
  let best = strikes[0].strike;
  let minLoss = Number.POSITIVE_INFINITY;
  for (const at of strikes) {
    let loss = 0;
    for (const s of strikes) {
      if (at.strike > s.strike) loss += (at.strike - s.strike) * s.callOi;
      if (at.strike < s.strike) loss += (s.strike - at.strike) * s.putOi;
    }
    if (loss < minLoss) {
      minLoss = loss;
      best = at.strike;
    }
  }
  return best;
}

export function highLow(values: number[], lookback: number): { high: number; low: number } {
  const slice = values.slice(-lookback);
  return { high: Math.max(...slice), low: Math.min(...slice) };
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function realizedVol(closes: number[], days = 20): number {
  if (closes.length < 3) return 0;
  const start = Math.max(1, closes.length - days);
  const rets: number[] = [];
  for (let i = start; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  return round(stdev(rets) * Math.sqrt(252) * 100, 2);
}

export function aroundAtm<T extends { strike: number }>(strikes: T[], spot: number, count = 15): T[] {
  if (!strikes.length) return [];
  const sorted = [...strikes].sort((a, b) => a.strike - b.strike);
  let best = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].strike - spot) < Math.abs(sorted[best].strike - spot)) best = i;
  }
  const half = Math.floor(count / 2);
  return sorted.slice(Math.max(0, best - half), best + half + 1);
}
