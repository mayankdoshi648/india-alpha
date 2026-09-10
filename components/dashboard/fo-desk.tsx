"use client";

import { useEffect, useMemo, useState } from "react";
import { FoRadar } from "@/components/dashboard/fo-radar";
import { Chg, Sparkline } from "@/components/dashboard/primitives";
import { compact, inr, signed } from "@/lib/format";
import {
  bookLine,
  buildCounts,
  daysToExpiry,
  expiryHint,
  foTableRows,
  ivVsRealized,
  premiumTape,
  rolloverWatch,
  sessionOiPath,
  sortFoTable,
  unusualFoRows,
  type FoTableSort,
} from "@/lib/fo-review";
import { FO_BUILD_LABEL, FO_BUILD_ORDER, buildupStreaks } from "@/lib/fo-radar";
import { demoBankBook } from "@/lib/fo-book";
import type { DashboardSnapshot, FoExtraPayload, FoIndexBook, OptionStrike } from "@/lib/types";
import { cn } from "@/lib/utils";

const SORTS: { id: FoTableSort; label: string }[] = [
  { id: "oi", label: "OI %" },
  { id: "close", label: "Close %" },
  { id: "pcr", label: "PCR" },
  { id: "iv", label: "ATM IV" },
  { id: "move", label: "Exp move" },
  { id: "prem", label: "Fut prem" },
  { id: "ivGap", label: "IV − RV" },
  { id: "symbol", label: "Name" },
];

