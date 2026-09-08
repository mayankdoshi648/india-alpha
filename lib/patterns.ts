import { ema, last, rsi, sma, stdev } from "@/lib/indicators";
import type { OhlcBar, PatternKind, StrategySettings } from "@/lib/types";

export interface PatternResult {
  kind: PatternKind;
  detail: string;
  score: number;
}

function localPivots(values: number[], left = 3, right = 3): { i: number; type: "h" | "l" }[] {
  const out: { i: number; type: "h" | "l" }[] = [];
  for (let i = left; i < values.length - right; i++) {
    const v = values[i];
    let isH = true;
    let isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (values[j] > v) isH = false;
      if (values[j] < v) isL = false;
    }
    if (isH) out.push({ i, type: "h" });
    if (isL) out.push({ i, type: "l" });
  }
  return out;
}

export function detectPatterns(
  bars: OhlcBar[],
  settings: StrategySettings,
  extras: {
    stage2Score: number;
    rsiNow: number;
    rsiMa: number;
    above50: boolean;
    above200: boolean;
    volSpike: number;
    distFrom20: number;
  },
): PatternResult[] {
  const hits: PatternResult[] = [];
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const rsiSeries = rsi(closes, settings.rsiPeriod);
  const pivots = localPivots(closes);
  const rsiPivots = localPivots(rsiSeries);

  const priceLows = pivots.filter((p) => p.type === "l").slice(-3);
  const priceHighs = pivots.filter((p) => p.type === "h").slice(-3);
  const rsiLows = rsiPivots.filter((p) => p.type === "l").slice(-3);
  const rsiHighs = rsiPivots.filter((p) => p.type === "h").slice(-3);

  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const p1 = priceLows[priceLows.length - 2];
    const p2 = priceLows[priceLows.length - 1];
    const r1 = rsiLows[rsiLows.length - 2];
    const r2 = rsiLows[rsiLows.length - 1];
    if (closes[p2.i] < closes[p1.i] && rsiSeries[r2.i] > rsiSeries[r1.i]) {
      hits.push({
        kind: "bullish_div",
        detail: "Price lower low vs RSI higher low",
        score: 72,
      });
    }
    if (closes[p2.i] > closes[p1.i] && rsiSeries[r2.i] < rsiSeries[r1.i]) {
      hits.push({
        kind: "hidden_bullish_div",
        detail: "Hidden bullish: higher low vs RSI lower low",
        score: 68,
      });
    }
  }

  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const p1 = priceHighs[priceHighs.length - 2];
    const p2 = priceHighs[priceHighs.length - 1];
    const r1 = rsiHighs[rsiHighs.length - 2];
    const r2 = rsiHighs[rsiHighs.length - 1];
    if (closes[p2.i] > closes[p1.i] && rsiSeries[r2.i] < rsiSeries[r1.i]) {
      hits.push({
        kind: "bearish_div",
        detail: "Price higher high vs RSI lower high",
        score: 70,
      });
    }
    if (closes[p2.i] < closes[p1.i] && rsiSeries[r2.i] > rsiSeries[r1.i]) {
      hits.push({
        kind: "hidden_bearish_div",
        detail: "Hidden bearish: lower high vs RSI higher high",
        score: 64,
      });
    }
  }

  if (extras.volSpike >= settings.volumeSpikeMult) {
    hits.push({
      kind: "volume_surge",
      detail: `${extras.volSpike.toFixed(1)}x vs ${settings.volumeAvgDays}D average`,
      score: Math.min(95, 50 + extras.volSpike * 12),
    });
  }

  const vcp = detectVcp(closes, volumes);
  if (vcp) hits.push(vcp);

  const brk = detectBreakout(bars, settings);
  if (brk) hits.push(brk);

  if (extras.stage2Score >= 5) {
    hits.push({
      kind: "stage2",
      detail: `Stage 2 checklist ${extras.stage2Score}/7`,
      score: 55 + extras.stage2Score * 6,
    });
  }

  if (
    extras.rsiNow <= settings.rsiOversold + 5 &&
    extras.above50 &&
    extras.distFrom20 > -6 &&
    extras.distFrom20 < 1
  ) {
    hits.push({
      kind: "oversold_pullback",
      detail: `RSI ${extras.rsiNow.toFixed(0)} into 20 EMA, still above 50 EMA`,
      score: 74,
    });
  }

  const lastClose = last(closes);
  const prev = bars[bars.length - 2];
  if (prev) {
    const p = (prev.high + prev.low + prev.close) / 3;
    const prior = bars[bars.length - 3];
    if (prior && prior.close < p && lastClose > p) {
      hits.push({
        kind: "pivot_reclaim",
        detail: `Reclaimed daily pivot ${p.toFixed(1)}`,
        score: 60,
      });
    }
  }

  const seen = new Set<PatternKind>();
  return hits.filter((h) => {
    if (seen.has(h.kind)) return false;
    seen.add(h.kind);
    return true;
  });
}

