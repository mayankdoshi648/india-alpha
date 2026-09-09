import { last, pct, resample, round, rsi } from "@/lib/indicators";
import { CHART_PATTERN_LABEL } from "@/lib/format";
import type {
  ChartPatternHit,
  ChartPatternKind,
  ChartPatternRole,
  OhlcBar,
  StrategySettings,
  Timeframe,
} from "@/lib/types";

type Pivot = { i: number; price: number; type: "h" | "l" };
type Divergence = ChartPatternHit["divergence"];

const LOOK: Record<Timeframe, { bars: number; left: number; right: number; min: number }> = {
  D: { bars: 70, left: 3, right: 2, min: 36 },
  W: { bars: 52, left: 2, right: 1, min: 24 },
  M: { bars: 18, left: 1, right: 1, min: 10 },
};

function swingPivots(bars: OhlcBar[], left: number, right: number): Pivot[] {
  const out: Pivot[] = [];
  for (let i = left; i < bars.length - right; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    let isH = true;
    let isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (bars[j].high > h) isH = false;
      if (bars[j].low < l) isL = false;
    }
    if (isH) out.push({ i, price: h, type: "h" });
    if (isL) out.push({ i, price: l, type: "l" });
  }
  return out;
}

function ofType(pivots: Pivot[], type: "h" | "l", n = 4): Pivot[] {
  return pivots.filter((p) => p.type === type).slice(-n);
}

function bandPct(prices: number[]): number {
  if (prices.length < 2) return 99;
  const hi = Math.max(...prices);
  const lo = Math.min(...prices);
  const mid = (hi + lo) / 2 || 1;
  return ((hi - lo) / mid) * 100;
}

function rising(prices: number[]): boolean {
  if (prices.length < 3) return false;
  let up = 0;
  for (let i = 1; i < prices.length; i++) if (prices[i] > prices[i - 1] * 1.002) up++;
  return up >= prices.length - 2 && prices[prices.length - 1] > prices[0] * 1.01;
}

function falling(prices: number[]): boolean {
  if (prices.length < 3) return false;
  let dn = 0;
  for (let i = 1; i < prices.length; i++) if (prices[i] < prices[i - 1] * 0.998) dn++;
  return dn >= prices.length - 2 && prices[prices.length - 1] < prices[0] * 0.99;
}

function slopePct(pivots: Pivot[]): number {
  if (pivots.length < 2) return 0;
  const a = pivots[0];
  const b = pivots[pivots.length - 1];
  const span = Math.max(1, b.i - a.i);
  return ((b.price - a.price) / a.price / span) * 100;
}

function priorTrend(bars: OhlcBar[], end: number): "up" | "down" | "flat" {
  const from = Math.max(0, end - 24);
  if (end - from < 6) return "flat";
  const chg = pct(bars[from].close, bars[end].close);
  if (chg > 4) return "up";
  if (chg < -4) return "down";
  return "flat";
}

function avgVol(bars: OhlcBar[], from: number, to: number): number {
  const slice = bars.slice(Math.max(0, from), Math.max(from + 1, to));
  if (!slice.length) return 1;
  return slice.reduce((s, b) => s + b.volume, 0) / slice.length;
}

function rsiDivergence(closes: number[], rsiSeries: number[], left: number, right: number): Divergence {
  const piv: { i: number; type: "h" | "l" }[] = [];
  for (let i = left; i < closes.length - right; i++) {
    const v = closes[i];
    let isH = true;
    let isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (closes[j] > v) isH = false;
      if (closes[j] < v) isL = false;
    }
    if (isH) piv.push({ i, type: "h" });
    if (isL) piv.push({ i, type: "l" });
  }
  const lows = piv.filter((p) => p.type === "l").slice(-2);
  const highs = piv.filter((p) => p.type === "h").slice(-2);
  if (lows.length === 2) {
    const [a, b] = lows;
    if (closes[b.i] < closes[a.i] && rsiSeries[b.i] > rsiSeries[a.i] + 1) return "bullish";
    if (closes[b.i] > closes[a.i] && rsiSeries[b.i] < rsiSeries[a.i] - 1) return "hidden_bullish";
  }
  if (highs.length === 2) {
    const [a, b] = highs;
    if (closes[b.i] > closes[a.i] && rsiSeries[b.i] < rsiSeries[a.i] - 1) return "bearish";
    if (closes[b.i] < closes[a.i] && rsiSeries[b.i] > rsiSeries[a.i] + 1) return "hidden_bearish";
  }
  return null;
}

