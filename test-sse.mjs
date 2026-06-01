/**
 * SSE stream tester — hits the backend /chats/create directly with the JWT token
 * and pretty-prints every event as it arrives.
 *
 * Usage:  node test-sse.mjs [message] [--web-search] [--reasoning]
 */

import { createRequire } from "module"
import https from "https"
import http from "http"

const JWT = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IklPc0Z6MmphWElsZWl5TXU3eXlhcCJ9.eyJpc3MiOiJodHRwczovL2Rldi1pamtheHd6eG91NTBmZm10LnVzLmF1dGgwLmNvbS8iLCJzdWIiOiJhdXRoMHw2OWQyMDY4NzRkNzRiNjFiZjhiZmFiYWQiLCJhdWQiOlsiaHR0cHM6Ly9zZXJ2ZXItYWNjZXNzIiwiaHR0cHM6Ly9kZXYtaWprYXh3enhvdTUwZmZtdC51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzgwMjU5OTYwLCJleHAiOjE3ODAzNDYzNjAsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhenAiOiJGa3h6bEx4eEFVeDhleXdIcXVUQ3dWbGRqb1dKR1pMciJ9.LjsuArsCNObOiregwi7P79XAe_nHSVETSmJHNUqoXS4ocKQEebiHQUBouWBY9_HLxI2CV80Tthqn3dATNL5J_VXKgCTN62w7fBGwzqsa_FmG0QBWDRUKJf-BucmbGY5kr-YBtdMJ5wTDSPT1b9OoCV2yjhr57jYJmgFW4UNf_aq17A6puyVSiZS52zQKYY1XLggN2dl_AuTGfqEx_35as4uaaTvVtOkBoZDrgC060h9Q9pF4YEczk2foQEt-IXpccRmTKSCJ7UPqrylMO5a0wyaCnbIxL2MQrNiVo8Mx7AjxkJkA-gFRNqwtAW36wJ7A1JDEllQMytS-CBsVyJaZUw"

const BACKEND = "https://devapi.getsouvenir.com"
const ENDPOINT = `${BACKEND}/chats/create`

// CLI args
const args = process.argv.slice(2)
const message = args.find(a => !a.startsWith("--")) ?? "Say hello and briefly describe what you can do."
const webSearch = args.includes("--web-search")
const reasoning = args.includes("--reasoning")

// ── ANSI colours ───────────────────────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  yellow:  "\x1b[33m",
  green:   "\x1b[32m",
  red:     "\x1b[31m",
  magenta: "\x1b[35m",
  blue:    "\x1b[34m",
  gray:    "\x1b[90m",
}

// Event-type → colour mapping
const EVENT_COLORS = {
  metadata:             C.blue,
  title:                C.blue,
  model_selected:       C.cyan,
  reasoning:            C.magenta,
  reasoning_heading:    C.magenta,
  reasoning_body:       C.magenta,
  chunk:                C.green,
  web_search:           C.yellow,
  tool_calls_streaming: C.yellow,
  tool_executing:       C.yellow,
  tool_progress:        C.yellow,
  tool_complete:        C.yellow,
  tool_connect_prompt:  C.yellow,
  tool_permission_prompt: C.yellow,
  structured_block:     C.cyan,
  image:                C.cyan,
  generated_file:       C.cyan,
  docx_progress:        C.cyan,
  message_saved:        C.green,
  done:                 C.green,
  error:                C.red,
}

// Event counters & timing
const stats = { events: {}, tokens: 0, reasoningTokens: 0 }
const startTime = Date.now()

