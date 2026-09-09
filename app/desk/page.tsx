import type { Metadata } from "next";
import { MarketDesk } from "@/components/dashboard/app-shell";

export const metadata: Metadata = {
  title: "Desk · India Market Desk",
  description:
    "Nifty 50 / Nifty 500 desk: live CMPs, 1D heat, sector rotation, universe table, F&O, EMA breadth and swing setups.",
};

export default function DeskPage() {
  return <MarketDesk view="desk" />;
}
