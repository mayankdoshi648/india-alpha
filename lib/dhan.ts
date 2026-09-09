import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { indiaCalendarDate } from "@/lib/session";
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
  if (/\/profile\b/i.test(raw) && /DH-906|Order_Error|Invalid Token/i.test(raw)) {
    return "Dhan /profile rejected this JWT (DH-906). That call is trading-only. Data APIs tokens are validated on market LTP instead — reconnect. If LTP also fails, paste a fresh 24-hour Data APIs JWT from web.dhan.co → My Profile → Access DhanHQ APIs (starts with eyJ, not the API key).";
  }
  if (/DH-906/i.test(raw) || (/Order_Error/i.test(raw) && /Invalid Token/i.test(raw))) {
    return "Dhan rejected this JWT (DH-906 Invalid Token). Paste a fresh 24-hour Data APIs Access Token from web.dhan.co → My Profile → Access DhanHQ APIs. It starts with eyJ — not the API key and not an order/trading token. Subscribe to Data APIs if you have not. If you already used RenewToken, the previous JWT is dead.";
  }
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

/** Trading /profile often returns DH-906 for Data APIs JWTs. Marketfeed LTP is the real check. */
export function isOptionalDhanProfileError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/\/profile\b/i.test(msg)) return false;
  return /DH-906|Order_Error|Invalid Token|Invalid Authentication|DH-901|401|403|Unauthorized|Forbidden|Authentication Failed/i.test(msg);
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
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "access-token": c.accessToken,
  };
  const id = c.clientId?.trim();
  if (id) {
    h["client-id"] = id;
    h.dhanClientId = id;
  }
  return h;
}

async function readDhanError(res: Response, path: string): Promise<never> {
  const text = await res.text();
  throw new Error(explainDhanAuthError(`Dhan ${path} ${res.status}: ${text}`));
}

/** Data APIs allow 1 marketfeed request per second. Parallel snapshot calls otherwise 429/empty. */
const DHAN_GAP_MS = 1100;
let dhanGate: Promise<void> = Promise.resolve();
let lastDhanPostAt = 0;

async function throttleDhan<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void = () => {};
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = dhanGate;
  dhanGate = mine;
  await prev.catch(() => undefined);
  try {
    const wait = DHAN_GAP_MS - (Date.now() - lastDhanPostAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastDhanPostAt = Date.now();
    return await fn();
  } finally {
    release();
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return throttleDhan(async () => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) await readDhanError(res, path);
    return (await res.json()) as T;
  });
}

export type DhanPx = {
  last: number;
  prevClose?: number;
  changePct?: number;
  open?: number;
  high?: number;
  low?: number;
};

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseDhanPx(row: unknown): DhanPx | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const ohlc = r.ohlc && typeof r.ohlc === "object" ? (r.ohlc as Record<string, unknown>) : {};
  const last = num(r.last_price) ?? num(r.LTP) ?? num(r.lastPrice);
  if (last == null) return null;
  const prevClose = num(ohlc.close) ?? num(r.previous_close) ?? num(r.prev_close);
  const open = num(ohlc.open) ?? num(r.open);
  const high = num(ohlc.high) ?? num(r.high);
  const low = num(ohlc.low) ?? num(r.low);
  const net = num(r.net_change);
  let changePct: number | undefined;
  if (prevClose && prevClose !== 0) changePct = ((last - prevClose) / prevClose) * 100;
  else if (net != null && last - net !== 0) changePct = (net / (last - net)) * 100;
  return { last, prevClose, changePct, open, high, low };
}

export async function dhanSegmentOhlc(
  segment: string,
  ids: number[],
): Promise<Record<string, DhanPx>> {
  const unique = [...new Set(ids.filter((id) => id > 0))];
  const out: Record<string, DhanPx> = {};
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    let json: { data?: Record<string, Record<string, unknown>> };
    try {
      json = await post("/marketfeed/ohlc", { [segment]: chunk });
    } catch {
      json = await post("/marketfeed/ltp", { [segment]: chunk });
    }
    const bucket = json.data?.[segment] ?? {};
    for (const [id, row] of Object.entries(bucket)) {
      const px = parseDhanPx(row);
      if (px) out[id] = px;
    }
  }
  return out;
}

export interface DhanProfile {
  dhanClientId?: string;
  dhanClientName?: string;
  tokenValidity?: string;
  dataPlan?: string;
  dataValidity?: string;
}

