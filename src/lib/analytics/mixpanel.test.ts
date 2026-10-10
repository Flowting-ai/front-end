import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Contract tests for the Mixpanel wrapper (src/lib/analytics/mixpanel.ts).
//
// The wrapper is the only module that touches the SDK. These tests pin the behaviour the
// rest of the app relies on, independent of *when* the SDK is loaded: calls reach the SDK
// in order, nothing happens without a token or before init, and a failing SDK never throws.

type Mp = {
  init: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  set_group: ReturnType<typeof vi.fn>;
  people: { set: ReturnType<typeof vi.fn> };
};

const makeMp = (): Mp => ({
  init: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  set_group: vi.fn(),
  people: { set: vi.fn() },
});

async function load(opts: { enabled?: boolean; mp?: Mp } = {}) {
  const { enabled = true } = opts;
  const mp = opts.mp ?? makeMp();
  vi.resetModules();
  vi.doMock("mixpanel-browser", () => ({ default: mp }));
  vi.doMock("@/lib/config", () => ({
    mixpanelToken: enabled ? "test-token" : "",
    analyticsEnabled: enabled,
  }));
  const mod = await import("./mixpanel");
  return { mod, mp };
}

// Lets any deferred SDK load / idle callback run. A no-op for synchronous implementations.
async function settle() {
  await vi.advanceTimersByTimeAsync(5000);
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(0);
}

describe("mixpanel wrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.doUnmock("mixpanel-browser");
    vi.doUnmock("@/lib/config");
  });

  it("initialises the SDK once with the first-party proxy, autocapture off, and registers the surface stamp", async () => {
    const { mod, mp } = await load();
    mod.initAnalytics();
    mod.initAnalytics();
    await settle();
    expect(mp.init).toHaveBeenCalledTimes(1);
    const [token, config] = mp.init.mock.calls[0];
    expect(token).toBe("test-token");
    expect(config).toMatchObject({
      api_host: "/dispatch",
      autocapture: false,
      track_pageview: false,
      persistence: "localStorage",
      record_sessions_percent: 0,
      api_routes: { track: "evt", engage: "usr", groups: "grp", record: "record", flags: "flags" },
    });
    expect(mp.register).toHaveBeenCalledWith({ surface: "web" });
  });

  it("forwards tracked events with their properties", async () => {
    const { mod, mp } = await load();
    mod.initAnalytics();
    await settle();
    mod.track("screen_viewed", { screen: "chat" });
    mod.track("feature_used");
    await settle();
    expect(mp.track).toHaveBeenNthCalledWith(1, "screen_viewed", { screen: "chat" });
    expect(mp.track).toHaveBeenNthCalledWith(2, "feature_used", undefined);
  });

  it("does nothing before initAnalytics() is called", async () => {
    const { mod, mp } = await load();
    mod.track("early_event");
    mod.identifyUser("auth0|1");
    await settle();
    expect(mp.track).not.toHaveBeenCalled();
    expect(mp.identify).not.toHaveBeenCalled();
    expect(mp.init).not.toHaveBeenCalled();
  });

  it("is a full no-op when there is no token", async () => {
    const { mod, mp } = await load({ enabled: false });
    mod.initAnalytics();
    mod.track("e");
    mod.identifyUser("auth0|1");
    mod.registerStamps({ plan: "pro" });
    mod.setPeople({ a: 1 });
    mod.setOrgGroup("org1");
    mod.resetAnalytics();
    await settle();
    expect(mp.init).not.toHaveBeenCalled();
    expect(mp.track).not.toHaveBeenCalled();
    expect(mp.identify).not.toHaveBeenCalled();
    expect(mp.register).not.toHaveBeenCalled();
    expect(mp.reset).not.toHaveBeenCalled();
  });

  it("delivers identity, stamps, people, group and reset calls to the SDK", async () => {
    const { mod, mp } = await load();
    mod.initAnalytics();
    await settle();
    mod.identifyUser("auth0|123");
    mod.registerStamps({ plan: "pro" });
    mod.clearStamps(["org_id", "org_tier"]);
    mod.setPeople({ plan: "pro" });
    mod.setOrgGroup("org_9");
    mod.resetAnalytics();
    await settle();
    expect(mp.identify).toHaveBeenCalledWith("auth0|123");
    expect(mp.register).toHaveBeenCalledWith({ plan: "pro" });
    expect(mp.unregister).toHaveBeenCalledWith("org_id");
    expect(mp.unregister).toHaveBeenCalledWith("org_tier");
    expect(mp.people.set).toHaveBeenCalledWith({ plan: "pro" });
    expect(mp.set_group).toHaveBeenCalledWith("org_id", "org_9");
    expect(mp.reset).toHaveBeenCalledTimes(1);
    // reset re-registers the constant surface stamp afterwards
    const lastRegister = mp.register.mock.calls[mp.register.mock.calls.length - 1];
    expect(lastRegister[0]).toEqual({ surface: "web" });
  });

  it("ignores identify with an empty id and group with an empty org id", async () => {
    const { mod, mp } = await load();
    mod.initAnalytics();
    await settle();
    mod.identifyUser("");
    mod.setOrgGroup("");
    await settle();
    expect(mp.identify).not.toHaveBeenCalled();
    expect(mp.set_group).not.toHaveBeenCalled();
  });

  it("keeps call order: identify happens before later register/people calls", async () => {
    const { mod, mp } = await load();
    const order: string[] = [];
    mp.identify.mockImplementation(() => order.push("identify"));
    mp.register.mockImplementation((p: Record<string, unknown>) => order.push(`register:${Object.keys(p)[0]}`));
    mp.people.set.mockImplementation(() => order.push("people"));
    mod.initAnalytics();
    mod.identifyUser("auth0|1");
    mod.registerStamps({ plan: "pro" });
    mod.setPeople({ plan: "pro" });
    await settle();
    expect(order).toEqual(["register:surface", "identify", "register:plan", "people"]);
  });

  it("never throws when the SDK throws", async () => {
    const mp = makeMp();
    mp.track.mockImplementation(() => {
      throw new Error("boom");
    });
    mp.identify.mockImplementation(() => {
      throw new Error("boom");
    });
    const { mod } = await load({ mp });
    mod.initAnalytics();
    await settle();
    expect(() => mod.track("e")).not.toThrow();
    expect(() => mod.identifyUser("auth0|1")).not.toThrow();
    await settle();
  });

  it("survives an SDK init failure and stays inert afterwards", async () => {
    const mp = makeMp();
    mp.init.mockImplementation(() => {
      throw new Error("init failed");
    });
    const { mod } = await load({ mp });
    expect(() => mod.initAnalytics()).not.toThrow();
    await settle();
    mod.track("e");
    await settle();
    expect(mp.track).not.toHaveBeenCalled();
  });
});

