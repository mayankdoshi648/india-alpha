import { INDEX_META, SECTOR_INDEX_BASE } from "@/lib/universe";
import type { FlowDay, OhlcBar, UniverseStock } from "@/lib/types";

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

function applyPattern(symbol: string, bars: OhlcBar[]): OhlcBar[] {
  const out = bars.map((b) => ({ ...b }));
  const n = out.length;
  const last = out[n - 1];

  const reshape = (from: number, fn: (bar: OhlcBar, i: number, slice: OhlcBar[]) => void) => {
    const slice = out.slice(from);
    slice.forEach((bar, i) => fn(bar, i, slice));
  };

  if (["BEL", "HAL", "MAXHEALTH", "MAZDOCK"].includes(symbol)) {
    reshape(n - 80, (bar, i) => {
      const t = i / 80;
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

  if (["TRENT", "PERSISTENT", "POLYCAB"].includes(symbol)) {
    const windows = [24, 14, 8];
    let cursor = n - 2;
    let scale = 0.14;
    for (const w of windows) {
      for (let i = cursor - w; i < cursor; i++) {
        if (i < 0) continue;
        const mid = out[cursor - 1].close;
        const amp = scale * mid;
        const x = (i - (cursor - w)) / w;
        out[i].close = mid + Math.sin(x * Math.PI * 2) * amp * 0.35;
        out[i].high = out[i].close + amp * 0.4;
        out[i].low = out[i].close - amp * 0.4;
        out[i].volume *= 0.72;
      }
      cursor -= Math.floor(w * 0.65);
      scale *= 0.55;
    }
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
