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

  it("sends an email login onto a Slack-made account through Slack login", async () => {
    auth0Mocks.getSession.mockResolvedValue({ user: { sub: "google-oauth2|ada" } });
    auth0Mocks.getAccessToken.mockResolvedValue({ token: "jwt" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "slack_login_required" }), { status: 409 }),
    );

    const response = await proxy(new NextRequest("https://app.getsouvenir.com/"));

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("connection")).toBe("sign-in-with-slack");
    expect(location.searchParams.get("returnTo")).toBe("/");
    fetchMock.mockRestore();
  });
});
