"use client";

import type { SwingSetup } from "@/lib/types";
import { inr, SWING_STATUS } from "@/lib/format";
import { cn } from "@/lib/utils";

function Card({ setup }: { setup: SwingSetup }) {
  const tone =
    setup.status === "triggered" || setup.status === "throwback"
      ? "border-emerald-400/35"
      : setup.status === "at_pivot"
        ? "border-violet-400/40"
        : setup.status === "failed" || setup.status === "extended"
          ? "border-amber-400/35"
          : "border-white/10";
  const maxDepth = Math.max(1, ...setup.contractions.map((c) => c.depthPct));
  return (
    <div className={cn("space-y-2.5 rounded-xl border bg-[#121b2c] p-3", tone)}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-cyan-400/80 uppercase">
            {setup.kind === "vcp" ? "VCP · volatility contraction" : "Base breakout"}
          </p>
          <p className="text-sm text-white">
            {SWING_STATUS[setup.status] ?? setup.status}
            {setup.kind === "vcp" && setup.contractions.length
              ? ` · ${setup.contractions.length} legs`
              : ` · ${setup.baseDays}d base`}
          </p>
        </div>
        <p className="font-mono text-sm tabular-nums text-slate-300">{setup.rr.toFixed(1)}R</p>
      </div>

      <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-2 text-[12px] leading-snug text-slate-200">
        {setup.nextAction}
      </p>

      {setup.contractions.length >= 2 ? (
        <div>
          <p className="mb-1 text-[11px] text-slate-500">Contraction depth (older → tighter)</p>
          <div className="flex items-end gap-1">
            {setup.contractions.map((c, i) => (
              <div key={`${c.high}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-12 w-full items-end rounded bg-white/5">
                  <div
                    className="w-full rounded-sm bg-violet-400/80"
                    style={{ height: `${Math.max(12, (c.depthPct / maxDepth) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] tabular-nums text-violet-200">{c.depthPct.toFixed(1)}%</span>
                <span className="text-[10px] text-slate-500">{c.bars}d</span>
              </div>
            ))}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-1 font-normal">Leg</th>
                  <th className="pb-1 font-normal">Depth</th>
                  <th className="pb-1 font-normal">High</th>
                  <th className="pb-1 font-normal">Low</th>
                  <th className="pb-1 font-normal">Vol dry</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-slate-300">
                {setup.contractions.map((c, i) => (
                  <tr key={`row-${c.high}-${i}`}>
                    <td className="py-0.5">{c.bars}d</td>
                    <td>{c.depthPct.toFixed(1)}%</td>
                    <td>{inr(c.high, 0)}</td>
                    <td>{inr(c.low, 0)}</td>
                    <td>{c.volDryPct != null ? `${c.volDryPct}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-[11px] text-slate-500">Price plan</p>
        <div className="grid grid-cols-4 gap-1.5 text-sm">
          <Meta k="Buy stop" v={inr(setup.entry)} />
          <Meta k="Stop" v={`${inr(setup.stop)}`} />
          <Meta k="1R" v={inr(setup.target1R)} />
          <Meta k="2R / meas." v={inr(setup.target2R)} />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Risk {setup.riskPct}% · measured target {inr(setup.target)} · {setup.rr.toFixed(1)}R from here
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-sm">
        <Meta k="Pivot" v={inr(setup.pivot)} />
        <Meta k="To pivot" v={`${setup.distToPivotPct}%`} />
        <Meta k="vs 10 EMA" v={`${setup.extFrom10Pct}%`} />
        <Meta k="Base depth" v={`${setup.baseDepthPct}%`} />
        {setup.kind === "breakout" ? (
          <Meta k="BO volume" v={`${setup.breakoutVolX}x`} />
        ) : (
          <Meta k="Vol dry-up" v={`${setup.volDryPct}%`} />
        )}
        <Meta k={setup.kind === "breakout" ? "Handle" : "Last leg"} v={`${setup.handleDepthPct}%`} />
        <Meta k="Tightness" v={`${setup.tightnessPct}%`} />
        <Meta k="Close in bar" v={`${setup.closeInRangePct}%`} />
        <Meta k="Base days" v={`${setup.baseDays}d`} />
      </div>

      {setup.checklist?.length ? (
        <ul className="space-y-1">
          {setup.checklist.map((c) => (
            <li key={c.label} className="flex items-start gap-1.5 text-[12px] leading-snug">
              <span className={cn("mt-0.5 font-mono", c.ok ? "text-emerald-400" : "text-slate-500")}>{c.ok ? "✓" : "·"}</span>
              <span className={c.ok ? "text-slate-300" : "text-slate-500"}>{c.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="space-y-1 text-[12px] text-slate-400">
        {setup.notes.map((n) => (
          <li key={n} className="leading-snug">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-white/8 px-2 py-1.5">
      <p className="text-[10px] text-slate-500">{k}</p>
      <p className="font-mono text-[12px] tabular-nums text-slate-100">{v}</p>
    </div>
  );
}

export function SwingPanel({
  vcp,
  breakout,
}: {
  vcp: SwingSetup | null;
  breakout: SwingSetup | null;
}) {
  if (!vcp && !breakout) {
    return (
      <div className="space-y-1.5 rounded-xl border border-white/10 px-3 py-2">
        <p className="text-[11px] tracking-[0.16em] text-cyan-400/80 uppercase">Equity swing</p>
        <p className="text-sm text-slate-400">No VCP coil or base breakout on this name.</p>
        <p className="text-[12px] leading-snug text-slate-500">
          VCP: successive pullbacks that get shallower (e.g. 18% → 10% → 5%), volume dry-up, then a buy stop a tick above the last contraction high. Breakout: 55-day high as pivot, base under ~22% deep, volume ≥ 1.5× on the break, stop under the handle. Do not chase if price is &gt;8% above the 10 EMA — wait for a throwback.
        </p>
      </div>
    );
  }
  return (
    <div id="swing-setup-cards" className="space-y-2">
      {vcp ? <Card setup={vcp} /> : null}
      {breakout ? <Card setup={breakout} /> : null}
    </div>
  );
}
