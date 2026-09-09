import { ema, last, pct, round, sma } from "@/lib/indicators";
import type { OhlcBar, StrategySettings, SwingCheck, SwingSetup, SwingStatus, VcpLeg } from "@/lib/types";

const VCP_LAST_DEPTH_MAX = 10.5;
const EXTENDED_VS_10 = 8;

function windowStats(bars: OhlcBar[]) {
  const high = Math.max(...bars.map((b) => b.high));
  const low = Math.min(...bars.map((b) => b.low));
  const vol = bars.reduce((s, b) => s + b.volume, 0) / Math.max(1, bars.length);
  return {
    high,
    low,
    depthPct: high ? round(((high - low) / high) * 100, 1) : 0,
    bars: bars.length,
    vol,
  };
}

function planLevels(pivot: number, stop: number, baseHeight: number, close: number) {
  let safeStop = stop;
  if (!(pivot > safeStop) || pct(safeStop, pivot) < 1.2) {
    safeStop = round(pivot * 0.97, 2);
  }
  const risk = pivot - safeStop;
  const target1R = round(pivot + risk, 2);
  const target2R = round(pivot + risk * 2, 2);
  const measured = round(pivot + Math.max(baseHeight, risk * 1.6), 2);
  const target = measured;
  const riskPct = round(Math.abs(pct(close, safeStop)), 2);
  const rewardPct = round(pct(close, target), 2);
  const rr = riskPct > 0.15 ? round(rewardPct / riskPct, 1) : 0;
  return { stop: round(safeStop, 2), target, target1R, target2R, measured, riskPct, rewardPct, rr };
}

function statusFrom(opts: {
  distToPivotPct: number;
  extFrom10Pct: number;
  triggered: boolean;
  failed: boolean;
  throwback: boolean;
}): SwingStatus {
  if (opts.failed) return "failed";
  if (opts.triggered && opts.extFrom10Pct > EXTENDED_VS_10) return "extended";
  if (opts.triggered) return "triggered";
  if (opts.throwback) return "throwback";
  if (Math.abs(opts.distToPivotPct) <= 1.6) return "at_pivot";
  return "coiling";
}

function nextAction(kind: "vcp" | "breakout", status: SwingStatus, entry: number, stop: number, t1: number): string {
  const e = round(entry, 1);
  const s = round(stop, 1);
  const t = round(t1, 1);
  if (kind === "vcp") {
    if (status === "coiling") {
      return `Do not buy yet. Wait for the last contraction to tighten under ${VCP_LAST_DEPTH_MAX}% and a close within 1.5% of the pivot.`;
    }
    if (status === "at_pivot") {
      return `Buy stop ${e}. Invalid if the last contraction low fails — hard stop ${s}. First scale at 1R ${t}.`;
    }
    if (status === "triggered") {
      return `Breakout is live. Hold; trail under the 10 EMA. Take a first scale at 1R ${t}, runner toward 2R.`;
    }
    if (status === "throwback") {
      return `Throwback into the 10 EMA after the VCP break. Add/enter if the EMA holds; stop ${s}.`;
    }
    if (status === "extended") {
      return `Extended vs the 10 EMA. Do not chase. Wait for a throwback toward the EMA, then use the same stop ${s}.`;
    }
    return `Pivot lost. Cancel buy stops. Wait for a new higher-low coil before re-arming.`;
  }
  if (status === "coiling") {
    return `Base is forming. Arm a buy stop ${e} only if the handle stays tight and volume dries into the pivot.`;
  }
  if (status === "at_pivot") {
    return `Buy stop ${e} on a volume close through the 55-day high. Stop ${s} under the handle.`;
  }
  if (status === "triggered") {
    return `Breakout confirmed. Do not add if it stretches >${EXTENDED_VS_10}% above the 10 EMA. First scale ${t}.`;
  }
  if (status === "throwback") {
    return `Classic throwback: price returned to the 10 EMA after clearing the base. Enter/add if it holds; stop ${s}.`;
  }
  if (status === "extended") {
    return `Chasing a stretched breakout. Stand aside until a throwback to the 10 EMA.`;
  }
  return `Failed breakout — close back inside the base. Stand aside until a new pivot prints.`;
}

function checks(items: SwingCheck[]) {
  return items;
}

