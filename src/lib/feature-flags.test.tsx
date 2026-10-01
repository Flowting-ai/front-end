import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { PINS_ENABLED, HIGHLIGHTS_ENABLED, FeatureDisabledError } from "@/lib/feature-flags";
import { PinboardProvider, usePinboard, usePinboardActions } from "@/context/pinboard-context";
import { HighlightProvider, useHighlight } from "@/context/highlight-context";
import * as pinsApi from "@/lib/api/pins";
import * as highlightsApi from "@/lib/api/highlights";

// Pins (Pinboard) and Highlights are hidden behind feature flags. These tests
// pin that down: while a flag is off, nothing may be fetched, saved or opened —
// even if some UI entry point were added or restored by mistake. They are
// skipped for a feature when it has been deliberately re-enabled via env.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.skipIf(PINS_ENABLED)("Pins are hidden", () => {
  it("defaults to off", () => {
    expect(PINS_ENABLED).toBe(false);
  });

  it("every pins API call refuses to reach the backend", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(pinsApi.listPins()).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(pinsApi.listPinFolders()).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(pinsApi.createPin("m1")).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(pinsApi.deletePin("p1")).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(pinsApi.createPinFolder("f")).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(pinsApi.movePinToFolder("p1", "f1")).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(pinsApi.addPinComment("p1", "hi")).rejects.toBeInstanceOf(FeatureDisabledError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the provider is inert: empty, closed, and every action is a no-op", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    let ctx!: ReturnType<typeof usePinboard>;
    let actions!: ReturnType<typeof usePinboardActions>;
    function Probe() {
      ctx = usePinboard();
      actions = usePinboardActions();
      return null;
    }
    renderToString(
      <PinboardProvider>
        <Probe />
      </PinboardProvider>,
    );

    expect(ctx.pins).toEqual([]);
    expect(ctx.folders).toEqual([]);
    expect(ctx.isOpen).toBe(false);
    expect(ctx.isLoading).toBe(false);
    expect(ctx.isPinned("anything")).toBe(false);

    ctx.open();
    ctx.toggle();
    ctx.openForChat("c1");
    ctx.prefetch();
    actions.open();
    actions.addPin({ content: "x", title: "x", category: "Quote", messageId: "m1" });
    await ctx.clonePin({
      id: "p", content: "x", title: "x", category: "Quote", messageId: "m1", createdAt: "",
    });

    expect(ctx.isOpen).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe.skipIf(HIGHLIGHTS_ENABLED)("Highlights are hidden", () => {
  it("defaults to off", () => {
    expect(HIGHLIGHTS_ENABLED).toBe(false);
  });

  it("every highlights API call refuses to reach the backend", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(highlightsApi.getHighlights("c1")).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(
      highlightsApi.createHighlight({
        message_id: "m1", selected_text: "t", start_offset: 0, end_offset: 1, color_index: 0,
      }),
    ).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(highlightsApi.removeHighlight("h1")).rejects.toBeInstanceOf(FeatureDisabledError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the provider is inert: empty, closed, and creating a highlight does nothing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    let ctx!: ReturnType<typeof useHighlight>;
    function Probe() {
      ctx = useHighlight();
      return null;
    }
    renderToString(
      <HighlightProvider>
        <Probe />
      </HighlightProvider>,
    );

    expect(ctx.highlights).toEqual([]);
    expect(ctx.isOpen).toBe(false);
    expect(ctx.isLoading).toBe(false);

    ctx.open();
    ctx.toggle();
    ctx.loadForChat("c1");
    ctx.loadAll();
    const id = await ctx.addHighlight({ text: "t", messageId: "m1", startOffset: 0, endOffset: 1 });
    await ctx.deleteHighlight("h1");

    expect(id).toBe("");
    expect(ctx.isOpen).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
