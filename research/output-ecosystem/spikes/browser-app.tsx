import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { defineCatalog } from "@json-render/core";
import { defineRegistry, JSONUIProvider, Renderer as JsonRenderer } from "@json-render/react";
import { schema } from "@json-render/react/schema";
import { createLibrary, defineComponent, Renderer as OpenRenderer } from "@openuidev/react-lang";
import { renderGenerativeUI } from "@assistant-ui/generative-ui/react";
import { MessageProcessor } from "@a2ui/web_core/v0_9";
import { basicCatalog } from "@a2ui/web_core/v0_9/basic_catalog";
import { A2uiSurface } from "@a2ui/react/v0_9";
import { parseContentSegments } from "../../../src/lib/content-parser";
import { cases, type Case } from "./fixtures";
import "./browser.css";

const Props = z.object({ claim: z.string(), evidence: z.array(z.object({ id: z.string(), label: z.string(), value: z.string(), source: z.string() })), uncertainty: z.string(), nextStep: z.string(), actionLabel: z.string().nullable() });
type P = z.infer<typeof Props>;
const propsFor = (c: Case): P => ({ claim: c.claim, evidence: c.evidence, uncertainty: c.uncertainty, nextStep: c.nextStep, actionLabel: c.action?.label ?? null });
function Card(p: P) { return <article className="answer"><h3>{p.claim}</h3><dl>{p.evidence.map(e => <div key={e.id}><dt>{e.label}</dt><dd>{e.value}<small>{e.source}</small></dd></div>)}</dl><p className="caveat">{p.uncertainty}</p><p><strong>Next:</strong> {p.nextStep}</p>{p.actionLabel && <button type="button" aria-label={`${p.actionLabel} (simulated)`}>{p.actionLabel} · simulated</button>}</article>; }
const catalog = defineCatalog(schema, { components: { OutputCard: { props: Props, description: "Synthetic merchant answer" } }, actions: {} });
const { registry } = defineRegistry(catalog, { components: { OutputCard: ({ props }) => <Card {...props} /> } });
const openLibrary = createLibrary({ root: "OutputCard", components: [defineComponent({ name: "OutputCard", description: "Synthetic merchant answer", props: Props.extend({ actionLabel: z.string() }), component: ({ props }) => <Card {...props} actionLabel={props.actionLabel || null} /> })] });
const assistantLibrary = { OutputCard: { description: "Synthetic merchant answer", properties: Props, render: Card } };
function textOf(c: Case) { return [c.claim, ...c.evidence.map(e => `${e.label}: ${e.value} (${e.source})`), c.uncertainty, `Next: ${c.nextStep}`, c.action?.label ?? ""].filter(Boolean).join("\n"); }
function openSpec(p: P) { return `root = OutputCard(${JSON.stringify(p.claim)}, ${JSON.stringify(p.evidence)}, ${JSON.stringify(p.uncertainty)}, ${JSON.stringify(p.nextStep)}, ${JSON.stringify(p.actionLabel ?? "")})`; }

function A2UI({ item }: { item: Case }) {
  const surface = useMemo(() => {
    const processor = new MessageProcessor([basicCatalog]);
    processor.processMessages([
      { version: "v0.9", createSurface: { surfaceId: "answer", catalogId: basicCatalog.id } },
      { version: "v0.9", updateComponents: { surfaceId: "answer", components: [
        { id: "root", component: "Column", children: ["body"] },
        { id: "body", component: "Text", text: { path: "/body" } }
      ] } },
      { version: "v0.9", updateDataModel: { surfaceId: "answer", path: "/", value: { body: textOf(item) } } }
    ]);
    return processor.model.surfacesMap.get("answer");
  }, [item]);
  return surface ? <A2uiSurface surface={surface as any} /> : <p>Surface unavailable.</p>;
}

function Lane({ name, item, malformed }: { name: string; item: Case; malformed: boolean }) {
  const p = propsFor(item);
  let content: React.ReactNode;
  if (name === "Existing parser") {
    const segments = parseContentSegments(malformed ? `${item.claim}\n<metrics value="` : textOf(item), { streaming: false });
    content = <article className="answer">{segments.map((s, i) => <p key={i}>{"content" in s ? String(s.content) : "Widget fallback"}</p>)}</article>;
  } else if (name === "json-render") {
    const spec = { root: "answer", elements: { answer: { type: malformed ? "Missing" : "OutputCard", props: p, children: [] } } };
    content = catalog.validate(spec).success ? <JSONUIProvider registry={registry}><JsonRenderer spec={spec} registry={registry} /></JSONUIProvider> : <p className="fallback">Rejected unknown component. {textOf(item)}</p>;
  } else if (name === "OpenUI") {
    content = <OpenRenderer response={malformed ? 'root = Unknown("x")' : openSpec(p)} library={openLibrary} isStreaming={false} />;
    if (malformed) content = <p className="fallback">Rejected unknown component. {textOf(item)}</p>;
  } else if (name === "assistant-ui") {
    content = malformed ? <p className="fallback">Rejected unknown component. {textOf(item)}</p> : renderGenerativeUI({ $type: "OutputCard", ...p }, assistantLibrary);
  } else {
    content = malformed ? <p className="fallback">Rejected unknown component. {textOf(item)}</p> : <A2UI item={item} />;
  }
  return <section className="lane" data-lane={name}><header><h2>{name}</h2><span>{malformed ? "malformed input" : "frozen input"}</span></header>{content}</section>;
}

function App() {
  const [selected, setSelected] = useState<Case["id"]>("diagnosis");
  const [malformed, setMalformed] = useState(false);
  const item = cases.find(c => c.id === selected)!;
  return <main><div className="intro"><p className="eyebrow">Research preview · synthetic data</p><h1>Souvenir Output renderer comparison</h1><p>Every lane receives the same claim, evidence, uncertainty and next step. This preview tests rendering, not model quality or merchant usefulness.</p></div><div className="controls"><label>Scenario <select value={selected} onChange={e => setSelected(e.target.value as Case["id"])}>{cases.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}</select></label><label><input type="checkbox" checked={malformed} onChange={e => setMalformed(e.target.checked)} /> Malformed component</label></div><div className="grid">{["Existing parser", "json-render", "OpenUI", "assistant-ui", "A2UI"].map(name => <Lane key={name} name={name} item={item} malformed={malformed} />)}</div><footer>Approval controls in this research preview are simulated. No business action is executed.</footer></main>;
}

createRoot(document.getElementById("root")!).render(<App />);
