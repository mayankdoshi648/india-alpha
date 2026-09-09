import { buildSnapshot } from "@/lib/engine";
import { stockChartPayload } from "@/lib/payload";
import { fetchLiveStockFo } from "@/lib/fno";
import { runWithDhan, sanitizeDhanInput } from "@/lib/dhan";
import { stocksFor } from "@/lib/universe";
import type { UniverseId } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "").toUpperCase();
    const universe = (searchParams.get("universe") === "nifty500" ? "nifty500" : "nifty50") as UniverseId;
    if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
    const creds = sanitizeDhanInput({
      accessToken: req.headers.get("x-dhan-access-token") || "",
      clientId: req.headers.get("x-dhan-client-id") || "",
    });
    const snap = await runWithDhan(creds, () => buildSnapshot(universe));
    const payload = stockChartPayload(snap, symbol);
    if (!payload) return NextResponse.json({ error: "not found" }, { status: 404 });
    const meta = stocksFor(universe).find((s) => s.symbol === symbol);
    const live = await runWithDhan(creds, () =>
      fetchLiveStockFo({
        symbol,
        securityId: meta?.securityId ?? 0,
        spot: payload.cmp,
        change1d: payload.change1d,
        futPremiumPct: payload.fo?.futPremiumPct ?? 0,
      }),
    );
    return NextResponse.json({ ...payload, fo: live ?? payload.fo });
  } catch (e) {
    const message = e instanceof Error ? e.message : "chart failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
