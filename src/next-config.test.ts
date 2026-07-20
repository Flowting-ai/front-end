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
});
