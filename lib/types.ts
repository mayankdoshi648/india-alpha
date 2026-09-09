export type CapBucket = "large" | "mid" | "small";
export type UniverseId = "nifty50" | "nifty500";
export type Timeframe = "D" | "W" | "M";
export type DataSource = "dhan" | "nse" | "yahoo" | "demo";
export type RotationQuadrant = "leading" | "weakening" | "lagging" | "improving";
export type PatternKind =
  | "stage2"
  | "breakout"
  | "volume_surge"
  | "vcp"
  | "bullish_div"
  | "bearish_div"
  | "hidden_bullish_div"
  | "hidden_bearish_div"
  | "pivot_reclaim"
  | "oversold_pullback";

export type ChartPatternKind =
  | "ascending_triangle"
  | "descending_triangle"
  | "symmetrical_triangle"
  | "bullish_flag"
  | "bearish_flag"
  | "rising_wedge"
  | "falling_wedge"
  | "head_shoulders"
  | "inv_head_shoulders"
  | "double_top"
  | "double_bottom"
  | "triple_top"
  | "triple_bottom";

export type ChartPatternRole = "continuation" | "reversal";
export type ChartPatternBias = "bullish" | "bearish";
export type ChartPatternStatus = "forming" | "breakout" | "breakdown";

export type SwingStatus = "coiling" | "at_pivot" | "triggered" | "throwback" | "extended" | "failed";

export interface VcpLeg {
  depthPct: number;
  bars: number;
  high: number;
  low: number;
  volDryPct?: number;
}

export interface SwingCheck {
  label: string;
  ok: boolean;
}

export interface SwingSetup {
  kind: "vcp" | "breakout";
  status: SwingStatus;
  score: number;
  pivot: number;
  entry: number;
  stop: number;
  target: number;
  target1R: number;
  target2R: number;
  riskPct: number;
  rewardPct: number;
  rr: number;
  distToPivotPct: number;
  extFrom10Pct: number;
  baseDays: number;
  baseDepthPct: number;
  tightnessPct: number;
  volDryPct: number;
  handleDepthPct: number;
  breakoutVolX: number;
  closeInRangePct: number;
  contractions: VcpLeg[];
  checklist: SwingCheck[];
  nextAction: string;
  notes: string[];
  summary: string;
}

export interface UniverseStock {
  symbol: string;
  name: string;
  sector: string;
  cap: CapBucket;
  nifty50: boolean;
  nifty500: boolean;
  securityId: number;
  basePrice: number;
  avgVolume: number;
}

export interface DhanCredentials {
  accessToken: string;
  clientId: string;
}

export interface StrategySettings {
  emaFast: number;
  emaShort: number;
  emaMid: number;
  emaLong: number;
  rsiPeriod: number;
  rsiMaPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  volumeSpikeMult: number;
  volumeAvgDays: number;
  breakoutVolumeMult: number;
  breakoutRetracePct: number;
  stage2NearHighPct: number;
  stage2AboveLowPct: number;
  cmfPeriod: number;
  momentumTimeframe: "D" | "W" | "both";
}

export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EmaStatus {
  period: number;
  value: number;
  above: boolean;
  distPct: number;
}

export interface IndexTile {
  id: string;
  name: string;
  symbol: string;
  cmp: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  asOf: string;
  spark: number[];
  emas: EmaStatus[];
}

export interface FlowDay {
  date: string;
  fiiNet: number;
  diiNet: number;
  fiiBuy: number;
  fiiSell: number;
  diiBuy: number;
  diiSell: number;
}

export interface DerivativesRadar {
  fiiNet: number;
  diiNet: number;
  fiiStreak: number;
  diiStreak: number;
  flows: FlowDay[];
  indiaVix: number;
  indiaVixChangePct: number;
  ivRank: number;
  ivPercentile: number;
  volatilityRegime: "low" | "normal" | "elevated" | "crisis";
  niftyPcr: number;
  pcrHistory: { date: string; pcr: number }[];
  maxPain: number;
  spot: number;
  maxPainDistancePct: number;
  callOi: number;
  putOi: number;
  expiry: string;
  ladder: OptionStrike[];
  callWall: number;
  putWall: number;
  ivSkew: number;
}

export interface BreadthCircle {
  period: number;
  label: string;
  role: "short" | "medium" | "long";
  daily: number;
  weekly: number;
  monthly: number;
}

export interface SectorTile {
  id: string;
  name: string;
  cmp: number;
  changePct: number;
  weekPct: number;
  monthPct: number;
  emas: EmaStatus[];
  advances: number;
  declines: number;
  turnoverShare: number;
  cmf: number;
  rs3m: number;
  rsMomentum: number;
  quadrant: RotationQuadrant;
  constituents: string[];
}

