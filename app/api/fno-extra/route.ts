import { buildFoExtra } from "@/lib/fo-extra";
import { runWithDhan, sanitizeDhanInput } from "@/lib/dhan";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const extra = await runWithDhan(
      sanitizeDhanInput({
        accessToken: req.headers.get("x-dhan-access-token") || "",
        clientId: req.headers.get("x-dhan-client-id") || "",
      }),
      () => buildFoExtra(),
    );
    return NextResponse.json(extra, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fno extra failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
