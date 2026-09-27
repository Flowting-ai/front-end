"use client";

/**
 * One task, two routers, side by side — for recording.
 *
 * Each router (the old classifier, and Jev) picks a model through the local
 * routing lab (SouvenirAI scripts/routing_lab.py on :8777). The task then runs
 * as an ordinary Souvenir chat on that model through the same streaming hook
 * and message renderer the chat page uses, so both answers look exactly like
 * the product. The picked model stays hidden unless "Show models" is on.
 */

import { useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { InitialPrompts } from "@/components/chat/InitialPrompts";
import { Switch } from "@/components/Switch";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import type { UIMessage } from "@/types/chat";

const LAB = "/api/lab";

type Side = "old" | "new";

interface Run {
  model: string | null;
  routeMs: number | null;
  routeCost: number;
  chatId: string | null;
  finishedMs: number | null;
  runCost: number | null;
  error: string | null;
  done: boolean;
}

const SIDES: { side: Side; name: string; color: string }[] = [
  { side: "old", name: "Old router", color: "var(--brown-500)" },
  { side: "new", name: "Jev router", color: "var(--blue-600)" },
];

const FLOWS = [
  { title: "Daily sales trend", apps: ["Shopify", "Slack"],
    task: "Pull the Shopify orders processed in the 21 days before today (leave today out). Group revenue and order count by the day each order was processed (processedAt). Show the headline numbers (revenue, orders, average order value, and this week vs last week) as metrics, and daily revenue as a line chart here. Then write a Slack canvas called \"Sales trend\" with the same numbers and the daily table, and DM me the link." },
  { title: "Best sellers and low stock", apps: ["Shopify", "Slack"],
    task: "Pull recent Shopify orders and rank products by revenue. Show the top 8 as a bar chart here. Then list every variant with fewer than 10 units in stock, and write the text of a restock email to our supplier with suggested quantities (do not send or draft it anywhere). Put the best-seller table, the low-stock table and the email text in a Slack canvas called \"Best sellers and restock\" and DM me the link." },
  { title: "Top customers", apps: ["Shopify", "Slack"],
    task: "From recent Shopify orders, work out total spend and order count per customer. Show how many customers ordered more than once, a table of the top 10 by spend with their city, and a bar chart of their spend here. Put the table and two ideas for rewarding them in a Slack canvas called \"Top customers\" and DM me the link." },
  { title: "Channels and discount codes", apps: ["Shopify", "Slack"],
    task: "Each recent Shopify order carries a tag like channel:instagram. Work out revenue and order count per channel and show the revenue mix as a pie chart here. Then compare orders that used a discount code (WINTER15, FIRSTRUN10) with those that did not: count, average order value and total discount given, in a table. DM me on Slack with the three most useful takeaways." },
  { title: "Order value analysis in code", apps: ["Shopify", "Code", "Slack"],
    task: "Write and run a Python script in the sandbox that pulls every Shopify order from the last 21 days and analyses order value: a histogram of order totals, average order value by product type, and the share of revenue from the top 3 products. Show the histogram and a table here. Then write a Slack canvas called \"Order value analysis\" with the method, the table and three takeaways, and DM me the link." },
  { title: "Fulfillment backlog", apps: ["Shopify", "Slack"],
    task: "Check recent Shopify orders for fulfillment status. Show fulfilled vs unfulfilled as a pie chart and the backlog as metrics (open orders, units waiting, oldest open order) here. Then DM me on Slack a list of the 10 oldest unfulfilled orders with customer, items and order value, oldest first." },
];

const blankRun = (): Run => ({
  model: null, routeMs: null, routeCost: 0, chatId: null, finishedMs: null, runCost: null, error: null, done: false,
});

const fmtMs = (ms: number | null) =>
  ms == null ? "—" : ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
    : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
const fmtUsd = (usd: number | null) => (usd == null ? "—" : usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`);

/** The message as it appears on screen: never the "Done in the world" card, and
 *  the model it ran on only when revealed. */
function onScreen(message: UIMessage, reveal: boolean): UIMessage {
  const shown = { ...message, externalOutputActions: undefined };
  return reveal ? shown : { ...shown, modelMeta: undefined, modelName: undefined, model_name: undefined, model: undefined };
}

function Scoreboard({ runs, steps }: { runs: Record<Side, Run>; steps: Record<Side, number> }) {
  const tile = (label: string, oldValue: number, newValue: number, format: (v: number) => string, unit: string) => {
    const max = Math.max(oldValue, newValue) || 1;
    const ratio = Math.max(oldValue, newValue) / Math.max(Math.min(oldValue, newValue), 1e-9);
    const verdict = oldValue === newValue ? "Tie"
      : `${newValue < oldValue ? "Jev" : "Old"} ${ratio < 10 ? ratio.toFixed(1) : ratio.toFixed(0)}× ${unit}`;
    return (
      <div key={label} style={{
        display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px", borderRadius: 16,
        backgroundColor: "var(--neutral-white)", border: "1px solid var(--neutral-100)", boxShadow: "var(--shadow-surface-card)",
      }}>
        <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--neutral-500)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: "var(--font-title)", fontSize: 22, lineHeight: "28px", color: "var(--neutral-900)" }}>{verdict}</span>
        {SIDES.map(({ side, name, color }) => {
          const value = side === "old" ? oldValue : newValue;
          const wins = value < (side === "old" ? newValue : oldValue);
          return (
            <div key={side} style={{ display: "grid", gridTemplateColumns: "88px minmax(0,1fr) 72px", gap: 10, alignItems: "center", fontSize: 13, color: "var(--neutral-700)" }}>
              <span>{name}</span>
              <span style={{ height: 8, borderRadius: "0 4px 4px 0", backgroundColor: "var(--neutral-100)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(value / max) * 100}%`, backgroundColor: color, borderRadius: "0 4px 4px 0" }} />
              </span>
              <span style={{ textAlign: "right", fontFamily: "var(--font-code)", fontSize: 13, fontWeight: wins ? 600 : 400, color: wins ? "var(--green-700)" : "var(--neutral-900)" }}>{format(value)}</span>
            </div>
          );
        })}
      </div>
    );
  };
  const total = (run: Run) => run.routeCost + (run.runCost ?? 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
      {tile("Time to finish", runs.old.finishedMs ?? 0, runs.new.finishedMs ?? 0, (v) => fmtMs(v), "faster")}
      {tile("Total cost", total(runs.old), total(runs.new), (v) => fmtUsd(v), "cheaper")}
      {tile("Steps taken", steps.old, steps.new, (v) => String(v), "fewer steps")}
    </div>
  );
}

