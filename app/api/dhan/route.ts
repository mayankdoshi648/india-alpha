import { dhanIndexLtp, runWithDhan, sanitizeDhanInput } from "@/lib/dhan";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    clientId?: string;
  };
  const creds = sanitizeDhanInput(body);
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "Enter both the Dhan access token and client ID." },
      { status: 400 },
    );
  }
  try {
    const nifty = await runWithDhan(creds, async () => {
      const ltp = await dhanIndexLtp([13]);
      return ltp["13"] ?? Object.values(ltp)[0] ?? null;
    });
    return NextResponse.json({ ok: true, nifty });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Dhan rejected these credentials";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
