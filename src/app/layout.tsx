import type { Metadata } from "next";
import { Geist, Google_Sans, Manrope } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { Toaster } from "@/components/Toast";
import { MotionProvider } from "@/components/MotionProvider";
import { MetaPixel } from "@/components/MetaPixel";
import { MixpanelProvider } from "@/components/Analytics/MixpanelProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/context/theme-context";
import { THEMING_ENABLED } from "@/lib/feature-flags";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Both are variable-weight fonts → one file per family covers every weight.
// Generated font variables back the KDS tokens used by components.

const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-google-sans",
  display: "swap",
  adjustFontFallback: false,
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// AI-generated output (chat answers, task results) is set in Geist.
const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-geist",
  display: "swap",
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
      className={`h-full ${googleSans.variable} ${manrope.variable} ${geist.variable}`}
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
        <MetaPixel />
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
