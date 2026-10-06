import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEGACY } from "../../scripts/theme-legacy-colors.mjs";

/**
 * Reads the REAL token files and enforces, numerically, what the dark theme must
 * guarantee: readable text (normal AND hover), visible hover/borders, dark fills
 * (no light-grey blocks), and a light theme that never changes.
 */

const TOKENS = resolve(__dirname, "../styles/tokens");
const read = (f: string) => readFileSync(resolve(TOKENS, f), "utf8");
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

type Vars = Record<string, string>;
const decls = (css: string): Vars => {
  const out: Vars = {};
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
};

const BASE: Vars = {
  ...decls(noComments(read("primitives.css"))),
  ...decls(noComments(read("aliases.css"))),
  ...decls(noComments(read("semantic.css"))),
};
const THEME = noComments(read("theme.css"));
const LIGHT_EXTRA = decls(THEME.match(/:root\s*\{([^}]*)\}/)![1]);
const DARK_BLOCK = decls(THEME.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)![1]);
const LIGHT: Vars = { ...BASE, ...LIGHT_EXTRA };
const DARK: Vars = { ...LIGHT, ...DARK_BLOCK };

function resolveVar(vars: Vars, name: string, depth = 0): string | null {
  const v = vars[name];
  if (v === undefined || depth > 20) return null;
  const m = v.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
  return m ? resolveVar(vars, m[1], depth + 1) : v;
}

