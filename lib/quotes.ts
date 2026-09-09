import { dhanConfigured, dhanSecurityMap, dhanSegmentOhlc, type DhanPx } from "@/lib/dhan";
import type { DataSource, UniverseStock } from "@/lib/types";

export type Ltp = {
  last: number;
  changePct?: number;
  open?: number;
  high?: number;
  low?: number;
};

/** NSE tickers that no longer match Yahoo's `.NS` symbol. */
const YAHOO_ALIAS: Record<string, string> = {
  TATAMOTORS: "TMPV",
};

const YAHOO_INDEX: { yahoo: string; nse: string }[] = [
  { yahoo: "^NSEI", nse: "NIFTY 50" },
  { yahoo: "^CRSLDX", nse: "NIFTY 500" },
  { yahoo: "^NSEBANK", nse: "NIFTY BANK" },
  { yahoo: "^BSESN", nse: "SENSEX" },
  { yahoo: "^INDIAVIX", nse: "INDIA VIX" },
];

const CHUNK = 20;
const WAVE = 8;

function yahooSymbol(nse: string): string {
  const mapped = YAHOO_ALIAS[nse] ?? nse;
  return mapped.startsWith("^") ? mapped : `${mapped}.NS`;
}

function nseFromYahoo(symbol: string): string {
  const bare = symbol.endsWith(".NS") ? symbol.slice(0, -3) : symbol;
  const alias = Object.entries(YAHOO_ALIAS).find(([, yahoo]) => yahoo === bare);
  if (alias) return alias[0];
  return bare;
}

async function spark(symbols: string[]): Promise<Record<string, Ltp>> {
  if (!symbols.length) return {};
  const q = symbols.map((s) => encodeURIComponent(s)).join(",");
  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${q}&range=1d&interval=1d`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) throw new Error(`Yahoo spark ${res.status}`);
  const json = (await res.json()) as {
    spark?: {
      result?: {
        symbol: string;
        response?: {
          meta?: {
            regularMarketPrice?: number;
            regularMarketChangePercent?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketOpen?: number;
          };
        }[];
      }[];
    };
  };
  const out: Record<string, Ltp> = {};
  for (const item of json.spark?.result ?? []) {
    const meta = item.response?.[0]?.meta;
    const last = meta?.regularMarketPrice;
    if (!meta || typeof last !== "number" || !Number.isFinite(last)) continue;
    out[item.symbol] = {
      last,
      changePct: typeof meta.regularMarketChangePercent === "number" ? meta.regularMarketChangePercent : undefined,
      high: typeof meta.regularMarketDayHigh === "number" ? meta.regularMarketDayHigh : undefined,
      low: typeof meta.regularMarketDayLow === "number" ? meta.regularMarketDayLow : undefined,
      open: typeof meta.regularMarketOpen === "number" ? meta.regularMarketOpen : undefined,
    };
  }
  return out;
}

async function sparkChunked(symbols: string[]): Promise<Record<string, Ltp>> {
  const out: Record<string, Ltp> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));
  for (let i = 0; i < chunks.length; i += WAVE) {
    const wave = chunks.slice(i, i + WAVE);
    const parts = await Promise.all(
      wave.map(async (chunk) => {
        try {
          return await spark(chunk);
        } catch {
          if (chunk.length === 1) return {};
          const mid = Math.ceil(chunk.length / 2);
          const [a, b] = await Promise.all([
            sparkChunked(chunk.slice(0, mid)).catch(() => ({})),
            sparkChunked(chunk.slice(mid)).catch(() => ({})),
          ]);
          return { ...a, ...b };
        }
      }),
    );
    for (const part of parts) Object.assign(out, part);
  }
  return out;
}

export async function yahooEquityQuotes(nseSymbols: string[]): Promise<Record<string, Ltp>> {
  const unique = [...new Set(nseSymbols.filter(Boolean))];
  const raw = await sparkChunked(unique.map(yahooSymbol));
  const out: Record<string, Ltp> = {};
  for (const [yahoo, ltp] of Object.entries(raw)) {
    out[nseFromYahoo(yahoo)] = ltp;
  }
  return out;
}

export async function yahooIndexQuotes(): Promise<Record<string, Ltp>> {
  const raw = await sparkChunked(YAHOO_INDEX.map((x) => x.yahoo));
  const out: Record<string, Ltp> = {};
  for (const row of YAHOO_INDEX) {
    const ltp = raw[row.yahoo];
    if (ltp) out[row.nse] = ltp;
  }
  return out;
}

function pxFromDhan(px: DhanPx): Ltp {
  return {
    last: px.last,
    changePct: px.changePct,
    open: px.open,
    high: px.high,
    low: px.low,
  };
}

export async function fetchEquityLtps(members: UniverseStock[]): Promise<{
  bySymbol: Record<string, Ltp>;
  source: DataSource;
}> {
  const bySymbol: Record<string, Ltp> = {};
  let source: DataSource = "demo";

  if (dhanConfigured()) {
    try {
      const known = new Map<string, number>();
      for (const s of members) {
        if (s.securityId > 0) known.set(s.symbol, s.securityId);
      }
      const unresolved = members.filter((s) => !known.has(s.symbol));
      const mapP = unresolved.length ? dhanSecurityMap().catch(() => null) : Promise.resolve(null);
      const knownIds = [...new Set(known.values())];
      const firstP = knownIds.length ? dhanSegmentOhlc("NSE_EQ", knownIds) : Promise.resolve({} as Record<string, DhanPx>);
      const [scrips, first] = await Promise.all([mapP, firstP]);
      if (scrips) {
        for (const s of unresolved) {
          const id = scrips.get(s.symbol) || scrips.get(YAHOO_ALIAS[s.symbol] ?? "") || 0;
          if (id > 0) known.set(s.symbol, id);
        }
      }
      const extraIds = [...new Set(
        unresolved.map((s) => known.get(s.symbol) ?? 0).filter((id) => id > 0 && !knownIds.includes(id)),
      )];
      const second = extraIds.length ? await dhanSegmentOhlc("NSE_EQ", extraIds) : {};
      const quotes = { ...first, ...second };
      for (const s of members) {
        const id = known.get(s.symbol);
        const px = id ? quotes[String(id)] : undefined;
        if (px) bySymbol[s.symbol] = pxFromDhan(px);
      }
      if (Object.keys(bySymbol).length) source = "dhan";
    } catch {
      // Yahoo fill
    }
  }

  const missing = members.filter((s) => !bySymbol[s.symbol]).map((s) => s.symbol);
  if (missing.length) {
    try {
      const y = await yahooEquityQuotes(missing);
      Object.assign(bySymbol, y);
      if (source === "demo" && Object.keys(y).length) source = "yahoo";
    } catch {
      // keep whatever we have
    }
  }

  return { bySymbol, source };
}
