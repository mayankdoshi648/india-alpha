"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot, DhanCredentials, StrategySettings, UniverseId } from "@/lib/types";
import { DhanConnect } from "@/components/dashboard/dhan-connect";
import { DEFAULT_SETTINGS, STRATEGY_TEMPLATES } from "@/lib/settings";
import { IndexTiles } from "@/components/dashboard/index-tiles";
import { SetupRadar } from "@/components/dashboard/setup-radar";
import { Derivatives } from "@/components/dashboard/derivatives";
import { OptionLadder } from "@/components/dashboard/option-ladder";
import { BreadthGauges } from "@/components/dashboard/breadth-gauges";
import { SectorMatrix } from "@/components/dashboard/sector-matrix";
import { UniverseTable } from "@/components/dashboard/universe-table";
import { BreadthSection } from "@/components/dashboard/market-breadth";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { SessionBar } from "@/components/dashboard/session-bar";
import { MacroStrip } from "@/components/dashboard/macro-strip";
import { DeskAlerts } from "@/components/dashboard/desk-alerts";
import { StockChart } from "@/components/dashboard/stock-chart";
import { PulseBar } from "@/components/dashboard/pulse-bar";
import { Movers, NameMosaic } from "@/components/dashboard/movers";
import { Section, Panel, Drawer } from "@/components/dashboard/primitives";
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

type DeskTab = "tape" | "setups" | "fo" | "sectors" | "universe" | "breadth" | "feed";

const TABS: { id: DeskTab; label: string; hint: string }[] = [
  { id: "tape", label: "Tape", hint: "1" },
  { id: "setups", label: "Setups", hint: "2" },
  { id: "fo", label: "F&O", hint: "3" },
  { id: "sectors", label: "Sectors", hint: "4" },
  { id: "universe", label: "Universe", hint: "5" },
  { id: "breadth", label: "Breadth", hint: "6" },
  { id: "feed", label: "Feed", hint: "7" },
];

const HASH_TAB: Record<string, DeskTab> = {
  dhan: "feed",
  alerts: "tape",
  session: "tape",
  indices: "tape",
  setups: "setups",
  derivatives: "fo",
  ladder: "fo",
  gauges: "breadth",
  sectors: "sectors",
  universe: "universe",
  breadth: "breadth",
  feed: "feed",
};

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

