import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { DhanCredentials, OhlcBar } from "@/lib/types";

const BASE = "https://api.dhan.co/v2";
const als = new AsyncLocalStorage<DhanCredentials>();

function envCreds(): DhanCredentials {
  return {
    accessToken: process.env.DHAN_ACCESS_TOKEN?.trim() ?? "",
    clientId: process.env.DHAN_CLIENT_ID?.trim() ?? "",
  };
}

export function sanitizeDhanInput(raw?: Partial<DhanCredentials> | null): DhanCredentials | undefined {
  const accessToken = raw?.accessToken?.trim() ?? "";
  const clientId = raw?.clientId?.trim() ?? "";
  if (!accessToken || !clientId) return undefined;
  return { accessToken, clientId };
}

export function runWithDhan<T>(creds: DhanCredentials | undefined, fn: () => T): T {
  const env = envCreds();
  return als.run(
    {
      accessToken: creds?.accessToken?.trim() || env.accessToken,
      clientId: creds?.clientId?.trim() || env.clientId,
    },
    fn,
  );
}

export function activeDhan(): DhanCredentials {
  return als.getStore() ?? envCreds();
}

export function dhanConfigured(): boolean {
  const c = activeDhan();
  return Boolean(c.accessToken && c.clientId);
}

export function dhanFingerprint(): string {
  const c = activeDhan();
  if (!c.accessToken) return "none";
  return createHash("sha256").update(`${c.clientId}:${c.accessToken}`).digest("hex").slice(0, 12);
}

function headers(): HeadersInit {
  const c = activeDhan();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "access-token": c.accessToken,
    "client-id": c.clientId,
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dhan ${path} ${res.status}: ${text.slice(0, 180)}`);
  }
  return (await res.json()) as T;
}

export async function dhanLtp(ids: number[]): Promise<Record<string, number>> {
  const unique = [...new Set(ids.filter((id) => id > 0))];
  const out: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const json = await post<{ data?: Record<string, Record<string, { last_price?: number }>> }>(
      "/marketfeed/ltp",
      { NSE_EQ: chunk },
    );
    const bucket = json.data?.NSE_EQ ?? json.data ?? {};
    for (const [id, row] of Object.entries(bucket)) {
      const px = (row as { last_price?: number; LTP?: number }).last_price
        ?? (row as { LTP?: number }).LTP;
      if (typeof px === "number") out[id] = px;
    }
  }
  return out;
}

export async function dhanIndexLtp(ids: number[]): Promise<Record<string, number>> {
  const json = await post<{ data?: Record<string, Record<string, { last_price?: number }>> }>(
    "/marketfeed/ltp",
    { IDX_I: ids },
  );
  const bucket = json.data?.IDX_I ?? {};
  const out: Record<string, number> = {};
  for (const [id, row] of Object.entries(bucket)) {
    const px = (row as { last_price?: number }).last_price;
    if (typeof px === "number") out[id] = px;
  }
  return out;
}

interface HistPayload {
  open?: number[];
  high?: number[];
  low?: number[];
  close?: number[];
  volume?: number[];
  timestamp?: number[];
}

export async function dhanHistorical(params: {
  securityId: string;
  exchangeSegment: string;
  instrument: string;
  fromDate: string;
  toDate: string;
}): Promise<OhlcBar[]> {
  const json = await post<HistPayload>("/charts/historical", {
    securityId: params.securityId,
    exchangeSegment: params.exchangeSegment,
    instrument: params.instrument,
    expiryCode: 0,
    oi: false,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  const n = json.close?.length ?? 0;
  const bars: OhlcBar[] = [];
  for (let i = 0; i < n; i++) {
    const ts = json.timestamp?.[i] ?? 0;
    const date = ts > 10_000_000_000
      ? new Date(ts).toISOString().slice(0, 10)
      : new Date(ts * 1000).toISOString().slice(0, 10);
    bars.push({
      date,
      open: json.open?.[i] ?? 0,
      high: json.high?.[i] ?? 0,
      low: json.low?.[i] ?? 0,
      close: json.close?.[i] ?? 0,
      volume: json.volume?.[i] ?? 0,
    });
  }
  return bars;
}

export async function dhanExpiryList(underlyingScrip: number, segment: string): Promise<string[]> {
  const json = await post<{ data?: string[] }>("/optionchain/expirylist", {
    UnderlyingScrip: underlyingScrip,
    UnderlyingSeg: segment,
  });
  return json.data ?? [];
}

export interface DhanChainStrike {
  strike: number;
  callOi: number;
  putOi: number;
  callIv: number;
  putIv: number;
  callLtp: number;
  putLtp: number;
}

export async function dhanOptionChain(
  underlyingScrip: number,
  segment: string,
  expiry: string,
): Promise<{ spot: number; strikes: DhanChainStrike[] }> {
  const json = await post<{
    data?: {
      last_price?: number;
      oc?: Record<string, {
        ce?: { oi?: number; implied_volatility?: number; last_price?: number };
        pe?: { oi?: number; implied_volatility?: number; last_price?: number };
      }>;
    };
  }>("/optionchain", {
    UnderlyingScrip: underlyingScrip,
    UnderlyingSeg: segment,
    Expiry: expiry,
  });
  const oc = json.data?.oc ?? {};
  const strikes: DhanChainStrike[] = Object.entries(oc).map(([strike, row]) => ({
    strike: Number(strike),
    callOi: row.ce?.oi ?? 0,
    putOi: row.pe?.oi ?? 0,
    callIv: row.ce?.implied_volatility ?? 0,
    putIv: row.pe?.implied_volatility ?? 0,
    callLtp: row.ce?.last_price ?? 0,
    putLtp: row.pe?.last_price ?? 0,
  }));
  return { spot: json.data?.last_price ?? 0, strikes };
}

export async function dhanSecurityMap(): Promise<Map<string, number>> {
  const url = "https://images.dhan.co/api-data/api-scrip-master.csv";
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error("Dhan scrip master unavailable");
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(",");
  const idIdx = header.findIndex((h) => /SEM_SMST_SECURITY_ID|SECURITY_ID/i.test(h));
  const symIdx = header.findIndex((h) => /SEM_TRADING_SYMBOL|SYMBOL/i.test(h));
  const instIdx = header.findIndex((h) => /SEM_INSTRUMENT_NAME|INSTRUMENT/i.test(h));
  const exchIdx = header.findIndex((h) => /SEM_EXM_EXCH_ID|EXCH/i.test(h));
  const map = new Map<string, number>();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const cols = line.split(",");
    const inst = cols[instIdx] ?? "";
    const exch = cols[exchIdx] ?? "";
    if (!/EQUITY/i.test(inst) || !/NSE/i.test(exch)) continue;
    const symbol = cols[symIdx]?.trim();
    const id = Number(cols[idIdx]);
    if (symbol && id) map.set(symbol, id);
  }
  return map;
}
