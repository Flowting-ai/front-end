import type { Metadata } from "next";
import { Besley, Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { Toaster } from "@/components/Toast";
import { MotionProvider } from "@/components/MotionProvider";
import { MetaPixel } from "@/components/MetaPixel";
import { MixpanelProvider } from "@/components/Analytics/MixpanelProvider";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

// ── Fonts ─────────────────────────────────────────────────────────────────────
// All three are variable-weight fonts → single file covers every weight.
// `variable` maps to the KDS token names so components can use
// `font-family: var(--font-title | --font-body | --font-code)` directly.
//
// `display: "optional"`, not "swap" — measured via Lighthouse's own
// `layout-shifts` audit (docs v2/performance report/projects/
// 04b-projects-performance-scan.md §10): with "swap", the metrics-matched
// fallback (Times New Roman/Arial, via next/font's automatic ascent/descent/
// size-adjust overrides) still reflows when the real font swaps in, because
// those overrides correct vertical metrics only — different glyphs' advance
// widths between the fallback and the real family still change how text
// wraps, so the swap itself was ~100% of the measured CLS on every page that
// renders enough text to wrap. "optional" tells the browser to skip the swap
// entirely on any render where the font isn't already cached (no reflow),
// falling back to the metrics-matched font for that view and picking up the
// real font on the next navigation once it's cached — an accepted trade-off
// per Next.js's own font-optimization guidance for exactly this case, and
// low-risk here since these are same-origin self-hosted files.
const besley = Besley({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-title",
  display: "optional",
});

const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-body",
  display: "optional",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-code",
  display: "optional",
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "SouvenirAI",
  description: "Your AI-powered souvenir companion",
};

// ── Root Layout ───────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full ${besley.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body className="h-full antialiased" suppressHydrationWarning>
        <MetaPixel />
        <QueryProvider>
          <MotionProvider>
            <AuthProvider>
              <MixpanelProvider>{children}</MixpanelProvider>
            </AuthProvider>
            <Toaster />
          </MotionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
