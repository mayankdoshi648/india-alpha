"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Mount Recharts only after the box has a real size so it cannot throw on width/height -1. */
export function ChartFit({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setOk(r.width > 16 && r.height > 16);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {ok ? children : <div className="h-full w-full animate-pulse rounded-md bg-white/5" />}
    </div>
  );
}
