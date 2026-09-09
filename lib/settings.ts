import type { StrategySettings } from "@/lib/types";

export const DEFAULT_SETTINGS: StrategySettings = {
  emaFast: 10,
  emaShort: 20,
  emaMid: 50,
  emaLong: 200,
  rsiPeriod: 14,
  rsiMaPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  volumeSpikeMult: 1.5,
  volumeAvgDays: 9,
  breakoutVolumeMult: 1.5,
  breakoutRetracePct: 50,
  stage2NearHighPct: 25,
  stage2AboveLowPct: 25,
  cmfPeriod: 20,
  momentumTimeframe: "D",
};

export const STRATEGY_TEMPLATES: {
  id: string;
  name: string;
  note: string;
  settings: StrategySettings;
}[] = [
  {
    id: "swing",
    name: "Swing default",
    note: "10/20/50/200 stack, 1.5x volume spike, 50% retrace cap.",
    settings: DEFAULT_SETTINGS,
  },
  {
    id: "positional",
    name: "Positional / Stage 2",
    note: "Tighter near-high filter and higher breakout volume.",
    settings: {
      ...DEFAULT_SETTINGS,
      volumeSpikeMult: 1.8,
      breakoutVolumeMult: 2,
      stage2NearHighPct: 15,
      momentumTimeframe: "both",
    },
  },
  {
    id: "mean-reversion",
    name: "Oversold pullback",
    note: "RSI 35 trigger, slower volume spike, weekly confirmation off.",
    settings: {
      ...DEFAULT_SETTINGS,
      rsiOversold: 35,
      volumeSpikeMult: 1.2,
      momentumTimeframe: "D",
    },
  },
];

export function mergeSettings(partial?: Partial<StrategySettings>): StrategySettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

export function isDefaultSettings(partial?: Partial<StrategySettings>): boolean {
  return JSON.stringify(mergeSettings(partial)) === JSON.stringify(DEFAULT_SETTINGS);
}
