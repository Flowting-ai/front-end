import type { NextConfig } from "next";

const DEFAULT_BACKEND_URL = "https://jellyfish-app-7brqd.ondigitalocean.app";

const getBackendUrl = () => {
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_HOST_URL ??
    DEFAULT_BACKEND_URL;

  try {
    return new URL(raw);
  } catch {
    return new URL(DEFAULT_BACKEND_URL);
  }
};

const backendUrl = getBackendUrl();
const backendOrigin = backendUrl.origin;
const backendWsOrigin = `${
  backendUrl.protocol === "https:" ? "wss" : "ws"
}://${backendUrl.host}`;

const backendRemotePattern: NonNullable<NextConfig["images"]>["remotePatterns"] =
  [
    {
      protocol: backendUrl.protocol.replace(":", "") as "http" | "https",
      hostname: backendUrl.hostname,
      ...(backendUrl.port ? { port: backendUrl.port } : {}),
      pathname: "/media/**",
    },
    {
      protocol: "https",
      hostname: "sfo3.digitaloceanspaces.com",
      pathname: "/**",
    },
    // Allow images from any remote URL (e.g. citation cards, link previews)
    { protocol: "https", hostname: "**", pathname: "/**" },
    { protocol: "http", hostname: "**", pathname: "/**" },
  ];

// Build CSP connect-src with backend origins
const connectSrcOrigins = [backendOrigin, backendWsOrigin];

// In development, also allow localhost connections
if (process.env.NODE_ENV === "development") {
  connectSrcOrigins.push(
    "http://localhost:8000",
    "ws://localhost:8000",
    "http://localhost:*",
    "ws://localhost:*"
  );
}

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-inline needed for Next.js, consider nonce-based CSP
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  `connect-src 'self' ${connectSrcOrigins.join(" ")}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
];

if (process.env.NODE_ENV === "production") {
  cspDirectives.push("upgrade-insecure-requests");
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: backendRemotePattern,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: cspDirectives.join('; ')
          }
        ],
      },
    ];
  },
};

export default nextConfig;

