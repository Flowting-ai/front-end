#!/usr/bin/env node
/**
 * Generates src/lib/llm-icons.generated.ts: the provider logos the app actually renders.
 *
 * Why: `@strange-huge/icons/llm` ships 295 logos in three maps (color, mono and a 9.5 MB
 * "avatar" map) as ONE module, so importing any logo pulls the whole ~10 MB / 6.7 MB-gzip
 * file into the browser bundle. The app only renders a handful of providers, in the `color`
 * and `mono` variants. This script copies exactly those into a small module (~45 KB).
 *
 * To support another provider: add its id to LLM_ICON_IDS below, run
 *   npm run generate:llm-icons
 * and commit the regenerated file. `src/lib/llm-icon-ids.test.ts` fails if a resolver in
 * src/lib/ai-models.ts or src/lib/model-icons.ts can return an id that is not generated,
 * or if the generated artwork drifts from the package.
 *
 * Run `npm run generate:llm-icons -- --check` to verify the committed file is current.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "lib", "llm-icons.generated.ts");

// Every id returned by toLlmIconId (src/lib/ai-models.ts), getModelLlmId (src/lib/model-icons.ts)
// and the fixed ids in src/components/ChatInput/index.tsx.
export const LLM_ICON_IDS = [
  "Claude",
  "Cohere",
  "DeepSeek",
  "Gemini",
  "Google",
  "Groq",
  "Grok",
  "Kimi",
  "Meta",
  "Mistral",
  "Moonshot",
  "OpenAI",
  "Perplexity",
  "Qwen",
  "XAI",
];

const { LLM_COLOR, LLM_MONO } = await import("@strange-huge/icons/llm");

function pick(map, label) {
  const out = {};
  for (const id of LLM_ICON_IDS) {
    const value = map[id];
    // A few providers have no mono artwork; ThemedLlmIcon falls back to the color artwork.
    if (typeof value === "string") out[id] = value;
    else if (label === "color") throw new Error(`No color artwork for "${id}" in @strange-huge/icons/llm`);
  }
  return out;
}

function literal(map) {
  const lines = Object.keys(map)
    .sort()
    .map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(map[id])},`);
  return `{\n${lines.join("\n")}\n}`;
}

const color = pick(LLM_COLOR, "color");
const mono = pick(LLM_MONO, "mono");

const source = `// GENERATED FILE — do not edit by hand.
// Source: scripts/generate-llm-icons.mjs (run \`npm run generate:llm-icons\`).
// A subset of @strange-huge/icons/llm: only the providers the app renders, color and mono only.
// See the header of the script for why this exists.

export const LLM_ICON_IDS = ${JSON.stringify([...LLM_ICON_IDS].sort())} as const;

export type LlmIconId = (typeof LLM_ICON_IDS)[number];

export const LLM_COLOR: Readonly<Record<string, string>> = ${literal(color)};

export const LLM_MONO: Readonly<Record<string, string>> = ${literal(mono)};
`;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== source) {
    console.error("src/lib/llm-icons.generated.ts is out of date — run: npm run generate:llm-icons");
    process.exit(1);
  }
  console.log("llm-icons.generated.ts is up to date.");
} else {
  fs.writeFileSync(OUT, source);
  const kb = (Buffer.byteLength(source) / 1024).toFixed(1);
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${kb} KB, ${LLM_ICON_IDS.length} providers).`);
}
