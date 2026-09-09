export function inr(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function compact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString("en-IN");
}

export function signed(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  const v = n.toFixed(d);
  return n > 0 ? `+${v}` : v;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y.slice(2)}`;
}

export const PATTERN_LABEL: Record<string, string> = {
  stage2: "Stage 2",
  breakout: "Base breakout",
  volume_surge: "Volume surge",
  vcp: "VCP",
  bullish_div: "Bullish divergence",
  bearish_div: "Bearish divergence",
  hidden_bullish_div: "Hidden bullish",
  hidden_bearish_div: "Hidden bearish",
  pivot_reclaim: "Pivot reclaim",
  oversold_pullback: "Oversold pullback",
};

export const PATTERN_TONE: Record<string, string> = {
  stage2: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  breakout: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  volume_surge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  vcp: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  bullish_div: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  bearish_div: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  hidden_bullish_div: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  hidden_bearish_div: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  pivot_reclaim: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  oversold_pullback: "bg-lime-500/15 text-lime-300 border-emerald-500/30",
};