interface Rgba { r: number; g: number; b: number; a: number }
function parseColor(c: string | null): Rgba | null {
  if (!c) return null;
  let m = c.match(/^#([0-9a-fA-F]{6})$/);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}
const over = (fg: Rgba, bg: Rgba): Rgba => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
});
const luminance = ({ r, g, b }: Rgba) => {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const color = (vars: Vars, name: string): Rgba => {
  const c = parseColor(resolveVar(vars, name));
  if (!c) throw new Error(`cannot resolve ${name}`);
  return c;
};

const CARD = color(DARK, "--neutral-white");
const PAGE = color(DARK, "--neutral-50");
const HOVER_TINT_ON_CARD = over(color(DARK, "--color-interactive-subtle-surface-hover"), CARD);
const HOVER_TINT_ON_PAGE = over(color(DARK, "--color-interactive-subtle-surface-hover"), PAGE);

describe("dark theme: normal-state contrast", () => {
  const cases: [string, string, number][] = [
    ["--color-text-primary", "primary text", 7],
    ["--color-text-default", "default text", 7],
    ["--color-text-muted", "muted text", 4.5],
    ["--color-text-placeholder", "placeholder", 4.5],
  ];
  for (const [token, label, min] of cases) {
    it(`${label} is readable on the card and the page (>= ${min}:1)`, () => {
      expect(contrast(color(DARK, token), CARD)).toBeGreaterThanOrEqual(min);
      expect(contrast(color(DARK, token), PAGE)).toBeGreaterThanOrEqual(min);
    });
  }

  it("button text is readable on every button style", () => {
    const pairs: [string, string][] = [
      ["--button-default-text", "--button-default-bg-from"],
      ["--button-default-text", "--button-default-bg-to"],
      ["--button-secondary-text", "--button-secondary-bg"],
      ["--tab-item-text-selected", "--tab-item-bg-selected"],
      ["--tooltip-text", "--tooltip-bg-from"],
      ["--tooltip-text", "--tooltip-bg-to"],
      ["--toast-text", "--toast-bg"],
      ["--toast-action-text", "--toast-action-bg"],
    ];
    // The primary button is the brand pink gradient with white label (~3.9:1, WCAG AA for bold/large UI text); every other style stays >= 7:1.
    const PINK_PRIMARY = ["--button-default-bg-from", "--button-default-bg-to"];
    for (const [fg, bg] of pairs) expect(contrast(color(DARK, fg), color(DARK, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(PINK_PRIMARY.includes(bg) ? 3.5 : 7);
    expect(contrast(color(DARK, "--button-ghost-text"), PAGE)).toBeGreaterThanOrEqual(7);
    expect(contrast(color(DARK, "--button-outline-text"), CARD)).toBeGreaterThanOrEqual(7);
  });

  it("status toasts and tags are readable (>= 4.5:1)", () => {
    for (const k of ["success", "error", "warning", "info"]) {
      expect(contrast(color(DARK, `--toast-${k}-text`), color(DARK, `--toast-${k}-bg`)), k).toBeGreaterThanOrEqual(4.5);
    }
    for (const c of ["Blue", "Red", "Green", "Yellow", "Purple", "Brown", "Neutral"]) {
      expect(contrast(color(DARK, `--color-tag-${c}-text`), color(DARK, `--color-tag-${c}-bg`)), c).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every accent text/icon step (400–700) is readable on the card", () => {
    for (const p of ["blue", "red", "green", "yellow", "brown", "purple"]) {
      for (const s of ["400", "500", "600", "700"]) {
        expect(contrast(color(DARK, `--${p}-${s}`), CARD), `${p}-${s}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("dark theme: hover", () => {
  it("white is the hover colour for text", () => {
    expect(resolveVar(DARK, "--text-hover")?.toUpperCase()).toBe("#FFFFFF");
    expect(resolveVar(DARK, "--tab-item-text-hover")?.toUpperCase()).toBe("#FFFFFF");
    // The sidebar rows turn their text to --neutral-black on hover — white in dark.
    expect(resolveVar(DARK, "--neutral-black")?.toUpperCase()).toBe("#FFFFFF");
  });

  it("white hover text is strongly readable on the hover background (>= 7:1)", () => {
    const white = color(DARK, "--text-hover");
    expect(contrast(white, HOVER_TINT_ON_CARD)).toBeGreaterThanOrEqual(7);
    expect(contrast(white, HOVER_TINT_ON_PAGE)).toBeGreaterThanOrEqual(7);
  });

  it("hover is a visible change from normal (brighter text, visible background)", () => {
    // text: normal default text is dimmer than hover white
    expect(luminance(color(DARK, "--text-hover"))).toBeGreaterThan(luminance(color(DARK, "--color-text-default")));
    // background: the hover tint is visibly distinct from the surface under it
    expect(contrast(HOVER_TINT_ON_CARD, CARD)).toBeGreaterThanOrEqual(1.1);
    expect(contrast(HOVER_TINT_ON_PAGE, PAGE)).toBeGreaterThanOrEqual(1.1);
  });

  it("the hover rule only overrides tokens that exist, only in dark, and skips disabled controls", () => {
    const rule = THEME.match(/([^{}]*\[data-highlighted\][^{}]*)\{([^{}]*)\}/);
    expect(rule, "hover rule block present").not.toBeNull();
    const [, selectors, body] = rule!;
    for (const sel of selectors.split(",").map((s) => s.trim()).filter(Boolean)) {
      expect(sel.startsWith(':root[data-theme="dark"] '), sel).toBe(true);
      expect(sel).toContain(':not(:disabled)');
      expect(sel).toContain(':not([aria-disabled="true"])');
    }
    for (const name of Object.keys(decls(body))) {
      expect(BASE[name], `${name} must exist in the token files`).toBeDefined();
      expect(decls(body)[name]).toBe("var(--text-hover)");
    }
  });
});

describe("main page containers", () => {
  it("light: the container fill is exactly the rgba(255,255,255,0.2) it hard-coded before", () => {
    const light = parseColor(resolveVar(LIGHT, "--color-surface-container"))!;
    expect(light).toEqual({ r: 255, g: 255, b: 255, a: 0.2 });
    // …and equals the existing glass token, so nothing in light moved.
    expect(parseColor(resolveVar(LIGHT, "--color-surface-container"))).toEqual(parseColor(resolveVar(LIGHT, "--color-surface-glass")));
  });

  it("dark: the container has NO fill, so it is the same surrounding black as the page", () => {
    expect(resolveVar(DARK, "--color-surface-container")).toBe("transparent");
  });

  it("regression: white at 20% over the dark page is the grey (#454545) this replaced", () => {
    const grey = over({ r: 255, g: 255, b: 255, a: 0.2 }, PAGE);
    const hex = "#" + [grey.r, grey.g, grey.b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    expect(hex).toBe("#454545");
    // The old fill is visibly lighter than the page; the new (transparent) one is not.
    expect(luminance(grey)).toBeGreaterThan(luminance(PAGE) * 3);
  });
});

describe("secondary buttons, icon buttons and the selected tab are raised dark surfaces in dark", () => {
  const SURFACES = ["--button-secondary-bg", "--icon-button-secondary-bg", "--tab-item-bg-selected"];
  const SHADOWS = [
    "--shadow-button-secondary-outer", "--shadow-button-secondary-outer-hover",
    "--shadow-button-secondary-inner", "--shadow-button-secondary-inner-hover",
    "--shadow-tab-item-selected", "--shadow-tab-item-selected-inner",
  ];

  it("they are the light cream surface in light (unchanged) but dark, and clearly lifted off the page, in dark", () => {
    for (const t of SURFACES) {
      expect(resolveVar(LIGHT, t)?.toUpperCase().replace("VAR(--NEUTRAL-WHITE)", "#FFFFFF"), t + " (light)").toBe("#FFFFFF");
      const dark = color(DARK, t);
      expect(luminance(dark), t + " is dark, not a white block").toBeLessThan(0.12);
      expect(contrast(dark, PAGE), t + " pops off the page").toBeGreaterThanOrEqual(1.2);
    }
  });

  it("their hover surface steps up one tone", () => {
    for (const t of ["--button-secondary-bg-hover", "--icon-button-secondary-bg-hover"]) {
      expect(luminance(color(DARK, t)), t).toBeGreaterThan(luminance(color(DARK, "--button-secondary-bg")));
    }
  });

  it("text and icons on them are readable (>= 7:1 normal, >= 3:1 disabled)", () => {
    const bg = color(DARK, "--button-secondary-bg");
    for (const t of ["--button-secondary-text", "--icon-button-secondary-icon"]) {
      expect(contrast(color(DARK, t), bg), t).toBeGreaterThanOrEqual(7);
    }
    expect(contrast(color(DARK, "--tab-item-text-selected"), color(DARK, "--tab-item-bg-selected"))).toBeGreaterThanOrEqual(7);
    for (const t of ["--button-secondary-text-disabled", "--icon-button-secondary-icon-disabled"]) {
      expect(contrast(color(DARK, t), bg), t).toBeGreaterThanOrEqual(3);
    }
  });

  it("their ring is a light hairline (a dark ring is invisible on a dark page)", () => {
    for (const t of SHADOWS.filter((n) => /outer|tab-item-selected$/.test(n))) {
      expect(resolveFully(DARK, t), t).toMatch(/0px 0px 0px 1px rgba\(255, 255, 255, 0\.\d+\)/);
    }
  });

  it("the white-on-hover rule does NOT touch them (white text on white would vanish)", () => {
    const rule = THEME.match(/([^{}]*\[data-highlighted\][^{}]*)\{([^{}]*)\}/)!;
    const overridden = Object.keys(decls(rule[2]));
    for (const t of ["--button-secondary-text", "--icon-button-secondary-icon", "--tab-item-text-selected", "--tab-item-bg-selected"]) {
      expect(overridden, t).not.toContain(t);
    }
  });

  it("the user's message bubble is cream in light but a raised dark-grey card in dark; the chat input stays dark", () => {
    expect(resolveVar(LIGHT, "--message-bubble-user-bg")?.toUpperCase().replace("VAR(--NEUTRAL-WHITE)", "#F9F8F5")).toBe("#F9F8F5");
    const bubble = color(DARK, "--message-bubble-user-bg");
    expect(resolveVar(DARK, "--message-bubble-user-bg")?.toUpperCase()).toBe("#2A2A2A");
    // Dark (not a white block), yet clearly raised above both the page and the chat input surface.
    expect(luminance(bubble)).toBeLessThan(0.12);
    expect(contrast(bubble, PAGE)).toBeGreaterThanOrEqual(1.1);
    expect(luminance(bubble)).toBeGreaterThan(luminance(color(DARK, "--chat-input-bg")));
    expect(contrast(color(DARK, "--message-bubble-user-text"), bubble)).toBeGreaterThanOrEqual(7);
    // The typing area is a different surface and must stay the dark card.
    expect(luminance(color(DARK, "--chat-input-bg"))).toBeLessThan(0.12);
  });

  it("the chat input glows LIGHT in dark (a black shadow is invisible on a near-black page)", () => {
    for (const t of ["--shadow-chat-input", "--shadow-chat-input-hover", "--shadow-chat-input-focus"]) {
      const v = resolveFully(DARK, t);
      expect(v, t).toMatch(/rgba\(255, 255, 255, 0\.\d+\)/);
      expect(v, t).not.toMatch(/rgba\(0, 0, 0/);
    }
  });

  it("the shared --shadow-item-inner is NOT pinned (sidebar, menus and ghost hover sit on dark)", () => {
    const pinnedBlock = THEME.slice(THEME.indexOf("Pinned light values"), THEME.indexOf("White text on hover"));
    expect(pinnedBlock).not.toContain("--shadow-item-inner");
  });
});

/** Like resolveVar but also substitutes var() INSIDE multi-part values (shadows). */
function resolveFully(vars: Vars, name: string, depth = 0): string {
  const v = vars[name];
  if (v === undefined || depth > 20) return "";
  return v.replace(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,[^)]*)?\)/g, (_, n) => resolveFully(vars, n, depth + 1));
}

describe("tab bar", () => {
  const TRACK = () => color(DARK, "--tab-bg");

  it("the tab bar is the #262626 dark surface in dark and light gray in light", () => {
    expect(resolveVar(DARK, "--tab-bg")?.toUpperCase()).toBe("#262626");
    expect(parseColor(resolveVar(LIGHT, "--tab-bg"))).toEqual({ r: 245, g: 242, b: 239, a: 1 });
    expect(resolveVar(BASE, "--tab-bg")).toBe(resolveVar(LIGHT, "--tab-bg"));
  });

  it("the track is lifted above both the page and the card, so the tab strip reads as a control", () => {
    expect(contrast(TRACK(), PAGE)).toBeGreaterThanOrEqual(1.15);
    expect(contrast(TRACK(), CARD)).toBeGreaterThanOrEqual(1.05);
  });

  it("the selected pill is clearly distinct from the track (>= 1.3:1) and its text is readable (>= 7:1)", () => {
    expect(contrast(color(DARK, "--tab-item-bg-selected"), TRACK())).toBeGreaterThanOrEqual(1.3);
    expect(contrast(color(DARK, "--tab-item-text-selected"), color(DARK, "--tab-item-bg-selected"))).toBeGreaterThanOrEqual(7);
  });

  it("unselected labels are readable on the grey: default >= 4.5:1, hover (white) >= 7:1", () => {
    expect(contrast(color(DARK, "--tab-item-text-default"), TRACK())).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(DARK, "--tab-item-text-hover"), TRACK())).toBeGreaterThanOrEqual(7);
  });

  it("disabled labels are dimmer than default but still visible (>= 2.5:1)", () => {
    const disabled = contrast(color(DARK, "--tab-item-text-disabled"), TRACK());
    expect(disabled).toBeGreaterThanOrEqual(2.5);
    expect(disabled).toBeLessThan(contrast(color(DARK, "--tab-item-text-default"), TRACK()));
  });
});

describe("agent cards (grey surface + raised scope)", () => {
  const RAISED_BLOCK = THEME.match(/\[data-surface="raised"\]\s*\{([\s\S]*?)\n\}/)![1];
  const RAISED_DECLS = decls(RAISED_BLOCK);
  const RAISED: Vars = { ...DARK, ...RAISED_DECLS };
  const GREY = () => color(DARK, "--agent-card-bg");
  const RAMP = ["--neutral-200", "--neutral-300", "--neutral-400", "--neutral-500"];

  it("dark: the card surface is the #1C1C1C dark surface; light: warm neutral", () => {
    expect(resolveVar(DARK, "--agent-card-bg")?.toUpperCase()).toBe("#1C1C1C");
    expect(resolveVar(LIGHT, "--agent-card-bg")?.toUpperCase()).toBe("#F5F2EF");
  });

  it("the card is the dark card surface, lifted above the page", () => {
    expect(contrast(GREY(), CARD)).toBe(1);
    expect(luminance(PAGE)).toBeLessThan(luminance(GREY()));
  });

  it("the scope restates tokens with EXACTLY their existing dark value — it never changes one", () => {
    const squash = (s: string) => s.replace(/\s+/g, " ").trim(); // multi-line shadows are emitted on one line
    for (const [name, value] of Object.entries(RAISED_DECLS)) {
      if (RAMP.includes(name)) continue;
      expect(squash(value), name).toBe(squash(DARK[name]));
    }
  });

  it("the scope lifts only the neutral ramp tones, and only upward", () => {
    for (const name of RAMP) {
      expect(RAISED_DECLS[name], name).toBeDefined();
      expect(luminance(color(RAISED, name)), name).toBeGreaterThan(luminance(color(DARK, name)));
    }
    // Nothing outside the ramp is redefined with a literal.
    for (const [name, value] of Object.entries(RAISED_DECLS)) {
      if (!RAMP.includes(name)) expect(value, name).toMatch(/var\(/);
    }
  });

  it("the scope only ever makes muted tones stronger on the card", () => {
    expect(contrast(color(RAISED, "--neutral-500"), GREY())).toBeGreaterThanOrEqual(contrast(color(DARK, "--neutral-500"), GREY()));
  });

  it("inside the scope, text is readable on the grey card", () => {
    const g = GREY();
    expect(contrast(color(RAISED, "--color-text-primary"), g)).toBeGreaterThanOrEqual(7);
    expect(contrast(color(RAISED, "--color-text-default"), g)).toBeGreaterThanOrEqual(6);
    expect(contrast(color(RAISED, "--color-text-muted"), g)).toBeGreaterThanOrEqual(4.5);   // alias follows the lifted ramp
    expect(contrast(color(RAISED, "--neutral-500"), g)).toBeGreaterThanOrEqual(4.5);        // direct use
    expect(contrast(color(RAISED, "--neutral-600"), g)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(RAISED, "--sidebar-menu-item-muted"), g)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(RAISED, "--dropdown-menu-item-muted"), g)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(RAISED, "--text-hover"), g)).toBeGreaterThanOrEqual(7);            // white on hover
  });

  it("inside the scope, icons, disabled text and dividers stay visible", () => {
    const g = GREY();
    expect(contrast(color(RAISED, "--neutral-400"), g)).toBeGreaterThanOrEqual(3);    // icons
    expect(contrast(color(RAISED, "--neutral-300"), g)).toBeGreaterThanOrEqual(2.2);  // disabled
    expect(contrast(color(RAISED, "--neutral-200"), g)).toBeGreaterThanOrEqual(1.3);  // dividers / placeholder fills
  });

  it("secondary buttons on a card keep their dark raised surface (the scope never changes them)", () => {
    expect(resolveVar(RAISED, "--button-secondary-bg")?.toUpperCase()).toBe("#2E2E2E");
    expect(contrast(color(RAISED, "--button-secondary-text"), color(RAISED, "--button-secondary-bg"))).toBeGreaterThanOrEqual(7);
  });
});

describe("translucent veils (rgba(var(--surface-rgb), A))", () => {
  it("light: --surface-rgb is the cream surface (--neutral-white), so every veil matches the page it sits on", () => {
    expect(resolveVar(LIGHT, "--surface-rgb")).toBe("249, 248, 245");
  });

  it("dark: --surface-rgb is the dark card colour, so a veil is never a bright white sheet", () => {
    const rgb = resolveVar(DARK, "--surface-rgb")!.split(",").map((n) => Number(n.trim()));
    expect(rgb).toEqual([CARD.r, CARD.g, CARD.b]);
    // A 90% veil (the file-drop overlays) over the page stays dark, so text on it is readable.
    const veil = over({ r: rgb[0], g: rgb[1], b: rgb[2], a: 0.9 }, PAGE);
    expect(luminance(veil)).toBeLessThan(0.05);
    expect(contrast(color(DARK, "--color-text-primary"), veil)).toBeGreaterThanOrEqual(7);
    expect(contrast(color(DARK, "--blue-600"), veil)).toBeGreaterThanOrEqual(4.5); // the overlay's blue label
    // A 72% veil chip (email/schedule widgets) keeps default text readable.
    const chip = over({ r: rgb[0], g: rgb[1], b: rgb[2], a: 0.72 }, CARD);
    expect(contrast(color(DARK, "--neutral-700"), chip)).toBeGreaterThanOrEqual(7);
  });
});

describe("dark theme: no light-grey fills", () => {
  const isDarkish = (c: Rgba) => luminance(c) < 0.12;
  it("surfaces are deep, warm and dark", () => {
    for (const t of ["--neutral-50", "--neutral-white", "--neutral-100", "--neutral-200"]) {
      expect(isDarkish(color(DARK, t)), t).toBe(true);
    }
    expect(luminance(PAGE)).toBeLessThan(luminance(CARD)); // cards sit above the page
  });

  it("primary button (disabled), toast-action and primary (enabled, brand pink) fills are not light-grey blocks", () => {
    for (const t of [
      "--color-interactive-primary-surface-disabled-from", "--color-interactive-primary-surface-disabled-to",
      "--toast-action-bg",
    ]) expect(isDarkish(color(DARK, t)), t).toBe(true);
    // Tooltips are white with dark text in dark mode (checked for readability above), so they are intentionally not dark fills.
    // The enabled primary button is the saturated brand pink in dark - a brand colour, not a light-grey block.
    for (const t of ["--color-interactive-primary-surface-from", "--color-interactive-primary-surface-to"]) {
      const { r, g, b } = color(DARK, t);
      expect(r - Math.max(g, b), `${t} is saturated pink`).toBeGreaterThan(60);
    }
  });

  it("the primary button has a visible border against the page", () => {
    expect(contrast(color(DARK, "--button-default-border"), PAGE)).toBeGreaterThanOrEqual(1.5);
  });

  it("the primary gradient equals the hard-coded gradient it replaced, in BOTH themes' light path", () => {
    expect(resolveVar(LIGHT, "--color-interactive-primary-surface-from")?.toUpperCase()).toBe("#524B47");
    expect(resolveVar(LIGHT, "--color-interactive-primary-surface-to")?.toUpperCase()).toBe("#26211E");
    expect(resolveVar(LIGHT, "--color-interactive-primary-surface-disabled-to")?.toUpperCase()).toBe("#3B3632");
  });
});

describe("text fields stand out in dark", () => {
  it("the field fill is brighter than the card it sits on, and its ring is a visible light hairline", () => {
    expect(resolveVar(DARK, "--text-field-bg")?.toUpperCase()).toBe("#2E2E2E");
    expect(contrast(color(DARK, "--text-field-bg"), CARD)).toBeGreaterThanOrEqual(1.05);
    expect(contrast(color(DARK, "--text-field-bg"), PAGE)).toBeGreaterThanOrEqual(1.15);
    expect(resolveVar(DARK, "--text-field-ring")).toMatch(/rgba\(255, 255, 255, 0\.\d+\)/);
    expect(resolveVar(DARK, "--text-field-ring-hover")).toMatch(/rgba\(255, 255, 255, 0\.\d+\)/);
  });

  it("light keeps its original rings", () => {
    expect(resolveVar(LIGHT, "--text-field-ring")).toBe(resolveVar(LIGHT, "--neutral-100"));
    expect(resolveVar(LIGHT, "--text-field-ring-hover")).toBe(resolveVar(LIGHT, "--neutral-200"));
  });
});

describe("light theme is untouched", () => {
  it("no existing token resolves differently once theme.css is loaded", () => {
    const changed = Object.keys(BASE).filter((k) => resolveVar(BASE, k) !== resolveVar(LIGHT, k));
    expect(changed).toEqual([]);
  });

  it("every legacy token uses its configured light value and retains its dark value", () => {
    for (const [hex, v] of Object.entries(LEGACY as Record<string, { token: string; dark: string; light?: string }>)) {
      expect(LIGHT_EXTRA[v.token]?.toUpperCase(), v.token).toBe((v.light ?? hex).toUpperCase());
      expect(DARK_BLOCK[v.token], `${v.token} has a dark value`).toBeDefined();
    }
  });

  it("legacy ink tokens flip to readable text and legacy surfaces flip to dark", () => {
    for (const [hex, v] of Object.entries(LEGACY as Record<string, { token: string; dark: string }>)) {
      const lightLum = luminance(parseColor(hex)!);
      const wasDark = lightLum < 0.3;
      const dark = parseColor(resolveVar(DARK, v.token))!;
      // Near-black "ink" becomes primary text (7:1). A coloured or mid-tone text colour
      // (error red, mid-grey) only has to stay clearly readable (4.5:1).
      if (wasDark) expect(contrast(dark, CARD), `${v.token} (text)`).toBeGreaterThanOrEqual(lightLum < 0.05 ? 7 : 4.5);
      else expect(luminance(dark), `${v.token} (surface)`).toBeLessThan(0.12);
    }
  });
});

describe("thinking text (reasoning blocks, shimmer)", () => {
  const TEXT = ["--thinking-text", "--thinking-text-faint", "--thinking-icon-strong", "--thinking-icon-active"];

  it("is readable on the dark page and on cards (label >= 4.5:1 AA; faint text and icons >= 3:1)", () => {
    const label = TEXT[0];
    expect(contrast(color(DARK, label), PAGE), `${label} on page`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(DARK, label), CARD), `${label} on card`).toBeGreaterThanOrEqual(4.5);
    for (const t of TEXT.slice(1)) {
      expect(contrast(color(DARK, t), PAGE), `${t} on page`).toBeGreaterThanOrEqual(3);
      expect(contrast(color(DARK, t), CARD), `${t} on card`).toBeGreaterThanOrEqual(3);
    }
  });

  it("shimmer sweeps a lighter peak across its edge, and the edge stays readable in dark", () => {
    expect(luminance(color(DARK, "--thinking-shimmer-peak"))).toBeGreaterThan(luminance(color(DARK, "--thinking-shimmer-edge")));
    expect(contrast(color(DARK, "--thinking-shimmer-edge"), PAGE)).toBeGreaterThanOrEqual(2.5); // decorative sweep edge, not body text
  });

  it("every thinking token exists for light (so light keeps its own look) and for dark", () => {
    for (const t of [...TEXT, "--thinking-rule", "--thinking-shimmer-edge", "--thinking-shimmer-peak"]) {
      expect(LIGHT_EXTRA[t], `${t} light`).toBeTruthy();
      expect(DARK_BLOCK[t], `${t} dark`).toBeTruthy();
    }
  });
});

describe("active sidebar item", () => {
  it("gets exactly the hover tokens, so its text is white like on hover", () => {
    const active = decls(THEME.match(/:root\[data-theme="dark"\] \[data-sidebar-active\]\s*\{([^}]*)\}/)![1]);
    const hover = decls(THEME.match(/:root\[data-theme="dark"\] button:hover[^{]*\{([^}]*)\}/)![1]);
    expect(Object.keys(active).length).toBeGreaterThan(0);
    expect(active).toEqual(hover);
    expect(resolveVar({ ...DARK, ...active }, "--sidebar-menu-item-text")!.toUpperCase()).toBe("#FFFFFF");
    expect(resolveVar({ ...DARK, ...active }, "--sidebar-menu-item-muted")!.toUpperCase()).toBe("#FFFFFF");
  });
});

describe("selected sidebar item", () => {
  it("uses black text in light mode and white text in dark mode without replacing the row fill", () => {
    expect(resolveVar(LIGHT, "--sidebar-selected-text")?.toUpperCase()).toBe("#000000");
    expect(contrast(color(LIGHT, "--sidebar-selected-text"), color(LIGHT, "--neutral-50"))).toBeGreaterThanOrEqual(7);
    expect(resolveVar(DARK, "--sidebar-selected-text")?.toUpperCase()).toBe("#FFFFFF");
    expect(contrast(color(DARK, "--sidebar-selected-text"), PAGE)).toBeGreaterThanOrEqual(7);
  });
});

describe("sidebar section header colors", () => {
  it("uses darker text in light and dark themes for both header styles", () => {
    expect(resolveVar(LIGHT, "--sidebar-section-header-text")?.toUpperCase()).toBe("#3B3632");
    expect(resolveVar(DARK, "--sidebar-section-header-text")?.toUpperCase()).toBe("#ABABAB");
    expect(resolveVar(LIGHT, "--sidebar-section-header-muted")?.toUpperCase()).toBe("#6A625D");
    expect(resolveVar(DARK, "--sidebar-section-header-muted")?.toUpperCase()).toBe("#858585");
  });
});

describe("user message action icon", () => {
  it("is darker on the light bubble and preserves the dark-mode color", () => {
    expect(resolveVar(LIGHT, "--message-bubble-action-icon")?.toUpperCase()).toBe("#6A625D");
    expect(contrast(color(LIGHT, "--message-bubble-action-icon"), color(LIGHT, "--message-bubble-user-bg"))).toBeGreaterThanOrEqual(4.5);
    expect(resolveVar(DARK, "--message-bubble-action-icon")?.toUpperCase()).toBe("#D4D4D4");
    expect(resolveVar(LIGHT, "--message-bubble-action-timestamp")?.toUpperCase()).toBe("#6A625D");
    expect(contrast(color(LIGHT, "--message-bubble-action-timestamp"), color(LIGHT, "--message-bubble-user-bg"))).toBeGreaterThanOrEqual(4.5);
  });
});
