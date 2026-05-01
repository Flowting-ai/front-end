import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV === "development";

// Build dynamic connect-src from env vars so the CSP tracks the actual tenant
// and backend origin rather than hardcoded wildcards.
const rawServerUrl = process.env.SERVER_URL || "http://localhost:8000";
const backendUrl = new URL(rawServerUrl);
const backendOrigin = backendUrl.origin;
const backendWsOrigin = `${backendUrl.protocol === "https:" ? "wss" : "ws"}://${backendUrl.host}`;

// Use the exact tenant domain when available, fall back to *.us.auth0.com for dev.
const auth0Domain = process.env.AUTH0_DOMAIN
  ? `https://${process.env.AUTH0_DOMAIN}`
  : "";

const connectSrcParts = [
  "'self'",
  backendOrigin,
  backendWsOrigin,
  ...(auth0Domain ? [auth0Domain] : ["https://*.us.auth0.com"]),
  "https://*.mixpanel.com",
];

if (isDev) {
  connectSrcParts.push("http://localhost:*", "ws://localhost:*");
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    // Expand the root to the monorepo root so Turbopack can resolve CSS
    // @imports that reach into the sibling design-system/ package.
    root: path.resolve(__dirname, ".."),
  },

  // Re-export server-only env vars to the client bundle.
  // AUTH0_AUDIENCE is read by jwt-utils.ts (getAccessToken call).
  // SERVER_URL is read by lib/config.ts (API_BASE_URL).
  env: {
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
    SERVER_URL: process.env.SERVER_URL,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              `connect-src ${connectSrcParts.join(" ")}`,
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
