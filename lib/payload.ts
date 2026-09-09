import type { ChartPoint, DashboardSnapshot, EmaStatus } from "@/lib/types";

export function withoutCharts(snap: DashboardSnapshot): DashboardSnapshot {
  return {
    ...snap,
    stocks: snap.stocks.map((s) => ({ ...s, chart: [] })),
  };
}

export function stockChartPayload(
  snap: DashboardSnapshot,
  symbol: string,
): { symbol: string; chart: ChartPoint[]; emas: EmaStatus[] } | null {
  const row = snap.stocks.find((s) => s.symbol === symbol);
  if (!row) return null;
  return { symbol: row.symbol, chart: row.chart, emas: row.emas };
}
