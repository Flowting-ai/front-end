import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { THEMING_ENABLED } from "@/lib/feature-flags";
import {
  DEFAULT_THEME_MODE,
  THEME_ATTRIBUTE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  isThemeMode,
  readStoredMode,
  resolveTheme,
} from "@/lib/theme";
import { ThemeProvider, useTheme } from "@/context/theme-context";

const ROOT = resolve(__dirname, "../..");

describe("theme logic", () => {
  it("defaults to light, so enabling theming changes nothing until a user picks", () => {
    expect(DEFAULT_THEME_MODE).toBe("light");
    expect(readStoredMode(null)).toBe("light");
    expect(readStoredMode({ getItem: () => null })).toBe("light");
  });

  it("only accepts the three known modes", () => {
    for (const ok of ["light", "dark", "system"]) expect(isThemeMode(ok)).toBe(true);
    for (const bad of ["Dark", "", null, undefined, 1, {}]) expect(isThemeMode(bad)).toBe(false);
  });

  it("reads a stored mode, ignores garbage, and survives storage throwing", () => {
    expect(readStoredMode({ getItem: () => "dark" })).toBe("dark");
    expect(readStoredMode({ getItem: () => "system" })).toBe("system");
    expect(readStoredMode({ getItem: () => "purple" })).toBe("light");
    expect(readStoredMode({ getItem: () => { throw new Error("blocked"); } })).toBe("light");
  });

  it("resolves system against the OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("represents light as the ABSENCE of the attribute", () => {
    const calls: string[] = [];
    const root = {
      setAttribute: (k: string, v: string) => calls.push(`set ${k}=${v}`),
      removeAttribute: (k: string) => calls.push(`remove ${k}`),
    };
    applyResolvedTheme(root, "dark");
    applyResolvedTheme(root, "light");
    expect(calls).toEqual([`set ${THEME_ATTRIBUTE}=dark`, `remove ${THEME_ATTRIBUTE}`]);
  });
});

describe("pre-paint init script", () => {
  function run(stored: string | null, systemDark: boolean, throws = false) {
    const attrs: Record<string, string> = {};
    const fakeWindow = { matchMedia: () => ({ matches: systemDark }) };
    const fakeDocument = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } };
    const fakeStorage = {
      getItem: (k: string) => {
        if (throws) throw new Error("blocked");
        return k === THEME_STORAGE_KEY ? stored : null;
      },
    };
    new Function("localStorage", "window", "document", THEME_INIT_SCRIPT)(fakeStorage, fakeWindow, fakeDocument);
    return attrs;
  }

  it("sets dark for a stored dark choice", () => {
    expect(run("dark", false)).toEqual({ [THEME_ATTRIBUTE]: "dark" });
  });
  it("follows the OS for system", () => {
    expect(run("system", true)).toEqual({ [THEME_ATTRIBUTE]: "dark" });
    expect(run("system", false)).toEqual({});
  });
  it("never touches anything for light, nothing stored, garbage, or blocked storage", () => {
    expect(run("light", true)).toEqual({});
    expect(run(null, true)).toEqual({});
    expect(run("purple", true)).toEqual({});
    expect(run("dark", true, true)).toEqual({});
  });
});

describe("theme.css is additive and in sync", () => {
  const css = readFileSync(resolve(ROOT, "src/styles/tokens/theme.css"), "utf8");

  it("only declares properties inside :root[data-theme=\"dark\"], plus the one new light-safe token", () => {
    // Strip comments, then split into top-level blocks.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks = [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: m[1].trim(),
      body: m[2],
    }));
    // Eleven blocks: the light-safe additions, the dark token block, the dark hover-text rule
    // (many selectors, all scoped to dark), the active and selected sidebar rules, the dark "raised
    // surface" scope, the logo-swap rules (one default-hidden block + three dark-scoped), and the
    // dark body rule.
    expect(blocks.length).toBe(11);
    expect(blocks[0].selector).toBe(":root");
    expect(blocks[1].selector).toBe(':root[data-theme="dark"]');
    expect(blocks[3].selector).toBe(':root[data-theme="dark"] [data-sidebar-active]');
    expect(blocks[4].selector).toBe(':root[data-theme="dark"] [data-sidebar-selected]');
    expect(blocks[5].selector).toBe(':root[data-theme="dark"] [data-surface="raised"]');
    expect(blocks[10].selector).toBe(':root[data-theme="dark"] body');
    for (const sel of blocks[2].selector.split(",").map((s) => s.trim())) {
      expect(sel.startsWith(':root[data-theme="dark"] ')).toBe(true);
    }
    // Logo swap: the only non-dark-scoped rule targets classes that exist solely on the
    // dark-variant images (rendered only when theming is on), so light is unaffected.
    expect(blocks[6].selector.split(",").map((s) => s.trim())).toEqual([".kds-logo-dark", ".kds-llm-mono"]);
    for (const b of blocks.slice(7, 10)) {
      for (const sel of b.selector.split(",").map((s) => s.trim())) {
        expect(sel.startsWith(':root[data-theme="dark"] .kds-')).toBe(true);
      }
    }

    // The ONLY declarations outside dark scope are new tokens that equal today's values.
    const lightRoot = blocks[0];
    const props = [...lightRoot.body.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(props[0]).toBe("--color-text-on-accent");
    expect(
      props.slice(1).every((p) =>
        ["--color-surface-container", "--surface-rgb", "--icon-button-secondary-bg", "--agent-card-bg"].includes(p) || p.startsWith("--legacy-") || p.startsWith("--thinking-"),
      ),
    ).toBe(true);
    expect(lightRoot.body).toMatch(/--color-text-on-accent:\s*var\(--neutral-white\)/); // == today's white
  });

  it("does not redefine light tokens anywhere else", () => {
    for (const f of ["primitives", "aliases", "semantic"]) {
      const t = readFileSync(resolve(ROOT, `src/styles/tokens/${f}.css`), "utf8");
      expect(t).not.toContain("--color-text-on-accent");
      expect(t).not.toContain("data-theme");
    }
  });

  it("matches what the generator produces from the current tokens", () => {
    // Throws (non-zero exit) if theme.css is stale relative to the token files.
    expect(() =>
      execFileSync(process.execPath, ["scripts/generate-dark-theme.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }),
    ).not.toThrow();
  });
});

describe.skipIf(THEMING_ENABLED)("theming is off by default", () => {
  it("the flag is off", () => {
    expect(THEMING_ENABLED).toBe(false);
  });

  it("the provider is inert and never changes the DOM", () => {
    let ctx!: ReturnType<typeof useTheme>;
    function Probe() {
      ctx = useTheme();
      return null;
    }
    renderToString(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(ctx.enabled).toBe(false);
    expect(ctx.mode).toBe("light");
    expect(ctx.resolved).toBe("light");
    expect(() => ctx.setMode("dark")).not.toThrow(); // no-op, no localStorage needed
  });
});
