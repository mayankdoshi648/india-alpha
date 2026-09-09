import { dhanConfigured, dhanLtp, dhanSecurityMap } from "@/lib/dhan";
import type { DataSource, UniverseStock } from "@/lib/types";

export type Ltp = { last: number; changePct?: number };

/** Dhan listed Tata Motors passenger as TMPV after the split. */
const DHAN_ALIAS: Record<string, string> = {
  TATAMOTORS: "TMPV",
};

export async function fetchEquityLtps(members: UniverseStock[]): Promise<{
  bySymbol: Record<string, Ltp>;
  source: DataSource;
}> {
  const bySymbol: Record<string, Ltp> = {};
  if (!dhanConfigured()) return { bySymbol, source: "demo" };

  try {
    const idBySymbol = new Map<string, number>();
    try {
      const scrips = await dhanSecurityMap();
      for (const s of members) {
        const id = s.securityId || scrips.get(s.symbol) || scrips.get(DHAN_ALIAS[s.symbol] ?? "") || 0;
        if (id > 0) idBySymbol.set(s.symbol, id);
      }
    } catch {
      for (const s of members) {
        if (s.securityId > 0) idBySymbol.set(s.symbol, s.securityId);
      }
    }
    const ids = [...new Set(idBySymbol.values())];
    const ltp = ids.length ? await dhanLtp(ids) : {};
    for (const s of members) {
      const id = idBySymbol.get(s.symbol);
      const px = id ? ltp[String(id)] : undefined;
      if (typeof px === "number") bySymbol[s.symbol] = { last: px };
    }
    return { bySymbol, source: Object.keys(bySymbol).length ? "dhan" : "demo" };
  } catch {
    return { bySymbol, source: "demo" };
  }
}

export async function dhanSecurityIdFor(symbol: string, fallback = 0): Promise<number> {
  if (fallback > 0) return fallback;
  try {
    const scrips = await dhanSecurityMap();
    return scrips.get(symbol) || scrips.get(DHAN_ALIAS[symbol] ?? "") || 0;
  } catch {
    return 0;
  }
}
