"use client";

import type { DerivativesRadar } from "@/lib/types";
import { compact, inr, signed } from "@/lib/format";
import { Panel } from "@/components/dashboard/primitives";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function Derivatives({ data }: { data: DerivativesRadar }) {
  const regimeTone =
    data.volatilityRegime === "low"
      ? "text-emerald-300"
      : data.volatilityRegime === "normal"
        ? "text-sky-300"
        : data.volatilityRegime === "elevated"
          ? "text-amber-300"
          : "text-rose-300";

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <Panel className="xl:col-span-1">
        <p className="text-xs text-muted-foreground">FII / DII net institutional flow</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <FlowStat label="FII net" value={data.fiiNet} streak={data.fiiStreak} />
          <FlowStat label="DII net" value={data.diiNet} streak={data.diiStreak} />
        </div>
        <div className="mt-4 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.flows.slice(-20)}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
                formatter={(v) => compact(Number(v))}
              />
              <Bar dataKey="fiiNet" fill="#fb7185" radius={2} />
              <Bar dataKey="diiNet" fill="#34d399" radius={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">₹ crore · last 20 sessions · FII rose / DII emerald</p>
      </Panel>

      <Panel>
        <p className="text-xs text-muted-foreground">Volatility regime and IV flow</p>
        <p className="mt-2 font-mono text-3xl tabular-nums">{data.indiaVix.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">
          India VIX {signed(data.indiaVixChangePct)}%
        </p>
        <p className={`mt-3 text-sm font-medium capitalize ${regimeTone}`}>
          {data.volatilityRegime} regime
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Stat label="IV rank" value={`${data.ivRank}`} />
          <Stat label="IV percentile" value={`${data.ivPercentile}`} />
        </div>
        <div className="mt-4 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.pcrHistory}>
              <Line type="monotone" dataKey="pcr" stroke="#22d3ee" dot={false} strokeWidth={1.6} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground">PCR tape over the last 40 sessions</p>
      </Panel>

      <Panel>
        <p className="text-xs text-muted-foreground">Nifty option PCR and max pain</p>
        <p className="mt-2 font-mono text-3xl tabular-nums">{data.niftyPcr.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">Put / Call OI · expiry {data.expiry}</p>
        <div className="mt-4 space-y-2 text-sm">
          <Row k="Spot" v={inr(data.spot)} />
          <Row k="Max pain" v={inr(data.maxPain, 0)} />
          <Row k="Spot vs pain" v={`${signed(data.maxPainDistancePct)}%`} />
          <Row k="Call OI" v={compact(data.callOi)} />
          <Row k="Put OI" v={compact(data.putOi)} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          PCR above 1.1 = put-heavy hedging. Price gravitates toward max pain into expiry.
        </p>
      </Panel>
    </div>
  );
}

function FlowStat({ label, value, streak }: { label: string; value: number; streak: number }) {
  const up = value >= 0;
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`font-mono text-lg tabular-nums ${up ? "text-emerald-400" : "text-rose-400"}`}>
        {signed(value, 0)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {Math.abs(streak)}-day {streak >= 0 ? "buy" : "sell"} streak
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-background/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono tabular-nums">{value}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular-nums">{v}</span>
    </div>
  );
}