export function MarketDesk({ initial }: { initial: DashboardSnapshot }) {
  const [universe, setUniverse] = useState<UniverseId>(initial.universe);
  const [settings, setSettings] = useState<StrategySettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<DashboardSnapshot>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [watch, setWatch] = useState<WatchStore>(EMPTY_WATCH);
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  const [dhan, setDhan] = useState<DhanCredentials>(EMPTY_DHAN);
  const [dhanBusy, setDhanBusy] = useState(false);
  const [dhanStatus, setDhanStatus] = useState<string | null>(null);
  const [dhanError, setDhanError] = useState<string | null>(null);
  const [tab, setTab] = useState<DeskTab>("tape");

  function goTab(next: DeskTab) {
    setTab(next);
    const hash = next === "tape" ? "indices" : next === "fo" ? "derivatives" : next === "feed" ? "dhan" : next;
    window.history.replaceState(null, "", `#${hash}`);
  }

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate private lists from localStorage after paint */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("imd-watch");
      if (raw) setWatch({ ...EMPTY_WATCH, ...JSON.parse(raw) });
      const s = localStorage.getItem("imd-settings");
      let nextSettings = DEFAULT_SETTINGS;
      if (s) {
        nextSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
        setSettings(nextSettings);
      }
      const d = localStorage.getItem("imd-dhan");
      if (d) {
        const parsed = JSON.parse(d) as DhanCredentials;
        if (parsed.accessToken && parsed.clientId) {
          setDhan(parsed);
          void loadTape(universe, nextSettings, parsed);
        }
      }
    } catch {
      // ignore
    }
    // First hydrate only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "");
      if (HASH_TAB[h]) setTab(HASH_TAB[h]);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      const map: Record<string, DeskTab> = {
        "1": "tape",
        "2": "setups",
        "3": "fo",
        "4": "sectors",
        "5": "universe",
        "6": "breadth",
        "7": "feed",
      };
      if (map[e.key]) goTab(map[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          dhan: creds.accessToken && creds.clientId ? creds : undefined,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) throw new Error(`Market API ${res.status}`);
      const json = (await res.json()) as DashboardSnapshot;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the desk");
    } finally {
      setLoading(false);
    }
  }, [universe, settings, dhan]);

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

  const dhanLive = data.sources.quotes === "dhan" || data.sources.derivatives === "dhan";
  const row = data.stocks.find((s) => s.symbol === openSymbol) ?? null;

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
    <div className="min-h-screen bg-[#070b14] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#070b14]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-300">
                <Landmark className="size-3.5" />
              </div>
              <div>
                <p className="text-[10px] tracking-[0.18em] text-cyan-400/80 uppercase">India Market Desk</p>
                <SessionBar data={data} token={dhan.accessToken} />
              </div>
            </div>
            <PulseBar data={data} />
            <div className="flex flex-wrap items-center gap-1.5">
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
                onClick={() => goTab("feed")}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[12px]",
                  dhanLive
                    ? "border-emerald-400/30 text-emerald-200"
                    : "border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10",
                )}
              >
                <KeyRound className="size-3.5" />
                {dhanLive ? "Dhan" : "Keys"}
              </button>
              <Button size="sm" variant="outline" className="h-7" onClick={() => void load()} disabled={loading}>
                {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              </Button>
              <button
                type="button"
                id="configure-desk"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-cyan-400 px-2.5 text-[12px] font-medium text-slate-950 hover:bg-cyan-300"
              >
                <Settings2 className="size-3.5" />
                Config
              </button>
            </div>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px]",
                  tab === t.id
                    ? "bg-cyan-400/15 text-cyan-100"
                    : "text-muted-foreground hover:bg-white/5 hover:text-slate-200",
                )}
              >
                {t.label}
                <kbd className="hidden font-mono text-[10px] text-white/30 sm:inline">{t.hint}</kbd>
              </button>
            ))}
            <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground sm:inline">
              {data.stocks.length} names · keys 1–7
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1680px] flex-1 flex-col gap-3 px-3 py-3">
        {error ? (
          <Panel className="flex items-center gap-3 text-rose-300">
            <WifiOff className="size-4" />
            {error}
          </Panel>
        ) : null}
        {loading ? (
          <div className="rounded-md border border-cyan-400/30 bg-cyan-950/80 px-3 py-1.5 text-sm text-cyan-100">
            Recalculating {universe === "nifty50" ? "Nifty 50" : "Nifty 500"}…
          </div>
        ) : null}

        {tab === "tape" ? (
          <div className="space-y-3">
            <Section id="alerts" kicker="Radar" title="Alerts">
              <DeskAlerts alerts={data.alerts ?? []} onPick={setOpenSymbol} />
            </Section>
            <Section id="session" kicker="Risk" title="Session macro">
              <MacroStrip tiles={data.macro ?? []} />
            </Section>
            <Section id="indices" kicker="01" title="Index tape">
              <IndexTiles tiles={data.indices} />
            </Section>
            <NameMosaic rows={data.stocks} onOpen={setOpenSymbol} />
            <Movers rows={data.stocks} onOpen={setOpenSymbol} />
          </div>
        ) : null}

        {tab === "setups" ? (
          <Section id="setups" kicker="Scanner" title="Setups">
            <SetupRadar hits={data.patterns} onPick={setOpenSymbol} />
          </Section>
        ) : null}

        {tab === "fo" ? (
          <div className="space-y-3">
            <Section id="derivatives" kicker="02" title="Institutional F&O">
              <Derivatives data={data.derivatives} />
            </Section>
            <Section id="ladder" kicker="OI" title="Nifty option ladder">
              <OptionLadder data={data.derivatives} />
            </Section>
          </div>
        ) : null}

        {tab === "sectors" ? (
          <Section id="sectors" kicker="04" title="Sector rotation">
            <SectorMatrix sectors={data.sectors} heatmap={data.heatmap} />
          </Section>
        ) : null}

        {tab === "universe" ? (
          <Section id="universe" kicker="05" title="Universe inspector">
            <UniverseTable
              key={data.universe}
              rows={data.stocks}
              watch={watchSet}
              onToggleWatch={toggleWatch}
              onOpen={setOpenSymbol}
            />
          </Section>
        ) : null}

        {tab === "breadth" ? (
          <div className="space-y-3">
            <Section id="gauges" kicker="03" title="EMA breadth">
              <BreadthGauges gauges={data.breadthGauges} />
            </Section>
            <Section id="breadth" kicker="Trend" title="Market breadth">
              <BreadthSection breadth={data.breadth} trend={data.trend} />
            </Section>
          </div>
        ) : null}

        {tab === "feed" ? (
          <Section
            id="dhan"
            kicker="Feed"
            title="DhanHQ keys"
            subtitle="Paste a 24-hour JWT from web.dhan.co. Client ID is optional."
          >
            <DhanConnect
              stored={dhan}
              liveConnected={dhanLive}
              busy={dhanBusy}
              status={dhanStatus}
              error={dhanError}
              onConnect={connectDhan}
              onDisconnect={disconnectDhan}
            />
          </Section>
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
              </p>
            </div>
            <div className="space-y-4 px-4 pb-8">
              <div className="flex items-end justify-between">
                <p className="font-mono text-3xl tabular-nums">{inr(row.cmp)}</p>
                <Chg value={row.change1d} />
              </div>
              <StockChart points={row.chart ?? []} emas={row.emas} />
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
