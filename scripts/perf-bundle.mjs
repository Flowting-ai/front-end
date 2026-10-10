#!/usr/bin/env node
/**
 * Bundle size report for a finished `next build`.
 *
 * Reads `.next/` only (no network, no build). For every prerendered page it lists the
 * scripts the HTML loads on first paint (the real initial JavaScript), and it lists the
 * largest chunks overall. Sizes are raw and gzip.
 *
 * Usage:
 *   node scripts/perf-bundle.mjs                  print the report
 *   node scripts/perf-bundle.mjs --json out.json  also write the report as JSON
 *   node scripts/perf-bundle.mjs --check          exit 1 when a budget in perf-budget.json is exceeded
 *
 * Dynamic (server-rendered) pages have no static HTML, so their initial JavaScript cannot be
 * read from disk. `/reasoning-verify` is prerendered and renders the same chat components,
 * so it is the stand-in for the chat page's component graph. Measure the real routes with a
 * browser (see docs/perf/README.md).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT = path.join(ROOT, ".next");
const args = process.argv.slice(2);
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const check = args.includes("--check");

if (!fs.existsSync(path.join(NEXT, "BUILD_ID"))) {
  console.error("No production build found in .next/ — run `next build` first.");
  process.exit(2);
}

const kb = (n) => Math.round(n / 1024);
const fileCache = new Map();
function measure(rel) {
  if (fileCache.has(rel)) return fileCache.get(rel);
  const abs = path.join(NEXT, rel);
  let res = { raw: 0, gzip: 0 };
  try {
    const buf = fs.readFileSync(abs);
    res = { raw: buf.length, gzip: zlib.gzipSync(buf).length };
  } catch {
    // chunk referenced but not on disk (e.g. dev-only) — counts as zero
  }
  fileCache.set(rel, res);
  return res;
}

const chunkDir = path.join(NEXT, "static", "chunks");
const allChunks = fs
  .readdirSync(chunkDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f, ...measure(`static/chunks/${f}`) }))
  .sort((a, b) => b.raw - a.raw);

const totalRaw = allChunks.reduce((a, c) => a + c.raw, 0);
const totalGzip = allChunks.reduce((a, c) => a + c.gzip, 0);

function htmlFiles(dir, base = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const appDir = path.join(NEXT, "server", "app");
const pages = htmlFiles(appDir)
  .filter((rel) => !rel.startsWith("_global-error"))
  .map((rel) => {
    const html = fs.readFileSync(path.join(appDir, rel), "utf8");
    const scripts = [...new Set([...html.matchAll(/\/_next\/(static\/chunks\/[^"?]+\.js)/g)].map((m) => m[1]))];
    const sizes = scripts.map((s) => ({ file: s.split("/").pop(), ...measure(s) }));
    const raw = sizes.reduce((a, s) => a + s.raw, 0);
    const gzip = sizes.reduce((a, s) => a + s.gzip, 0);
    return {
      page: "/" + rel.replace(/\.html$/, ""),
      scripts: scripts.length,
      raw,
      gzip,
      largest: [...sizes].sort((a, b) => b.raw - a.raw).slice(0, 3).map((s) => ({ file: s.file, raw: s.raw, gzip: s.gzip })),
    };
  })
  .sort((a, b) => b.raw - a.raw);

const report = {
  buildId: fs.readFileSync(path.join(NEXT, "BUILD_ID"), "utf8").trim(),
  generatedAt: new Date().toISOString(),
  totals: { chunks: allChunks.length, raw: totalRaw, gzip: totalGzip },
  topChunks: allChunks.slice(0, 12).map((c) => ({ file: c.file, raw: c.raw, gzip: c.gzip })),
  prerenderedPages: pages,
};

console.log(`Build ${report.buildId}`);
console.log(`All chunks: ${allChunks.length} files, ${kb(totalRaw)} KB raw, ${kb(totalGzip)} KB gzip (not first-load size)\n`);
console.log("Largest chunks");
for (const c of report.topChunks) console.log(`  ${String(kb(c.raw)).padStart(7)} KB raw ${String(kb(c.gzip)).padStart(7)} KB gz  ${c.file}`);
console.log("\nPrerendered pages: initial JavaScript");
for (const p of pages) {
  const big = p.largest[0];
  console.log(`  ${String(kb(p.raw)).padStart(7)} KB raw ${String(kb(p.gzip)).padStart(7)} KB gz ${String(p.scripts).padStart(3)} scripts  ${p.page}   (largest ${big ? `${big.file.slice(0, 14)} ${kb(big.raw)} KB` : "-"})`);
}

if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nWrote ${jsonOut}`);
}

if (check) {
  const budgetFile = path.join(ROOT, "perf-budget.json");
  if (!fs.existsSync(budgetFile)) {
    console.error("\n--check needs perf-budget.json at the project root.");
    process.exit(2);
  }
  const budget = JSON.parse(fs.readFileSync(budgetFile, "utf8"));
  const failures = [];
  const maxChunkKB = budget.maxInitialChunkKB;
  const allowed = new Set(budget.allowedLargeChunkNames ?? []);
  // Initial chunks = every script any prerendered page loads on first paint.
  const initial = new Set();
  for (const rel of htmlFiles(appDir)) {
    const html = fs.readFileSync(path.join(appDir, rel), "utf8");
    for (const m of html.matchAll(/\/_next\/(static\/chunks\/[^"?]+\.js)/g)) initial.add(m[1]);
  }
  if (maxChunkKB) {
    for (const s of initial) {
      const size = measure(s).raw;
      if (size > maxChunkKB * 1024 && !allowed.has(s.split("/").pop())) {
        failures.push(`initial chunk ${s.split("/").pop()} is ${kb(size)} KB raw (limit ${maxChunkKB} KB)`);
      }
    }
  }
  for (const [pagePath, limits] of Object.entries(budget.pages ?? {})) {
    const p = pages.find((x) => x.page === pagePath);
    if (!p) {
      failures.push(`budgeted page ${pagePath} is not prerendered in this build`);
      continue;
    }
    if (limits.maxGzipKB && p.gzip > limits.maxGzipKB * 1024) failures.push(`${pagePath} initial JS is ${kb(p.gzip)} KB gzip (limit ${limits.maxGzipKB} KB)`);
    if (limits.maxRawKB && p.raw > limits.maxRawKB * 1024) failures.push(`${pagePath} initial JS is ${kb(p.raw)} KB raw (limit ${limits.maxRawKB} KB)`);
  }
  if (failures.length) {
    console.error("\nBundle budget FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("\nBundle budget OK.");
}
