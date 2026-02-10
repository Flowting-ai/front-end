import type { Metadata } from "next";
import { Inter, Space_Grotesk, Geist, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/context/auth-context";
import { TokenProvider } from "@/context/token-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", weight: ["100","200","300", "400", "500", "600", "700", "800", "900"], });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
});
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FlowtingAI",
  description: "An intuitive AI collaboration platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          "font-body antialiased",
          poppins.variable,
          inter.variable,
          spaceGrotesk.variable,
          geist.variable,
        )}
      >
        <AuthProvider>
          <TokenProvider>
            <SidebarProvider>
              {children}
              <Toaster />
            </SidebarProvider>
          </TokenProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
