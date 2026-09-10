import { dhanConfigured, dhanExpiryList, dhanOptionChain } from "@/lib/dhan";
import { indexBookFrom } from "@/lib/fo-book";
import { nseFoBanList, nseIndexChain } from "@/lib/nse";
import { indiaMarketDate } from "@/lib/session";
import type { DataSource, FoExtraPayload, FoIndexBook } from "@/lib/types";

const CACHE_MS = 60_000;
let cache: { at: number; value: FoExtraPayload } | null = null;

async function bankNiftyBook(): Promise<FoIndexBook | null> {
  if (dhanConfigured()) {
    try {
      const expiries = await dhanExpiryList(25, "IDX_I");
      const expiry = expiries[0];
      if (expiry) {
        const chain = await dhanOptionChain(25, "IDX_I", expiry);
        if (chain.strikes.length >= 6) {
          return indexBookFrom("BANKNIFTY", "Bank Nifty", "dhan", chain.spot, expiry, chain.strikes);
        }
      }
    } catch {
      // NSE
    }
  }
  try {
    const chain = await nseIndexChain("BANKNIFTY", 0);
    return indexBookFrom("BANKNIFTY", "Bank Nifty", "nse", chain.spot, chain.expiry, chain.strikes);
  } catch {
    return null;
  }
}

async function niftyNextBook(): Promise<FoIndexBook | null> {
  try {
    const chain = await nseIndexChain("NIFTY", 1);
    if (!chain.strikes.length) return null;
    return indexBookFrom("NIFTY", "Nifty next expiry", "nse", chain.spot, chain.expiry, chain.strikes);
  } catch {
    return null;
  }
}

let inflight: Promise<FoExtraPayload> | null = null;

export async function buildFoExtra(): Promise<FoExtraPayload> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (inflight) return inflight;
  inflight = (async () => {
    const asOf = indiaMarketDate();
    const [bank, niftyNext, ban] = await Promise.all([
      bankNiftyBook(),
      niftyNextBook(),
      nseFoBanList(),
    ]);
    const live = Boolean(bank || niftyNext || ban.length);
    const source: DataSource = live
      ? bank?.source === "dhan" || niftyNext?.source === "dhan"
        ? "dhan"
        : "nse"
      : "demo";
    const value: FoExtraPayload = {
      asOf,
      bankNifty: bank,
      niftyNext,
      ban,
      participants: [],
      participantNote:
        "F&O participant OI (FII/Pro/Client) is not on this snapshot. Cash FII/DII on the header is the equity flow, not the futures book.",
      source,
    };
    if (live) cache = { at: Date.now(), value };
    return value;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