export function FoDesk({
  snap,
  onOpen,
}: {
  snap: DashboardSnapshot;
  onOpen: (symbol: string) => void;
}) {
  const [sort, setSort] = useState<FoTableSort>("oi");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [extra, setExtra] = useState<FoExtraPayload | null>(null);
  const [extraErr, setExtraErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fno-extra", { cache: "no-store", signal: AbortSignal.timeout(25_000) })
      .then(async (res) => {
        const json = (await res.json()) as FoExtraPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || `F&O extra ${res.status}`);
        if (!cancelled) {
          setExtra(json);
          setExtraErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setExtraErr(e instanceof Error ? e.message : "F&O extra failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const table = useMemo(() => foTableRows(snap.stocks), [snap.stocks]);
  const unusual = useMemo(() => unusualFoRows(table), [table]);
  const prem = useMemo(() => premiumTape(table), [table]);
  const iv = useMemo(() => ivVsRealized(table), [table]);
  const sorted = useMemo(() => sortFoTable(table, sort, dir), [table, sort, dir]);
  const counts = useMemo(() => buildCounts(snap.stocks), [snap.stocks]);
  const streakCounts = useMemo(
    () => FO_BUILD_ORDER.map((k) => ({ kind: k, n: buildupStreaks(snap.stocks, snap.asOf, k).length })),
    [snap.stocks, snap.asOf],
  );
  const days = daysToExpiry(snap.asOf, snap.derivatives.expiry);
  const rolling = useMemo(() => rolloverWatch(table, days), [table, days]);
  const pcrPath = sessionOiPath(snap.derivatives);
  const bankTile = snap.indices.find((i) => i.id === "banknifty");
  const bankBook =
    extra?.bankNifty ??
    (bankTile ? demoBankBook(bankTile.cmp, snap.derivatives.expiry) : null);

  const pickSort = (id: FoTableSort) => {
    if (sort === id) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(id);
      setDir(id === "symbol" ? "asc" : "desc");
    }
  };

  const d = snap.derivatives;
  const regime =
    d.volatilityRegime === "low"
      ? "text-emerald-300"
      : d.volatilityRegime === "normal"
        ? "text-sky-300"
        : d.volatilityRegime === "elevated"
          ? "text-amber-300"
          : "text-rose-300";

  return (
    <div className="space-y-6">
      <section id="fo-index-header" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat k="India VIX" v={d.indiaVix.toFixed(2)} sub={<Chg value={d.indiaVixChangePct} />} />
        <Stat
          k="IV rank"
          v={`${d.ivRank}`}
          sub={<span className={cn("text-[11px] capitalize", regime)}>{d.volatilityRegime} · p{d.ivPercentile}</span>}
        />
        <Stat k="Nifty PCR" v={d.niftyPcr.toFixed(2)} sub={<span className="text-[11px] text-slate-500">put / call OI</span>} />
        <Stat
          k="Spot vs pain"
          v={`${signed(d.maxPainDistancePct)}%`}
          sub={<span className="text-[11px] text-slate-500">pain {inr(d.maxPain, 0)}</span>}
        />
        <Stat
          k="Expiry"
          v={days == null ? d.expiry : `${days}d`}
          sub={<span className="text-[11px] text-slate-500">{d.expiry}</span>}
        />
        <Stat
          k="Cash FII"
          v={`${signed(d.fiiNet, 0)} cr`}
          sub={
            <span className={cn("font-mono text-[11px] tabular-nums", d.diiNet >= 0 ? "text-emerald-400" : "text-rose-400")}>
              DII {signed(d.diiNet, 0)} cr
            </span>
          }
        />
      </section>

      <section id="fo-book-balance">
        <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">Book today</p>
        <div className="flex flex-wrap gap-1.5">
          {FO_BUILD_ORDER.map((k) => (
            <span
              key={k}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300"
            >
              {FO_BUILD_LABEL[k]}
              <span className="ml-1.5 font-mono tabular-nums text-white">{counts[k]}</span>
              <span className="ml-1 font-mono text-[10px] text-slate-500">
                · {streakCounts.find((s) => s.kind === k)?.n ?? 0} streaks
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-slate-400">{bookLine(counts)}</p>
      </section>

      <section id="fo-expiry-strip" className="rounded-xl border border-white/10 bg-[#0d1524] px-3 py-2.5">
        <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">Expiry / roll</p>
        <p className="mt-1 text-[13px] text-slate-200">{expiryHint(days)}</p>
        {rolling.length ? (
          <p className="mt-1 text-[12px] text-slate-400">
            Fat premium into expiry:{" "}
            {rolling.map((r) => `${r.symbol} ${signed(r.futPremiumPct)}%`).join(" · ")}
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-slate-500">No crowded premium names flagged for a roll.</p>
        )}
      </section>

      <FoRadar
        rows={snap.stocks}
        asOf={snap.asOf}
        niftyChange={snap.indices.find((i) => i.id === "nifty")?.changePct ?? 0}
        onOpen={onOpen}
      />

      <section id="fo-unusual">
        <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">Unusual OI</p>
        <p className="mb-2 text-[11px] text-slate-500">
          Today’s repositioning — OI change × volume × price. Tomorrow’s watchlist, not a 3-day streak.
        </p>
        {unusual.length ? (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-[12px]">
              <thead className="text-[10px] tracking-[0.12em] text-slate-500 uppercase">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Name</th>
                  <th className="px-2 py-1.5 font-medium">Close</th>
                  <th className="px-2 py-1.5 font-medium">OI %</th>
                  <th className="px-2 py-1.5 font-medium">Build</th>
                  <th className="px-2 py-1.5 font-medium">IV</th>
                  <th className="px-2 py-1.5 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {unusual.map((r) => (
                  <tr key={r.symbol} className="border-t border-white/6 hover:bg-white/4">
                    <td className="px-2 py-1.5">
                      <button type="button" id={`fo-unusual-${r.symbol}`} onClick={() => onOpen(r.symbol)} className="font-semibold text-white">
                        {r.symbol}
                      </button>
                    </td>
                    <td className="px-2 py-1.5"><Chg value={r.change1d} /></td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-200">{signed(r.oiPct)}%</td>
                    <td className="px-2 py-1.5 capitalize text-slate-400">{r.oiBuild.replace("-", " ")}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-400">{r.atmIv.toFixed(0)}%</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No unusual OI prints on this tape.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section id="fo-premium">
          <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">Futures premium</p>
          <SideList
            title="Contango"
            rows={prem.contango}
            value={(r) => signed(r.futPremiumPct)}
            onOpen={onOpen}
            prefix="fo-prem-up"
          />
          <SideList
            title="Backwardation"
            rows={prem.backwardation}
            value={(r) => signed(r.futPremiumPct)}
            onOpen={onOpen}
            prefix="fo-prem-dn"
            className="mt-3"
          />
        </section>
        <section id="fo-iv-realized">
          <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">IV vs realized</p>
          <SideList
            title="Rich (sell vol)"
            rows={iv.rich}
            value={(r) => `${signed(r.ivGap)} IV−RV`}
            onOpen={onOpen}
            prefix="fo-iv-rich"
          />
          <SideList
            title="Cheap (buy vol)"
            rows={iv.cheap}
            value={(r) => `${signed(r.ivGap)} IV−RV`}
            onOpen={onOpen}
            prefix="fo-iv-cheap"
            className="mt-3"
          />
        </section>
      </div>

      <section id="fo-stock-tape">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">
            Stock F&O · {sorted.length} names
          </p>
          <div className="flex flex-wrap gap-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                id={`fo-sort-${s.id}`}
                onClick={() => pickSort(s.id)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  sort === s.id
                    ? "border-white/25 bg-white/10 text-slate-100"
                    : "border-white/10 text-slate-500 hover:text-slate-200",
                )}
              >
                {s.label}
                {sort === s.id ? (dir === "desc" ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 bg-[#121b2c] text-[10px] tracking-[0.12em] text-slate-500 uppercase">
              <tr>
                <th className="px-2 py-1.5 font-medium">Name</th>
                <th className="px-2 py-1.5 font-medium">Close %</th>
                <th className="px-2 py-1.5 font-medium">OI %</th>
                <th className="px-2 py-1.5 font-medium">Build</th>
                <th className="px-2 py-1.5 font-medium">PCR</th>
                <th className="px-2 py-1.5 font-medium">IV</th>
                <th className="px-2 py-1.5 font-medium">Move</th>
                <th className="px-2 py-1.5 font-medium">Prem</th>
                <th className="px-2 py-1.5 font-medium">IV−RV</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const banned = extra?.ban.includes(r.symbol);
                return (
                  <tr key={r.symbol} className={cn("border-t border-white/6 hover:bg-white/4", banned && "bg-amber-500/8")}>
                    <td className="px-2 py-1.5">
                      <button type="button" id={`fo-row-${r.symbol}`} onClick={() => onOpen(r.symbol)} className="font-semibold text-white">
                        {r.symbol}
                      </button>
                      {banned ? <span className="ml-1.5 text-[10px] text-amber-300">BAN</span> : null}
                    </td>
                    <td className="px-2 py-1.5"><Chg value={r.change1d} /></td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-200">{signed(r.oiPct)}%</td>
                    <td className="px-2 py-1.5 capitalize text-slate-400">{r.oiBuild.replace("-", " ")}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-300">{r.pcr.toFixed(2)}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-400">{r.atmIv.toFixed(0)}%</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-400">{r.expectedMovePct.toFixed(1)}%</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-400">{signed(r.futPremiumPct)}%</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-slate-400">
                      {Number.isFinite(r.ivGap) ? signed(r.ivGap, 1) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <OiLadder
          id="fo-nifty-oi"
          title="Nifty OI · current"
          book={{
            symbol: "NIFTY",
            label: "Nifty",
            source: snap.sources.derivatives,
            spot: d.spot,
            expiry: d.expiry,
            pcr: d.niftyPcr,
            maxPain: d.maxPain,
            maxPainDistancePct: d.maxPainDistancePct,
            callOi: d.callOi,
            putOi: d.putOi,
            callWall: d.callWall,
            putWall: d.putWall,
            ladder: d.ladder ?? [],
          }}
        />
        <OiLadder
          id="fo-bank-oi"
          title="Bank Nifty OI"
          book={bankBook}
          loading={!extra && !extraErr && !bankBook}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OiLadder
          id="fo-nifty-next"
          title="Nifty OI · next expiry"
          book={extra?.niftyNext ?? null}
          loading={!extra && !extraErr}
          empty="Next expiry chain loads only on this tab — not on the main tape."
        />
        <section id="fo-pcr-path" className="rounded-xl border border-white/10 bg-[#0d1524] px-3 py-2.5">
          <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">PCR path</p>
          <p className="mt-1 text-[12px] text-slate-400">
            Daily put/call OI, not 1-minute. Intraday OI ticks would need a separate feed and would slow the desk.
          </p>
          <div className="mt-3">
            <Sparkline values={pcrPath} width={280} height={48} markLast />
          </div>
          {extra?.ban.length ? (
            <p className="mt-3 text-[12px] text-amber-200">
              F&O ban: {extra.ban.slice(0, 12).join(", ")}
              {extra.ban.length > 12 ? ` +${extra.ban.length - 12}` : ""}
            </p>
          ) : (
            <p className="mt-3 text-[12px] text-slate-500">
              {extra ? "No names on the F&O ban list." : extraErr ? extraErr : "Ban list loads with this tab."}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-500">{extra?.participantNote ?? "Cash FII on the header is equity flow."}</p>
        </section>
      </div>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121b2c] px-3 py-2.5">
      <p className="text-[11px] text-slate-400">{k}</p>
      <p className="mt-0.5 font-mono text-xl tracking-tight text-white tabular-nums">{v}</p>
      {sub}
    </div>
  );
}

function SideList({
  title,
  rows,
  value,
  onOpen,
  prefix,
  className,
}: {
  title: string;
  rows: { symbol: string }[];
  value: (row: { symbol: string } & Record<string, number>) => string;
  onOpen: (s: string) => void;
  prefix: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] text-slate-500">{title}</p>
      <div className="divide-y divide-white/6 rounded-xl border border-white/10">
        {rows.length ? (
          rows.map((r) => (
            <button
              key={r.symbol}
              type="button"
              id={`${prefix}-${r.symbol}`}
              onClick={() => onOpen(r.symbol)}
              className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-white/5"
            >
              <span className="text-[13px] font-medium text-white">{r.symbol}</span>
              <span className="font-mono text-[11px] tabular-nums text-slate-400">
                {value(r as { symbol: string } & Record<string, number>)}
              </span>
            </button>
          ))
        ) : (
          <p className="px-2.5 py-2 text-[12px] text-slate-500">None on this tape.</p>
        )}
      </div>
    </div>
  );
}

function OiLadder({
  id,
  title,
  book,
  loading,
  empty,
}: {
  id: string;
  title: string;
  book: FoIndexBook | null;
  loading?: boolean;
  empty?: string;
}) {
  if (loading) {
    return (
      <section id={id} className="rounded-xl border border-white/10 bg-[#0d1524] px-3 py-3">
        <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">{title}</p>
        <p className="mt-2 text-[12px] text-slate-500">Loading chain…</p>
      </section>
    );
  }
  if (!book) {
    return (
      <section id={id} className="rounded-xl border border-white/10 bg-[#0d1524] px-3 py-3">
        <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">{title}</p>
        <p className="mt-2 text-[12px] text-slate-500">{empty ?? "Chain not on this tape."}</p>
      </section>
    );
  }
  const maxOi = Math.max(1, ...book.ladder.map((s) => Math.max(s.callOi, s.putOi)));
  return (
    <section id={id} className="rounded-xl border border-white/10 bg-[#0d1524] px-3 py-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[11px] text-slate-400">Max pain</p>
          <p className="font-mono tabular-nums text-white">{inr(book.maxPain, 0)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">PCR</p>
          <p className="font-mono tabular-nums text-white">{book.pcr.toFixed(2)}</p>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Spot {inr(book.spot, 0)} · vs pain {signed(book.maxPainDistancePct)}% · call {compact(book.callOi)} · put{" "}
        {compact(book.putOi)}
      </p>
      <p className="text-[11px] text-slate-500">
        Call wall {inr(book.callWall, 0)} · put wall {inr(book.putWall, 0)} · {book.expiry} · {book.source}
      </p>
      <div className="mt-2 space-y-0.5">
        {book.ladder.slice(0, 15).map((s) => (
          <StrikeRow key={s.strike} s={s} spot={book.spot} maxOi={maxOi} />
        ))}
      </div>
    </section>
  );
}

function StrikeRow({ s, spot, maxOi }: { s: OptionStrike; spot: number; maxOi: number }) {
  const atm = Math.abs(s.strike - spot) <= Math.max(25, spot * 0.002);
  const callChg = s.callOiChg ?? 0;
  const putChg = s.putOiChg ?? 0;
  return (
    <div className={cn("grid grid-cols-[1fr_56px_1fr] items-center gap-1 text-[11px]", atm && "rounded bg-sky-400/10")}>
      <div className="min-w-0">
        <div className="h-1.5 overflow-hidden rounded bg-white/10">
          <div className="ml-auto h-full bg-rose-400" style={{ width: `${(s.callOi / maxOi) * 100}%` }} />
        </div>
        {s.callOiChg != null ? (
          <p className={cn("font-mono text-[9px] tabular-nums", callChg >= 0 ? "text-rose-300/80" : "text-slate-500")}>
            {signed(callChg, 0)}
          </p>
        ) : null}
      </div>
      <span className={cn("text-center font-mono tabular-nums", atm && "text-sky-200")}>{inr(s.strike, 0)}</span>
      <div className="min-w-0">
        <div className="h-1.5 overflow-hidden rounded bg-white/10">
          <div className="h-full bg-emerald-400" style={{ width: `${(s.putOi / maxOi) * 100}%` }} />
        </div>
        {s.putOiChg != null ? (
          <p className={cn("font-mono text-[9px] tabular-nums", putChg >= 0 ? "text-emerald-300/80" : "text-slate-500")}>
            {signed(putChg, 0)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
