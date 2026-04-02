import type { Metadata } from "next";
import { Inter, Space_Grotesk, Geist, Poppins, Besley } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "highlight.js/styles/github.css";
import { Toaster } from "@/components/ui/sonner" // react-toastify
import { cn } from "@/lib/utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/context/auth-context";


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

const besley = Besley({
  subsets: ["latin"],
  variable: "--font-besley",
  weight: ["400", "500", "600", "700", "800"],
});

// export const metadata: Metadata = {
//   title: "SouvenirAI",
//   description: "An intuitive AI collaboration platform.",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Analytics tag added*/}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-BH0MSN0Z1J"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-BH0MSN0Z1J');
          `}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          "font-body antialiased",
          poppins.variable,
          inter.variable,
          spaceGrotesk.variable,
          geist.variable,
          besley.variable,
        )}
      >
        <AuthProvider>
          <SidebarProvider>
            {children}
            <Toaster />
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
