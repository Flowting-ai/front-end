import { NextResponse } from "next/server";

/**
 * SSE event types emitted by the backend.
 *
 * ── Unnamed stream events (parsed via `type` field in data JSON) ──
 * reasoning            – incremental thinking/reasoning chunks (`content`)
 * content              – visible assistant text token (`content`)
 * image                – model-produced inline image (`images: string[]`)
 * tool_calls_streaming – model is streaming tool call JSON args per-fragment
 *                        (`content` = tool name, `tool_call.{name,args_delta,args_length}`)
 * tool_executing       – backend is about to run a tool
 *                        (`content` = tool name, `tool_call.{name,arguments,tool_call_id,...}`)
 * tool_complete        – tool finished (`content` = tool name, `tool_call.{result,duration_s,...}`)
 * done                 – one LLM round finished (`usage`, `reasoning_details`, `tool_calls`, `finish_reason`)
 * error                – stream / LLM / on_complete failure (`error`)
 *
 * ── Named events (carry `event: <name>` line) ──
 * message_saved        – AI message persisted (`message_id`)
 * title                – chat title update (`title`)
 * web_search           – web-search result (`query`, `links[]`)
 * image                – CSV chart or generated image (`url`, `s3_key`)
 * generated_file       – downloadable file produced (`url`, `s3_key`, `filename`, `mime_type`)
 * tool_progress        – running tool step progress (`tool`, `status`, `filename`, `step?`, `message?`)
 * docx_progress        – document generation step progress (`step`, `message`, `filename`, `code_preview?`)
 * model_selected       – auto-selected model info (`model_id`, `model_name`, `company`, ...)
 *
 * ── Workflow-only named events ──
 * workflow_start       – workflow execution began (`workflow_id`, `workflow_name`, `node_count`)
 * node_start           – a workflow node started (`node_id`, `node_type`, `name`)
 * content (named)      – workflow node content chunk (`node_id`, `content`)
 * node_image           – workflow node produced an image (`node_id`, `url`, `s3_key`)
 * node_complete        – workflow node finished (`node_id`, `node_type`, `name`, `is_kb_node?`)
 * node_failed          – workflow node errored (`node_id`, `error`)
 * workflow_complete    – workflow finished (`final_output`)
 *
 * ── Transport-level ──
 * `: heartbeat`        – SSE comment line sent every 10 s to prevent proxy timeouts (clients ignore it)
 */

export async function POST(req: Request) {
  const baseUrl = process.env.SERVER_URL!;
  const targetUrl = new URL("/chat/", baseUrl);
  const incomingHeaders = new Headers(req.headers);

  try {
    const payload = await req.json();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(incomingHeaders.get("authorization")
          ? { authorization: incomingHeaders.get("authorization") as string }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type") ?? "";

    // Pass SSE streams through with proper headers so the browser can consume
    // them with EventSource / fetch-based readers without buffering.
    if (contentType.includes("text/event-stream")) {
      if (!response.body) {
        return NextResponse.json(
          { response: "Empty stream from upstream." },
          { status: 502 }
        );
      }

      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Non-streaming fallback: buffer and return as-is.
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": contentType || "application/json",
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { response: "Sorry, I'm having trouble responding right now." },
      { status: 500 }
    );
  }
}
