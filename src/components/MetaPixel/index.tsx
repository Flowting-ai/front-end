"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

// Meta (Facebook) Pixel base code, ported to next/script.
//
// Why this is more than a copy-paste of the standard snippet:
// this app is a Next.js App Router SPA. The inline base code fires a single
// `PageView` on the initial hard load. Client-side navigations (the usual way
// users move between /onboarding, /chat, conversion pages, …) do NOT reload the
// document, so the raw snippet never reports those routes. URL-based Custom
// Conversions keyed to a path reached via in-app navigation would silently
// never fire. The pathname effect below re-emits `PageView` on every
// client-side navigation so those conversions actually register.
//
//
// IMPORTANT
// TODO(privacy): Gate behind cookie consent before we have EU/UK users.
// This component currently loads the pixel for ALL visitors, including on
// authenticated routes (/chat, /project/[id], /brain, billing). Under GDPR
// the pixel must not fire until the user opts in. When that time comes,
// return null here until a consent flag is set (e.g. only render <Script>
// and re-fire PageView once the user has accepted marketing cookies).

const PIXEL_ID = "2024023138203691";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function MetaPixel() {
  const pathname = usePathname();
  // The inline script already fires PageView for the first (initial) route.
  // Skip the first effect run so that load isn't double-counted.
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