export function analyzeVcp(bars: OhlcBar[], settings: StrategySettings): SwingSetup | null {
  if (bars.length < 50) return null;
  const body = bars.slice(0, -1);
  const lastBar = last(bars);
  const windows = [34, 21, 13, 8];
  const legs: VcpLeg[] = [];
  let cursor = body.length;
  let priorVol = 0;
  for (const w of windows) {
    const from = Math.max(0, cursor - w);
    const slice = body.slice(from, cursor);
    if (slice.length < 6) break;
    const st = windowStats(slice);
    const volDryPct = priorVol ? round((1 - st.vol / Math.max(priorVol, 1)) * 100, 0) : 0;
    legs.push({
      depthPct: st.depthPct,
      bars: st.bars,
      high: round(st.high, 2),
      low: round(st.low, 2),
      volDryPct,
    });
    priorVol = st.vol;
    cursor = from + Math.floor(w * 0.28);
  }
  legs.reverse();
  if (legs.length < 2) return null;
  const depths = legs.map((l) => l.depthPct);
  let tightening = 0;
  for (let i = 1; i < depths.length; i++) {
    if (depths[i] < depths[i - 1] * 0.92) tightening++;
  }
  const lastDepth = depths[depths.length - 1];
  const contracting = tightening >= Math.max(1, depths.length - 2) && lastDepth <= VCP_LAST_DEPTH_MAX;
  if (!contracting) return null;

  const last8 = body.slice(-8);
  const last21 = body.slice(-21);
  const tight = windowStats(last8);
  const prior = windowStats(last21);
  const tightnessPct = prior.depthPct ? round((tight.depthPct / prior.depthPct) * 100, 0) : 100;
  const volLast = sma(bars.slice(-8).map((b) => b.volume), 8).at(-1) ?? 1;
  const volPrior = sma(bars.slice(-30, -8).map((b) => b.volume), 20).at(-1) ?? 1;
  const volDryPct = round((1 - volLast / Math.max(volPrior, 1)) * 100, 0);

  const pivot = round(Math.max(...last8.map((b) => b.high), legs[legs.length - 1].high), 2);
  const stopLow = Math.min(tight.low, legs[legs.length - 1].low);
  const baseHeight = legs[0].high - Math.min(...legs.map((l) => l.low));
  const close = lastBar.close;
  const distToPivotPct = round(pct(close, pivot), 2);
  const ema10 = last(ema(bars.map((b) => b.close), settings.emaFast));
  const extFrom10Pct = round(pct(ema10, close), 2);
  const triggered = close > pivot * 1.002 && lastBar.volume > volPrior * 1.15;
  const recentlyBroke = body.slice(-5).some((b) => b.close > pivot);
  const failed = recentlyBroke && close < pivot * 0.992;
  const throwback = recentlyBroke && !triggered && extFrom10Pct < 3.5 && close >= ema10 * 0.995;
  const levels = planLevels(pivot, stopLow, baseHeight, close);
  const status = statusFrom({
    distToPivotPct,
    extFrom10Pct,
    triggered,
    failed,
    throwback,
  });
  const entry = round(pivot * 1.002, 2);
  const closeInRangePct =
    lastBar.high === lastBar.low ? 50 : round(((lastBar.close - lastBar.low) / (lastBar.high - lastBar.low)) * 100, 0);
  const checklist = checks([
    { label: `${legs.length} contractions (need ≥2)`, ok: legs.length >= 2 },
    { label: `Each pullback shallower (${depths.map((d) => d.toFixed(1)).join("→")}%)`, ok: tightening >= Math.max(1, depths.length - 2) },
    { label: `Last leg ≤ ${VCP_LAST_DEPTH_MAX}% (now ${lastDepth}%)`, ok: lastDepth <= VCP_LAST_DEPTH_MAX },
    { label: `Volume dry-up ≥12% into the coil (now ${volDryPct}%)`, ok: volDryPct >= 12 },
    { label: `Last 8d tightness ≤55% of the 21d range (now ${tightnessPct}%)`, ok: tightnessPct <= 55 },
    { label: `Not stretched >${EXTENDED_VS_10}% above 10 EMA (now ${extFrom10Pct}%)`, ok: extFrom10Pct <= EXTENDED_VS_10 },
    { label: triggered ? `Breakout volume vs prior 3 weeks (${round(lastBar.volume / Math.max(volPrior, 1), 2)}x)` : "Still inside the coil — no volume trigger yet", ok: triggered ? lastBar.volume > volPrior * 1.15 : status !== "failed" },
  ]);
  const notes = [
    `Minervini VCP: ${legs.length} contractions ${depths.map((d) => `${d.toFixed(1)}%`).join(" → ")}. Each pullback must be shallower than the last; the last one is the buy zone.`,
    tightnessPct <= 55
      ? `Handle is tight: last 8 sessions are ${tightnessPct}% of the 21-day range.`
      : `Handle still wide (${tightnessPct}% of the 21-day range). Let it coil further.`,
    volDryPct >= 12
      ? `Supply is leaving: volume dry-up ${volDryPct}% vs the prior 3 weeks.`
      : "Volume has not fully dried in the last contraction — low-volume coil is the tell.",
    `Buy stop ${entry} (a tick above pivot ${round(pivot, 1)}). Hard stop ${levels.stop} under the last contraction low (${levels.riskPct}% risk).`,
    `Measured move ${levels.target} · 1R ${levels.target1R} · 2R ${levels.target2R}. Scale the first third at 1R; trail the rest under the 10 EMA.`,
    extFrom10Pct > EXTENDED_VS_10
      ? `Extended ${extFrom10Pct}% above the 10 EMA — a late chase. Prefer a throwback.`
      : `10 EMA extension ${extFrom10Pct}% — still a swing-length move, not a melt-up.`,
  ];
  let score = 62 + tightening * 6 + (volDryPct >= 12 ? 8 : 0) + (tightnessPct <= 55 ? 6 : 0);
  if (status === "at_pivot") score += 8;
  if (status === "triggered") score += 10;
  if (status === "throwback") score += 7;
  if (status === "extended" || status === "failed") score -= 12;

  return {
    kind: "vcp",
    status,
    score: Math.max(50, Math.min(96, score)),
    pivot,
    entry,
    stop: levels.stop,
    target: levels.target,
    target1R: levels.target1R,
    target2R: levels.target2R,
    riskPct: levels.riskPct,
    rewardPct: levels.rewardPct,
    rr: levels.rr,
    distToPivotPct,
    extFrom10Pct,
    baseDays: legs.reduce((s, l) => s + l.bars, 0),
    baseDepthPct: round(Math.max(...depths), 1),
    tightnessPct,
    volDryPct,
    handleDepthPct: lastDepth,
    breakoutVolX: round(lastBar.volume / Math.max(volPrior, 1), 2),
    closeInRangePct,
    contractions: legs,
    checklist,
    nextAction: nextAction("vcp", status, entry, levels.stop, levels.target1R),
    notes,
    summary: `${legs.length}-leg VCP ${status.replaceAll("_", " ")} · ${depths.map((d) => d.toFixed(0)).join("→")}% · pivot ${pivot.toFixed(0)}`,
  };
}

