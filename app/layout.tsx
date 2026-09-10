import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_BOOT } from "@/lib/theme";
import { ThemeProvider } from "@/components/dashboard/theme-provider";
import { ThemeToaster } from "@/components/dashboard/theme-toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "India Market Desk",
  description:
    "Nifty 50 / Nifty 500 market view with institutional flows, option PCR, EMA breadth, sector rotation and setup scanner. DhanHQ + NSE India.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full min-h-full overflow-hidden bg-background font-sans text-foreground antialiased">
        <Script id="imd-theme-boot" strategy="beforeInteractive">
          {THEME_BOOT}
        </Script>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <ThemeToaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