function levels(entry: number, stop: number, height: number, bias: "bullish" | "bearish") {
  const risk = Math.abs(entry - stop) || entry * 0.02;
  const measured = bias === "bullish" ? entry + Math.max(height, risk * 1.6) : entry - Math.max(height, risk * 1.6);
  const rr = risk > 0 ? Math.abs(measured - entry) / risk : 0;
  return {
    entry: round(entry, 2),
    stop: round(stop, 2),
    target: round(measured, 2),
    rr: round(Math.min(8, rr), 1),
  };
}

function confirm(
  bars: OhlcBar[],
  settings: StrategySettings,
  bias: "bullish" | "bearish",
  start: number,
): { volX: number; volDry: boolean; rsiNow: number; div: Divergence; volOk: boolean } {
  const lastBar = last(bars);
  const bodyVol = avgVol(bars, start, bars.length - 1);
  const priorVol = avgVol(bars, Math.max(0, start - 18), start);
  const volX = lastBar.volume / Math.max(bodyVol, 1);
  const volDry = bodyVol < priorVol * 0.92;
  const closes = bars.map((b) => b.close);
  const rsiSeries = rsi(closes, settings.rsiPeriod);
  const rsiNow = last(rsiSeries);
  const div = rsiDivergence(closes, rsiSeries, 3, 2);
  const volOk = volX >= Math.max(1.15, settings.breakoutVolumeMult * 0.75);
  const divAgrees =
    (bias === "bullish" && (div === "bullish" || div === "hidden_bullish")) ||
    (bias === "bearish" && (div === "bearish" || div === "hidden_bearish"));
  return { volX: round(volX, 2), volDry, rsiNow: round(rsiNow, 1), div: divAgrees || div ? div : null, volOk };
}

function volLine(volX: number, volDry: boolean, volOk: boolean): string {
  const dry = volDry ? "Volume dried inside the pattern." : "Volume has not fully dried in the coil.";
  if (volOk) return `${dry} Break on ${volX.toFixed(1)}x volume.`;
  return `${dry} Need a volume push (now ${volX.toFixed(1)}x).`;
}

function pack(input: {
  kind: ChartPatternKind;
  bias: "bullish" | "bearish";
  role: ChartPatternRole;
  tf: Timeframe;
  status: ChartPatternHit["status"];
  start: number;
  bars: OhlcBar[];
  settings: StrategySettings;
  entry: number;
  stop: number;
  height: number;
  extra: string;
  baseScore: number;
}): Omit<ChartPatternHit, "symbol" | "name" | "sector" | "cmp" | "change1d"> {
  const conf = confirm(input.bars, input.settings, input.bias, input.start);
  const lv = levels(input.entry, input.stop, input.height, input.bias);
  let score = input.baseScore;
  if (conf.volOk) score += 10;
  if (conf.volDry) score += 6;
  if (conf.div) score += 8;
  if (input.status !== "forming") score += 8;
  if (input.tf === "W") score += 3;
  if (input.tf === "M") score += 4;
  if (conf.div && ((input.bias === "bullish" && conf.div.includes("bullish")) || (input.bias === "bearish" && conf.div.includes("bearish")))) {
    score += 4;
  }
  const tf = input.tf === "D" ? "Daily" : input.tf === "W" ? "Weekly" : "Monthly";
  const text = `${tf} ${CHART_PATTERN_LABEL[input.kind]} (${input.role}). ${input.extra} ${
    input.status === "forming"
      ? `Wait for the ${input.bias === "bullish" ? "break above" : "break below"} then enter ${input.bias === "bullish" ? "long" : "short"}.`
      : `Enter ${input.bias === "bullish" ? "long" : "short"} — pattern ${input.status}.`
  } ${volLine(conf.volX, conf.volDry, conf.volOk)} ${
    conf.div === "bullish"
      ? `RSI ${conf.rsiNow} prints bullish divergence (price lower low, RSI higher low).`
      : conf.div === "bearish"
        ? `RSI ${conf.rsiNow} prints bearish divergence (price higher high, RSI lower high).`
        : conf.div === "hidden_bullish"
          ? `Hidden bullish divergence on RSI ${conf.rsiNow}.`
          : conf.div === "hidden_bearish"
            ? `Hidden bearish divergence on RSI ${conf.rsiNow}.`
            : `RSI ${conf.rsiNow}.`
  } Entry ${lv.entry.toFixed(1)}, stop ${lv.stop.toFixed(1)}, target ${lv.target.toFixed(1)}.`;
  return {
    kind: input.kind,
    bias: input.bias,
    role: input.role,
    timeframe: input.tf,
    status: input.status,
    score: Math.max(52, Math.min(96, Math.round(score))),
    entry: lv.entry,
    stop: lv.stop,
    target: lv.target,
    rr: lv.rr,
    volX: conf.volX,
    rsi: conf.rsiNow,
    divergence: conf.div,
    rationale: text,
    summary: `${CHART_PATTERN_LABEL[input.kind]} · ${input.tf} · ${input.status}`,
  };
}

