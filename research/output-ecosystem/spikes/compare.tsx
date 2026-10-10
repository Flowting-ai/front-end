import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { defineRegistry, Renderer as JsonRenderer, JSONUIProvider } from "@json-render/react";
import { createLibrary, createParser, createStreamingParser, defineComponent, Renderer as OpenRenderer } from "@openuidev/react-lang";
import { renderGenerativeUI } from "@assistant-ui/generative-ui/react";
import * as contentParserModule from "../../../src/lib/content-parser";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { cases, type Case } from "./fixtures";
import { fromCase, validateAgainstSource } from "./catalog";

const browserDom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  window: browserDom.window,
  document: browserDom.window.document,
  HTMLElement: browserDom.window.HTMLElement,
  Event: browserDom.window.Event,
  CustomEvent: browserDom.window.CustomEvent,
  customElements: browserDom.window.customElements,
  MutationObserver: browserDom.window.MutationObserver,
  CSSStyleSheet: class { replaceSync(_css: string) {} }
});

const OutputProps = z.object({
  claim: z.string(),
  evidence: z.array(z.object({ id: z.string(), label: z.string(), value: z.string(), source: z.string() })),
  uncertainty: z.string(),
  nextStep: z.string(),
  actionLabel: z.string().nullable()
});
const OpenProps = OutputProps.extend({ actionLabel: z.string() });

function card(p: z.infer<typeof OutputProps>) {
  return <article><h2>{p.claim}</h2><dl>{p.evidence.map(e => <div key={e.id}><dt>{e.label}</dt><dd>{e.value} · {e.source}</dd></div>)}</dl><p>{p.uncertainty}</p><p>{p.nextStep}</p>{p.actionLabel && <button type="button">{p.actionLabel}</button>}</article>;
}

function propsFor(c: Case) {
  return { claim: c.claim, evidence: c.evidence, uncertainty: c.uncertainty, nextStep: c.nextStep, actionLabel: c.action?.label ?? null };
}

const jsonCatalog = defineCatalog(schema, {
  components: { OutputCard: { props: OutputProps, description: "Evidence-backed merchant answer; action is a proposal only" } },
  actions: {}
});
const { registry: jsonRegistry } = defineRegistry(jsonCatalog, { components: { OutputCard: ({ props }) => card(props) } });

const openLibrary = createLibrary({ root: "OutputCard", components: [defineComponent({
  name: "OutputCard",
  description: "Evidence-backed merchant answer; action is a proposal only",
  props: OpenProps,
  component: ({ props: p }) => card({ ...p, actionLabel: p.actionLabel || null })
})] });

const assistantLibrary = {
  OutputCard: {
    description: "Evidence-backed merchant answer; action is a proposal only",
    properties: OutputProps,
    render: card
  }
};

function quote(v: unknown): string { return JSON.stringify(v); }
function openSpec(p: ReturnType<typeof propsFor>) {
  return `root = OutputCard(${quote(p.claim)}, ${quote(p.evidence)}, ${quote(p.uncertainty)}, ${quote(p.nextStep)}, ${quote(p.actionLabel ?? "")})`;
}

function check(c: Case, html: string) {
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const required = [c.claim, ...c.evidence.flatMap(e => [e.label, e.value, e.source]), c.uncertainty, c.nextStep, ...(c.action ? [c.action.label] : [])];
  const missing = required.filter(s => !stripped.includes(s));
  const extraAction = !c.action && /<button\b/.test(html);
  return { valid: missing.length === 0 && !extraAction, missing, extraAction, bytes: Buffer.byteLength(html) };
}

