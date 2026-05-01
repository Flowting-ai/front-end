import type { Metadata } from "next";
import { Besley, Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

// ── Fonts ─────────────────────────────────────────────────────────────────────
// All three are variable-weight fonts → single file covers every weight.
// `variable` maps to the KDS token names so components can use
// `font-family: var(--font-title | --font-body | --font-code)` directly.

const besley = Besley({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-title",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-body",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-code",
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
      className={`h-full ${besley.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body className="h-full antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
