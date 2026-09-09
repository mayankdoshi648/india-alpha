import {
  betaVs,
  chaikinMoneyFlow,
  classicPivot,
  consecutiveStreak,
  crossedUp,
  ema,
  emaStatuses,
  last,
  maxPain,
  pct,
  realizedVol,
  aroundAtm,
  resample,
  round,
  rsi,
  runDaysAbove,
  sma,
  stackAlignment,
  valueAt,
  vwap,
} from "@/lib/indicators";
import { detectPatterns, stage2Checklist } from "@/lib/patterns";
import { detectChartPatterns } from "@/lib/chart-patterns";
import {
  demoDelivery,
  demoFlows,
  demoIndexBars,
  demoOiBuild,
  demoOptionStrikes,
  demoPcrHistory,
  demoStockFo,
  earningsFor,
  generateIndexPath,
  generateSectorBars,
  generateStockBars,
} from "@/lib/mock";
import {
  dhanConfigured,
  dhanExpiryList,
  dhanFingerprint,
  dhanHistorical,
  dhanIndexLtp,
  dhanOptionChain,
} from "@/lib/dhan";
import { nseAllIndices, nseFiiDii, nseOptionChain } from "@/lib/nse";
import { fetchEquityLtps, yahooIndexQuotes } from "@/lib/quotes";
import { mergeSettings } from "@/lib/settings";
import {
  DHAN_INDEX_IDS,
  INDEX_META,
  SECTORS,
  stocksFor,
  UNIVERSE,
} from "@/lib/universe";
import { nextThursday } from "@/lib/fno";
import type {
  BreadthCircle,
  BreadthPoint,
  ChartPatternHit,
  DashboardSnapshot,
  DataSource,
  DeskAlert,
  DerivativesRadar,
  HeatCell,
  IndexTile,
  MacroTile,
  OhlcBar,
  OptionStrike,
  PatternHit,
  SectorTile,
  StockRow,
  StrategySettings,
  UniverseId,
  UniverseStock,
} from "@/lib/types";

const CACHE_VER = 16;
const cache = new Map<string, { at: number; value: DashboardSnapshot }>();

export type SnapshotOpts = {
  /** Skip NSE/Dhan. Used when baking the public tape and on Vercel without keys. */
  live?: boolean;
};

function liveFeedsEnabled(opts?: SnapshotOpts): boolean {
  if (opts?.live === false) return false;
  return true;
}

function overlayLast(bars: OhlcBar[], close: number, changePct?: number): OhlcBar[] {
  if (!bars.length) return bars;
  const copy = bars.map((b) => ({ ...b }));
  const lastBar = copy[copy.length - 1];
  if (typeof changePct === "number" && Number.isFinite(changePct) && copy.length >= 2) {
    const prevClose = close / (1 + changePct / 100);
    copy[copy.length - 2].close = Number(prevClose.toFixed(2));
    lastBar.close = close;
    lastBar.high = Math.max(lastBar.high, close);
    lastBar.low = Math.min(lastBar.low, close);
    return copy;
  }
  const scale = lastBar.close ? close / lastBar.close : 1;
  for (const b of copy) {
    b.open = Number((b.open * scale).toFixed(2));
    b.high = Number((b.high * scale).toFixed(2));
    b.low = Number((b.low * scale).toFixed(2));
    b.close = Number((b.close * scale).toFixed(2));
  }
  return copy;
}

