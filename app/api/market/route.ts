import { buildSnapshot } from "@/lib/engine";
import { withoutCharts } from "@/lib/payload";
import { runWithDhan, sanitizeDhanInput } from "@/lib/dhan";
import type { DhanCredentials, StrategySettings, UniverseId } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function credsFrom(req: Request, body?: Partial<DhanCredentials>) {
  return sanitizeDhanInput({
    accessToken: body?.accessToken || req.headers.get("x-dhan-access-token") || "",
    clientId: body?.clientId || req.headers.get("x-dhan-client-id") || "",
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const universe = (searchParams.get("universe") === "nifty500" ? "nifty500" : "nifty50") as UniverseId;
    const snap = await runWithDhan(credsFrom(req), () => buildSnapshot(universe));
    return NextResponse.json(withoutCharts(snap), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      universe?: UniverseId;
      settings?: Partial<StrategySettings>;
      dhan?: Partial<DhanCredentials>;
    };
    const universe = body.universe === "nifty500" ? "nifty500" : "nifty50";
    const snap = await runWithDhan(credsFrom(req, body.dhan), () =>
      buildSnapshot(universe, body.settings),
    );
    return NextResponse.json(withoutCharts(snap), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
