import type { Metadata } from "next";
import { MarketDesk } from "@/components/dashboard/app-shell";

export const metadata: Metadata = {
  title: "Chart patterns · India Market Desk",
  description:
    "Daily, weekly and monthly triangle, flag, wedge and H&S scanner on Nifty 50 and Nifty 500, with sector rotation and 1D closes.",
};

export default function Home() {
  return <MarketDesk view="patterns" />;
}
