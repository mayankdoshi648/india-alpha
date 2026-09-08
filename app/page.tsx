import { buildSnapshot } from "@/lib/engine";
import { MarketDesk } from "@/components/dashboard/app-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await buildSnapshot("nifty50");
  return <MarketDesk initial={initial} />;
}
