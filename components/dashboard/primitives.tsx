"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import type { EmaStatus } from "@/lib/types";
import { signed } from "@/lib/format";

export function Section({
  id,
  kicker,
  title,
  subtitle,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <span className="text-[10px] font-medium tracking-[0.16em] text-cyan-400/70 uppercase">
              {kicker}
            </span>
            {title}
          </h2>
          {subtitle ? (
            <p className="hidden max-w-3xl text-[11px] text-muted-foreground lg:block">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Chg({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (!Number.isFinite(value)) {
    return <span className="font-mono text-xs text-slate-500">—</span>;
  }
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-xs tabular-nums",
        up ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {signed(value)}
      {suffix}
    </span>
  );
}

export function EmaPills({ emas }: { emas: EmaStatus[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {emas.map((e) => (
        <span
          key={e.period}
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            e.above
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300",
          )}
          title={`${e.period} EMA ${e.value}`}
        >
          {e.period}
        </span>
      ))}
    </div>
  );
}

export function Sparkline({ values, width = 84, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-muted-foreground">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={up ? "#34d399" : "#fb7185"}
        strokeWidth="1.6"
        points={pts}
      />
    </svg>
  );
}

export function Gauge({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const tone = pct >= 55 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#fb7185";
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-white/8 bg-card/80 p-3">
      <svg width="96" height="96" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="56" textAnchor="middle" className="fill-white" fontSize="18" fontFamily="ui-monospace">
          {pct.toFixed(0)}%
        </text>
        <text x="60" y="74" textAnchor="middle" fill="#94a3b8" fontSize="10">
          above
        </text>
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  children,
  widthClass = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={cn(
          "relative z-10 flex h-full w-full flex-col overflow-y-auto border-l border-white/10 bg-[#0c1526] shadow-2xl",
          widthClass,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        {children}
      </aside>
    </div>
  );
}

export function Panel({
  children,
  className,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "up" | "down" | "none";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/8 bg-card/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        glow === "up" && "ring-1 ring-emerald-500/25",
        glow === "down" && "ring-1 ring-rose-500/25",
        className,
      )}
    >
      {children}
    </div>
  );
}
