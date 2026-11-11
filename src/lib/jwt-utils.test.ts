import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearInMemoryAccessToken,
  decodeJwtPayload,
  decodeJwtSub,
  msUntilTokenRefresh,
  parseTokenExpiry,
  setInMemoryAccessToken,
} from "./jwt-utils";

vi.mock("@auth0/nextjs-auth0/client", () => ({ getAccessToken: vi.fn() }));

/** A JWT-shaped string with a base64url, unpadded payload, as Auth0 issues them. */
function jwt(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `header.${payload}.signature`;
}

describe("JWT decoding", () => {
  afterEach(() => {
    clearInMemoryAccessToken();
    vi.useRealTimers();
  });

  it("decodes base64url payloads that plain atob rejects", () => {
    // These claims encode with both '-' and '_' and need padding.
    const claims = { sub: "auth0|>>>???", exp: 1_900_000_000, x: "~~~" };
    const token = jwt(claims);
    expect(token.split(".")[1]).toMatch(/[-_]/);
    expect(decodeJwtPayload(token)).toEqual(claims);
    expect(decodeJwtSub(token)).toBe("auth0|>>>???");
    expect(parseTokenExpiry(token)).toBe(1_900_000_000);
  });

  it("decodes UTF-8 claims", () => {
    expect(decodeJwtPayload(jwt({ name: "Zoë 名前" }))?.name).toBe("Zoë 名前");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload("nodots")).toBeNull();
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
    expect(decodeJwtSub(jwt({ sub: "" }))).toBeNull();
  });

  it("schedules the refresh 60 s before expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000 * 1000);
    setInMemoryAccessToken(jwt({ exp: 1_000_000 + 600 }));
    expect(msUntilTokenRefresh()).toBe(540_000);
    setInMemoryAccessToken(jwt({ exp: 1_000_000 + 30 }));
    expect(msUntilTokenRefresh()).toBe(0);
    setInMemoryAccessToken(null);
    expect(msUntilTokenRefresh()).toBe(0);
  });
});