function scoreMember(input: {
  s: UniverseStock;
  bars: OhlcBar[];
  niftyCloses: number[];
  niftyClose: number;
  settings: StrategySettings;
  asOf: string;
  sectorQuad: SectorTile["quadrant"];
}): { row: StockRow; hits: PatternHit[]; chartHits: ChartPatternHit[] } {
  const { s, bars, niftyCloses, niftyClose, settings, asOf, sectorQuad } = input;
  const closes = bars.map((b) => b.close);
  const lastBar = last(bars);
  const prev = bars[bars.length - 2];
  const rsiSeries = rsi(closes, settings.rsiPeriod);
  const rsiNow = last(rsiSeries);
  const rsiMa = last(sma(rsiSeries, settings.rsiMaPeriod));
  const emas = emaStatuses(closes, settings);
  const ema20 = emas.find((e) => e.period === settings.emaShort)?.value ?? lastBar.close;
  const ema50 = emas.find((e) => e.period === settings.emaMid)?.value ?? lastBar.close;
  const ema200 = emas.find((e) => e.period === settings.emaLong)?.value ?? lastBar.close;
  const volAvg = last(sma(bars.map((b) => b.volume), settings.volumeAvgDays)) || 1;
  const volSpike = lastBar.volume / volAvg;
  const high52 = Math.max(...closes.slice(-252));
  const low52 = Math.min(...closes.slice(-252));
  const earn = earningsFor(s.symbol, asOf);
  const stage = stage2Checklist(bars, settings);
  const distFrom20 = pct(ema20, lastBar.close);
  const detected = detectPatterns(bars, settings, {
    stage2Score: stage.score,
    rsiNow,
    rsiMa,
    above50: lastBar.close >= ema50,
    above200: lastBar.close >= ema200,
    volSpike,
    distFrom20,
  });
  const weekly = emaStatuses(weeklyCloses(bars), settings);
  const fast = ema(closes, settings.emaFast);
  const slow = ema(closes, settings.emaShort);
  const pivot = classicPivot(prev);
  const row: StockRow = {
    symbol: s.symbol,
    name: s.name,
    cap: s.cap,
    sector: s.sector,
    nifty50: s.nifty50,
    cmp: round(lastBar.close, 2),
    change1d: round(pct(prev.close, lastBar.close), 2),
    change1w: round(pct(valueAt(closes, 5), lastBar.close), 2),
    change1m: round(pct(valueAt(closes, 21), lastBar.close), 2),
    rsi: round(rsiNow, 1),
    spark: closes.slice(-7),
    volume: lastBar.volume,
    volSpike: round(volSpike, 2),
    gapPct: round(pct(prev.close, lastBar.open), 2),
    emas,
    emaStack: stackAlignment(emas),
    distFrom20Ema: round(distFrom20, 2),
    below52wHigh: round(pct(lastBar.close, high52), 2),
    above52wLow: round(pct(low52, lastBar.close), 2),
    prevEarningDate: earn.prev,
    earningsImpactPct: earn.impact,
    nextEarningDate: earn.next,
    patterns: detected.map((d) => d.kind),
    stage2Score: stage.score,
    abovePivot: lastBar.close >= pivot.p,
    rsiAboveMa: rsiNow >= rsiMa,
    bullishCross: crossedUp(fast, slow, 5),
    weeklyStack: stackAlignment(weekly),
    deliveryPct: demoDelivery(s.symbol),
    oiBuild: demoOiBuild(round(pct(prev.close, lastBar.close), 2), round(volSpike, 2)),
    rsNifty: round(pct(valueAt(closes, 21), lastBar.close) - pct(valueAt(niftyCloses, 21), niftyClose), 2),
    chart: bars.slice(-80).map((b) => ({
      date: b.date,
      close: b.close,
      high: b.high,
      low: b.low,
      volume: b.volume,
    })),
    atrPct: round(
      ((bars.slice(-14).reduce((sum, b) => sum + (b.high - b.low), 0) / Math.min(14, bars.length)) /
        lastBar.close) *
        100,
      2,
    ),
    turnover: round(lastBar.close * lastBar.volume, 0),
    distFrom50: round(pct(ema50, lastBar.close), 2),
    distFrom200: round(pct(ema200, lastBar.close), 2),
    pos52w: high52 === low52 ? 50 : round(((lastBar.close - low52) / (high52 - low52)) * 100, 0),
    daysToEarnings: Math.round((Date.parse(earn.next) - Date.parse(asOf)) / 86_400_000),
    sectorQuad,
    change3m: round(pct(valueAt(closes, 63), lastBar.close), 2),
    dayHigh: round(lastBar.high, 2),
    dayLow: round(lastBar.low, 2),
    rangePos:
      lastBar.high === lastBar.low
        ? 50
        : round(((lastBar.close - lastBar.low) / (lastBar.high - lastBar.low)) * 100, 0),
    avgVolume: round(volAvg, 0),
    beta: betaVs(closes, niftyCloses, 60),
    streak: consecutiveStreak(closes),
    cmf: round(chaikinMoneyFlow(bars, settings.cmfPeriod), 3),
    high52: round(high52, 2),
    low52: round(low52, 2),
    vwapDist: round(pct(vwap(bars, 20), lastBar.close), 2),
    daysAbove20: runDaysAbove(closes, settings.emaShort),
    rv20: realizedVol(closes, 20),
    fo:
      s.nifty50 || s.cap === "large" || s.avgVolume >= 1_500_000
        ? demoStockFo(s.symbol, lastBar.close, round(pct(prev.close, lastBar.close), 2), nextThursday(asOf))
        : null,
    vcp: detected.find((d) => d.kind === "vcp")?.swing ?? null,
    breakout: detected.find((d) => d.kind === "breakout")?.swing ?? null,
  };
  if (row.fo) row.oiBuild = row.fo.oiBuild;
  const hits: PatternHit[] = [];
  for (const d of detected) {
    if (
      d.kind === "vcp" &&
      d.swing?.status === "coiling" &&
      (d.swing.tightnessPct > 58 || d.swing.volDryPct < 8)
    ) {
      continue;
    }
    hits.push({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      kind: d.kind,
      detail: d.detail,
      cmp: row.cmp,
      change1d: row.change1d,
      score: round(d.score, 0),
      swing: d.swing,
    });
  }
  const chartHits: ChartPatternHit[] = detectChartPatterns(bars, settings).map((d) => ({
    ...d,
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    cmp: row.cmp,
    change1d: row.change1d,
  }));
  return { row, hits, chartHits };
}

