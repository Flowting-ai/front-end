import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth0Mocks = vi.hoisted(() => {
  process.env.SERVER_URL = "https://api.getsouvenir.test";
  return {
    getSession: vi.fn(),
    middleware: vi.fn(),
    getAccessToken: vi.fn(),
  };
});

vi.mock("@/lib/auth0", () => ({
  auth0: auth0Mocks,
}));

import proxy from "./proxy";

describe("proxy invite authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth0Mocks.getSession.mockResolvedValue(null);
  });

  it.each([
    "/team-invite/invite-123",
    "/onboarding/team/invite-123",
  ])("redirects a logged-out invitee from %s to Auth0", async (pathname) => {
    const response = await proxy(
      new NextRequest(`https://app.getsouvenir.com${pathname}`),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `https://app.getsouvenir.com/auth/login?returnTo=${encodeURIComponent(pathname)}`,
    );
    expect(auth0Mocks.middleware).not.toHaveBeenCalled();
  });

  it("redirects a stale session that cannot provide an access token", async () => {
    auth0Mocks.getSession.mockResolvedValue({ user: { sub: "auth0|invitee" } });
    auth0Mocks.getAccessToken.mockRejectedValue({ code: "missing_session" });
    const pathname = "/team-invite/invite-123";

    const response = await proxy(
      new NextRequest(`https://app.getsouvenir.com${pathname}`),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `https://app.getsouvenir.com/auth/login?returnTo=${encodeURIComponent(pathname)}`,
    );
    expect(auth0Mocks.middleware).not.toHaveBeenCalled();
  });
});

describe("proxy Slack Connect landing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth0Mocks.getSession.mockResolvedValue({ user: { sub: "auth0|slack-newcomer" } });
    auth0Mocks.getAccessToken.mockResolvedValue({ token: "token" });
    auth0Mocks.middleware.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ onboarding: { completed: false } }), { status: 200 }),
      ),
    );
  });

  it("lets an un-onboarded newcomer reach /slack/link with its state", async () => {
    const response = await proxy(
      new NextRequest("https://app.getsouvenir.com/slack/link?state=signed"),
    );

    expect(response.status).toBe(200);
    expect(auth0Mocks.middleware).toHaveBeenCalled();
  });

  it("still sends them into onboarding anywhere else", async () => {
    const response = await proxy(new NextRequest("https://app.getsouvenir.com/chat"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.getsouvenir.com/onboarding/setup",
    );
  });
});