export function analyzeBreakout(bars: OhlcBar[], settings: StrategySettings): SwingSetup | null {
  if (bars.length < 40) return null;
  const look = Math.min(55, bars.length - 1);
  const base = bars.slice(-look, -1);
  const lastBar = last(bars);
  const pivot = Math.max(...base.map((b) => b.high));
  const baseLow = Math.min(...base.map((b) => b.low));
  const baseDepthPct = round(((pivot - baseLow) / pivot) * 100, 1);
  const avgVol = sma(base.map((b) => b.volume), settings.volumeAvgDays).at(-1) ?? 1;
  const volX = lastBar.volume / Math.max(avgVol, 1);
  const close = lastBar.close;
  const closeInRangePct =
    lastBar.high === lastBar.low ? 50 : round(((close - lastBar.low) / (lastBar.high - lastBar.low)) * 100, 0);
  const last8 = base.slice(-8);
  const last21 = base.slice(-21);
  const handle = windowStats(last8);
  const prior = windowStats(last21);
  const tightnessPct = prior.depthPct ? round((handle.depthPct / prior.depthPct) * 100, 0) : 100;
  const ema10 = last(ema(bars.map((b) => b.close), settings.emaFast));
  const extFrom10Pct = round(pct(ema10, close), 2);
  const distToPivotPct = round(pct(close, pivot), 2);
  const retraceOk = baseDepthPct <= settings.breakoutRetracePct && baseDepthPct < 22;
  const volOk = volX >= settings.breakoutVolumeMult;
  const broke = close > pivot * 1.002;
  const near = close >= pivot * 0.985 && close <= pivot * 1.002;
  const recentlyBroke = base.slice(-5).some((b) => b.close > pivot);
  const failed = recentlyBroke && close < pivot * 0.995;
  const throwback = recentlyBroke && !broke && extFrom10Pct < 3.5 && close >= ema10 * 0.995;

  if (!retraceOk) return null;
  if (!broke && !near && !throwback && !failed) return null;
  if (broke && !volOk && closeInRangePct < 55) return null;

  const stopLow = Math.min(lastBar.low, Math.min(...last8.map((b) => b.low)));
  const levels = planLevels(pivot, stopLow, pivot - baseLow, close);
  const status = statusFrom({
    distToPivotPct,
    extFrom10Pct,
    triggered: broke && (volOk || closeInRangePct >= 55),
    failed,
    throwback,
  });
  const entry = round(pivot * 1.002, 2);
  const volDryPct = round((1 - handle.vol / Math.max(prior.vol, 1)) * 100, 0);
  const checklist = checks([
    { label: `55-day base depth <22% (now ${baseDepthPct}%)`, ok: baseDepthPct < 22 },
    { label: `Retrace ≤ ${settings.breakoutRetracePct}% of the prior advance`, ok: baseDepthPct <= settings.breakoutRetracePct },
    { label: `Handle tightness ≤65% of the 21d range (now ${tightnessPct}%)`, ok: tightnessPct <= 65 },
    { label: `Volume dry-up in the handle (${volDryPct}%)`, ok: volDryPct >= 8 },
    {
      label: broke
        ? `Breakout volume ≥ ${settings.breakoutVolumeMult}x (now ${volX.toFixed(1)}x)`
        : `Will need ≥ ${settings.breakoutVolumeMult}x volume on the break`,
      ok: broke ? volOk : true,
    },
    { label: `Close in the upper third of the bar (now ${closeInRangePct}%)`, ok: !broke || closeInRangePct >= 70 },
    { label: `Not stretched >${EXTENDED_VS_10}% vs 10 EMA (now ${extFrom10Pct}%)`, ok: extFrom10Pct <= EXTENDED_VS_10 },
  ]);
  const notes = [
    `${look - 1}d consolidation, depth ${baseDepthPct}%. A usable equity base stays under ~22% and inside the ${settings.breakoutRetracePct}% retrace cap.`,
    tightnessPct <= 65
      ? `Handle (last 8d) is ${handle.depthPct}% deep — ${tightnessPct}% of the 21-day range.`
      : `Handle still ${handle.depthPct}% deep. Tighter is better; wide handles fail more often.`,
    broke
      ? `Cleared pivot ${round(pivot, 1)} on ${volX.toFixed(1)}x volume, close in ${closeInRangePct}% of the bar.`
      : near
        ? `Within ${Math.abs(distToPivotPct).toFixed(1)}% of pivot ${round(pivot, 1)}. Place a buy stop ${entry}; do not buy inside the base.`
        : throwback
          ? "Throwback into the 10 EMA after the break — this is the second entry, not a failure."
          : "Close lost the pivot. Treat as a failed breakout until a new high is reclaimed on volume.",
    closeInRangePct >= 70
      ? "Strong close (upper 30% of the bar) — institutions lifting offers."
      : broke
        ? "Close is not in the upper third. Prefer a follow-through day before sizing up."
        : "Wait for a strong close through the pivot; weak closes get faded.",
    `Stop ${levels.stop} (${levels.riskPct}% under the handle). 1R ${levels.target1R} · 2R ${levels.target2R} · measured ${levels.target}.`,
    extFrom10Pct > EXTENDED_VS_10
      ? `Extended ${extFrom10Pct}% vs the 10 EMA — do not chase. The next buy is a throwback.`
      : `10 EMA extension ${extFrom10Pct}% — still in a swing-length pocket.`,
  ];
  let score = 70;
  if (broke && volOk) score += 12;
  if (closeInRangePct >= 70) score += 6;
  if (near && tightnessPct <= 60) score += 8;
  if (throwback) score += 7;
  if (status === "extended" || status === "failed") score -= 14;

  return {
    kind: "breakout",
    status,
    score: Math.max(52, Math.min(96, score)),
    pivot: round(pivot, 2),
    entry,
    stop: levels.stop,
    target: levels.target,
    target1R: levels.target1R,
    target2R: levels.target2R,
    riskPct: levels.riskPct,
    rewardPct: levels.rewardPct,
    rr: levels.rr,
    distToPivotPct,
    extFrom10Pct,
    baseDays: base.length,
    baseDepthPct,
    tightnessPct,
    volDryPct,
    handleDepthPct: handle.depthPct,
    breakoutVolX: round(volX, 2),
    closeInRangePct,
    contractions: [],
    checklist,
    nextAction: nextAction("breakout", status, entry, levels.stop, levels.target1R),
    notes,
    summary: broke
      ? `Breakout ${round(pivot, 0)} on ${volX.toFixed(1)}x · ${levels.rr}R · stop ${levels.stop}`
      : `${status.replaceAll("_", " ")} at ${round(pivot, 0)} · base ${baseDepthPct}% · handle ${handle.depthPct}%`,
  };
}
