import type { OhlcBar } from "@/lib/types";

export type OverlaySession = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
};

function clampCandle(bar: OhlcBar) {
  bar.high = Number(Math.max(bar.high, bar.open, bar.close).toFixed(2));
  bar.low = Number(Math.min(bar.low, bar.open, bar.close).toFixed(2));
}

function applyLiveOhlc(bar: OhlcBar, close: number, session?: OverlaySession) {
  bar.close = Number(close.toFixed(2));
  if (typeof session?.open === "number" && session.open > 0) {
    bar.open = Number(session.open.toFixed(2));
  }
  if (typeof session?.high === "number" && session.high > 0) {
    bar.high = Number(session.high.toFixed(2));
  }
  if (typeof session?.low === "number" && session.low > 0) {
    bar.low = Number(session.low.toFixed(2));
  }
  clampCandle(bar);
}

/**
 * Paint the live last onto the session date.
 * If history still ends on a prior day, append a new bar so yesterday's close stays put.
 */
export function overlayLast(
  bars: OhlcBar[],
  close: number,
  changePct?: number,
  session?: OverlaySession,
): OhlcBar[] {
  if (!bars.length || !(close > 0)) return bars;
  const copy = bars.map((b) => ({ ...b }));
  const lastBar = copy[copy.length - 1];
  const sessionDate = session?.date;

  if (sessionDate && sessionDate > lastBar.date) {
    if (typeof session?.previousClose === "number" && session.previousClose > 0) {
      lastBar.close = Number(session.previousClose.toFixed(2));
      clampCandle(lastBar);
    }
    const open = typeof session?.open === "number" && session.open > 0 ? session.open : close;
    const high = typeof session?.high === "number" && session.high > 0 ? session.high : Math.max(open, close);
    const low = typeof session?.low === "number" && session.low > 0 ? session.low : Math.min(open, close);
    copy.push({
      date: sessionDate,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: lastBar.volume,
    });
    clampCandle(copy[copy.length - 1]);
    return copy;
  }

  if (typeof session?.previousClose === "number" && session.previousClose > 0 && copy.length >= 2) {
    copy[copy.length - 2].close = Number(session.previousClose.toFixed(2));
    clampCandle(copy[copy.length - 2]);
  } else if (typeof changePct === "number" && Number.isFinite(changePct) && copy.length >= 2) {
    copy[copy.length - 2].close = Number((close / (1 + changePct / 100)).toFixed(2));
    clampCandle(copy[copy.length - 2]);
  }
  applyLiveOhlc(lastBar, close, session);
  return copy;
}
