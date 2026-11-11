import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";
import createBundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isDev = process.env.NODE_ENV === "development";

// Only expand Turbopack's root to the monorepo parent when the sibling
// design-system/ package is actually checked out. Without that package on
// disk, the override breaks resolution of in-project CSS @imports
// (tailwindcss, ../styles/tokens/*.css resolve against the parent dir).
const monorepoRoot = path.resolve(__dirname, "..");
const hasDesignSystemSibling = existsSync(path.join(monorepoRoot, "design-system"));

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

const mapStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
let mapStyleOrigin = "https://tiles.openfreemap.org";
try {
  mapStyleOrigin = new URL(mapStyleUrl).origin;
} catch {
  // The client will surface an invalid configured style; keep the default CSP
  // origin rather than weakening connect-src when deployment config is bad.
}

// Library files live in object storage. The browser uploads parts to it and previews/plays files from
// short-lived presigned URLs, so its origin must be allowed to connect (part PUTs, pdf.js fetches) and
// to serve media (audio). Unset until the Library backend is deployed: nothing changes without it.
const rawLibraryStorage = process.env.NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN;
let libraryStorageOrigin = "";
if (rawLibraryStorage) {
  try {
    libraryStorageOrigin = new URL(rawLibraryStorage).origin;
  } catch {
    // An invalid value is ignored rather than weakening the policy.
  }
}

const connectSrcParts = [
  "'self'",
  // The mock Library API hands out blob: download URLs; "Ask about this file" fetches them to attach the file.
  ...(isDev ? ["blob:"] : []),
  backendOrigin,
  backendWsOrigin,
  ...(auth0Domain ? [auth0Domain] : ["https://*.us.auth0.com"]),
  "https://*.mixpanel.com",
  "https://formspree.io",
  mapStyleOrigin,
  ...(libraryStorageOrigin ? [libraryStorageOrigin] : []),
];

if (isDev) {
  connectSrcParts.push("http://localhost:*", "ws://localhost:*");
}

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Next.js 16's proxy (formerly middleware) auto-buffers/clones every
  // request body it sees so both proxy and the route handler can read it —
  // capped at 10MB by default. front-end/src/proxy.ts's matcher covers
  // /api/chat (no file extension in the path), so a chat message with an
  // attached file over ~10MB was silently truncated mid-multipart-body by
  // the proxy layer itself — Next.js never rejects the oversized request,
  // it just hands the route handler a truncated body, whose
  // request.formData() call then throws on the corrupt/incomplete multipart
  // data. That's the "Bad Request: invalid form data" 400 from
  // src/app/api/chat/route.ts. Raised to match this app's own client-side
  // attachment ceiling (FILE_CONSTRAINTS in use-file-upload.ts: 30MB × up to
  // 10 files/message) so the proxy layer never truncates anything the
  // upload UI itself already allowed through.
  experimental: {
    proxyClientMaxBodySize: '320mb',
  },

  ...(hasDesignSystemSibling
    ? {
        turbopack: {
          // Expand the root to the monorepo root so Turbopack can resolve CSS
          // @imports that reach into the sibling design-system/ package.
          root: monorepoRoot,
        },
      }
    : {}),

  // Re-export server-only env vars to the client bundle.
  // AUTH0_AUDIENCE is read by jwt-utils.ts (getAccessToken call).
  // SERVER_URL is read by lib/config.ts (directUpload) and the proxy route handler.
  // NEXT_PUBLIC_SERVER_URL is the client-safe alias — using NEXT_PUBLIC_ prefix ensures
  // Next.js reliably inlines it at build time regardless of version-specific env block behavior.
  env: {
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
    SERVER_URL: process.env.SERVER_URL,
    NEXT_PUBLIC_SERVER_URL: process.env.SERVER_URL,
  },

  // NOTE: client-side API requests are proxied via the streaming route
  // handler at `src/app/api/backend/[...path]/route.ts`, not a `rewrites()`
  // rule. Rewrites cause `next dev` (Turbopack) to buffer chunked responses,
  // which broke SSE. The route handler streams both directions
  // and works identically in dev and production.

  async redirects() {
    return [
      // Legacy Stripe cancel_url — the env-default pointed here but the page never existed.
      // Redirect to plans so old sessions and any un-updated backend envs don't 404.
      {
        source: '/onboarding/pricing',
        destination: '/onboarding/plans?type=team',
        permanent: false,
      },
      // /settings/connectors was removed — ORG_CONNECTORS_ROUTE (/connectors)
      // is now the only entry point for every account type. Redirect any
      // stale bookmarks/links instead of 404ing.
      {
        // Legacy /org/* admin pages moved under /settings (the stub pages that
        // redirected client-side are gone). /org/change-plan is still a route.
        source: '/org',
        destination: '/settings/general',
        permanent: true,
      },
      { source: '/org/general',   destination: '/settings/general',           permanent: true },
      { source: '/org/members',   destination: '/settings/members',           permanent: true },
      { source: '/org/plans',     destination: '/settings/plans-and-billing', permanent: true },
      { source: '/org/analytics', destination: '/settings/analytics',         permanent: true },
      { source: '/org/activity',  destination: '/settings/activity',          permanent: true },
      {
        source: '/settings/connectors',
        destination: '/connectors',
        permanent: true,
      },
      // Brain merged into chat: its chats are plain chats now, so /brain?id=…
      // lands on /chat?id=… (query strings carry through).
      {
        source: '/brain/schedules',
        destination: '/schedules',
        permanent: true,
      },
      {
        source: '/brain/:rest+',
        destination: '/chats',
        permanent: true,
      },
      {
        source: '/brain',
        destination: '/chat',
        permanent: true,
      },
    ]
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
              // The driven browser plays as a MediaSource, which is a blob: URL.
              `media-src 'self' blob:${libraryStorageOrigin ? ` ${libraryStorageOrigin}` : ""}`,
              // 'unsafe-inline' covers Next's inline bootstrap and the theme init script;
              // nonces would remove it (decision D3). No third-party script origins:
              // Google Tag Manager was allowed but never loaded, so it is gone.
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              `connect-src ${connectSrcParts.join(" ")}`,
              "font-src 'self'",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              // No plugins, no <base> hijacking, forms only post to us or Auth0.
              "object-src 'none'",
              "base-uri 'self'",
              `form-action 'self'${auth0Domain ? ` ${auth0Domain}` : " https://*.us.auth0.com"}`,
            ].join("; "),
          },
        ],
      },
      // The stored-template HTML is the one response in this app that is
      // *meant* to be framed — /template/<uuid> renders it in a sandboxed
      // <iframe>. The app-wide rule above sends X-Frame-Options: DENY and
      // frame-ancestors 'none', and a browser enforces every CSP it is sent,
      // so without this override the frame is refused before the request is
      // even made. A later rule setting the same key wins, so this replaces
      // both framing headers for this path only.
      //
      // What replaces them is stricter about the document itself: `sandbox`
      // with no allow-same-origin puts the model-written HTML on an opaque
      // origin, so its own scripts still run — charts, filters, drill-downs —
      // but it cannot reach this app's session or storage. frame-ancestors
      // 'self' keeps other sites from embedding it. Both hold on a direct
      // open, not just inside the frame.
      {
        source: "/api/template/:uuid*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: [
              "sandbox allow-scripts allow-popups allow-forms",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
