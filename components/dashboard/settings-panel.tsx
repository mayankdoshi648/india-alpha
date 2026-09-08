"use client";

import type { StrategySettings } from "@/lib/types";
import { STRATEGY_TEMPLATES } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  onChange,
  onApplyTemplate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: StrategySettings;
  onChange: (s: StrategySettings) => void;
  onApplyTemplate: (id: string) => void;
}) {
  const set = (key: keyof StrategySettings, value: number | string) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Strategy settings</SheetTitle>
          <SheetDescription>
            EMA, RSI, volume spike and breakout rules apply to the whole desk. Templates overwrite the current set.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-8">
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
      </SheetContent>
    </Sheet>
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
