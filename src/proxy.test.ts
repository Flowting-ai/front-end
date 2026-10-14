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
import { determineNextOnboardingPath } from "@/lib/onboarding-gate";
import { parseUserMeGate } from "@/lib/api/user-me-schema";

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

describe("proxy onboarding gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth0Mocks.getAccessToken.mockResolvedValue({ token: "token" });
    auth0Mocks.middleware.mockResolvedValue(new Response(null, { status: 200 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  const notOnboarded = () =>
    new Response(JSON.stringify({ data: { onboarding: { completed: false } } }), { status: 200 });

  it("fails open when /users/me times out", async () => {
    auth0Mocks.getSession.mockResolvedValue({ user: { sub: "auth0|timeout" } });
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    const response = await proxy(new NextRequest("https://app.getsouvenir.com/chat"));

    expect(response.status).toBe(200);
    expect(auth0Mocks.middleware).toHaveBeenCalled();
  });

  it("fails open on a 5xx from /users/me", async () => {
    auth0Mocks.getSession.mockResolvedValue({ user: { sub: "auth0|five-hundred" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const response = await proxy(new NextRequest("https://app.getsouvenir.com/chat"));

    expect(response.status).toBe(200);
  });

  it("bounds the /users/me call with a timeout signal", async () => {
    auth0Mocks.getSession.mockResolvedValue({ user: { sub: "auth0|signal" } });
    const fetchMock = vi.fn().mockResolvedValue(notOnboarded());
    vi.stubGlobal("fetch", fetchMock);

    await proxy(new NextRequest("https://app.getsouvenir.com/chat"));

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("honours the checkout cookie only with the exact value", async () => {
    auth0Mocks.getSession.mockResolvedValue({ user: { sub: "auth0|checkout" } });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => notOnboarded()));

    const lookalike = await proxy(
      new NextRequest("https://app.getsouvenir.com/chat", {
        headers: { cookie: "x_souvenir_checkout_complete=1" },
      }),
    );
    expect(lookalike.status).toBe(302);

    const real = await proxy(
      new NextRequest("https://app.getsouvenir.com/chat", {
        headers: { cookie: "souvenir_checkout_complete=1" },
      }),
    );
    expect(real.status).toBe(200);
    expect(real.headers.get("set-cookie")).toContain("souvenir_checkout_complete=;");
  });

  it("returns a JSON 401 for /api routes without a session", async () => {
    auth0Mocks.getSession.mockResolvedValue(null);

    const response = await proxy(new NextRequest("https://app.getsouvenir.com/api/backend/x"));

    expect(response.status).toBe(401);
  });
});

describe("determineNextOnboardingPath", () => {
  it.each([
    [{ pending_invite_id: "inv-1" }, "/onboarding/team/inv-1"],
    [{}, "/onboarding/setup"],
    [{ onboarding: { role_fit: "solo" } }, "/onboarding/profile"],
    [{ onboarding: { roleFit: "solo" }, first_name: "Ada", last_name: " " }, "/onboarding/profile"],
    [{ onboarding: { role_fit: "solo" }, first_name: "Ada", last_name: "Lovelace" }, "/onboarding/invite"],
  ])("%j → %s", (root, expected) => {
    expect(determineNextOnboardingPath(parseUserMeGate(root))).toBe(expected);
  });
});
