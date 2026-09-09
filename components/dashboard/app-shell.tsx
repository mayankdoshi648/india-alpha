"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChartPoint, DashboardSnapshot, DhanCredentials, StockFo, StrategySettings, SwingSetup, UniverseId } from "@/lib/types";
import { DEFAULT_SETTINGS, STRATEGY_TEMPLATES } from "@/lib/settings";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { SessionBar } from "@/components/dashboard/session-bar";
import { StockChart } from "@/components/dashboard/stock-chart";
import { StockFoPanel } from "@/components/dashboard/stock-fo";
import { SwingPanel } from "@/components/dashboard/swing-setup";
import { DeskBoard } from "@/components/dashboard/board";
import { DeskErrorBoundary } from "@/components/dashboard/error-boundary";
import { Panel, Drawer } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { PATTERN_LABEL, inr } from "@/lib/format";
import { Chg, EmaPills } from "@/components/dashboard/primitives";
import { indiaSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  KeyRound,
  Landmark,
  LoaderCircle,
  RefreshCw,
  Settings2,
  WifiOff,
} from "lucide-react";

const LISTS = [
  { id: "core", name: "Core" },
  { id: "breakouts", name: "Breakouts" },
  { id: "research", name: "Research" },
] as const;

type WatchStore = {
  active: (typeof LISTS)[number]["id"];
  lists: Record<(typeof LISTS)[number]["id"], string[]>;
  notes: Record<string, string>;
};

const EMPTY_WATCH: WatchStore = {
  active: "core",
  lists: { core: [], breakouts: [], research: [] },
  notes: {},
};

const EMPTY_DHAN: DhanCredentials = { accessToken: "", clientId: "" };

