import type { FlowDay, OhlcBar } from "@/lib/types";

const NSE_HOME = "https://www.nseindia.com";

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

let cookieJar = "";
let cookieAt = 0;

async function nseGet<T>(path: string): Promise<T> {
  if (!cookieJar || Date.now() - cookieAt > 10 * 60_000) {
    const home = await fetch(NSE_HOME, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    cookieJar = home.headers.getSetCookie?.().join("; ") ?? home.headers.get("set-cookie") ?? "";
    cookieAt = Date.now();
  }
  const res = await fetch(`${NSE_HOME}${path}`, {
    headers: { ...BROWSER_HEADERS, Cookie: cookieJar },
    cache: "no-store",
    signal: AbortSignal.timeout(3500),
  });
  if (!res.ok) throw new Error(`NSE ${path} ${res.status}`);
  return (await res.json()) as T;
}

export interface NseIndex {
  index: string;
  last: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
}

export async function nseAllIndices(): Promise<NseIndex[]> {
  const json = await nseGet<{ data?: NseIndex[] }>("/api/allIndices");
  return json.data ?? [];
}

export interface NseConstituent {
  symbol: string;
  lastPrice: number;
  pChange: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  totalTradedVolume: number;
}

export async function nseIndexStocks(index: string): Promise<NseConstituent[]> {
  const json = await nseGet<{ data?: NseConstituent[] }>(
    `/api/equity-stockIndices?index=${encodeURIComponent(index)}`,
  );
  return json.data ?? [];
}

export async function nseFiiDii(): Promise<FlowDay[]> {
  const json = await nseGet<
    | { data?: Record<string, unknown>[] }
    | Record<string, unknown>[]
  >("/api/fiidiiTradeData");
  const rows = Array.isArray(json) ? json : json.data ?? [];
  return rows.map((row) => {
    const r = row as Record<string, string | number>;
    const num = (k: string) => Number(String(r[k] ?? 0).replace(/,/g, "")) || 0;
    return {
      date: String(r.date ?? r.tradingDate ?? ""),
      fiiBuy: num("fiiBuyValue") || num("buyValue") || num("fiiBuy"),
      fiiSell: num("fiiSellValue") || num("sellValue") || num("fiiSell"),
      fiiNet: num("fiiNetValue") || num("fiiNet") || num("netValue"),
      diiBuy: num("diiBuyValue") || num("diiBuy"),
      diiSell: num("diiSellValue") || num("diiSell"),
      diiNet: num("diiNetValue") || num("diiNet"),
    };
  });
}

export async function nseOptionChain(symbol: string): Promise<{
  spot: number;
  expiry: string;
  strikes: { strike: number; callOi: number; putOi: number; callIv: number; putIv: number }[];
}> {
  return nseChain(`/api/option-chain-indices?symbol=${encodeURIComponent(symbol)}`);
}

export async function nseEquityOptionChain(symbol: string): Promise<{
  spot: number;
  expiry: string;
  strikes: {
    strike: number;
    callOi: number;
    putOi: number;
    callIv: number;
    putIv: number;
    callLtp?: number;
    putLtp?: number;
    callOiChg?: number;
    putOiChg?: number;
  }[];
}> {
  return nseChain(`/api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`);
}

async function nseChain(path: string): Promise<{
  spot: number;
  expiry: string;
  strikes: {
    strike: number;
    callOi: number;
    putOi: number;
    callIv: number;
    putIv: number;
    callLtp?: number;
    putLtp?: number;
    callOiChg?: number;
    putOiChg?: number;
  }[];
}> {
  const json = await nseGet<{
    records?: {
      expiryDates?: string[];
      underlyingValue?: number;
      data?: {
        strikePrice: number;
        expiryDate: string;
        CE?: {
          openInterest?: number;
          changeinOpenInterest?: number;
          impliedVolatility?: number;
          lastPrice?: number;
        };
        PE?: {
          openInterest?: number;
          changeinOpenInterest?: number;
          impliedVolatility?: number;
          lastPrice?: number;
        };
      }[];
    };
  }>(path);
  const expiry = json.records?.expiryDates?.[0] ?? "";
  const spot = json.records?.underlyingValue ?? 0;
  const rows = (json.records?.data ?? []).filter((d) => !expiry || d.expiryDate === expiry);
  const byStrike = new Map<
    number,
    {
      strike: number;
      callOi: number;
      putOi: number;
      callIv: number;
      putIv: number;
      callLtp?: number;
      putLtp?: number;
      callOiChg?: number;
      putOiChg?: number;
    }
  >();
  for (const r of rows) {
    const cur = byStrike.get(r.strikePrice) ?? {
      strike: r.strikePrice,
      callOi: 0,
      putOi: 0,
      callIv: 0,
      putIv: 0,
      callLtp: 0,
      putLtp: 0,
      callOiChg: 0,
      putOiChg: 0,
    };
    cur.callOi += r.CE?.openInterest ?? 0;
    cur.putOi += r.PE?.openInterest ?? 0;
    cur.callIv = r.CE?.impliedVolatility ?? cur.callIv;
    cur.putIv = r.PE?.impliedVolatility ?? cur.putIv;
    cur.callLtp = r.CE?.lastPrice ?? cur.callLtp;
    cur.putLtp = r.PE?.lastPrice ?? cur.putLtp;
    cur.callOiChg = (cur.callOiChg ?? 0) + (r.CE?.changeinOpenInterest ?? 0);
    cur.putOiChg = (cur.putOiChg ?? 0) + (r.PE?.changeinOpenInterest ?? 0);
    byStrike.set(r.strikePrice, cur);
  }
  return { spot, expiry, strikes: [...byStrike.values()] };
}

export async function nseChart(symbol: string): Promise<OhlcBar[]> {
  const json = await nseGet<{
    grapthData?: [number, number][];
    graphs?: { date?: string; close?: number }[];
  }>(`/api/chart-databyindex?index=${encodeURIComponent(symbol)}EQN`);
  if (json.grapthData?.length) {
    return json.grapthData.map(([ts, close]) => ({
      date: new Date(ts).toISOString().slice(0, 10),
      open: close,
      high: close,
      low: close,
      close,
      volume: 0,
    }));
  }
  return [];
}