export default function ComparePage() {
  const [input, setInput] = useState("");
  const [task, setTask] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [running, setRunning] = useState(false);
  const [oldMessages, setOldMessages] = useState<UIMessage[]>([]);
  const [newMessages, setNewMessages] = useState<UIMessage[]>([]);
  const [runs, setRuns] = useState<Record<Side, Run>>({ old: blankRun(), new: blankRun() });
  const chatIds = useRef<Record<Side, string | null>>({ old: null, new: null });

  const streams = {
    old: useStreamingChat({ setMessages: setOldMessages, onChatCreated: (id) => { chatIds.current.old = id; } }),
    new: useStreamingChat({ setMessages: setNewMessages, onChatCreated: (id) => { chatIds.current.new = id; } }),
  };
  const setMessagesFor = { old: setOldMessages, new: setNewMessages };
  const messagesFor = { old: oldMessages, new: newMessages };

  const update = (side: Side, fields: Partial<Run>) =>
    setRuns((prev) => ({ ...prev, [side]: { ...prev[side], ...fields } }));

  const runSide = async (side: Side, query: string) => {
    const started = performance.now();
    try {
      const routed = await fetch(`${LAB}/route/${side}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }),
      }).then((r) => { if (!r.ok) throw new Error(`routing failed (${r.status})`); return r.json(); });
      update(side, { model: routed.model, routeMs: routed.ms, routeCost: routed.cost });
      const loadingId = `loading-assistant-${side}-${Date.now()}`;
      setMessagesFor[side]([{
        id: loadingId, reactKey: loadingId, role: "assistant", content: "", created_at: new Date().toISOString(),
        chat_id: "", isLoading: true,
      }]);
      await streams[side].fetchAiResponse(query + routed.rules, null, loadingId, routed.modelId);
      const finishedMs = performance.now() - started;
      const chatId = chatIds.current[side];
      const runCost = chatId ? (await fetch(`${LAB}/cost/${chatId}`).then((r) => r.json())).cost : null;
      update(side, { finishedMs, chatId, runCost, done: true });
    } catch (e) {
      update(side, { error: e instanceof Error ? e.message : String(e), finishedMs: performance.now() - started, done: true });
    }
  };

  const start = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || running) return;
    setRunning(true);
    setInput("");
    setTask(trimmed);
    setOldMessages([]);
    setNewMessages([]);
    chatIds.current = { old: null, new: null };
    setRuns({ old: blankRun(), new: blankRun() });
    await Promise.all([runSide("old", trimmed), runSide("new", trimmed)]);
    setRunning(false);
  };

  const steps = {
    old: oldMessages.reduce((n, m) => n + (m.activities?.length ?? 0), 0),
    new: newMessages.reduce((n, m) => n + (m.activities?.length ?? 0), 0),
  };
  const bothDone = runs.old.done && runs.new.done && !runs.old.error && !runs.new.error;
  const userMessage: UIMessage | null = task
    ? { id: "task", reactKey: "task", role: "user", content: task, created_at: new Date().toISOString(), chat_id: "" }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", position: "relative" }}>
      <div
        className="kaya-scrollbar"
        style={{ flex: 1, overflowY: "auto", paddingTop: 24, paddingBottom: 24, paddingRight: 2, display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div style={{ width: "100%", maxWidth: 1240, padding: "0 20px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--neutral-600)", cursor: "pointer" }}>
              <Switch checked={reveal} onCheckedChange={setReveal} aria-label="Show models" />
              Show models
            </label>
          </div>

          {!task && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, paddingTop: "8vh" }}>
              <InitialPrompts />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, width: "100%", maxWidth: 900 }}>
                {FLOWS.map((flow) => (
                  <button
                    key={flow.title}
                    type="button"
                    onClick={() => setInput(flow.task)}
                    style={{
                      textAlign: "left", border: "1px solid var(--neutral-100)", borderRadius: 16, padding: "14px 16px", cursor: "pointer",
                      backgroundColor: "var(--neutral-white)", boxShadow: "var(--shadow-surface-card)", display: "flex", flexDirection: "column", gap: 8,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--neutral-900)" }}>{flow.title}</span>
                    <span style={{ fontSize: 13, lineHeight: "19px", color: "var(--neutral-500)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{flow.task}</span>
                    <span style={{ display: "flex", gap: 4 }}>
                      {flow.apps.map((app) => (
                        <span key={app} style={{ fontSize: 11, lineHeight: "16px", padding: "1px 7px", borderRadius: 6, backgroundColor: "var(--neutral-100)", color: "var(--neutral-700)" }}>{app}</span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {userMessage && (
            <div style={{ width: "100%", maxWidth: 720, alignSelf: "flex-end" }}>
              <ChatMessage message={userMessage} isLast={false} archived />
            </div>
          )}

          {bothDone && <Scoreboard runs={runs} steps={steps} />}

          {task && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
              {SIDES.map(({ side, name, color }) => {
                const run = runs[side];
                const status = run.error ? "Failed" : run.done ? `Done in ${fmtMs(run.finishedMs)}` : run.model ? "Working…" : "Choosing a model…";
                return (
                  <section key={side} style={{
                    minWidth: 0, borderRadius: 20, backgroundColor: "var(--neutral-white)", border: "1px solid var(--neutral-100)",
                    boxShadow: "var(--shadow-surface-card)", overflow: "hidden",
                  }}>
                    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 18px", borderBottom: "1px solid var(--neutral-100)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, color: "var(--neutral-900)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
                        {name}
                        {reveal && run.model && (
                          <span style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 400, color: "var(--neutral-600)", backgroundColor: "var(--neutral-50)", border: "1px solid var(--neutral-100)", padding: "1px 7px", borderRadius: 6 }}>{run.model}</span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: run.error ? "var(--red-600)" : "var(--neutral-500)" }}>{status}</span>
                    </header>
                    <div style={{ padding: "8px 18px 4px" }}>
                      {messagesFor[side].map((message, idx) => (
                        <ChatMessage
                          key={message.reactKey ?? message.id}
                          message={onScreen(message, reveal)}
                          isLast={idx === messagesFor[side].length - 1}
                          isNewMessage={!run.done}
                          chatId={run.chatId ?? undefined}
                          hidePinAction
                          disableHighlight
                        />
                      ))}
                      {run.error && <p style={{ color: "var(--red-600)", fontSize: 13 }}>{run.error}</p>}
                    </div>
                    <footer style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--neutral-100)", backgroundColor: "var(--neutral-50)" }}>
                      {[
                        ["Picked a model in", fmtMs(run.routeMs)],
                        ["Finished in", run.done ? fmtMs(run.finishedMs) : "—"],
                        ["Cost", run.done ? fmtUsd(run.routeCost + (run.runCost ?? 0)) : "—"],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--neutral-500)", fontWeight: 500 }}>{label}</span>
                          <span style={{ fontFamily: "var(--font-code)", fontSize: 13, color: "var(--neutral-900)" }}>{value}</span>
                        </div>
                      ))}
                    </footer>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "0 16px 16px" }}>
        <div style={{ width: "100%", maxWidth: 754 }}>
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={start}
            isStreaming={running}
            hideModelSelector
            hideAddButton
            placeholder="Give both routers the same task"
          />
        </div>
      </div>
    </div>
  );
}
