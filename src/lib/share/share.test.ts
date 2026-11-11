import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/api/client"
import { acceptFailure, formatShareExpiry, previewFailure } from "./share-accept"
import { copyShareLink, copyText } from "./copy-link"
import { canonicalShareUrl } from "@/lib/share-url"
import { checkUploads, UPLOAD_LIMITS } from "@/lib/server/upload-limits"
import {
  personaShareSchema,
  shareDashboardSchema,
  sharePreviewSchema,
  sharedChatViewResponseSchema,
} from "@/lib/api/share-schemas"

const apiError = (status: number, message = "Backend said no") => new ApiError(status, "x", message, message)

describe("share accept page decisions", () => {
  it("maps preview failures to page states", () => {
    expect(previewFailure(apiError(404))).toEqual({ state: "not_found" })
    expect(previewFailure(apiError(410))).toEqual({ state: "expired" })
    expect(previewFailure(apiError(500, "Server down"))).toEqual({ state: "error", message: "Server down" })
    expect(previewFailure(new TypeError("Failed to fetch"))).toEqual({ state: "error", message: "Something went wrong. Please try again." })
  })

  it("maps accept failures", () => {
    expect(acceptFailure(apiError(410))).toEqual({ kind: "expired" })
    expect(acceptFailure(apiError(402))).toMatchObject({ kind: "toast", reason: "no_credits" })
    expect(acceptFailure(apiError(409, "Already accepted"))).toEqual({ kind: "toast", reason: "api", message: "Already accepted" })
    expect(acceptFailure(new Error("x"))).toMatchObject({ kind: "toast", reason: "unknown" })
  })

  it("formats expiry and guards bad dates", () => {
    expect(formatShareExpiry("2026-10-14T12:00:00Z", "en-US")).toBe("October 14, 2026")
    expect(formatShareExpiry("not a date")).toBe("No expiry")
    expect(formatShareExpiry(null)).toBe("No expiry")
  })
})

describe("copy link", () => {
  it("reports success and failure honestly", async () => {
    expect(await copyText("u", { writeText: () => Promise.resolve() })).toBe(true)
    expect(await copyText("u", { writeText: () => Promise.reject(new Error("denied")) })).toBe(false)
    expect(await copyText("u", undefined)).toBe(false)
  })

  it("shows the link in the error toast when the clipboard refuses", async () => {
    const notify = { success: vi.fn(), error: vi.fn() }
    await copyShareLink("https://app/share/1", notify, { writeText: () => Promise.reject(new Error("denied")) })
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ description: "https://app/share/1" }))
  })
})

describe("canonicalShareUrl", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("rewrites the origin to the configured base", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_URL", "https://app.example.com/")
    expect(canonicalShareUrl("http://backend:8000/share/abc?x=1#h")).toBe("https://app.example.com/share/abc?x=1#h")
  })

  it("leaves the URL alone without a base (server) or when it is not a URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_URL", "")
    expect(canonicalShareUrl("http://backend/share/abc")).toBe("http://backend/share/abc")
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_URL", "https://app.example.com")
    expect(canonicalShareUrl("not a url")).toBe("not a url")
    expect(canonicalShareUrl("")).toBe("")
  })
})

describe("upload limits", () => {
  it("allows up to the limits and rejects beyond them", () => {
    expect(checkUploads([])).toBeNull()
    expect(checkUploads(Array.from({ length: UPLOAD_LIMITS.maxFiles }, () => ({ size: 1 })))).toBeNull()
    expect(checkUploads(Array.from({ length: UPLOAD_LIMITS.maxFiles + 1 }, () => ({ size: 1 })))?.status).toBe(413)
    expect(checkUploads([{ size: UPLOAD_LIMITS.maxFileBytes + 1 }])?.status).toBe(413)
  })
})

describe("share schemas", () => {
  const share = {
    id: "s1", persona_repo_id: "r1", shared_by_user_id: "u1", share_type: "link",
    expires_at: "2026-11-01T00:00:00Z", is_active: true, share_url: "https://x/share/s1", created_at: "2026-10-01T00:00:00Z",
  }

  it("fills defaults for dropped optional fields", () => {
    const parsed = personaShareSchema.parse(share)
    expect(parsed.credit_used).toBe(0)
    expect(parsed.credit_limit).toBeNull()
    expect(parsed.recipient_emails).toBeNull()
  })

  it("fails a preview without its id", () => {
    expect(sharePreviewSchema.safeParse({ persona_name: "A", expires_at: "x" }).success).toBe(false)
  })

  it("drops malformed dashboard link cards instead of failing the dashboard", () => {
    const parsed = shareDashboardSchema.parse({
      summary: { active_links: 1, total_links: 2, conversations: 3, conversations_delta_pct: null, credits_this_month: 4, credits_delta_pct: null },
      daily: [{ date: "2026-10-01", credits: 5 }],
      window_days: 30,
      links: [share, { id: "broken" }],
    })
    expect(parsed.links.map((l) => l.id)).toEqual(["s1"])
  })

  it("normalises a shared chat view with missing reasoning and title", () => {
    const parsed = sharedChatViewResponseSchema.parse({
      share_id: "s", chat_id: "c", chat_title: null,
      messages: [{ id: "m", input: "hi", output: null, model_name: null, created_at: "t" }],
    })
    expect(parsed.chat_title).toBe("Untitled chat")
    expect(parsed.messages[0].reasoning).toBeNull()
  })
})