function detectVcp(closes: number[], volumes: number[]): PatternResult | null {
  if (closes.length < 60) return null;
  const windows = [21, 13, 8];
  const ranges: number[] = [];
  let cursor = closes.length;
  for (const w of windows) {
    const slice = closes.slice(Math.max(0, cursor - w), cursor);
    if (slice.length < 5) return null;
    ranges.push((Math.max(...slice) - Math.min(...slice)) / slice[slice.length - 1]);
    cursor -= Math.floor(w * 0.7);
  }
  const contracting = ranges[0] > ranges[1] && ranges[1] > ranges[2] && ranges[2] < 0.08;
  const volDry =
    sma(volumes.slice(-8), 8).at(-1)! < sma(volumes.slice(-30), 20).at(-1)! * 0.85;
  if (!contracting) return null;
  return {
    kind: "vcp",
    detail: `3 contractions ${(ranges[0] * 100).toFixed(1)}→${(ranges[2] * 100).toFixed(1)}%`,
    score: volDry ? 82 : 70,
  };
}

function detectBreakout(bars: OhlcBar[], settings: StrategySettings): PatternResult | null {
  if (bars.length < 40) return null;
  const base = bars.slice(-40, -1);
  const lastBar = last(bars);
  const baseHigh = Math.max(...base.map((b) => b.high));
  const baseLow = Math.min(...base.map((b) => b.low));
  const range = (baseHigh - baseLow) / lastBar.close;
  const avgVol = sma(base.map((b) => b.volume), settings.volumeAvgDays).at(-1) ?? 1;
  const volOk = lastBar.volume >= avgVol * settings.breakoutVolumeMult;
  const broke = lastBar.close > baseHigh * 1.002;
  const retraceOk = range <= settings.breakoutRetracePct / 100;
  if (broke && volOk && retraceOk && range < 0.18) {
    return {
      kind: "breakout",
      detail: `Base high ${baseHigh.toFixed(1)} cleared on ${ (lastBar.volume / avgVol).toFixed(1)}x volume`,
      score: 86,
    };
  }
  return null;
}

export function stage2Checklist(
  bars: OhlcBar[],
  settings: StrategySettings,
): { score: number; checks: string[] } {
  const closes = bars.map((b) => b.close);
  const ema50 = ema(closes, settings.emaMid);
  const ema150 = ema(closes, 150);
  const ema200 = ema(closes, settings.emaLong);
  const price = last(closes);
  const high52 = Math.max(...closes.slice(-252));
  const low52 = Math.min(...closes.slice(-252));
  const checks: string[] = [];
  let score = 0;

  if (price > last(ema150) && price > last(ema200)) {
    score++;
    checks.push("Price above 150 & 200 EMA");
  }
  if (last(ema150) > last(ema200)) {
    score++;
    checks.push("150 EMA above 200 EMA");
  }
  const ema200Now = last(ema200);
  const ema200Ago = ema200[Math.max(0, ema200.length - 21)];
  if (ema200Now > ema200Ago) {
    score++;
    checks.push("200 EMA rising (20D)");
  }
  if (last(ema50) > last(ema150) && last(ema50) > last(ema200)) {
    score++;
    checks.push("50 EMA above 150 & 200");
  }
  if (price >= low52 * (1 + settings.stage2AboveLowPct / 100)) {
    score++;
    checks.push(`≥${settings.stage2AboveLowPct}% above 52W low`);
  }
  if (price >= high52 * (1 - settings.stage2NearHighPct / 100)) {
    score++;
    checks.push(`Within ${settings.stage2NearHighPct}% of 52W high`);
  }
  const volNow = last(bars).volume;
  const volAvg = sma(bars.map((b) => b.volume), 50).at(-1) ?? 1;
  if (volNow > volAvg) {
    score++;
    checks.push("Volume above 50D average");
  }
  return { score, checks };
}

export function rangeContraction(closes: number[]): number {
  return stdev(closes.slice(-20)) / (last(closes) || 1);
}