export async function dhanProfile(accessToken: string, clientId?: string): Promise<DhanProfile> {
  const token = cleanDhanSecret(accessToken);
  const id = cleanDhanSecret(clientId);
  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    "access-token": token,
  };
  if (id) {
    reqHeaders["client-id"] = id;
    reqHeaders.dhanClientId = id;
  }
  const res = await fetch(`${BASE}/profile`, {
    method: "GET",
    headers: reqHeaders,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dhan /profile ${res.status}: ${text.slice(0, 280)}`);
  }
  return (await res.json()) as DhanProfile;
}

/** Prove the JWT can read Data APIs. /profile is optional (trading-only on many plans). */
export async function dhanVerifyDataAccess(creds: DhanCredentials): Promise<{
  profile: DhanProfile | null;
  clientId: string;
  nifty: number | null;
}> {
  let profile: DhanProfile | null = null;
  try {
    profile = await dhanProfile(creds.accessToken, creds.clientId);
  } catch (err) {
    if (!isOptionalDhanProfileError(err)) throw err;
  }
  const clientId = (profile?.dhanClientId?.trim() || creds.clientId || "").trim();
  const nifty = await runWithDhan({ accessToken: creds.accessToken, clientId }, async () => {
    const ltp = await dhanIndexLtp([13]);
    return ltp["13"] ?? Object.values(ltp)[0] ?? null;
  });
  return { profile, clientId, nifty };
}

/** Extends a still-valid web JWT by 24h. Fails once the token has already expired. */
export async function dhanRenewToken(
  accessToken: string,
  clientId: string,
): Promise<{ accessToken: string; expiryTime?: string; clientId?: string }> {
  const token = cleanDhanSecret(accessToken);
  const id = cleanDhanSecret(clientId);
  const res = await fetch(`${BASE}/RenewToken`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "access-token": token,
      "client-id": id,
      dhanClientId: id,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) await readDhanError(res, "/RenewToken");
  const json = (await res.json()) as {
    accessToken?: string;
    access_token?: string;
    expiryTime?: string;
    dhanClientId?: string;
  };
  const next = cleanDhanSecret(json.accessToken || json.access_token);
  if (!looksLikeJwt(next)) throw new Error("Dhan did not return a renewed access token.");
  return {
    accessToken: next,
    expiryTime: json.expiryTime,
    clientId: json.dhanClientId?.trim(),
  };
}

export async function dhanLtp(ids: number[]): Promise<Record<string, number>> {
  const quotes = await dhanSegmentOhlc("NSE_EQ", ids);
  const out: Record<string, number> = {};
  for (const [id, px] of Object.entries(quotes)) out[id] = px.last;
  return out;
}

export async function dhanIndexLtp(ids: number[]): Promise<Record<string, number>> {
  const quotes = await dhanIndexOhlc(ids);
  const out: Record<string, number> = {};
  for (const [id, px] of Object.entries(quotes)) out[id] = px.last;
  return out;
}

export async function dhanIndexOhlc(ids: number[]): Promise<Record<string, DhanPx>> {
  return dhanSegmentOhlc("IDX_I", ids);
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
    const ms = ts > 10_000_000_000 ? ts : ts * 1000;
    const date = indiaCalendarDate(new Date(ms));
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

let scripCache: { at: number; map: Map<string, number> } | null = null;

export async function dhanSecurityMap(): Promise<Map<string, number>> {
  if (scripCache && Date.now() - scripCache.at < 6 * 60 * 60_000) return scripCache.map;
  const url = "https://images.dhan.co/api-data/api-scrip-master.csv";
  const res = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error("Dhan scrip master unavailable");
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(",");
  const idIdx = header.findIndex((h) => /SEM_SMST_SECURITY_ID|SECURITY_ID/i.test(h));
  const symIdx = header.findIndex((h) => /SEM_TRADING_SYMBOL|SYMBOL/i.test(h));
  const instIdx = header.findIndex((h) => /SEM_INSTRUMENT_NAME|INSTRUMENT/i.test(h));
  const exchIdx = header.findIndex((h) => /SEM_EXM_EXCH_ID|EXCH/i.test(h));
  const seriesIdx = header.findIndex((h) => /SEM_SERIES|SERIES/i.test(h));
  const map = new Map<string, number>();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const cols = line.split(",");
    const inst = cols[instIdx] ?? "";
    const exch = cols[exchIdx] ?? "";
    const series = cols[seriesIdx] ?? "";
    if (!/^EQUITY$/i.test(inst) || !/^NSE$/i.test(exch)) continue;
    if (series && !/^(EQ|BE)$/i.test(series)) continue;
    const symbol = cols[symIdx]?.trim();
    const id = Number(cols[idIdx]);
    if (symbol && id) {
      if (!map.has(symbol) || series === "EQ") map.set(symbol, id);
    }
  }
  // Tata Motors listed as TMPV after the split; keep the old ticker pointing at that cash name.
  if (map.has("TMPV") && !map.has("TATAMOTORS")) map.set("TATAMOTORS", map.get("TMPV")!);
  scripCache = { at: Date.now(), map };
  return map;
}
