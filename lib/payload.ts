import type { ChartPoint, DashboardSnapshot, EmaStatus, StockFo } from "@/lib/types";

export function withoutCharts(snap: DashboardSnapshot): DashboardSnapshot {
  return {
    ...snap,
    stocks: snap.stocks.map((s) => ({ ...s, chart: [] })),
  };
}

export function stockChartPayload(
  snap: DashboardSnapshot,
  symbol: string,
): {
  symbol: string;
  chart: ChartPoint[];
  emas: EmaStatus[];
  fo: StockFo | null;
  cmp: number;
  change1d: number;
  vcp: DashboardSnapshot["stocks"][number]["vcp"];
  breakout: DashboardSnapshot["stocks"][number]["breakout"];
} | null {
  const row = snap.stocks.find((s) => s.symbol === symbol);
  if (!row) return null;
  return {
    symbol: row.symbol,
    chart: row.chart,
    emas: row.emas,
    fo: row.fo,
    cmp: row.cmp,
    change1d: row.change1d,
    vcp: row.vcp,
    breakout: row.breakout,
  };
}
