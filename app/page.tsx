import { MarketDesk } from "@/components/dashboard/app-shell";
import { buildSnapshot } from "@/lib/engine";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await buildSnapshot("nifty50", DEFAULT_SETTINGS);
  return <MarketDesk initial={initial} />;
}