async function run(c: Case) {
  const p = propsFor(c);
  const results: Record<string, unknown> = {};
  const go = (name: string, fn: () => string) => {
    const started = performance.now();
    try { const html = fn(); results[name] = { ...check(c, html), elapsedMs: +(performance.now() - started).toFixed(2) }; }
    catch (e) { results[name] = { valid: false, error: String(e) }; }
  };

  go("existing-parser", () => {
    const parseContentSegments = (contentParserModule as any).parseContentSegments ?? (contentParserModule as any).default?.parseContentSegments;
    const text = [c.claim, ...c.evidence.map(e => `${e.label}: ${e.value} (${e.source})`), c.uncertainty, c.nextStep, c.action?.label ?? ""].filter(Boolean).join("\n");
    const segments = parseContentSegments(text, { streaming: false });
    return renderToStaticMarkup(<article>{segments.map((s: any, i: number) => <p key={i}>{"content" in s ? s.content : text}</p>)}</article>);
  });

  go("json-render", () => {
    const spec = { root: "answer", elements: { answer: { type: "OutputCard", props: p, children: [] } } };
    const validation = jsonCatalog.validate(spec);
    if (!validation.success) throw new Error("catalog rejected spec");
    return renderToStaticMarkup(<JSONUIProvider registry={jsonRegistry}><JsonRenderer spec={spec} registry={jsonRegistry} /></JSONUIProvider>);
  });

  go("openui", () => {
    const input = openSpec(p);
    const parsed = createParser(openLibrary.toJSONSchema()).parse(input);
    if (parsed.meta.errors.length || parsed.meta.unresolved.length) throw new Error(JSON.stringify(parsed.meta));
    const html = renderToStaticMarkup(<OpenRenderer response={input} library={openLibrary} isStreaming={false} />);
    if (!html) throw new Error(`empty render; parsed=${JSON.stringify(parsed).slice(0, 900)}`);
    return html;
  });

  go("assistant-ui", () => {
    const node = { $type: "OutputCard", ...p };
    return renderToStaticMarkup(<>{renderGenerativeUI(node, assistantLibrary)}</>);
  });

  try {
    const [{ MessageProcessor }, { basicCatalog }, { A2uiSurface }] = await Promise.all([
      import("@a2ui/web_core/v0_9"), import("@a2ui/web_core/v0_9/basic_catalog"), import("@a2ui/react/v0_9")
    ]);
    const started = performance.now();
    try {
    const processor = new MessageProcessor([basicCatalog]);
    const text = [c.claim, ...c.evidence.map(e => `${e.label}: ${e.value} · ${e.source}`), c.uncertainty, c.nextStep, c.action?.label ?? ""].filter(Boolean).join("\n");
    processor.processMessages([
      { version: "v0.9", createSurface: { surfaceId: "answer", catalogId: basicCatalog.id } },
      { version: "v0.9", updateComponents: { surfaceId: "answer", components: [
        { id: "root", component: "Column", children: ["body"] },
        { id: "body", component: "Text", text: { path: "/body" } }
      ] } },
      { version: "v0.9", updateDataModel: { surfaceId: "answer", path: "/", value: { body: text } } }
    ]);
    const surface = processor.model.surfacesMap.get("answer");
    if (!surface) throw new Error("surface not created");
    const container = browserDom.window.document.createElement("div");
    browserDom.window.document.body.appendChild(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(container);
    await act(async () => { root.render(<A2uiSurface surface={surface as any} />); });
    const html = container.innerHTML;
    results.a2ui = { ...check(c, html), runtimeClean: false, note: "JSDOM emitted a missing Markdown renderer warning; browser mount passed separately.", elapsedMs: +(performance.now() - started).toFixed(2) };
    await act(async () => { root.unmount(); });
    } catch (e) { results.a2ui = { valid: false, error: String(e) }; }
  } catch (e) {
    results.a2ui = { valid: false, error: String(e), note: "A2UI React requires browser globals; browser-host spike needed." };
  }

  const stream = createStreamingParser(openLibrary.toJSONSchema());
  const input = openSpec(p);
  for (let i = 0; i < input.length; i += 17) stream.push(input.slice(i, i + 17));
  const streamed = stream.getResult();
  results.openuiStreaming = { errors: streamed.meta.errors.length, unresolved: streamed.meta.unresolved.length };

  const goodRecord = fromCase(c);
  const badRecord = { ...goodRecord, claim: { ...goodRecord.claim, text: "An unsupported claim" } };
  const authoritySwap = { ...goodRecord, action: c.action ? null : { id: "invented-action", label: "Approve", state: "proposal_only" } };
  results.semanticGuard = {
    sourceAccepted: validateAgainstSource(goodRecord, c).valid,
    alteredClaimRejected: !validateAgainstSource(badRecord, c).valid,
    alteredActionRejected: !validateAgainstSource(authoritySwap, c).valid,
    note: "Framework schemas accept changed strings; this Souvenir source guard compares facts and authority against the frozen input."
  };
  return { id: c.id, results };
}

const output = [];
for (const c of cases) output.push(await run(c));
const parseContentSegments = (contentParserModule as any).parseContentSegments ?? (contentParserModule as any).default?.parseContentSegments;
const truncated = parseContentSegments("Supported answer.\n<metrics value=\"unfinished\"", { streaming: false });
const malformed = {
  existingParserPreservesLead: JSON.stringify(truncated).includes("Supported answer."),
  jsonRenderRejectsMissingClaim: !jsonCatalog.validate({ root: "answer", elements: { answer: { type: "OutputCard", props: { ...propsFor(cases[0]), claim: undefined }, children: [] } } }).success,
  openUIReportsUnknownComponent: createParser(openLibrary.toJSONSchema()).parse('root = Unknown("x")').meta.errors.some(e => e.code === "unknown-component"),
  assistantUnknownHtml: renderToStaticMarkup(<>{renderGenerativeUI({ $type: "Unknown" }, assistantLibrary)}</>)
};
process.stdout.write(JSON.stringify({ fixtureVersion: "synthetic-1", packageVersions: "see package-lock.json", cases: output, malformed }, null, 2) + "\n");
for (const c of output) {
  for (const name of ["existing-parser", "json-render", "openui", "assistant-ui"]) {
    if (!(c.results[name] as any)?.valid) process.exitCode = 1;
  }
  const guard = c.results.semanticGuard as any;
  if (!guard.sourceAccepted || !guard.alteredClaimRejected || !guard.alteredActionRejected) process.exitCode = 1;
}
if (!malformed.existingParserPreservesLead || !malformed.jsonRenderRejectsMissingClaim || !malformed.openUIReportsUnknownComponent || malformed.assistantUnknownHtml) process.exitCode = 1;
