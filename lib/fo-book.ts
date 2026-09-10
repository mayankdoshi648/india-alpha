import { aroundAtm, maxPain, pct, round } from "@/lib/indicators";
import type { DataSource, FoIndexBook, OptionStrike } from "@/lib/types";

function demoIndexStrikes(spot: number): OptionStrike[] {
  const step = spot > 20000 ? 50 : 100;
  const atm = Math.round(spot / step) * step;
  const strikes: OptionStrike[] = [];
  for (let k = atm - step * 12; k <= atm + step * 12; k += step) {
    const dist = (k - spot) / Math.max(spot, 1);
    strikes.push({
      strike: k,
      callOi: Math.round(1_200_000 * Math.exp(-((dist - 0.01) ** 2) / 0.0018)),
      putOi: Math.round(1_450_000 * Math.exp(-((dist + 0.008) ** 2) / 0.0016)),
      callIv: 12 + Math.abs(dist) * 80,
      putIv: 13 + Math.abs(dist) * 70,
    });
  }
  return strikes;
}

export function indexBookFrom(
  symbol: string,
  label: string,
  source: DataSource,
  spot: number,
  expiry: string,
  strikes: OptionStrike[],
): FoIndexBook {
  const callOi = strikes.reduce((s, x) => s + x.callOi, 0);
  const putOi = strikes.reduce((s, x) => s + x.putOi, 0);
  const pain = maxPain(strikes);
  const ladder = aroundAtm(strikes, spot, 15);
  const callWall = strikes.reduce((a, b) => (a.callOi >= b.callOi ? a : b), strikes[0])?.strike ?? 0;
  const putWall = strikes.reduce((a, b) => (a.putOi >= b.putOi ? a : b), strikes[0])?.strike ?? 0;
  return {
    symbol,
    label,
    source,
    spot,
    expiry,
    pcr: callOi ? round(putOi / callOi, 2) : 0,
    maxPain: pain,
    maxPainDistancePct: pain ? round(pct(pain, spot), 2) : 0,
    callOi,
    putOi,
    callWall,
    putWall,
    ladder,
  };
}

export function demoBankBook(spot: number, expiry: string): FoIndexBook {
  return indexBookFrom("BANKNIFTY", "Bank Nifty", "demo", spot, expiry, demoIndexStrikes(spot));
}