function log(eventName, data, rawData) {
  const colour = EVENT_COLORS[eventName] ?? C.gray
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  process.stdout.write(`\n${C.dim}[${elapsed}s]${C.reset} ${colour}${C.bold}▶ ${eventName}${C.reset}`)

  stats.events[eventName] = (stats.events[eventName] ?? 0) + 1

  // Per-event pretty rendering
  if (eventName === "chunk" && typeof data?.delta === "string") {
    process.stdout.write(`  ${C.gray}(${data.delta.length} chars)${C.reset}`)
    process.stdout.write(`\n  ${C.green}${data.delta}${C.reset}`)
    stats.tokens += data.delta.split(/\s+/).length
  } else if (eventName === "reasoning" && typeof data?.delta === "string") {
    process.stdout.write(`  ${C.gray}(${data.delta.length} chars)${C.reset}`)
    process.stdout.write(`\n  ${C.magenta}${data.delta}${C.reset}`)
    stats.reasoningTokens += data.delta.split(/\s+/).length
  } else if (eventName === "reasoning_heading") {
    process.stdout.write(`\n  ${C.magenta}${C.bold}## ${data?.content ?? ""}${C.reset}`)
  } else if (eventName === "reasoning_body") {
    process.stdout.write(`  ${C.gray}(${(data?.content ?? "").length} chars)${C.reset}`)
    process.stdout.write(`\n  ${C.magenta}${data?.content ?? ""}${C.reset}`)
  } else if (eventName === "model_selected") {
    process.stdout.write(`\n  model_name: ${C.cyan}${data?.model_name ?? "?"}${C.reset}`)
    if (data?.model_id)       process.stdout.write(`  id: ${data.model_id}`)
    if (data?.company)        process.stdout.write(`  company: ${data.company}`)
    if (data?.thinking_enabled) process.stdout.write(`  ${C.magenta}thinking: ON${C.reset}`)
    if (data?.effort)         process.stdout.write(`  effort: ${data.effort}`)
  } else if (eventName === "metadata" || eventName === "title") {
    if (data?.title ?? data?.chat_title) {
      process.stdout.write(`\n  title: "${data?.title ?? data?.chat_title}"`)
    }
    if (data?.chat_id ?? data?.chatId) {
      process.stdout.write(`  chat_id: ${data?.chat_id ?? data?.chatId}`)
    }
  } else if (eventName === "web_search") {
    process.stdout.write(`\n  query: "${data?.query}"`)
    const links = Array.isArray(data?.links) ? data.links : []
    links.slice(0, 3).forEach(l => {
      process.stdout.write(`\n    - ${typeof l === "string" ? l : l?.url ?? JSON.stringify(l)}`)
    })
    if (links.length > 3) process.stdout.write(`\n    … and ${links.length - 3} more`)
  } else if (eventName === "tool_executing") {
    const tc = data?.tool_call ?? {}
    process.stdout.write(`\n  tool: ${tc.name ?? data?.content ?? "?"}`)
    if (data?.label) process.stdout.write(`  label: "${data.label}"`)
    if (tc.tool_call_id) process.stdout.write(`  id: ${tc.tool_call_id}`)
  } else if (eventName === "tool_progress") {
    process.stdout.write(`\n  tool: ${data?.tool}  status: ${data?.status}`)
    if (data?.label) process.stdout.write(`  label: "${data.label}"`)
    if (data?.message) process.stdout.write(`\n  msg: ${data.message}`)
  } else if (eventName === "tool_complete") {
    const tc = data?.tool_call ?? {}
    process.stdout.write(`\n  tool: ${tc.name ?? data?.content ?? "?"}`)
    if (tc.duration_s != null) process.stdout.write(`  duration: ${tc.duration_s}s`)
  } else if (eventName === "image") {
    if (Array.isArray(data?.images)) {
      data.images.forEach(url => process.stdout.write(`\n  img: ${url}`))
    } else if (data?.url) {
      process.stdout.write(`\n  url: ${data.url}`)
    }
  } else if (eventName === "generated_file") {
    process.stdout.write(`\n  file: ${data?.filename}  mime: ${data?.mime_type}`)
    process.stdout.write(`\n  url: ${data?.url}`)
  } else if (eventName === "message_saved") {
    const msg = data?.message ?? data?.data ?? data
    process.stdout.write(`\n  message_id: ${msg?.message_id ?? msg?.id ?? "?"}`)
    if (msg?.chat_id) process.stdout.write(`  chat_id: ${msg.chat_id}`)
    const atts = msg?.file_attachments
    if (Array.isArray(atts) && atts.length) {
      process.stdout.write(`\n  file_attachments (${atts.length}):`)
      atts.slice(0, 5).forEach(a => {
        process.stdout.write(`\n    origin=${a.origin}  file_name="${a.file_name}"  url="${a.file_link ?? a.url ?? ""}"`)
      })
    }
    if (Array.isArray(msg?.sources) && msg.sources.length) {
      process.stdout.write(`\n  sources: ${msg.sources.length}`)
    }
  } else if (eventName === "done") {
    process.stdout.write(`\n  finish_reason: ${data?.finish_reason ?? "?"}`)
    if (data?.chat_id ?? data?.chatId) process.stdout.write(`  chat_id: ${data?.chat_id ?? data?.chatId}`)
    if (data?.title ?? data?.chat_title) process.stdout.write(`\n  title: "${data?.title ?? data?.chat_title}"`)
  } else if (eventName === "error") {
    process.stdout.write(`\n  ${C.red}${data?.error ?? rawData}${C.reset}`)
  } else if (eventName === "docx_progress") {
    process.stdout.write(`\n  step: ${data?.step}  file: ${data?.filename}`)
    if (data?.message) process.stdout.write(`\n  msg: ${data.message}`)
  } else if (eventName === "structured_block") {
    process.stdout.write(`\n  kind: ${data?.block?.kind}`)
  } else {
    // Fallback: dump the full JSON (truncated)
    const str = JSON.stringify(data ?? rawData)
    process.stdout.write(`\n  ${str.length > 300 ? str.slice(0, 297) + "…" : str}`)
  }
}