function tileFromBars(id: string, name: string, symbol: string, bars: OhlcBar[], settings: StrategySettings): IndexTile {
  const closes = bars.map((b) => b.close);
  const lastBar = last(bars);
  const prev = bars[bars.length - 2] ?? lastBar;
  return {
    id,
    name,
    symbol,
    cmp: round(lastBar.close, 2),
    changePct: round(pct(prev.close, lastBar.close), 2),
    open: lastBar.open,
    high: lastBar.high,
    low: lastBar.low,
    prevClose: prev.close,
    emas: emaStatuses(closes, settings),
  };
}

function pctAboveEma(seriesList: number[][], period: number): number {
  if (!seriesList.length) return 0;
  let n = 0;
  for (const closes of seriesList) {
    const e = last(ema(closes, period));
    if (last(closes) >= e) n++;
  }
  return round((n / seriesList.length) * 100, 1);
}

function weeklyCloses(bars: OhlcBar[]): number[] {
  return resample(bars, "W").map((b) => b.close);
}

function monthlyCloses(bars: OhlcBar[]): number[] {
  return resample(bars, "M").map((b) => b.close);
}

function quadrant(rs3m: number, rsMom: number): SectorTile["quadrant"] {
  if (rs3m >= 0 && rsMom >= 0) return "leading";
  if (rs3m >= 0 && rsMom < 0) return "weakening";
  if (rs3m < 0 && rsMom < 0) return "lagging";
  return "improving";
}

function streak(values: number[]): number {
  if (!values.length) return 0;
  const sign = Math.sign(values[values.length - 1] || 0);
  let n = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (Math.sign(values[i]) === sign && values[i] !== 0) n++;
    else break;
  }
  return sign * n;
}

async function tryLiveDerivatives(spot: number): Promise<{ radar?: Partial<DerivativesRadar>; source: DataSource }> {
  if (dhanConfigured()) {
    try {
      const expiries = await dhanExpiryList(13, "IDX_I");
      const expiry = expiries[0];
      if (expiry) {
        const chain = await dhanOptionChain(13, "IDX_I", expiry);
        const callOi = chain.strikes.reduce((s, x) => s + x.callOi, 0);
        const putOi = chain.strikes.reduce((s, x) => s + x.putOi, 0);
        const pain = maxPain(chain.strikes);
        const usedSpot = chain.spot || spot;
        const ladder = aroundAtm(chain.strikes, usedSpot);
        return {
          source: "dhan",
          radar: {
            niftyPcr: callOi ? round(putOi / callOi, 2) : 0,
            maxPain: pain,
            spot: usedSpot,
            maxPainDistancePct: round(pct(pain, usedSpot), 2),
            callOi,
            putOi,
            expiry,
            ladder,
          },
        };
      }
    } catch {
      // fall through
    }
  }
  try {
    const chain = await nseOptionChain("NIFTY");
    const callOi = chain.strikes.reduce((s, x) => s + x.callOi, 0);
    const putOi = chain.strikes.reduce((s, x) => s + x.putOi, 0);
    const pain = maxPain(chain.strikes);
    const usedSpot = chain.spot || spot;
    const ladder = aroundAtm(chain.strikes, usedSpot);
    return {
      source: "nse",
      radar: {
        niftyPcr: callOi ? round(putOi / callOi, 2) : 0,
        maxPain: pain,
        spot: usedSpot,
        maxPainDistancePct: round(pct(pain, usedSpot), 2),
        callOi,
        putOi,
        expiry: chain.expiry,
        ladder,
      },
    };
  } catch {
    return { source: "demo" };
  }
}

async function tryLiveFlows() {
  try {
    const flows = await nseFiiDii();
    if (flows.length) return { flows, source: "nse" as DataSource };
  } catch {
    // demo
  }
  return { flows: null as null, source: "demo" as DataSource };
}

async function tryLiveIndices(): Promise<Record<string, { last: number; percentChange?: number }>> {
  const out: Record<string, { last: number; percentChange?: number }> = {};
  if (dhanConfigured()) {
    try {
      const ids = Object.values(DHAN_INDEX_IDS).map((x) => x.id);
      const ltp = await dhanIndexLtp(ids);
      for (const [name, meta] of Object.entries(DHAN_INDEX_IDS)) {
        if (ltp[String(meta.id)]) out[name] = { last: ltp[String(meta.id)] };
      }
    } catch {
      // nse
    }
  }
  try {
    const indices = await nseAllIndices();
    for (const idx of indices) {
      out[idx.index] = { last: idx.last, percentChange: idx.percentChange };
    }
  } catch {
    // yahoo fill
  }
  if (!out["NIFTY 50"] || !out["INDIA VIX"] || !out["NIFTY 500"]) {
    try {
      const y = await yahooIndexQuotes();
      for (const [name, ltp] of Object.entries(y)) {
        if (!out[name]) out[name] = { last: ltp.last, percentChange: ltp.changePct };
      }
    } catch {
      // ignore
    }
  }
  return out;
}

