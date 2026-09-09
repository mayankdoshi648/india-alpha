"use client";

import type { DhanCredentials, StrategySettings } from "@/lib/types";
import { STRATEGY_TEMPLATES } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/dashboard/primitives";
import { DhanConnect } from "@/components/dashboard/dhan-connect";

export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  onChange,
  onApplyTemplate,
  dhan,
  dhanConnected,
  dhanBusy,
  dhanStatus,
  dhanError,
  onConnectDhan,
  onDisconnectDhan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: StrategySettings;
  onChange: (s: StrategySettings) => void;
  onApplyTemplate: (id: string) => void;
  dhan: DhanCredentials;
  dhanConnected: boolean;
  dhanBusy: boolean;
  dhanStatus: string | null;
  dhanError: string | null;
  onConnectDhan: (creds: DhanCredentials) => Promise<void>;
  onDisconnectDhan: () => void;
}) {
  const set = (key: keyof StrategySettings, value: number | string) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <Drawer open={open} onClose={() => onOpenChange(false)} widthClass="max-w-lg">
      <div className="p-4 pr-12">
        <p className="text-[11px] tracking-[0.18em] text-cyan-400/80 uppercase">Configure</p>
        <h2 className="text-lg font-medium">Strategy settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dhan keys, EMA, RSI, volume spike and breakout rules apply to the whole desk. Templates overwrite strategy fields only. Closing this panel recalculates.
        </p>
      </div>
      <div className="space-y-5 px-4 pb-8">
        <DhanConnect
          compact
          stored={dhan}
          liveConnected={dhanConnected}
          busy={dhanBusy}
          status={dhanStatus}
          error={dhanError}
          onConnect={onConnectDhan}
          onDisconnect={onDisconnectDhan}
        />
        <div className="flex flex-wrap gap-2">
          {STRATEGY_TEMPLATES.map((t) => (
            <Button key={t.id} size="sm" variant="outline" onClick={() => onApplyTemplate(t.id)}>
              {t.name}
            </Button>
          ))}
        </div>
        <Group title="EMA periods">
          <Num label="Fast" value={settings.emaFast} onChange={(v) => set("emaFast", v)} />
          <Num label="Short" value={settings.emaShort} onChange={(v) => set("emaShort", v)} />
          <Num label="Mid" value={settings.emaMid} onChange={(v) => set("emaMid", v)} />
          <Num label="Long" value={settings.emaLong} onChange={(v) => set("emaLong", v)} />
        </Group>
        <Group title="RSI">
          <Num label="Period" value={settings.rsiPeriod} onChange={(v) => set("rsiPeriod", v)} />
          <Num label="RSI MA" value={settings.rsiMaPeriod} onChange={(v) => set("rsiMaPeriod", v)} />
          <Num label="Oversold" value={settings.rsiOversold} onChange={(v) => set("rsiOversold", v)} />
          <Num label="Overbought" value={settings.rsiOverbought} onChange={(v) => set("rsiOverbought", v)} />
        </Group>
        <Group title="Volume & breakout">
          <Num label="Spike multiple" value={settings.volumeSpikeMult} step={0.1} onChange={(v) => set("volumeSpikeMult", v)} />
          <Num label="Avg days" value={settings.volumeAvgDays} onChange={(v) => set("volumeAvgDays", v)} />
          <Num label="Breakout vol" value={settings.breakoutVolumeMult} step={0.1} onChange={(v) => set("breakoutVolumeMult", v)} />
          <Num label="Retrace %" value={settings.breakoutRetracePct} onChange={(v) => set("breakoutRetracePct", v)} />
        </Group>
        <Group title="Stage 2">
          <Num label="Near 52W high %" value={settings.stage2NearHighPct} onChange={(v) => set("stage2NearHighPct", v)} />
          <Num label="Above 52W low %" value={settings.stage2AboveLowPct} onChange={(v) => set("stage2AboveLowPct", v)} />
          <Num label="CMF period" value={settings.cmfPeriod} onChange={(v) => set("cmfPeriod", v)} />
        </Group>
        <div className="space-y-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Trend filter timeframe</p>
          <div className="flex gap-2">
            {(["D", "W", "both"] as const).map((tf) => (
              <Button
                key={tf}
                size="sm"
                variant={settings.momentumTimeframe === tf ? "default" : "outline"}
                onClick={() => set("momentumTimeframe", tf)}
              >
                {tf === "D" ? "Daily" : tf === "W" ? "Weekly" : "Daily + weekly"}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
