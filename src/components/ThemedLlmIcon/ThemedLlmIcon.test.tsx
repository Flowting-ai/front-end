import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { ThemedLlmIcon } from "./index";

// ThemedLlmIcon renders each provider logo as an <img> with a data-URL SVG, once for
// light mode and (when theming is on) once more for dark mode. The markup is part of the
// app's visual contract (dark-mode CSS targets `kds-llm-color` / `kds-llm-mono`), so this
// test pins it byte-for-byte against a fixture captured from the original implementation
// that read the logos from `@strange-huge/icons/llm`.
//
// To (re)capture the fixture on purpose: UPDATE_LLM_BASELINE=1 npx vitest run ThemedLlmIcon

const flags = vi.hoisted(() => ({ THEMING_ENABLED: false }));
vi.mock("@/lib/feature-flags", () => ({
  get THEMING_ENABLED() {
    return flags.THEMING_ENABLED;
  },
}));

const FIXTURE = path.join(__dirname, "__fixtures__", "llm-icon-markup.json");

// Every id the app can resolve (toLlmIconId + getModelLlmId) plus an unknown id.
const IDS = [
  "Claude", "Grok", "XAI", "OpenAI", "Gemini", "Google", "Meta", "Mistral",
  "DeepSeek", "Groq", "Cohere", "Perplexity", "Moonshot", "Kimi", "Qwen", "NoSuchIcon",
];
const SIZES = [16, 24];

function render(theming: boolean, id: string, size: number, extra: Record<string, unknown> = {}): string {
  flags.THEMING_ENABLED = theming;
  return renderToStaticMarkup(<ThemedLlmIcon id={id} size={size} {...extra} />);
}

function capture(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const theming of [false, true]) {
    for (const id of IDS) {
      for (const size of SIZES) {
        out[`${theming ? "themed" : "plain"}|${id}|${size}`] = render(theming, id, size);
      }
    }
  }
  out["themed|Claude|16|props"] = render(true, "Claude", 16, { className: "x", style: { opacity: 0.5 }, alt: "Claude logo" });
  out["plain|Gemini|24|props"] = render(false, "Gemini", 24, { className: "y", alt: "" });
  return out;
}

describe("ThemedLlmIcon markup", () => {
  beforeEach(() => {
    flags.THEMING_ENABLED = false;
  });

  if (process.env.UPDATE_LLM_BASELINE === "1") {
    it("captures the baseline fixture", () => {
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(FIXTURE, JSON.stringify(capture(), null, 1) + "\n");
      expect(fs.existsSync(FIXTURE)).toBe(true);
    });
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Record<string, string>;
  const current = capture();

  it("renders the same markup as the captured baseline for every case", () => {
    expect(Object.keys(current).sort()).toEqual(Object.keys(baseline).sort());
    for (const key of Object.keys(baseline)) {
      expect(current[key], key).toBe(baseline[key]);
    }
  });

  it("renders nothing for an unknown id", () => {
    expect(render(false, "NoSuchIcon", 16)).toBe("");
    expect(render(true, "NoSuchIcon", 16)).toBe("");
  });

  it("themed mode renders a color image and a mono image carrying the dark-mode CSS hooks", () => {
    const html = render(true, "Claude", 16);
    expect(html).toContain("kds-llm-color");
    expect(html).toContain("kds-llm-mono");
    expect(html.match(/<img /g)?.length).toBe(2);
  });

  it("plain mode renders only the color image", () => {
    const html = render(false, "Claude", 16);
    expect(html.match(/<img /g)?.length).toBe(1);
    expect(html).not.toContain("kds-llm-mono");
  });

  it("applies the requested size to the logo", () => {
    const html = render(false, "OpenAI", 24);
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
  });
});