export function MarketDesk() {
  const [universe, setUniverse] = useState<UniverseId>("nifty50");
  const [settings, setSettings] = useState<StrategySettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [watch, setWatch] = useState<WatchStore>(EMPTY_WATCH);
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [liveFo, setLiveFo] = useState<StockFo | null>(null);
  const [liveSwing, setLiveSwing] = useState<{ vcp: SwingSetup | null; breakout: SwingSetup | null }>({
    vcp: null,
    breakout: null,
  });
  const [dhan, setDhan] = useState<DhanCredentials>(EMPTY_DHAN);
  const [dhanBusy, setDhanBusy] = useState(false);
  const [dhanStatus, setDhanStatus] = useState<string | null>(null);
  const [dhanError, setDhanError] = useState<string | null>(null);

  const persistWatch = (next: WatchStore) => {
    setWatch(next);
    localStorage.setItem("imd-watch", JSON.stringify(next));
  };

  const loadTape = useCallback(async (
    u = universe,
    s = settings,
    creds = dhan,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market?universe=${u}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universe: u,
          settings: s,
          dhan: creds.accessToken ? creds : undefined,
        }),
        signal: AbortSignal.timeout(40_000),
      });
      const json = (await res.json()) as DashboardSnapshot & { error?: string };
      if (!res.ok) throw new Error(json.error || `Market API ${res.status}`);
      setData(json);
      setUniverse(json.universe ?? u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the desk");
    } finally {
      setLoading(false);
    }
  }, [universe, settings, dhan]);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate private lists from localStorage after paint */
  useEffect(() => {
    let nextSettings = DEFAULT_SETTINGS;
    let creds = EMPTY_DHAN;
    try {
      const raw = localStorage.getItem("imd-watch");
      if (raw) setWatch({ ...EMPTY_WATCH, ...JSON.parse(raw) });
      const s = localStorage.getItem("imd-settings");
      if (s) {
        nextSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
        setSettings(nextSettings);
      }
      const d = localStorage.getItem("imd-dhan");
      if (d) {
        const parsed = JSON.parse(d) as DhanCredentials;
        if (parsed.accessToken) {
          creds = parsed;
          setDhan(parsed);
        }
      }
    } catch {
      // ignore corrupt localStorage
    }
    void loadTape("nifty50", nextSettings, creds);
    // First hydrate only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!openSymbol) {
      setChart([]);
      setLiveFo(null);
      setLiveSwing({ vcp: null, breakout: null });
      return;
    }
    const existing = data?.stocks.find((s) => s.symbol === openSymbol);
    if (existing?.chart?.length) setChart(existing.chart);
    setLiveFo(existing?.fo ?? null);
    setLiveSwing({ vcp: existing?.vcp ?? null, breakout: existing?.breakout ?? null });
    let cancelled = false;
    void fetch(`/api/stock?symbol=${encodeURIComponent(openSymbol)}&universe=${universe}`, {
      signal: AbortSignal.timeout(15_000),
      headers: dhan.accessToken
        ? { "x-dhan-access-token": dhan.accessToken, "x-dhan-client-id": dhan.clientId }
        : undefined,
    })
      .then((r) => r.json())
      .then((json: { chart?: ChartPoint[]; fo?: StockFo | null; vcp?: SwingSetup | null; breakout?: SwingSetup | null }) => {
        if (cancelled) return;
        if (json.chart?.length) setChart(json.chart);
        if (json.fo) setLiveFo(json.fo);
        if (json.vcp !== undefined || json.breakout !== undefined) {
          setLiveSwing({ vcp: json.vcp ?? existing?.vcp ?? null, breakout: json.breakout ?? existing?.breakout ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) setChart(existing?.chart ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [openSymbol, universe, data, dhan.accessToken, dhan.clientId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      if (!indiaSession().open) return;
      void loadTape();
    }, 60_000);
    return () => clearInterval(id);
  }, [loadTape]);

  const load = loadTape;

  const watchSet = useMemo(
    () => new Set(Object.values(watch.lists).flat()),
    [watch],
  );

  const dhanLive = data?.sources.quotes === "dhan" || data?.sources.derivatives === "dhan";
  const row = data?.stocks.find((s) => s.symbol === openSymbol) ?? null;
  const fo = liveFo ?? row?.fo ?? null;

  function toggleWatch(symbol: string) {
    persistWatch((() => {
      const list = new Set(watch.lists[watch.active]);
      if (list.has(symbol)) list.delete(symbol);
      else list.add(symbol);
      return { ...watch, lists: { ...watch.lists, [watch.active]: [...list] } };
    })());
  }

  function applyTemplate(id: string) {
    const t = STRATEGY_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setSettings(t.settings);
    localStorage.setItem("imd-settings", JSON.stringify(t.settings));
    void load(universe, t.settings);
  }

  function saveSettings(next: StrategySettings) {
    setSettings(next);
    localStorage.setItem("imd-settings", JSON.stringify(next));
  }

  async function connectDhan(creds: DhanCredentials) {
    setDhanBusy(true);
    setDhanError(null);
    setDhanStatus(null);
    try {
      const res = await fetch("/api/dhan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        nifty?: number | null;
        clientId?: string;
        tokenValidity?: string | null;
        dataPlan?: string | null;
        name?: string | null;
      };
      if (!json.ok) {
        setDhanError(json.error || "Dhan rejected these credentials.");
        return;
      }
      const saved: DhanCredentials = {
        accessToken: creds.accessToken.trim(),
        clientId: json.clientId || creds.clientId.trim(),
      };
      setDhan(saved);
      localStorage.setItem("imd-dhan", JSON.stringify(saved));
      const bits = [
        json.name ? `Signed in as ${json.name}` : "Dhan accepted this token",
        typeof json.nifty === "number" ? `Nifty LTP ${json.nifty.toFixed(2)}` : null,
        json.tokenValidity ? `token until ${json.tokenValidity}` : null,
        json.dataPlan ? `data plan ${json.dataPlan}` : null,
      ].filter(Boolean);
      setDhanStatus(bits.join(" · "));
      await loadTape(universe, settings, saved);
    } catch (e) {
      setDhanError(
        e instanceof Error
          ? e.message
          : "Could not reach Dhan. Check the token and try again.",
      );
    } finally {
      setDhanBusy(false);
    }
  }

  function disconnectDhan() {
    setDhan(EMPTY_DHAN);
    localStorage.removeItem("imd-dhan");
    setDhanStatus("Disconnected. Using NSE or the local tape.");
    setDhanError(null);
    void loadTape(universe, settings, EMPTY_DHAN);
  }

  return (
    <div className="flex h-full min-h-dvh flex-col overflow-hidden bg-[#0b1220] text-slate-100">
      <header className="shrink-0 border-b border-white/10 bg-[#0b1220]">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300">
              <Landmark className="size-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-tight text-white">India Market Desk</p>
              {data ? (
                <SessionBar data={data} token={dhan.accessToken} />
              ) : (
                <p className="text-[12px] text-slate-500">Loading tape…</p>
              )}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <div className="flex overflow-hidden rounded-md border border-white/10">
                <button
                  type="button"
                  id="universe-nifty50"
                  disabled={loading}
                  onClick={() => {
                    setUniverse("nifty50");
                    void load("nifty50", settings);
                  }}
                  className={`h-7 px-2.5 text-[12px] ${universe === "nifty50" ? "bg-cyan-400/20 text-cyan-100" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  N50
                </button>
                <button
                  type="button"
                  id="universe-nifty500"
                  disabled={loading}
                  onClick={() => {
                    setUniverse("nifty500");
                    void load("nifty500", settings);
                  }}
                  className={`h-7 px-2.5 text-[12px] ${universe === "nifty500" ? "bg-cyan-400/20 text-cyan-100" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  N500
                </button>
              </div>
              <select
                value={watch.active}
                onChange={(e) =>
                  persistWatch({ ...watch, active: e.target.value as WatchStore["active"] })
                }
                className="h-7 rounded-md border border-white/10 bg-[#0e1728] px-2 text-[12px]"
              >
                {LISTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({watch.lists[l.id].length})
                  </option>
                ))}
              </select>
              <button
                type="button"
                id="dhan-keys-link"
                onClick={() => setSettingsOpen(true)}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[13px]",
                  dhanLive
                    ? "border-emerald-400/40 text-emerald-200"
                    : "border-sky-400/40 text-sky-200 hover:bg-sky-400/10",
                )}
              >
                <KeyRound className="size-3.5" />
                {dhanLive ? "Dhan live" : "Connect"}
              </button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => void load()} disabled={loading}>
                {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                Refresh
              </Button>
              <button
                type="button"
                id="configure-desk"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-400 px-3 text-[13px] font-medium text-slate-950 hover:bg-sky-300"
              >
                <Settings2 className="size-3.5" />
                Configure
              </button>
            </div>
          </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto px-3 py-2.5 xl:overflow-hidden">
        {error ? (
          <Panel className="flex flex-wrap items-center gap-3 text-rose-300">
            <WifiOff className="size-4" />
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </Panel>
        ) : null}
        {loading && !data ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-[#121b2c] text-sm text-slate-300">
            Building the tape… first load can take a few seconds.
          </div>
        ) : null}
        {loading && data ? (
          <div className="rounded-md border border-cyan-400/30 bg-cyan-950/80 px-3 py-1.5 text-sm text-cyan-100">
            Recalculating {universe === "nifty50" ? "Nifty 50" : "Nifty 500"}…
          </div>
        ) : null}

        {data ? (
          <DeskErrorBoundary>
            <DeskBoard
              data={data}
              watch={watchSet}
              onToggleWatch={toggleWatch}
              onOpen={setOpenSymbol}
            />
          </DeskErrorBoundary>
        ) : !loading && error ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            The tape did not load. Retry from the banner above.
          </div>
        ) : null}
      </main>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) void load(universe, settings);
        }}
        settings={settings}
        onChange={saveSettings}
        onApplyTemplate={applyTemplate}
        dhan={dhan}
        dhanConnected={dhanLive}
        dhanBusy={dhanBusy}
        dhanStatus={dhanStatus}
        dhanError={dhanError}
        onConnectDhan={connectDhan}
        onDisconnectDhan={disconnectDhan}
      />

      <Drawer open={Boolean(row)} onClose={() => setOpenSymbol(null)} widthClass="max-w-xl">
        {row ? (
          <>
            <div className="p-4 pr-12">
              <h2 className="text-lg font-medium">
                {row.symbol}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{row.name}</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                {row.sector} · {row.cap} cap · Stage 2 {row.stage2Score}/7
                {fo?.listed ? " · F&O listed" : ""}
              </p>
            </div>
            <div className="space-y-4 px-4 pb-8">
              <div className="flex items-end justify-between">
                <p className="font-mono text-3xl tabular-nums">{inr(row.cmp)}</p>
                <Chg value={row.change1d} />
              </div>
              <div id="swing-panel">
                <SwingPanel vcp={liveSwing.vcp ?? row.vcp} breakout={liveSwing.breakout ?? row.breakout} />
              </div>
              <StockChart points={chart.length ? chart : row.chart ?? []} emas={row.emas} />
              {fo ? <StockFoPanel fo={fo} /> : null}
              <EmaPills emas={row.emas} />
              <div className="flex flex-wrap gap-1">
                {row.patterns.map((p) => (
                  <span key={p} className="rounded border border-white/10 px-2 py-0.5 text-[11px]">
                    {PATTERN_LABEL[p]}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Meta k="RSI(14)" v={row.rsi.toFixed(1)} />
                <Meta k="Vol spike" v={`${row.volSpike}x`} />
                <Meta k="% vs 20 EMA" v={`${row.distFrom20Ema}%`} />
                <Meta k="% vs 50 EMA" v={`${row.distFrom50}%`} />
                <Meta k="% vs 200 EMA" v={`${row.distFrom200}%`} />
                <Meta k="RS vs Nifty 1M" v={`${row.rsNifty}%`} />
                <Meta k="Delivery" v={`${row.deliveryPct}%`} />
                <Meta k="OI build" v={row.oiBuild.replace("-", " ")} />
                <Meta k="ATR %" v={row.atrPct.toFixed(2)} />
                <Meta k="52W pos" v={`${row.pos52w}`} />
                <Meta k="Stage 2" v={`${row.stage2Score}/7`} />
                <Meta k="EMA stack" v={row.emaStack} />
                <Meta k="3M %" v={`${row.change3m}%`} />
                <Meta k="Beta vs Nifty" v={row.beta.toFixed(2)} />
                <Meta k="Streak" v={`${row.streak > 0 ? "+" : ""}${row.streak}d`} />
                <Meta k="CMF" v={row.cmf.toFixed(3)} />
                <Meta k="vs 20d VWAP" v={`${row.vwapDist}%`} />
                <Meta k="Day range" v={`${row.rangePos}% of H–L`} />
                <Meta k="RV 20d" v={`${row.rv20}%`} />
                <Meta k="Days above 20" v={`${row.daysAbove20}`} />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Research note (private, this browser)</p>
                <textarea
                  value={watch.notes[row.symbol] ?? ""}
                  onChange={(e) =>
                    persistWatch({
                      ...watch,
                      notes: { ...watch.notes, [row.symbol]: e.target.value },
                    })
                  }
                  placeholder="Thesis, risk, what would invalidate this setup…"
                  className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => toggleWatch(row.symbol)}>
                {watchSet.has(row.symbol) ? "Remove from active watchlist" : `Add to ${watch.active} watchlist`}
              </Button>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-white/8 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{k}</p>
      <p className="font-mono capitalize tabular-nums">{v}</p>
    </div>
  );
}