// ── SSE parser ─────────────────────────────────────────────────────────────────
function makeSSEParser(onEvent) {
  let buffer = ""
  return function processChunk(chunk) {
    buffer += chunk
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ""
    for (const block of blocks) {
      // Split joined events
      for (const raw of block.split(/\r?\n(?=event:)/)) {
        const lines = raw.split(/\r?\n/)
        let eventName = ""
        const dataLines = []
        for (const line of lines) {
          if (line.startsWith(": ")) continue // SSE comment / keepalive
          if (line === ":") continue
          if (line.startsWith("event:")) {
            const colonIdx = line.indexOf("data:", 6)
            if (colonIdx !== -1) {
              eventName = line.slice(6, colonIdx).trim()
              const inline = line.slice(colonIdx + 5)
              dataLines.push(inline.startsWith(" ") ? inline.slice(1) : inline)
            } else {
              eventName = line.slice(6).trim()
            }
          } else if (line.startsWith("data:")) {
            const raw2 = line.slice(5)
            dataLines.push(raw2.startsWith(" ") ? raw2.slice(1) : raw2)
          }
        }
        const dataStr = dataLines.join("\n").trim()
        if (!dataStr) continue

        let parsed = null
        try { parsed = JSON.parse(dataStr) } catch { /* plain text */ }

        // Normalise type → eventName
        if (!eventName && parsed?.type) {
          eventName = parsed.type === "content" ? "chunk" : parsed.type
          if (parsed.type === "content" && typeof parsed.content === "string" && !("delta" in parsed)) {
            parsed = { ...parsed, delta: parsed.content }
          }
        }

        onEvent(eventName || "unknown", parsed, dataStr)
      }
    }
  }
}

// ── Build multipart form-data (no external deps) ───────────────────────────────
function buildFormData(fields) {
  const boundary = "----SSETestBoundary" + Math.random().toString(36).slice(2)
  let body = ""
  for (const [name, value] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
  }
  body += `--${boundary}--\r\n`
  return { boundary, body }
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}${C.cyan}=== SSE Stream Tester ===${C.reset}`)
console.log(`${C.dim}Endpoint: ${ENDPOINT}${C.reset}`)
console.log(`${C.dim}Message:  "${message}"${C.reset}`)
console.log(`${C.dim}Options:  webSearch=${webSearch}  reasoning=${reasoning}${C.reset}`)
console.log(`${C.dim}${"─".repeat(60)}${C.reset}`)

const fields = { input: message }
if (webSearch) fields.web_search = "true"
if (reasoning) fields.enable_thinking = "true"

const { boundary, body } = buildFormData(fields)

const url = new URL(ENDPOINT)
const isHttps = url.protocol === "https:"
const lib = isHttps ? https : http

const options = {
  method: "POST",
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname + url.search,
  headers: {
    Authorization: `Bearer ${JWT}`,
    Accept: "text/event-stream",
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": Buffer.byteLength(body),
  },
}

const processChunk = makeSSEParser((eventName, parsed, raw) => {
  log(eventName, parsed, raw)
})

const req = lib.request(options, (res) => {
  console.log(`\n${C.dim}HTTP ${res.statusCode} ${res.statusMessage}${C.reset}`)

  // Print interesting response headers
  const chatIdHeader = res.headers["x-chat-id"] ?? res.headers["X-Chat-Id"]
  if (chatIdHeader) console.log(`${C.dim}X-Chat-Id: ${chatIdHeader}${C.reset}`)
  console.log(`${C.dim}Content-Type: ${res.headers["content-type"]}${C.reset}`)

  if (res.statusCode < 200 || res.statusCode >= 300) {
    let errBody = ""
    res.on("data", c => errBody += c)
    res.on("end", () => {
      console.error(`\n${C.red}Error response:${C.reset}\n${errBody}`)
      process.exit(1)
    })
    return
  }

  res.setEncoding("utf8")

  res.on("data", chunk => processChunk(chunk))

  res.on("end", () => {
    // Flush any remainder
    processChunk("\n\n")

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n\n${C.dim}${"─".repeat(60)}${C.reset}`)
    console.log(`${C.bold}${C.green}Stream complete in ${elapsed}s${C.reset}`)
    console.log(`\n${C.bold}Event counts:${C.reset}`)
    for (const [name, count] of Object.entries(stats.events).sort((a, b) => b[1] - a[1])) {
      const colour = EVENT_COLORS[name] ?? C.gray
      console.log(`  ${colour}${name.padEnd(28)}${C.reset} ${count}`)
    }
    if (stats.tokens > 0)          console.log(`\n  ~${stats.tokens} content words streamed`)
    if (stats.reasoningTokens > 0) console.log(`  ~${stats.reasoningTokens} reasoning words streamed`)
  })
})

req.on("error", (err) => {
  console.error(`\n${C.red}Request error: ${err.message}${C.reset}`)
  process.exit(1)
})

req.write(body)
req.end()
// This file already has everything — running the existing stream test.
