// Test-only AG-UI frames, shaped like what the backend streams (see
// lib/agui/to-app-event for how each maps to an app event). Shared by the
// stream reducer tests and the hook's characterization test.

const RUN = { threadId: "chat-1", runId: "run-1" }
const text = (delta: string) => ({ type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta })
const custom = (name: string, value: Record<string, unknown>) => ({ type: "CUSTOM", name, value })

/** Image generation: the `execute` tool runs the generation code and finishes
 *  before the CUSTOM `image` event carries the picture. */
const IMAGE_CODE = JSON.stringify({ code: 'client.generation("image").prompt("a red apple", aspect_ratio="1:1")' })

export const STREAM_FIXTURES: Record<string, object[]> = {
  longText: [
    { type: "RUN_STARTED", ...RUN },
    custom("model_selected", { model_id: "gpt-4o", model_name: "GPT-4o", deployment_name: "gpt-4o-dep", company: "openai" }),
    { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
    text("Hello "),
    text("there, "),
    text("this is a long answer."),
    custom("message_saved", { message_id: "real-msg-1", chat_id: "chat-1" }),
    text(" More after save."),
    { type: "TEXT_MESSAGE_END", messageId: "m1" },
    { type: "RUN_FINISHED", ...RUN },
  ],
  reasoning: [
    { type: "RUN_STARTED", ...RUN },
    { type: "THINKING_START" },
    custom("reasoning_heading", { content: "Planning", round_index: 0 }),
    custom("reasoning_body", { content: "First I consider the question.", round_index: 0 }),
    custom("reasoning_body", { content: " Then the answer.", round_index: 0 }),
    { type: "THINKING_END" },
    text("The answer is 42."),
    custom("title", { title: "Meaning of life", chat_id: "chat-1" }),
    { type: "RUN_FINISHED", ...RUN },
  ],
  thinkTag: [
    { type: "RUN_STARTED", ...RUN },
    text("<think>Hidden "),
    text("reasoning</think>"),
    text("Visible answer."),
    { type: "RUN_FINISHED", ...RUN },
  ],
  webSearch: [
    { type: "RUN_STARTED", ...RUN },
    custom("web_search", {
      query: "weather in Ames",
      links: ["https://weather.example.com/ames"],
      results: [
        { title: "Ames forecast", url: "https://weather.example.com/ames", snippet: "Sunny" },
        { title: "News", url: "https://www.news.example.org/a" },
      ],
    }),
    text("It is sunny [1]."),
    custom("message_saved", {
      message_id: "real-msg-2",
      sources: [
        { title: "Ames forecast", url: "https://www.weather.example.com/ames" },
        { url: "https://news.example.org/a" },
        { snippet: "no title or url" },
      ],
    }),
    { type: "RUN_FINISHED", ...RUN },
  ],
  toolCall: [
    { type: "RUN_STARTED", ...RUN },
    { type: "TOOL_CALL_START", toolCallId: "call-1", toolCallName: "web_search" },
    { type: "TOOL_CALL_ARGS", toolCallId: "call-1", delta: '{"query":"ames' },
    { type: "TOOL_CALL_ARGS", toolCallId: "call-1", delta: ' weather"}' },
    { type: "TOOL_CALL_END", toolCallId: "call-1" },
    custom("tool_progress", { tool: "web_search", status: "executing", label: "Searching", message: "Fetching" }),
    { type: "TOOL_CALL_RESULT", messageId: "t1", toolCallId: "call-1", content: "ok" },
    custom("done", { finish_reason: "tool_calls" }),
    text("Found it."),
    { type: "RUN_FINISHED", ...RUN },
  ],
  toolProgressOnly: [
    { type: "RUN_STARTED", ...RUN },
    custom("tool_progress", { tool: "code_interpreter", status: "start", filename: "a.py", message: "Starting", code_preview: "print(1)" }),
    custom("tool_progress", { tool: "code_interpreter", status: "error", filename: "a.py", label: "Run" }),
    custom("tool_complete", { content: "code_interpreter" }),
    { type: "RUN_FINISHED", ...RUN },
  ],
  toolError: [
    { type: "RUN_STARTED", ...RUN },
    custom("tool_executing", { content: "send_email", label: "Sending", tool_call: { name: "send_email", arguments: "{}" } }),
    custom("tool_error", { content: "send_email", error: "SMTP down" }),
    custom("tool_complete", { content: "send_email", tool_call: { name: "send_email", duration_s: 1.5 } }),
    custom("tool_executing", { content: "lookup", tool_call: { name: "lookup", tool_call_id: "lk-1" } }),
    custom("tool_complete", { content: "lookup", label: "Looked up", tool_call: { name: "lookup", tool_call_id: "lk-1", duration_s: 0.2 } }),
    text("Could not send."),
    { type: "RUN_FINISHED", ...RUN },
  ],
  image: [
    { type: "RUN_STARTED", ...RUN },
    { type: "TOOL_CALL_START", toolCallId: "call-img", toolCallName: "execute" },
    { type: "TOOL_CALL_ARGS", toolCallId: "call-img", delta: IMAGE_CODE.slice(0, 30) },
    { type: "TOOL_CALL_ARGS", toolCallId: "call-img", delta: IMAGE_CODE.slice(30, 60) },
    { type: "TOOL_CALL_ARGS", toolCallId: "call-img", delta: IMAGE_CODE.slice(60) },
    { type: "TOOL_CALL_ARGS", toolCallId: "call-img", delta: " " },
    { type: "TOOL_CALL_END", toolCallId: "call-img" },
    { type: "TOOL_CALL_RESULT", messageId: "t2", toolCallId: "call-img", content: "done" },
    custom("image", { url: "https://cdn.test/apple.png", s3_key: "img/apple.png" }),
    custom("image", { images: ["https://cdn.test/a2.png"] }),
    custom("message_saved", {
      message_id: "real-msg-3",
      file_attachments: [
        { origin: "generated", file_link: "https://cdn.test/apple.png", mime_type: "image/png" },
        { origin: "generated", url: "https://cdn.test/new.png", mime_type: "image/png" },
      ],
    }),
    { type: "RUN_FINISHED", ...RUN },
  ],
  files: [
    { type: "RUN_STARTED", ...RUN },
    custom("docx_progress", { step: "start", filename: "report.docx", message: "Writing" }),
    custom("docx_progress", { step: "done", filename: "report.docx", message: "", code_preview: "doc()" }),
    custom("generated_file", { url: "https://cdn.test/report.docx", s3_key: "f/report.docx", filename: "report.docx", mime_type: "application/docx" }),
    custom("message_saved", {
      message_id: "real-msg-4",
      file_attachments: [
        { origin: "uploaded", file_link: "https://cdn.test/up/notes.txt", file_name: "notes.txt", mime_type: "text/plain" },
        { origin: "user", url: "https://cdn.test/up/second.bin" },
        { origin: "generated", link: "https://cdn.test/report.docx", name: "report.docx" },
        { origin: "generated", link: "https://cdn.test/sheet.csv " },
      ],
    }),
    custom("done", {
      finish_reason: "stop",
      title: "Report chat",
      file_attachments: [
        { origin: "generated", file_link: "https://cdn.test/extra.pdf", file_name: "extra.pdf", mime_type: "application/pdf" },
        { origin: "uploaded", file_link: "https://cdn.test/up/notes2.txt", file_name: "notes.txt" },
      ],
    }),
  ],
  extras: [
    { type: "RUN_STARTED", ...RUN },
    custom("agent_started", { agent: "Researcher", handle: "@res", task: "Find sources" }),
    custom("agent_content", { agent: "Researcher", content: "Looking" }),
    custom("agent_content", { agent: "Researcher", content: " more" }),
    custom("agent_finished", { agent: "Researcher", error: null }),
    custom("agent_started", { agent: "Writer", task: "Draft" }),
    custom("agent_finished", { agent: "Writer", error: "crashed" }),
    custom("plan_updated", { items: [{ id: "1", title: "Search", status: "completed" }, { id: "2", title: "Write", status: "in_progress" }] }),
    custom("browser_view", { url: "https://live.test/v", page_url: "https://site.test", control: true }),
    custom("structured_block", { block: { kind: "callout", data: { text: "Note" } } }),
    custom("library_citations", { citations: [{ id: "L1", fileId: "f1", state: "locked" }, { bad: true }] }),
    custom("library_files", { chatOnlyFileIds: ["f9"] }),
    custom("library_shared", { fileId: "f1", grantId: "g1", label: "Weekly", personName: "Maya" }),
    custom("memory_updated", { scope: "user", scope_id: "u1", memory: "likes tea", version: 2 }),
    custom("stream_heartbeat", { elapsed_seconds: 3 }),
    custom("tool_connect_prompt", {
      connector_slug: "gmail", display_name: "Gmail", auth_mode: "api_key", tool_slug: "gmail_send", prompt_id: "cp-1", respond_url: "/chats/c/resume",
      provider: "pipedream", api_key_fields: [{ name: "key", label: "Key", secret: true, required: true }],
    }),
    custom("tool_connect_prompt", { connector_slug: "gmail", display_name: "Gmail", auth_mode: "oauth2", provider: "mcp", tool_slug: "gmail_send", prompt_id: "cp-1", respond_url: "/chats/c/resume" }),
    custom("permission_prompt", { prompt_id: "pp-1", respond_url: "/chats/c/resume", connector_slug: "gmail", display_name: "Gmail", tool_slug: "gmail_send", summary: "Send email" }),
    custom("question_prompt", { prompt_id: "qp-1", respond_url: "/chats/c/resume", title: "Which one?", questions: [{ id: "q1", question: "Pick a color", type: "yes_no" }] }),
    custom("question_prompt", { prompt_id: "qp-1", respond_url: "/chats/c/resume", title: "Which one?" }),
    custom("approval_prompt", { prompt_id: "ap-1", respond_url: "/chats/c/resume", verb: "send", connector_slug: "gmail", display_name: "Gmail" }),
    custom("user_prompt", { prompt_id: "up-1", respond_url: "/chats/c/resume", kind: "confirm", title: "Continue?" }),
    { type: "RUN_FINISHED", ...RUN },
  ],
  runError: [
    { type: "RUN_STARTED", ...RUN },
    text("Half an answer"),
    { type: "RUN_ERROR", message: "Rate limit exceeded" },
    { type: "RUN_FINISHED", ...RUN },
    custom("message_saved", { message_id: "real-msg-5" }),
  ],
  errorOnly: [
    { type: "RUN_STARTED", ...RUN },
    { type: "RUN_ERROR", message: "context_length_exceeded" },
  ],
  authError: [
    { type: "RUN_STARTED", ...RUN },
    text("partial"),
    { type: "RUN_ERROR", message: "Token expired" },
  ],
  endedWithoutDone: [
    { type: "RUN_STARTED", ...RUN },
    text("Cut off mid"),
  ],
  metadataNewChat: [
    { type: "RUN_STARTED", threadId: "temp-abc", runId: "run-1" },
    custom("metadata", { chatId: "new-chat-9" }),
    custom("title", { title: "Fresh chat" }),
    text("Hi"),
    custom("done", { finish_reason: "stop", chat_id: "new-chat-9", title: "Ignored title" }),
  ],
}
