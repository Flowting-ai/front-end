import type { Metadata } from "next";
import { Geist, Geist_Mono, Google_Sans } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { Toaster } from "@/components/Toast";
import { MotionProvider } from "@/components/MotionProvider";
import { MixpanelProvider } from "@/components/Analytics/MixpanelProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { SearchFieldRing } from "@/components/SearchFieldRing";
import { ThemeProvider } from "@/context/theme-context";
import { THEMING_ENABLED } from "@/lib/feature-flags";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Performance setup (all through next/font, so every file is downloaded at build time and served
// from our own origin: no runtime request to Google, no extra DNS/TLS handshake):
//   • Variable fonts, latin subset only → ONE small woff2 per family covers every weight, instead of
//     a file per weight. Geist ≈ 29 KB, Google Sans ≈ 35 KB.
//   • Geist (body/UI/AI output) and Google Sans (titles, greeting) are used above the fold, so both
//     are preloaded (<link rel=preload>) and arrive with the first HTML.
//   • Geist Mono is only for code, which is rarely on screen at load: preload is OFF, so nothing is
//     fetched until a code block actually renders (the browser downloads a face on first use).
//   • display: swap with a size-adjusted fallback (next/font generates 'Geist Fallback' from Arial
//     metrics) so text paints immediately and swapping in Geist does not shift layout.
// The generated variables back the KDS tokens in styles/tokens/typography.css.

const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-google-sans",
  display: "swap",
  adjustFontFallback: false, // no metrics for Google Sans in next/font, so no generated fallback
  fallback: ["system-ui", "sans-serif"],
});

const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-geist",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
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
      className={`h-full ${googleSans.variable} ${geist.variable} ${geistMono.variable}`}
      // The theme init script may set data-theme before React hydrates; only
      // relevant (and only enabled) when theming is on.
      suppressHydrationWarning={THEMING_ENABLED || undefined}
    >
      {THEMING_ENABLED && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
      )}
      <body className="h-full antialiased" suppressHydrationWarning>
        <SearchFieldRing />
        <ThemeProvider>
          <QueryProvider>
            <MotionProvider>
              <AuthProvider>
                <MixpanelProvider>{children}</MixpanelProvider>
              </AuthProvider>
              <Toaster />
            </MotionProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