export interface HeatCell {
  symbol: string;
  name: string;
  sector: string;
  changePct: number;
  rsi: number;
}

export type OiBuild = "long-build" | "short-cover" | "short-build" | "long-unwind" | "neutral";

export interface ChartPoint {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface StockRow {
  symbol: string;
  name: string;
  cap: CapBucket;
  sector: string;
  nifty50: boolean;
  cmp: number;
  change1d: number;
  change1w: number;
  change1m: number;
  rsi: number;
  spark: number[];
  volume: number;
  volSpike: number;
  gapPct: number;
  emas: EmaStatus[];
  emaStack: "bullish" | "bearish" | "mixed";
  distFrom20Ema: number;
  below52wHigh: number;
  above52wLow: number;
  prevEarningDate: string | null;
  earningsImpactPct: number | null;
  nextEarningDate: string | null;
  patterns: PatternKind[];
  stage2Score: number;
  abovePivot: boolean;
  rsiAboveMa: boolean;
  bullishCross: boolean;
  weeklyStack: "bullish" | "bearish" | "mixed";
  deliveryPct: number;
  oiBuild: OiBuild;
  rsNifty: number;
  chart: ChartPoint[];
  atrPct: number;
  turnover: number;
  distFrom50: number;
  distFrom200: number;
  pos52w: number;
  daysToEarnings: number | null;
  sectorQuad: RotationQuadrant;
  change3m: number;
  dayHigh: number;
  dayLow: number;
  rangePos: number;
  avgVolume: number;
  beta: number;
  streak: number;
  cmf: number;
  high52: number;
  low52: number;
  vwapDist: number;
  daysAbove20: number;
  rv20: number;
  fo: StockFo | null;
  vcp: SwingSetup | null;
  breakout: SwingSetup | null;
}

export interface OptionStrike {
  strike: number;
  callOi: number;
  putOi: number;
  callIv: number;
  putIv: number;
  callLtp?: number;
  putLtp?: number;
  callOiChg?: number;
  putOiChg?: number;
}

export interface StockFo {
  listed: boolean;
  symbol: string;
  source: DataSource;
  expiry: string;
  pcr: number;
  maxPain: number;
  callWall: number;
  putWall: number;
  atmIv: number;
  ivSkew: number;
  straddle: number;
  expectedMovePct: number;
  futPremiumPct: number;
  callOi: number;
  putOi: number;
  oiBuild: OiBuild;
  ladder: OptionStrike[];
}

export interface MacroTile {
  id: string;
  name: string;
  value: number;
  changePct: number;
  hint: string;
  unit?: "inr" | "pct" | "raw";
}

export interface DeskAlert {
  id: string;
  tone: "info" | "warn" | "setup";
  title: string;
  detail: string;
  symbol?: string;
}

export interface PatternHit {
  symbol: string;
  name: string;
  sector: string;
  kind: PatternKind;
  detail: string;
  cmp: number;
  change1d: number;
  score: number;
  swing?: SwingSetup;
}

export interface ChartPatternHit {
  symbol: string;
  name: string;
  sector: string;
  cmp: number;
  change1d: number;
  kind: ChartPatternKind;
  bias: ChartPatternBias;
  role: ChartPatternRole;
  timeframe: Timeframe;
  status: ChartPatternStatus;
  score: number;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  volX: number;
  rsi: number;
  divergence: "bullish" | "bearish" | "hidden_bullish" | "hidden_bearish" | null;
  rationale: string;
  summary: string;
}

export interface BreadthPoint {
  date: string;
  advanceDecline: number;
  adLine: number;
  ema10: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsiStrength: number;
  pivotPosture: number;
}

export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  adRatio: number;
  ema10: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsiStrength: number;
  pivotPosture: number;
  history: BreadthPoint[];
}

export interface TrendFilters {
  emaStackBullish: number;
  emaStackBearish: number;
  converging: number;
  bullishCrosses: number;
  rsiAboveMa: number;
  weeklyStackBullish: number;
}

export interface DashboardSnapshot {
  asOf: string;
  generatedAt: string;
  universe: UniverseId;
  sources: {
    quotes: DataSource;
    derivatives: DataSource;
    flows: DataSource;
  };
  dhanConfigured: boolean;
  indices: IndexTile[];
  derivatives: DerivativesRadar;
  macro: MacroTile[];
  alerts: DeskAlert[];
  breadthGauges: BreadthCircle[];
  sectors: SectorTile[];
  heatmap: HeatCell[];
  stocks: StockRow[];
  patterns: PatternHit[];
  chartPatterns: ChartPatternHit[];
  breadth: MarketBreadth;
  trend: TrendFilters;
  settings: StrategySettings;
}