export async function buildSnapshot(
  universe: UniverseId,
  partialSettings?: Partial<StrategySettings>,
  opts?: SnapshotOpts,
): Promise<DashboardSnapshot> {
  const settings = mergeSettings(partialSettings);
  const live = liveFeedsEnabled(opts);
  const key = `${CACHE_VER}:${universe}:${JSON.stringify(settings)}:${live ? dhanFingerprint() : "demo"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 45_000) return hit.value;

  const members = stocksFor(universe);
  const indexBars = demoIndexBars();
  const niftyBars = indexBars.nifty;
  const days = niftyBars.map((b) => b.date);
  const asOf = last(days);
  const niftyClose = last(niftyBars).close;

  const [liveIdx, equityLtps, derivLive, flowLive] = live
    ? await Promise.all([
        tryLiveIndices(),
        fetchEquityLtps(members),
        tryLiveDerivatives(niftyClose),
        tryLiveFlows(),
      ])
    : [
        {} as Record<string, { last: number; percentChange?: number }>,
        { bySymbol: {} as Record<string, { last: number; changePct?: number }>, source: "demo" as DataSource },
        { source: "demo" as DataSource },
        { flows: null as null, source: "demo" as DataSource },
      ];
  const quotes = equityLtps.bySymbol;

  for (const meta of INDEX_META) {
    const live = liveIdx[meta.nse] ?? liveIdx[meta.symbol];
    if (live) indexBars[meta.id] = overlayLast(indexBars[meta.id], live.last, live.percentChange);
  }

  const stockBars = new Map<string, OhlcBar[]>();
  for (const s of members) {
    stockBars.set(s.symbol, generateStockBars(s, niftyBars));
  }

  for (const s of members) {
    const px = quotes[s.symbol];
    if (px) stockBars.set(s.symbol, overlayLast(stockBars.get(s.symbol)!, px.last, px.changePct));
  }

  if (live && dhanConfigured()) {
    try {
      const from = days[Math.max(0, days.length - 260)];
      const hist = await dhanHistorical({
        securityId: "13",
        exchangeSegment: "IDX_I",
        instrument: "INDEX",
        fromDate: from,
        toDate: asOf,
      });
      if (hist.length > 40) indexBars.nifty = hist;
    } catch {
      // keep demo path
    }
  }

  const indices: IndexTile[] = INDEX_META.map((m) =>
    tileFromBars(m.id, m.name, m.symbol, indexBars[m.id], settings),
  );

  const flows = flowLive.flows?.length ? flowLive.flows : demoFlows(days);
  const demoStrikes = demoOptionStrikes(niftyClose);
  const ladder: OptionStrike[] = derivLive.radar?.ladder?.length
    ? derivLive.radar.ladder
    : aroundAtm(demoStrikes, niftyClose);
  const callOi = derivLive.radar?.callOi ?? demoStrikes.reduce((s, x) => s + x.callOi, 0);
  const putOi = derivLive.radar?.putOi ?? demoStrikes.reduce((s, x) => s + x.putOi, 0);
  const pain = derivLive.radar?.maxPain ?? maxPain(demoStrikes);
  let vixBars = generateIndexPath("vix", days, 15.8);
  if (liveIdx["INDIA VIX"]?.last) {
    vixBars = overlayLast(vixBars, liveIdx["INDIA VIX"].last, liveIdx["INDIA VIX"].percentChange);
  }
  const vix = last(vixBars).close;
  const vixPrev = vixBars[vixBars.length - 2].close;
  const ivRank = round(((vix - 11) / (28 - 11)) * 100, 0);
  const callWall = ladder.reduce((a, b) => (a.callOi >= b.callOi ? a : b), ladder[0])?.strike ?? 0;
  const putWall = ladder.reduce((a, b) => (a.putOi >= b.putOi ? a : b), ladder[0])?.strike ?? 0;
  const atm = aroundAtm(ladder, derivLive.radar?.spot ?? niftyClose, 1)[0];
  const ivSkew = atm ? round(atm.putIv - atm.callIv, 2) : 0;

  const derivatives: DerivativesRadar = {
    fiiNet: last(flows).fiiNet,
    diiNet: last(flows).diiNet,
    fiiStreak: streak(flows.map((f) => f.fiiNet)),
    diiStreak: streak(flows.map((f) => f.diiNet)),
    flows,
    indiaVix: round(vix, 2),
    indiaVixChangePct: round(pct(vixPrev, vix), 2),
    ivRank: Math.max(0, Math.min(100, ivRank)),
    ivPercentile: Math.max(0, Math.min(100, round(ivRank * 0.92, 0))),
    volatilityRegime: vix > 22 ? "crisis" : vix > 16 ? "elevated" : vix < 12.5 ? "low" : "normal",
    niftyPcr: derivLive.radar?.niftyPcr ?? round(putOi / callOi, 2),
    pcrHistory: demoPcrHistory(days),
    maxPain: pain,
    spot: derivLive.radar?.spot ?? niftyClose,
    maxPainDistancePct: derivLive.radar?.maxPainDistancePct ?? round(pct(pain, niftyClose), 2),
    callOi,
    putOi,
    expiry: derivLive.radar?.expiry ?? nextThursday(asOf),
    ladder,
    callWall,
    putWall,
    ivSkew,
  };

  const memberCloses = members.map((s) => stockBars.get(s.symbol)!.map((b) => b.close));
  const memberWeekly = members.map((s) => weeklyCloses(stockBars.get(s.symbol)!));
  const memberMonthly = members.map((s) => monthlyCloses(stockBars.get(s.symbol)!));

  const breadthGauges: BreadthCircle[] = [
    {
      period: settings.emaFast,
      label: `${settings.emaFast} EMA`,
      role: "short",
      daily: pctAboveEma(memberCloses, settings.emaFast),
      weekly: pctAboveEma(memberWeekly, settings.emaFast),
      monthly: pctAboveEma(memberMonthly, settings.emaFast),
    },
    {
      period: settings.emaShort,
      label: `${settings.emaShort} EMA`,
      role: "short",
      daily: pctAboveEma(memberCloses, settings.emaShort),
      weekly: pctAboveEma(memberWeekly, settings.emaShort),
      monthly: pctAboveEma(memberMonthly, settings.emaShort),
    },
    {
      period: settings.emaMid,
      label: `${settings.emaMid} EMA`,
      role: "medium",
      daily: pctAboveEma(memberCloses, settings.emaMid),
      weekly: pctAboveEma(memberWeekly, settings.emaMid),
      monthly: pctAboveEma(memberMonthly, settings.emaMid),
    },
    {
      period: settings.emaLong,
      label: `${settings.emaLong} EMA`,
      role: "long",
      daily: pctAboveEma(memberCloses, settings.emaLong),
      weekly: pctAboveEma(memberWeekly, settings.emaLong),
      monthly: pctAboveEma(memberMonthly, settings.emaLong),
    },
  ];

  const niftyCloses = niftyBars.map((b) => b.close);
  const sectors: SectorTile[] = SECTORS.map((sector) => {
    const bars = generateSectorBars(sector, niftyBars);
    const cons = members.filter((s) => s.sector === sector);
    const names = cons.length ? cons.map((c) => c.symbol) : UNIVERSE.filter((c) => c.sector === sector).map((c) => c.symbol);
    const lastBar = last(bars);
    const prev = bars[bars.length - 2];
    const closes = bars.map((b) => b.close);
    const rs3m = pct(valueAt(closes, 63), lastBar.close) - pct(valueAt(niftyCloses, 63), niftyClose);
    const rs1mNow = pct(valueAt(closes, 21), lastBar.close) - pct(valueAt(niftyCloses, 21), niftyClose);
    const rs1mPrev =
      pct(valueAt(closes, 42), valueAt(closes, 21)) - pct(valueAt(niftyCloses, 42), valueAt(niftyCloses, 21));
    const adv = cons.filter((c) => {
      const b = stockBars.get(c.symbol)!;
      return last(b).close >= b[b.length - 2].close;
    }).length;
    const dec = cons.length - adv;
    const turnover = cons.reduce((s, c) => {
      const b = last(stockBars.get(c.symbol)!);
      return s + b.close * b.volume;
    }, 0);
    return {
      id: sector,
      name: sector,
      cmp: round(lastBar.close, 2),
      changePct: round(pct(prev.close, lastBar.close), 2),
      weekPct: round(pct(valueAt(closes, 5), lastBar.close), 2),
      monthPct: round(pct(valueAt(closes, 21), lastBar.close), 2),
      emas: emaStatuses(closes, settings),
      advances: adv,
      declines: Math.max(0, dec),
      turnoverShare: turnover,
      cmf: round(chaikinMoneyFlow(bars, settings.cmfPeriod), 3),
      rs3m: round(rs3m, 2),
      rsMomentum: round(rs1mNow - rs1mPrev, 2),
      quadrant: quadrant(rs3m, rs1mNow - rs1mPrev),
      constituents: names,
    };
  });

  const totalTurnover = sectors.reduce((s, x) => s + x.turnoverShare, 0) || 1;
  for (const s of sectors) s.turnoverShare = round((s.turnoverShare / totalTurnover) * 100, 1);

  const heatmap: HeatCell[] = members.map((s) => {
    const bars = stockBars.get(s.symbol)!;
    const closes = bars.map((b) => b.close);
    return {
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      changePct: round(pct(bars[bars.length - 2].close, last(bars).close), 2),
      rsi: round(last(rsi(closes, settings.rsiPeriod)), 1),
    };
  });

  const stocks: StockRow[] = [];
  const patterns: PatternHit[] = [];
  const chartPatterns: ChartPatternHit[] = [];

  for (const s of members) {
    const { row, hits, chartHits } = scoreMember({
      s,
      bars: stockBars.get(s.symbol)!,
      niftyCloses,
      niftyClose,
      settings,
      asOf,
      sectorQuad: sectors.find((x) => x.name === s.sector)?.quadrant ?? "lagging",
    });
    stocks.push(row);
    patterns.push(...hits);
    chartPatterns.push(...chartHits);
  }

  patterns.sort((a, b) => b.score - a.score);
  const triggered = chartPatterns.filter((h) => h.status !== "forming");
  const forming = chartPatterns.filter((h) => h.status === "forming" && h.score >= 74 && h.volX >= 1.15);
  chartPatterns.length = 0;
  chartPatterns.push(...triggered, ...forming);
  chartPatterns.sort((a, b) => b.score - a.score);
  chartPatterns.splice(universe === "nifty500" ? 80 : 40);

  const history: BreadthPoint[] = [];
  let adLine = 0;
  const sample = stockBars.get(members[0].symbol)!;
  const look = Math.min(60, sample.length);
  for (let offset = look - 1; offset >= 0; offset--) {
    let adv = 0;
    let dec = 0;
    let e10 = 0;
    let e20 = 0;
    let e50 = 0;
    let e200 = 0;
    let rsiStr = 0;
    let piv = 0;
    for (const s of members) {
      const bars = stockBars.get(s.symbol)!;
      const i = bars.length - 1 - offset;
      if (i < 1) continue;
      const slice = bars.slice(0, i + 1);
      const closes = slice.map((b) => b.close);
      if (bars[i].close >= bars[i - 1].close) adv++;
      else dec++;
      const e = emaStatuses(closes, settings);
      if (e.find((x) => x.period === settings.emaFast)?.above) e10++;
      if (e.find((x) => x.period === settings.emaShort)?.above) e20++;
      if (e.find((x) => x.period === settings.emaMid)?.above) e50++;
      if (e.find((x) => x.period === settings.emaLong)?.above) e200++;
      if (last(rsi(closes, settings.rsiPeriod)) >= 50) rsiStr++;
      const pv = classicPivot(bars[i - 1]);
      if (bars[i].close >= pv.p) piv++;
    }
    const total = members.length || 1;
    adLine += adv - dec;
    history.push({
      date: sample[sample.length - 1 - offset].date,
      advanceDecline: adv - dec,
      adLine,
      ema10: round((e10 / total) * 100, 1),
      ema20: round((e20 / total) * 100, 1),
      ema50: round((e50 / total) * 100, 1),
      ema200: round((e200 / total) * 100, 1),
      rsiStrength: round((rsiStr / total) * 100, 1),
      pivotPosture: round((piv / total) * 100, 1),
    });
  }

  const lastB = last(history);
  const advancing = stocks.filter((s) => s.change1d > 0).length;
  const declining = stocks.filter((s) => s.change1d < 0).length;
  const unchanged = stocks.length - advancing - declining;
  const niftyTile = indices.find((t) => t.id === "nifty") ?? indices[0];
  const realized = realizedVol(niftyCloses, 20);
  const usdLive = liveIdx["USD-INR"] ?? liveIdx["USDINR"];
  const usdBars = usdLive?.last
    ? overlayLast(generateIndexPath("usdinr", days, 83.2), usdLive.last, usdLive.percentChange)
    : generateIndexPath("usdinr", days, 83.2);
  const crudeBars = generateIndexPath("crude", days, 72.4);
  const gsecBars = generateIndexPath("gsec10", days, 6.52);
  const usdNow = last(usdBars);
  const usdPrev = usdBars[usdBars.length - 2];
  const crudeNow = last(crudeBars);
  const gsecNow = last(gsecBars);

  const macro: MacroTile[] = [
    {
      id: "gap",
      name: "Nifty overnight",
      value: niftyTile.open,
      changePct: round(pct(niftyTile.prevClose, niftyTile.open), 2),
      hint: "Open vs previous close",
      unit: "pct",
    },
    {
      id: "vix",
      name: "India VIX",
      value: derivatives.indiaVix,
      changePct: derivatives.indiaVixChangePct,
      hint: `${derivatives.volatilityRegime} regime`,
      unit: "raw",
    },
    {
      id: "realized",
      name: "Nifty 20d realized",
      value: realized,
      changePct: round(derivatives.indiaVix - realized, 2),
      hint: "VIX minus realized in the change field",
      unit: "raw",
    },
    {
      id: "premium",
      name: "Vol premium",
      value: round(derivatives.indiaVix - realized, 2),
      changePct: round(((derivatives.indiaVix - realized) / Math.max(realized, 1)) * 100, 1),
      hint: "Implied minus realized",
      unit: "raw",
    },
    {
      id: "usdinr",
      name: "USD / INR",
      value: round(usdNow.close, 2),
      changePct: round(pct(usdPrev.close, usdNow.close), 2),
      hint: usdLive ? "NSE last" : "Local tape",
      unit: "raw",
    },
    {
      id: "gsec",
      name: "10Y G-Sec",
      value: round(gsecNow.close, 2),
      changePct: round(pct(gsecBars[gsecBars.length - 2].close, gsecNow.close), 2),
      hint: "Yield, local tape",
      unit: "raw",
    },
    {
      id: "crude",
      name: "Brent proxy",
      value: round(crudeNow.close, 2),
      changePct: round(pct(crudeBars[crudeBars.length - 2].close, crudeNow.close), 2),
      hint: "Risk-on commodity tape",
      unit: "raw",
    },
  ];

  const alerts = buildAlerts({
    derivatives,
    stocks,
    patterns,
    ema200: lastB?.ema200 ?? 0,
  });

  const snapshot: DashboardSnapshot = {
    asOf,
    generatedAt: new Date().toISOString(),
    universe,
    sources: {
      quotes: equityLtps.source !== "demo" ? equityLtps.source : liveIdx["NIFTY 50"] ? "nse" : "demo",
      derivatives: derivLive.source,
      flows: flowLive.source,
    },
    dhanConfigured: dhanConfigured(),
    indices,
    derivatives,
    macro,
    alerts,
    breadthGauges,
    sectors,
    heatmap,
    stocks,
    patterns,
    chartPatterns,
    breadth: {
      advancing,
      declining,
      unchanged,
      adRatio: round(advancing / Math.max(declining, 1), 2),
      ema10: lastB?.ema10 ?? 0,
      ema20: lastB?.ema20 ?? 0,
      ema50: lastB?.ema50 ?? 0,
      ema200: lastB?.ema200 ?? 0,
      rsiStrength: lastB?.rsiStrength ?? 0,
      pivotPosture: lastB?.pivotPosture ?? 0,
      history,
    },
    trend: {
      emaStackBullish: stocks.filter((s) =>
        settings.momentumTimeframe === "W" ? s.weeklyStack === "bullish" : s.emaStack === "bullish",
      ).length,
      emaStackBearish: stocks.filter((s) => s.emaStack === "bearish").length,
      converging: stocks.filter((s) => {
        const spread = Math.abs(s.emas[0].value - s.emas[s.emas.length - 1].value);
        return Math.abs(s.emas[0].value - s.emas[1].value) < spread * 0.35;
      }).length,
      bullishCrosses: stocks.filter((s) => s.bullishCross).length,
      rsiAboveMa: stocks.filter((s) => s.rsiAboveMa).length,
      weeklyStackBullish: stocks.filter((s) => s.weeklyStack === "bullish").length,
    },
    settings,
  };

  cache.set(key, { at: Date.now(), value: snapshot });
  return snapshot;
}

export async function buildStockDetail(
  symbol: string,
  universe: UniverseId,
  partialSettings?: Partial<StrategySettings>,
) {
  const settings = mergeSettings(partialSettings);
  const upper = symbol.toUpperCase();
  const s = stocksFor(universe).find((row) => row.symbol === upper) ?? UNIVERSE.find((row) => row.symbol === upper);
  if (!s) return null;
  const indexBars = demoIndexBars();
  const niftyBars = indexBars.nifty;
  const niftyCloses = niftyBars.map((b) => b.close);
  const niftyClose = last(niftyBars).close;
  const asOf = last(niftyBars).date;
  let bars = generateStockBars(s, niftyBars);
  const { bySymbol } = await fetchEquityLtps([s]);
  const px = bySymbol[s.symbol];
  if (px) bars = overlayLast(bars, px.last, px.changePct);
  const sectorBars = generateSectorBars(s.sector, niftyBars);
  const sectorCloses = sectorBars.map((b) => b.close);
  const rs3m = pct(valueAt(sectorCloses, 63), last(sectorBars).close) - pct(valueAt(niftyCloses, 63), niftyClose);
  const rs1mNow =
    pct(valueAt(sectorCloses, 21), last(sectorBars).close) - pct(valueAt(niftyCloses, 21), niftyClose);
  const rs1mPrev =
    pct(valueAt(sectorCloses, 42), valueAt(sectorCloses, 21)) -
    pct(valueAt(niftyCloses, 42), valueAt(niftyCloses, 21));
  const { row } = scoreMember({
    s,
    bars,
    niftyCloses,
    niftyClose,
    settings,
    asOf,
    sectorQuad: quadrant(rs3m, rs1mNow - rs1mPrev),
  });
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

function buildAlerts(input: {
  derivatives: DerivativesRadar;
  stocks: StockRow[];
  patterns: PatternHit[];
  ema200: number;
}): DeskAlert[] {
  const alerts: DeskAlert[] = [];
  if (input.derivatives.fiiStreak <= -3) {
    alerts.push({
      id: "fii-sell",
      tone: "warn",
      title: `FII ${Math.abs(input.derivatives.fiiStreak)}-day sell streak`,
      detail: `Net ${input.derivatives.fiiNet.toFixed(0)} cr. DII is ${input.derivatives.diiNet >= 0 ? "absorbing" : "also selling"}.`,
    });
  } else if (input.derivatives.fiiStreak >= 3) {
    alerts.push({
      id: "fii-buy",
      tone: "info",
      title: `FII ${input.derivatives.fiiStreak}-day buy streak`,
      detail: `Net ${input.derivatives.fiiNet.toFixed(0)} cr into cash.`,
    });
  }
  if (input.derivatives.volatilityRegime === "elevated" || input.derivatives.volatilityRegime === "crisis") {
    alerts.push({
      id: "vix",
      tone: "warn",
      title: `India VIX ${input.derivatives.volatilityRegime}`,
      detail: `VIX ${input.derivatives.indiaVix.toFixed(1)}. Size positions down until vol mean-reverts.`,
    });
  }
  if (input.derivatives.niftyPcr >= 1.2) {
    alerts.push({
      id: "pcr-put",
      tone: "info",
      title: `Put-heavy PCR ${input.derivatives.niftyPcr.toFixed(2)}`,
      detail: `Call wall ${input.derivatives.callWall}, put wall ${input.derivatives.putWall}.`,
    });
  } else if (input.derivatives.niftyPcr > 0 && input.derivatives.niftyPcr <= 0.75) {
    alerts.push({
      id: "pcr-call",
      tone: "warn",
      title: `Call-heavy PCR ${input.derivatives.niftyPcr.toFixed(2)}`,
      detail: "Option traders are long calls / short puts. Fade late-day squeezes.",
    });
  }
  if (input.ema200 < 40) {
    alerts.push({
      id: "ema200",
      tone: "warn",
      title: `Only ${input.ema200.toFixed(0)}% of the universe is above the 200 EMA`,
      detail: "Long-term participation is weak. Prefer relative-strength names.",
    });
  }
  const oversold = input.stocks.filter((s) => s.rsi < 32 && s.distFrom20Ema > -4 && s.emaStack !== "bearish").slice(0, 3);
  for (const s of oversold) {
    alerts.push({
      id: `os-${s.symbol}`,
      tone: "setup",
      title: `${s.symbol} oversold near 20 EMA`,
      detail: `RSI ${s.rsi.toFixed(1)}, ${s.distFrom20Ema}% vs 20 EMA, delivery ${s.deliveryPct}%.`,
      symbol: s.symbol,
    });
  }
  const spikes = input.stocks.filter((s) => s.volSpike >= 2 && s.change1d > 0).slice(0, 3);
  for (const s of spikes) {
    alerts.push({
      id: `vol-${s.symbol}`,
      tone: "setup",
      title: `${s.symbol} volume surge on an up day`,
      detail: `${s.volSpike.toFixed(1)}x 9-day volume, ${s.oiBuild.replace("-", " ")}.`,
      symbol: s.symbol,
    });
  }
  const foHot = input.stocks
    .filter((s) => s.fo && (s.fo.pcr >= 1.45 || s.fo.pcr <= 0.7))
    .slice(0, 2);
  for (const s of foHot) {
    const fo = s.fo!;
    alerts.push({
      id: `fo-${s.symbol}`,
      tone: fo.pcr >= 1.45 ? "info" : "warn",
      title: `${s.symbol} ${fo.pcr >= 1.45 ? "put-heavy" : "call-heavy"} PCR ${fo.pcr.toFixed(2)}`,
      detail: `ATM IV ${fo.atmIv}% · ${fo.oiBuild.replace("-", " ")} · expected move ${fo.expectedMovePct}% to ${fo.expiry}.`,
      symbol: s.symbol,
    });
  }
  const breakouts = input.patterns.filter((p) => p.kind === "breakout").slice(0, 2);
  for (const p of breakouts) {
    alerts.push({
      id: `bo-${p.symbol}`,
      tone: "setup",
      title: `${p.symbol} ${p.swing?.status === "at_pivot" ? "at breakout pivot" : p.swing?.status === "throwback" ? "breakout throwback" : "qualified base breakout"}`,
      detail: p.swing?.nextAction ?? p.swing?.summary ?? p.detail,
      symbol: p.symbol,
    });
  }
  const vcps = input.patterns
    .filter(
      (p) =>
        p.kind === "vcp" &&
        (p.swing?.status === "at_pivot" || p.swing?.status === "coiling" || p.swing?.status === "throwback"),
    )
    .slice(0, 2);
  for (const p of vcps) {
    alerts.push({
      id: `vcp-${p.symbol}`,
      tone: "setup",
      title: `${p.symbol} VCP ${(p.swing?.status ?? "setup").replaceAll("_", " ")}`,
      detail: p.swing?.nextAction ?? p.swing?.summary ?? p.detail,
      symbol: p.symbol,
    });
  }
  return alerts.slice(0, 10);
}
