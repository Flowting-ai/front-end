import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LLM_COLOR, LLM_MONO } from "@strange-huge/icons/llm";
import { LLM_COLOR as SUBSET_COLOR, LLM_MONO as SUBSET_MONO, LLM_ICON_IDS } from "@/lib/llm-icons.generated";
import { toLlmIconId } from "@/lib/ai-models";
import { getModelLlmId } from "@/lib/model-icons";

// The two resolvers below decide which provider logo the app asks for. They are
// pinned here so changes to how logos are shipped (see ThemedLlmIcon) cannot silently
// change which logo a model gets, and so every id they can return is known to exist.

const TO_ICON_ID: Array<[string | null | undefined, string | null]> = [
  ["Anthropic", "Claude"],
  ["claude-haiku-4.5", "Claude"],
  ["Claude Opus 5", "Claude"],
  ["xAI", "Grok"],
  ["grok-4", "Grok"],
  ["OpenAI", "OpenAI"],
  ["gpt-5", "OpenAI"],
  ["Gemini 2.5 Pro", "Gemini"],
  ["Google", "Google"],
  ["Meta", "Meta"],
  ["llama-4", "Meta"],
  ["Mistral", "Mistral"],
  ["DeepSeek", "DeepSeek"],
  ["Groq", "Groq"],
  ["Cohere", "Cohere"],
  ["Perplexity", "Perplexity"],
  ["Some Unknown Lab", null],
  ["", null],
  [null, null],
  [undefined, null],
];

const MODEL_LLM_ID: Array<[string | null | undefined, string | null | undefined, string | null]> = [
  ["OpenAI", "gpt-5", "OpenAI"],
  ["Anthropic", "claude-sonnet", "Claude"],
  ["Google", "gemini-2.5", "Gemini"],
  ["Mistral AI", "mixtral-8x7b", "Mistral"],
  ["Meta", "llama-3", "Meta"],
  ["Moonshot AI", "kimi-k2", "Moonshot"],
  ["Qwen", "qwen3", "Qwen"],
  ["DeepSeek", "deepseek-r1", "DeepSeek"],
  ["xAI", "grok-4", "Grok"],
  ["x-ai", "something", "XAI"],
  ["Acme", "model-1", null],
  [null, null, null],
];

describe("toLlmIconId", () => {
  it.each(TO_ICON_ID)("%s -> %s", (source, expected) => {
    expect(toLlmIconId(source)).toBe(expected);
  });
});

describe("getModelLlmId", () => {
  it.each(MODEL_LLM_ID)("%s / %s -> %s", (company, model, expected) => {
    expect(getModelLlmId(company, model)).toBe(expected);
  });
});

describe("every resolvable id has logo artwork", () => {
  const ids = new Set<string>();
  for (const [, id] of TO_ICON_ID) if (id) ids.add(id);
  for (const [, , id] of MODEL_LLM_ID) if (id) ids.add(id);

  it.each([...ids])("%s has color artwork", (id) => {
    expect(Object.prototype.hasOwnProperty.call(LLM_COLOR, id)).toBe(true);
  });

  it("mono artwork exists for all but the known exceptions", () => {
    const withoutMono = [...ids].filter((id) => !(id in LLM_MONO)).sort();
    // Documented in ThemedLlmIcon: a few catalogue entries have no mono artwork.
    expect(withoutMono.length).toBeLessThanOrEqual(2);
  });
});

// The app ships src/lib/llm-icons.generated.ts (a subset of the package) instead of the package
// itself. These tests keep the subset complete and faithful.
describe("generated logo subset", () => {
  const resolvable = new Set<string>();
  for (const [, id] of TO_ICON_ID) if (id) resolvable.add(id);
  for (const [, , id] of MODEL_LLM_ID) if (id) resolvable.add(id);

  // Fixed ids written directly in components, e.g. { id: 'claude', llm: 'Claude', ... }.
  const SOURCE_FILE = /\.(ts|tsx)$/;
  const TEST_FILE = /\.test\./;
  const LITERAL_ID = /\bllm:\s*['"]([A-Za-z0-9]+)['"]/g;
  const literalIds = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) && !entry.name.includes(".generated.")) {
        const text = fs.readFileSync(full, "utf8");
        for (const m of text.matchAll(LITERAL_ID)) literalIds.add(m[1]);
      }
    }
  };
  walk(path.resolve(__dirname, ".."));

  it("contains every id the resolvers can return", () => {
    for (const id of resolvable) expect(LLM_ICON_IDS, id).toContain(id);
  });

  it("contains every id written literally in a component", () => {
    expect(literalIds.size).toBeGreaterThan(0);
    for (const id of literalIds) expect(LLM_ICON_IDS, id).toContain(id);
  });

  it("has color artwork identical to the package for every listed id", () => {
    for (const id of LLM_ICON_IDS) expect(SUBSET_COLOR[id], id).toBe((LLM_COLOR as Record<string, string>)[id]);
  });

  it("has mono artwork identical to the package wherever the package has it", () => {
    for (const id of LLM_ICON_IDS) {
      const original = (LLM_MONO as Record<string, string | undefined>)[id];
      if (original) expect(SUBSET_MONO[id], id).toBe(original);
      else expect(SUBSET_MONO[id]).toBeUndefined();
    }
  });

  it("stays small (guards against re-importing the full package data)", () => {
    const bytes = JSON.stringify(SUBSET_COLOR).length + JSON.stringify(SUBSET_MONO).length;
    expect(bytes).toBeLessThan(120 * 1024);
  });
});
