import type { NextConfig } from "next";

const backendUrl = new URL(process.env.SERVER_URL!);
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
    // Allow images from any HTTPS remote URL (e.g. citation cards, link previews)
    { protocol: "https", hostname: "**", pathname: "/**" },
  ];

// Build CSP connect-src with backend origins
const auth0Domain = process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}` : "";
const connectSrcOrigins = [backendOrigin, backendWsOrigin, "https://app.flowtingai.com", ...(auth0Domain ? [auth0Domain] : ["https://*.us.auth0.com"])];

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
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com"
    : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net ${connectSrcOrigins.join(" ")}`,
  "img-src 'self' data: blob: https: http: https://www.google-analytics.com https://www.googletagmanager.com",
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
  env: {
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
    SERVER_URL: process.env.SERVER_URL,
  },
  images: {
    unoptimized: true,
    remotePatterns: backendRemotePattern,
    //adding the below two lines to fix logo svg file issues
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    // the above 2 lines allow SVG images to be loaded and displayed inline rather than as a download
  },
  async redirects() {
    return [
      // Legacy /chat/:id → removed (no chat sharing)
      {
        source: '/chat/:chatId',
        destination: '/',
        permanent: true,
      },
      // Legacy /personaAdmin → /personas/admin
      {
        source: '/personaAdmin',
        destination: '/personas/admin',
        permanent: true,
      },
      {
        source: '/personaAdmin/chat/:personaId',
        destination: '/personas/:personaId/chat',
        permanent: true,
      },
      {
        source: '/personaAdmin/:path*',
        destination: '/personas/admin/:path*',
        permanent: true,
      },
      // Legacy /personas/admin/chat/:id → /personas/:id/chat
      {
        source: '/personas/admin/chat/:personaId',
        destination: '/personas/:personaId/chat',
        permanent: true,
      },
      // Legacy /workflowAdmin → /workflows/admin
      {
        source: '/workflowAdmin',
        destination: '/workflows/admin',
        permanent: true,
      },
      {
        source: '/workflowAdmin/chat/:workflowId',
        destination: '/workflows/:workflowId/chat',
        permanent: true,
      },
      {
        source: '/workflowAdmin/:path*',
        destination: '/workflows/admin/:path*',
        permanent: true,
      },
      // Legacy /workflows/admin/chat/:id → /workflows/:id/chat
      {
        source: '/workflows/admin/chat/:workflowId',
        destination: '/workflows/:workflowId/chat',
        permanent: true,
      },
    ];
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

