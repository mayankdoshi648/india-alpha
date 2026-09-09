import type { StockRow } from "@/lib/types";

export function exportUniverseCsv(rows: StockRow[]): string {
  const headers = [
    "symbol",
    "name",
    "cap",
    "sector",
    "cmp",
    "change1d",
    "change1w",
    "change1m",
    "rsi",
    "volume",
    "volSpike",
    "gapPct",
    "distFrom20Ema",
    "deliveryPct",
    "oiBuild",
    "rsNifty",
    "stage2Score",
    "nifty50",
    "emaStack",
    "weeklyStack",
    "atrPct",
    "turnover",
    "distFrom50",
    "distFrom200",
    "pos52w",
    "daysToEarnings",
    "sectorQuad",
    "abovePivot",
    "bullishCross",
    "patterns",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r.symbol,
      `"${r.name.replaceAll('"', "")}"`,
      r.cap,
      `"${r.sector}"`,
      r.cmp,
      r.change1d,
      r.change1w,
      r.change1m,
      r.rsi,
      r.volume,
      r.volSpike,
      r.gapPct,
      r.distFrom20Ema,
      r.deliveryPct,
      r.oiBuild,
      r.rsNifty,
      r.stage2Score,
      r.nifty50 ? "Y" : "N",
      r.emaStack,
      r.weeklyStack,
      r.atrPct,
      r.turnover,
      r.distFrom50,
      r.distFrom200,
      r.pos52w,
      r.daysToEarnings,
      r.sectorQuad,
      r.abovePivot ? "above" : "below",
      r.bullishCross ? "Y" : "N",
      `"${r.patterns.join("|")}"`,
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
