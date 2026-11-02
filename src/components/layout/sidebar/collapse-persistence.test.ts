import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COLLAPSED_KEY } from "@/lib/storage-keys";

// Minimal document.cookie / localStorage stand-ins (vitest runs in node here).
// The cookie jar mimics the browser: assigning one `name=value; attrs` string
// sets just that cookie; reading returns "a=1; b=2".
function installBrowserStubs(initialCookies: Record<string, string> = {}, initialStorage: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initialCookies));
  const writes: string[] = [];
  const store = new Map(Object.entries(initialStorage));
  vi.stubGlobal("document", {
    get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(s: string) {
      writes.push(s);
      const [pair] = s.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  });
  return { jar, writes, store };
}

// sessionCollapsed is module state, so each test gets a fresh module.
async function load() {
  vi.resetModules();
  return import("./collapse-persistence");
}

describe("collapse persistence", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("writeCollapsed sets the session value, the cookie and localStorage", async () => {
    const { writes, store } = installBrowserStubs();
    const mod = await load();
    expect(mod.getSessionCollapsed()).toBeUndefined();
    mod.writeCollapsed(true);
    expect(mod.getSessionCollapsed()).toBe(true);
    expect(writes).toEqual([`${SIDEBAR_COLLAPSED_KEY}=true; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`]);
    expect(store.get(SIDEBAR_COLLAPSED_KEY)).toBe("true");
    mod.writeCollapsed(false);
    expect(mod.getSessionCollapsed()).toBe(false);
    expect(store.get(SIDEBAR_COLLAPSED_KEY)).toBe("false");
  });

  it("migrates a localStorage-only preference into the cookie", async () => {
    const { jar, writes } = installBrowserStubs({ other: "x" }, { [SIDEBAR_COLLAPSED_KEY]: "true" });
    const mod = await load();
    mod.migrateCollapsedCookie();
    expect(writes).toHaveLength(1);
    expect(jar.get(SIDEBAR_COLLAPSED_KEY)).toBe("true");
    // Migration never touches the session value.
    expect(mod.getSessionCollapsed()).toBeUndefined();
  });

  it("leaves an existing cookie alone", async () => {
    const { writes } = installBrowserStubs({ [SIDEBAR_COLLAPSED_KEY]: "false" }, { [SIDEBAR_COLLAPSED_KEY]: "true" });
    const mod = await load();
    mod.migrateCollapsedCookie();
    expect(writes).toHaveLength(0);
  });

  it("does nothing when there is no stored preference", async () => {
    const { writes } = installBrowserStubs();
    const mod = await load();
    mod.migrateCollapsedCookie();
    expect(writes).toHaveLength(0);
  });

  it("does not mistake a cookie whose name merely starts with the key", async () => {
    const { jar } = installBrowserStubs({ [`${SIDEBAR_COLLAPSED_KEY}_old`]: "1" }, { [SIDEBAR_COLLAPSED_KEY]: "false" });
    const mod = await load();
    mod.migrateCollapsedCookie();
    expect(jar.get(SIDEBAR_COLLAPSED_KEY)).toBe("false");
  });
});
