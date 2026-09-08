import { buildSnapshot } from "@/lib/engine";
import type { StrategySettings, UniverseId } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const universe = (searchParams.get("universe") === "nifty500" ? "nifty500" : "nifty50") as UniverseId;
  const snap = await buildSnapshot(universe);
  return NextResponse.json(snap);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    universe?: UniverseId;
    settings?: Partial<StrategySettings>;
  };
  const universe = body.universe === "nifty500" ? "nifty500" : "nifty50";
  const snap = await buildSnapshot(universe, body.settings);
  return NextResponse.json(snap);
}
