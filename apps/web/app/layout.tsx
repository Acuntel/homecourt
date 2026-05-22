import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { WsProvider } from "@/components/providers/ws-provider";
import { cn } from "@/lib/utils";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://homecourt.markets"),
  title: { default: "HOMECOURT", template: "%s · HOMECOURT" },
  description:
    "Trade the price of every house in America. Sweepstakes prediction markets for residential real estate.",
  openGraph: {
    type: "website",
    siteName: "HOMECOURT",
    images: ["/og-default.png"],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#080A0E" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(inter.variable, jetbrains.variable)}>
      <body className="bg-background text-foreground antialiased">
        <a
          href="#main"
          className="focus:bg-card sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        >
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <WsProvider>
              <Toaster richColors closeButton position="top-right" theme="dark" />
              {children}
            </WsProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
