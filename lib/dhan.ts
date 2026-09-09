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

export function cleanDhanSecret(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/[\r\n\s]+/g, "");
}

export function looksLikeJwt(value: string): boolean {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function clientIdFromJwt(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    const id = payload.dhanClientId ?? payload.dhanClientID ?? payload.clientId ?? payload.client_id;
    return typeof id === "string" || typeof id === "number" ? String(id).trim() : "";
  } catch {
    return "";
  }
}

export function sanitizeDhanInput(raw?: Partial<DhanCredentials> | null): DhanCredentials | undefined {
  let accessToken = cleanDhanSecret(raw?.accessToken);
  let clientId = cleanDhanSecret(raw?.clientId);
  if (looksLikeJwt(clientId) && !looksLikeJwt(accessToken)) {
    [accessToken, clientId] = [clientId, accessToken];
  }
  if (!accessToken) return undefined;
  if (!clientId) clientId = clientIdFromJwt(accessToken);
  return { accessToken, clientId };
}

export function explainDhanAuthError(raw: string): string {
  if (/806|DH-902|not subscribed/i.test(raw)) {
    return "This access token is valid, but Data APIs are not subscribed. In web.dhan.co open My Profile → Access DhanHQ APIs and subscribe to the data plan.";
  }
  if (/807|expired/i.test(raw)) {
    return "This Dhan access token has expired. Generate a new 24-hour Access Token at web.dhan.co → My Profile → Access DhanHQ APIs.";
  }
  if (/810/.test(raw)) {
    return "Dhan rejected the Client ID. Leave Client ID blank — the desk fills it from your token — or paste the numeric dhanClientId from My Profile (not UCC).";
  }
  if (/809/.test(raw)) {
    return "Dhan rejected the access token. Paste a fresh JWT Access Token (it starts with eyJ), not the API key or API secret.";
  }
  if (/808|DH-901|Authentication Failed/i.test(raw)) {
    return "Dhan rejected this Client ID or access token. Use a fresh 24-hour Access Token from web.dhan.co → My Profile → Access DhanHQ APIs, and the numeric Client ID shown there. Do not paste the API key. Tokens expire in 24 hours.";
  }
  return raw.slice(0, 240);
}

export function runWithDhan<T>(creds: DhanCredentials | undefined, fn: () => T): T {
  const env = envCreds();
  return als.run(
    {
      accessToken: cleanDhanSecret(creds?.accessToken) || env.accessToken,
      clientId: cleanDhanSecret(creds?.clientId) || env.clientId,
    },
    fn,
  );
}

export function activeDhan(): DhanCredentials {
  return als.getStore() ?? envCreds();
}

export function dhanConfigured(): boolean {
  const c = activeDhan();
  return Boolean(c.accessToken);
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
    dhanClientId: c.clientId,
  };
}

async function readDhanError(res: Response, path: string): Promise<never> {
  const text = await res.text();
  throw new Error(explainDhanAuthError(`Dhan ${path} ${res.status}: ${text}`));
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) await readDhanError(res, path);
  return (await res.json()) as T;
}

export interface DhanProfile {
  dhanClientId?: string;
  dhanClientName?: string;
  tokenValidity?: string;
  dataPlan?: string;
  dataValidity?: string;
}

export async function dhanProfile(accessToken: string): Promise<DhanProfile> {
  const token = cleanDhanSecret(accessToken);
  const res = await fetch(`${BASE}/profile`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "access-token": token,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) await readDhanError(res, "/profile");
  return (await res.json()) as DhanProfile;
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
