import {
  dhanRenewToken,
  dhanVerifyDataAccess,
  explainDhanAuthError,
  looksLikeJwt,
  sanitizeDhanInput,
} from "@/lib/dhan";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    clientId?: string;
    renew?: boolean;
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
    if (body.renew) {
      if (!creds.clientId) {
        return NextResponse.json(
          { ok: false, error: "Client ID is required to renew the token." },
          { status: 400 },
        );
      }
      const renewed = await dhanRenewToken(creds.accessToken, creds.clientId);
      const verified = await dhanVerifyDataAccess({
        accessToken: renewed.accessToken,
        clientId: renewed.clientId || creds.clientId,
      });
      return NextResponse.json({
        ok: true,
        renewed: true,
        accessToken: renewed.accessToken,
        clientId: verified.clientId || creds.clientId,
        tokenValidity: verified.profile?.tokenValidity ?? renewed.expiryTime ?? null,
        dataPlan: verified.profile?.dataPlan ?? null,
        name: verified.profile?.dhanClientName ?? null,
      });
    }
    const verified = await dhanVerifyDataAccess(creds);
    const clientId = verified.clientId;
    if (!clientId && verified.nifty == null) {
      return NextResponse.json(
        {
          ok: false,
          error: "Token reached Data APIs but Dhan did not return a Client ID. Paste the numeric Client ID from My Profile.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      nifty: verified.nifty,
      clientId,
      tokenValidity: verified.profile?.tokenValidity ?? null,
      dataPlan: verified.profile?.dataPlan ?? null,
      name: verified.profile?.dhanClientName ?? null,
    });
  } catch (e) {
    const message = explainDhanAuthError(e instanceof Error ? e.message : "Dhan rejected these credentials");
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
