"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot, StrategySettings, UniverseId } from "@/lib/types";
import { DEFAULT_SETTINGS, STRATEGY_TEMPLATES } from "@/lib/settings";
import { IndexTiles } from "@/components/dashboard/index-tiles";
import { SetupRadar } from "@/components/dashboard/setup-radar";
import { Derivatives } from "@/components/dashboard/derivatives";
import { BreadthGauges } from "@/components/dashboard/breadth-gauges";
import { SectorMatrix } from "@/components/dashboard/sector-matrix";
import { UniverseTable } from "@/components/dashboard/universe-table";
import { BreadthSection } from "@/components/dashboard/market-breadth";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { Section, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PATTERN_LABEL, inr } from "@/lib/format";
import { Chg, EmaPills } from "@/components/dashboard/primitives";
import {
  Activity,
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

export function MarketDesk({ initial }: { initial: DashboardSnapshot }) {
  const [universe, setUniverse] = useState<UniverseId>(initial.universe);
  const [settings, setSettings] = useState<StrategySettings>(initial.settings);
  const [data, setData] = useState<DashboardSnapshot>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [watch, setWatch] = useState<WatchStore>(EMPTY_WATCH);
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate private lists from localStorage after paint */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("imd-watch");
      if (raw) setWatch({ ...EMPTY_WATCH, ...JSON.parse(raw) });
      const s = localStorage.getItem("imd-settings");
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
    } catch {
      // ignore
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persistWatch = (next: WatchStore) => {
    setWatch(next);
    localStorage.setItem("imd-watch", JSON.stringify(next));
  };

  const load = useCallback(async (u = universe, s = settings) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universe: u, settings: s }),
      });
      if (!res.ok) throw new Error(`Market API ${res.status}`);
      const json = (await res.json()) as DashboardSnapshot;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the desk");
    } finally {
      setLoading(false);
    }
  }, [universe, settings]);

  const watchSet = useMemo(
    () => new Set(Object.values(watch.lists).flat()),
    [watch],
  );

  const row = data?.stocks.find((s) => s.symbol === openSymbol) ?? null;

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

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_10%_-10%,rgba(34,211,238,0.12),transparent_40%),radial-gradient(900px_circle_at_90%_0%,rgba(16,185,129,0.08),transparent_35%),#070b14] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#070b14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">
              <Landmark className="size-4" />
            </div>
            <div>
              <p className="text-[11px] tracking-[0.2em] text-cyan-400/80 uppercase">India Market Desk</p>
              <h1 className="text-base font-medium">Nifty 50 / Nifty 500 market view</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={universe}
              onChange={(e) => {
                const u = e.target.value as UniverseId;
                setUniverse(u);
                void load(u, settings);
              }}
              className="h-8 rounded-lg border border-white/10 bg-[#0e1728] px-2 text-sm"
            >
              <option value="nifty50">Nifty 50</option>
              <option value="nifty500">Nifty 500</option>
            </select>
            <select
              value={watch.active}
              onChange={(e) =>
                persistWatch({ ...watch, active: e.target.value as WatchStore["active"] })
              }
              className="h-8 rounded-lg border border-white/10 bg-[#0e1728] px-2 text-sm"
            >
              {LISTS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} watchlist ({watch.lists[l.id].length})
                </option>
              ))}
            </select>
            <SourceBadge data={data} />
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Refresh
            </Button>
            <Button size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 />
              Configure
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-[1600px] gap-3 overflow-x-auto px-4 pb-2 text-[11px] text-muted-foreground md:flex">
          {[
            ["indices", "Indices"],
            ["setups", "Setups"],
            ["derivatives", "Institutional F&O"],
            ["gauges", "EMA breadth"],
            ["sectors", "Sectors"],
            ["universe", "Universe"],
            ["breadth", "Market breadth"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="hover:text-cyan-300">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-1 flex-col gap-10 px-4 py-6">
        {error ? (
          <Panel className="flex items-center gap-3 text-rose-300">
            <WifiOff className="size-4" />
            {error}
          </Panel>
        ) : null}
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-cyan-400" />
            Recalculating {universe === "nifty50" ? "Nifty 50" : "Nifty 500"}…
          </p>
        ) : null}
        {data ? (
          <>
            <Section
              id="indices"
              kicker="Section 01"
              title="Index tape"
              subtitle="CMP, session gain and whether price sits above or below the 10 / 20 / 50 / 200 EMAs. Green pill = above, red = below."
            >
              <IndexTiles tiles={data.indices} />
            </Section>
            <Section
              id="setups"
              kicker="Scanner"
              title="Stage breakouts, volume, VCP, divergence, pivots"
              subtitle="Names currently printing a qualified base breakout, volume surge, VCP, hidden/bullish/bearish divergence, pivot reclaim or oversold pullback."
            >
              <SetupRadar hits={data.patterns} onPick={setOpenSymbol} />
            </Section>
            <Section
              id="derivatives"
              kicker="Section 02"
              title="Institutional derivatives and option positioning radar"
              subtitle="FII/DII cash flow, India VIX regime, Nifty PCR and max pain. Live Dhan option chain and NSE FII/DII when credentials or the exchange feed are available."
            >
              <Derivatives data={data.derivatives} />
            </Section>
            <Section
              id="gauges"
              kicker="Section 03"
              title="Moving average breadth gauge"
              subtitle="Four circles for 10 / 20 / 50 / 200 EMAs. Toggle daily, weekly or monthly to see what share of the universe is above each average."
            >
              <BreadthGauges gauges={data.breadthGauges} />
            </Section>
            <Section
              id="sectors"
              kicker="Section 04"
              title="Sector health matrix and heatmap"
              subtitle="Sector tiles with the same EMA tape as the indices, a constituent heatmap, and a four-quadrant rotation map (leading / weakening / lagging / improving)."
            >
              <SectorMatrix sectors={data.sectors} heatmap={data.heatmap} />
            </Section>
            <Section
              id="universe"
              kicker="Section 05"
              title="Universe component breadth inspector"
              subtitle="Every name in the selected Nifty 50 or Nifty 500 universe, with watchlist marks, cap, sector, returns, RSI, volume spike, gap, EMAs, distance from 20 EMA, 52-week range and earnings."
            >
              <UniverseTable
                rows={data.stocks}
                watch={watchSet}
                onToggleWatch={toggleWatch}
                onOpen={setOpenSymbol}
              />
            </Section>
            <Section
              id="breadth"
              kicker="Breadth & trend"
              title="Seven breadth indicators and trend filters"
              subtitle="Advance/decline, EMA participation, RSI strength and pivot posture with 60-session drill-down, plus EMA stack, convergence, bullish crosses and RSI-above-MA counts."
            >
              <BreadthSection breadth={data.breadth} trend={data.trend} />
            </Section>
            {!data.dhanConfigured ? (
              <Panel className="text-sm text-muted-foreground">
                DhanHQ is not connected. Add <code className="text-cyan-300">DHAN_ACCESS_TOKEN</code> and{" "}
                <code className="text-cyan-300">DHAN_CLIENT_ID</code> to <code>.env.local</code> to pull live quotes,
                historical candles and the Nifty option chain. NSE FII/DII and indices are used when reachable;
                otherwise the desk runs on a deterministic September 2026 market tape so every panel stays usable.
              </Panel>
            ) : null}
          </>
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
      />

      <Sheet open={Boolean(openSymbol)} onOpenChange={(o) => !o && setOpenSymbol(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {row ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {row.symbol}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{row.name}</span>
                </SheetTitle>
                <SheetDescription>
                  {row.sector} · {row.cap} cap · Stage 2 {row.stage2Score}/7
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-8">
                <div className="flex items-end justify-between">
                  <p className="font-mono text-3xl tabular-nums">{inr(row.cmp)}</p>
                  <Chg value={row.change1d} />
                </div>
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
                  <Meta k="Below 52W high" v={`${row.below52wHigh}%`} />
                  <Meta k="EMA stack" v={row.emaStack} />
                  <Meta k="Weekly stack" v={row.weeklyStack} />
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
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SourceBadge({ data }: { data: DashboardSnapshot | null }) {
  if (!data) return null;
  return (
    <span className="hidden items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[11px] text-muted-foreground sm:inline-flex">
      <Activity className="size-3 text-cyan-400" />
      quotes {data.sources.quotes} · F&O {data.sources.derivatives} · flow {data.sources.flows}
    </span>
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
