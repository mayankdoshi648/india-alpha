import { buildSnapshot } from "@/lib/engine";
import { stockChartPayload } from "@/lib/payload";
import { runWithDhan, sanitizeDhanInput } from "@/lib/dhan";
import type { UniverseId } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "chart failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