function detectOn(bars: OhlcBar[], settings: StrategySettings, tf: Timeframe) {
  const cfg = LOOK[tf];
  if (bars.length < cfg.min) return [] as ReturnType<typeof pack>[];
  const window = bars.slice(-cfg.bars);
  const pivots = swingPivots(window, cfg.left, cfg.right);
  const highs = ofType(pivots, "h", 5);
  const lows = ofType(pivots, "l", 5);
  const lastBar = last(window);
  const close = lastBar.close;
  const found: ReturnType<typeof pack>[] = [];
  const start = Math.max(0, window.length - cfg.bars);
  const hPx = highs.map((p) => p.price);
  const lPx = lows.map((p) => p.price);
  const trend = priorTrend(window, Math.max(0, (highs[0] ?? lows[0])?.i ?? window.length - 20));

  if (highs.length >= 3 && lows.length >= 3) {
    const flatHigh = bandPct(hPx.slice(-4)) <= 1.9 && Math.abs(slopePct(highs.slice(-4))) < 0.08;
    const flatLow = bandPct(lPx.slice(-4)) <= 1.9 && Math.abs(slopePct(lows.slice(-4))) < 0.08;
    const res = Math.max(...hPx.slice(-4));
    const sup = Math.min(...lPx.slice(-4));
    const height = res - Math.min(...lPx.slice(-4));

    if (flatHigh && rising(lPx.slice(-4))) {
      const broke = close > res * 1.002;
      const near = close >= res * 0.985;
      if (broke || near) {
        found.push(
          pack({
            kind: "ascending_triangle",
            bias: "bullish",
            role: "continuation",
            tf,
            status: broke ? "breakout" : "forming",
            start,
            bars: window,
            settings,
            entry: res * 1.002,
            stop: lPx[lPx.length - 1],
            height,
            extra: `Flat resistance ${res.toFixed(1)}, rising lows into the apex.`,
            baseScore: broke ? 78 : 68,
          }),
        );
      }
    }

    if (flatLow && falling(hPx.slice(-4))) {
      const broke = close < sup * 0.998;
      const near = close <= sup * 1.015;
      if (broke || near) {
        found.push(
          pack({
            kind: "descending_triangle",
            bias: "bearish",
            role: "continuation",
            tf,
            status: broke ? "breakdown" : "forming",
            start,
            bars: window,
            settings,
            entry: sup * 0.998,
            stop: hPx[hPx.length - 1],
            height,
            extra: `Flat support ${sup.toFixed(1)}, falling highs. Sellers defending the floor.`,
            baseScore: broke ? 76 : 66,
          }),
        );
      }
    }

    const hs = slopePct(highs.slice(-4));
    const ls = slopePct(lows.slice(-4));
    if (hs < -0.03 && ls > 0.03 && Math.abs(Math.abs(hs) - ls) < 0.12) {
      const mid = (res + sup) / 2;
      const up = close > res * 1.002;
      const dn = close < sup * 0.998;
      const near = close >= res * 0.985 || close <= sup * 1.015;
      if (up || dn || near) {
        found.push(
          pack({
            kind: "symmetrical_triangle",
            bias: up || (!dn && close >= mid) ? "bullish" : "bearish",
            role: "continuation",
            tf,
            status: up ? "breakout" : dn ? "breakdown" : "forming",
            start,
            bars: window,
            settings,
            entry: up || close >= mid ? res * 1.002 : sup * 0.998,
            stop: up || close >= mid ? sup : res,
            height,
            extra: "Converging highs and lows. Trade the break of the apex, not the coil.",
            baseScore: up || dn ? 74 : 64,
          }),
        );
      }
    }

    if (hs > 0.02 && ls > 0.04 && ls > hs * 1.05) {
      const broke = close < last(lPx) * 0.998;
      const near = close <= last(lPx) * 1.02;
      if (broke || near) {
        found.push(
          pack({
            kind: "rising_wedge",
            bias: "bearish",
            role: trend === "down" ? "continuation" : "reversal",
            tf,
            status: broke ? "breakdown" : "forming",
            start,
            bars: window,
            settings,
            entry: last(lPx) * 0.998,
            stop: last(hPx),
            height: last(hPx) - last(lPx),
            extra:
              trend === "down"
                ? "Bearish wedge in a downtrend — both lines rise and squeeze."
                : "Rising wedge after an advance. Exhaustion; sell the support break.",
            baseScore: broke ? 75 : 65,
          }),
        );
      }
    }

    if (hs < -0.04 && ls < -0.02 && Math.abs(hs) > Math.abs(ls) * 1.05) {
      const broke = close > last(hPx) * 1.002;
      const near = close >= last(hPx) * 0.985;
      if (broke || near) {
        found.push(
          pack({
            kind: "falling_wedge",
            bias: "bullish",
            role: trend === "up" ? "continuation" : "reversal",
            tf,
            status: broke ? "breakout" : "forming",
            start,
            bars: window,
            settings,
            entry: last(hPx) * 1.002,
            stop: last(lPx),
            height: last(hPx) - last(lPx),
            extra:
              trend === "up"
                ? "Bullish wedge in an uptrend — both lines fall and squeeze."
                : "Falling wedge after a decline. Buy the resistance break.",
            baseScore: broke ? 75 : 65,
          }),
        );
      }
    }
  }

  const hsHighs = ofType(pivots, "h", 6);
  if (hsHighs.length >= 3) {
    for (let k = hsHighs.length - 3; k >= 0 && k > hsHighs.length - 5; k--) {
      const [l, h, r] = [hsHighs[k], hsHighs[k + 1], hsHighs[k + 2]];
      if (h.price > l.price * 1.022 && h.price > r.price * 1.022 && Math.abs(pct(l.price, r.price)) <= 3.2) {
        const troughs = lows.filter((p) => p.i > l.i && p.i < r.i);
        if (troughs.length >= 1) {
          const neck = troughs.reduce((s, p) => s + p.price, 0) / troughs.length;
          const broke = close < neck * 0.998;
          const near = close <= neck * 1.02;
          if (broke || near) {
            found.push(
              pack({
                kind: "head_shoulders",
                bias: "bearish",
                role: "reversal",
                tf,
                status: broke ? "breakdown" : "forming",
                start: l.i,
                bars: window,
                settings,
                entry: neck * 0.998,
                stop: r.price,
                height: h.price - neck,
                extra: `Head ${h.price.toFixed(1)} between shoulders ${l.price.toFixed(1)} / ${r.price.toFixed(1)}. Neckline ${neck.toFixed(1)}.`,
                baseScore: broke ? 80 : 70,
              }),
            );
            break;
          }
        }
      }
    }
  }

  const hsLows = ofType(pivots, "l", 6);
  if (hsLows.length >= 3) {
    for (let k = hsLows.length - 3; k >= 0 && k > hsLows.length - 5; k--) {
      const [l, h, r] = [hsLows[k], hsLows[k + 1], hsLows[k + 2]];
      if (h.price < l.price * 0.978 && h.price < r.price * 0.978 && Math.abs(pct(l.price, r.price)) <= 3.2) {
        const peaks = highs.filter((p) => p.i > l.i && p.i < r.i);
        if (peaks.length >= 1) {
          const neck = peaks.reduce((s, p) => s + p.price, 0) / peaks.length;
          const broke = close > neck * 1.002;
          const near = close >= neck * 0.985;
          if (broke || near) {
            found.push(
              pack({
                kind: "inv_head_shoulders",
                bias: "bullish",
                role: "reversal",
                tf,
                status: broke ? "breakout" : "forming",
                start: l.i,
                bars: window,
                settings,
                entry: neck * 1.002,
                stop: r.price,
                height: neck - h.price,
                extra: `Head ${h.price.toFixed(1)} between shoulders ${l.price.toFixed(1)} / ${r.price.toFixed(1)}. Neckline ${neck.toFixed(1)}.`,
                baseScore: broke ? 80 : 70,
              }),
            );
            break;
          }
        }
      }
    }
  }

  if (highs.length >= 2) {
    const a = highs[highs.length - 2];
    const b = highs[highs.length - 1];
    if (b.i - a.i >= 6 && Math.abs(pct(a.price, b.price)) <= 1.8) {
      const troughs = lows.filter((p) => p.i > a.i && p.i < b.i);
      const trough = troughs.length ? Math.min(...troughs.map((p) => p.price)) : Math.min(...window.slice(a.i, b.i + 1).map((x) => x.low));
      const broke = close < trough * 0.998;
      const near = close <= trough * 1.02;
      if (broke || near) {
        found.push(
          pack({
            kind: highs.length >= 3 && bandPct(hPx.slice(-3)) <= 2.2 ? "triple_top" : "double_top",
            bias: "bearish",
            role: "reversal",
            tf,
            status: broke ? "breakdown" : "forming",
            start: a.i,
            bars: window,
            settings,
            entry: trough * 0.998,
            stop: Math.max(a.price, b.price),
            height: Math.max(a.price, b.price) - trough,
            extra: `Matching highs ${a.price.toFixed(1)} / ${b.price.toFixed(1)}. Sell the trough ${trough.toFixed(1)}.`,
            baseScore: broke ? 77 : 67,
          }),
        );
      }
    }
  }

  if (lows.length >= 2) {
    const a = lows[lows.length - 2];
    const b = lows[lows.length - 1];
    if (b.i - a.i >= 6 && Math.abs(pct(a.price, b.price)) <= 1.8) {
      const peaks = highs.filter((p) => p.i > a.i && p.i < b.i);
      const peak = peaks.length ? Math.max(...peaks.map((p) => p.price)) : Math.max(...window.slice(a.i, b.i + 1).map((x) => x.high));
      const broke = close > peak * 1.002;
      const near = close >= peak * 0.985;
      if (broke || near) {
        found.push(
          pack({
            kind: lows.length >= 3 && bandPct(lPx.slice(-3)) <= 2.2 ? "triple_bottom" : "double_bottom",
            bias: "bullish",
            role: "reversal",
            tf,
            status: broke ? "breakout" : "forming",
            start: a.i,
            bars: window,
            settings,
            entry: peak * 1.002,
            stop: Math.min(a.price, b.price),
            height: peak - Math.min(a.price, b.price),
            extra: `Matching lows ${a.price.toFixed(1)} / ${b.price.toFixed(1)}. Buy the peak ${peak.toFixed(1)}.`,
            baseScore: broke ? 77 : 67,
          }),
        );
      }
    }
  }

  const poleEnd = window.length - 10;
  const poleStart = Math.max(0, window.length - 22);
  if (poleEnd - poleStart >= 6) {
    const poleChg = pct(window[poleStart].close, window[poleEnd].close);
    const flag = window.slice(poleEnd, -1);
    if (flag.length >= 4) {
    const flagChg = pct(flag[0].close, last(flag).close);
    const poleHi = Math.max(...window.slice(poleStart, poleEnd + 1).map((b) => b.high));
    const poleLo = Math.min(...window.slice(poleStart, poleEnd + 1).map((b) => b.low));
    const flagHi = Math.max(...flag.map((b) => b.high));
    const flagLo = Math.min(...flag.map((b) => b.low));
    if (poleChg > 7 && flagChg <= 0.5 && flagChg > -poleChg * 0.6 && flagHi - flagLo < (poleHi - poleLo) * 0.65) {
      const broke = close > flagHi * 1.002;
      const near = close >= flagHi * 0.99;
      if (broke || near) {
        found.push(
          pack({
            kind: "bullish_flag",
            bias: "bullish",
            role: "continuation",
            tf,
            status: broke ? "breakout" : "forming",
            start: poleStart,
            bars: window,
            settings,
            entry: flagHi * 1.002,
            stop: flagLo,
            height: poleHi - poleLo,
            extra: `Pole ${poleChg.toFixed(1)}% then a tight downward flag. Measured move uses the pole.`,
            baseScore: broke ? 79 : 69,
          }),
        );
      }
    }
    if (poleChg < -7 && flagChg >= -0.5 && flagChg < -poleChg * 0.6 && flagHi - flagLo < (poleHi - poleLo) * 0.65) {
      const broke = close < flagLo * 0.998;
      const near = close <= flagLo * 1.01;
      if (broke || near) {
        found.push(
          pack({
            kind: "bearish_flag",
            bias: "bearish",
            role: "continuation",
            tf,
            status: broke ? "breakdown" : "forming",
            start: poleStart,
            bars: window,
            settings,
            entry: flagLo * 0.998,
            stop: flagHi,
            height: poleHi - poleLo,
            extra: `Pole ${poleChg.toFixed(1)}% then a tight upward flag. Measured move uses the pole.`,
            baseScore: broke ? 79 : 69,
          }),
        );
      }
    }
    }
  }

  found.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return found.filter((x) => {
    const key = x.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

export function detectChartPatterns(
  bars: OhlcBar[],
  settings: StrategySettings,
): Omit<ChartPatternHit, "symbol" | "name" | "sector" | "cmp" | "change1d">[] {
  const daily = detectOn(bars, settings, "D");
  const weekly = detectOn(resample(bars, "W"), settings, "W");
  const monthly = detectOn(resample(bars, "M"), settings, "M");
  return [...daily, ...weekly, ...monthly].sort((a, b) => b.score - a.score).slice(0, 4);
}
