import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("Next.js redirects", () => {
  it("does not bypass authentication for team invite links", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "/team-invite/:inviteId" }),
      ]),
    );
  });

  it("allows authenticated E2B live-browser frames", async () => {
    const headers = await nextConfig.headers?.();
    const csp = headers
      ?.flatMap((entry) => entry.headers)
      .find((header) => header.key === "Content-Security-Policy")
      ?.value;

    expect(csp).toContain("frame-src 'self' https://*.e2b.app");
  });
});
