import {
  dhanIndexLtp,
  dhanProfile,
  explainDhanAuthError,
  looksLikeJwt,
  runWithDhan,
  sanitizeDhanInput,
} from "@/lib/dhan";
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
      { ok: false, error: "Paste a Dhan access token. Client ID is optional if the token is a JWT." },
      { status: 400 },
    );
  }
  if (!looksLikeJwt(creds.accessToken)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This is not a Dhan access token. Paste the JWT from web.dhan.co → My Profile → Access DhanHQ APIs. It starts with eyJ. Do not paste the API key or API secret.",
      },
      { status: 400 },
    );
  }
  try {
    const profile = await dhanProfile(creds.accessToken);
    const clientId = profile.dhanClientId?.trim() || creds.clientId;
    if (!clientId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Token is valid but Dhan did not return a Client ID. Paste the numeric Client ID from My Profile.",
        },
        { status: 400 },
      );
    }
    const nifty = await runWithDhan({ accessToken: creds.accessToken, clientId }, async () => {
      const ltp = await dhanIndexLtp([13]);
      return ltp["13"] ?? Object.values(ltp)[0] ?? null;
    });
    return NextResponse.json({
      ok: true,
      nifty,
      clientId,
      tokenValidity: profile.tokenValidity ?? null,
      dataPlan: profile.dataPlan ?? null,
      name: profile.dhanClientName ?? null,
    });
  } catch (e) {
    const message = explainDhanAuthError(e instanceof Error ? e.message : "Dhan rejected these credentials");
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
