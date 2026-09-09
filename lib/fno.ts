import { aroundAtm, maxPain, pct, round } from "@/lib/indicators";
import { dhanConfigured, dhanExpiryList, dhanOptionChain } from "@/lib/dhan";
import { nseEquityOptionChain } from "@/lib/nse";
import type { DataSource, OiBuild, OptionStrike, StockFo } from "@/lib/types";

export function strikeStep(spot: number): number {
  if (spot < 100) return 2.5;
  if (spot < 250) return 5;
  if (spot < 500) return 10;
  if (spot < 2000) return 20;
  if (spot < 5000) return 50;
  return 100;
}

export function nextThursday(from: string): string {
  const d = new Date(`${from}T00:00:00Z`);
  const day = d.getUTCDay();
  const add = (4 - day + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

function oiBuildFrom(
  change1d: number,
  callChg: number,
  putChg: number,
  pcr: number,
): OiBuild {
  const net = callChg + putChg;
  if (callChg !== 0 || putChg !== 0) {
    if (change1d > 0.3 && net > 0) return "long-build";
    if (change1d > 0.3 && net < 0) return "short-cover";
    if (change1d < -0.3 && net > 0) return "short-build";
    if (change1d < -0.3 && net < 0) return "long-unwind";
  }
  if (change1d > 0.4 && pcr <= 0.85) return "long-build";
  if (change1d > 0.4 && pcr >= 1.15) return "short-cover";
  if (change1d < -0.4 && pcr >= 1.15) return "short-build";
  if (change1d < -0.4 && pcr <= 0.85) return "long-unwind";
  return "neutral";
}

export function foFromChain(input: {
  symbol: string;
  spot: number;
  expiry: string;
  strikes: OptionStrike[];
  change1d: number;
  source: DataSource;
  futPremiumPct: number;
}): StockFo {
  const strikes = [...input.strikes].sort((a, b) => a.strike - b.strike);
  const callOi = strikes.reduce((s, x) => s + x.callOi, 0);
  const putOi = strikes.reduce((s, x) => s + x.putOi, 0);
  const pcr = callOi ? round(putOi / callOi, 2) : 0;
  const pain = maxPain(strikes);
  const callWall = strikes.reduce((a, b) => (a.callOi >= b.callOi ? a : b), strikes[0])?.strike ?? 0;
  const putWall = strikes.reduce((a, b) => (a.putOi >= b.putOi ? a : b), strikes[0])?.strike ?? 0;
  const ladder = aroundAtm(strikes, input.spot, 9);
  const atm = aroundAtm(strikes, input.spot, 1)[0];
  const atmIv = atm ? round(((atm.callIv || 0) + (atm.putIv || 0)) / 2, 1) : 0;
  const ivSkew = atm ? round((atm.putIv || 0) - (atm.callIv || 0), 2) : 0;
  const straddle = atm ? round((atm.callLtp || 0) + (atm.putLtp || 0), 2) : 0;
  const expectedMovePct =
    input.spot > 0 && straddle > 0
      ? round((straddle / input.spot) * 100, 2)
      : round((atmIv / 16) * 0.8, 2);
  const callChg = strikes.reduce((s, x) => s + (x.callOiChg || 0), 0);
  const putChg = strikes.reduce((s, x) => s + (x.putOiChg || 0), 0);
  return {
    listed: true,
    symbol: input.symbol,
    source: input.source,
    expiry: input.expiry,
    pcr,
    maxPain: pain,
    callWall,
    putWall,
    atmIv,
    ivSkew,
    straddle,
    expectedMovePct,
    futPremiumPct: input.futPremiumPct,
    callOi,
    putOi,
    oiBuild: oiBuildFrom(input.change1d, callChg, putChg, pcr),
    ladder,
  };
}

export async function fetchLiveStockFo(input: {
  symbol: string;
  securityId: number;
  spot: number;
  change1d: number;
  futPremiumPct: number;
}): Promise<StockFo | null> {
  if (dhanConfigured() && input.securityId > 0) {
    try {
      const expiries = await dhanExpiryList(input.securityId, "NSE_FNO");
      const expiry = expiries[0];
      if (expiry) {
        const chain = await dhanOptionChain(input.securityId, "NSE_FNO", expiry);
        if (chain.strikes.length >= 6) {
          return foFromChain({
            symbol: input.symbol,
            spot: chain.spot || input.spot,
            expiry,
            strikes: chain.strikes,
            change1d: input.change1d,
            source: "dhan",
            futPremiumPct: input.futPremiumPct,
          });
        }
      }
    } catch {
      // NSE fallback
    }
  }
  try {
    const chain = await nseEquityOptionChain(input.symbol);
    if (chain.strikes.length >= 6) {
      return foFromChain({
        symbol: input.symbol,
        spot: chain.spot || input.spot,
        expiry: chain.expiry,
        strikes: chain.strikes,
        change1d: input.change1d,
        source: "nse",
        futPremiumPct: input.futPremiumPct,
      });
    }
  } catch {
    return null;
  }
  return null;
}

export function pctFromPain(spot: number, pain: number): number {
  return round(pct(pain, spot), 2);
}