describe("mixpanel wrapper: deferred SDK loading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.doUnmock("mixpanel-browser");
    vi.doUnmock("@/lib/config");
  });

  it("does not load or initialise the SDK synchronously inside initAnalytics()", async () => {
    const { mod, mp } = await load();
    mod.initAnalytics();
    expect(mp.init).not.toHaveBeenCalled();
    await settle();
    expect(mp.init).toHaveBeenCalledTimes(1);
  });

  it("waits for an idle moment when requestIdleCallback is available", async () => {
    const idle = vi.fn();
    vi.stubGlobal("window", { requestIdleCallback: idle });
    const { mod, mp } = await load();
    mod.initAnalytics();
    expect(idle).toHaveBeenCalledTimes(1);
    expect(idle.mock.calls[0][1]).toEqual({ timeout: 1500 });
    await settle();
    expect(mp.init).not.toHaveBeenCalled();
    // run the idle callback the browser would have run
    idle.mock.calls[0][0]();
    await settle();
    expect(mp.init).toHaveBeenCalledTimes(1);
  });

  it("replays calls made while the SDK was loading, in order, after the surface stamp", async () => {
    const { mod, mp } = await load();
    const seen: string[] = [];
    mp.register.mockImplementation((p: Record<string, unknown>) => seen.push(`register:${Object.keys(p)[0]}`));
    mp.track.mockImplementation((e: string) => seen.push(`track:${e}`));
    mp.identify.mockImplementation((id: string) => seen.push(`identify:${id}`));
    mod.initAnalytics();
    mod.track("first");
    mod.identifyUser("auth0|1");
    mod.track("second");
    expect(seen).toEqual([]);
    await settle();
    expect(seen).toEqual(["register:surface", "track:first", "identify:auth0|1", "track:second"]);
  });

  it("calls made after the SDK is ready go straight through", async () => {
    const { mod, mp } = await load();
    mod.initAnalytics();
    await settle();
    mod.track("direct");
    expect(mp.track).toHaveBeenCalledWith("direct", undefined);
  });

  it("never imports the SDK when analytics is disabled", async () => {
    let imported = 0;
    vi.resetModules();
    vi.doMock("mixpanel-browser", () => {
      imported += 1;
      return { default: makeMp() };
    });
    vi.doMock("@/lib/config", () => ({ mixpanelToken: "", analyticsEnabled: false }));
    const mod = await import("./mixpanel");
    mod.initAnalytics();
    mod.track("e");
    await settle();
    expect(imported).toBe(0);
  });

  it("imports the SDK exactly once however many times initAnalytics() is called", async () => {
    let imported = 0;
    vi.resetModules();
    vi.doMock("mixpanel-browser", () => {
      imported += 1;
      return { default: makeMp() };
    });
    vi.doMock("@/lib/config", () => ({ mixpanelToken: "t", analyticsEnabled: true }));
    const mod = await import("./mixpanel");
    mod.initAnalytics();
    mod.initAnalytics();
    mod.initAnalytics();
    await settle();
    expect(imported).toBe(1);
  });

  it("bounds the queue so a runaway caller cannot grow memory without limit", async () => {
    const { mod, mp } = await load();
    mod.initAnalytics();
    for (let i = 0; i < 500; i++) mod.track(`e${i}`);
    await settle();
    expect(mp.track.mock.calls.length).toBe(200);
    expect(mp.track.mock.calls[0][0]).toBe("e0");
  });
});
