import { INDEX_META, SECTOR_INDEX_BASE } from "@/lib/universe";
import type { FlowDay, OhlcBar, StockFo, UniverseStock } from "@/lib/types";
import { foFromChain, strikeStep } from "@/lib/fno";

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function tradingDays(count = 320, end = "2026-09-08"): string[] {
  const days: string[] = [];
  const d = new Date(`${end}T00:00:00Z`);
  while (days.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days.reverse();
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const SKIP_CHART_SEED = new Set([
  "BEL", "HAL", "MAXHEALTH", "MAZDOCK", "TRENT", "TITAN", "PERSISTENT", "POLYCAB",
  "SOLARINDS", "KAYNES", "RVNL", "CIPLA", "SUNPHARMA", "DABUR",
  "HDFCBANK", "AXISBANK", "KOTAKBANK", "TVSMOTOR",
]);

const CHART_SEED: Record<string, string> = {
  BHARTIARTL: "asc_tri",
  ITC: "double_bottom",
  ONGC: "bull_flag",
  MARUTI: "fall_wedge",
  SBIN: "desc_tri",
  INFY: "hs",
  HINDUNILVR: "rise_wedge",
  POWERGRID: "sym_tri",
  COALINDIA: "triple_bottom",
  NTPC: "inv_hs",
  JSWSTEEL: "bear_flag",
  ULTRACEMCO: "double_top",
  NESTLEIND: "asc_tri",
  GRASIM: "bull_flag",
  ADANIENT: "desc_tri",
  "BAJAJ-AUTO": "double_bottom",
};

const HASH_KINDS = [
  "asc_tri", "desc_tri", "sym_tri", "bull_flag", "bear_flag",
  "rise_wedge", "fall_wedge", "hs", "inv_hs", "double_top", "double_bottom", "triple_bottom",
];

function paintChartSeed(symbol: string, out: OhlcBar[]) {
  if (SKIP_CHART_SEED.has(symbol)) return;
  const kind = CHART_SEED[symbol] ?? (hash(symbol) % 19 === 0 ? HASH_KINDS[hash(symbol) % HASH_KINDS.length] : null);
  if (!kind) return;
  const n = out.length;
  const base = out[Math.max(0, n - 55)].close;

  const set = (i: number, close: number, high: number, low: number, vol = 0.7) => {
    if (i < 0 || i >= n) return;
    const b = out[i];
    b.close = close;
    b.open = (high + low) / 2;
    b.high = Math.max(high, close, b.open);
    b.low = Math.min(low, close, b.open);
    b.volume = Math.max(1, Math.round(b.volume * vol));
  };

  const peak = (i: number, px: number) => {
    for (let k = -3; k <= 3; k++) {
      const j = i + k;
      if (j < 0 || j >= n - 1) continue;
      const d = Math.abs(k);
      const c = px * (1 - d * 0.014);
      set(j, c, k === 0 ? px : c * 1.004, c * 0.988, k === 0 ? 0.85 : 0.55);
    }
  };
  const trough = (i: number, px: number) => {
    for (let k = -3; k <= 3; k++) {
      const j = i + k;
      if (j < 0 || j >= n - 1) continue;
      const d = Math.abs(k);
      const c = px * (1 + d * 0.014);
      set(j, c, c * 1.012, k === 0 ? px : c * 0.996, k === 0 ? 0.85 : 0.55);
    }
  };

  if (kind === "asc_tri") {
    const R = base * 1.1;
    trough(n - 38, R * 0.88);
    peak(n - 32, R);
    trough(n - 26, R * 0.92);
    peak(n - 20, R);
    trough(n - 12, R * 0.96);
    peak(n - 8, R * 0.998);
    set(n - 1, R * 1.016, R * 1.024, R * 0.996, 2.5);
  } else if (kind === "desc_tri") {
    const S = base * 0.94;
    peak(n - 38, S * 1.14);
    trough(n - 32, S);
    peak(n - 26, S * 1.1);
    trough(n - 20, S);
    peak(n - 12, S * 1.05);
    trough(n - 8, S * 1.002);
    set(n - 1, S * 0.982, S * 1.004, S * 0.97, 2.4);
  } else if (kind === "sym_tri") {
    peak(n - 36, base * 1.09);
    trough(n - 30, base * 0.91);
    peak(n - 22, base * 1.05);
    trough(n - 16, base * 0.95);
    peak(n - 10, base * 1.02);
    trough(n - 7, base * 0.98);
    set(n - 1, base * 1.03, base * 1.045, base * 0.995, 2.2);
  } else if (kind === "bull_flag") {
    const start = base;
    for (let i = n - 22; i < n - 10; i++) {
      const t = (i - (n - 22)) / 11;
      const c = start * (1 + t * 0.18);
      set(i, c, c * 1.01, c * 0.99, 1.35);
    }
    const flagTop = start * 1.18;
    for (let i = n - 10; i < n - 1; i++) {
      const t = (i - (n - 10)) / 8;
      const c = flagTop * (1 - t * 0.04);
      set(i, c, c * 1.006, c * 0.992, 0.5);
    }
    set(n - 1, flagTop * 1.012, flagTop * 1.02, flagTop * 0.97, 2.4);
  } else if (kind === "bear_flag") {
    const start = base;
    for (let i = n - 22; i < n - 10; i++) {
      const t = (i - (n - 22)) / 11;
      const c = start * (1 - t * 0.18);
      set(i, c, c * 1.01, c * 0.99, 1.35);
    }
    const flagBot = start * 0.82;
    for (let i = n - 10; i < n - 1; i++) {
      const t = (i - (n - 10)) / 8;
      const c = flagBot * (1 + t * 0.04);
      set(i, c, c * 1.008, c * 0.994, 0.5);
    }
    set(n - 1, flagBot * 0.988, flagBot * 1.03, flagBot * 0.97, 2.4);
  } else if (kind === "fall_wedge") {
    peak(n - 40, base * 1.04);
    trough(n - 33, base * 0.9);
    peak(n - 26, base * 0.99);
    trough(n - 19, base * 0.87);
    peak(n - 12, base * 0.945);
    trough(n - 7, base * 0.855);
    set(n - 1, base * 0.97, base * 0.985, base * 0.9, 2.2);
  } else if (kind === "rise_wedge") {
    trough(n - 40, base * 0.9);
    peak(n - 33, base * 1.04);
    trough(n - 26, base * 0.95);
    peak(n - 19, base * 1.07);
    trough(n - 12, base * 0.99);
    peak(n - 7, base * 1.09);
    set(n - 1, base * 0.975, base * 1.02, base * 0.96, 2.2);
  } else if (kind === "hs") {
    peak(n - 42, base * 1.06);
    trough(n - 34, base * 0.97);
    peak(n - 26, base * 1.16);
    trough(n - 18, base * 0.97);
    peak(n - 10, base * 1.055);
    set(n - 1, base * 0.95, base * 0.985, base * 0.93, 2.4);
  } else if (kind === "inv_hs") {
    trough(n - 42, base * 0.94);
    peak(n - 34, base * 1.03);
    trough(n - 26, base * 0.84);
    peak(n - 18, base * 1.03);
    trough(n - 10, base * 0.945);
    set(n - 1, base * 1.05, base * 1.07, base * 1.01, 2.4);
  } else if (kind === "double_top") {
    peak(n - 28, base * 1.1);
    trough(n - 18, base * 0.97);
    peak(n - 10, base * 1.098);
    set(n - 1, base * 0.955, base * 0.99, base * 0.94, 2.3);
  } else if (kind === "double_bottom") {
    trough(n - 28, base * 0.9);
    peak(n - 18, base * 1.03);
    trough(n - 10, base * 0.902);
    set(n - 1, base * 1.045, base * 1.06, base * 1.0, 2.3);
  } else if (kind === "triple_bottom") {
    trough(n - 36, base * 0.9);
    peak(n - 28, base * 1.02);
    trough(n - 20, base * 0.902);
    peak(n - 14, base * 1.02);
    trough(n - 8, base * 0.901);
    set(n - 1, base * 1.04, base * 1.055, base * 0.995, 2.3);
  }
}

function applyPattern(symbol: string, bars: OhlcBar[]): OhlcBar[] {
  const out = bars.map((b) => ({ ...b }));
  const n = out.length;
  const last = out[n - 1];

  const reshape = (from: number, fn: (bar: OhlcBar, i: number, slice: OhlcBar[]) => void) => {
    const slice = out.slice(from);
    slice.forEach((bar, i) => fn(bar, i, slice));
  };

  if (["BEL", "HAL", "MAXHEALTH", "MAZDOCK"].includes(symbol)) {
    reshape(n - 80, (bar, i, slice) => {
      const t = i / slice.length;
      const lift = 0.78 + t * 0.32;
      bar.close *= lift;
      bar.high = Math.max(bar.high * lift, bar.close * 1.01);
      bar.low = Math.min(bar.low * lift, bar.close * 0.99);
      bar.open = bar.open * lift;
      if (i > slice.length - 4) bar.volume *= 2.4;
    });
    const baseHigh = Math.max(...out.slice(n - 36, n - 1).map((b) => b.high));
    last.close = baseHigh * 1.018;
    last.high = last.close * 1.012;
    last.volume *= 2.8;
  }

  if (["TRENT", "TITAN", "PERSISTENT", "POLYCAB"].includes(symbol)) {
    const start = Math.max(0, n - 56);
    const seed = out[start].close;
    for (let i = start; i < n - 1; i++) {
      const idx = i - start;
      const phase =
        idx < 16 ? { depth: 0.15, len: 16 } :
        idx < 30 ? { depth: 0.09, len: 14 } :
        idx < 42 ? { depth: 0.055, len: 12 } :
        { depth: 0.032, len: 8 };
      const local = ((idx % phase.len) / phase.len);
      const pull = Math.sin(local * Math.PI) * phase.depth;
      const mid = seed * (1 + idx * 0.0015);
      out[i].close = Number((mid * (1 - pull * 0.45)).toFixed(2));
      out[i].high = Number((mid * (1 + phase.depth * 0.12)).toFixed(2));
      out[i].low = Number((mid * (1 - phase.depth)).toFixed(2));
      out[i].open = out[i].close;
      out[i].volume = Math.round(out[i].volume * (idx > 40 ? 0.52 : 0.78));
    }
    const coilHigh = Math.max(...out.slice(n - 9, n - 1).map((b) => b.high));
    last.close = Number((coilHigh * 0.994).toFixed(2));
    last.high = Number((last.close * 1.004).toFixed(2));
    last.low = Number((last.close * 0.991).toFixed(2));
    last.open = last.close;
    last.volume = Math.round(last.volume * 0.62);
  }

  if (["SOLARINDS", "KAYNES", "RVNL"].includes(symbol)) {
    last.volume *= 3.6;
    last.close *= 1.034;
    last.high = last.close * 1.02;
  }

  if (["CIPLA", "SUNPHARMA", "DABUR"].includes(symbol)) {
    reshape(n - 18, (bar, i, slice) => {
      const t = i / slice.length;
      bar.close *= 1 - t * 0.07;
      bar.low = Math.min(bar.low, bar.close * 0.985);
      bar.high = Math.max(bar.high, bar.close * 1.01);
    });
    last.volume *= 0.8;
  }

  if (["HDFCBANK", "AXISBANK", "KOTAKBANK"].includes(symbol)) {
    reshape(n - 40, (bar, i) => {
      bar.close *= 1 + Math.sin(i / 5) * 0.008 - i * 0.0016;
      bar.high = Math.max(bar.high, bar.close * (1.01 + i * 0.0004));
    });
  }

  if (["POLYCAB", "TVSMOTOR"].includes(symbol)) {
    reshape(n - 30, (bar, i) => {
      bar.close *= 1 + i * 0.0018;
    });
  }

  paintChartSeed(symbol, out);

  for (const b of out) {
    b.open = Number(b.open.toFixed(2));
    b.high = Number(Math.max(b.high, b.open, b.close).toFixed(2));
    b.low = Number(Math.min(b.low, b.open, b.close).toFixed(2));
    b.close = Number(b.close.toFixed(2));
    b.volume = Math.max(1, Math.round(b.volume));
  }
  return out;
}

export function generateIndexPath(id: string, days: string[], endPrice: number): OhlcBar[] {
  const rand = mulberry32(hash(id + "idx"));
  const n = days.length;
  const peakAt = Math.floor(n * 0.86);
  const start = endPrice * (id === "smallcap" ? 0.82 : 0.92);
  const peak = endPrice * (id === "nifty" ? 24774 / 23635.1 : 1.048);
  const closes: number[] = [];
  for (let i = 0; i < n; i++) {
    let target: number;
    if (i < peakAt) {
      const t = i / peakAt;
      target = start + (peak - start) * (0.15 + 0.85 * t);
    } else {
      const t = (i - peakAt) / (n - 1 - peakAt);
      target = peak + (endPrice - peak) * t;
    }
    const noise = 1 + gaussian(rand) * 0.004;
    closes.push((closes[i - 1] ?? target) * 0.15 + target * 0.85 * noise);
  }
  closes[n - 1] = endPrice;
  const lastMove: Record<string, number> = {
    nifty: -0.0061,
    sensex: -0.0073,
    banknifty: -0.0054,
    largecap: -0.0058,
    midcap: -0.0075,
    smallcap: -0.009,
    vix: 0.042,
  };
  const move = lastMove[id] ?? -0.004;
  closes[n - 2] = endPrice / (1 + move);
  return closes.map((c, i) => {
    const prev = closes[i - 1] ?? c;
    const vol = 1 + Math.abs(gaussian(rand)) * 0.006;
    const high = Math.max(c, prev) * (1 + 0.002 + rand() * 0.004);
    const low = Math.min(c, prev) * (1 - 0.002 - rand() * 0.004);
    return {
      date: days[i],
      open: Number((prev * (1 + (rand() - 0.5) * 0.003)).toFixed(2)),
      high: Number((high * vol).toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(c.toFixed(2)),
      volume: Math.round(1.8e8 * (0.8 + rand() * 0.5)),
    };
  });
}

export function generateStockBars(stock: UniverseStock, nifty: OhlcBar[]): OhlcBar[] {
  const rand = mulberry32(hash(stock.symbol));
  const beta =
    stock.sector === "Banks" ? 1.15 :
    stock.sector === "IT" ? 0.85 :
    stock.sector === "FMCG" ? 0.55 :
    stock.sector === "Metals" ? 1.25 :
    stock.sector === "Realty" ? 1.2 :
    0.95;
  const niftyRets = nifty.map((b, i) =>
    i === 0 ? 0 : (b.close - nifty[i - 1].close) / nifty[i - 1].close,
  );
  const start = stock.basePrice * (0.78 + rand() * 0.12);
  const bars: OhlcBar[] = [];
  let price = start;
  for (let i = 0; i < nifty.length; i++) {
    const idio = gaussian(rand) * 0.012;
    const ret = beta * niftyRets[i] + idio;
    const open = price * (1 + (rand() - 0.48) * 0.006);
    price = Math.max(0.5, price * (1 + ret));
    const high = Math.max(open, price) * (1 + rand() * 0.012);
    const low = Math.min(open, price) * (1 - rand() * 0.012);
    const vol = stock.avgVolume * (0.55 + rand() * 0.9 + Math.abs(ret) * 12);
    bars.push({
      date: nifty[i].date,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(price.toFixed(2)),
      volume: Math.round(vol),
    });
  }
  const last = bars[bars.length - 1];
  const scale = stock.basePrice / last.close;
  for (const b of bars) {
    b.open = Number((b.open * scale).toFixed(2));
    b.high = Number((b.high * scale).toFixed(2));
    b.low = Number((b.low * scale).toFixed(2));
    b.close = Number((b.close * scale).toFixed(2));
  }
  return applyPattern(stock.symbol, bars);
}

export function generateSectorBars(sector: string, nifty: OhlcBar[]): OhlcBar[] {
  const dummy: UniverseStock = {
    symbol: `SECT-${sector}`,
    name: sector,
    sector,
    cap: "large",
    nifty50: false,
    nifty500: true,
    securityId: 0,
    basePrice: SECTOR_INDEX_BASE[sector] ?? 10000,
    avgVolume: 4_000_000,
  };
  return generateStockBars(dummy, nifty);
}

export function demoFlows(days: string[]): FlowDay[] {
  const rand = mulberry32(42);
  return days.slice(-40).map((date, i) => {
    const late = i > 28;
    const fiiNet = late ? -(1800 + rand() * 2200) : (rand() - 0.55) * 2800;
    const diiNet = -fiiNet * (0.65 + rand() * 0.4) + (rand() - 0.4) * 600;
    const fiiBuy = 9000 + rand() * 4000;
    const diiBuy = 8500 + rand() * 3500;
    return {
      date,
      fiiNet: Number(fiiNet.toFixed(0)),
      diiNet: Number(diiNet.toFixed(0)),
      fiiBuy: Number(fiiBuy.toFixed(0)),
      fiiSell: Number((fiiBuy - fiiNet).toFixed(0)),
      diiBuy: Number(diiBuy.toFixed(0)),
      diiSell: Number((diiBuy - diiNet).toFixed(0)),
    };
  });
}

export function demoOptionStrikes(spot: number): {
  strike: number;
  callOi: number;
  putOi: number;
  callIv: number;
  putIv: number;
}[] {
  const rand = mulberry32(7);
  const atm = Math.round(spot / 50) * 50;
  const strikes = [];
  for (let k = atm - 1500; k <= atm + 1500; k += 50) {
    const dist = (k - spot) / spot;
    const callOi = Math.round((1_200_000 * Math.exp(-((dist - 0.01) ** 2) / 0.0018) + rand() * 80_000));
    const putOi = Math.round((1_450_000 * Math.exp(-((dist + 0.008) ** 2) / 0.0016) + rand() * 90_000));
    strikes.push({
      strike: k,
      callOi,
      putOi,
      callIv: 12 + Math.abs(dist) * 80 + rand() * 1.5,
      putIv: 13 + Math.abs(dist) * 70 + rand() * 1.5,
    });
  }
  return strikes;
}

export function demoPcrHistory(days: string[]): { date: string; pcr: number }[] {
  const rand = mulberry32(99);
  return days.slice(-40).map((date, i) => ({
    date,
    pcr: Number((0.92 + i * 0.006 + rand() * 0.08).toFixed(2)),
  }));
}

export function demoDelivery(symbol: string): number {
  const rand = mulberry32(hash(symbol + "del"));
  return Number((28 + rand() * 42).toFixed(1));
}

export function demoOiBuild(
  change1d: number,
  volSpike: number,
): "long-build" | "short-cover" | "short-build" | "long-unwind" | "neutral" {
  if (change1d > 0.4 && volSpike >= 1.4) return "long-build";
  if (change1d > 0.4 && volSpike <= 0.85) return "short-cover";
  if (change1d < -0.4 && volSpike >= 1.4) return "short-build";
  if (change1d < -0.4 && volSpike <= 0.85) return "long-unwind";
  return "neutral";
}

export function demoStockFo(symbol: string, spot: number, change1d: number, expiry: string): StockFo {
  const rand = mulberry32(hash(symbol + "fo"));
  const step = strikeStep(spot);
  const atm = Math.round(spot / step) * step;
  const strikes = [];
  for (let k = atm - step * 8; k <= atm + step * 8; k += step) {
    const dist = (k - spot) / Math.max(spot, 1);
    const callOi = Math.round(80_000 * Math.exp(-((dist - 0.012) ** 2) / 0.0022) + rand() * 8_000);
    const putOi = Math.round(95_000 * Math.exp(-((dist + 0.01) ** 2) / 0.002) + rand() * 9_000);
    const iv = 18 + Math.abs(dist) * 55 + rand() * 2.5;
    const ltp = Math.max(0.5, spot * 0.012 * Math.exp(-((dist * 8) ** 2)) * (0.7 + rand() * 0.5));
    strikes.push({
      strike: Number(k.toFixed(2)),
      callOi,
      putOi,
      callIv: iv,
      putIv: iv + 0.8 + rand(),
      callLtp: Number((ltp * (k >= spot ? 0.85 : 1.15)).toFixed(2)),
      putLtp: Number((ltp * (k <= spot ? 0.85 : 1.15)).toFixed(2)),
      callOiChg: Math.round((rand() - 0.45) * 12_000),
      putOiChg: Math.round((rand() - 0.42) * 12_000),
    });
  }
  return foFromChain({
    symbol,
    spot,
    expiry,
    strikes,
    change1d,
    source: "demo",
    futPremiumPct: Number(((rand() - 0.46) * 1.6).toFixed(2)),
  });
}

export function earningsFor(symbol: string, lastDate: string): {
  prev: string;
  next: string;
  impact: number;
} {
  const rand = mulberry32(hash(symbol + "earn"));
  const last = new Date(`${lastDate}T00:00:00Z`);
  const prev = new Date(last);
  prev.setUTCDate(prev.getUTCDate() - (45 + Math.floor(rand() * 40)));
  const next = new Date(last);
  next.setUTCDate(next.getUTCDate() + (8 + Math.floor(rand() * 50)));
  const impact = Number(((rand() - 0.48) * 8.5).toFixed(2));
  return {
    prev: prev.toISOString().slice(0, 10),
    next: next.toISOString().slice(0, 10),
    impact: impact,
  };
}

export function demoIndexBars(): Record<string, OhlcBar[]> {
  const days = tradingDays();
  const out: Record<string, OhlcBar[]> = {};
  for (const idx of INDEX_META) {
    out[idx.id] = generateIndexPath(idx.id, days, idx.base);
  }
  return out;
}
